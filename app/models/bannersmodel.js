const pool = require('../../config/pool_conexoes');

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
    }
};

module.exports = { bannersModel };