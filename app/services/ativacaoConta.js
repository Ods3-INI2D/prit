

require('dotenv').config();
const { gerarTokenAtivacao, VALIDADE_HORAS } = require('../helpers/tokenAtivacao');
const { emailAtivarConta } = require('../helpers/emailAtivarConta');
const { enviarEmail } = require('../helpers/email');

const INTERVALO_REENVIO_MS = 60 * 1000;
const ultimosEnvios = new Map();

function urlBase() {
    const base = process.env.APP_URL ||
        (process.env.NODE_ENV === 'production' ? null : 'http://localhost:' + (process.env.PORT || 3000));
    if (!base) throw new Error('APP_URL não configurada.');
    return base.replace(/\/+$/, '');
}

function montarLinkAtivacao(usuario) {
    return urlBase() + '/ativar-conta?token=' + encodeURIComponent(gerarTokenAtivacao(usuario));
}

/**
 * Envia (ou reenvia) o e-mail de ativação.
 * @param {{ id_usuario: number, nome: string, email: string }} usuario
 * @returns {Promise<boolean>} true se o e-mail foi enviado
 */
async function enviarEmailAtivacao(usuario) {
    try {
        const link = montarLinkAtivacao(usuario);
        const { assunto, texto, html } = emailAtivarConta({
            nome: usuario.nome,
            link,
            validadeHoras: VALIDADE_HORAS
        });
        const enviado = await enviarEmail({ to: usuario.email, subject: assunto, text: texto, html });
        if (enviado) registrarEnvio(usuario.email);
        return enviado;
    } catch (erro) {
        console.error('[ativacao] Erro ao preparar e-mail de ativação:', erro.message);
        return false;
    }
}

function registrarEnvio(email) {
    const agora = Date.now();
    ultimosEnvios.set(email, agora);
    for (const [chave, quando] of ultimosEnvios) {
        if (agora - quando > INTERVALO_REENVIO_MS) ultimosEnvios.delete(chave);
    }
}

// false se já foi enviado um e-mail para esse endereço há menos de 1 minuto
function podeReenviar(email) {
    const ultimo = ultimosEnvios.get(email);
    return !ultimo || Date.now() - ultimo >= INTERVALO_REENVIO_MS;
}

module.exports = { enviarEmailAtivacao, podeReenviar, VALIDADE_HORAS };