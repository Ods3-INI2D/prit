const pool = require('../config/pool_conexoes');

const pedidosModel = {

    // cria um pedido completo com itens
    create: async (id_usuario, itens, valor_total) => {
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [pedidoResult] = await conn.query(
                `INSERT INTO pedidos (id_usuario, valor_total, status)
                 VALUES (?, ?, 'pendente')`,
                [id_usuario, valor_total]
            );
            const id_pedido = pedidoResult.insertId;

            for (const item of itens) {
                const precoUnit = item.precoDesconto && item.precoDesconto > 0
                    ? item.precoDesconto
                    : item.preco;
                await conn.query(
                    `INSERT INTO itens_pedido (id_pedido, id_produto, qtd, preco_unit)
                     VALUES (?, ?, ?, ?)`,
                    [id_pedido, item.id_produto, item.quantidade, precoUnit]
                );
            }

            await conn.commit();
            conn.release();
            return { id_pedido };
        } catch (erro) {
            await conn.rollback();
            conn.release();
            console.error('create pedido erro:', erro);
            return { erro: true };
        }
    },

    // cria registro de pagamento
    createPagamento: async (id_pedido, forma, valor) => {
        try {
            const [result] = await pool.query(
                `INSERT INTO pagamentos (id_pedido, forma, valor, status)
                 VALUES (?, ?, ?, 'pendente')`,
                [id_pedido, forma, valor]
            );
            return { id_pagamento: result.insertId };
        } catch (erro) {
            console.error('createPagamento erro:', erro);
            return { erro: true };
        }
    },

    // cria registro de entrega
    createEntrega: async (id_pagamento, transportadora) => {
        try {
            const [result] = await pool.query(
                `INSERT INTO entregas (id_pagamento, transportadora, status)
                 VALUES (?, ?, 'aguardando')`,
                [id_pagamento, transportadora]
            );
            return { id_entrega: result.insertId };
        } catch (erro) {
            console.error('createEntrega erro:', erro);
            return { erro: true };
        }
    },

    // busca pedidos de um usuário
    findByUsuario: async (id_usuario) => {
        try {
            const [linhas] = await pool.query(
                `SELECT p.*, 
                        COUNT(ip.id_item) AS total_itens
                 FROM pedidos p
                 LEFT JOIN itens_pedido ip ON ip.id_pedido = p.id_pedido
                 WHERE p.id_usuario = ?
                 GROUP BY p.id_pedido
                 ORDER BY p.criado_em DESC`,
                [id_usuario]
            );
            return linhas;
        } catch (erro) {
            console.error('findByUsuario erro:', erro);
            return [];
        }
    },

    // busca pedido por id com itens
    findById: async (id_pedido) => {
        try {
            const [pedidos] = await pool.query(
                'SELECT * FROM pedidos WHERE id_pedido = ?',
                [id_pedido]
            );
            if (!pedidos[0]) return null;

            const [itens] = await pool.query(
                `SELECT ip.*, pr.nome, pr.imagem
                 FROM itens_pedido ip
                 JOIN produtos pr ON pr.id_produto = ip.id_produto
                 WHERE ip.id_pedido = ?`,
                [id_pedido]
            );

            return { ...pedidos[0], itens };
        } catch (erro) {
            console.error('findById pedido erro:', erro);
            return null;
        }
    }
};

module.exports = { pedidosModel };
