const pool = require('../config/pool_conexoes');
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
            colunasAtivacao = null; // permite nova tentativa
            console.error('[ativacao] Não foi possível criar as colunas automaticamente. ' +
                'Execute app/config/ativacao/ativacao_migrations.sql no banco.', erro.message);
            throw erro;
        });
    }
    return colunasAtivacao;
};

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
 
            // a conta nasce inativa (ativo = 0) até o e-mail ser confirmado
            const inserir = () => pool.query(
                'INSERT INTO usuarios (nome, nasc, cpf, ddd, tel, email, senhan, sexo, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
                [dados.nome, dados.nasc, dados.cpf, dados.ddd, dados.tel, dados.email, senhaHasheada, dados.sexo || null]
            );
 
            let result;
            try {
                [result] = await inserir();
            } catch (erro) {
                // banco ainda sem a coluna "ativo": cria as colunas de ativação e tenta de novo
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

    // dados mínimos para o fluxo de ativação (inclui o status da conta)
    findParaAtivacao: async (id) => {
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
 
    // ativa a conta; retorna true somente se ela estava inativa e foi ativada agora
    ativarConta: async (id) => {
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

    findParaAtivacao: async (id) => {
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
 
    // ativa a conta; retorna true somente se ela estava inativa e foi ativada agora
    ativarConta: async (id) => {
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

    // >>> RECUPERAR SENHA (início) ---------------------------------------
    // usuário completo (inclui o hash da senha) para validar o link de recuperação
    findParaRecuperacao: async (id) => {
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

    // grava a nova senha somente se o hash atual ainda for o mesmo do momento em que o
    // link foi validado. Isso garante que o link funcione uma única vez, mesmo com dois
    // envios simultâneos. Retorna true se a senha foi trocada.
    redefinirSenha: async (id, hashSenhaAtual, novaSenha) => {
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
    // <<< RECUPERAR SENHA (fim) ------------------------------------------

    updateCampo: async (email, campo, valor) => {
        const camposPermitidos = ['nome', 'nasc', 'cpf', 'ddd', 'tel', 'sexo', 'foto_perfil'];
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