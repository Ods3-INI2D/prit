const crypto = require('crypto');

const TIPOS_PAGAMENTO = {
    cartao_credito: 'credit_card',
    cartao_debito: 'debit_card',
    pix: 'bank_transfer',
    boleto: 'ticket'
};

const TODOS_TIPOS_PAGAMENTO = [
    'ticket',
    'bank_transfer',
    'atm',
    'credit_card',
    'debit_card',
    'prepaid_card',
    'digital_wallet',
    'voucher_card',
    'crypto_transfer'
];

function usandoCredenciaisDeTeste() {
    return process.env.MP_ENVIRONMENT === 'test';
}

function getAppUrl() {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
        throw new Error('APP_URL não configurada.');
    }

    const url = new URL(appUrl);
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        throw new Error('APP_URL precisa usar HTTPS em produção.');
    }
    return url.origin;
}

async function requestMercadoPago(path, options = {}) {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('MP_ACCESS_TOKEN não configurado.');
    }

    const response = await fetch('https://api.mercadopago.com' + path, {
        ...options,
        headers: {
            Authorization: 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(
            'Mercado Pago respondeu com HTTP ' + response.status +
            (data.message ? ': ' + data.message : '')
        );
    }
    return data;
}

async function criarPreferencia({ idPedido, valorTotal, formaPagamento, email }) {
    const tipoPermitido = TIPOS_PAGAMENTO[formaPagamento];
    if (!tipoPermitido) {
        throw new Error('Forma de pagamento inválida.');
    }

    const valor = Number(valorTotal);
    if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('Valor de pagamento inválido.');
    }

    const appUrl = getAppUrl();
    const urlResultado = new URL('/pagamento/resultado', appUrl);
    urlResultado.searchParams.set('pedido', String(idPedido));

    const preference = await requestMercadoPago('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify({
            external_reference: String(idPedido),
            items: [{
                id: String(idPedido),
                title: 'Pedido #' + idPedido,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number(valor.toFixed(2))
            }],
            payer: email ? { email } : undefined,
            payment_methods: {
                excluded_payment_types: TODOS_TIPOS_PAGAMENTO
                    .filter(tipo => tipo !== tipoPermitido)
                    .map(id => ({ id }))
            },
            back_urls: {
                success: urlResultado.toString(),
                failure: urlResultado.toString(),
                pending: urlResultado.toString()
            },
            auto_return: 'approved',
            notification_url: appUrl + '/webhooks/mercadopago'
        })
    });

    const checkoutDeTeste = usandoCredenciaisDeTeste();
    const checkoutUrl = checkoutDeTeste
        ? preference.sandbox_init_point
        : preference.init_point;
    if (!checkoutUrl) {
        throw new Error(
            checkoutDeTeste
                ? 'Mercado Pago não retornou o endereço de checkout de teste.'
                : 'Mercado Pago não retornou o endereço do checkout.'
        );
    }
    return checkoutUrl;
}

async function criarPagamentoPix({ idPedido, valorTotal, email, cpf }) {
    if (usandoCredenciaisDeTeste()) {
        throw new Error(
            'O teste de PIX do Mercado Pago deve ser feito pela rota de teste da API Orders, não pelo checkout de compra.'
        );
    }

    const valor = Number(valorTotal);
    if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('Valor de pagamento inválido.');
    }

    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) {
        throw new Error('MP_ACCESS_TOKEN não configurado.');
    }

    const emailPagador = email;
    const cpfPagador = (cpf || '').replace(/\D/g, '');

    if (!emailPagador || !/^\d{11}$/.test(cpfPagador)) {
        throw new Error('O cadastro do cliente precisa ter um CPF válido para pagar com PIX.');
    }

    const appUrl = getAppUrl();
    const pagamento = await requestMercadoPago('/v1/payments', {
        method: 'POST',
        headers: {
            'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
            transaction_amount: Number(valor.toFixed(2)),
            description: 'Pedido #' + idPedido,
            payment_method_id: 'pix',
            external_reference: String(idPedido),
            notification_url: appUrl + '/webhooks/mercadopago',
            payer: {
                email: emailPagador,
                identification: {
                    type: 'CPF',
                    number: cpfPagador
                }
            }
        })
    });

    const dadosPix = pagamento.point_of_interaction &&
        pagamento.point_of_interaction.transaction_data;
    if (!pagamento.id || !dadosPix || !dadosPix.qr_code || !dadosPix.qr_code_base64) {
        throw new Error('Mercado Pago não retornou os dados do QR Code PIX.');
    }

    return {
        id: pagamento.id,
        status: pagamento.status || 'pending',
        qrCode: dadosPix.qr_code,
        qrCodeBase64: dadosPix.qr_code_base64,
        ticketUrl: dadosPix.ticket_url || null
    };
}

