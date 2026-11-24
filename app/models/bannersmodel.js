const pool = require('../config/pool_conexoes');
const mockStore = require('../config/mock_store');

// As colunas faixa_etaria e sexo foram adicionadas à tabela banners depois da criação
// inicial dela. Em bancos antigos elas não existem e o INSERT/UPDATE falha com
// "Unknown column". Aqui elas são criadas uma única vez, sem tocar em bancos já migrados.
let colunasPublico = null;
function garantirColunasPublico() {
    if (!colunasPublico) {
        const adicionar = async (ddl) => {
            try {
                await pool.query(ddl);
            } catch (erro) {
                if (erro.code !== 'ER_DUP_FIELDNAME') throw erro;
            }
        };
        colunasPublico = (async () => {
            await adicionar('ALTER TABLE banners ADD COLUMN faixa_etaria VARCHAR(10) NULL DEFAULT NULL');
            await adicionar('ALTER TABLE banners ADD COLUMN sexo VARCHAR(12) NULL DEFAULT NULL');
        })().catch((erro) => {
            colunasPublico = null;
            console.error('[banners] Não foi possível criar as colunas faixa_etaria/sexo automaticamente. ' +
                'Execute app/config/banners/banners_migrations.sql no banco.', erro.message);
            throw erro;
        });
    }
    return colunasPublico;
}

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
            await garantirColunasPublico();
            const [result] = await pool.query(
                'INSERT INTO banners (imagem, legenda, link, faixa_etaria, sexo) VALUES (?, ?, ?, ?, ?)',
                [dados.imagem, dados.legenda || '', dados.link || '/home',
                 dados.faixa_etaria || null, dados.sexo || null]
            );
            return result;
        } catch (erro) {
            console.error('[banners] Erro ao criar banner:', erro.message);
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
            await garantirColunasPublico();
            const [result] = await pool.query(
                'UPDATE banners SET imagem = ?, legenda = ?, link = ?, faixa_etaria = ?, sexo = ? WHERE id_banner = ?',
                [dados.imagem, dados.legenda, dados.link,
                 dados.faixa_etaria || null, dados.sexo || null, id]
            );
            return result;
        } catch (erro) {
            console.error('[banners] Erro ao editar banner:', erro.message);
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