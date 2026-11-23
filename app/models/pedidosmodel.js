const pool = require('../config/pool_conexoes');
const mockStore = require('../config/mock_store');

const pedidosModel = {

    create: async (id_usuario, itens, valor_total) => {
        if (pool.isMock) {
            const id_pedido = mockStore.seq.pedido++;
            const agora = new Date();
            const itensSalvos = itens.map((item, idx) => {
                const prod = mockStore.produtos.find(p => p.id_produto === Number(item.id_produto));
                const precoUnit = item.precoDesconto && item.precoDesconto > 0
                    ? item.precoDesconto
                    : item.preco;
                return {
                    id_item: idx + 1,
                    id_pedido,
                    id_produto: item.id_produto,
                    qtd: item.quantidade,
                    preco_unit: precoUnit,
                    nome: prod ? prod.nome : 'Produto',
                    imagem: prod ? prod.imagem : '/imagens/foto.svg'
                };
            });
            mockStore.pedidos.push({
                id_pedido,
                id_usuario: Number(id_usuario),
                data_pedido: agora,
                valor_total,
                status: 'pendente',
                criado_em: agora,
                itens: itensSalvos
            });
            return { id_pedido };
        }
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
        if (pool.isMock) {
            const id_pagamento = mockStore.seq.pagamento++;
            mockStore.pagamentos.push({
                id_pagamento,
                id_pedido: Number(id_pedido),
                forma,
                valor,
                status: 'pendente',
                mp_payment_id: null,
                pix_qr_code: null,
                pix_qr_code_base64: null,
                pix_ticket_url: null
            });
            return { id_pagamento };
        }
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

    findPagamentoByPedido: async (id_pedido) => {
        if (pool.isMock) {
            const pags = mockStore.pagamentos.filter(p => p.id_pedido === Number(id_pedido));
            return pags[pags.length - 1] || null;
        }
        const [pagamentos] = await pool.query(
            `SELECT id_pagamento, id_pedido, forma, valor, status,
                    mp_payment_id, pix_qr_code, pix_qr_code_base64, pix_ticket_url
             FROM pagamentos
             WHERE id_pedido = ?
             ORDER BY id_pagamento DESC
             LIMIT 1`,
            [id_pedido]
        );
        return pagamentos[0] || null;
    },

    atualizarDadosPix: async (id_pedido, pagamentoPix) => {
        if (pool.isMock) {
            const pag = await pedidosModel.findPagamentoByPedido(id_pedido);
            if (!pag) return false;
            pag.mp_payment_id = String(pagamentoPix.id);
            pag.pix_qr_code = pagamentoPix.qrCode;
            pag.pix_qr_code_base64 = pagamentoPix.qrCodeBase64;
            pag.pix_ticket_url = pagamentoPix.ticketUrl;
            pag.status = pagamentoPix.status;
            return true;
        }
        const [result] = await pool.query(
            `UPDATE pagamentos
             SET mp_payment_id = ?, pix_qr_code = ?,
                 pix_qr_code_base64 = ?, pix_ticket_url = ?, status = ?
             WHERE id_pagamento = (
                 SELECT id_pagamento FROM (
                     SELECT id_pagamento
                     FROM pagamentos
                     WHERE id_pedido = ?
                     ORDER BY id_pagamento DESC
                     LIMIT 1
                 ) AS pagamento_pedido
             )`,
            [
                String(pagamentoPix.id),
                pagamentoPix.qrCode,
                pagamentoPix.qrCodeBase64,
                pagamentoPix.ticketUrl,
                pagamentoPix.status,
                id_pedido
            ]
        );
        return result.affectedRows === 1;
    },

    findEnderecoByPagamento: async (id_pagamento) => {
        if (pool.isMock) {
            const ents = mockStore.entregas.filter(e => e.id_pagamento === Number(id_pagamento));
            return ents[ents.length - 1] ? ents[ents.length - 1].codigo_rastreio : null;
        }
        const [entregas] = await pool.query(
            `SELECT codigo_rastreio
             FROM entregas
             WHERE id_pagamento = ?
             ORDER BY id_entrega DESC
             LIMIT 1`,
            [id_pagamento]
        );
        return entregas[0] ? entregas[0].codigo_rastreio : null;
    },

    atualizarStatusPagamento: async (id_pedido, statusPagamento, statusPedido) => {
        if (pool.isMock) {
            const ped = mockStore.pedidos.find(p => p.id_pedido === Number(id_pedido));
            const pag = await pedidosModel.findPagamentoByPedido(id_pedido);
            if (!ped || !pag) return false;
            pag.status = statusPagamento;
            ped.status = statusPedido;
            return true;
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [pagamentos] = await conn.query(
                `SELECT id_pagamento
                 FROM pagamentos
                 WHERE id_pedido = ?
                 ORDER BY id_pagamento DESC
                 LIMIT 1
                 FOR UPDATE`,
                [id_pedido]
            );
            if (!pagamentos[0]) {
                await conn.rollback();
                return false;
            }

            await conn.query(
                'UPDATE pagamentos SET status = ? WHERE id_pagamento = ?',
                [statusPagamento, pagamentos[0].id_pagamento]
            );
            await conn.query(
                'UPDATE pedidos SET status = ? WHERE id_pedido = ?',
                [statusPedido, id_pedido]
            );
            await conn.commit();
            return true;
        } catch (erro) {
            await conn.rollback();
            throw erro;
        } finally {
            conn.release();
        }
    },

    createEntrega: async (id_pagamento, transportadora, endereco) => {
        if (pool.isMock) {
            const id_entrega = mockStore.seq.entrega++;
            mockStore.entregas.push({
                id_entrega,
                id_pagamento: Number(id_pagamento),
                transportadora,
                codigo_rastreio: endereco || null,
                status: 'aguardando'
            });
            return { id_entrega };
        }
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
        if (pool.isMock) {
            return mockStore.pedidos
                .filter(p => p.id_usuario === Number(id_usuario))
                .map(p => ({ ...p, total_itens: (p.itens || []).length }));
        }
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
        if (pool.isMock) {
            return mockStore.pedidos.find(p => p.id_pedido === Number(id_pedido)) || null;
        }
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

    contarPorUsuario: async (id_usuario) => {
        if (pool.isMock) {
            return mockStore.pedidos.filter(p => p.id_usuario === Number(id_usuario)).length;
        }
        try {
            const [linhas] = await pool.query(
                'SELECT COUNT(*) AS total FROM pedidos WHERE id_usuario = ?',
                [id_usuario]
            );
            return Number(linhas[0].total) || 0;
        } catch (erro) {
            console.error('contarPorUsuario erro:', erro);
            return 0;
        }
    },

    findByUsuarioComDetalhes: async (id_usuario, opcoes = {}) => {
        if (pool.isMock) {
            const usuario = mockStore.usuarios.find(u => u.id_usuario === Number(id_usuario)) || {};
            let lista = mockStore.pedidos
                .filter(p => p.id_usuario === Number(id_usuario))
                .slice()
                .sort((a, b) => b.id_pedido - a.id_pedido);
            if (Number.isInteger(opcoes.limite) && opcoes.limite > 0) {
                const start = Math.max(0, opcoes.deslocamento || 0);
                lista = lista.slice(start, start + opcoes.limite);
            }
            return lista.map(p => {
                const pag = mockStore.pagamentos.filter(pg => pg.id_pedido === p.id_pedido).pop() || null;
                const ent = pag ? mockStore.entregas.filter(e => e.id_pagamento === pag.id_pagamento).pop() || null : null;
                return {
                    ...p,
                    ddd: usuario.ddd || null,
                    tel: usuario.tel || null,
                    endereco: ent ? ent.codigo_rastreio : null,
                    transportadora: ent ? ent.transportadora : null,
                    status_entrega: ent ? ent.status : null,
                    pagamento: pag ? {
                        id_pagamento: pag.id_pagamento,
                        forma: pag.forma,
                        valor: pag.valor,
                        status: pag.status
                    } : null
                };
            });
        }
        try {
            const paginado = Number.isInteger(opcoes.limite) && opcoes.limite > 0;
            const parametros = [id_usuario];
            let sqlPagina = '';
            if (paginado) {
                sqlPagina = ' LIMIT ? OFFSET ?';
                parametros.push(opcoes.limite, Math.max(0, opcoes.deslocamento || 0));
            }

            const [pedidosRaw] = await pool.query(
                `SELECT id_pedido, id_usuario, data_pedido, valor_total, status, criado_em
                 FROM pedidos
                 WHERE id_usuario = ?
                 ORDER BY criado_em DESC, id_pedido DESC` + sqlPagina,
                parametros
            );

            if (!pedidosRaw || pedidosRaw.length === 0) return [];

            const ids = pedidosRaw.map(p => p.id_pedido);

            const [[usuarioRows], [pagRows], [itensRows]] = await Promise.all([
                pool.query('SELECT ddd, tel FROM usuarios WHERE id_usuario = ?', [id_usuario]),
                pool.query(
                    `SELECT id_pagamento, id_pedido, forma, valor, status
                     FROM pagamentos
                     WHERE id_pedido IN (?)
                     ORDER BY id_pagamento DESC`,
                    [ids]
                ),
                pool.query(
                    `SELECT ip.id_item, ip.id_pedido, ip.id_produto, ip.qtd, ip.preco_unit,
                            pr.nome, pr.imagem
                     FROM itens_pedido ip
                     JOIN produtos pr ON pr.id_produto = ip.id_produto
                     WHERE ip.id_pedido IN (?)
                     ORDER BY ip.id_item`,
                    [ids]
                )
            ]);

            const usuarioDados = usuarioRows[0] || {};

            const pagamentoPorPedido = new Map();
            pagRows.forEach(pag => {
                if (!pagamentoPorPedido.has(pag.id_pedido)) {
                    pagamentoPorPedido.set(pag.id_pedido, pag);
                }
            });

            const entregaPorPagamento = new Map();
            const idsPagamento = Array.from(pagamentoPorPedido.values()).map(pag => pag.id_pagamento);
            if (idsPagamento.length > 0) {
                const [entRows] = await pool.query(
                    `SELECT id_pagamento, codigo_rastreio, transportadora, status
                     FROM entregas
                     WHERE id_pagamento IN (?)
                     ORDER BY id_entrega DESC`,
                    [idsPagamento]
                );
                entRows.forEach(ent => {
                    if (!entregaPorPagamento.has(ent.id_pagamento)) {
                        entregaPorPagamento.set(ent.id_pagamento, ent);
                    }
                });
            }

            const itensPorPedido = new Map();
            itensRows.forEach(item => {
                if (!itensPorPedido.has(item.id_pedido)) itensPorPedido.set(item.id_pedido, []);
                itensPorPedido.get(item.id_pedido).push(item);
            });

            return pedidosRaw.map(p => {
                const pag = pagamentoPorPedido.get(p.id_pedido) || null;
                const ent = pag ? entregaPorPagamento.get(pag.id_pagamento) || null : null;

                return {
                    id_pedido:      p.id_pedido,
                    id_usuario:     p.id_usuario,
                    data_pedido:    p.data_pedido,
                    valor_total:    p.valor_total,
                    status:         p.status,
                    criado_em:      p.criado_em,
                    ddd:            usuarioDados.ddd || null,
                    tel:            usuarioDados.tel || null,
                    endereco:       ent ? ent.codigo_rastreio || null : null,
                    transportadora: ent ? ent.transportadora || null : null,
                    status_entrega: ent ? ent.status || null : null,
                    itens:          itensPorPedido.get(p.id_pedido) || [],
                    pagamento: pag ? {
                        id_pagamento: pag.id_pagamento,
                        forma:        pag.forma,
                        valor:        pag.valor,
                        status:       pag.status
                    } : null
                };
            });
        } catch (erro) {
            console.error('findByUsuarioComDetalhes erro:', erro);
            return [];
        }
    },

    findPendentesVencidos: async (prazoBoletoHoras, prazoPadraoHoras) => {
        if (pool.isMock) return [];
        const [linhas] = await pool.query(
            `SELECT p.id_pedido
             FROM pedidos p
             LEFT JOIN pagamentos pg ON pg.id_pagamento = (
                 SELECT MAX(id_pagamento) FROM pagamentos WHERE id_pedido = p.id_pedido
             )
             WHERE p.status = 'pendente'
               AND TIMESTAMPDIFF(HOUR, p.criado_em, NOW()) >= CASE WHEN pg.forma = 'boleto' THEN ? ELSE ? END
             ORDER BY p.id_pedido
             LIMIT 200`,
            [prazoBoletoHoras, prazoPadraoHoras]
        );
        return linhas.map(linha => linha.id_pedido);
    },

    cancelarPedidoPendente: async (id_pedido) => {
        if (pool.isMock) {
            const ped = mockStore.pedidos.find(p => p.id_pedido === Number(id_pedido) && p.status === 'pendente');
            if (!ped) return false;
            ped.status = 'cancelado';
            return true;
        }
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [resultado] = await conn.query(
                "UPDATE pedidos SET status = 'cancelado' WHERE id_pedido = ? AND status = 'pendente'",
                [id_pedido]
            );
            if (resultado.affectedRows === 1) {
                await conn.query(
                    "UPDATE pagamentos SET status = 'cancelado' WHERE id_pedido = ? AND status = 'pendente'",
                    [id_pedido]
                );
            }
            await conn.commit();
            return resultado.affectedRows === 1;
        } catch (erro) {
            await conn.rollback();
            throw erro;
        } finally {
            conn.release();
        }
    }
};

module.exports = { pedidosModel };