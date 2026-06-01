const pool = require('../config/pool_conexoes');
const { hashSenha } = require('../helpers/auth');

const usuariosModel = {

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

    create: async (dados) => {
        /*
            dados: { nome, nasc, cpf, ddd, tel, email, senhan, sexo }
        */
        try {
            const senhaHasheada = await hashSenha(dados.senhan);
            
            const [result] = await pool.query(
                'INSERT INTO usuarios (nome, nasc, cpf, ddd, tel, email, senhan, sexo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [dados.nome, dados.nasc, dados.cpf, dados.ddd, dados.tel, dados.email, senhaHasheada, dados.sexo || null]
            );
            return result;
        } catch (erro) {
            console.error('Erro ao criar usuário:', erro);
            return erro;
        }
    },

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
            'SELECT id_usuario FROM usuarios WHERE email = ?', [email]
            );
            if (usuario[0]) {
                const id = usuario[0].id_usuario;
                await pool.query('DELETE FROM carrinho WHERE id_usuario = ?', [id]);
                const [pedidos] = await pool.query('SELECT id_pedido FROM pedidos WHERE id_usuario = ?', [id]);
                for (const p of pedidos) {
                    const [pags] = await pool.query('SELECT id_pagamento FROM pagamentos WHERE id_pedido = ?', [p.id_pedido]);
                    for (const pag of pags) {
                        await pool.query('DELETE FROM entregas WHERE id_pagamento = ?', [pag.id_pagamento]);
                    }
                    await pool.query('DELETE FROM pagamentos WHERE id_pedido = ?', [p.id_pedido]);
                    await pool.query('DELETE FROM itens_pedido WHERE id_pedido = ?', [p.id_pedido]);
                }
                await pool.query('DELETE FROM pedidos WHERE id_usuario = ?', [id]);
                await pool.query('DELETE FROM avaliacoes WHERE id_usuario = ?', [id]);
            }
            const [result] = await pool.query('DELETE FROM usuarios WHERE email = ?', [email]);
            return result;
        } catch (erro) {
            return erro;
        }
    }
};

module.exports = { usuariosModel };
