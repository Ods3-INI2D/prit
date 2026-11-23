const pool = require('../config/pool_conexoes');
const mockStore = require('../config/mock_store');

const bannersModel = {

    findAll: async () => {
        if (pool.isMock) {
            return mockStore.banners.slice().sort((a, b) => a.id_banner - b.id_banner);
        }
        try {
            const [linhas] = await pool.query('SELECT * FROM banners ORDER BY id_banner');
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    findById: async (id) => {
        if (pool.isMock) {
            return mockStore.banners.find(b => b.id_banner === Number(id)) || null;
        }
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
        if (pool.isMock) {
            const id_banner = mockStore.seq.banner++;
            mockStore.banners.push({
                id_banner,
                imagem: dados.imagem,
                legenda: dados.legenda || '',
                link: dados.link || '/home',
                faixa_etaria: dados.faixa_etaria || null,
                sexo: dados.sexo || null
            });
            return { insertId: id_banner, affectedRows: 1 };
        }
        try {
            const [result] = await pool.query(
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
        if (pool.isMock) {
            const idx = mockStore.banners.findIndex(b => b.id_banner === Number(id));
            if (idx === -1) return { affectedRows: 0 };
            mockStore.banners[idx] = {
                ...mockStore.banners[idx],
                imagem: dados.imagem,
                legenda: dados.legenda,
                link: dados.link,
                faixa_etaria: dados.faixa_etaria || null,
                sexo: dados.sexo || null
            };
            return { affectedRows: 1 };
        }
        try {
            const [result] = await pool.query(
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
        if (pool.isMock) {
            const idx = mockStore.banners.findIndex(b => b.id_banner === Number(id));
            if (idx !== -1) mockStore.banners.splice(idx, 1);
            return { affectedRows: idx !== -1 ? 1 : 0 };
        }
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