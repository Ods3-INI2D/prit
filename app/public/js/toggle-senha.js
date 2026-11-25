/* Alterna a visibilidade de campos de senha.
   Uso: <button type="button" class="btn-toggle-senha" data-target="id-do-input"
                aria-label="Mostrar senha"></button> */
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.btn-toggle-senha').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const input = document.getElementById(this.getAttribute('data-target'));
            if (!input) return;

            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            this.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
        });
    });
});
