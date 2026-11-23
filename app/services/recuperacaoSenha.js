// Serviço de recuperação de senha ("Esqueci minha senha"): monta o link, envia o
// e-mail, limita a frequência dos pedidos e valida o link recebido.

require('dotenv').config();
const { usuariosModel } = require('../models/usuariosmodel');
const {
    gerarTokenRecuperacao,
    lerIdDoToken,
    verificarTokenRecuperacao,
    VALIDADE_MINUTOS
} = require('../helpers/tokenRecuperacaoSenha');
const { emailRecuperacaoSenha } = require('../helpers/emailRecuperacaoSenha');
const { enviarEmail } = require('../helpers/email');
const { urlBaseDaRequisicao } = require('./ativacaoConta');

const INTERVALO_PEDIDOS_MS = 60 * 1000;
const ultimosPedidos = new Map(); // email -> timestamp do último e-mail enviado

// A base do link vem da configuração (APP_URL), nunca do cabeçalho Host da requisição
// (mesma regra do e-mail de ativação). Exceção: acesso via localhost em desenvolvimento.
function urlBase(baseDaRequisicao) {
    const base = baseDaRequisicao || process.env.APP_URL ||
        (process.env.NODE_ENV === 'production' ? null : 'http://localhost:' + (process.env.PORT || 3000));
    if (!base) throw new Error('APP_URL não configurada.');
    return base.replace(/\/+$/, '');
}

// contas criadas antes da ativação por e-mail podem não ter a coluna "ativo"
function contaAtiva(usuario) {
    return usuario.ativo === undefined || usuario.ativo === null || Number(usuario.ativo) !== 0;
}

function podeSolicitar(email) {
    const ultimo = ultimosPedidos.get(email);
    return !ultimo || Date.now() - ultimo >= INTERVALO_PEDIDOS_MS;
}

function registrarPedido(email) {
    const agora = Date.now();
    ultimosPedidos.set(email, agora);
    for (const [chave, quando] of ultimosPedidos) {
        if (agora - quando > INTERVALO_PEDIDOS_MS) ultimosPedidos.delete(chave);
    }
}

/**
 * Processa o pedido de recuperação. Nunca lança exceção e não informa se o e-mail
 * existe: a rota responde igual em qualquer caso.
 * Só envia para conta existente, ativa e respeitando o intervalo mínimo entre pedidos.
 * @param {string} email
 * @param {string|null} [baseDaRequisicao] resultado de urlBaseDaRequisicao(req)
 * @returns {Promise<boolean>} true se um e-mail foi enviado
 */
async function solicitarRecuperacao(email, baseDaRequisicao) {
    try {
        const usuario = await usuariosModel.findByEmail(email);
        // os motivos ficam só no log do servidor: a página responde igual em qualquer caso
        if (!usuario) {
            console.log('[recuperacao] Nenhum e-mail enviado: "' + email + '" não está cadastrado (o admin do .env não fica no banco).');
            return false;
        }
        if (!contaAtiva(usuario)) {
            console.log('[recuperacao] Nenhum e-mail enviado: a conta de "' + email + '" ainda não foi ativada.');
            return false;
        }
        if (!podeSolicitar(usuario.email)) {
            console.log('[recuperacao] Nenhum e-mail enviado: já houve um pedido para "' + email + '" há menos de 1 minuto.');
            return false;
        }

        const token = gerarTokenRecuperacao(usuario);
        const link  = urlBase(baseDaRequisicao) + '/resetar-senha?token=' + encodeURIComponent(token);
        const { assunto, texto, html } = emailRecuperacaoSenha({
            nome: usuario.nome,
            link,
            validadeMinutos: VALIDADE_MINUTOS
        });

        const enviado = await enviarEmail({ to: usuario.email, subject: assunto, text: texto, html });
        if (enviado) {
            registrarPedido(usuario.email);
            console.log('[recuperacao] E-mail de recuperação entregue ao provedor para "' + usuario.email + '".');
        } else {
            console.error('[recuperacao] O provedor de e-mail recusou o envio para "' + usuario.email + '" (veja a mensagem "[email] ..." acima).');
        }
        return enviado;
    } catch (erro) {
        console.error('[recuperacao] Erro ao preparar e-mail de recuperação:', erro.message);
        return false;
    }
}

/**
 * Valida o token recebido (no link ou no formulário).
 * @param {string} token
 * @returns {Promise<{ ok: true, usuario: object } | { ok: false, motivo: 'expirado' | 'invalido' }>}
 */
async function validarLinkRecuperacao(token) {
    const id = lerIdDoToken(token);
    if (!id) return { ok: false, motivo: 'invalido' };

    const usuario = await usuariosModel.findParaRecuperacao(id);
    if (!usuario || !contaAtiva(usuario)) return { ok: false, motivo: 'invalido' };

    const resultado = verificarTokenRecuperacao(token, usuario);
    return resultado.ok ? { ok: true, usuario } : resultado;
}

module.exports = { solicitarRecuperacao, validarLinkRecuperacao, urlBaseDaRequisicao, VALIDADE_MINUTOS };