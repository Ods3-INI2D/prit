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
    
    produto.preco = produto.preco !== null && produto.preco !== undefined ? parseFloat(produto.preco) : 0;
    
    if (produto.precoDesconto !== null && produto.precoDesconto !== undefined && produto.precoDesconto !== '') {
        produto.precoDesconto = parseFloat(produto.precoDesconto);
    } else {
        produto.precoDesconto = null;
    }
    
    if (!produto.imagem) {
        produto.imagem = '/imagens/foto.jpg';
    }
    
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

function updateProduto(id, dadosAtualizados) {
    const db = readDatabase();
    const index = db.produtos.findIndex(p => p.id == id);
    
    if (index === -1) {
        return false;
    }
    
    db.produtos[index] = {
        ...db.produtos[index],
        ...dadosAtualizados,
        id: db.produtos[index].id,
        avaliacoes: db.produtos[index].avaliacoes
    };
    
    writeDatabase(db);
    return true;
}

function deleteProduto(id) {
    const db = readDatabase();
    
    // Remove o produto
    db.produtos = db.produtos.filter(p => p.id != id);
    
    // Remove itens do carrinho relacionados ao produto
    db.carrinho = db.carrinho.filter(item => item.produtoId != id);
    
    writeDatabase(db);
    return true;
}

function addAvaliacao(produtoId, avaliacao, usuarioEmail) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    const temNoCarrinho = db.carrinho.some(item => 
        item.produtoId == produtoId && item.usuarioEmail === usuarioEmail
    );
    
    if (!temNoCarrinho) {
        return false;
    }
    
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

function deleteAvaliacao(produtoId, avaliacaoIndex) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    if (!produto || !produto.avaliacoes || avaliacaoIndex >= produto.avaliacoes.length) {
        return false;
    }
    
    // Remove a avaliação do produto
    produto.avaliacoes.splice(avaliacaoIndex, 1);
    
    writeDatabase(db);
    return true;
}

function addToCarrinho(produtoId, usuarioEmail) {
    const db = readDatabase();
    const produto = db.produtos.find(p => p.id == produtoId);
    
    if (!produto) {
        return false;
    }
    
    const itemExistente = db.carrinho.find(item => 
        item.produtoId == produtoId && item.usuarioEmail === usuarioEmail
    );
    
    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        db.carrinho.push({
            produtoId: produtoId.toString(),
            usuarioEmail: usuarioEmail,
            quantidade: 1,
            dataAdicionado: new Date()
        });
    }
    
    writeDatabase(db);
    return true;
}

function getCarrinho(usuarioEmail) {
    const db = readDatabase();
    
    const itensUsuario = db.carrinho.filter(item => item.usuarioEmail === usuarioEmail);
    
    return itensUsuario.map(item => {
        const produto = db.produtos.find(p => p.id == item.produtoId);
        
        if (!produto) {
            return null;
        }
        
        return {
            ...produto,
            quantidade: item.quantidade || 1,
            preco: produto.preco !== null && produto.preco !== undefined ? produto.preco : 0,
            precoDesconto: produto.precoDesconto || null,
            categoria: produto.categoria || 'Geral',
            nome: produto.nome || 'Produto sem nome',
            imagem: produto.imagem || '/imagens/foto.jpg'
        };
    }).filter(item => item !== null);
}

function updateQuantidadeCarrinho(produtoId, usuarioEmail, novaQuantidade) {
    const db = readDatabase();
    
    const item = db.carrinho.find(item => 
        item.produtoId == produtoId && item.usuarioEmail === usuarioEmail
    );
    
    if (item) {
        if (novaQuantidade <= 0) {
            db.carrinho = db.carrinho.filter(i => 
                !(i.produtoId == produtoId && i.usuarioEmail === usuarioEmail)
            );
        } else {
            item.quantidade = novaQuantidade;
        }
        writeDatabase(db);
        return true;
    }
    return false;
}

function removeFromCarrinho(produtoId, usuarioEmail) {
    const db = readDatabase();
    
    db.carrinho = db.carrinho.filter(item => 
        !(item.produtoId == produtoId && item.usuarioEmail === usuarioEmail)
    );
    
    writeDatabase(db);
    return true;
}

function usuarioTemProdutoNoCarrinho(produtoId, usuarioEmail) {
    const db = readDatabase();
    return db.carrinho.some(item => 
        item.produtoId == produtoId && item.usuarioEmail === usuarioEmail
    );
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

function getAllUsuarios() {
    const db = readDatabase();
    return db.usuarios || [];
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

function deleteUsuario(email) {
    const db = readDatabase();
    
    // Remove o usuário
    db.usuarios = db.usuarios.filter(u => u.email !== email);
    
    // Remove itens do carrinho do usuário
    db.carrinho = db.carrinho.filter(item => item.usuarioEmail !== email);
    
    writeDatabase(db);
    return true;
}

function getProdutosByCategoria(categoria) {
    const db = readDatabase();
    
    const categoriasGerais = ['Cuidados com a Pele', 'Higiene Bucal', 'Cabelo'];
    
    if (categoria.toLowerCase() === 'geral') {
        return db.produtos
            .filter(p => p.categoria && categoriasGerais.includes(p.categoria))
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
    updateProduto,
    deleteProduto,
    addAvaliacao,
    deleteAvaliacao,
    addToCarrinho,
    getCarrinho,
    clearCarrinho,
    addUsuario,
    findUsuario,
    getAllUsuarios,
    updateUsuario,
    deleteUsuario,
    readDatabase,
    getProdutosByCategoria,
    getTotalAvaliacoes,
    updateQuantidadeCarrinho,
    removeFromCarrinho,
    usuarioTemProdutoNoCarrinho
};