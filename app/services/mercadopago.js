const crypto = require('crypto');

const TIPOS_PAGAMENTO = {
    cartao_credito: 'credit_card',
    cartao_debito: 'debit_card',
    pix: 'bank_transfer',
    boleto: 'ticket'
};

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

    const todosTipos = Object.values(TIPOS_PAGAMENTO);
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
                excluded_payment_types: todosTipos
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

const usaCredenciaisDeTeste = process.env.MP_ACCESS_TOKEN.startsWith('TEST-');
const checkoutUrl = usaCredenciaisDeTeste
    ? preference.sandbox_init_point
    : preference.init_point;    if (!checkoutUrl) {
        throw new Error('Mercado Pago não retornou o endereço do checkout.');
    }
    return checkoutUrl;
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
    buscarPagamento,
    validarAssinaturaWebhook
};