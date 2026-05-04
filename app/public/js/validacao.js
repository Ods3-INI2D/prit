document.addEventListener('DOMContentLoaded', function () {

    const formCadastro = document.querySelector('form[action="/cadastro"]');
    const formLogin    = document.querySelector('form[action="/login"]');

    if (formCadastro) validarCadastro(formCadastro);
    if (formLogin)    validarLogin(formLogin);
});

/*cadastro */
function validarCadastro(form) {
    const inputNome           = form.querySelector('#nome');
    const inputNasc           = form.querySelector('#nasc');
    const inputCPF            = form.querySelector('#cpf');
    const inputDDD            = form.querySelector('#ddd');
    const inputTel            = form.querySelector('#tel');
    const inputEmail          = form.querySelector('#email');
    const inputSenha          = form.querySelector('#senhan');
    const inputConfirmarSenha = form.querySelector('#senha');

    /* masscara CPF: exibe 000.000.000-00 */
    if (inputCPF) {
        inputCPF.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 9)      v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            this.value = v;
        });
    }

    /* mascara telefone: exibe 99999-9999 */
    if (inputTel) {
        inputTel.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 9);
            if (v.length > 5) v = v.replace(/(\d{5})(\d{1,4})/, '$1-$2');
            this.value = v;
        });
    }

    /* DDD: apenas 2 digitos*/
    if (inputDDD) {
        inputDDD.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 2);
        });
    }

    /* validaçao blur*/
    if (inputNome)           inputNome.addEventListener('blur',   () => validarNome(inputNome));
    if (inputNasc)           inputNasc.addEventListener('blur',   () => validarDataNasc(inputNasc));
    if (inputCPF)            inputCPF.addEventListener('blur',    () => validarCPF(inputCPF));
    if (inputDDD)            inputDDD.addEventListener('blur',    () => validarDDD(inputDDD));
    if (inputTel)            inputTel.addEventListener('blur',    () => validarTelefone(inputTel));
    if (inputEmail)          inputEmail.addEventListener('blur',  () => validarEmail(inputEmail));
    if (inputSenha)          inputSenha.addEventListener('blur',  () => validarSenha(inputSenha));
    if (inputConfirmarSenha) inputConfirmarSenha.addEventListener('blur',
        () => validarConfirmaSenha(inputSenha, inputConfirmarSenha));

    /* submit: valida + remove mascaras antes de enviar*/
    form.addEventListener('submit', function (e) {
        limparErros(form);
        let valido = true;

        if (inputNome           && !validarNome(inputNome))                                 valido = false;
        if (inputNasc           && !validarDataNasc(inputNasc))                             valido = false;
        if (inputCPF            && !validarCPF(inputCPF))                                   valido = false;
        if (inputDDD            && !validarDDD(inputDDD))                                   valido = false;
        if (inputTel            && !validarTelefone(inputTel))                              valido = false;
        if (inputEmail          && !validarEmail(inputEmail))                               valido = false;
        if (inputSenha          && !validarSenha(inputSenha))                               valido = false;
        if (inputConfirmarSenha && !validarConfirmaSenha(inputSenha, inputConfirmarSenha))  valido = false;

        if (!valido) {
            e.preventDefault();
            return;
        }

        /*para que o backend receba apenas os dígitos (11 para CPF, 9 para tel)*/
        if (inputCPF) inputCPF.value = inputCPF.value.replace(/\D/g, '');
        if (inputTel) inputTel.value = inputTel.value.replace(/\D/g, '');
    });
}

/*login*/
function validarLogin(form) {
    const inputEmail = form.querySelector('#email');
    const inputSenha = form.querySelector('#senha');

    if (inputEmail) inputEmail.addEventListener('blur', () => validarEmail(inputEmail));
    if (inputSenha) inputSenha.addEventListener('blur', function () {
        if (!inputSenha.value || inputSenha.value.length < 6) {
            mostrarErro(inputSenha, 'Senha deve ter no mínimo 6 caracteres!');
        } else {
            mostrarSucesso(inputSenha);
        }
    });

    form.addEventListener('submit', function (e) {
        limparErros(form);
        let valido = true;
        if (inputEmail && !validarEmail(inputEmail)) valido = false;
        if (inputSenha && (!inputSenha.value || inputSenha.value.length < 6)) {
            mostrarErro(inputSenha, 'Senha deve ter no mínimo 6 caracteres!');
            valido = false;
        }
        if (!valido) e.preventDefault();
    });
}

/*funçoes de validaçao*/

function validarNome(input) {
    const v = input.value.trim();
    if (!v)                               { mostrarErro(input, 'Nome é obrigatório!'); return false; }
    if (!/^[a-zA-ZÀ-ÿ\s]{3,50}$/.test(v)) { mostrarErro(input, 'Nome deve conter apenas letras e ter de 3 a 50 caracteres!'); return false; }
    mostrarSucesso(input); return true;
}

