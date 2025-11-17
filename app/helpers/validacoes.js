/**
 * tira os caracteres de formatacao tipo ponto e hifen do cpf/telefone
 * @param {string} str - o texto que vai limpar
 * @returns {string} - retorna so os numeros
 */
function cleanDigits(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[^\d]/g, '');
}

/**
 * calcula o digito verificador do cpf
 * @param {string} cpfBase - os 9 primeiros digitos (pro 1 digito) ou 10 (pro 2 digito)
 * @returns {number} - o digito verificador calculado
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
 * validacao de cpf
 * @param {string} cpf - cpf pra validar
 * @returns {boolean} - true se valido, false se errado
 */
function valCPF(cpf) {
    const cleanedCpf = cleanDigits(cpf);

    if (cleanedCpf.length !== 11) return false;
    
    // ve se tem cpf com digitos repetidos tipo 111.111.111-11
    if (/^(\d)\1{10}$/.test(cleanedCpf)) return false;

    // 1 digito verificador
    const cpfBase9 = cleanedCpf.substring(0, 9);
    const firstDigitCalculated = calculateVerifierDigit(cpfBase9);

    if (firstDigitCalculated !== Number(cleanedCpf[9])) return false;

    // 2 digito verificador
    const cpfBase10 = cleanedCpf.substring(0, 10);
    const secondDigitCalculated = calculateVerifierDigit(cpfBase10);

    if (secondDigitCalculated !== Number(cleanedCpf[10])) return false;

    return true;
}

/**
 * validacao de data de nascimento (max 110 anos e nao pode ser futura)
 * @param {string} dataNascimentoStr - data no formato iso 8601 (aaaa-mm-dd)
 * @returns {boolean} - true se valida, false se errada
 */
function valNasc(dataNascimentoStr) {
    if (!dataNascimentoStr) return false;

    const dataNascimento = new Date(dataNascimentoStr);
    
    // verificacao de data
    if (isNaN(dataNascimento.getTime())) {
        return false;
    }

    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setFullYear(hoje.getFullYear() - 110);
    
    // zera as horas pra comparar a data
    dataNascimento.setHours(0, 0, 0, 0);
    hoje.setHours(0, 0, 0, 0);
    dataLimite.setHours(0, 0, 0, 0);

    // nao pode ser no futuro nem antes de 110 anos
    if (dataNascimento > hoje || dataNascimento < dataLimite) {
        return false;
    }

    return true;
}

/**
 * validacao de DDD (2 digitos validos)
 * @param {string} ddd - ddd pra validar
 * @returns {boolean} - true se ta valido, false se ta errado
 */
function valDDD(ddd) {
    const cleanedDDD = cleanDigits(ddd);
    
    // DDD deve ter exatamente 2 digitos
    if (cleanedDDD.length !== 2) {
        return false;
    }
    
    // Lista de DDDs validos no Brasil
    const dddsValidos = [
        '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
        '21', '22', '24', // RJ
        '27', '28', // ES
        '31', '32', '33', '34', '35', '37', '38', // MG
        '41', '42', '43', '44', '45', '46', // PR
        '47', '48', '49', // SC
        '51', '53', '54', '55', // RS
        '61', // DF
        '62', '64', // GO
        '63', // TO
        '65', '66', // MT
        '67', // MS
        '68', // AC
        '69', // RO
        '71', '73', '74', '75', '77', // BA
        '79', // SE
        '81', '87', // PE
        '82', // AL
        '83', // PB
        '84', // RN
        '85', '88', // CE
        '86', '89', // PI
        '91', '93', '94', // PA
        '92', '97', // AM
        '95', // RR
        '96', // AP
        '98', '99' // MA
    ];
    
    return dddsValidos.includes(cleanedDDD);
}

/**
 * validacao de telefone (9 digitos) - SEM O DDD
 * @param {string} tel - telefone pra validar
 * @returns {boolean} - true se valido, false se errado
 */
function valTel(tel) {
    const cleanedTel = cleanDigits(tel);
    const length = cleanedTel.length;

    // ve se tem 9 digitos
    if (length !== 9) {
        return false;
    }
    
    // ve se tem todos os digitos repetidos tipo 999999999
    if (new RegExp(`^(\\d)\\1{${length - 1}}$`).test(cleanedTel)) {
        return false;
    }
    
    return true;
}

/**
 * validacao de telefone completo com DDD (11 digitos)
 * @param {string} ddd - ddd de 2 digitos
 * @param {string} tel - telefone de 9 digitos
 * @returns {boolean} - true se valido, false se errado
 */
function valTelCompleto(ddd, tel) {
    return valDDD(ddd) && valTel(tel);
}

/**
 * validacao de senha (6 a 20 caracteres, com maiuscula, numero e caractere especial)
 * @param {string} senhan - senha pra validar
 * @returns {boolean} - true se valida false se errada
 */
function valSenha(senhan) {
    if (typeof senhan !== 'string' || senhan === '') return false;

    // 6 a 20 caracteres
    if (senhan.length < 6 || senhan.length > 20) {
        return false;
    }

    // pelo menos um numero, uma letra maiuscula e um caractere especial
    const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/; 
    
    if (!regex.test(senhan)) {
        return false;
    }

    return true;
}

/**
 * confirmacao de senha
 * @param {string} csenha - senha de confirmacao
 * @param {string} senhan - senha original
 * @returns {boolean} - true se as senhas sao iguais, false se diferentes
 */
function valCsenha(csenha, senhan) {
    if (typeof csenha !== 'string' || typeof senhan !== 'string') return false;
    return csenha === senhan;
}

module.exports = { 
    valCPF, 
    valDDD,
    valTel, 
    valTelCompleto,
    valSenha, 
    valCsenha, 
    valNasc
};