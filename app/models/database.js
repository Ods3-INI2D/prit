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
    produto.imagem = '/imagens/foto.jpg';
    produto.avaliacoes = [];
    db.produtos.push(produto);
    writeDatabase(db);
    return produto;
}

function getProdutos() {
    const db = readDatabase();
    return db.produtos;
}

function getProdutoById(id) {
    const db = readDatabase();
    return db.produtos.find(p => p.id == id);
}

function addAvaliacao(produtoId, avaliacao) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    if (produto) {
        avaliacao.data = new Date();
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
    return db.carrinho;
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

initDatabase();

function getProdutosByCategoria(categoria) {
    const db = readDatabase();
    return db.produtos.filter(p => p.categoria.toLowerCase() === categoria.toLowerCase());
}

function getTotalAvaliacoes() {
    const db = readDatabase();
    return db.avaliacoes.length;
}

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