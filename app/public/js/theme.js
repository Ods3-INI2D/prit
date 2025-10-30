// app/public/js/theme.js
/**
 * Sistema Global de Temas - Claro e Escuro
 * Gerencia a alternância de temas em todo o site
 */

(function() {
    'use strict';

    // Elementos do DOM
    const htmlElement = document.documentElement;
    
    // Carregar tema salvo ou usar padrão (escuro)
    function loadTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        htmlElement.setAttribute('data-theme', savedTheme);
        return savedTheme;
    }

    // Atualizar ícone e texto do botão de tema
    function updateThemeButton(theme) {
        const themeIcon = document.getElementById('theme-icon');
        const themeText = document.querySelector('.theme-text');
        
        if (themeIcon && themeText) {
            if (theme === 'light') {
                themeIcon.src = '/imagens/lua-preta.png';
                themeIcon.alt = 'Ícone de tema escuro';
                themeText.textContent = 'Tema Escuro';
            } else {
                themeIcon.src = '/imagens/lua-branca.png';
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
    }

    // Inicializar tema ao carregar a página
    document.addEventListener('DOMContentLoaded', function() {
        const currentTheme = loadTheme();
        updateThemeButton(currentTheme);

        // Adicionar event listener ao botão de tema (se existir)
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
    });

    // Expor funções globalmente para uso em outras páginas
    window.themeSystem = {
        loadTheme: loadTheme,
        toggleTheme: toggleTheme,
        updateThemeButton: updateThemeButton
    };
})();