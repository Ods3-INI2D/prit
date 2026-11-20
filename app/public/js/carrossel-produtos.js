
(function () {
    'use strict';

    function iniciar(carrossel) {
        var trilho    = carrossel.querySelector('.carrossel-produtos-trilho');
        var controles = carrossel.querySelector('.carrossel-produtos-controles');
        var btnAnt    = carrossel.querySelector('[data-direcao="-1"]');
        var btnProx   = carrossel.querySelector('[data-direcao="1"]');
        if (!trilho || !controles || !btnAnt || !btnProx) return;

        var quadro = null;

        // Largura de uma coluna + espaçamento entre colunas
        function tamanhoDoPasso() {
            var coluna = trilho.querySelector('.coluna-produtos');
            if (!coluna) return trilho.clientWidth;
            var gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
            return coluna.getBoundingClientRect().width + gap;
        }

        function atualizar() {
            var maximo = trilho.scrollWidth - trilho.clientWidth;
            controles.hidden = maximo <= 1;               // tudo cabe: esconde os botões
            btnAnt.disabled  = trilho.scrollLeft <= 1;
            btnProx.disabled = trilho.scrollLeft >= maximo - 1;
        }

        function agendarAtualizacao() {
            if (quadro) return;
            quadro = window.requestAnimationFrame(function () {
                quadro = null;
                atualizar();
            });
        }

        function mover(direcao) {
            var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            trilho.scrollBy({
                left: direcao * tamanhoDoPasso(),
                behavior: reduzir ? 'auto' : 'smooth'
            });
        }

        btnAnt.addEventListener('click',  function () { mover(-1); });
        btnProx.addEventListener('click', function () { mover(1); });
        trilho.addEventListener('scroll', agendarAtualizacao, { passive: true });
        window.addEventListener('resize', agendarAtualizacao);

        atualizar();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var carrosseis = document.querySelectorAll('.carrossel-produtos');
        for (var i = 0; i < carrosseis.length; i++) iniciar(carrosseis[i]);
    });
})();