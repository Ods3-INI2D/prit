// Funções de Validação para Node.js (Lado do Servidor)

/**
 * Remove caracteres de formatação (ponto, hífen) do CPF/Telefone.
 * @param {string} str - A string de entrada.
 * @returns {string} - A string contendo apenas dígitos.
 */
function cleanDigits(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[^\d]/g, '');
}

/**
 * Calcula o dígito verificador do CPF.
 * @param {string} cpfBase - Os 9 (para o 1º dígito) ou 10 (para o 2º dígito) primeiros números do CPF.
 * @returns {number} - O dígito verificador calculado.
 */
function calculateVerifierDigit(cpfBase) {
    let sum = 0;
    const position = cpfBase.length + 1;

    for (let i = 0; i < cpfBase.length; i++) {
        sum += Number(cpfBase[i]) * (position - i);
    }

    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
}

/**
 * Validação de CPF com algoritmo completo
 * @param {string} cpf - CPF a ser validado
 * @returns {boolean} - true se válido, false se inválido
 */
function valCPF(cpf) {
    const cleanedCpf = cleanDigits(cpf);

    if (cleanedCpf.length !== 11) return false;
    
    // Verifica CPFs com dígitos repetidos
    if (/^(\d)\1{10}$/.test(cleanedCpf)) return false;

    // 1º Dígito Verificador
    const cpfBase9 = cleanedCpf.substring(0, 9);
    const firstDigitCalculated = calculateVerifierDigit(cpfBase9);

    if (firstDigitCalculated !== Number(cleanedCpf[9])) return false;

    // 2º Dígito Verificador
    const cpfBase10 = cleanedCpf.substring(0, 10);
    const secondDigitCalculated = calculateVerifierDigit(cpfBase10);

    if (secondDigitCalculated !== Number(cleanedCpf[10])) return false;

    return true;
}

/**
 * Validação de Data de Nascimento (máximo 110 anos e não futura)
 * @param {string} dataNascimentoStr - Data no formato ISO 8601 (AAAA-MM-DD)
 * @returns {boolean} - true se válido, false se inválido
 */
function valNasc(dataNascimentoStr) {
    if (!dataNascimentoStr) return false;

    const dataNascimento = new Date(dataNascimentoStr);
    
    // Verifica se a data é inválida
    if (isNaN(dataNascimento.getTime())) {
        return false;
    }

    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setFullYear(hoje.getFullYear() - 110);
    
    // Zera horas para comparação apenas de data
    dataNascimento.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);
    dataLimite.setHours(0, 0, 0, 0);

    // Não pode ser no futuro nem anterior a 110 anos
    if (dataNascimento > hoje || dataNascimento < dataLimite) {
        return false;
    }

    return true;
}

/**
 * Validação de Telefone (9 dígitos)
 * @param {string} tel - Telefone a ser validado
 * @returns {boolean} - true se válido, false se inválido
 */
function valTel(tel) {
    const cleanedTel = cleanDigits(tel);
    const length = cleanedTel.length;

    // Verifica se tem 9 dígitos (celular)
    if (length !== 9) {
        return false;
    }
    
    // Verifica se tem todos os dígitos repetidos
    if (new RegExp(`^(\\d)\\1{${length - 1}}$`).test(cleanedTel)) {
        return false;
    }
    
    return true;
}

/**
 * Validação de Senha (6 a 20 caracteres, com maiúscula, número e caractere especial)
 * @param {string} senhan - Senha a ser validada
 * @returns {boolean} - true se válido, false se inválido
 */
function valSenha(senhan) {
    if (typeof senhan !== 'string' || senhan === '') return false;

    // Tamanho: 6 a 20 caracteres
    if (senhan.length < 6 || senhan.length > 20) {
        return false;
    }

    // Complexidade: Pelo menos um número, uma letra maiúscula e um caractere especial
    const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/; 
    
    if (!regex.test(senhan)) {
        return false;
    }

    return true;
}

/**
 * Confirmação de Senha
 * @param {string} csenha - Senha de confirmação
 * @param {string} senhan - Senha original
 * @returns {boolean} - true se as senhas são iguais, false se diferentes
 */
function valCsenha(csenha, senhan) {
    if (typeof csenha !== 'string' || typeof senhan !== 'string') return false;
    return csenha === senhan;
}

// Exportação das funções para uso no Node.js
module.exports = { 
    valCPF, 
    valTel, 
    valSenha, 
    valCsenha, 
    valNasc
};