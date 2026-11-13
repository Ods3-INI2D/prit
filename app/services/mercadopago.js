const crypto = require('crypto');

const TIPOS_PAGAMENTO = {
    cartao_credito: 'credit_card',
    cartao_debito: 'debit_card',
    pix: 'bank_transfer',
    boleto: 'ticket'
};

const TIPOS_FALLBACK = [
    'ticket',
    'bank_transfer',
    'atm',
    'credit_card',
    'debit_card',
    'prepaid_card',
    'digital_currency',
    'digital_credit',
    'voucher_card',
    'crypto_transfer'
];
const TIPOS_NAO_EXCLUIVEIS = ['account_money'];

let cacheTipos = { valor: null, expiraEm: 0 };

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

function appEhLocal(appUrl) {
    const host = new URL(appUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function detalheDoErro(data) {
    if (!data || typeof data !== 'object') return '';
    const partes = [];
    if (data.message) partes.push(data.message);
    if (Array.isArray(data.errors)) {
        data.errors.forEach(function(e) {
            const texto = [e.code, e.message, [].concat(e.details || []).join(', ')]
                .filter(Boolean)
                .join(' - ');
            if (texto) partes.push(texto);
        });
    }
    return partes.length ? ': ' + partes.join(' | ') : '';
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

    const texto = await response.text();
    let data = null;
    try {
        data = texto ? JSON.parse(texto) : null;
    } catch (_) {
        data = null;
    }

    if (!response.ok) {
        throw new Error(
            'Mercado Pago respondeu com HTTP ' + response.status + detalheDoErro(data)
        );
    }
    return data;
}

async function listarTiposDePagamento() {
    if (cacheTipos.valor && Date.now() < cacheTipos.expiraEm) {
        return cacheTipos.valor;
    }

    const tipos = new Set(TIPOS_FALLBACK);
    try {
        const metodos = await requestMercadoPago('/v1/payment_methods');
        if (Array.isArray(metodos)) {
            metodos.forEach(function(m) {
                if (m && m.payment_type_id) tipos.add(m.payment_type_id);
            });
        }
        cacheTipos = { valor: Array.from(tipos), expiraEm: Date.now() + 60 * 60 * 1000 };
    } catch (erro) {
        console.error('Não foi possível listar os tipos de pagamento do Mercado Pago:', erro.message);
        return Array.from(tipos);
    }
    return cacheTipos.valor;
}

async function tiposParaExcluir(tipoPermitido) {
    const todos = await listarTiposDePagamento();
    return todos
        .filter(function(tipo) {
            return tipo !== tipoPermitido && !TIPOS_NAO_EXCLUIVEIS.includes(tipo);
        })
        .map(function(id) { return { id: id }; });
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

    const corpo = {
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
            excluded_payment_types: await tiposParaExcluir(tipoPermitido)
        },
        back_urls: {
            success: urlResultado.toString(),
            failure: urlResultado.toString(),
            pending: urlResultado.toString()
        },
        auto_return: 'approved'
    };

    if (appEhLocal(appUrl)) {
        console.warn(
            'APP_URL aponta para localhost: o webhook do Mercado Pago não será chamado. ' +
            'O status do pedido será atualizado ao voltar para /pagamento/resultado.'
        );
    } else {
        corpo.notification_url = appUrl + '/webhooks/mercadopago?source_news=webhooks';
    }

    const preference = await requestMercadoPago('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify(corpo)
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

async function buscarPagamento(idPagamento) {
    return requestMercadoPago('/v1/payments/' + encodeURIComponent(idPagamento));
}

async function buscarPagamentosPorPedido(idPedido) {
    const params = new URLSearchParams({
        external_reference: String(idPedido),
        sort: 'date_created',
        criteria: 'desc'
    });
    const data = await requestMercadoPago('/v1/payments/search?' + params.toString());
    return data && Array.isArray(data.results) ? data.results : [];
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
    buscarPagamentosPorPedido,
    validarAssinaturaWebhook
};