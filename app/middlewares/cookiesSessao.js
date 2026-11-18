
const session = require('express-session');
const {
    sessaoConfig,
    NOME_COOKIE_CONSENTIMENTO
} = require('../config/sessao');

const sessaoReal = session(sessaoConfig);

// Lê o cookie de consentimento sem precisar do pacote cookie-parser
function lerConsentimento(req) {
    const cabecalho = req.headers.cookie || '';
    for (const parte of cabecalho.split(';')) {
        const [nome, ...resto] = parte.trim().split('=');
        if (nome === NOME_COOKIE_CONSENTIMENTO) {
            const valor = decodeURIComponent(resto.join('='));
            return valor === 'aceito' || valor === 'recusado' ? valor : null;
        }
    }
    return null; // ainda não decidiu
}

function sessaoTemporaria() {
    const fim = cb => { if (typeof cb === 'function') cb(); };
    return {
        destroy: fim,
        save: fim,
        reload: fim,
        regenerate: fim,
        touch() {}
    };
}

function sessaoComConsentimento(req, res, next) {
    const status = lerConsentimento(req);
    req.cookiesStatus = status;
    req.cookiesAceitos = status === 'aceito';

    res.locals.cookiesStatus = status;
    res.locals.cookiesAviso  = req.query.cookies === 'necessarios';
    res.locals.cookiesVoltar = req.originalUrl;

    if (req.cookiesAceitos) {
        return sessaoReal(req, res, next);
    }
    req.session = sessaoTemporaria();
    next();
}

// rotas que dependem de sessão
function exigirCookies(req, res, next) {
    if (req.cookiesAceitos) return next();
    return res.redirect('/home?cookies=necessarios');
}

module.exports = { sessaoComConsentimento, exigirCookies };