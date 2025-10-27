document.addEventListener('DOMContentLoaded', function() {
    
    const formCadastro = document.querySelector('form[action="/cadastro"]');
    const formLogin = document.querySelector('form[action="/login"]');

    if(formCadastro) {
        validarCadastro(formCadastro);
    }

    if(formLogin) {
        validarLogin(formLogin);
    }
});

function validarCadastro(form) {
    const inputNome = form.querySelector('#nome');
    const inputNasc = form.querySelector('#nasc');
    const inputCPF = form.querySelector('#cpf');
    const inputTel = form.querySelector('#tel');
    const inputEmail = form.querySelector('#email');
    const inputSenha = form.querySelector('#senhan');
    const inputConfirmarSenha = form.querySelector('#senha');

    form.addEventListener('submit', function(e) {
        let valido = true;
        limparErros();

        if(!validarNome(inputNome.value)) {
            mostrarErro(inputNome, 'Nome deve conter de 3 a 50 caracteres!');
            valido = false;
        }

        if(!validarDataNascimento(inputNasc.value)) {
            mostrarErro(inputNasc, 'Data de nascimento inválida!');
            valido = false;
        }

        if(!validarCPF(inputCPF.value)) {
            mostrarErro(inputCPF, 'CPF inválido!');
            valido = false;
        }

        if(!validarTelefone(inputTel.value)) {
            mostrarErro(inputTel, 'Telefone deve conter 9 dígitos!');
            valido = false;
        }

        if(!validarEmail(inputEmail.value)) {
            mostrarErro(inputEmail, 'E-mail inválido!');
            valido = false;
        }

        if(!validarSenha(inputSenha.value)) {
            mostrarErro(inputSenha, 'Senha deve conter de 6 a 20 caracteres, incluindo letra maiúscula, número e caractere especial!');
            valido = false;
        }

        if(inputSenha.value !== inputConfirmarSenha.value) {
            mostrarErro(inputConfirmarSenha, 'As senhas não conferem!');
            valido = false;
        }

        if(!valido) {
            e.preventDefault();
        }
    });

    inputNome.addEventListener('blur', function() {
        if(!validarNome(this.value)) {
            mostrarErro(this, 'Nome deve conter de 3 a 50 caracteres!');
        } else {
            limparErroInput(this);
        }
    });

    inputCPF.addEventListener('blur', function() {
        if(!validarCPF(this.value)) {
            mostrarErro(this, 'CPF inválido!');
        } else {
            limparErroInput(this);
        }
    });

    inputTel.addEventListener('blur', function() {
        if(!validarTelefone(this.value)) {
            mostrarErro(this, 'Telefone deve conter 9 dígitos!');
        } else {
            limparErroInput(this);
        }
    });

    inputEmail.addEventListener('blur', function() {
        if(!validarEmail(this.value)) {
            mostrarErro(this, 'E-mail inválido!');
        } else {
            limparErroInput(this);
        }
    });

    inputSenha.addEventListener('blur', function() {
        if(!validarSenha(this.value)) {
            mostrarErro(this, 'Senha deve conter de 6 a 20 caracteres, incluindo letra maiúscula, número e caractere especial!');
        } else {
            limparErroInput(this);
        }
    });

    inputConfirmarSenha.addEventListener('blur', function() {
        if(inputSenha.value !== this.value) {
            mostrarErro(this, 'As senhas não conferem!');
        } else {
            limparErroInput(this);
        }
    });
}

function validarLogin(form) {
    const inputEmail = form.querySelector('#email');
    const inputSenha = form.querySelector('#senha');

    form.addEventListener('submit', function(e) {
        let valido = true;
        limparErros();

        if(!validarEmail(inputEmail.value)) {
            mostrarErro(inputEmail, 'E-mail inválido!');
            valido = false;
        }

        if(!inputSenha.value || inputSenha.value.length < 6) {
            mostrarErro(inputSenha, 'Senha deve ter no mínimo 6 caracteres!');
            valido = false;
        }

        if(!valido) {
            e.preventDefault();
        }
    });
}

function validarNome(nome) {
    return nome.length >= 3 && nome.length <= 50;
}

function validarDataNascimento(data) {
    if(!data) return false;
    
    const dataNasc = new Date(data);
    const hoje = new Date();
    const idadeMaxima = new Date();
    idadeMaxima.setFullYear(hoje.getFullYear() - 110);

    return dataNasc <= hoje && dataNasc >= idadeMaxima;
}

function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]/g, '');
    
    if(cpf.length !== 11) return false;
    
    // verifica se todos os digitos sao iguais tipo 111.111.111-11
    if(/^(\d)\1{10}$/.test(cpf)) return false;

    let soma = 0;
    for(let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = soma % 11;
    let digito1 = resto < 2 ? 0 : 11 - resto;

    if(parseInt(cpf.charAt(9)) !== digito1) return false;

    soma = 0;
    for(let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = soma % 11;
    let digito2 = resto < 2 ? 0 : 11 - resto;

    return parseInt(cpf.charAt(10)) === digito2;
}

function validarTelefone(tel) {
    tel = tel.replace(/[^\d]/g, '');
    
    if(tel.length !== 9) return false;
    
    // nao aceita numero com todos digitos iguais tipo 999999999
    if(/^(\d)\1{8}$/.test(tel)) return false;
    
    return true;
}

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function validarSenha(senha) {
    if(senha.length < 6 || senha.length > 20) return false;
    
    const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/;
    return regex.test(senha);
}

function mostrarErro(input, mensagem) {
    input.setAttribute('aria-invalid', 'true');
    input.classList.add('erro');
    
    const erroId = input.id + '-erro';
    let erroElement = document.getElementById(erroId);
    
    if(!erroElement) {
        erroElement = document.createElement('output');
        erroElement.id = erroId;
        erroElement.setAttribute('role', 'alert');
        erroElement.setAttribute('aria-live', 'polite');
        erroElement.className = 'erro';
        input.parentNode.insertBefore(erroElement, input.nextSibling);
    }
    
    erroElement.textContent = mensagem;
    erroElement.style.display = 'block';
    input.setAttribute('aria-describedby', erroId);
}

function limparErroInput(input) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    input.classList.remove('erro');
    
    const erroId = input.id + '-erro';
    const erroElement = document.getElementById(erroId);
    
    if(erroElement) {
        erroElement.style.display = 'none';
        erroElement.textContent = '';
    }
}

function limparErros() {
    const inputs = document.querySelectorAll('input.erro');
    inputs.forEach(input => {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
        input.classList.remove('erro');
    });
    
    const outputs = document.querySelectorAll('output[role="alert"]');
    outputs.forEach(output => {
        output.style.display = 'none';
        output.textContent = '';
    });
}