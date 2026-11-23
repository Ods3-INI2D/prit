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

function construirInstrucaoSistema({ produtos, categorias, usuario, perfilAlvo, historico = [] }) {
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

    const respostasAnteriores = Array.isArray(historico)
        ? historico
            .filter(h => h && h.role === 'model' && typeof h.texto === 'string' && h.texto.trim())
            .slice(-3)
            .map(h => h.texto.trim())
        : [];

    const avisoVariacaoHistorico = respostasAnteriores.length > 0
        ? `Respostas que você já deu antes nesta conversa (NÃO repita a mesma abertura, estrutura nem frases parecidas): ${JSON.stringify(respostasAnteriores)}`
        : 'Esta é sua primeira resposta nesta conversa; comece de forma natural e acolhedora sem soar mecânica.';

    return [
        'Você é a Maisa, assistente virtual da loja de saúde e bem-estar +Saúde, voltada principalmente para o público idoso.',
        'Seu papel é conversar de forma humana, clara e personalizada, ajudando o cliente com os produtos do catálogo da +Saúde.',
        '',
        'ESTILO DE RESPOSTA ÚNICO E NATURAL (PROIBIDO USAR TEMPLATE):',
        '- Cada resposta sua deve ser ÚNICA, escrita sob medida para a mensagem recebida. Nunca use modelos fixos, introduções repetidas ou frases prontas.',
        '- Varie sempre a abertura, o ritmo e a construção das frases (às vezes comece acolhendo o desconforto citado, às vezes vá direto à orientação prática, às vezes destaque um hábito ou detalhe do cuidado diário).',
        '- Os cartões dos produtos exibidos abaixo da sua mensagem já mostram foto, nome completo e preço. Por isso, NÃO faça uma lista mecânica repetindo nomes e preços na fala principal — explique de forma simples, em 2 a 4 frases fáceis de ler, como lidar com a necessidade e por que aquele tipo de cuidado ajuda.',
        '- Use linguagem acessível ao público idoso, sem jargões médicos difíceis nem palavras em inglês.',
        `- ${avisoVariacaoHistorico}`,
        '',
        'INTERPRETAÇÃO DE PALAVRAS-CHAVE CURTAS:',
        '- Muitas vezes o cliente envia apenas palavras-chave soltas (ex.: "dor nas costas", "pele seca", "cansaço", "pressão", "esquecimento", "cabelo").',
        '- Nunca responda pedindo para ele explicar melhor antes de ajudar. Interprete imediatamente a necessidade provável, dê uma dica prática e segura para o dia a dia (sem diagnosticar nem prescrever remédios; lembrando de consultar um médico se a dor ou sintoma for forte ou persistente) e conecte com os produtos do catálogo quando houver relação.',
        '',
        'REGRA DE PERTINÊNCIA AO CATÁLOGO (OBRIGATÓRIO):',
        '- Primeiro avalie se o problema, dúvida ou palavra-chave tem relação real com a proposta do site e com as soluções oferecidas pelos produtos e categorias do catálogo JSON abaixo.',
        '- SE TIVER RELAÇÃO (`tem_relacao_com_catalogo = true`): recomende SEMPRE exatamente 3 produtos distintos do catálogo em "produtos_recomendados", priorizando itens "em-estoque" e de maior `pontuacao_relevancia`. Se citar algum item fora de estoque, avise brevemente.',
        '- SE NÃO TIVER RELAÇÃO com os produtos e proposta do site (`tem_relacao_com_catalogo = false` — ex.: receitas culinárias, futebol, conserto de eletrônicos/carros, programação, perguntas gerais sem ligação com saúde/mobilidade/segurança/bem-estar da loja, ou algo que nenhum produto do site resolve):',
        '  • Retorne `produtos_recomendados: []` (lista VAZIA — não force produtos sem relação).',
        '  • Explique com gentileza e naturalidade o que a loja +Saúde oferece (ou oriente atendimento médico imediato em caso de emergência grave).',
        '',
        'ALGORITMO DE PERSONALIZAÇÃO POR IDADE E SEXO:',
        '- O catálogo JSON abaixo JÁ ESTÁ ORDENADO pelo algoritmo oficial de personalização (`pontuacao_relevancia`: +3 faixa etária compatível, +2 sexo compatível, 0 neutro, -1 incompatível).',
        '- Dê preferência aos itens com maior `pontuacao_relevancia` (>= 0). Considere as necessidades recorrentes da faixa etária e sexo do perfil quando estiverem disponíveis, adaptando a escolha ao que existe no catálogo.',
        '- Nunca diagnostique doenças nem prescreva medicamentos.',
        '',
        'SUGESTÕES DE CONTINUAÇÃO COERENTES (`sugestoes_perguntas`):',
        '- Gere de 2 a 3 sugestões curtas e naturais que continuem EXATAMENTE o rumo da conversa atual (ex.: explorar um cuidado próximo ao problema citado, tirar dúvida sobre uso, filtrar conforto/rotina dentro do mesmo assunto).',
        '- NUNCA coloque sugestões genéricas fora do contexto (como "Ver promoções" se o assunto não for preço).',
        '- Se `tem_relacao_com_catalogo` for false, sugira 2 a 3 caminhos baseados nas categorias reais existentes no site para ajudar o cliente a voltar ao catálogo.',
        '',
        'REGRAS DOS MOTIVOS DOS PRODUTOS:',
        '- Em cada item de `produtos_recomendados`, escreva um `motivo` único e específico em 1 frase curta explicando por que aquele produto ajuda no problema apresentado pelo cliente (evite motivos padronizados ou repetidos entre os 3 itens).',
        '- Use EXCLUSIVAMENTE `id_produto` existente no catálogo JSON abaixo.',
        '',
        contextoUsuario,
        `Categorias existentes no site (ordenadas por relevância): ${JSON.stringify(listaCategorias)}`,
        `Catálogo atual de produtos da +Saúde (ordenado por relevância): ${JSON.stringify(listaProdutos)}`
    ].join('\n');
}

