// Geração e verificação do token (JWT) enviado no link de ativação de conta.

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
require('dotenv').config();

const producao   = process.env.NODE_ENV === 'production';
const FINALIDADE = 'ativar-conta';

const horas = Number(process.env.ATIVACAO_VALIDADE_HORAS);
const VALIDADE_HORAS = Number.isFinite(horas) && horas > 0 ? horas : 24;

function obterSegredo() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.SESSION_SECRET) {
        return crypto
            .createHmac('sha256', process.env.SESSION_SECRET)
            .update('prit:ativacao-conta')
            .digest('hex');
    }
    if (producao) {
        throw new Error('JWT_SECRET (ou SESSION_SECRET) não definido. Defina-o nas variáveis de ambiente.');
    }
    console.warn('[ativacao] JWT_SECRET ausente: usando segredo temporário de desenvolvimento.');
    return crypto.randomBytes(32).toString('hex');
}

const SEGREDO = obterSegredo();

/**
 * Gera o token de ativação de um usuário recém-cadastrado.
 * @param {{ id_usuario: number, email: string }} usuario
 * @returns {string}
 */
function gerarTokenAtivacao(usuario) {
    return jwt.sign(
        { finalidade: FINALIDADE, email: usuario.email },
        SEGREDO,
        {
            algorithm: 'HS256',
            subject:   String(usuario.id_usuario),
            expiresIn: VALIDADE_HORAS + 'h'
        }
    );
}

/**
 * Verifica o token recebido no link.
 * @param {string} token
 * @returns {{ ok: true, idUsuario: number, email: string }
 *         | { ok: false, motivo: 'expirado' | 'invalido' }}
 */
function verificarTokenAtivacao(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
        return { ok: false, motivo: 'invalido' };
    }
    try {
        const dados = jwt.verify(token, SEGREDO, { algorithms: ['HS256'] });
        const idUsuario = Number(dados.sub);
        if (dados.finalidade !== FINALIDADE || !Number.isSafeInteger(idUsuario) || idUsuario <= 0 || !dados.email) {
            return { ok: false, motivo: 'invalido' };
        }
        return { ok: true, idUsuario, email: dados.email };
    } catch (erro) {
        return { ok: false, motivo: erro.name === 'TokenExpiredError' ? 'expirado' : 'invalido' };
    }
}

module.exports = { gerarTokenAtivacao, verificarTokenAtivacao, VALIDADE_HORAS };