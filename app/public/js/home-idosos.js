/* =============================================================================
   HOME — comportamentos de acessibilidade para o público idoso
   -----------------------------------------------------------------------------
   Carregado SÓ por pages/home.ejs, no <head>, para aplicar o tamanho de letra
   escolhido ANTES da primeira pintura (sem "pulo" de layout).

   Usa a MESMA chave de preferência das outras páginas ("tamanhoTexto"), então a
   escolha da pessoa vale em todo o site (heurística 4: consistência).
   Não toca na Maisa (nada aqui seleciona .maisa-*).

   A pausa e o indicador de posição dos carrosséis ficam em banners-carrossel.js e
   carrossel-produtos.js, que já controlam a rolagem.
   ========================================================================== */
(function () {
    'use strict';

    var CHAVE   = 'tamanhoTexto';
    var VALIDOS = ['normal', 'grande', 'enorme'];
    var raiz    = document.documentElement;

    function ler() {
        try {
            var v = localStorage.getItem(CHAVE);
            return VALIDOS.indexOf(v) > -1 ? v : 'normal';
        } catch (e) { return 'normal'; }              // modo privado / storage bloqueado
    }

    function gravar(v) {
        try { localStorage.setItem(CHAVE, v); } catch (e) { /* sem storage: vale só nesta visita */ }
    }

    function aplicar(v) {
        if (v === 'normal') { raiz.removeAttribute('data-texto'); }
        else { raiz.setAttribute('data-texto', v); }
    }

    // 1) aplica já (este script está no <head>)
    aplicar(ler());

    document.addEventListener('DOMContentLoaded', function () {

        /* ---- 2) botões A / A+ / A++ (heurística 3: o usuário no controle) ---- */
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
                aplicar(v);
                gravar(v);
                marcar(v);
            });
        });

        /* ---- 3) menu lateral: "saída de emergência" fácil (heurística 3) ----
           Esc fecha; o "X" vira botão de verdade (Enter/Espaço); o foco volta ao "Menu". */
        var hamburger = document.querySelector('.hamburger');
        var menu      = document.getElementById('menuhamburger');

        if (hamburger && menu) {
            var fecharMenu = function () {
                if (!menu.classList.contains('is-open')) { return; }
                menu.classList.remove('is-open');
                hamburger.setAttribute('aria-expanded', 'false');
                hamburger.focus();
            };

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

            // texto em português claro (sem o termo "hamburger") e rótulo escrito sob o ícone
            var rotular = function () {
                var aberto = hamburger.getAttribute('aria-expanded') === 'true';
                var texto  = aberto ? 'Fechar menu' : 'Abrir menu';
                if (hamburger.getAttribute('aria-label') !== texto) {
                    hamburger.setAttribute('aria-label', texto);
                }
                var r = hamburger.querySelector('.rotulo-acao');
                if (r && r.textContent !== (aberto ? 'Fechar' : 'Menu')) {
                    r.textContent = aberto ? 'Fechar' : 'Menu';
                }
            };
            rotular();
            new MutationObserver(rotular).observe(hamburger, {
                attributes: true, attributeFilter: ['aria-expanded', 'aria-label']
            });
        }
    });
})();
