// Geração e verificação do token (JWT) enviado no link "Esqueci minha senha".
//
// Diferenças em relação ao token de ativação de conta:
//  - o token é assinado com um segredo que depende do HASH DA SENHA ATUAL do usuário.
//    Assim, assim que a senha for trocada, o link usado (e qualquer outro link
//    antigo) deixa de ser válido: cada link só funciona uma vez, sem precisar de
//    tabela nem coluna nova no banco.
//  - a validade é curta (padrão: 40 minutos).

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
require('dotenv').config();

const producao   = process.env.NODE_ENV === 'production';
const FINALIDADE = 'recuperar-senha';

const minutos = Number(process.env.RECUPERACAO_VALIDADE_MINUTOS);
const VALIDADE_MINUTOS = Number.isFinite(minutos) && minutos > 0 ? minutos : 40;

function obterSegredoBase() {
    const base = process.env.JWT_SECRET || process.env.SESSION_SECRET;
    if (base) {
        // "rótulo" próprio: o token de recuperação nunca vale como token de ativação
        return crypto.createHmac('sha256', base).update('prit:recuperar-senha').digest('hex');
    }
    if (producao) {
        throw new Error('JWT_SECRET (ou SESSION_SECRET) não definido. Defina-o nas variáveis de ambiente.');
    }
    console.warn('[recuperacao] JWT_SECRET ausente: usando segredo temporário de desenvolvimento.');
    return crypto.randomBytes(32).toString('hex');
}

const SEGREDO_BASE = obterSegredoBase();

// segredo individual: muda quando o usuário troca de senha
function segredoDoUsuario(hashSenhaAtual) {
    return crypto
        .createHmac('sha256', SEGREDO_BASE)
        .update(String(hashSenhaAtual || ''))
        .digest('hex');
}

/**
 * Gera o token do link de recuperação.
 * @param {{ id_usuario: number, email: string, senhan: string }} usuario
 * @returns {string}
 */
function gerarTokenRecuperacao(usuario) {
    return jwt.sign(
        { finalidade: FINALIDADE, email: usuario.email },
        segredoDoUsuario(usuario.senhan),
        {
            algorithm: 'HS256',
            subject:   String(usuario.id_usuario),
            expiresIn: VALIDADE_MINUTOS + 'm'
        }
    );
}

/**
 * Lê o id do usuário dentro do token SEM confiar nele: serve apenas para
 * descobrir qual usuário buscar no banco. A validação de verdade é feita por
 * verificarTokenRecuperacao().
 * @param {string} token
 * @returns {number|null}
 */
function lerIdDoToken(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return null;
    const dados = jwt.decode(token);
    const id = dados && Number(dados.sub);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * Verifica assinatura, validade, finalidade e e-mail do token.
 * @param {string} token
 * @param {{ id_usuario: number, email: string, senhan: string }} usuario  usuário já buscado no banco
 * @returns {{ ok: true } | { ok: false, motivo: 'expirado' | 'invalido' }}
 */
function verificarTokenRecuperacao(token, usuario) {
    try {
        const dados = jwt.verify(token, segredoDoUsuario(usuario.senhan), { algorithms: ['HS256'] });
        if (
            dados.finalidade !== FINALIDADE ||
            Number(dados.sub) !== Number(usuario.id_usuario) ||
            dados.email !== usuario.email
        ) {
            return { ok: false, motivo: 'invalido' };
        }
        return { ok: true };
    } catch (erro) {
        return { ok: false, motivo: erro.name === 'TokenExpiredError' ? 'expirado' : 'invalido' };
    }
}

module.exports = { gerarTokenRecuperacao, lerIdDoToken, verificarTokenRecuperacao, VALIDADE_MINUTOS };