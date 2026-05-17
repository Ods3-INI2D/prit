

(function() {
    'use strict';

    const htmlElement = document.documentElement;
    
    const imagens = {
        dark: {
            carrinho: '/imagens/carrinho-branco.png',
            lupa: '/imagens/lupa-branca.png',
            user: '/imagens/user-branco.png',
            userMenu: '/imagens/userb.png', 
            logo: '/imagens/logo-branco.png',
            estrela: '/imagens/estrela-branca.png',
            estrelaVazia: '/imagens/estrela-branca-vazia.png',
            lua: '/imagens/lua-branca.png'
        },
        light: {
            carrinho: '/imagens/carrinho-branco.png',
            lupa: '/imagens/lupa-branca.png',
            user: '/imagens/user-branco.png',
            userMenu: '/imagens/userb-preto.png',
            logo: '/imagens/logo-branco.png', 
            estrela: '/imagens/estrela-preta.png',
            estrelaVazia: '/imagens/estrela-preta-vazia.png',
            lua: '/imagens/lua-preta.png'
        }
    };

    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        htmlElement.setAttribute('data-theme', savedTheme);
        return savedTheme;
    }

    function updateImages(theme) {
        const imgs = imagens[theme];
        
        const logos = document.querySelectorAll('.logo');
        logos.forEach(function(logo) {
            logo.src = imgs.logo;
            logo.alt = 'Logo da Farmácia';
        });

        const icons = document.querySelectorAll('.icon');
        icons.forEach(function(icon) {
            icon.src = imgs.logo;
            icon.alt = 'Logo da Farmácia';
        });

        const carrinhoImg = document.querySelector('.cart');
        if (carrinhoImg) {
            carrinhoImg.src = imagens.dark.carrinho;
            carrinhoImg.alt = 'Ícone do carrinho';
        }

        const lupaImg = document.querySelector('.lupa');
        if (lupaImg) {
            lupaImg.src = imagens.dark.lupa;
            lupaImg.alt = 'Ícone de busca';
        }

        const userImgsHeader = document.querySelectorAll('.nav-principal .user');
        userImgsHeader.forEach(function(img) {
            img.src = imagens.dark.user; 
            img.alt = 'Ícone do usuário';
        });

        const userMenuImg = document.querySelector('.opcoes .user');
        if (userMenuImg) {
            userMenuImg.src = imgs.userMenu;
            userMenuImg.alt = 'Ícone do usuário';
        }

        const estrelasHome = document.querySelectorAll('.estrela-home');
        estrelasHome.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });

        const estrelas = document.querySelectorAll('.estrela');
        estrelas.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });

        const estrelasPequenas = document.querySelectorAll('.estrela-pequena');
        estrelasPequenas.forEach(function(estrela) {
            if (estrela.src.includes('estr.png') || estrela.src.includes('estrela-')) {
                const isCheia = !estrela.src.includes('v.png') && !estrela.src.includes('vazia');
                estrela.src = isCheia ? imgs.estrela : imgs.estrelaVazia;
            }
        });
    }

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

    document.addEventListener('DOMContentLoaded', function() {
        const currentTheme = loadTheme();
        updateThemeButton(currentTheme);
        updateImages(currentTheme);

        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    const theme = htmlElement.getAttribute('data-theme');
                    updateImages(theme);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    window.themeSystem = {
        loadTheme: loadTheme,
        toggleTheme: toggleTheme,
        updateThemeButton: updateThemeButton,
        updateImages: updateImages
    };
})();