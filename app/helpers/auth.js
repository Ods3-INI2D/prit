// Funções de autenticação e segurança com bcrypt

const bcrypt = require('bcrypt');

/**
 * Criptografa uma senha usando bcrypt
 * @param {string} senha - Senha em texto plano
 * @returns {Promise<string>} - Senha hasheada
 */
async function hashSenha(senha) {
    try {
        const saltRounds = 10; // Número de rounds para o bcrypt
        const senhaHash = await bcrypt.hash(senha, saltRounds);
        return senhaHash;
    } catch (error) {
        console.error('Erro ao fazer hash da senha:', error);
        throw error;
    }
}

/**
 * Compara uma senha em texto plano com um hash
 * @param {string} senha - Senha em texto plano
 * @param {string} senhaHash - Hash da senha armazenada no banco
 * @returns {Promise<boolean>} - true se a senha corresponde, false caso contrário
 */
async function compareSenha(senha, senhaHash) {
    try {
        const match = await bcrypt.compare(senha, senhaHash);
        return match;
    } catch (error) {
        console.error('Erro ao comparar senha:', error);
        throw error;
    }
}

// Exportar as funções
module.exports = {
    hashSenha,
    compareSenha
};