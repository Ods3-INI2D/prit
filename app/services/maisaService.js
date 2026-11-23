const { GoogleGenAI, Type } = require('@google/genai');
const { calcularIdade, pontuar, ordenarPorRelevancia } = require('../helpers/personalizacao');

const MODELO_MAISA = 'gemini-4-hydrogen';

let clienteGemini = null;
let chaveEmCache = null;

function obterClienteGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const erro = new Error('GEMINI_API_KEY não configurada no servidor.');
        erro.codigo = 'MISSING_API_KEY';
        throw erro;
    }
    if (!clienteGemini || chaveEmCache !== apiKey) {
        chaveEmCache = apiKey;
        clienteGemini = new GoogleGenAI({
            apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build'
                }
            }
        });
    }
    return clienteGemini;
}

/**
 * Extrai idade ou sexo mencionados na conversa (caso visitante ou compra para terceiro)
 * e combina com os dados reais do usuário logado para aplicar o algoritmo de personalizacao.js.
 */
function resolverPerfilAlvo(usuario, mensagem = '', historico = []) {
    const textos = [];
    if (typeof mensagem === 'string' && mensagem.trim()) {
        textos.push(mensagem.trim());
    }
    if (Array.isArray(historico)) {
        for (const item of historico) {
            if (item && item.role === 'user' && typeof item.texto === 'string') {
                textos.push(item.texto);
            }
        }
    }
    const textoCombinado = textos.join(' ').toLowerCase();

    let idadeInferida = null;
    const matchIdade = textoCombinado.match(/\b(\d{2})\s*anos\b|\b(\d{2})\+\b/);
    if (matchIdade) {
        const val = parseInt(matchIdade[1] || matchIdade[2], 10);
        if (val >= 18 && val <= 115) idadeInferida = val;
    } else if (/\bterceira idade\b|\bidos[oa]\b|\bsenhor(?:a)?\b|\bvov[ôó]\b|\bavo\b/.test(textoCombinado)) {
        idadeInferida = 65;
    }

    let sexoInferido = null;
    if (/\b(mulher|feminino|feminina|senhora|mãe|mae|esposa|avó|avoa|tia|idosa)\b/.test(textoCombinado)) {
        sexoInferido = 'feminino';
    } else if (/\b(homem|masculino|masculina|senhor|pai|marido|avô|tio|idoso)\b/.test(textoCombinado)) {
        sexoInferido = 'masculino';
    }

    const nascEfetivo = idadeInferida !== null
        ? new Date(new Date().getFullYear() - idadeInferida, 0, 1).toISOString().slice(0, 10)
        : (usuario && usuario.nasc ? usuario.nasc : null);

    const sexoEfetivo = sexoInferido || (usuario && usuario.sexo ? usuario.sexo : null);

    if (!nascEfetivo && !sexoEfetivo) {
        return null;
    }

    return {
        nasc: nascEfetivo,
        sexo: sexoEfetivo,
        origem: (idadeInferida !== null || sexoInferido !== null) && (!usuario || !usuario.nasc)
            ? 'conversa'
            : 'cadastro'
    };
}

function resumirCatalogo(produtos, categorias, perfilAlvo) {
    const produtosOrdenados = ordenarPorRelevancia(
        Array.isArray(produtos) ? produtos : [],
        perfilAlvo
    );
    const categoriasOrdenadas = ordenarPorRelevancia(
        Array.isArray(categorias) ? categorias : [],
        perfilAlvo
    );

    const listaProdutos = produtosOrdenados.map(p => {
        const preco = Number(p.preco) || 0;
        const precoDesconto = p.preco_desconto != null ? Number(p.preco_desconto) : null;
        const precoEfetivo = precoDesconto && precoDesconto > 0 ? precoDesconto : preco;
        return {
            id_produto: Number(p.id_produto),
            nome: p.nome,
            descricao: p.descricao || '',
            categoria: p.categoria || '',
            preco_original: Number(preco.toFixed(2)),
            preco_promocional: precoDesconto && precoDesconto > 0 ? Number(precoDesconto.toFixed(2)) : null,
            preco_final: Number(precoEfetivo.toFixed(2)),
            faixa_etaria: p.faixa_etaria || 'Todas as idades',
            sexo: p.sexo || 'todos',
            pontuacao_relevancia: pontuar(p, perfilAlvo),
            status: p.status || 'em-estoque'
        };
    });

    const listaCategorias = categoriasOrdenadas.map(c => ({
        nome: c.nome,
        slug: c.slug,
        faixa_etaria: c.faixa_etaria || 'Todas as idades',
        sexo: c.sexo || 'todos',
        pontuacao_relevancia: pontuar(c, perfilAlvo)
    }));

    return { listaProdutos, listaCategorias };
}