function validarDataNasc(input) {
    const v = input.value;
    if (!v) { mostrarErro(input, 'Data de nascimento é obrigatória!'); return false; }
    const dataNasc = new Date(v);
    const hoje = new Date();
    const limite = new Date();
    limite.setFullYear(hoje.getFullYear() - 110);
    if (isNaN(dataNasc.getTime()) || dataNasc > hoje || dataNasc < limite) {
        mostrarErro(input, 'Data de nascimento inválida!'); return false;
    }
    mostrarSucesso(input); return true;
}

function validarCPF(input) {
    const cpf = input.value.replace(/\D/g, ''); /* remove pontos e hífen da máscara */
    if (!cpf)            { mostrarErro(input, 'CPF é obrigatório!'); return false; }
    if (cpf.length !== 11) { mostrarErro(input, 'CPF deve ter 11 dígitos!'); return false; }
    if (!isValidCPF(cpf))  { mostrarErro(input, 'CPF inválido!'); return false; }
    mostrarSucesso(input); return true;
}

function validarDDD(input) {
    const v = input.value.replace(/\D/g, '');
    const dddsValidos = [
        '11','12','13','14','15','16','17','18','19',
        '21','22','24','27','28',
        '31','32','33','34','35','37','38',
        '41','42','43','44','45','46',
        '47','48','49',
        '51','53','54','55',
        '61','62','63','64','65','66','67','68','69',
        '71','73','74','75','77','79',
        '81','82','83','84','85','86','87','88','89',
        '91','92','93','94','95','96','97','98','99'
    ];
    if (!v || v.length !== 2)      { mostrarErro(input, 'DDD deve ter 2 dígitos!'); return false; }
    if (!dddsValidos.includes(v))  { mostrarErro(input, 'DDD inválido!'); return false; }
    mostrarSucesso(input); return true;
}

function validarTelefone(input) {
    const v = input.value.replace(/\D/g, ''); /* remove o hífen da máscara */
    if (!v)              { mostrarErro(input, 'Telefone é obrigatório!'); return false; }
    if (v.length !== 9)  { mostrarErro(input, 'Telefone deve ter 9 dígitos!'); return false; }
    if (/^(\d)\1{8}$/.test(v)) { mostrarErro(input, 'Telefone inválido!'); return false; }
    mostrarSucesso(input); return true;
}

function validarEmail(input) {
    const v = input.value.trim();
    if (!v)                                     { mostrarErro(input, 'E-mail é obrigatório!'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { mostrarErro(input, 'E-mail inválido!'); return false; }
    mostrarSucesso(input); return true;
}

function validarSenha(input) {
    const v = input.value;
    if (!v)                          { mostrarErro(input, 'Senha é obrigatória!'); return false; }
    if (v.length < 6 || v.length > 20) { mostrarErro(input, 'Senha deve ter de 6 a 20 caracteres!'); return false; }
    if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/.test(v)) {
        mostrarErro(input, 'Senha deve incluir letra maiúscula, número e símbolo (!@#$%^&*)!'); return false;
    }
    mostrarSucesso(input); return true;
}

function validarConfirmaSenha(inputSenha, inputConfirmar) {
    if (!inputConfirmar.value)                    { mostrarErro(inputConfirmar, 'Confirmação de senha é obrigatória!'); return false; }
    if (inputSenha.value !== inputConfirmar.value) { mostrarErro(inputConfirmar, 'As senhas não conferem!'); return false; }
    mostrarSucesso(inputConfirmar); return true;
}

/*algoritipo*/
function isValidCPF(cpf) {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cpf.charAt(i)) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cpf.charAt(i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.charAt(10));
}

/*helpers*/
function mostrarErro(input, mensagem) {
    input.setAttribute('aria-invalid', 'true');
    input.classList.remove('success');
    input.classList.add('error');

    const erroId = input.id + '-error';
    let out = document.getElementById(erroId);
    if (!out) {
        out = document.createElement('output');
        out.id        = erroId;
        out.className = 'error-message';
        out.setAttribute('role', 'alert');
        out.setAttribute('aria-live', 'polite');
        input.parentNode.insertBefore(out, input.nextSibling);
    }
    out.textContent   = mensagem;
    out.style.display = 'block';
    input.setAttribute('aria-describedby', erroId);
}

function mostrarSucesso(input) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    input.classList.remove('error');
    input.classList.add('success');
    const out = document.getElementById(input.id + '-error');
    if (out) { out.textContent = ''; out.style.display = 'none'; }
}

function limparErros(form) {
    form.querySelectorAll('input.error').forEach(function (input) {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
        input.classList.remove('error');
    });
    form.querySelectorAll('output[role="alert"]').forEach(function (out) {
        out.style.display = 'none';
        out.textContent   = '';
    });
}