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
    const matchIdade = textoCombinado.match(/(?:^|\s)(?:(\d{2})\s*anos|(\d{2})\+|(?:tem|com)\s+(\d{2}))(?=$|\s|[.,!?;:])/);
    if (matchIdade) {
        const val = parseInt(matchIdade[1] || matchIdade[2] || matchIdade[3], 10);
        if (val >= 18 && val <= 115) idadeInferida = val;
    } else if (/(?:^|\s)(?:terceira idade|idos[oa]|senhor(?:a)?|vov[ôó]|v[ôó]|av[ôó]|avo|sogr[oa]|velhinh[oa])(?=$|\s|[.,!?;:])/.test(textoCombinado)) {
        idadeInferida = 70;
    }

    let sexoInferido = null;
    if (/(?:^|\s)(?:mulher|feminino|feminina|senhora|mãe|mae|esposa|vó|vovó|avó|avoa|sogra|tia|idosa|velhinha)(?=$|\s|[.,!?;:])/.test(textoCombinado)) {
        sexoInferido = 'feminino';
    } else if (/(?:^|\s)(?:homem|masculino|masculina|senhor|pai|marido|vô|vovô|avô|avo|sogro|tio|idoso|velhinho)(?=$|\s|[.,!?;:])/.test(textoCombinado)) {
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

function normalizarLimiteSugestoes(limite) {
    if (limite === 'mobile') return 2;
    const n = Number(limite);
    if (n === 2) return 2;
    return 4;
}

function usuarioPossuiPerfil(usuario) {
    return !!(
        usuario &&
        ((usuario.nasc && calcularIdade(usuario.nasc) !== null) ||
            (usuario.sexo && usuario.sexo !== 'prefiro-nao-dizer'))
    );
}

function ordenarCategoriasParaPerfil(categorias = [], produtos = [], usuario = null) {
    const listaCats = Array.isArray(categorias) ? categorias : [];
    const listaProds = Array.isArray(produtos) ? produtos : [];
    if (!usuarioPossuiPerfil(usuario)) return listaCats.slice();

    return listaCats
        .map((cat, indice) => {
            const catScore = pontuar(cat, usuario);
            const idCat = Number(cat && cat.id_categoria);
            const nomeCatNorm = normalizarTexto(cat && cat.nome);
            let maxProdScore = -99;
            let prodMatchCount = 0;

            for (const prod of listaProds) {
                const idsStr = String(prod && prod.ids_categorias ? prod.ids_categorias : '');
                const idsArr = idsStr ? idsStr.split(',').map(s => Number(s.trim())) : [];
                const catProdNorm = normalizarTexto(prod && prod.categoria);
                const pertence = (Number.isFinite(idCat) && idCat > 0 && idsArr.includes(idCat)) ||
                    (nomeCatNorm && catProdNorm.includes(nomeCatNorm));
                if (!pertence) continue;
                const pScore = pontuar(prod, usuario);
                if (pScore > maxProdScore) maxProdScore = pScore;
                if (pScore > 0) prodMatchCount++;
            }

            return {
                cat,
                catScore,
                maxProdScore: maxProdScore === -99 ? 0 : maxProdScore,
                prodMatchCount,
                indice
            };
        })
        .sort((a, b) =>
            b.catScore - a.catScore ||
            b.maxProdScore - a.maxProdScore ||
            b.prodMatchCount - a.prodMatchCount ||
            a.indice - b.indice
        )
        .map(item => item.cat);
}

function construirInstrucaoSistema({ produtos, categorias, usuario, perfilAlvo, historico = [], quantidadeSugestoes = 4 }) {
    const { listaProdutos, listaCategorias } = resumirCatalogo(produtos, categorias, perfilAlvo);
    const idadeUsuario = perfilAlvo && perfilAlvo.nasc ? calcularIdade(perfilAlvo.nasc) : null;
    const sexoUsuario = perfilAlvo && perfilAlvo.sexo ? perfilAlvo.sexo : null;

    const sexoLegivel = sexoUsuario === 'feminino'
        ? 'feminino'
        : (sexoUsuario === 'masculino' ? 'masculino' : 'não informado');

    const nomeCliente = usuario && usuario.nome ? usuario.nome : null;
    const estaLogadoComPerfil = usuarioPossuiPerfil(usuario);
    const contextoUsuario = perfilAlvo
        ? `Perfil considerado no algoritmo de personalização${nomeCliente ? ` (Cliente logado "${nomeCliente}")` : ''}: ${idadeUsuario !== null ? `idade aproximada ${idadeUsuario} anos` : 'idade não informada'}, sexo "${sexoLegivel}" (origem: ${perfilAlvo.origem}).`
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

    const instrucaoPrioridadeSugestoes = estaLogadoComPerfil
        ? `- O cliente está LOGADO com faixa etária e sexo definidos no sistema. PRIORIZE e ORDENE as ${quantidadeSugestoes} opções de \`sugestoes_perguntas\` colocando primeiro aquelas que atendem melhor ao algoritmo de faixa etária e sexo (ligadas às categorias e produtos com maior \`pontuacao_relevancia\`), mantendo coerência com o rumo da conversa.`
        : `- Gere exatamente ${quantidadeSugestoes} sugestões curtas e naturais que continuem o rumo da conversa atual.`;

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
        'INTERPRETAÇÃO DE PALAVRAS-CHAVE E FRASES INDIRETAS / INFORMAÇÕES PRESSUPOSTAS (MUITO IMPORTANTE):',
        '- Os clientes (ou familiares) raramente pedem o nome exato de um produto; muitas vezes mandam apenas palavras-chave ("dor nas costas", "pele seca") OU contam situações cotidianas com necessidades IMPLÍCITAS/PRESSUPOSTAS.',
        '- Nunca peça para explicar melhor antes de ajudar, e NUNCA considere um relato indireto sobre queda, dificuldade física, rotina ou medo do idoso como "fora do catálogo".',
        '- Sempre deduza: (1) quem precisa de cuidado e seu perfil implícito, (2) o risco ou necessidade pressuposta, (3) uma orientação humana e responsável (incluindo avaliar médico se houver queda recente, tontura ou dor intensa), e (4) conecte com 3 produtos reais do catálogo JSON que ajudem na prevenção, apoio, recuperação ou conforto.',
        '- Exemplos de frases indiretas e como raciocinar (use a mesma lógica para qualquer variação semelhante):',
        '  • "Meu vô caiu" / "Minha mãe levou um tombo" / "Ele quase escorregou ontem": pressupõe risco de novas quedas, perda de equilíbrio/força, insegurança ao andar ou no banheiro e possível impacto/fraqueza óssea/muscular -> acolha, lembre de observar sinais de dor/tontura com um médico e indique produtos do catálogo voltados a segurança, prevenção de quedas, apoio no banheiro/casa, mobilidade, ortopedia, pressão arterial (tontura) ou fortalecimento ósseo/articular, conforme o que existir no catálogo JSON.',
        '  • "Minha vó tem medo de tomar banho sozinha" / "O box fica muito liso": pressupõe risco de escorregamento -> indique prevenção no banheiro, apoio, firmeza e estabilidade.',
        '  • "Ele não consegue levantar direito da cama / sofá / vaso": pressupõe perda de força, mobilidade reduzida ou dor articular -> conecte a apoio de locomoção/segurança/ortopedia ou mobilidade articular.',
        '  • "Ela fica o dia todo sentada reclamando" / "Acorda toda travada": pressupõe desconforto na coluna/postura, articulações ou circulação -> conecte a ortopedia/conforto ou suporte articular/circulatório.',
        '  • "Meu pai anda meio tonto às vezes": pressupõe necessidade de acompanhar pressão arterial e garantir apoio seguro contra quedas (sempre orientando consulta médica).',
        '  • "Ele sempre esquece se já tomou o remédio" / "Não enxerga os números pequenos": pressupõe dificuldade de memória, rotina ou leitura -> conecte a organização de comprimidos, visor/letras grandes ou suporte cognitivo.',
        '  • "À noite ele levanta no escuro para ir ao banheiro": pressupõe risco de tropeço noturno, insegurança residencial e apoio ao caminhar.',
        '  • "A pele dela machuca/coça fácil" / "Evita comida dura porque machuca a boca" / "Anda sem forças": pressupõe ressecamento/sensibilidade da pele, cuidado com prótese/gengiva/boca seca ou reposição vitamínica/energia.',
        '',
        'REGRA DE PERTINÊNCIA AO CATÁLOGO (OBRIGATÓRIO):',
        '- Defina `tem_relacao_com_catalogo = true` sempre que a mensagem trouxer uma necessidade DIRETA ou INDIRETA/PRESSUPOSTA ligada a saúde, quedas, tombos, medo de cair, tontura, dor, postura, mobilidade, banheiro, segurança em casa, cuidados com idosos/familiares, pele, higiene bucal, cabelo, memória, pressão ou bem-estar.',
        '- Quando `tem_relacao_com_catalogo = true`: recomende SEMPRE exatamente 3 produtos distintos do catálogo em "produtos_recomendados", priorizando itens "em-estoque" e de maior `pontuacao_relevancia`. Se citar algum item fora de estoque, avise brevemente.',
        '- Defina `tem_relacao_com_catalogo = false` SOMENTE quando o assunto for realmente alheio ao universo da loja (ex.: receita culinária, resultado de futebol, conserto de celular/carro, programação, conta matemática, piada sem vínculo com cuidados). Nesse caso, retorne `produtos_recomendados: []` e apresente com gentileza o que a +Saúde oferece.',
        '',
        'ALGORITMO DE PERSONALIZAÇÃO POR IDADE E SEXO:',
        '- O catálogo JSON abaixo JÁ ESTÁ ORDENADO pelo algoritmo oficial de personalização (`pontuacao_relevancia`: +3 faixa etária compatível, +2 sexo compatível, 0 neutro, -1 incompatível).',
        '- Dê preferência aos itens com maior `pontuacao_relevancia` (>= 0). Considere as necessidades recorrentes da faixa etária e sexo do perfil quando estiverem disponíveis, adaptando a escolha ao que existe no catálogo.',
        '- Nunca diagnostique doenças nem prescreva medicamentos.',
        '',
        'SUGESTÕES DE CONTINUAÇÃO COERENTES (`sugestoes_perguntas`):',
        `- Forneça EXATAMENTE ${quantidadeSugestoes} sugestões curtas e distintas para continuar a conversa.`,
        instrucaoPrioridadeSugestoes,
        '- As sugestões devem seguir o rumo da conversa atual (ex.: explorar um cuidado próximo ao problema citado, tirar dúvida sobre uso, filtrar conforto/rotina dentro do mesmo assunto).',
        '- NUNCA coloque sugestões genéricas fora do contexto (como "Ver promoções" se o assunto não for preço).',
        `- Se \`tem_relacao_com_catalogo\` for false, gere exatamente ${quantidadeSugestoes} caminhos baseados nas categorias reais existentes no site para ajudar o cliente a voltar ao catálogo.`,
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

function criarSchemaRespostaMaisa(quantidadeSugestoes = 4) {
    const qtd = normalizarLimiteSugestoes(quantidadeSugestoes);
    return {
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
                minItems: String(qtd),
                maxItems: String(qtd),
                description: `Exatamente ${qtd} sugestões curtas, ordenadas da mais aderente ao perfil (faixa etária e sexo, se logado) e ao rumo da conversa.`,
                items: {
                    type: Type.STRING
                }
            }
        },
        required: ['tem_relacao_com_catalogo', 'resposta', 'produtos_recomendados', 'sugestoes_perguntas']
    };
}

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
 * ordenadas pelo mesmo algoritmo de relevância por idade e sexo (personalizacao.js)
 * e limitadas a 4 em desktop ou 2 em dispositivos móveis.
 */