function construirInstrucaoSistema({ produtos, categorias, usuario, perfilAlvo }) {
    const { listaProdutos, listaCategorias } = resumirCatalogo(produtos, categorias, perfilAlvo);
    const idadeUsuario = perfilAlvo && perfilAlvo.nasc ? calcularIdade(perfilAlvo.nasc) : null;
    const sexoUsuario = perfilAlvo && perfilAlvo.sexo ? perfilAlvo.sexo : null;

    const sexoLegivel = sexoUsuario === 'feminino'
        ? 'feminino'
        : (sexoUsuario === 'masculino' ? 'masculino' : 'não informado');

    const nomeCliente = usuario && usuario.nome ? usuario.nome : null;
    const contextoUsuario = perfilAlvo
        ? `Perfil considerado no algoritmo de personalização${nomeCliente ? ` (Cliente "${nomeCliente}")` : ''}: ${idadeUsuario !== null ? `idade aproximada ${idadeUsuario} anos` : 'idade não informada'}, sexo "${sexoLegivel}" (origem: ${perfilAlvo.origem}).`
        : 'Cliente visitante sem idade ou sexo informados ainda.';

    return [
        'Você é a Maisa, a assistente virtual oficial da farmácia e loja de saúde +Saúde.',
        'Seu papel é auxiliar clientes — tendo como público principal a população idosa — a encontrar produtos do catálogo da +Saúde alinhados ao algoritmo de relevância por faixa etária e sexo.',
        '',
        'ALGORITMO DE PERSONALIZAÇÃO POR IDADE E SEXO (OBRIGATÓRIO):',
        '- O catálogo JSON abaixo JÁ ESTÁ ORDENADO pelo algoritmo oficial de personalização da +Saúde (`pontuacao_relevancia`: +3 quando a `faixa_etaria` do produto/categoria é compatível com a idade do usuário, +2 quando o `sexo` do público-alvo corresponde ao do usuário, 0 quando neutro/"todos", e -1 quando incompatível).',
        '- Sempre dê PRIORIDADE aos produtos com maior `pontuacao_relevancia` (>= 0) e em estoque (`em-estoque`). Evite recomendar produtos com `pontuacao_relevancia` negativa, a menos que o usuário peça explicitamente para outra pessoa.',
        '- Relacione as necessidades informadas aos problemas recorrentes da faixa etária e sexo do usuário (sem diagnosticar doenças nem prescrever remédios):',
        '  • 40+ e 50+: prevenção óssea, disposição diária, proteção solar, pele seca/madura e saúde cardiovascular; para sexo feminino, hidratação intensa da pele madura e cuidado preventivo ósseo; para sexo masculino, energia, circulação e praticidade diária.',
        '  • 60+ e 65+: perda de cálcio/vitamina D, dor ou rigidez nas articulações, controle de pressão arterial, imunidade, pele fina/ressecada e cuidado bucal suave; para sexo feminino, fortalecimento ósseo e hidratação cutânea; para sexo masculino, suporte cardiovascular/articular e organização da rotina.',
        '  • 70+, 75+ e 80+: boca seca ou cuidado com prótese dentária, pele muito sensível, circulação/cansaço nas pernas, conforto geriátrico, organizadores de comprimidos e aparelhos com letras/visor grandes.',
        '- Quando o perfil (idade/sexo) estiver definido, mencione de forma natural e acolhedora por que os itens escolhidos combinam com a fase de vida ou necessidade do cliente.',
        '',
        'DIRETRIZES DE COMUNICAÇÃO PARA O PÚBLICO IDOSO:',
        '- Seja acolhedora, respeitosa e direta em português do Brasil.',
        '- Responda em NO MÁXIMO 2 a 3 frases curtas e fáceis de ler (evite textos longos).',
        '- Use linguagem simples, sem termos médicos difíceis nem palavras em inglês.',
        '- Sempre cite preços com clareza (ex.: "R$ 49,90").',
        '- Se um item estiver "fora-de-estoque", avise rapidamente e priorize opções "em-estoque".',
        '- Nunca diagnostique doenças nem prescreva remédios; oriente consultar um médico ou farmacêutico quando necessário.',
        '',
        'REGRAS DE CATÁLOGO (OBRIGATÓRIO):',
        '- Recomende EXCLUSIVAMENTE produtos presentes no catálogo JSON abaixo, usando exatamente o mesmo "id_produto".',
        '- Nunca invente produtos, preços ou características.',
        '- No campo "produtos_recomendados", forneça SEMPRE exatamente 3 produtos distintos do catálogo que melhor atendam às necessidades apresentadas na mensagem (priorizando itens em estoque e com maior pontuação de relevância).',
        '- Em cada "motivo", escreva apenas 1 frase bem curta (máximo 12 palavras) explicando por que atende ao pedido e ao perfil.',
        '- No campo "sugestoes_perguntas", inclua no máximo 2 opções bem curtas (2 a 4 palavras cada, ex.: "Ver até R$ 50", "Ver promoções").',
        '',
        contextoUsuario,
        `Categorias disponíveis (ordenadas por relevância): ${JSON.stringify(listaCategorias)}`,
        `Catálogo atual de produtos da +Saúde (ordenado por relevância): ${JSON.stringify(listaProdutos)}`
    ].join('\n');
}

