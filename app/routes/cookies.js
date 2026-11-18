// Rotas de permissão de cookies

const express = require('express');
const router  = express.Router();
const {
    opcoesCookieConsentimento,
    NOME_COOKIE_CONSENTIMENTO,
    NOME_COOKIE_SESSAO
} = require('../config/sessao');

function destinoSeguro(valor) {
    try {
        const base = 'http://local.invalid';
        const url  = new URL(String(valor || '/home'), base);
        if (url.origin !== base) return '/home';
        url.searchParams.delete('cookies');
        return url.pathname + url.search;
    } catch (_) {
        return '/home';
    }
}

router.post('/cookies/consentimento', (req, res) => {
    const destino = destinoSeguro(req.body.voltar);
    const { maxAge, ...opcoesLimpeza } = opcoesCookieConsentimento;

    switch (req.body.acao) {
        case 'aceitar':
            res.cookie(NOME_COOKIE_CONSENTIMENTO, 'aceito', opcoesCookieConsentimento);
            return res.redirect(destino);

        case 'recusar':
            res.cookie(NOME_COOKIE_CONSENTIMENTO, 'recusado', opcoesCookieConsentimento);
            // Apaga a sessão existente e o cookie dela
            return req.session.destroy(() => {
                res.clearCookie(NOME_COOKIE_SESSAO, { path: '/' });
                res.redirect(destino);
            });

        case 'redefinir':
            res.clearCookie(NOME_COOKIE_CONSENTIMENTO, opcoesLimpeza);
            return res.redirect(destino);

        default:
            return res.redirect(destino);
    }
});

module.exports = router;