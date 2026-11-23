const pool = require('../config/pool_conexoes');
const mockStore = require('../config/mock_store');

const produtosModel = {

    // total de registros
    totRegistros: async () => {
        if (pool.isMock) return mockStore.produtos.length;
        try {
            const [result] = await pool.query(
                'SELECT COUNT(*) AS total FROM produtos'
            );
            return result[0].total;
        } catch (erro) {
            return 0;
        }
    },

    // lista com categorias
    findAll: async (offset = null, qtde = null) => {
        if (pool.isMock) {
            const ordenados = mockStore.produtos
                .slice()
                .sort((a, b) => b.id_produto - a.id_produto)
                .map(mockStore.formatarProduto);
            if (offset !== null && qtde !== null) {
                return ordenados.slice(Number(offset), Number(offset) + Number(qtde));
            }
            return ordenados;
        }
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

    // busca por id
    findById: async (id) => {
        if (pool.isMock) {
            const prod = mockStore.produtos.find(p => p.id_produto === Number(id));
            if (!prod) return null;
            const formatado = mockStore.formatarProduto(prod);
            const avals = mockStore.avaliacoes
                .filter(a => a.id_produto === Number(id))
                .slice()
                .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
            formatado.avaliacoes = avals;
            formatado.lista_categorias = formatado.categoria ? formatado.categoria.split(', ') : [];
            return formatado;
        }
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

    // busca por categoria
    findByCategoria: async (nomeCategoria) => {
        if (pool.isMock) {
            const alvo = String(nomeCategoria || '').toLowerCase();
            const geralSet = new Set(['cuidados com a pele', 'higiene bucal', 'cabelo']);
            return mockStore.produtos
                .slice()
                .sort((a, b) => b.id_produto - a.id_produto)
                .map(mockStore.formatarProduto)
                .filter(p => {
                    const nomes = (p.categoria || '').split(', ').map(s => s.trim().toLowerCase());
                    if (alvo === 'geral') {
                        return nomes.some(n => geralSet.has(n));
                    }
                    return nomes.includes(alvo);
                });
        }
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

    // busca por slug da categoria
    findBySlugCategoria: async (slug) => {
        if (pool.isMock) {
            return mockStore.produtos
                .slice()
                .sort((a, b) => b.id_produto - a.id_produto)
                .map(mockStore.formatarProduto)
                .filter(p => {
                    const slugs = (p.slugs_categorias || '').split(',').map(s => s.trim());
                    return slugs.includes(slug);
                });
        }
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

    // cadastro admin
    create: async (dados, ids_categorias = []) => {
        if (pool.isMock) {
            const id_produto = mockStore.seq.produto++;
            mockStore.produtos.push({
                id_produto,
                nome: dados.nome,
                descricao: dados.descricao || '',
                preco: Number(dados.preco) || 0,
                preco_desconto: dados.preco_desconto ? Number(dados.preco_desconto) : null,
                imagem: dados.imagem || '/imagens/foto.svg',
                status: dados.status || 'em-estoque',
                faixa_etaria: dados.faixa_etaria || null,
                sexo: dados.sexo || null,
                ids_categorias: ids_categorias.map(Number),
                criado_em: new Date()
            });
            return { insertId: id_produto, affectedRows: 1 };
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.query(
                `INSERT INTO produtos (nome, descricao, preco, preco_desconto, imagem, status, faixa_etaria, sexo)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem || '/imagens/foto.jpg',
                    dados.status || 'em-estoque',
                    dados.faixa_etaria || null,
                    dados.sexo || null
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

    // atualizaçao admin
    update: async (id, dados, ids_categorias = []) => {
        if (pool.isMock) {
            const idx = mockStore.produtos.findIndex(p => p.id_produto === Number(id));
            if (idx === -1) return { affectedRows: 0 };
            const atual = mockStore.produtos[idx];
            mockStore.produtos[idx] = {
                ...atual,
                nome: dados.nome,
                descricao: dados.descricao || '',
                preco: Number(dados.preco) || 0,
                preco_desconto: dados.preco_desconto ? Number(dados.preco_desconto) : null,
                imagem: dados.imagem || atual.imagem,
                status: dados.status || 'em-estoque',
                faixa_etaria: dados.faixa_etaria || null,
                sexo: dados.sexo || null,
                ids_categorias: ids_categorias.map(Number)
            };
            return { affectedRows: 1 };
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [result] = await conn.query(
                `UPDATE produtos SET
                    nome = ?, descricao = ?, preco = ?, preco_desconto = ?,
                    imagem = ?, status = ?, faixa_etaria = ?, sexo = ?
                 WHERE id_produto = ?`,
                [
                    dados.nome,
                    dados.descricao || '',
                    dados.preco || 0,
                    dados.preco_desconto || null,
                    dados.imagem,
                    dados.status || 'em-estoque',
                    dados.faixa_etaria || null,
                    dados.sexo || null,
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

    // exclusao fisica admin
    delete: async (id) => {
        if (pool.isMock) {
            const idx = mockStore.produtos.findIndex(p => p.id_produto === Number(id));
            if (idx === -1) return { affectedRows: 0 };
            mockStore.produtos.splice(idx, 1);
            return { affectedRows: 1 };
        }
        try {
            await pool.query('DELETE FROM itens_pedido WHERE id_produto = ?', [id]);
            await pool.query('DELETE FROM carrinho WHERE id_produto = ?', [id]);
            const [result] = await pool.query('DELETE FROM produtos WHERE id_produto = ?', [id]);
            return result;
        } catch (erro) {
            console.error('delete produto erro:', erro);
            return erro;
        }
    },

    // avaliaçoes
    addAvaliacao: async (id_produto, id_usuario, nota, texto) => {
        if (pool.isMock) {
            const id_avaliacao = mockStore.seq.avaliacao++;
            mockStore.avaliacoes.push({
                id_avaliacao,
                id_produto: Number(id_produto),
                id_usuario: Number(id_usuario),
                nota: Number(nota),
                texto: texto || '',
                criado_em: new Date()
            });
            return { insertId: id_avaliacao, affectedRows: 1 };
        }
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
        if (pool.isMock) {
            const idx = mockStore.avaliacoes.findIndex(a => a.id_avaliacao === Number(id_avaliacao));
            if (idx !== -1) mockStore.avaliacoes.splice(idx, 1);
            return { affectedRows: idx !== -1 ? 1 : 0 };
        }
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

    // categorias
    findAllCategorias: async () => {
        if (pool.isMock) {
            return mockStore.categorias.slice().sort((a, b) => a.nome.localeCompare(b.nome));
        }
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
        if (pool.isMock) {
            return mockStore.categorias.find(c => c.nome.toLowerCase() === String(nome || '').toLowerCase()) || null;
        }
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
        if (pool.isMock) {
            return mockStore.categorias.find(c => c.id_categoria === Number(id)) || null;
        }
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
        if (pool.isMock) {
            return mockStore.categorias.find(c => c.slug === slug) || null;
        }
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

    // criar categoria
    createCategoria: async (nome, faixaEtaria = null, sexo = null) => {
        if (pool.isMock) {
            const slugBase = mockStore.slugify(nome);
            let slug = slugBase;
            let sufixo = 1;
            while (mockStore.categorias.some(c => c.slug === slug)) {
                slug = slugBase + '-' + sufixo++;
            }
            const id_categoria = mockStore.seq.categoria++;
            mockStore.categorias.push({
                id_categoria,
                nome,
                slug,
                faixa_etaria: faixaEtaria || null,
                sexo: sexo || null
            });
            return { insertId: id_categoria, slug, affectedRows: 1 };
        }
        try {
            const slugBase = nome
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-');
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
            const [result] = await pool.query(
                'INSERT INTO categorias (nome, slug, faixa_etaria, sexo) VALUES (?, ?, ?, ?)',
                [nome, slug, faixaEtaria || null, sexo || null]
            );
            if (!result || result.affectedRows === 0) {
                return { erro: true, mensagem: 'Categoria já existe ou não foi possível criar.' };
            }

            return { insertId: result.insertId, slug, affectedRows: result.affectedRows };
        } catch (erro) {
            console.error('createCategoria erro:', erro);
            return { errno: erro.errno || 1, mensagem: erro.message, erro: true };
        }
    },

    deleteCategoria: async (id) => {
        if (pool.isMock) {
            const idNum = Number(id);
            mockStore.produtos.forEach(p => {
                p.ids_categorias = (p.ids_categorias || []).filter(cid => cid !== idNum);
            });
            const idx = mockStore.categorias.findIndex(c => c.id_categoria === idNum);
            if (idx !== -1) mockStore.categorias.splice(idx, 1);
            return { affectedRows: idx !== -1 ? 1 : 0 };
        }
        try {
            await pool.query('DELETE FROM produto_categorias WHERE id_categoria = ?', [id]);
            const [result] = await pool.query('DELETE FROM categorias WHERE id_categoria = ?', [id]);
            return result;
        } catch (erro) {
            console.error('deleteCategoria erro:', erro);
            return erro;
        }
    },

    updateCategoria: async (id, faixa_etaria, sexo) => {
        if (pool.isMock) {
            const cat = mockStore.categorias.find(c => c.id_categoria === Number(id));
            if (!cat) return { affectedRows: 0 };
            cat.faixa_etaria = faixa_etaria || null;
            cat.sexo = sexo || null;
            return { affectedRows: 1 };
        }
        try {
            const [result] = await pool.query(
                'UPDATE categorias SET faixa_etaria = ?, sexo = ? WHERE id_categoria = ?',
                [faixa_etaria || null, sexo || null, id]
            );
            return result;
        } catch (erro) {
            console.error('updateCategoria erro:', erro);
            return erro;
        }
    },

    // busca por palavra chave
    search: async (termo) => {
        if (pool.isMock) {
            const q = String(termo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return mockStore.produtos
                .map(mockStore.formatarProduto)
                .filter(p => norm(p.nome).includes(q) || norm(p.descricao).includes(q) || norm(p.categoria).includes(q))
                .sort((a, b) => {
                    const aNome = norm(a.nome).includes(q) ? 0 : 1;
                    const bNome = norm(b.nome).includes(q) ? 0 : 1;
                    return aNome - bNome || b.id_produto - a.id_produto;
                });
        }
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
    }
};

module.exports = { produtosModel };