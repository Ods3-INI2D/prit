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
                'INSERT INTO banners (imagem, legenda, link) VALUES (?, ?, ?)',
                [dados.imagem, dados.legenda || '', dados.link || '/home']
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    update: async (id, dados) => {
        try {
            const [result] = await pool.query(
                'UPDATE banners SET imagem = ?, legenda = ?, link = ? WHERE id_banner = ?',
                [dados.imagem, dados.legenda, dados.link, id]
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