const pool = require('../config/pool_conexoes');

const produtosModel = {

    // ── Total de registros (paginação) ───────────────────────────
    totRegistros: async () => {
        try {
            const [result] = await pool.query(
                'SELECT COUNT(*) AS total FROM produtos'
            );
            return result[0].total;
        } catch (erro) {
            return 0;
        }
    },

    // ── Lista paginada com categorias ────────────────────────────
    findAll: async (offset = null, qtde = null) => {
        try {
            let linhas;
            if (offset === null && qtde === null) {
                [linhas] = await pool.query(
                    `SELECT p.*,
                            GROUP_CONCAT(c.nome ORDER BY c.nome SEPARATOR ', ') AS categoria,
                            GROUP_CONCAT(c.id_categoria ORDER BY c.nome SEPARATOR ',') AS ids_categorias
                     FROM produtos p
                     LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     LEFT JOIN categorias c ON c.id_categoria = pc.id_categoria
                     GROUP BY p.id_produto
                     ORDER BY p.id_produto DESC`
                );
            } else {
                [linhas] = await pool.query(
                    `SELECT p.*,
                            GROUP_CONCAT(c.nome ORDER BY c.nome SEPARATOR ', ') AS categoria,
                            GROUP_CONCAT(c.id_categoria ORDER BY c.nome SEPARATOR ',') AS ids_categorias
                     FROM produtos p
                     LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     LEFT JOIN categorias c ON c.id_categoria = pc.id_categoria
                     GROUP BY p.id_produto
                     ORDER BY p.id_produto DESC
                     LIMIT ?, ?`,
                    [offset, qtde]
                );
            }
            return linhas;
        } catch (erro) {
            return erro;
        }
    },

    // ── Busca por id ─────────────────────────────────────────────
    findById: async (id) => {
        try {
            const [linhas] = await pool.query(
                `SELECT p.*,
                        GROUP_CONCAT(c.nome ORDER BY c.nome SEPARATOR ', ') AS categoria,
                        GROUP_CONCAT(c.id_categoria ORDER BY c.nome SEPARATOR ',') AS ids_categorias,
                        GROUP_CONCAT(c.slug ORDER BY c.nome SEPARATOR ',') AS slugs_categorias
                 FROM produtos p
                 LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                 LEFT JOIN categorias c ON c.id_categoria = pc.id_categoria
                 WHERE p.id_produto = ?
                 GROUP BY p.id_produto`,
                [id]
            );
            if (!linhas[0]) return null;
            const produto = linhas[0];
            const [avals] = await pool.query(
                'SELECT * FROM avaliacoes WHERE id_produto = ? ORDER BY criado_em DESC',
                [id]
            );
            produto.avaliacoes = avals;
            produto.lista_categorias = produto.categoria ? produto.categoria.split(', ') : [];
            return produto;
        } catch (erro) {
            return null;
        }
    },

    // ── Busca por categoria (pelo nome) ──────────────────────────
    findByCategoria: async (nomeCategoria) => {
        try {
            let linhas;
            if (nomeCategoria.toLowerCase() === 'geral') {
                [linhas] = await pool.query(
                    `SELECT p.*,
                            GROUP_CONCAT(c2.nome ORDER BY c2.nome SEPARATOR ', ') AS categoria
                     FROM produtos p
                     JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     JOIN categorias c ON c.id_categoria = pc.id_categoria
                     LEFT JOIN produto_categorias pc2 ON pc2.id_produto = p.id_produto
                     LEFT JOIN categorias c2 ON c2.id_categoria = pc2.id_categoria
                     WHERE c.nome IN ('Cuidados com a Pele','Higiene Bucal','Cabelo')
                     GROUP BY p.id_produto
                     ORDER BY p.id_produto DESC`
                );
            } else {
                [linhas] = await pool.query(
                    `SELECT p.*,
                            GROUP_CONCAT(c2.nome ORDER BY c2.nome SEPARATOR ', ') AS categoria
                     FROM produtos p
                     JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                     JOIN categorias c ON c.id_categoria = pc.id_categoria
                     LEFT JOIN produto_categorias pc2 ON pc2.id_produto = p.id_produto
                     LEFT JOIN categorias c2 ON c2.id_categoria = pc2.id_categoria
                     WHERE c.nome = ?
                     GROUP BY p.id_produto
                     ORDER BY p.id_produto DESC`,
                    [nomeCategoria]
                );
            }
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    // ── Busca por slug da categoria ──────────────────────────────
    findBySlugCategoria: async (slug) => {
        try {
            const [linhas] = await pool.query(
                `SELECT p.*,
                        GROUP_CONCAT(c2.nome ORDER BY c2.nome SEPARATOR ', ') AS categoria
                 FROM produtos p
                 JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                 JOIN categorias c ON c.id_categoria = pc.id_categoria
                 LEFT JOIN produto_categorias pc2 ON pc2.id_produto = p.id_produto
                 LEFT JOIN categorias c2 ON c2.id_categoria = pc2.id_categoria
                 WHERE c.slug = ?
                 GROUP BY p.id_produto
                 ORDER BY p.id_produto DESC`,
                [slug]
            );
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    // ── Cadastro (admin) ─────────────────────────────────────────
    create: async (dados, ids_categorias = []) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [result] = await conn.query(
                `INSERT INTO produtos (nome, descricao, preco, preco_desconto, imagem, status)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem || '/imagens/foto.jpg',
                    dados.status || 'em-estoque'
                ]
            );
            const id_produto = result.insertId;
            for (const id_cat of ids_categorias) {
                await conn.query(
                    'INSERT IGNORE INTO produto_categorias (id_produto, id_categoria) VALUES (?, ?)',
                    [id_produto, id_cat]
                );
            }
            await conn.commit();
            return result;
        } catch (erro) {
            await conn.rollback();
            return erro;
        } finally {
            conn.release();
        }
    },

    // ── Atualização (admin) ───────────────────────────────────────
    update: async (id, dados, ids_categorias = []) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [result] = await conn.query(
                `UPDATE produtos SET
                    nome = ?, descricao = ?, preco = ?, preco_desconto = ?,
                    imagem = ?, status = ?
                 WHERE id_produto = ?`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem,
                    dados.status || 'em-estoque',
                    id
                ]
            );
            // Remove categorias antigas e insere as novas
            await conn.query('DELETE FROM produto_categorias WHERE id_produto = ?', [id]);
            for (const id_cat of ids_categorias) {
                await conn.query(
                    'INSERT IGNORE INTO produto_categorias (id_produto, id_categoria) VALUES (?, ?)',
                    [id, id_cat]
                );
            }
            await conn.commit();
            return result;
        } catch (erro) {
            await conn.rollback();
            return erro;
        } finally {
            conn.release();
        }
    },

    // ── Exclusão física (admin) ───────────────────────────────────
    delete: async (id) => {
        try {
            const [result] = await pool.query(
                'DELETE FROM produtos WHERE id_produto = ?',
                [id]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // ── Avaliações ────────────────────────────────────────────────
    addAvaliacao: async (id_produto, id_usuario, nota, texto) => {
        try {
            const [result] = await pool.query(
                'INSERT INTO avaliacoes (id_produto, id_usuario, nota, texto) VALUES (?, ?, ?, ?)',
                [id_produto, id_usuario, nota, texto]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    deleteAvaliacao: async (id_avaliacao) => {
        try {
            const [result] = await pool.query(
                'DELETE FROM avaliacoes WHERE id_avaliacao = ?',
                [id_avaliacao]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // ── Categorias ────────────────────────────────────────────────
    findAllCategorias: async () => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM categorias ORDER BY nome'
            );
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    findCategoriaPorNome: async (nome) => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM categorias WHERE nome = ?',
                [nome]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    findCategoriaPorId: async (id) => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM categorias WHERE id_categoria = ?',
                [id]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    findCategoriaPorSlug: async (slug) => {
        try {
            const [linhas] = await pool.query(
                'SELECT * FROM categorias WHERE slug = ?',
                [slug]
            );
            return linhas[0] || null;
        } catch (erro) {
            return null;
        }
    },

    createCategoria: async (nome) => {
        try {
            // Gera slug a partir do nome
            const slug = nome
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-');
            const [result] = await pool.query(
                'INSERT INTO categorias (nome, slug) VALUES (?, ?)',
                [nome, slug]
            );
            return { ...result, slug };
        } catch (erro) {
            return erro;
        }
    },

    deleteCategoria: async (id) => {
        try {
            const [result] = await pool.query(
                'DELETE FROM categorias WHERE id_categoria = ?',
                [id]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    }
};

module.exports = { produtosModel };