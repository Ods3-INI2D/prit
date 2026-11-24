const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const MODELO_BASE_CATEGORIA = 'gemini-4-hydrogen';
const ARQUIVO_BASE = path.join(__dirname, '..', 'data', 'categorias_conhecimento.json');

let cacheMemoria = null;

function normalizarTextoBasico(str) {
    return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .trim();
}

const ONTOLOGIA_DOMINIOS = [
    {
        gatilhos: ['diabetes', 'diabetico', 'glicemia', 'glicose', 'acucar', 'endocrino'],
        termos: ['diabetes', 'diabetico', 'diabetica', 'glicemia', 'glicose', 'acucar', 'insulina', 'lanceta', 'tiras', 'glicosimetro', 'zero acucar', 'sem acucar', 'pe diabetico'],
        problemas: ['controle da glicemia', 'medição de açúcar no sangue', 'cuidado com pés e pele sensível', 'consumo seguro sem açúcar'],
        frases_indiretas: ['meu açúcar anda alto', 'preciso controlar a glicose', 'não posso usar nada com açúcar', 'tenho formigamento nos pés', 'preciso furar o dedo todo dia'],
        orientacao: 'Apoiar o acompanhamento diário da glicemia e o cuidado delicado com pele e pés, sempre recomendando seguir orientação médica.'
    },
    {
        gatilhos: ['visao', 'olhos', 'ocular', 'lupa', 'leitura', 'oculos'],
        termos: ['visao', 'olhos', 'ocular', 'enxergar', 'lupa', 'leitura', 'letras grandes', 'visor grande', 'colirio', 'ressecamento ocular'],
        problemas: ['dificuldade para ler letras miúdas', 'cansaço visual', 'olho seco', 'leitura de bulas e rótulos'],
        frases_indiretas: ['não consigo ler as letras pequenas', 'a vista anda embaçada', 'meus olhos ardem muito', 'não enxergo os números na tela'],
        orientacao: 'Priorizar itens com números e letras ampliadas e conforto ocular, lembrando avaliação oftalmológica em mudanças de visão.'
    },
    {
        gatilhos: ['audicao', 'auditivo', 'ouvido', 'surdez', 'aparelho auditivo'],
        termos: ['audicao', 'auditivo', 'ouvido', 'escutar', 'ouvir', 'zumbido', 'pilha auditiva', 'cera'],
        problemas: ['dificuldade para ouvir conversas', 'manutenção de aparelho auditivo', 'sensibilidade no ouvido'],
        frases_indiretas: ['meu vô não escuta direito a TV', 'ele pede para repetir tudo', 'a pilha do aparelho acabou rápido'],
        orientacao: 'Facilitar cuidados práticos com a audição e dispositivos de apoio, sugerindo consulta com otorrinolaringologista quando necessário.'
    },
    {
        gatilhos: ['respiratorio', 'respiracao', 'pulmao', 'inalador', 'nebulizador', 'oximetro', 'asma'],
        termos: ['respiratorio', 'respiracao', 'inalador', 'nebulizador', 'oximetro', 'oxigenio', 'falta de ar', 'tosse', 'nariz', 'soro'],
        problemas: ['desconforto respiratório', 'acompanhamento de oxigenação', 'alívio de vias aéreas e nariz entupido'],
        frases_indiretas: ['ele anda cansado para respirar', 'fica com chiado no peito no frio', 'o ar seco atrapalha à noite'],
        orientacao: 'Auxiliar no acompanhamento e conforto respiratório em casa; falta de ar súbita exige atendimento médico imediato.'
    },
    {
        gatilhos: ['sono', 'insonia', 'dormir', 'descanso', 'travesseiro', 'colchao'],
        termos: ['sono', 'insonia', 'dormir', 'descanso', 'travesseiro', 'colchao', 'ronco', 'noturno', 'relaxamento', 'madrugada'],
        problemas: ['dificuldade para dormir', 'desconforto na cama', 'acordar com dores no pescoço ou costas'],
        frases_indiretas: ['não consigo pregar o olho de noite', 'acordo todo quebrado da cama', 'ele vira muito na cama de madrugada'],
        orientacao: 'Promover ergonomia ao deitar e rotina tranquila antes de dormir.'
    },
    {
        gatilhos: ['fisioterapia', 'reabilitacao', 'exercicio', 'alongamento', 'fortalecimento', 'terapia'],
        termos: ['fisioterapia', 'reabilitacao', 'exercicio', 'alongamento', 'fortalecimento', 'elastico', 'faixa', 'bolinha', 'recuperacao', 'movimento'],
        problemas: ['recuperação de movimentos', 'fraqueza muscular', 'rigidez após ficar muito tempo parado'],
        frases_indiretas: ['perdeu força no braço depois da cirurgia', 'precisa mexer mais as pernas em casa', 'a mão está sem firmeza'],
        orientacao: 'Apoiar exercícios leves e seguros no dia a dia seguindo a orientação do fisioterapeuta ou médico.'
    },
    {
        gatilhos: ['ortopedia', 'ortopedico', 'conforto', 'coluna', 'lombar', 'postura', 'articulacao'],
        termos: ['ortopedia', 'ortopedico', 'ortopedica', 'coluna', 'lombar', 'costas', 'postura', 'almofada', 'encosto', 'joelheira', 'tala', 'munhequeira', 'assento'],
        problemas: ['dor nas costas ou lombar', 'desconforto ao ficar sentado muito tempo', 'apoio para articulações e postura'],
        frases_indiretas: ['minhas costas doem quando fico sentado', 'acorda travado da coluna', 'o joelho falha ao subir escada'],
        orientacao: 'Indicar apoios ergonômicos que aliviem a sobrecarga em coluna, quadris e articulações.'
    },
    {
        gatilhos: ['mobilidade', 'locomocao', 'bengala', 'andador', 'cadeira', 'muleta', 'terceira idade', 'idoso', 'idosa'],
        termos: ['mobilidade', 'locomocao', 'bengala', 'andador', 'muleta', 'cadeira de rodas', 'caminhar', 'equilibrio', 'apoio', 'firmeza', 'terceira idade'],
        problemas: ['insegurança ao caminhar', 'perda de equilíbrio', 'dificuldade para levantar ou andar sozinho'],
        frases_indiretas: ['meu vô caiu', 'ele anda meio bambo', 'tem medo de sair andando sozinho pela casa', 'cansa rápido ao caminhar'],
        orientacao: 'Priorizar estabilidade e autonomia segura ao caminhar e levantar, evitando quedas.'
    },
    {
        gatilhos: ['monitoramento', 'aferidor', 'medidor', 'termometro', 'pressao', 'oximetro'],
        termos: ['monitoramento', 'aparelho de pressao', 'termometro', 'oximetro', 'glicosimetro', 'visor grande', 'memoria', 'organizador de comprimidos', 'febre', 'batimentos'],
        problemas: ['acompanhar sinais vitais em casa', 'enxergar resultados com facilidade', 'organizar horários de remédios'],
        frases_indiretas: ['meu pai anda meio tonto às vezes', 'não enxergo os números pequenos', 'ele sempre esquece se já tomou o remédio', 'acho que está com febre'],
        orientacao: 'Indicar aparelhos de leitura fácil e organizadores práticos para rotina segura em casa.'
    },
    {
        gatilhos: ['seguranca', 'banheiro', 'residencial', 'queda', 'antiderrapante', 'barra'],
        termos: ['seguranca', 'banheiro', 'residencial', 'barra', 'apoio', 'antiderrapante', 'tapete', 'queda', 'tombo', 'escorregar', 'corrimao', 'grade'],
        problemas: ['risco de escorregar no banho', 'quedas dentro de casa', 'levantar do vaso ou da cama com segurança'],
        frases_indiretas: ['minha vó tem medo de tomar banho sozinha', 'o chão do banheiro é muito liso', 'ele levanta no escuro de madrugada', 'meu vô caiu ontem'],
        orientacao: 'Reforçar prevenção de tombos e escorregões nos pontos mais críticos da casa, especialmente banheiro e quarto.'
    },
    {
        gatilhos: ['curativo', 'ferida', 'cicatrizacao', 'pos cirurgico', 'cirurgia', 'enfermagem'],
        termos: ['curativo', 'ferida', 'gaze', 'atadura', 'esparadrapo', 'cicatrizacao', 'assepsia', 'antisseptico', 'pos operatorio', 'cirurgia'],
        problemas: ['proteção de pele machucada', 'troca de curativos delicados', 'cuidado pós-operatório em casa'],
        frases_indiretas: ['a pele dela abriu com uma batida leve', 'preciso proteger um machucado sem arrancar a pele', 'saiu do hospital agora'],
        orientacao: 'Usar materiais suaves e hipoalergênicos que não machuquem a pele frágil na remoção.'
    },
    {
        gatilhos: ['alimentacao', 'nutricao', 'suplemento', 'vitamina', 'proteina', 'energia'],
        termos: ['alimentacao', 'nutricao', 'suplemento', 'suplementos', 'vitamina', 'vitaminas', 'proteina', 'calcio', 'ferro', 'disposicao', 'apetite', 'fraqueza'],
        problemas: ['falta de apetite ou energia', 'perda de massa muscular', 'reforço nutricional na terceira idade'],
        frases_indiretas: ['ela não quer comer direito e está fraca', 'anda sem disposição o dia todo', 'o médico pediu reforço de vitaminas'],
        orientacao: 'Complementar a alimentação diária com praticidade, mantendo acompanhamento médico ou nutricional.'
    },
    {
        gatilhos: ['coracao', 'cardiologia', 'pressao', 'circulacao', 'vascular'],
        termos: ['coracao', 'pressao', 'arterial', 'hipertensao', 'circulacao', 'inchaco', 'pernas', 'meia de compressao', 'omega', 'batimentos'],
        problemas: ['controle da pressão em casa', 'inchaço e cansaço nas pernas', 'cuidado cardiovascular diário'],
        frases_indiretas: ['anda meio tonto às vezes', 'os pés ficam inchados no fim do dia', 'precisa anotar a pressão todo dia'],
        orientacao: 'Facilitar o monitoramento rotineiro em casa e o conforto circulatório, sempre orientando acompanhamento médico.'
    },
    {
        gatilhos: ['pele', 'dermatologia', 'hidratacao', 'solar', 'banho'],
        termos: ['pele', 'hidratante', 'locao', 'sabonete', 'protetor solar', 'ressecada', 'coceira', 'sensivel', 'madura', 'ureia'],
        problemas: ['ressecamento intenso', 'coceira e sensibilidade', 'proteção contra o sol em pele fina'],
        frases_indiretas: ['a pele dele descasca muito', 'coça os braços à noite', 'cheiro forte dá alergia nela'],
        orientacao: 'Preferir fórmulas neutras, sem fragrância agressiva e fáceis de espalhar.'
    },
    {
        gatilhos: ['bucal', 'dente', 'dentes', 'gengiva', 'protese', 'dentadura', 'boca'],
        termos: ['bucal', 'dente', 'dentes', 'gengiva', 'protese', 'dentadura', 'boca seca', 'escova', 'enxaguante'],
        problemas: ['sensibilidade na gengiva', 'fixação e limpeza de prótese', 'boca seca causada por medicamentos'],
        frases_indiretas: ['a dentadura fica saindo do lugar', 'acorda com a boca toda seca', 'a escova normal machuca a gengiva'],
        orientacao: 'Garantir higiene suave sem álcool ou abrasivos fortes e apoio confortável para próteses.'
    },
    {
        gatilhos: ['cabelo', 'capilar', 'couro cabeludo'],
        termos: ['cabelo', 'cabelos', 'capilar', 'shampoo', 'fios', 'grisalhos', 'queda de cabelo', 'couro cabeludo'],
        problemas: ['fios finos e quebradiços', 'couro cabeludo sensível', 'ressecamento capilar'],
        frases_indiretas: ['o cabelo está caindo muito no pente', 'o couro cabeludo fica irritado com shampoo comum'],
        orientacao: 'Usar limpeza suave e fortificante com frascos fáceis de abrir.'
    },
    {
        gatilhos: ['incontinencia', 'fralda', 'urologia', 'geriatrico', 'higiene intima'],
        termos: ['incontinencia', 'fralda', 'roupa intima', 'absorvente', 'escape', 'urina', 'noturno', 'geriatrico'],
        problemas: ['escapes urinários diurnos ou noturnos', 'assaduras e odores', 'autonomia para vestir sozinho'],
        frases_indiretas: ['não dá tempo de chegar ao banheiro de noite', 'tem vergonha de usar fralda comum', 'acorda com a cama molhada'],
        orientacao: 'Priorizar conforto respirável, discrição no vestir e proteção da pele.'
    }
];