async function criarOrderPixTeste() {
    if (!usandoCredenciaisDeTeste()) {
        throw new Error('Configure MP_ENVIRONMENT=test para criar um pedido PIX de teste.');
    }

    const valorTeste = '50.00';
    const emailPagador = process.env.MP_TEST_PAYER_EMAIL || 'test_payer@example.com';
    const referenciaExterna = 'pix-test-' + crypto.randomUUID();
    const order = await requestMercadoPago('/v1/orders', {
        method: 'POST',
        headers: {
            'X-Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
            type: 'online',
            processing_mode: 'automatic',
            external_reference: referenciaExterna,
            total_amount: valorTeste,
            payer: {
                email: emailPagador,
                first_name: 'APRO'
            },
            transactions: {
                payments: [{
                    amount: valorTeste,
                    payment_method: {
                        id: 'pix',
                        type: 'bank_transfer'
                    }
                }]
            }
        })
    });

    const pagamento = order.transactions &&
        order.transactions.payments &&
        order.transactions.payments[0];
    const metodoPagamento = pagamento && pagamento.payment_method;
    if (!order.id || !pagamento || !metodoPagamento) {
        throw new Error('Mercado Pago não retornou os dados do pedido PIX de teste.');
    }

    return {
        id: order.id,
        status: order.status || null,
        statusDetail: order.status_detail || null,
        paymentId: pagamento.id || null,
        paymentStatus: pagamento.status || null,
        paymentStatusDetail: pagamento.status_detail || null,
        amount: pagamento.amount || valorTeste,
        qrCode: metodoPagamento.qr_code || null,
        qrCodeBase64: metodoPagamento.qr_code_base64 || null,
        ticketUrl: metodoPagamento.ticket_url || null
    };
}

async function buscarOrderPix(idOrder) {
    if (!usandoCredenciaisDeTeste()) {
        throw new Error('Configure MP_ENVIRONMENT=test para consultar um pedido PIX de teste.');
    }
    if (!/^[a-z\d]+$/i.test(String(idOrder))) {
        throw new Error('Identificador de pedido PIX inválido.');
    }
    return requestMercadoPago('/v1/orders/' + encodeURIComponent(idOrder));
}

async function buscarPagamento(idPagamento) {
    return requestMercadoPago('/v1/payments/' + encodeURIComponent(idPagamento));
}

function validarAssinaturaWebhook(idPagamento, requestId, assinatura, segredo) {
    if (!idPagamento || !requestId || !assinatura || !segredo) return false;

    const partes = Object.fromEntries(
        assinatura.split(',').map(parte => {
            const [chave, valor] = parte.trim().split('=');
            return [chave, valor];
        })
    );
    if (!partes.ts || !/^[a-f\d]{64}$/i.test(partes.v1 || '')) return false;

    const manifesto = [
        'id:' + String(idPagamento).toLowerCase(),
        'request-id:' + requestId,
        'ts:' + partes.ts,
        ''
    ].join(';');
    const assinaturaEsperada = crypto
        .createHmac('sha256', segredo)
        .update(manifesto)
        .digest();
    const assinaturaRecebida = Buffer.from(partes.v1, 'hex');

    return assinaturaEsperada.length === assinaturaRecebida.length &&
        crypto.timingSafeEqual(assinaturaEsperada, assinaturaRecebida);
}

module.exports = {
    criarPreferencia,
    criarPagamentoPix,
    criarOrderPixTeste,
    buscarOrderPix,
    buscarPagamento,
    validarAssinaturaWebhook
};