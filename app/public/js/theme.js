// app/public/js/theme.js
/**
 * Sistema Global de Temas - Claro e Escuro
 * Gerencia a alternância de temas em todo o site
 * E troca dinâmica de imagens de acordo com o tema
 */

(function() {
    'use strict';

    // Elementos do DOM
    const htmlElement = document.documentElement;
    
    // Mapeamento de imagens por tema
    const imagens = {
        dark: {
            carrinho: '/imagens/carrinho-branco.png',
            lupa: '/imagens/lupa-branca.png',
            user: '/imagens/user-branco.png',
            userb: '/imagens/userb.png', // user do menu (já é branco)
            logo: '/imagens/logo-branco.png', // logo principal
            estrela: '/imagens/estrela-branca.png',
            estrelaVazia: '/imagens/estrela-branca-vazia.png',
            lua: '/imagens/lua-branca.png'
        },
        light: {
            // ÍCONES DO GRID PERMANECEM BRANCOS NO TEMA CLARO
            carrinho: '/imagens/carrinho-branco.png',
            lupa: '/imagens/lupa-branca.png',
            user: '/imagens/user-branco.png',
            userb: '/imagens/userb-preto.png', // user do menu (preto para tema claro)
            logo: '/imagens/logo-preto.png', // logo principal
            estrela: '/imagens/estrela-preta.png',
            estrelaVazia: '/imagens/estrela-preta-vazia.png',
            lua: '/imagens/lua-preta.png'
        }
    };

    // Carregar tema salvo ou usar padrão (escuro)
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        htmlElement.setAttribute('data-theme', savedTheme);
        return savedTheme;
    }

    // Atualizar todas as imagens de acordo com o tema
    function updateImages(theme) {
        const imgs = imagens[theme];
        
        // Atualizar logos principais
        const logos = document.querySelectorAll('.logo');
        logos.forEach(function(logo) {
            logo.src = imgs.logo;
            logo.alt = 'Logo da Farmácia';
        });

        // Atualizar ícone (páginas de login/cadastro)
        const icons = document.querySelectorAll('.icon');
        icons.forEach(function(icon) {
            icon.src = imgs.logo;
            icon.alt = 'Logo da Farmácia';
        });

        // Atualizar carrinho - SEMPRE BRANCO
        const carrinhoImg = document.querySelector('.cart');
        if (carrinhoImg) {
            carrinhoImg.src = imagens.dark.carrinho; // Sempre branco
            carrinhoImg.alt = 'Ícone do carrinho';
        }

        // Atualizar lupa - SEMPRE BRANCA
        const lupaImg = document.querySelector('.lupa');
        if (lupaImg) {
            lupaImg.src = imagens.dark.lupa; // Sempre branca
            lupaImg.alt = 'Ícone de busca';
        }

        // Atualizar ícones de usuário do header - SEMPRE BRANCOS
        const userImgs = document.querySelectorAll('.user:not(.opcoes .user)');
        userImgs.forEach(function(img) {
            img.src = imagens.dark.user; // Sempre branco
            img.alt = 'Ícone do usuário';
        });

        // Atualizar ícone de usuário do menu lateral - MUDA COM O TEMA
        const userMenuImg = document.querySelector('.opcoes .user');
        if (userMenuImg) {
            userMenuImg.src = imgs.userb;
            userMenuImg.alt = 'Ícone do usuário';
        }

        // Atualizar estrelas cheias (home, produto, etc)
        const estrelasHome = document.querySelectorAll('.estrela-home');
        estrelasHome.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });

        // Atualizar estrelas grandes (página produto)
        const estrelas = document.querySelectorAll('.estrela');
        estrelas.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });

        // Atualizar estrelas pequenas (avaliações)
        const estrelasPequenas = document.querySelectorAll('.estrela-pequena');
        estrelasPequenas.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });
    }

    // Atualizar ícone e texto do botão de tema
    function updateThemeButton(theme) {
        const themeIcon = document.getElementById('theme-icon');
        const themeText = document.querySelector('.theme-text');
        
        if (themeIcon && themeText) {
            if (theme === 'light') {
                themeIcon.src = imagens.light.lua;
                themeIcon.alt = 'Ícone de tema escuro';
                themeText.textContent = 'Tema Escuro';
            } else {
                themeIcon.src = imagens.dark.lua;
                themeIcon.alt = 'Ícone de tema claro';
                themeText.textContent = 'Tema Claro';
            }
        }
    }

    // Alternar tema
    function toggleTheme() {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        updateThemeButton(newTheme);
        updateImages(newTheme);
    }

    // Inicializar tema ao carregar a página
    document.addEventListener('DOMContentLoaded', function() {
        const currentTheme = loadTheme();
        updateThemeButton(currentTheme);
        updateImages(currentTheme);

        // Adicionar event listener ao botão de tema (se existir)
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        // Observer para detectar mudanças dinâmicas no DOM (produtos carregados via AJAX, etc)
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    const theme = htmlElement.getAttribute('data-theme');
                    updateImages(theme);
                }
            });
        });

        // Observar mudanças no body
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    // Expor funções globalmente para uso em outras páginas
    window.themeSystem = {
        loadTheme: loadTheme,
        toggleTheme: toggleTheme,
        updateThemeButton: updateThemeButton,
        updateImages: updateImages
    };
})();