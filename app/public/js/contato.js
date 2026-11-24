document.addEventListener('DOMContentLoaded', function () {
    const formReclamacao = document.querySelector('form[action="/reclamacao"]');

    if (formReclamacao) configurarContato(formReclamacao, 'nome', 'Nome é obrigatório!');
});

function validarMensagem(textarea) {
    const v = textarea.value.trim();
    if (!v)           { mostrarErro(textarea, 'Mensagem é obrigatória!'); return false; }
    if (v.length < 10) { mostrarErro(textarea, 'Escreva pelo menos 10 caracteres!'); return false; }
    mostrarSucesso(textarea);
    return true;
}

function validarCampoTexto(input, mensagemVazio) {
    if (!input.value.trim()) { mostrarErro(input, mensagemVazio); return false; }
    mostrarSucesso(input);
    return true;
}

function mostrarRetorno(retorno, ok, mensagem) {
    retorno.textContent = mensagem;
    retorno.classList.toggle('contato-retorno--ok', ok);
    retorno.classList.toggle('contato-retorno--erro', !ok);
    retorno.hidden = false;
    retorno.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function configurarContato(form, campoNome, mensagemVazio) {
    const inputNome     = form.querySelector('#' + campoNome);
    const inputEmail    = form.querySelector('#email');
    const inputMensagem = form.querySelector('#mensagem');
    const botao         = form.querySelector('button[type="submit"]');
    const retorno       = document.getElementById('contato-retorno');
    const textoBotao    = botao.textContent;

    inputNome.addEventListener('blur',     () => validarCampoTexto(inputNome, mensagemVazio));
    inputEmail.addEventListener('blur',    () => validarEmail(inputEmail));
    inputMensagem.addEventListener('blur', () => validarMensagem(inputMensagem));

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        limparErros(form);
        retorno.hidden = true;

        let valido = true;
        if (!validarCampoTexto(inputNome, mensagemVazio)) valido = false;
        if (!validarEmail(inputEmail))                     valido = false;
        if (!validarMensagem(inputMensagem))               valido = false;
        if (!valido) return;

        const dados = {
            [campoNome]: inputNome.value.trim(),
            email:       inputEmail.value.trim(),
            mensagem:    inputMensagem.value.trim()
        };

        botao.disabled = true;
        botao.textContent = 'Enviando...';

        try {
            const resposta = await fetch(form.getAttribute('action'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const json = await resposta.json().catch(() => ({}));

            if (resposta.ok && json.ok) {
                form.reset();
                form.querySelectorAll('.success').forEach(el => el.classList.remove('success'));
                mostrarRetorno(retorno, true, json.mensagem || 'Mensagem enviada com sucesso!');
            } else {
                mostrarRetorno(retorno, false, json.erro || 'Não foi possível enviar agora. Tente novamente.');
            }
        } catch (erro) {
            mostrarRetorno(retorno, false, 'Sem conexão com o servidor. Tente novamente.');
        } finally {
            botao.disabled = false;
            botao.textContent = textoBotao;
        }
    });
}