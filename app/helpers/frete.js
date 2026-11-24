// Cálculo de frete e prazo com base no CEP de destino (consulta ao ViaCEP).
//
// Todas as entregas partem do CEP 06420-150 (Barueri/SP). O valor e o prazo
// dependem da distância aproximada entre a origem e a região do destino:
// quanto mais longe de Barueri, maior o frete e o prazo.
//
// Para ajustar preços e prazos, edite apenas a tabela ZONAS.

const ORIGEM = {
    cep:    '06420-150',
    cidade: 'Barueri',
    uf:     'SP',
    ibge:   '3505708'
};

// Mesma regra já usada no carrinho/checkout: acima desse valor o frete é grátis.
const FRETE_GRATIS_A_PARTIR_DE = 150;

// Prazos em dias úteis.
const ZONAS = {
    'local':       { regiao: 'Barueri',                  valor:  7.90, prazoMin: 1, prazoMax:  2 },
    'grande-sp':   { regiao: 'Grande São Paulo',         valor: 12.90, prazoMin: 2, prazoMax:  3 },
    'interior-sp': { regiao: 'Interior e litoral de SP', valor: 16.90, prazoMin: 3, prazoMax:  5 },
    'sudeste':     { regiao: 'Sudeste',                  valor: 22.90, prazoMin: 4, prazoMax:  7 },
    'sul-co':      { regiao: 'Sul e Centro-Oeste',       valor: 27.90, prazoMin: 5, prazoMax:  8 },
    'nordeste':    { regiao: 'Nordeste',                 valor: 34.90, prazoMin: 7, prazoMax: 12 },
    'norte':       { regiao: 'Norte',                    valor: 42.90, prazoMin: 9, prazoMax: 15 }
};

const UFS_SUDESTE  = new Set(['RJ', 'MG', 'ES']);
const UFS_SUL_CO   = new Set(['PR', 'SC', 'RS', 'DF', 'GO', 'MT', 'MS']);
const UFS_NORDESTE = new Set(['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA']);

const VIACEP_TIMEOUT_MS = 5000;
const CACHE_TTL_MS      = 60 * 60 * 1000; // 1 hora
const CACHE_MAX_ITENS   = 500;

const cacheCep = new Map();

// Retorna os 8 dígitos do CEP, ou null se o formato for inválido.
function normalizarCep(valor) {
    const texto = String(valor || '').trim();
    if (!/^\d{5}-?\d{3}$/.test(texto)) return null;
    return texto.replace('-', '');
}

function formatarCep(cep) {
    return cep.slice(0, 5) + '-' + cep.slice(5);
}

function criarErro(codigo, mensagem) {
    const erro = new Error(mensagem);
    erro.codigo = codigo;
    return erro;
}

// Consulta o ViaCEP. Retorna os dados do endereço ou null se o CEP não existir.
// Lança erro com codigo 'servico_indisponivel' se o ViaCEP falhar ou demorar.
async function consultarCep(cep, opcoes = {}) {
    const fetchImpl = opcoes.fetchImpl || fetch;

    const emCache = cacheCep.get(cep);
    if (emCache && emCache.expiraEm > Date.now()) return emCache.dados;

    let resposta;
    try {
        resposta = await fetchImpl('https://viacep.com.br/ws/' + cep + '/json/', {
            headers: { Accept: 'application/json' },
            signal:  AbortSignal.timeout(VIACEP_TIMEOUT_MS)
        });
    } catch (erro) {
        throw criarErro('servico_indisponivel', 'Falha ao consultar o ViaCEP: ' + erro.message);
    }

    if (!resposta.ok) {
        throw criarErro('servico_indisponivel', 'ViaCEP respondeu com status ' + resposta.status);
    }

    let dados;
    try {
        dados = await resposta.json();
    } catch (_) {
        throw criarErro('servico_indisponivel', 'Resposta inválida do ViaCEP');
    }

    // CEP bem formado, mas inexistente: o ViaCEP responde 200 com { "erro": ... }
    let resultado = null;
    if (dados && !dados.erro) {
        if (!dados.uf || !dados.localidade) {
            throw criarErro('servico_indisponivel', 'Resposta incompleta do ViaCEP');
        }
        resultado = {
            logradouro: dados.logradouro || '',
            bairro:     dados.bairro     || '',
            localidade: dados.localidade,
            uf:         String(dados.uf).toUpperCase(),
            ibge:       String(dados.ibge || ''),
            ddd:        String(dados.ddd  || '')
        };
    }

    if (cacheCep.size >= CACHE_MAX_ITENS) {
        cacheCep.delete(cacheCep.keys().next().value);
    }
    cacheCep.set(cep, { dados: resultado, expiraEm: Date.now() + CACHE_TTL_MS });

    return resultado;
}

function classificarZona(endereco) {
    if (endereco.ibge === ORIGEM.ibge) return 'local';

    const uf = endereco.uf;
    if (uf === ORIGEM.uf)      return endereco.ddd === '11' ? 'grande-sp' : 'interior-sp';
    if (UFS_SUDESTE.has(uf))   return 'sudeste';
    if (UFS_SUL_CO.has(uf))    return 'sul-co';
    if (UFS_NORDESTE.has(uf))  return 'nordeste';
    return 'norte';
}

// endereco: retorno de consultarCep(); subtotal: valor da compra em reais.
function calcularFrete(endereco, subtotal = 0) {
    const zona = ZONAS[classificarZona(endereco)];
    const gratis = Number(subtotal) >= FRETE_GRATIS_A_PARTIR_DE;

    return {
        regiao:   zona.regiao,
        valor:    gratis ? 0 : zona.valor,
        gratis,
        prazoMin: zona.prazoMin,
        prazoMax: zona.prazoMax
    };
}

function limparCache() {
    cacheCep.clear();
}

module.exports = {
    ORIGEM,
    FRETE_GRATIS_A_PARTIR_DE,
    normalizarCep,
    formatarCep,
    consultarCep,
    calcularFrete,
    limparCache
};
