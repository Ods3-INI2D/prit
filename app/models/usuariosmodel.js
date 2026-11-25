const pool = require('../config/pool_conexoes');
const mockStore = require('../config/mock_store');
const { hashSenha } = require('../helpers/auth');

let colunasAtivacao = null;
function garantirColunasAtivacao() {
    if (!colunasAtivacao) {
        const adicionar = async (ddl) => {
            try {
                await pool.query(ddl);
            } catch (erro) {
                if (erro.code !== 'ER_DUP_FIELDNAME') throw erro;
            }
        };
        colunasAtivacao = (async () => {
            await adicionar('ALTER TABLE usuarios ADD COLUMN ativo TINYINT(1) NOT NULL DEFAULT 1');
            await adicionar('ALTER TABLE usuarios ADD COLUMN ativado_em DATETIME NULL DEFAULT NULL');
            console.log('[ativacao] Colunas ativo/ativado_em criadas em usuarios.');
        })().catch((erro) => {
            colunasAtivacao = null;
            console.error('[ativacao] Não foi possível criar as colunas automaticamente. ' +
                'Execute app/config/ativacao/ativacao_migrations.sql no banco.', erro.message);
            throw erro;
        });
    }
    return colunasAtivacao;
}

const usuariosModel = {

    findAll: async () => {
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            return mockStore.usuarios.map(({ senhan, ...u }) => u);
        }
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
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            return mockStore.usuarios.find(u => u.email.toLowerCase() === String(email || '').toLowerCase()) || null;
        }
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
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            const u = mockStore.usuarios.find(user => user.id_usuario === Number(id));
            if (!u) return null;
            const { senhan, ...resto } = u;
            return resto;
        }
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
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            if (mockStore.usuarios.some(u => u.email.toLowerCase() === String(dados.email).toLowerCase())) {
                return { code: 'ER_DUP_ENTRY', sqlMessage: 'Duplicate entry for email' };
            }
            if (mockStore.usuarios.some(u => u.cpf === dados.cpf)) {
                return { code: 'ER_DUP_ENTRY', sqlMessage: 'Duplicate entry for cpf' };
            }
            const senhaHasheada = await hashSenha(dados.senhan);
            const id_usuario = mockStore.seq.usuario++;
            // No modo em memória sem SMTP configurado, já ativa para permitir teste imediato se desejado, ou respeita ativação
            const emailConfigurado = Boolean(process.env.RESEND_API_KEY || ((process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS)));
            mockStore.usuarios.push({
                id_usuario,
                nome: dados.nome,
                nasc: dados.nasc,
                cpf: dados.cpf,
                ddd: dados.ddd,
                tel: dados.tel,
                email: dados.email,
                senhan: senhaHasheada,
                sexo: dados.sexo || null,
                ativo: emailConfigurado ? 0 : 1,
                ativado_em: emailConfigurado ? null : new Date(),
                criado_em: new Date()
            });
            return { insertId: id_usuario, affectedRows: 1 };
        }
        try {
            const senhaHasheada = await hashSenha(dados.senhan);
            const inserir = () => pool.query(
                'INSERT INTO usuarios (nome, nasc, cpf, ddd, tel, email, senhan, sexo, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
                [dados.nome, dados.nasc, dados.cpf, dados.ddd, dados.tel, dados.email, senhaHasheada, dados.sexo || null]
            );

            let result;
            try {
                [result] = await inserir();
            } catch (erro) {
                if (erro.code === 'ER_BAD_FIELD_ERROR' && /ativo/.test(erro.sqlMessage || '')) {
                    await garantirColunasAtivacao();
                    [result] = await inserir();
                } else {
                    throw erro;
                }
            }
            return result;
        } catch (erro) {
            console.error('Erro ao criar usuário:', erro);
            return erro;
        }
    },

    findParaAtivacao: async (id) => {
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            const u = mockStore.usuarios.find(user => user.id_usuario === Number(id));
            return u ? { id_usuario: u.id_usuario, nome: u.nome, email: u.email, ativo: u.ativo } : null;
        }
        try {
            const [linhas] = await pool.query(
                'SELECT id_usuario, nome, email, ativo FROM usuarios WHERE id_usuario = ?',
                [id]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    findParaAtivacaoPorEmail: async (email) => {
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            const u = mockStore.usuarios.find(user => user.email.toLowerCase() === String(email || '').toLowerCase());
            return u ? { id_usuario: u.id_usuario, nome: u.nome, email: u.email, ativo: u.ativo } : null;
        }
        try {
            const [linhas] = await pool.query(
                'SELECT id_usuario, nome, email, ativo FROM usuarios WHERE email = ?',
                [email]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    ativarConta: async (id) => {
        if (pool.isMock) {
            const u = mockStore.usuarios.find(user => user.id_usuario === Number(id) && Number(user.ativo) === 0);
            if (!u) return false;
            u.ativo = 1;
            u.ativado_em = new Date();
            return true;
        }
        try {
            const [result] = await pool.query(
                'UPDATE usuarios SET ativo = 1, ativado_em = NOW() WHERE id_usuario = ? AND ativo = 0',
                [id]
            );
            return result.affectedRows === 1;
        } catch (erro) {
            console.error('Erro ao ativar conta:', erro);
            return false;
        }
    },

    findParaRecuperacao: async (id) => {
        if (pool.isMock) {
            await mockStore.garantirUsuarioDemo();
            return mockStore.usuarios.find(user => user.id_usuario === Number(id)) || null;
        }
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM usuarios WHERE id_usuario = ?',
                [id]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    redefinirSenha: async (id, hashSenhaAtual, novaSenha) => {
        if (pool.isMock) {
            const u = mockStore.usuarios.find(user => user.id_usuario === Number(id) && user.senhan === hashSenhaAtual);
            if (!u) return false;
            u.senhan = await hashSenha(novaSenha);
            return true;
        }
        try {
            const novoHash = await hashSenha(novaSenha);
            const [result] = await pool.query(
                'UPDATE usuarios SET senhan = ? WHERE id_usuario = ? AND senhan = ?',
                [novoHash, id, hashSenhaAtual]
            );
            return result.affectedRows === 1;
        } catch (erro) {
            console.error('Erro ao redefinir senha:', erro);
            return false;
        }
    },

    updateCampo: async (email, campo, valor) => {
        const camposPermitidos = ['tel'];
        if (!camposPermitidos.includes(campo)) return null;
        if (pool.isMock) {
            const u = mockStore.usuarios.find(user => user.email.toLowerCase() === String(email || '').toLowerCase());
            if (!u) return { affectedRows: 0 };
            u[campo] = valor;
            return { affectedRows: 1 };
        }
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

    delete: async (email) => {
        if (pool.isMock) {
            const idx = mockStore.usuarios.findIndex(user => user.email.toLowerCase() === String(email || '').toLowerCase());
            if (idx !== -1) mockStore.usuarios.splice(idx, 1);
            return { affectedRows: idx !== -1 ? 1 : 0 };
        }
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