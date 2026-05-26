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

    // cria registro de entrega — armazena endereço em codigo_rastreio
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

    // busca pedidos de um usuário (simples)
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
    },

    // busca pedidos com itens, pagamento, entrega e dados do usuario
    findByUsuarioComDetalhes: async (id_usuario) => {
        try {
            // Passo 1: busca todos os pedidos com pagamento do usuário
            const [pedidosRaw] = await pool.query(
                `SELECT
                    p.id_pedido,
                    p.id_usuario,
                    p.data_pedido,
                    p.valor_total,
                    p.status,
                    p.criado_em,
                    u.ddd,
                    u.tel,
                    pg.id_pagamento,
                    pg.forma,
                    pg.valor  AS valor_pag,
                    pg.status AS status_pag
                 FROM pedidos p
                 JOIN usuarios u   ON u.id_usuario = p.id_usuario
                 LEFT JOIN pagamentos pg ON pg.id_pedido = p.id_pedido
                 WHERE p.id_usuario = ?
                 ORDER BY p.criado_em DESC`,
                [id_usuario]
            );

            if (!pedidosRaw || pedidosRaw.length === 0) return [];

            // Passo 2: para cada pedido, busca entrega e itens separadamente
            // Isso evita qualquer ambiguidade de JOIN e garante os dados corretos
            const pedidos = await Promise.all(
                pedidosRaw.map(async (p) => {

                    // Busca a entrega mais recente vinculada ao pagamento
                    let endereco       = null;
                    let transportadora = null;
                    let status_entrega = null;

                    if (p.id_pagamento) {
                        const [entregaRows] = await pool.query(
                            `SELECT codigo_rastreio, transportadora, status
                             FROM entregas
                             WHERE id_pagamento = ?
                             ORDER BY id_entrega DESC
                             LIMIT 1`,
                            [p.id_pagamento]
                        );
                        if (entregaRows && entregaRows.length > 0) {
                            endereco       = entregaRows[0].codigo_rastreio || null;
                            transportadora = entregaRows[0].transportadora   || null;
                            status_entrega = entregaRows[0].status            || null;
                        }
                    }

                    // Busca os itens do pedido
                    const [itens] = await pool.query(
                        `SELECT ip.id_item,
                                ip.id_produto,
                                ip.qtd,
                                ip.preco_unit,
                                pr.nome,
                                pr.imagem
                         FROM itens_pedido ip
                         JOIN produtos pr ON pr.id_produto = ip.id_produto
                         WHERE ip.id_pedido = ?
                         ORDER BY ip.id_item`,
                        [p.id_pedido]
                    );

                    return {
                        id_pedido:      p.id_pedido,
                        id_usuario:     p.id_usuario,
                        data_pedido:    p.data_pedido,
                        valor_total:    p.valor_total,
                        status:         p.status,
                        criado_em:      p.criado_em,
                        ddd:            p.ddd  || null,
                        tel:            p.tel  || null,
                        endereco,
                        transportadora,
                        status_entrega,
                        itens:  itens || [],
                        pagamento: p.id_pagamento ? {
                            id_pagamento: p.id_pagamento,
                            forma:        p.forma,
                            valor:        p.valor_pag,
                            status:       p.status_pag
                        } : null
                    };
                })
            );

            return pedidos;
        } catch (erro) {
            console.error('findByUsuarioComDetalhes erro:', erro);
            return [];
        }
    }
};

module.exports = { pedidosModel };