const { hashSenha } = require('../helpers/auth');

function slugify(nome) {
    return String(nome || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

const categorias = [
    { id_categoria: 1, nome: 'Terceira Idade', slug: 'terceira-idade', faixa_etaria: '60+', sexo: 'todos' },
    { id_categoria: 2, nome: 'Vitaminas e Suplementos', slug: 'vitaminas-e-suplementos', faixa_etaria: '50+', sexo: 'todos' },
    { id_categoria: 3, nome: 'Cuidados com a Pele', slug: 'cuidados-com-a-pele', faixa_etaria: '40+', sexo: 'todos' },
    { id_categoria: 4, nome: 'Higiene Bucal', slug: 'higiene-bucal', faixa_etaria: null, sexo: 'todos' },
    { id_categoria: 5, nome: 'Cabelo', slug: 'cabelo', faixa_etaria: null, sexo: 'todos' },
    { id_categoria: 6, nome: 'Monitoramento e Saúde', slug: 'monitoramento-e-saude', faixa_etaria: '60+', sexo: 'todos' }
];

const produtos = [
    {
        id_produto: 1,
        nome: 'Cálcio + Vitamina D3 60+ (60 comprimidos)',
        descricao: 'Suplemento mineral e vitamínico formulado para fortalecimento ósseo e muscular na terceira idade. Comprimidos revestidos fáceis de engolir, sem açúcar e sem glúten.',
        preco: 64.90,
        preco_desconto: 49.90,
        imagem: '/imagens/catalogo/vitamina.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [1, 2],
        criado_em: new Date('2026-01-10T10:00:00Z')
    },
    {
        id_produto: 2,
        nome: 'Colágeno Tipo II Articulações (30 cápsulas)',
        descricao: 'Auxilia na manutenção da função articular, mobilidade e conforto nos joelhos e quadris. Uso diário em cápsula pequena, sem sabor e zero lactose.',
        preco: 89.90,
        preco_desconto: 72.90,
        imagem: '/imagens/catalogo/vitamina.svg',
        status: 'em-estoque',
        faixa_etaria: '55+',
        sexo: 'todos',
        ids_categorias: [1, 2],
        criado_em: new Date('2026-01-12T10:00:00Z')
    },
    {
        id_produto: 3,
        nome: 'Multivitamínico Sênior 50+ Completo (60 comprimidos)',
        descricao: 'Fórmula balanceada com Vitaminas B12, C, D, Zinco e Magnésio para disposição diária, imunidade e memória. Zero açúcares, indicado também para quem controla a glicemia.',
        preco: 74.50,
        preco_desconto: null,
        imagem: '/imagens/catalogo/vitamina.svg',
        status: 'em-estoque',
        faixa_etaria: '50+',
        sexo: 'todos',
        ids_categorias: [2, 1],
        criado_em: new Date('2026-01-14T10:00:00Z')
    },
    {
        id_produto: 4,
        nome: 'Ômega 3 Concentrado EPA/DHA 1000mg (60 cápsulas)',
        descricao: 'Suporte para saúde cardiovascular, circulação e função cognitiva. Cápsulas gelatinosas sem retrogosto de peixe.',
        preco: 79.90,
        preco_desconto: 59.90,
        imagem: '/imagens/catalogo/vitamina.svg',
        status: 'em-estoque',
        faixa_etaria: '50+',
        sexo: 'todos',
        ids_categorias: [2],
        criado_em: new Date('2026-01-15T10:00:00Z')
    },
    {
        id_produto: 5,
        nome: 'Loção Hidratante Pele Madura e Sensível 400ml',
        descricao: 'Hidratação profunda com Ureia 5%, Ceramidas e Vitamina E para pele seca, fina ou com coceira. Sem fragrância, hipoalergênica, fácil de espalhar e embalagem com válvula pump prática.',
        preco: 58.00,
        preco_desconto: 44.90,
        imagem: '/imagens/catalogo/pele.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [3, 1],
        criado_em: new Date('2026-01-16T10:00:00Z')
    },
    {
        id_produto: 6,
        nome: 'Sabonete Líquido Neutro Sem Fragrância 250ml',
        descricao: 'Limpeza suave que preserva a barreira natural da pele idosa e ressecada. pH fisiológico, livre de parabenos e corantes, não arde os olhos.',
        preco: 32.90,
        preco_desconto: null,
        imagem: '/imagens/catalogo/pele.svg',
        status: 'em-estoque',
        faixa_etaria: '40+',
        sexo: 'todos',
        ids_categorias: [3],
        criado_em: new Date('2026-01-17T10:00:00Z')
    },
    {
        id_produto: 7,
        nome: 'Protetor Solar Facial Fluido FPS 60 Toque Suave 50ml',
        descricao: 'Proteção UVA/UVB muito alta para pele madura e sensível ao sol. Textura leve sem deixar resíduos brancos e sem perfume forte.',
        preco: 69.90,
        preco_desconto: 54.90,
        imagem: '/imagens/catalogo/pele.svg',
        status: 'em-estoque',
        faixa_etaria: '40+',
        sexo: 'todos',
        ids_categorias: [3],
        criado_em: new Date('2026-01-18T10:00:00Z')
    },
    {
        id_produto: 8,
        nome: 'Escova Dental Ultra Macia Cabo Ergonômico',
        descricao: 'Cerdas extra macias indicadas para gengivas sensíveis e retração gengival. Cabo anatômico antiderrapante mais largo para facilitar a pegada.',
        preco: 24.90,
        preco_desconto: 18.90,
        imagem: '/imagens/catalogo/bucal.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [4, 1],
        criado_em: new Date('2026-01-19T10:00:00Z')
    },
    {
        id_produto: 9,
        nome: 'Creme Fixador e Higienizador para Prótese Dentária',
        descricao: 'Fixação confortável e segura por até 12 horas sem zinco, com sabor suave de menta. Ajuda a evitar entrada de alimentos sob a dentadura.',
        preco: 39.90,
        preco_desconto: null,
        imagem: '/imagens/catalogo/bucal.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [4, 1],
        criado_em: new Date('2026-01-20T10:00:00Z')
    },
    {
        id_produto: 10,
        nome: 'Gel Hidratante Bucal Boca Seca 50g',
        descricao: 'Alívio prolongado da sensação de boca seca (xerostomia), comum pelo uso contínuo de medicamentos. Sem álcool e sem açúcar.',
        preco: 46.50,
        preco_desconto: null,
        imagem: '/imagens/catalogo/bucal.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [4],
        criado_em: new Date('2026-01-21T10:00:00Z')
    },
    {
        id_produto: 11,
        nome: 'Shampoo Fortificante Suave Fios Finos e Grisalhos 300ml',
        descricao: 'Limpeza delicada para couro cabeludo sensível, com pantenol e biotina para dar volume e maciez sem ressecar. Frasco de abertura fácil.',
        preco: 42.00,
        preco_desconto: 33.90,
        imagem: '/imagens/catalogo/cabelo.svg',
        status: 'em-estoque',
        faixa_etaria: '50+',
        sexo: 'todos',
        ids_categorias: [5],
        criado_em: new Date('2026-01-22T10:00:00Z')
    },
    {
        id_produto: 12,
        nome: 'Aparelho de Pressão Digital de Braço Visor Grande',
        descricao: 'Medidor automático de pressão arterial com números grandes de fácil leitura, botão único grande e aviso de arritmia. Acompanha braçadeira confortável ajustável e pilha.',
        preco: 189.90,
        preco_desconto: 149.90,
        imagem: '/imagens/catalogo/monitor.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [6, 1],
        criado_em: new Date('2026-01-23T10:00:00Z')
    },
    {
        id_produto: 13,
        nome: 'Organizador Semanal de Comprimidos Letra Grande',
        descricao: 'Porta-comprimidos com 7 dias (Manhã e Noite), tampas fáceis de abrir sem força nos dedos e letras ampliadas em alto contraste.',
        preco: 29.90,
        preco_desconto: 22.90,
        imagem: '/imagens/catalogo/terceira_idade.svg',
        status: 'em-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [1, 6],
        criado_em: new Date('2026-01-24T10:00:00Z')
    },
    {
        id_produto: 14,
        nome: 'Roupa Íntima Descartável Conforto Geriátrico (16 un)',
        descricao: 'Formato anatômico veste fácil como roupa íntima, absorção noturna com controle de odores e toque macio respirável que protege a pele.',
        preco: 68.00,
        preco_desconto: 54.90,
        imagem: '/imagens/catalogo/terceira_idade.svg',
        status: 'em-estoque',
        faixa_etaria: '65+',
        sexo: 'todos',
        ids_categorias: [1],
        criado_em: new Date('2026-01-25T10:00:00Z')
    },
    {
        id_produto: 15,
        nome: 'Meia de Compressão Suave Bem-Estar Pernas',
        descricao: 'Compressão graduada leve (15-20 mmHg) para reduzir inchaço e sensação de cansaço nas pernas. Calcanhar reforçado e punho que não aperta.',
        preco: 84.90,
        preco_desconto: null,
        imagem: '/imagens/catalogo/terceira_idade.svg',
        status: 'fora-de-estoque',
        faixa_etaria: '60+',
        sexo: 'todos',
        ids_categorias: [1],
        criado_em: new Date('2026-01-26T10:00:00Z')
    }
];

const avaliacoes = [
    {
        id_avaliacao: 1,
        id_produto: 1,
        id_usuario: 1,
        nota: 5,
        texto: 'Comprimidos fáceis de engolir e ótimo preço para uso contínuo.',
        criado_em: new Date('2026-02-01T14:00:00Z')
    },
    {
        id_avaliacao: 2,
        id_produto: 12,
        id_usuario: 1,
        nota: 5,
        texto: 'Os números na tela são bem grandes, minha mãe consegue ler sem óculos!',
        criado_em: new Date('2026-02-05T11:30:00Z')
    },
    {
        id_avaliacao: 3,
        id_produto: 5,
        id_usuario: 1,
        nota: 5,
        texto: 'Aliviou muito o ressecamento nos braços e não tem cheiro forte.',
        criado_em: new Date('2026-02-08T09:15:00Z')
    }
];

const banners = [
    {
        id_banner: 1,
        imagem: '/imagens/catalogo/banner1.svg',
        legenda: 'Linha Terceira Idade 60+: Vitaminas, Conforto e Monitoramento',
        link: '/categoria/terceira-idade',
        faixa_etaria: '60+',
        sexo: 'todos'
    },
    {
        id_banner: 2,
        imagem: '/imagens/catalogo/banner2.svg',
        legenda: 'Pele Hidratada e Higiene Suave com Ofertas Especiais',
        link: '/categoria/cuidados-com-a-pele',
        faixa_etaria: null,
        sexo: 'todos'
    }
];

const usuarios = [];
let usuariosInicializados = false;
async function garantirUsuarioDemo() {
    if (usuariosInicializados) return;
    usuariosInicializados = true;
    const senhaHash = await hashSenha('Saude@123');
    usuarios.push({
        id_usuario: 1,
        nome: 'Maria Aparecida Silva',
        nasc: '1956-05-14',
        cpf: '12345678909',
        ddd: '11',
        tel: '987654321',
        email: 'cliente@maisaude.com.br',
        senhan: senhaHash,
        sexo: 'feminino',
        ativo: 1,
        ativado_em: new Date('2026-01-01T09:00:00Z'),
        criado_em: new Date('2026-01-01T09:00:00Z')
    });
}
garantirUsuarioDemo().catch(() => {});

const carrinho = [];
const pedidos = [];
const pagamentos = [];
const entregas = [];

let seq = {
    produto: produtos.length + 1,
    categoria: categorias.length + 1,
    avaliacao: avaliacoes.length + 1,
    banner: banners.length + 1,
    usuario: 2,
    carrinho: 1,
    pedido: 1,
    pagamento: 1,
    entrega: 1
};

function formatarProduto(p) {
    const cats = (p.ids_categorias || [])
        .map(idCat => categorias.find(c => c.id_categoria === Number(idCat)))
        .filter(Boolean)
        .sort((a, b) => a.nome.localeCompare(b.nome));

    return {
        ...p,
        categoria: cats.map(c => c.nome).join(', '),
        ids_categorias: cats.map(c => c.id_categoria).join(','),
        slugs_categorias: cats.map(c => c.slug).join(',')
    };
}

module.exports = {
    slugify,
    categorias,
    produtos,
    avaliacoes,
    banners,
    usuarios,
    carrinho,
    pedidos,
    pagamentos,
    entregas,
    seq,
    garantirUsuarioDemo,
    formatarProduto
};
