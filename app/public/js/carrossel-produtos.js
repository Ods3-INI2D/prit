(function () {
    'use strict';

    // [ALTERADO] Cada faixa de categoria ([data-carrossel]) recebe uma instância independente.
    function iniciar(carrossel) {
        var trilho  = carrossel.querySelector('.carrossel-produtos-trilho');
        var btnAnt  = carrossel.querySelector('[data-direcao="-1"]');
        var btnProx = carrossel.querySelector('[data-direcao="1"]');
        if (!trilho || !btnAnt || !btnProx) return;   // [ALTERADO] não há mais um contêiner de controles

        var quadro = null;

        // Largura de um produto + espaçamento entre produtos
        function larguraDoItem() {
            var item = trilho.querySelector('.item-carrossel');
            if (!item) return trilho.clientWidth;
            var gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
            return item.getBoundingClientRect().width + gap;
        }

        // [ALTERADO] O passo agora é uma "página": quantos produtos inteiros cabem na área visível
        // (antes: 1 coluna de categoria por clique).
        function tamanhoDoPasso() {
            var largura = larguraDoItem();
            var visiveis = Math.max(1, Math.floor(trilho.clientWidth / largura));
            return visiveis * largura;
        }

        function atualizar() {
            var maximo = trilho.scrollWidth - trilho.clientWidth;
            var cabeTudo = maximo <= 1;
            btnAnt.hidden  = cabeTudo;                    // [ALTERADO] tudo cabe: esconde cada botão
            btnProx.hidden = cabeTudo;
            btnAnt.disabled  = trilho.scrollLeft <= 1;
            btnProx.disabled = trilho.scrollLeft >= maximo - 1;
            // [REMOVIDO] indicador "Produto X de N" (informação em excesso)
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
        // [ALTERADO] seletor: era '.carrossel-produtos' (1 carrossel); agora '[data-carrossel]' (N carrosséis)
        var carrosseis = document.querySelectorAll('[data-carrossel]');
        for (var i = 0; i < carrosseis.length; i++) iniciar(carrosseis[i]);
    });
})();