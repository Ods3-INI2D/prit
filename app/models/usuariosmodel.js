const pool = require('../config/pool_conexoes');

const usuariosModel = {

    // busca todos os usuarios
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

    // busca por email
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

    // busca por id
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

    // cadastro
    create: async (dados) => {
        /*
            dados: { nome, nasc, cpf, ddd, tel, email, senhan }
        */
        try {
            const [result] = await pool.query(
                'INSERT INTO usuarios (nome, nasc, cpf, ddd, tel, email, senhan, sexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [dados.nome, dados.nasc, dados.cpf, dados.ddd, dados.tel, dados.email, dados.senhan, dados.sexo || null]

            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // atualiza um campo especifico 
    updateCampo: async (email, campo, valor) => {
        const camposPermitidos = ['nome', 'nasc', 'cpf', 'ddd', 'tel', 'sexo'];
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

    // remove usuario admin
    delete: async (email) => {
        try {
            const [usuario] = await pool.query(
                'SELECT id_usuario FROM usuarios WHERE email = ?',
                [email]
        );
        if (usuario[0]) {
            await pool.query(
                'DELETE FROM carrinho WHERE id_usuario = ?',
                [usuario[0].id_usuario]
            );
        }
        const [result] = await pool.query(
            'DELETE FROM usuarios WHERE email = ?',
            [email]
        );
        return result;
    }     catch (erro) {
            return erro;
        }
    }
};

module.exports = { usuariosModel };