const pool = require('../config/pool_conexoes');

const bannersModel = {

    findAll: async () => {
        try {
            const [linhas] = await pool.query('SELECT * FROM banners ORDER BY id_banner');
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    findById: async (id) => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM banners WHERE id_banner = ?', [id]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    create: async (dados) => {
        try {
            const [result] = await pool.query(
                // [ALTERADO] grava também faixa_etaria e sexo (usados pelo algoritmo "Para Você")
                'INSERT INTO banners (imagem, legenda, link, faixa_etaria, sexo) VALUES (?, ?, ?, ?, ?)',
                [dados.imagem, dados.legenda || '', dados.link || '/home',
                 dados.faixa_etaria || null, dados.sexo || null]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    update: async (id, dados) => {
        try {
            const [result] = await pool.query(
                // [ALTERADO] atualiza também faixa_etaria e sexo
                'UPDATE banners SET imagem = ?, legenda = ?, link = ?, faixa_etaria = ?, sexo = ? WHERE id_banner = ?',
                [dados.imagem, dados.legenda, dados.link,
                 dados.faixa_etaria || null, dados.sexo || null, id]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    delete: async (id) => {
        try {
            const [result] = await pool.query(
                'DELETE FROM banners WHERE id_banner = ?', [id]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    }
};

module.exports = { bannersModel };