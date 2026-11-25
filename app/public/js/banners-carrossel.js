/* [NOVO] Carrossel dos banners da Home.
   - Rolagem horizontal por "páginas" (2 banners no desktop, 1 no celular; a quantidade vem do CSS).
   - Avanço automático a cada 20 segundos, voltando ao início depois do último banner.
   - Botões ◀ ▶ (circulares: do último volta ao primeiro e vice-versa).
   - Acessibilidade: a rotação pausa com o mouse em cima, com foco de teclado dentro do carrossel
     e com a aba oculta; não roda se o usuário prefere movimento reduzido. */
(function () {
    'use strict';

    var INTERVALO_MS = 20000;   // 20 segundos entre cada avanço automático

    function iniciar(carrossel) {
        var trilho   = carrossel.querySelector('.banners-trilho');
        var btnAnt   = carrossel.querySelector('[data-banners-direcao="-1"]');
        var btnProx  = carrossel.querySelector('[data-banners-direcao="1"]');
        if (!trilho || !btnAnt || !btnProx) return;

        // [REMOVIDO] indicador "Destaque X de N" e botão "Pausar destaques" (informação em excesso na home)

        var reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var temporizador = null;
        var pausadoPeloMouse   = false;   // mouse sobre o carrossel
        var pausadoPeloFoco    = false;   // foco de teclado dentro do carrossel

        // Largura de um banner + espaço entre banners
        function larguraDoPasso() {
            var item = trilho.querySelector('.banner-item');
            if (!item) return trilho.clientWidth;
            var gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
            return item.getBoundingClientRect().width + gap;
        }

        // Quantos banners inteiros cabem na área visível agora (2 desktop / 1 celular)
        function bannersPorPagina() {
            var passo = larguraDoPasso();
            var gap = parseFloat(getComputedStyle(trilho).columnGap) || 0;
            return Math.max(1, Math.round((trilho.clientWidth + gap) / passo));
        }

        function maximoDeRolagem() {
            return trilho.scrollWidth - trilho.clientWidth;
        }

        function temMaisQueUmaPagina() {
            return maximoDeRolagem() > 1;
        }

        // Move uma "página" (direcao = 1 avança, -1 volta), de forma circular
        function mover(direcao) {
            var maximo = maximoDeRolagem();
            if (maximo <= 1) return;

            var atual = trilho.scrollLeft;
            var destino;

            if (direcao > 0 && atual >= maximo - 1) {
                destino = 0;                                   // passou do último: volta ao primeiro
            } else if (direcao < 0 && atual <= 1) {
                destino = maximo;                              // antes do primeiro: vai ao último
            } else {
                destino = atual + direcao * bannersPorPagina() * larguraDoPasso();
                destino = Math.min(Math.max(destino, 0), maximo);
            }

            trilho.scrollTo({ left: destino, behavior: reduzirMovimento ? 'auto' : 'smooth' });
        }

        function deveRodar() {
            return !reduzirMovimento
                && temMaisQueUmaPagina()
                && !pausadoPeloMouse
                && !pausadoPeloFoco
                && !document.hidden;
        }

        // Recomeça a contagem dos 20 s (chamado a cada mudança de estado ou interação)
        function reagendar() {
            if (temporizador) {
                window.clearInterval(temporizador);
                temporizador = null;
            }
            // anúncio por leitor de tela só quando NÃO está girando sozinho (evita interromper a leitura)
            trilho.setAttribute('aria-live', deveRodar() ? 'off' : 'polite');
            if (deveRodar()) {
                temporizador = window.setInterval(function () { mover(1); }, INTERVALO_MS);
            }
        }

        // Mostra/esconde os controles conforme houver mais banners do que cabem na tela
        function atualizarControles() {
            var visivel = temMaisQueUmaPagina();
            btnAnt.hidden  = !visivel;
            btnProx.hidden = !visivel;
            reagendar();
        }

        btnAnt.addEventListener('click', function () { mover(-1); reagendar(); });
        btnProx.addEventListener('click', function () { mover(1); reagendar(); });

        // Mouse: pausa enquanto está em cima (só mouse; no toque o "hover" ficaria preso)
        carrossel.addEventListener('pointerenter', function (e) {
            if (e.pointerType === 'mouse') { pausadoPeloMouse = true; reagendar(); }
        });
        carrossel.addEventListener('pointerleave', function (e) {
            if (e.pointerType === 'mouse') { pausadoPeloMouse = false; reagendar(); }
        });

        // Teclado: pausa só quando o foco veio do teclado (clique com mouse nos botões não trava a rotação)
        carrossel.addEventListener('focusin', function (e) {
            if (e.target.matches(':focus-visible')) { pausadoPeloFoco = true; reagendar(); }
        });
        carrossel.addEventListener('focusout', function (e) {
            if (!carrossel.contains(e.relatedTarget)) { pausadoPeloFoco = false; reagendar(); }
        });

        // Toque/arraste manual: recomeça os 20 s para o banner não trocar logo depois do gesto
        trilho.addEventListener('pointerdown', reagendar);
        trilho.addEventListener('keydown', reagendar);

        // Aba em segundo plano: não avança
        document.addEventListener('visibilitychange', reagendar);

        // Redimensionamento (ex.: girar o celular) muda quantos banners cabem
        window.addEventListener('resize', atualizarControles);

        atualizarControles();
    }

    document.addEventListener('DOMContentLoaded', function () {
        var carrosseis = document.querySelectorAll('[data-banners-carrossel]');
        for (var i = 0; i < carrosseis.length; i++) iniciar(carrosseis[i]);
    });
})();