function lerStoreArquivo() {
    if (cacheMemoria) return cacheMemoria;
    try {
        if (fs.existsSync(ARQUIVO_BASE)) {
            const bruto = fs.readFileSync(ARQUIVO_BASE, 'utf8');
            const parsed = JSON.parse(bruto);
            if (parsed && typeof parsed === 'object') {
                cacheMemoria = parsed;
                return cacheMemoria;
            }
        }
    } catch (_) {
        // usa objeto vazio em memória
    }
    cacheMemoria = {};
    return cacheMemoria;
}

function salvarStoreArquivo(store) {
    cacheMemoria = store;
    try {
        const dir = path.dirname(ARQUIVO_BASE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(ARQUIVO_BASE, JSON.stringify(store, null, 2), 'utf8');
    } catch (_) {
        // fallback silencioso em memória se o sistema de arquivos não permitir escrita
    }
}

const STOP_WORDS_CATEGORIA = new Set([
    'com', 'sem', 'para', 'por', 'dos', 'das', 'nos', 'nas', 'que', 'uma', 'uns', 'umas',
    'sobre', 'entre', 'mais', 'menos', 'todo', 'toda', 'todos', 'todas', 'cuidado', 'cuidados',
    'higiene', 'saude', 'bem', 'estar', 'geral', 'gerais', 'uso', 'diario', 'diaria', 'linha', 'produtos'
]);

function contemFraseExata(textoNorm, fraseNorm) {
    if (!textoNorm || !fraseNorm) return false;
    return (` ${textoNorm} `).includes(` ${fraseNorm} `);
}

function gerarConhecimentoDeterministico(categoria) {
    const nome = String(categoria && categoria.nome ? categoria.nome : '').trim();
    const nomeNorm = normalizarTextoBasico(nome);
    const palavrasNome = nomeNorm
        .split(/\s+/)
        .filter(p => p.length >= 3 && !STOP_WORDS_CATEGORIA.has(p));

    const termosSet = new Set(palavrasNome);
    const problemasSet = new Set();
    const frasesSet = new Set();
    const orientacoes = [];

    for (const dom of ONTOLOGIA_DOMINIOS) {
        const bate = dom.gatilhos.some(g => {
            const gNorm = normalizarTextoBasico(g);
            if (!gNorm) return false;
            if (contemFraseExata(nomeNorm, gNorm)) return true;
            if (gNorm.includes(' ')) return false;
            return palavrasNome.some(p =>
                p === gNorm ||
                (p.length >= 5 && gNorm.length >= 5 && (p.startsWith(gNorm.slice(0, 5)) || gNorm.startsWith(p.slice(0, 5))))
            );
        });
        if (bate) {
            dom.termos.forEach(t => termosSet.add(t));
            dom.problemas.forEach(pr => problemasSet.add(pr));
            dom.frases_indiretas.forEach(fr => frasesSet.add(fr));
            if (dom.orientacao) orientacoes.push(dom.orientacao);
        }
    }

    if (problemasSet.size === 0 && nome) {
        problemasSet.add(`necessidades relacionadas a ${nome}`);
        problemasSet.add(`cuidados diários e prevenção em ${nome}`);
    }

    if (frasesSet.size === 0 && nome) {
        frasesSet.add(`preciso de ajuda com ${nome.toLowerCase()}`);
        frasesSet.add(`estou tendo dificuldade ligada a ${nome.toLowerCase()}`);
    }

    return {
        id_categoria: categoria && categoria.id_categoria ? Number(categoria.id_categoria) : null,
        nome,
        slug: categoria && categoria.slug ? String(categoria.slug) : nomeNorm.replace(/\s+/g, '-'),
        faixa_etaria: categoria && categoria.faixa_etaria ? categoria.faixa_etaria : null,
        sexo: categoria && categoria.sexo ? categoria.sexo : null,
        termos_relacionados: Array.from(termosSet).slice(0, 18),
        problemas_atendidos: Array.from(problemasSet).slice(0, 6),
        frases_indiretas: Array.from(frasesSet).slice(0, 8),
        orientacao_cuidado: orientacoes[0] || `Relacionar demandas práticas do dia a dia do público-alvo aos itens da categoria ${nome}.`,
        origem: 'automatica',
        atualizado_em: new Date().toISOString()
    };
}

const schemaConhecimentoCategoria = {
    type: Type.OBJECT,
    properties: {
        termos_relacionados: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Lista de 8 a 14 palavras-chave, sintomas e sinônimos populares em português ligados à categoria.'
        },
        problemas_atendidos: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'De 3 a 5 problemas ou necessidades reais que essa categoria ajuda a resolver.'
        },
        frases_indiretas: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'De 4 a 6 frases cotidianas indiretas que um cliente idoso ou familiar diria sem citar o produto diretamente.'
        },
        orientacao_cuidado: {
            type: Type.STRING,
            description: 'Uma frase curta de orientação prática e segura para essa categoria.'
        }
    },
    required: ['termos_relacionados', 'problemas_atendidos', 'frases_indiretas', 'orientacao_cuidado']
};

