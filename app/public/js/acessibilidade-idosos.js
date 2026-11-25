/* =============================================================================
   Acessibilidade para idosos - comportamentos compartilhados
   NÃO carregar na home. Incluir no <head> (aplica o tamanho de letra antes da
   primeira pintura, sem "pulo" de layout).
   ========================================================================== */
(function () {
    'use strict';

    var CHAVE = 'tamanhoTexto';
    var VALIDOS = ['normal', 'grande', 'enorme'];
    var raiz = document.documentElement;

    function ler() {
        try {
            var v = localStorage.getItem(CHAVE);
            return VALIDOS.indexOf(v) > -1 ? v : 'normal';
        } catch (e) { return 'normal'; }
    }

    function gravar(v) {
        try { localStorage.setItem(CHAVE, v); } catch (e) { /* modo privado */ }
    }

    function aplicar(v) {
        if (v === 'normal') { raiz.removeAttribute('data-texto'); }
        else { raiz.setAttribute('data-texto', v); }
    }

    // 1) aplica imediatamente (script está no <head>)
    aplicar(ler());

    document.addEventListener('DOMContentLoaded', function () {

        /* ---- 2) botões A / A+ / A++ ------------------------------------ */
        var botoes = document.querySelectorAll('.ajuste-texto [data-tamanho]');
        function marcar(v) {
            botoes.forEach(function (b) {
                b.setAttribute('aria-pressed', String(b.getAttribute('data-tamanho') === v));
            });
        }
        marcar(ler());
        botoes.forEach(function (b) {
            b.addEventListener('click', function () {
                var v = b.getAttribute('data-tamanho');
                aplicar(v); gravar(v); marcar(v);
            });
        });

        /* ---- 3) menu lateral: Esc e "X" fecham (saída de emergência) ----- */
        var hamburger = document.querySelector('.hamburger');
        var menu = document.getElementById('menuhamburger');

        function fecharMenu() {
            if (!menu || !hamburger || !menu.classList.contains('is-open')) { return; }
            menu.classList.remove('is-open');
            hamburger.setAttribute('aria-expanded', 'false');
            hamburger.focus();
        }

        if (hamburger && menu) {
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') { fecharMenu(); }
            });

            var fechar = menu.querySelector('.plogo');
            if (fechar) {
                fechar.setAttribute('role', 'button');
                fechar.setAttribute('tabindex', '0');
                fechar.setAttribute('alt', 'Fechar menu');
                fechar.addEventListener('click', fecharMenu);
                fechar.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fecharMenu(); }
                });
            }

            // texto do botão em português claro (sem o termo "hamburger")
            var rotular = function () {
                var aberto = hamburger.getAttribute('aria-expanded') === 'true';
                var texto = aberto ? 'Fechar menu' : 'Abrir menu';
                if (hamburger.getAttribute('aria-label') !== texto) {
                    hamburger.setAttribute('aria-label', texto);
                }
                var r = hamburger.querySelector('.rotulo-acao');
                if (r) { r.textContent = aberto ? 'Fechar' : 'Menu'; }
            };
            rotular();
            new MutationObserver(rotular).observe(hamburger, {
                attributes: true, attributeFilter: ['aria-expanded', 'aria-label']
            });
        }

        /* ---- 4a) confirmação antes de ações difíceis de desfazer ---------- */
        document.querySelectorAll('form[data-confirmar]').forEach(function (form) {
            form.addEventListener('submit', function (e) {
                if (!window.confirm(form.getAttribute('data-confirmar'))) {
                    e.preventDefault();                       // a pessoa desistiu
                }
            });
        });

        /* ---- 4) feedback de envio + proteção contra duplo clique ---------- */
        document.querySelectorAll('form[method="POST" i], form[method="post"]').forEach(function (form) {
            if (form.closest('.cookies-banner, .cookies-preferencias') ||
                form.hasAttribute('data-sem-feedback')) { return; }

            form.addEventListener('submit', function (e) {
                if (e.defaultPrevented) { return; }          // validação barrou
                if (form.getAttribute('data-enviando') === 'true') {
                    e.preventDefault();                        // já enviando
                    return;
                }
                form.setAttribute('data-enviando', 'true');
                form.setAttribute('aria-busy', 'true');

                var botao = e.submitter || form.querySelector('button[type="submit"], button:not([type])');
                if (botao && botao.tagName === 'BUTTON') {
                    botao.setAttribute('data-enviando', 'true');
                    botao.setAttribute('data-texto-original', botao.textContent);
                    botao.textContent = 'Enviando… aguarde';
                }
            });
        });


        /* ---- 5) "Voltar" leva de volta à página de onde a pessoa veio ----- */
        var evitar = ['/login', '/cadastro', '/logout', '/pagamento/resultado', '/finalizar-compra'];
        document.querySelectorAll('a.voltar').forEach(function (a) {
            try {
                if (!document.referrer) { return; }
                var ref = new URL(document.referrer);
                if (ref.origin !== location.origin || ref.href === location.href) { return; }
                if (evitar.indexOf(ref.pathname) > -1) { return; }
                a.setAttribute('href', ref.pathname + ref.search + ref.hash);
            } catch (e) { /* mantém o href padrão (/home) */ }
        });

        // voltar pelo navegador (cache) não deixa o botão travado
        window.addEventListener('pageshow', function (e) {
            if (!e.persisted) { return; }
            document.querySelectorAll('[data-enviando="true"]').forEach(function (el) {
                el.removeAttribute('data-enviando');
                el.removeAttribute('aria-busy');
                var t = el.getAttribute('data-texto-original');
                if (t) { el.textContent = t; el.removeAttribute('data-texto-original'); }
            });
        });
    });
})();