const schemaRespostaMaisa = {
    type: Type.OBJECT,
    properties: {
        resposta: {
            type: Type.STRING,
            description: 'Resposta bem curta (2 a 3 frases simples) e fácil de ler para o usuário idoso em português.'
        },
        produtos_recomendados: {
            type: Type.ARRAY,
            minItems: '3',
            maxItems: '3',
            description: 'Lista obrigatória com exatamente 3 produtos distintos do catálogo que atendem às necessidades da mensagem e ao perfil.',
            items: {
                type: Type.OBJECT,
                properties: {
                    id_produto: {
                        type: Type.INTEGER,
                        description: 'ID exato do produto no catálogo.'
                    },
                    motivo: {
                        type: Type.STRING,
                        description: 'Uma frase bem curta (até 12 palavras) explicando por que esse produto serve para o cliente.'
                    }
                },
                required: ['id_produto', 'motivo']
            }
        },
        sugestoes_perguntas: {
            type: Type.ARRAY,
            description: 'Até 2 sugestões bem curtas (2 a 4 palavras) para continuar a busca.',
            items: {
                type: Type.STRING
            }
        }
    },
    required: ['resposta', 'produtos_recomendados', 'sugestoes_perguntas']
};

function normalizarHistorico(historico) {
    if (!Array.isArray(historico)) return [];
    return historico
        .slice(-12)
        .filter(item => item && (item.role === 'user' || item.role === 'model') && typeof item.texto === 'string' && item.texto.trim())
        .map(item => ({
            role: item.role,
            parts: [{ text: item.texto.trim().slice(0, 1000) }]
        }));
}

async function executarComRetry(fn, tentativas = 3) {
    let ultimoErro;
    for (let i = 0; i < tentativas; i++) {
        try {
            return await fn();
        } catch (erro) {
            ultimoErro = erro;
            const status = erro && (erro.status || erro.code);
            const transitorio = status === 429 || status === 503 || status === 500;
            if (!transitorio || i === tentativas - 1) throw erro;
            await new Promise(resolve => setTimeout(resolve, 400 * Math.pow(2, i)));
        }
    }
    throw ultimoErro;
}

/**
 * Gera sugestões iniciais personalizadas para o chatbot usando o mesmo algoritmo
 * de relevância por idade e sexo (personalizacao.js) aplicado na loja.
 */