async function enriquecerCategoriaComIA(categoria) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || !categoria || !categoria.nome) return null;

    try {
        const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
                headers: { 'User-Agent': 'aistudio-build' }
            }
        });

        const prompt = [
            `Uma nova categoria foi cadastrada na loja de saúde e bem-estar +Saúde (voltada principalmente para o público idoso): "${categoria.nome}".`,
            categoria.faixa_etaria ? `Faixa etária alvo: ${categoria.faixa_etaria}.` : '',
            categoria.sexo ? `Sexo alvo: ${categoria.sexo}.` : '',
            'Gere uma base de conhecimento prática em português do Brasil com palavras-chave populares, problemas comuns que essa categoria resolve, frases indiretas/pressupostas que clientes reais diriam e uma breve orientação segura.'
        ].filter(Boolean).join('\n');

        const resp = await ai.models.generateContent({
            model: MODELO_BASE_CATEGORIA,
            contents: prompt,
            config: {
                temperature: 0.4,
                responseMimeType: 'application/json',
                responseSchema: schemaConhecimentoCategoria
            }
        });

        const dados = JSON.parse((resp && resp.text ? resp.text : '').trim());
        const chave = chaveDaCategoria(categoria);
        if (!chave) return null;

        const store = lerStoreArquivo();
        const atual = store[chave] || gerarConhecimentoDeterministico(categoria);
        const mesclarLista = (a, b, max) => Array.from(new Set([
            ...(Array.isArray(a) ? a : []),
            ...(Array.isArray(b) ? b : [])
        ].map(s => String(s || '').trim()).filter(Boolean))).slice(0, max);

        store[chave] = {
            ...atual,
            termos_relacionados: mesclarLista(atual.termos_relacionados, dados.termos_relacionados, 20),
            problemas_atendidos: mesclarLista(atual.problemas_atendidos, dados.problemas_atendidos, 6),
            frases_indiretas: mesclarLista(atual.frases_indiretas, dados.frases_indiretas, 8),
            orientacao_cuidado: typeof dados.orientacao_cuidado === 'string' && dados.orientacao_cuidado.trim()
                ? dados.orientacao_cuidado.trim()
                : atual.orientacao_cuidado,
            origem: 'ia+automatica',
            atualizado_em: new Date().toISOString()
        };
        salvarStoreArquivo(store);
        return store[chave];
    } catch (_) {
        return null;
    }
}

