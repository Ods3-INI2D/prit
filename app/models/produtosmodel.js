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
            console.error('findAll erro:', erro);
            return [];
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
            console.error('findById erro:', erro);
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
            console.error('findByCategoria erro:', erro);
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
            console.error('findBySlugCategoria erro:', erro);
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
            conn.release();
            return result;
        } catch (erro) {
            await conn.rollback();
            conn.release();
            console.error('create produto erro:', erro);
            return erro;
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

            await conn.query('DELETE FROM produto_categorias WHERE id_produto = ?', [id]);
            for (const id_cat of ids_categorias) {
                await conn.query(
                    'INSERT IGNORE INTO produto_categorias (id_produto, id_categoria) VALUES (?, ?)',
                    [id, id_cat]
                );
            }

            await conn.commit();
            conn.release();
            return result;
        } catch (erro) {
            await conn.rollback();
            conn.release();
            console.error('update produto erro:', erro);
            return erro;
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
            console.error('delete produto erro:', erro);
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
            console.error('addAvaliacao erro:', erro);
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
            console.error('findAllCategorias erro:', erro);
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

    // ── Criar categoria — versão corrigida e robusta ──────────────
    createCategoria: async (nome) => {
        try {
            // 1. Gera slug base normalizado
            const slugBase = nome
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');

            // 2. Garante slug único sem loop infinito (máx 100 tentativas)
            let slug = slugBase;
            let sufixo = 1;
            let tentativas = 0;

            while (tentativas < 100) {
                const [existe] = await pool.query(
                    'SELECT id_categoria FROM categorias WHERE slug = ?',
                    [slug]
                );
                if (existe.length === 0) break;
                slug = slugBase + '-' + sufixo;
                sufixo++;
                tentativas++;
            }

            // 3. Insere a categoria — usa INSERT IGNORE para evitar erro de duplicata no nome
            const [result] = await pool.query(
                'INSERT INTO categorias (nome, slug) VALUES (?, ?)',
                [nome, slug]
            );

            // 4. Verifica se realmente inseriu
            if (!result || result.affectedRows === 0) {
                return { erro: true, mensagem: 'Categoria já existe ou não foi possível criar.' };
            }

            return { insertId: result.insertId, slug, affectedRows: result.affectedRows };
        } catch (erro) {
            console.error('createCategoria erro:', erro);
            // Retorna objeto estruturado para facilitar verificação no router
            return { errno: erro.errno || 1, mensagem: erro.message, erro: true };
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
            console.error('deleteCategoria erro:', erro);
            return erro;
        }
    },

    // ── Busca por palavra-chave ───────────────────────────────────────────────
    search: async (termo) => {
        try {
            const termoBusca = '%' + termo + '%';
            const [linhas] = await pool.query(
                `SELECT p.*,
                        GROUP_CONCAT(c.nome ORDER BY c.nome SEPARATOR ', ') AS categoria,
                        GROUP_CONCAT(c.id_categoria ORDER BY c.nome SEPARATOR ',') AS ids_categorias
                 FROM produtos p
                 LEFT JOIN produto_categorias pc ON pc.id_produto = p.id_produto
                 LEFT JOIN categorias c ON c.id_categoria = pc.id_categoria
                 WHERE p.nome LIKE ?
                    OR p.descricao LIKE ?
                    OR c.nome LIKE ?
                 GROUP BY p.id_produto
                 ORDER BY
                   CASE WHEN p.nome LIKE ? THEN 0 ELSE 1 END,
                   p.id_produto DESC`,
                [termoBusca, termoBusca, termoBusca, termoBusca]
            );
            return linhas;
        } catch (erro) {
            console.error('search erro:', erro);
            return [];
        }
    },
};

module.exports = { produtosModel };