function gerarSugestoesPersonalizadas({ produtos = [], categorias = [], usuario = null }) {
    const idadeUsuario = usuario && usuario.nasc ? calcularIdade(usuario.nasc) : null;
    const sexoUsuario = usuario && usuario.sexo ? usuario.sexo : null;

    if (!usuario || (idadeUsuario === null && (!sexoUsuario || sexoUsuario === 'prefiro-nao-dizer'))) {
        return {
            saudacao: 'Olá! O que você procura hoje?',
            topicos: [
                { titulo: 'Vitaminas e energia', pergunta: 'Quais vitaminas ou suplementos você indica para terceira idade?' },
                { titulo: 'Pele sensível', pergunta: 'Procuro creme ou sabonete suave sem cheiro forte para pele sensível.' },
                { titulo: 'Dentes e gengiva', pergunta: 'Quero produtos suaves para gengiva sensível ou prótese.' },
                { titulo: 'Promoções', pergunta: 'Quais produtos estão em promoção hoje?' }
            ]
        };
    }

    const catsOrdenadas = ordenarPorRelevancia(Array.isArray(categorias) ? categorias : [], usuario);
    const prodsOrdenados = ordenarPorRelevancia(Array.isArray(produtos) ? produtos : [], usuario);

    const primeiroNome = usuario.nome ? String(usuario.nome).trim().split(' ')[0] : '';
    const descSexo = sexoUsuario === 'feminino' ? 'para o público feminino' : (sexoUsuario === 'masculino' ? 'para o público masculino' : '');
    const faixaTexto = idadeUsuario !== null ? `${idadeUsuario} anos` : '';

    const topicos = [];
    const titulosUsados = new Set();

    function adicionarTopico(titulo, pergunta) {
        const chave = titulo.toLowerCase();
        if (titulosUsados.has(chave) || topicos.length >= 4) return;
        titulosUsados.add(chave);
        topicos.push({ titulo, pergunta });
    }

    const temMatchPerfil = prodsOrdenados.some(p => pontuar(p, usuario) > 0);
    if (temMatchPerfil) {
        const labelPerfil = idadeUsuario !== null && idadeUsuario >= 60
            ? 'Mais indicados (60+)'
            : 'Indicados para você';
        adicionarTopico(
            labelPerfil,
            `Quais produtos da loja são mais indicados para ${[faixaTexto, descSexo].filter(Boolean).join(' ')} e suas necessidades mais comuns?`
        );
    }

    const mapaCategoriaPergunta = {
        'terceira idade': {
            titulo: 'Conforto e dia a dia',
            pergunta: 'Quais produtos de conforto, organização e cuidado diário você recomenda para minha idade?'
        },
        'vitaminas e suplementos': {
            titulo: 'Ossos e vitaminas',
            pergunta: 'Quais vitaminas, cálcio ou suplementos são indicados para minha faixa etária?'
        },
        'cuidados com a pele': {
            titulo: 'Pele seca e proteção',
            pergunta: 'Quais hidratantes ou cuidados com a pele você indica para minha faixa etária?'
        },
        'higiene bucal': {
            titulo: 'Gengiva e prótese',
            pergunta: 'Quero produtos suaves para gengiva sensível, boca seca ou prótese.'
        },
        'monitoramento e saúde': {
            titulo: 'Pressão e controle',
            pergunta: 'Tem aparelho de pressão fácil de ler ou organizador de comprimidos?'
        },
        'cabelo': {
            titulo: 'Cabelo e couro cabeludo',
            pergunta: 'Quais produtos suaves para fortalecimento capilar combinam comigo?'
        }
    };

    for (const cat of catsOrdenadas) {
        const chave = String(cat.nome || '').toLowerCase();
        const mapeado = mapaCategoriaPergunta[chave];
        if (mapeado) {
            adicionarTopico(mapeado.titulo, mapeado.pergunta);
        } else if (cat.nome) {
            adicionarTopico(cat.nome, `Quais produtos de ${cat.nome} você recomenda para o meu perfil?`);
        }
        if (topicos.length >= 3) break;
    }

    adicionarTopico('Promoções para você', 'Quais produtos recomendados para minha idade e perfil estão em promoção?');

    const saudacao = primeiroNome
        ? `Olá, ${primeiroNome}! Separei sugestões pensadas para você. O que procura hoje?`
        : 'Olá! Separei sugestões para o seu perfil. O que procura hoje?';

    return { saudacao, topicos };
}

async function consultarMaisa({ mensagem, historico = [], produtos = [], categorias = [], usuario = null }) {
    const ai = obterClienteGemini();
    const perfilAlvo = resolverPerfilAlvo(usuario, mensagem, historico);
    const systemInstruction = construirInstrucaoSistema({ produtos, categorias, usuario, perfilAlvo });
    const contents = [
        ...normalizarHistorico(historico),
        {
            role: 'user',
            parts: [{ text: String(mensagem || '').trim().slice(0, 1000) }]
        }
    ];

    const response = await executarComRetry(() =>
        ai.models.generateContent({
            model: MODELO_MAISA,
            contents,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: schemaRespostaMaisa
            }
        })
    );

    const textoBruto = (response && response.text ? response.text : '').trim();
    let dados;
    try {
        dados = JSON.parse(textoBruto);
    } catch (_) {
        dados = {
            resposta: textoBruto || 'Desculpe, não consegui organizar a resposta agora. Pode tentar perguntar novamente?',
            produtos_recomendados: [],
            sugestoes_perguntas: ['Mostrar vitaminas 60+', 'Produtos em promoção']
        };
    }

    const produtosGarantidos = garantirTresProdutos({
        recomendados: dados.produtos_recomendados,
        mensagem,
        historico,
        produtos,
        perfilAlvo
    });

    return {
        resposta: typeof dados.resposta === 'string' ? dados.resposta : '',
        produtos_recomendados: produtosGarantidos,
        sugestoes_perguntas: Array.isArray(dados.sugestoes_perguntas) ? dados.sugestoes_perguntas.slice(0, 2) : [],
        perfilAlvo
    };
}

function normalizarTexto(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
}