function chaveDaCategoria(categoria) {
    if (!categoria) return '';
    const slug = categoria.slug ? String(categoria.slug).trim().toLowerCase() : '';
    if (slug) return slug;
    return normalizarTextoBasico(categoria.nome).replace(/\s+/g, '-');
}

function registrarConhecimentoCategoria(categoria, { enriquecerAssincrono = true } = {}) {
    if (!categoria || !categoria.nome) return null;
    const chave = chaveDaCategoria(categoria);
    if (!chave) return null;

    const store = lerStoreArquivo();
    const gerado = gerarConhecimentoDeterministico(categoria);
    store[chave] = store[chave]
        ? {
            ...gerado,
            ...store[chave],
            id_categoria: gerado.id_categoria ?? store[chave].id_categoria,
            nome: gerado.nome,
            slug: gerado.slug,
            faixa_etaria: gerado.faixa_etaria,
            sexo: gerado.sexo
        }
        : gerado;
    salvarStoreArquivo(store);

    if (enriquecerAssincrono && process.env.GEMINI_API_KEY) {
        enriquecerCategoriaComIA(categoria).catch(() => {});
    }

    return store[chave];
}

function atualizarPerfilCategoriaConhecimento(idCategoria, faixaEtaria, sexo) {
    const idNum = Number(idCategoria);
    if (!Number.isFinite(idNum)) return;
    const store = lerStoreArquivo();
    let alterou = false;
    for (const chave of Object.keys(store)) {
        if (Number(store[chave].id_categoria) === idNum) {
            store[chave].faixa_etaria = faixaEtaria || null;
            store[chave].sexo = sexo || null;
            store[chave].atualizado_em = new Date().toISOString();
            alterou = true;
        }
    }
    if (alterou) salvarStoreArquivo(store);
}