function gerarSugestoesPersonalizadas({ produtos = [], categorias = [], usuario = null, limite = 4 }) {
    const limiteFinal = normalizarLimiteSugestoes(limite);
    const catsOrdenadas = ordenarCategoriasParaPerfil(categorias, produtos, usuario);

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
        if (topicos.length >= limiteFinal) break;
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
    'para', 'como', 'com', 'sem', 'uma', 'uns', 'umas', 'que', 'qual', 'quais', 'quem',
    'onde', 'quando', 'porque', 'por', 'tenho', 'tem', 'tinha', 'teve', 'quero', 'preciso',
    'procuro', 'gostaria', 'uso', 'usar', 'algo', 'mais', 'muito', 'muita', 'pouco',
    'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas', 'dele', 'dela',
    'voce', 'voces', 'eles', 'elas', 'nosso', 'nossa', 'tudo', 'nada', 'cada', 'todo',
    'toda', 'todos', 'todas', 'isso', 'isto', 'aqui', 'ali', 'este', 'esta', 'estao',
    'estava', 'esse', 'essa', 'pode', 'podem', 'deve', 'devem', 'sobre', 'loja',
    'produto', 'produtos', 'categoria', 'opcoes', 'ver', 'viu', 'nas', 'nos', 'dos',
    'das', 'pela', 'pelo', 'ontem', 'hoje', 'amanha', 'agora', 'sempre', 'nunca',
    'vezes', 'ficou', 'fica', 'ficar', 'foi', 'ser', 'sao', 'era', 'fazer', 'fez',
    'faz', 'dar', 'deu', 'saber', 'sabe', 'tambem', 'muitas', 'muitos', 'apenas'
]);

