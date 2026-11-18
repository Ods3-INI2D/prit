
const crypto = require('crypto');
require('dotenv').config();

const producao = process.env.NODE_ENV === 'production';

let secret = process.env.SESSION_SECRET;
if (!secret) {
    if (producao) {
        throw new Error('SESSION_SECRET não definido. Defina-o nas variáveis de ambiente.');
    }
    secret = crypto.randomBytes(32).toString('hex');
    console.warn('[sessao] SESSION_SECRET ausente: usando segredo temporário de desenvolvimento.');
}

const NOME_COOKIE_SESSAO     = 'prit.sid';
const NOME_COOKIE_CONSENTIMENTO = 'prit_cookies';
const DURACAO_SESSAO_MS      = 24 * 60 * 60 * 1000;        // 24 horas
const DURACAO_CONSENTIMENTO_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

const sessaoConfig = {
    name: NOME_COOKIE_SESSAO,
    secret,
    resave: false,             // não regrava a sessão se ela não mudou
    saveUninitialized: false,  // não cria sessão/cookie para quem não guardou nada
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: producao,
        maxAge: DURACAO_SESSAO_MS
    }
};

// Opções do cookie que guarda a escolha do usuário (aceitar/recusar)
const opcoesCookieConsentimento = {
    httpOnly: true,
    sameSite: 'lax',
    secure: producao,
    maxAge: DURACAO_CONSENTIMENTO_MS,
    path: '/'
};

module.exports = {
    sessaoConfig,
    opcoesCookieConsentimento,
    NOME_COOKIE_SESSAO,
    NOME_COOKIE_CONSENTIMENTO,
    producao
};