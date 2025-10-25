const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

function initDatabase() {
    const dataDir = path.join(__dirname, '../data');
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(dbPath)) {
        const initialData = {
            produtos: [],
            avaliacoes: [],
            carrinho: [],
            usuarios: []
        };
        fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2));
    }
}

function readDatabase() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erro ao ler banco de dados:', error);
        return { produtos: [], avaliacoes: [], carrinho: [], usuarios: [] };
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erro ao escrever no banco de dados:', error);
        return false;
    }
}

function addProduto(produto) {
    const db = readDatabase();
    produto.id = Date.now();
    
    // Garantir que preco sempre tenha um valor válido
    produto.preco = produto.preco !== null && produto.preco !== undefined ? parseFloat(produto.preco) : 0;
    
    // Garantir que precoDesconto seja null ou um número válido
    if (produto.precoDesconto !== null && produto.precoDesconto !== undefined && produto.precoDesconto !== '') {
        produto.precoDesconto = parseFloat(produto.precoDesconto);
    } else {
        produto.precoDesconto = null;
    }
    
    // Usa a imagem fornecida ou define uma padrão
    if (!produto.imagem) {
        produto.imagem = '/imagens/foto.jpg';
    }
    
    // Garantir que categoria e descricao existam
    produto.categoria = produto.categoria || 'Geral';
    produto.descricao = produto.descricao || '';
    produto.nome = produto.nome || 'Produto sem nome';
    
    produto.avaliacoes = [];
    db.produtos.push(produto);
    writeDatabase(db);
    return produto;
}

function getProdutos() {
    const db = readDatabase();
    // Filtrar e normalizar produtos antes de retornar
    return db.produtos.map(produto => {
        return {
            ...produto,
            preco: produto.preco !== null && produto.preco !== undefined ? produto.preco : 0,
            precoDesconto: produto.precoDesconto || null,
            categoria: produto.categoria || 'Geral',
            descricao: produto.descricao || '',
            nome: produto.nome || 'Produto sem nome',
            imagem: produto.imagem || '/imagens/foto.jpg',
            avaliacoes: produto.avaliacoes || []
        };
    });
}

function getProdutoById(id) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == id);
    
    if (!produto) {
        return null;
    }
    
    // Normalizar produto antes de retornar
    return {
        ...produto,
        preco: produto.preco !== null && produto.preco !== undefined ? produto.preco : 0,
        precoDesconto: produto.precoDesconto || null,
        categoria: produto.categoria || 'Geral',
        descricao: produto.descricao || '',
        nome: produto.nome || 'Produto sem nome',
        imagem: produto.imagem || '/imagens/foto.jpg',
        avaliacoes: produto.avaliacoes || []
    };
}

function addAvaliacao(produtoId, avaliacao) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    if (produto) {
        avaliacao.data = new Date();
        if (!produto.avaliacoes) {
            produto.avaliacoes = [];
        }
        produto.avaliacoes.push(avaliacao);
        db.avaliacoes.push(avaliacao);
        writeDatabase(db);
        return true;
    }
    return false;
}

function addToCarrinho(produtoId) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    if (produto) {
        db.carrinho.push(produto);
        writeDatabase(db);
        return true;
    }
    return false;
}

function getCarrinho() {
    const db = readDatabase();
    // Normalizar produtos do carrinho
    return db.carrinho.map(produto => {
        return {
            ...produto,
            preco: produto.preco !== null && produto.preco !== undefined ? produto.preco : 0,
            precoDesconto: produto.precoDesconto || null,
            categoria: produto.categoria || 'Geral',
            nome: produto.nome || 'Produto sem nome',
            imagem: produto.imagem || '/imagens/foto.jpg'
        };
    });
}

function clearCarrinho() {
    const db = readDatabase();
    db.carrinho = [];
    writeDatabase(db);
}

function addUsuario(usuario) {
    const db = readDatabase();
    db.usuarios.push(usuario);
    writeDatabase(db);
}

function findUsuario(email) {
    const db = readDatabase();
    return db.usuarios.find(u => u.email === email);
}

function updateUsuario(email, updates) {
    const db = readDatabase();
    const usuario = db.usuarios.find(u => u.email === email);
    
    if (usuario) {
        Object.assign(usuario, updates);
        writeDatabase(db);
        return usuario;
    }
    return null;
}

function getProdutosByCategoria(categoria) {
    const db = readDatabase();
    return db.produtos
        .filter(p => p.categoria && p.categoria.toLowerCase() === categoria.toLowerCase())
        .map(produto => {
            return {
                ...produto,
                preco: produto.preco !== null && produto.preco !== undefined ? produto.preco : 0,
                precoDesconto: produto.precoDesconto || null,
                categoria: produto.categoria || 'Geral',
                nome: produto.nome || 'Produto sem nome',
                imagem: produto.imagem || '/imagens/foto.jpg',
                avaliacoes: produto.avaliacoes || []
            };
        });
}

function getTotalAvaliacoes() {
    const db = readDatabase();
    return db.avaliacoes.length;
}

initDatabase();

module.exports = {
    addProduto,
    getProdutos,
    getProdutoById,
    addAvaliacao,
    addToCarrinho,
    getCarrinho,
    clearCarrinho,
    addUsuario,
    findUsuario,
    updateUsuario,
    readDatabase,
    getProdutosByCategoria,
    getTotalAvaliacoes
};