const pool = require('../config/pool_conexoes');

const usuariosModel = {

    // ── Busca todos os usuários ──────────────────────────────────
    findAll: async () => {
        try {
            const [linhas] = await pool.query(
                'SELECT id_usuario, nome, nasc, cpf, ddd, tel, email, criado_em FROM usuarios ORDER BY id_usuario'
            );
            return linhas;
        } catch (erro) {
            return erro;
        }
    },

    // ── Busca por e-mail (login / verificação de duplicidade) ────
    findByEmail: async (email) => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM usuarios WHERE email = ?',
                [email]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    // ── Busca por id ─────────────────────────────────────────────
    findById: async (id) => {
        try {
            const [linhas] = await pool.query(
                'SELECT id_usuario, nome, nasc, cpf, ddd, tel, email, criado_em FROM usuarios WHERE id_usuario = ?',
                [id]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    // ── Cadastro ─────────────────────────────────────────────────
    create: async (dados) => {
        /*
            dados: { nome, nasc, cpf, ddd, tel, email, senhan }
        */
        try {
            const [result] = await pool.query(
                'INSERT INTO usuarios (nome, nasc, cpf, ddd, tel, email, senhan) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [dados.nome, dados.nasc, dados.cpf, dados.ddd, dados.tel, dados.email, dados.senhan]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // ── Atualiza um campo específico ─────────────────────────────
    updateCampo: async (email, campo, valor) => {
        const camposPermitidos = ['nome', 'nasc', 'cpf', 'ddd', 'tel'];
        if (!camposPermitidos.includes(campo)) return null;
        try {
            const [result] = await pool.query(
                `UPDATE usuarios SET \`${campo}\` = ? WHERE email = ?`,
                [valor, email]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // ── Remove usuário (admin) ───────────────────────────────────
    delete: async (email) => {
        try {
            const [result] = await pool.query(
                'DELETE FROM usuarios WHERE email = ?',
                [email]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    }
};

module.exports = { usuariosModel };