function removerConhecimentoCategoria(idCategoria) {
    const idNum = Number(idCategoria);
    if (!Number.isFinite(idNum)) return;
    const store = lerStoreArquivo();
    let alterou = false;
    for (const chave of Object.keys(store)) {
        if (Number(store[chave].id_categoria) === idNum) {
            delete store[chave];
            alterou = true;
        }
    }
    if (alterou) salvarStoreArquivo(store);
}

function obterBaseConhecimentoCategorias(categorias = []) {
    const lista = Array.isArray(categorias) ? categorias : [];
    const store = lerStoreArquivo();
    let alterou = false;
    const resultado = [];

    for (const cat of lista) {
        if (!cat || !cat.nome) continue;
        const chave = chaveDaCategoria(cat);
        if (!chave) continue;

        if (!store[chave]) {
            store[chave] = gerarConhecimentoDeterministico(cat);
            alterou = true;
        } else {
            store[chave].id_categoria = cat.id_categoria != null ? Number(cat.id_categoria) : store[chave].id_categoria;
            store[chave].faixa_etaria = cat.faixa_etaria || null;
            store[chave].sexo = cat.sexo || null;
        }
        resultado.push(store[chave]);
    }

    if (alterou) salvarStoreArquivo(store);
    return resultado;
}

module.exports = {
    registrarConhecimentoCategoria,
    atualizarPerfilCategoriaConhecimento,
    removerConhecimentoCategoria,
    obterBaseConhecimentoCategorias,
    gerarConhecimentoDeterministico,
    normalizarTextoBasico
};