function gerarMotivoCurto(produto) {
    if (produto.faixa_etaria && produto.categoria) {
        return `Indicado para ${produto.faixa_etaria} na linha ${produto.categoria}.`;
    }
    if (produto.categoria) {
        return `Boa opção em ${produto.categoria} para o seu dia a dia.`;
    }
    const primeiraFrase = String(produto.descricao || '').split('.')[0].trim();
    if (primeiraFrase) {
        return primeiraFrase.length > 75 ? primeiraFrase.slice(0, 72) + '...' : primeiraFrase + '.';
    }
    return 'Opção alinhada ao que você procura.';
}

function garantirTresProdutos({ recomendados = [], mensagem = '', historico = [], produtos = [], perfilAlvo = null }) {
    const listaCatalogo = ordenarPorRelevancia(Array.isArray(produtos) ? produtos : [], perfilAlvo);
    const mapa = new Map(listaCatalogo.map(p => [Number(p.id_produto), p]));
    const selecionados = [];
    const idsUsados = new Set();

    if (Array.isArray(recomendados)) {
        for (const rec of recomendados) {
            const idNum = Number(rec && rec.id_produto);
            if (!Number.isInteger(idNum) || idsUsados.has(idNum)) continue;
            const prod = mapa.get(idNum);
            if (!prod) continue;
            idsUsados.add(idNum);
            selecionados.push({
                id_produto: idNum,
                motivo: typeof rec.motivo === 'string' && rec.motivo.trim()
                    ? rec.motivo.trim()
                    : gerarMotivoCurto(prod)
            });
            if (selecionados.length === 3) return selecionados;
        }
    }

    const textoBusca = normalizarTexto([
        mensagem,
        ...(Array.isArray(historico)
            ? historico.filter(h => h && h.role === 'user').slice(-2).map(h => h.texto)
            : [])
    ].join(' '));
    const STOP_WORDS = new Set([
        'para', 'como', 'com', 'sem', 'uma', 'uns', 'umas', 'que', 'qual', 'quais',
        'tenho', 'quero', 'preciso', 'procuro', 'gostaria', 'uso', 'usar', 'algo',
        'mais', 'muito', 'muita', 'pouco', 'meu', 'minha', 'meus', 'minhas',
        'isso', 'este', 'esta', 'esse', 'essa', 'pode', 'sobre', 'loja', 'produto', 'produtos'
    ]);
    const EXPANSOES = {
        dentadura: ['protese', 'gengiva', 'bucal'],
        protese: ['dentadura', 'gengiva', 'bucal'],
        osso: ['calcio', 'vitamina'],
        ossos: ['calcio', 'vitamina'],
        joelho: ['articulacao', 'articulacoes', 'colageno'],
        articulacao: ['colageno', 'mobilidade'],
        articulacoes: ['colageno', 'mobilidade'],
        coracao: ['omega', 'pressao', 'cardiovascular'],
        esquecimento: ['comprimidos', 'organizador', 'memoria']
    };

    const termosBase = textoBusca
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
    const termos = Array.from(new Set(
        termosBase.flatMap(t => [t, ...(EXPANSOES[t] || [])])
    ));
    const querPromocao = /\b(promocao|promocoes|desconto|barato|oferta|economia|menor preco)\b/.test(textoBusca);

    const candidatos = listaCatalogo
        .filter(p => !idsUsados.has(Number(p.id_produto)))
        .map((p, idx) => {
            const nomeNorm = normalizarTexto(p.nome);
            const catNorm = normalizarTexto(p.categoria);
            const descNorm = normalizarTexto(p.descricao);
            let score = (p.status !== 'fora-de-estoque' ? 100 : 0) + (pontuar(p, perfilAlvo) * 4);
            for (const termo of termos) {
                if (nomeNorm.includes(termo)) score += 16;
                if (catNorm.includes(termo)) score += 10;
                if (descNorm.includes(termo)) score += 6;
            }
            if (querPromocao && p.preco_desconto && Number(p.preco_desconto) > 0) {
                score += 10;
            }
            return { prod: p, score, idx };
        })
        .sort((a, b) => b.score - a.score || a.idx - b.idx);

    for (const item of candidatos) {
        if (selecionados.length >= 3) break;
        const idNum = Number(item.prod.id_produto);
        if (idsUsados.has(idNum)) continue;
        idsUsados.add(idNum);
        selecionados.push({
            id_produto: idNum,
            motivo: gerarMotivoCurto(item.prod)
        });
    }

    return selecionados;
}

module.exports = {
    consultarMaisa,
    gerarSugestoesPersonalizadas,
    resolverPerfilAlvo,
    garantirTresProdutos
};
