/**
 * Calcula a pontuação de relevância de um produto/categoria
 * para um determinado usuário com base em faixa etária e sexo.
 *
 * Pontuação:
 *  - Correspondência exata de faixa etária: +3
 *  - Correspondência exata de sexo:         +2
 *  - Fora da faixa etária (mas existe faixa): -1
 *  - Sexo diferente (mas existe sexo):        -1
 *  - Sem restrição (campo null):              +0 (neutro)
 */

/**
 * Calcula idade em anos a partir de uma data de nascimento ISO.
 * @param {string|Date} nasc
 * @returns {number|null}
 */
function calcularIdade(nasc) {
    if (!nasc) return null;
    const nascDate = new Date(nasc);
    if (isNaN(nascDate.getTime())) return null;
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascDate.getFullYear();
    const mesPassou = hoje.getMonth() > nascDate.getMonth() ||
        (hoje.getMonth() === nascDate.getMonth() && hoje.getDate() >= nascDate.getDate());
    if (!mesPassou) idade--;
    return idade;
}

/**
 * Extrai o número mínimo de uma faixa etária no formato "50+" → 50.
 * @param {string|null} faixaEtaria
 * @returns {number|null}
 */
function parseFaixaMinima(faixaEtaria) {
    if (!faixaEtaria) return null;
    const match = String(faixaEtaria).match(/^(\d+)\+?$/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Pontua a relevância de um item (produto ou categoria) para o usuário.
 * @param {{ faixa_etaria: string|null, sexo: string|null }} item
 * @param {{ nasc: string|Date|null, sexo: string|null }|null} usuario
 * @returns {number}
 */
function pontuar(item, usuario) {
    let score = 0;

    if (!usuario) return score;

    const idadeUsuario = calcularIdade(usuario.nasc);
    const sexoUsuario  = usuario.sexo || null;

    // Faixa etária
    const faixaMin = parseFaixaMinima(item.faixa_etaria);
    if (faixaMin !== null) {
        if (idadeUsuario !== null && idadeUsuario >= faixaMin) {
            score += 3;
        } else if (idadeUsuario !== null) {
            score -= 1;
        }
    }

    // Sexo
    if (item.sexo && item.sexo !== 'todos') {
        if (sexoUsuario && item.sexo === sexoUsuario) {
            score += 2;
        } else if (sexoUsuario && item.sexo !== sexoUsuario) {
            score -= 1;
        }
    }

    return score;
}

/**
 * Ordena um array de produtos ou categorias por relevância para o usuário.
 * Itens com maior pontuação vêm primeiro.
 * Empates mantêm a ordem original (sort estável).
 * @param {Array} itens
 * @param {object|null} usuario
 * @returns {Array}
 */
function ordenarPorRelevancia(itens, usuario) {
    if (!itens || itens.length === 0) return itens;
    if (!usuario) return itens;

    return itens
        .map((item, indice) => ({ item, score: pontuar(item, usuario), indice }))
        .sort((a, b) => b.score - a.score || a.indice - b.indice)
        .map(({ item }) => item);
}

module.exports = { calcularIdade, pontuar, ordenarPorRelevancia };