const schemaRespostaMaisa = {
    type: Type.OBJECT,
    properties: {
        tem_relacao_com_catalogo: {
            type: Type.BOOLEAN,
            description: 'true somente se o assunto ou palavra-chave tiver relação com a proposta da loja e os produtos do catálogo; false se não tiver relação.'
        },
        resposta: {
            type: Type.STRING,
            description: 'Resposta única, humana e clara em português para o usuário, sem seguir template fixo.'
        },
        produtos_recomendados: {
            type: Type.ARRAY,
            maxItems: '3',
            description: 'Se tem_relacao_com_catalogo for true, exatamente 3 produtos distintos do catálogo que atendam ao problema apresentado. Se false, array vazio [].',
            items: {
                type: Type.OBJECT,
                properties: {
                    id_produto: {
                        type: Type.INTEGER,
                        description: 'ID exato do produto no catálogo.'
                    },
                    motivo: {
                        type: Type.STRING,
                        description: 'Frase curta e específica conectando este produto ao problema ou palavra-chave do usuário.'
                    }
                },
                required: ['id_produto', 'motivo']
            }
        },
        sugestoes_perguntas: {
            type: Type.ARRAY,
            minItems: '2',
            maxItems: '3',
            description: 'De 2 a 3 sugestões curtas para continuar a conversa de modo totalmente coerente com o rumo atual.',
            items: {
                type: Type.STRING
            }
        }
    },
    required: ['tem_relacao_com_catalogo', 'resposta', 'produtos_recomendados', 'sugestoes_perguntas']
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
 * Gera sugestões iniciais do chatbot usando EXCLUSIVAMENTE categorias já existentes no site,
 * ordenadas pelo mesmo algoritmo de relevância por idade e sexo (personalizacao.js).
 */
function gerarSugestoesPersonalizadas({ produtos = [], categorias = [], usuario = null }) {
    const listaCats = Array.isArray(categorias) ? categorias : [];
    const temPerfil = !!(
        usuario &&
        ((usuario.nasc && calcularIdade(usuario.nasc) !== null) ||
            (usuario.sexo && usuario.sexo !== 'prefiro-nao-dizer'))
    );

    const catsOrdenadas = temPerfil
        ? ordenarPorRelevancia(listaCats, usuario)
        : listaCats.slice();

    const topicos = [];
    const nomesUsados = new Set();

    for (const cat of catsOrdenadas) {
        const nome = cat && cat.nome ? String(cat.nome).trim() : '';
        if (!nome) continue;
        const chave = nome.toLowerCase();
        if (nomesUsados.has(chave)) continue;
        nomesUsados.add(chave);
        topicos.push({
            titulo: nome,
            pergunta: `Quero ver opções da categoria ${nome}.`
        });
        if (topicos.length >= 6) break;
    }

    const primeiroNome = usuario && usuario.nome ? String(usuario.nome).trim().split(' ')[0] : '';
    const saudacao = primeiroNome
        ? `Olá, ${primeiroNome}! Escolha uma categoria da loja abaixo ou digite o que você procura:`
        : 'Olá! Escolha uma categoria da loja abaixo ou digite o que você procura:';

    return { saudacao, topicos };
}

function normalizarTexto(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
}

const STOP_WORDS_BUSCA = new Set([
    'para', 'como', 'com', 'sem', 'uma', 'uns', 'umas', 'que', 'qual', 'quais',
    'tenho', 'quero', 'preciso', 'procuro', 'gostaria', 'uso', 'usar', 'algo',
    'mais', 'muito', 'muita', 'pouco', 'meu', 'minha', 'meus', 'minhas',
    'isso', 'este', 'esta', 'esse', 'essa', 'pode', 'sobre', 'loja', 'produto', 'produtos',
    'categoria', 'opcoes', 'ver', 'nas', 'nos', 'dos', 'das', 'pela', 'pelo'
]);

const EXPANSOES_BUSCA = {
    costas: ['lombar', 'coluna', 'postura', 'ortopedico', 'ortopedica', 'ortopedia', 'encosto', 'almofada', 'colchao', 'osseo', 'muscular', 'articular', 'articulacao', 'mobilidade', 'calcio', 'colageno', 'magnesio'],
    coluna: ['costas', 'lombar', 'postura', 'ortopedico', 'ortopedica', 'ortopedia', 'encosto', 'almofada', 'osseo', 'articular', 'articulacao', 'mobilidade', 'calcio', 'colageno'],
    lombar: ['costas', 'coluna', 'postura', 'ortopedico', 'ortopedica', 'ortopedia', 'cinta', 'almofada', 'encosto', 'osseo', 'muscular', 'articular', 'calcio', 'colageno', 'magnesio'],
    postura: ['costas', 'lombar', 'coluna', 'ortopedico', 'ortopedica', 'ortopedia', 'encosto', 'almofada'],
    dor: ['costas', 'lombar', 'ortopedico', 'ortopedica', 'ortopedia', 'almofada', 'encosto', 'articular', 'articulacao', 'muscular', 'osseo', 'colageno', 'calcio', 'magnesio'],
    dores: ['costas', 'lombar', 'ortopedico', 'ortopedica', 'ortopedia', 'almofada', 'encosto', 'articular', 'articulacao', 'muscular', 'osseo', 'colageno', 'calcio', 'magnesio'],
    andar: ['mobilidade', 'locomocao', 'bengala', 'andador', 'muleta', 'equilibrio', 'apoio'],
    caminhar: ['mobilidade', 'locomocao', 'bengala', 'andador', 'muleta', 'equilibrio', 'apoio'],
    equilibrio: ['mobilidade', 'locomocao', 'bengala', 'andador', 'apoio', 'seguranca', 'barra'],
    escorregar: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio'],
    banheiro: ['seguranca', 'barra', 'apoio', 'antiderrapante', 'tapete', 'assento', 'elevado', 'cadeira', 'banho'],
    banho: ['banheiro', 'cadeira', 'barra', 'apoio', 'antiderrapante', 'tapete', 'seguranca'],
    tombo: ['seguranca', 'queda', 'barra', 'apoio', 'antiderrapante', 'tapete', 'andador', 'bengala'],
    cair: ['seguranca', 'barra', 'apoio', 'antiderrapante', 'tapete', 'andador', 'bengala', 'locomocao'],
    sentar: ['almofada', 'ortopedico', 'ortopedica', 'ortopedia', 'assento', 'cadeira'],
    cama: ['ortopedico', 'ortopedica', 'travesseiro', 'colchao', 'grade', 'apoio', 'seguranca'],
    escada: ['seguranca', 'corrimao', 'barra', 'apoio', 'antiderrapante', 'residencial'],
    muscular: ['calcio', 'vitamina', 'magnesio', 'colageno', 'musculos', 'ortopedico'],
    musculo: ['calcio', 'vitamina', 'magnesio', 'colageno'],
    caimbra: ['calcio', 'vitamina', 'magnesio', 'circulacao', 'pernas'],
    cansaco: ['disposicao', 'energia', 'vitamina', 'pernas', 'circulacao'],
    fadiga: ['disposicao', 'energia', 'vitamina', 'multivitaminico'],
    inchaco: ['circulacao', 'pernas', 'compressao', 'meia'],
    pernas: ['circulacao', 'compressao', 'meia', 'cansaco', 'mobilidade'],
    dentadura: ['protese', 'gengiva', 'bucal'],
    protese: ['dentadura', 'gengiva', 'bucal'],
    dente: ['bucal', 'escova', 'gengiva', 'protese'],
    dentes: ['bucal', 'escova', 'gengiva', 'protese'],
    boca: ['bucal', 'gengiva', 'seca', 'xerostomia'],
    osso: ['calcio', 'vitamina', 'osseo', 'ortopedia'],
    ossos: ['calcio', 'vitamina', 'osseo', 'ortopedia'],
    joelho: ['articulacao', 'articulacoes', 'colageno', 'mobilidade', 'ortopedico', 'joelheira'],
    joelhos: ['articulacao', 'articulacoes', 'colageno', 'mobilidade', 'ortopedico', 'joelheira'],
    articulacao: ['colageno', 'mobilidade', 'ortopedia'],
    articulacoes: ['colageno', 'mobilidade', 'ortopedia'],
    coracao: ['omega', 'pressao', 'cardiovascular', 'circulacao'],
    pressao: ['arterial', 'medidor', 'aparelho', 'cardiovascular', 'omega'],
    esquecimento: ['comprimidos', 'organizador', 'memoria', 'cognitiva'],
    memoria: ['omega', 'cognitiva', 'vitamina', 'organizador'],
    pele: ['hidratante', 'locao', 'sabonete', 'protetor', 'ressecada'],
    coceira: ['hidratante', 'pele', 'sensivel', 'ureia'],
    sol: ['protetor', 'solar', 'fps', 'pele'],
    cabelo: ['shampoo', 'capilar', 'fios', 'couro'],
    queda: ['seguranca', 'barra', 'apoio', 'antiderrapante', 'andador', 'bengala', 'shampoo', 'fortificante', 'capilar', 'biotina'],
    fralda: ['intima', 'geriatrico', 'absorcao'],
    incontinencia: ['intima', 'geriatrico', 'absorcao']
};

function extrairTermosBusca(texto) {
    const textoNorm = normalizarTexto(texto);
    const termosBase = textoNorm
        .split(/\s+/)
        .filter(t => t.length >= 3 && !STOP_WORDS_BUSCA.has(t));
    return Array.from(new Set(
        termosBase.flatMap(t => [t, ...(EXPANSOES_BUSCA[t] || [])])
    ));
}

function contemTermo(textoNorm, termo) {
    if (!textoNorm || !termo) return false;
    const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|\\s)${escaped}(?:s|es)?(?=$|\\s)`).test(textoNorm);
}

function mensagemTemRelacaoComCatalogo(mensagem = '', historico = [], produtos = [], categorias = []) {
    const termos = extrairTermosBusca([
        mensagem,
        ...(Array.isArray(historico)
            ? historico.filter(h => h && h.role === 'user').slice(-2).map(h => h.texto)
            : [])
    ].join(' '));
    if (termos.length === 0) return false;

    const corpus = [
        ...(Array.isArray(produtos) ? produtos.map(p => normalizarTexto(`${p.nome} ${p.descricao} ${p.categoria}`)) : []),
        ...(Array.isArray(categorias) ? categorias.map(c => normalizarTexto(c.nome)) : [])
    ];

    return termos.some(termo => corpus.some(texto => contemTermo(texto, termo)));
}

function gerarMotivoCurto(produto, index = 0) {
    const primeiraFrase = String(produto.descricao || '').split('.')[0].trim();
    if (primeiraFrase) {
        return primeiraFrase.length > 90 ? primeiraFrase.slice(0, 87) + '...' : primeiraFrase + '.';
    }
    const variacoes = [
        `Contribui diretamente para o cuidado em ${produto.categoria || 'sua rotina'}.`,
        `Ajuda a trazer mais conforto e praticidade no dia a dia.`,
        `Opção selecionada para apoiar sua necessidade atual.`
    ];
    return variacoes[index % variacoes.length];
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
                    : gerarMotivoCurto(prod, selecionados.length)
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
    const termos = extrairTermosBusca(textoBusca);
    const querPromocao = /\b(promocao|promocoes|desconto|barato|oferta|economia|menor preco)\b/.test(textoBusca);

    const candidatos = listaCatalogo
        .filter(p => !idsUsados.has(Number(p.id_produto)))
        .map((p, idx) => {
            const nomeNorm = normalizarTexto(p.nome);
            const catNorm = normalizarTexto(p.categoria);
            const descNorm = normalizarTexto(p.descricao);
            let score = (p.status !== 'fora-de-estoque' ? 100 : 0) + (pontuar(p, perfilAlvo) * 4);
            for (const termo of termos) {
                if (contemTermo(nomeNorm, termo)) score += 16;
                if (contemTermo(catNorm, termo)) score += 10;
                if (contemTermo(descNorm, termo)) score += 6;
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
            motivo: gerarMotivoCurto(item.prod, selecionados.length)
        });
    }

    return selecionados;
}

async function consultarMaisa({ mensagem, historico = [], produtos = [], categorias = [], usuario = null }) {
    const ai = obterClienteGemini();
    const perfilAlvo = resolverPerfilAlvo(usuario, mensagem, historico);
    const systemInstruction = construirInstrucaoSistema({ produtos, categorias, usuario, perfilAlvo, historico });
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
                temperature: 0.9,
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
        const possuiRelacao = mensagemTemRelacaoComCatalogo(mensagem, historico, produtos, categorias);
        const nomesCats = (Array.isArray(categorias) ? categorias : [])
            .map(c => c && c.nome)
            .filter(Boolean)
            .slice(0, 2)
            .map(nome => `Ver ${nome}`);
        dados = {
            tem_relacao_com_catalogo: possuiRelacao,
            resposta: textoBruto || 'Desculpe, tive um problema para organizar minha resposta agora. Pode tentar enviar de novo?',
            produtos_recomendados: [],
            sugestoes_perguntas: nomesCats
        };
    }

    const temRelacao = typeof dados.tem_relacao_com_catalogo === 'boolean'
        ? dados.tem_relacao_com_catalogo
        : (Array.isArray(dados.produtos_recomendados) && dados.produtos_recomendados.length > 0) ||
          mensagemTemRelacaoComCatalogo(mensagem, historico, produtos, categorias);

    const produtosGarantidos = temRelacao
        ? garantirTresProdutos({
            recomendados: dados.produtos_recomendados,
            mensagem,
            historico,
            produtos,
            perfilAlvo
        })
        : [];

    const sugestoesLimpas = Array.isArray(dados.sugestoes_perguntas)
        ? dados.sugestoes_perguntas
            .filter(s => typeof s === 'string' && s.trim())
            .map(s => s.trim())
            .slice(0, 3)
        : [];

    return {
        tem_relacao_com_catalogo: temRelacao,
        resposta: typeof dados.resposta === 'string' ? dados.resposta : '',
        produtos_recomendados: produtosGarantidos,
        sugestoes_perguntas: sugestoesLimpas,
        perfilAlvo
    };
}

module.exports = {
    consultarMaisa,
    gerarSugestoesPersonalizadas,
    resolverPerfilAlvo,
    garantirTresProdutos,
    mensagemTemRelacaoComCatalogo
};
