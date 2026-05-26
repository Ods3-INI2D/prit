const pool = require('../config/pool_conexoes');

const pedidosModel = {

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

    createEntrega: async (id_pagamento, transportadora, endereco) => {
        try {
            const [result] = await pool.query(
                `INSERT INTO entregas (id_pagamento, transportadora, codigo_rastreio, status)
                 VALUES (?, ?, ?, 'aguardando')`,
                [id_pagamento, transportadora, endereco || null]
            );
            return { id_entrega: result.insertId };
        } catch (erro) {
            console.error('createEntrega erro:', erro);
            return { erro: true };
        }
    },

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
    },

    findByUsuarioComDetalhes: async (id_usuario) => {
        try {
            // 1. Busca apenas os pedidos do usuário
            const [pedidosRaw] = await pool.query(
                `SELECT id_pedido, id_usuario, data_pedido, valor_total, status, criado_em
                 FROM pedidos
                 WHERE id_usuario = ?
                 ORDER BY criado_em DESC`,
                [id_usuario]
            );

            if (!pedidosRaw || pedidosRaw.length === 0) return [];

            // 2. Busca dados do usuário separadamente
            const [usuarioRows] = await pool.query(
                `SELECT ddd, tel FROM usuarios WHERE id_usuario = ?`,
                [id_usuario]
            );
            const usuarioDados = usuarioRows[0] || {};

            // 3. Para cada pedido, busca pagamento, entrega e itens
            const pedidos = [];
            for (const p of pedidosRaw) {
                const [pagRows] = await pool.query(
        `SELECT id_pagamento, forma, valor, status
         FROM pagamentos
         WHERE id_pedido = ?
         ORDER BY id_pagamento DESC
         LIMIT 1`,
        [p.id_pedido]
    );
    const pag = pagRows[0] || null;

    let endereco       = null;
    let transportadora = null;
    let status_entrega = null;

    if (pag && pag.id_pagamento) {
        const [entRows] = await pool.query(
            `SELECT codigo_rastreio, transportadora, status
             FROM entregas
             WHERE id_pagamento = ?
             ORDER BY id_entrega DESC
             LIMIT 1`,
            [pag.id_pagamento]
        );
        if (entRows && entRows.length > 0) {
            endereco       = entRows[0].codigo_rastreio || null;
            transportadora = entRows[0].transportadora   || null;
            status_entrega = entRows[0].status            || null;
        }
    }

    const [itens] = await pool.query(
        `SELECT ip.id_item, ip.id_produto, ip.qtd, ip.preco_unit,
                pr.nome, pr.imagem
         FROM itens_pedido ip
         JOIN produtos pr ON pr.id_produto = ip.id_produto
         WHERE ip.id_pedido = ?
         ORDER BY ip.id_item`,
        [p.id_pedido]
    );

    pedidos.push({
        id_pedido:      p.id_pedido,
        id_usuario:     p.id_usuario,
        data_pedido:    p.data_pedido,
        valor_total:    p.valor_total,
        status:         p.status,
        criado_em:      p.criado_em,
        ddd:            usuarioDados.ddd || null,
        tel:            usuarioDados.tel || null,
        endereco,
        transportadora,
        status_entrega,
        itens: itens || [],
        pagamento: pag ? {
            id_pagamento: pag.id_pagamento,
            forma:        pag.forma,
            valor:        pag.valor,
            status:       pag.status
        } : null
    });
};

            return pedidos;
        } catch (erro) {
            console.error('findByUsuarioComDetalhes erro:', erro);
            return [];
        }
    }
};

module.exports = { pedidosModel };