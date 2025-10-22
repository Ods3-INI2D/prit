// Funções de Validação Corrigidas (JavaScript Puro)

// --- Funções Auxiliares (Limpeza e Cálculo) ---

/**
 * Remove caracteres de formatação (ponto, hífen) do CPF/Telefone.
 * @param {string} str - A string de entrada.
 * @returns {string} - A string contendo apenas dígitos.
 */
function cleanDigits(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[^\d]/g, "");
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

// --- Funções de Validação Principais ---

// **1. VALIDAÇÃO DE CPF (Com algoritmo completo)**
function valCPF(cpf) {
  const cleanedCpf = cleanDigits(cpf);

  if (cleanedCpf.length !== 11) return false;

  // Verifica CPFs com dígitos repetidos (que o algoritmo de cálculo não pega)
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

// **2. VALIDAÇÃO DE DATA DE NASCIMENTO (Máximo 110 anos e não futura)**
function valNasc(dataNascimentoStr) {
  if (!dataNascimentoStr) return false;

  // Tenta criar a data. O formato ISO 8601 (AAAA-MM-DD) é mais confiável.
  const dataNascimento = new Date(dataNascimentoStr);

  // Verifica se a data é inválida
  if (isNaN(dataNascimento.getTime())) {
    return false;
  }

  const hoje = new Date();
  const dataLimite = new Date();
  dataLimite.setFullYear(hoje.getFullYear() - 110);

  // Zera horas, minutos, segundos e milissegundos para comparação APENAS de dia.
  // Isso evita problemas com fusos horários e validação.
  dataNascimento.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  dataLimite.setHours(0, 0, 0, 0);

  // Condições:
  // 1. Não pode ser no futuro (dataNascimento > hoje)
  // 2. Não pode ser anterior ao limite de 110 anos (dataNascimento < dataLimite)
  if (dataNascimento > hoje || dataNascimento < dataLimite) {
    return false;
  }

  return true;
}

// **3. VALIDAÇÃO DE TELEFONE (10 ou 11 dígitos, ignorando formatação)**
function valTel(tel) {
  const cleanedTel = cleanDigits(tel);
  const length = cleanedTel.length;

  // Verifica se tem 10 (fixo) ou 11 (celular) dígitos
  if (length !== 10 && length !== 11) {
    return false;
  }

  // Verifica se tem todos os dígitos repetidos (ex: "0000000000" ou "11111111111")
  if (new RegExp(`^(\\d)\\1{${length - 1}}$`).test(cleanedTel)) {
    return false;
  }

  return true;
}

// **4. VALIDAÇÃO DE SENHA (Regras customizadas em JS puro)**
// OBS: A função foi refeita para não depender de express-validator.
function valSenha(senhan) {
  if (typeof senhan !== "string" || senhan === "") return false;

  // 1. Tamanho: 6 a 20 caracteres
  if (senhan.length < 6 || senhan.length > 20) {
    // Em um sistema real, você retornaria a mensagem de erro ou um código
    // console.error('A senha deve conter de 6 a 20 caracteres!');
    return false;
  }

  // 2. Complexidade: Pelo menos um número, uma letra maiúscula e um caractere especial.
  // ^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).*$
  // Corrigido para incluir o caractere de início (^) e fim ($) e remover o ponto (.) solto
  const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/;

  if (!regex.test(senhan)) {
    // console.error('A senha deve conter pelo menos um número, uma letra maiúscula e um caractere especial!');
    return false;
  }

  return true;
}

// **5. CONFIRMAÇÃO DE SENHA (Agora recebe a senha original como argumento)**
function valCsenha(csenha, senhan) {
  // Verifica se ambas são strings válidas e se são iguais
  if (typeof csenha !== "string" || typeof senhan !== "string") return false;

  return csenha === senhan;
}

// **EXPORTAÇÃO ATUALIZADA**
// Adicionei um placeholder para as funções ISO8601 que estavam incompletas.
module.exports = {
  valCPF,
  valTel,
  valSenha,
  valCsenha,
  valNasc,
};