const EXPANSOES_BUSCA = {
    vo: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia', 'monitoramento'],
    vovo: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia', 'monitoramento'],
    avo: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia', 'monitoramento'],
    idoso: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia', 'monitoramento'],
    idosa: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia', 'monitoramento'],
    velhinho: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia'],
    velhinha: ['terceira', 'idade', '60', 'seguranca', 'mobilidade', 'ortopedia'],
    caiu: ['seguranca', 'banheiro', 'residencial', 'barra', 'apoio', 'antiderrapante', 'tapete', 'mobilidade', 'locomocao', 'bengala', 'andador', 'ortopedia', 'osseo', 'calcio', 'articulacao', 'colageno', 'terceira', 'idade'],
    cai: ['seguranca', 'banheiro', 'residencial', 'barra', 'apoio', 'antiderrapante', 'mobilidade', 'locomocao', 'bengala', 'andador', 'ortopedia', 'osseo', 'calcio'],
    caindo: ['seguranca', 'banheiro', 'residencial', 'barra', 'apoio', 'antiderrapante', 'mobilidade', 'locomocao', 'bengala', 'andador', 'ortopedia'],
    caia: ['seguranca', 'banheiro', 'residencial', 'barra', 'apoio', 'antiderrapante', 'mobilidade', 'locomocao', 'bengala', 'andador'],
    tropecou: ['seguranca', 'residencial', 'antiderrapante', 'tapete', 'barra', 'apoio', 'mobilidade', 'locomocao', 'bengala', 'andador'],
    tropecar: ['seguranca', 'residencial', 'antiderrapante', 'tapete', 'barra', 'apoio', 'mobilidade', 'bengala', 'andador'],
    tropecando: ['seguranca', 'residencial', 'antiderrapante', 'tapete', 'mobilidade', 'bengala', 'andador'],
    escorregou: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio', 'mobilidade'],
    escorregando: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio'],
    escorregadio: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio'],
    liso: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio'],
    molhado: ['seguranca', 'banheiro', 'antiderrapante', 'tapete', 'barra', 'apoio'],
    tonto: ['pressao', 'arterial', 'medidor', 'aparelho', 'monitoramento', 'seguranca', 'apoio', 'mobilidade', 'omega', 'vitamina'],
    tonta: ['pressao', 'arterial', 'medidor', 'aparelho', 'monitoramento', 'seguranca', 'apoio', 'mobilidade', 'omega', 'vitamina'],
    tontura: ['pressao', 'arterial', 'medidor', 'aparelho', 'monitoramento', 'seguranca', 'apoio', 'mobilidade', 'omega', 'vitamina'],
    desequilibrio: ['seguranca', 'barra', 'apoio', 'mobilidade', 'locomocao', 'bengala', 'andador'],
    levantar: ['mobilidade', 'locomocao', 'apoio', 'barra', 'grade', 'ortopedia', 'ortopedico', 'articulacao', 'colageno'],
    levantando: ['mobilidade', 'locomocao', 'apoio', 'barra', 'grade', 'ortopedia', 'ortopedico', 'articulacao'],
    sozinho: ['seguranca', 'banheiro', 'residencial', 'apoio', 'barra', 'antiderrapante', 'mobilidade', 'monitoramento'],
    sozinha: ['seguranca', 'banheiro', 'residencial', 'apoio', 'barra', 'antiderrapante', 'mobilidade', 'monitoramento'],
    medo: ['seguranca', 'banheiro', 'residencial', 'apoio', 'barra', 'antiderrapante', 'mobilidade'],
    escuro: ['seguranca', 'residencial', 'banheiro', 'apoio', 'barra'],
    noite: ['seguranca', 'residencial', 'banheiro', 'apoio', 'absorcao', 'noturna', 'intima'],
    esquece: ['organizador', 'comprimidos', 'letra', 'monitoramento', 'memoria', 'omega'],
    esquecendo: ['organizador', 'comprimidos', 'letra', 'monitoramento', 'memoria', 'omega'],
    esqueci: ['organizador', 'comprimidos', 'letra', 'monitoramento', 'memoria'],
    remedio: ['organizador', 'comprimidos', 'monitoramento', 'boca', 'seca'],
    remedios: ['organizador', 'comprimidos', 'monitoramento', 'boca', 'seca'],
    enxerga: ['visor', 'grande', 'letra', 'organizador', 'aparelho', 'pressao'],
    enxergo: ['visor', 'grande', 'letra', 'organizador', 'aparelho', 'pressao'],
    pequeno: ['visor', 'grande', 'letra', 'organizador', 'aparelho'],
    pequena: ['visor', 'grande', 'letra', 'organizador', 'aparelho'],
    mastigar: ['protese', 'dentadura', 'gengiva', 'bucal', 'macia'],
    travado: ['articulacao', 'articulacoes', 'colageno', 'mobilidade', 'ortopedia', 'ortopedico'],
    travada: ['articulacao', 'articulacoes', 'colageno', 'mobilidade', 'ortopedia', 'ortopedico'],
    fraco: ['vitamina', 'multivitaminico', 'calcio', 'mobilidade', 'bengala', 'andador', 'apoio', 'seguranca'],
    fraca: ['vitamina', 'multivitaminico', 'calcio', 'mobilidade', 'bengala', 'andador', 'apoio', 'seguranca'],
    fraqueza: ['vitamina', 'multivitaminico', 'calcio', 'mobilidade', 'bengala', 'andador', 'apoio', 'seguranca'],
    falhando: ['mobilidade', 'locomocao', 'bengala', 'andador', 'apoio', 'seguranca', 'calcio', 'colageno'],
    rasga: ['pele', 'hidratante', 'locao', 'sabonete', 'sensivel', 'madura'],
    ressecado: ['pele', 'hidratante', 'locao', 'sabonete', 'ureia', 'sensivel'],
    ressecada: ['pele', 'hidratante', 'locao', 'sabonete', 'ureia', 'sensivel'],
    pe: ['meia', 'compressao', 'pernas', 'circulacao', 'ortopedico', 'antiderrapante'],
    pes: ['meia', 'compressao', 'pernas', 'circulacao', 'ortopedico', 'antiderrapante'],
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
        .filter(t => (t.length >= 3 || Object.prototype.hasOwnProperty.call(EXPANSOES_BUSCA, t)) && !STOP_WORDS_BUSCA.has(t));
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

function pontuarSugestaoPorPerfil(textoSugestao, { usuario = null, produtos = [], categorias = [] }) {
    if (!usuarioPossuiPerfil(usuario)) return 0;

    const textoNorm = normalizarTexto(textoSugestao);
    const termos = extrairTermosBusca(textoSugestao);
    let melhorScore = 0;

    for (const cat of Array.isArray(categorias) ? categorias : []) {
        const catNorm = normalizarTexto(cat && cat.nome);
        const bateCat = (catNorm && textoNorm.includes(catNorm)) ||
            termos.some(t => contemTermo(catNorm, t));
        if (bateCat) {
            const s = pontuar(cat, usuario);
            if (s > melhorScore) melhorScore = s;
        }
    }

    for (const prod of Array.isArray(produtos) ? produtos : []) {
        const prodNorm = normalizarTexto(`${prod && prod.nome} ${prod && prod.categoria} ${prod && prod.descricao}`);
        const bateProd = termos.some(t => contemTermo(prodNorm, t));
        if (bateProd) {
            const s = pontuar(prod, usuario);
            if (s > melhorScore) melhorScore = s;
        }
    }

    const idade = usuario && usuario.nasc ? calcularIdade(usuario.nasc) : null;
    if (idade !== null && idade >= 60 && /\b(60|idos|terceira idade)\b/.test(textoNorm)) {
        melhorScore += 2;
    }
    if (usuario && usuario.sexo === 'feminino' && /\b(mulher|feminin)\b/.test(textoNorm)) {
        melhorScore += 2;
    } else if (usuario && usuario.sexo === 'masculino' && /\b(homem|masculin)\b/.test(textoNorm)) {
        melhorScore += 2;
    }

    return melhorScore;
}

function priorizarEGarantirSugestoes({ sugestoes = [], quantidade = 4, usuario = null, produtos = [], categorias = [] }) {
    const qtd = normalizarLimiteSugestoes(quantidade);
    const unicas = [];
    const vistas = new Set();

    for (const s of Array.isArray(sugestoes) ? sugestoes : []) {
        if (typeof s !== 'string') continue;
        const limpo = s.trim();
        if (!limpo) continue;
        const chave = limpo.toLowerCase();
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        unicas.push(limpo);
    }

    const ordenadas = usuarioPossuiPerfil(usuario)
        ? unicas
            .map((texto, idx) => ({
                texto,
                score: pontuarSugestaoPorPerfil(texto, { usuario, produtos, categorias }),
                idx
            }))
            .sort((a, b) => b.score - a.score || a.idx - b.idx)
            .map(item => item.texto)
        : unicas;

    if (ordenadas.length < qtd) {
        const catsOrdenadas = ordenarCategoriasParaPerfil(categorias, produtos, usuario);
        for (const cat of catsOrdenadas) {
            if (ordenadas.length >= qtd) break;
            const nome = cat && cat.nome ? String(cat.nome).trim() : '';
            if (!nome) continue;
            const opcao = `Ver ${nome}`;
            if (!vistas.has(opcao.toLowerCase())) {
                vistas.add(opcao.toLowerCase());
                ordenadas.push(opcao);
            }
        }
    }

    return ordenadas.slice(0, qtd);
}

async function consultarMaisa({ mensagem, historico = [], produtos = [], categorias = [], usuario = null, limiteSugestoes = 4 }) {
    const ai = obterClienteGemini();
    const quantidadeSugestoes = normalizarLimiteSugestoes(limiteSugestoes);
    const perfilAlvo = resolverPerfilAlvo(usuario, mensagem, historico);
    const systemInstruction = construirInstrucaoSistema({
        produtos,
        categorias,
        usuario,
        perfilAlvo,
        historico,
        quantidadeSugestoes
    });
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
                responseSchema: criarSchemaRespostaMaisa(quantidadeSugestoes)
            }
        })
    );

    const textoBruto = (response && response.text ? response.text : '').trim();
    let dados;
    try {
        dados = JSON.parse(textoBruto);
    } catch (_) {
        const possuiRelacao = mensagemTemRelacaoComCatalogo(mensagem, historico, produtos, categorias);
        dados = {
            tem_relacao_com_catalogo: possuiRelacao,
            resposta: textoBruto || 'Desculpe, tive um problema para organizar minha resposta agora. Pode tentar enviar de novo?',
            produtos_recomendados: [],
            sugestoes_perguntas: []
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

    const sugestoesPriorizadas = priorizarEGarantirSugestoes({
        sugestoes: dados.sugestoes_perguntas,
        quantidade: quantidadeSugestoes,
        usuario,
        produtos,
        categorias
    });

    return {
        tem_relacao_com_catalogo: temRelacao,
        resposta: typeof dados.resposta === 'string' ? dados.resposta : '',
        produtos_recomendados: produtosGarantidos,
        sugestoes_perguntas: sugestoesPriorizadas,
        perfilAlvo
    };
}

module.exports = {
    consultarMaisa,
    gerarSugestoesPersonalizadas,
    resolverPerfilAlvo,
    garantirTresProdutos,
    mensagemTemRelacaoComCatalogo,
    priorizarEGarantirSugestoes,
    normalizarLimiteSugestoes
};
