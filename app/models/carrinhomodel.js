const pool = require('../config/pool_conexoes');

const carrinhoModel = {

    // ── Verifica se produto está no carrinho do identificador ─────
    temProduto: async (id_produto, id_usuario, session_id) => {
        try {
            let linhas;
            if (id_usuario) {
                [linhas] = await pool.query(
                    'SELECT id_carrinho FROM carrinho WHERE id_produto = ? AND id_usuario = ?',
                    [id_produto, id_usuario]
                );
            } else {
                [linhas] = await pool.query(
                    'SELECT id_carrinho FROM carrinho WHERE id_produto = ? AND session_id = ?',
                    [id_produto, session_id]
                );
            }
            return linhas.length > 0;
        } catch (erro) {
            return false;
        }
    },

    // ── Retorna itens do carrinho com dados do produto ────────────
    findByIdentificador: async (id_usuario, session_id) => {
        try {
            let linhas;
            if (id_usuario) {
                [linhas] = await pool.query(
                    `SELECT c.id_carrinho, c.quantidade, c.id_produto,
                            p.nome, p.imagem, p.preco, p.preco_desconto,
                            p.status,
                            GROUP_CONCAT(cat.nome ORDER BY cat.nome SEPARATOR ', ') AS categoria
                     FROM carrinho c
                     JOIN produtos p ON p.id_produto = c.id_produto
                     LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     LEFT JOIN categorias cat ON cat.id_categoria = pc.id_categoria
                     WHERE c.id_usuario = ?
                     GROUP BY c.id_carrinho, c.quantidade, c.id_produto,
                              p.nome, p.imagem, p.preco, p.preco_desconto, p.status`,
                    [id_usuario]
                );
            } else {
                [linhas] = await pool.query(
                    `SELECT c.id_carrinho, c.quantidade, c.id_produto,
                            p.nome, p.imagem, p.preco, p.preco_desconto,
                            p.status,
                            GROUP_CONCAT(cat.nome ORDER BY cat.nome SEPARATOR ', ') AS categoria
                     FROM carrinho c
                     JOIN produtos p ON p.id_produto = c.id_produto
                     LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     LEFT JOIN categorias cat ON cat.id_categoria = pc.id_categoria
                     WHERE c.session_id = ?
                     GROUP BY c.id_carrinho, c.quantidade, c.id_produto,
                              p.nome, p.imagem, p.preco, p.preco_desconto, p.status`,
                    [session_id]
                );
            }
            return linhas;
        } catch (erro) {
            console.error('findByIdentificador erro:', erro);
            return [];
        }
    },

    // ── Adiciona / incrementa quantidade ─────────────────────────
    addProduto: async (id_produto, id_usuario, session_id, qtd = 1) => {
        try {
            let existente;
            if (id_usuario) {
                const [rows] = await pool.query(
                    'SELECT id_carrinho, quantidade FROM carrinho WHERE id_produto = ? AND id_usuario = ?',
                    [id_produto, id_usuario]
                );
                existente = rows[0];
            } else {
                const [rows] = await pool.query(
                    'SELECT id_carrinho, quantidade FROM carrinho WHERE id_produto = ? AND session_id = ?',
                    [id_produto, session_id]
                );
                existente = rows[0];
            }

            if (existente) {
                const [result] = await pool.query(
                    'UPDATE carrinho SET quantidade = quantidade + ? WHERE id_carrinho = ?',
                    [qtd, existente.id_carrinho]
                );
                return result;
            }

            const [result] = await pool.query(
                'INSERT INTO carrinho (id_produto, id_usuario, session_id, quantidade) VALUES (?, ?, ?, ?)',
                [id_produto, id_usuario || null, id_usuario ? null : session_id, qtd]
            );
            return result;
        } catch (erro) {
            console.error('addProduto erro:', erro);
            return erro;
        }
    },

    // ── Atualiza quantidade ───────────────────────────────────────
    updateQuantidade: async (id_produto, id_usuario, session_id, novaQtd) => {
        try {
            if (novaQtd <= 0) {
                return await carrinhoModel.removerProduto(id_produto, id_usuario, session_id);
            }
            let result;
            if (id_usuario) {
                [result] = await pool.query(
                    'UPDATE carrinho SET quantidade = ? WHERE id_produto = ? AND id_usuario = ?',
                    [novaQtd, id_produto, id_usuario]
                );
            } else {
                [result] = await pool.query(
                    'UPDATE carrinho SET quantidade = ? WHERE id_produto = ? AND session_id = ?',
                    [novaQtd, id_produto, session_id]
                );
            }
            return result;
        } catch (erro) {
            console.error('updateQuantidade erro:', erro);
            return erro;
        }
    },

    // ── Remove produto ────────────────────────────────────────────
    removerProduto: async (id_produto, id_usuario, session_id) => {
        try {
            let result;
            if (id_usuario) {
                [result] = await pool.query(
                    'DELETE FROM carrinho WHERE id_produto = ? AND id_usuario = ?',
                    [id_produto, id_usuario]
                );
            } else {
                [result] = await pool.query(
                    'DELETE FROM carrinho WHERE id_produto = ? AND session_id = ?',
                    [id_produto, session_id]
                );
            }
            return result;
        } catch (erro) {
            console.error('removerProduto erro:', erro);
            return erro;
        }
    },

    // ── Migra carrinho anônimo → usuário logado ───────────────────
    migrarParaUsuario: async (session_id, id_usuario) => {
        try {
            const [itensAnonimos] = await pool.query(
                'SELECT * FROM carrinho WHERE session_id = ?',
                [session_id]
            );

            for (const item of itensAnonimos) {
                const [jaExiste] = await pool.query(
                    'SELECT id_carrinho, quantidade FROM carrinho WHERE id_produto = ? AND id_usuario = ?',
                    [item.id_produto, id_usuario]
                );
                if (jaExiste.length > 0) {
                    await pool.query(
                        'UPDATE carrinho SET quantidade = quantidade + ? WHERE id_carrinho = ?',
                        [item.quantidade, jaExiste[0].id_carrinho]
                    );
                    await pool.query('DELETE FROM carrinho WHERE id_carrinho = ?', [item.id_carrinho]);
                } else {
                    await pool.query(
                        'UPDATE carrinho SET id_usuario = ?, session_id = NULL WHERE id_carrinho = ?',
                        [id_usuario, item.id_carrinho]
                    );
                }
            }
            return true;
        } catch (erro) {
            console.error('migrarParaUsuario erro:', erro);
            return false;
        }
    },

    // ── Limpa carrinho por session_id ─────────────────────────────
    limparPorSession: async (session_id) => {
        try {
            await pool.query('DELETE FROM carrinho WHERE session_id = ?', [session_id]);
            return true;
        } catch (erro) {
            return false;
        }
    }
};

module.exports = { carrinhoModel };