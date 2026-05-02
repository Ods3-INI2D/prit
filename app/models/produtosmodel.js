const pool = require('../../config/pool_conexoes');

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

    // ── Lista paginada ───────────────────────────────────────────
    findAll: async (offset = null, qtde = null) => {
        try {
            if (offset === null && qtde === null) {
                const [linhas] = await pool.query(
                    `SELECT p.*, c.nome AS categoria
                     FROM produtos p
                     JOIN categorias c ON c.id_categoria = p.id_categoria
                     ORDER BY p.id_produto DESC`
                );
                return linhas;
            }
            const [linhas] = await pool.query(
                `SELECT p.*, c.nome AS categoria
                 FROM produtos p
                 JOIN categorias c ON c.id_categoria = p.id_categoria
                 ORDER BY p.id_produto DESC
                 LIMIT ?, ?`,
                [offset, qtde]
            );
            return linhas;
        } catch (erro) {
            return erro;
        }
    },

    // ── Busca por id ─────────────────────────────────────────────
    findById: async (id) => {
        try {
            const [linhas] = await pool.query(
                `SELECT p.*, c.nome AS categoria
                 FROM produtos p
                 JOIN categorias c ON c.id_categoria = p.id_categoria
                 WHERE p.id_produto = ?`,
                [id]
            );
            if (!linhas[0]) return null;
            // Busca avaliações do produto
            const produto = linhas[0];
            const [avals] = await pool.query(
                'SELECT * FROM avaliacoes WHERE id_produto = ? ORDER BY criado_em DESC',
                [id]
            );
            produto.avaliacoes = avals;
            return produto;
        } catch (erro) {
            return null;
        }
    },

    // ── Busca por categoria ──────────────────────────────────────
    findByCategoria: async (nomeCategoria) => {
        try {
            let linhas;
            if (nomeCategoria.toLowerCase() === 'geral') {
                [linhas] = await pool.query(
                    `SELECT p.*, c.nome AS categoria
                     FROM produtos p
                     JOIN categorias c ON c.id_categoria = p.id_categoria
                     WHERE c.nome IN ('Cuidados com a Pele','Higiene Bucal','Cabelo')
                     ORDER BY p.id_produto DESC`
                );
            } else {
                [linhas] = await pool.query(
                    `SELECT p.*, c.nome AS categoria
                     FROM produtos p
                     JOIN categorias c ON c.id_categoria = p.id_categoria
                     WHERE c.nome = ?
                     ORDER BY p.id_produto DESC`,
                    [nomeCategoria]
                );
            }
            return linhas;
        } catch (erro) {
            return [];
        }
    },

    // ── Cadastro (admin) ─────────────────────────────────────────
    create: async (dados) => {
        /*
            dados: { nome, descricao, preco, preco_desconto, imagem, status, id_categoria }
        */
        try {
            const [result] = await pool.query(
                `INSERT INTO produtos
                    (nome, descricao, preco, preco_desconto, imagem, status, id_categoria)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem || '/imagens/foto.jpg',
                    dados.status || 'em-estoque',
                    dados.id_categoria
                ]
            );
            return result;
        } catch (erro) {
            return erro;
        }
    },

    // ── Atualização (admin) ───────────────────────────────────────
    update: async (id, dados) => {
        try {
            const [result] = await pool.query(
                `UPDATE produtos SET
                    nome = ?, descricao = ?, preco = ?, preco_desconto = ?,
                    imagem = ?, status = ?, id_categoria = ?
                 WHERE id_produto = ?`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem,
                    dados.status || 'em-estoque',
                    dados.id_categoria,
                    id
                ]
            );
            return result;
        } catch (erro) {
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
    }
};

module.exports = { produtosModel };