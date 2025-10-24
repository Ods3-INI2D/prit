var express = require('express');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { valCPF, valTel, valNasc, valSenha, valCsenha } = require('../helpers/validacoes');
var db = require('../models/database');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var session = require('express-session');

router.use(session({
    secret: 'chave-secreta-farmacia-super-segura-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

// Configuração do Multer para upload de imagens
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/imagens/produtos');
        
        // Cria o diretório se não existir
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Gera um nome único para o arquivo
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'produto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas (JPG, JPEG, PNG, WEBP)!'));
        }
    }
});

// Middleware para disponibilizar o usuário em todas as views
router.use(function(req, res, next) {
    res.locals.usuario = null;
    if (req.session && req.session.usuarioEmail) {
        const usuario = db.findUsuario(req.session.usuarioEmail);
        if (usuario) {
            res.locals.usuario = usuario;
        }
    }
    next();
});

// Rota raiz redireciona para cadastro
router.get('/', function(req, res) {
    res.render('pages/cadastro', { 
        erros: null, 
        valores: {nome: "", nasc: "", cpf: "", tel: "", email: "", senhan: "", csenha: ""},
        listaErros: null
    });
});

// Rota de cadastro POST
router.post("/cadastro",
    body("nome")
        .isLength({ min: 3, max: 50 }).withMessage("Nome deve conter de 3 a 50 caracteres!"),
    body("cpf")
        .isLength({ min: 11, max: 11 }).withMessage('O CPF deve conter 11 caracteres!')
        .custom((value) => {
            if (valCPF(value)) {
                return true;
            } else {
                throw new Error('CPF inválido!');
            }
        }),
    body("nasc")
        .isISO8601().withMessage('Data de Nascimento deve ser uma data válida no formato AAAA-MM-DD!')
        .custom((value) => {
            if (valNasc(value)) {
                return true;
            } else {
                throw new Error('Data de Nascimento inválida! A idade deve ser no máximo 110 anos e não pode ser uma data futura.');
            }
        }),
    body("tel")
        .isLength({ min: 9, max: 9 }).withMessage('O telefone deve conter 9 caracteres!')
        .custom((value) => {
            if (valTel(value)) {
                return true;
            } else {
                throw new Error('Telefone inválido!');
            }
        }),
    body("email")
        .isEmail().withMessage('O e-mail deve ser válido!')
        .custom((value) => {
            const usuario = db.findUsuario(value);
            if (usuario) {
                throw new Error('E-mail já cadastrado!');
            }
            return true;
        }),
    body("senhan")
        .isLength({ min: 6, max: 20 })
        .withMessage('A senha deve conter de 6 a 20 caracteres!')
        .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .withMessage('A senha deve conter pelo menos um número, uma letra maiúscula e um caractere especial!'),
    body("csenha")
        .custom((value, { req }) => {
            if (value !== req.body.senhan) {
                throw new Error('As senhas não conferem!');
            }
            return true;
        }),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render("pages/cadastro", { 
                erros: true, 
                valores: req.body, 
                listaErros: errors 
            });
        }
        
        db.addUsuario(req.body);
        res.redirect('/login');
    }
);

// Rota de login GET
router.get('/login', function(req, res) {
    res.render('pages/login', { erro: null });
});

// Rota de login POST
router.post('/login', 
    body("email")
        .isEmail().withMessage('O e-mail deve ser válido!'),
    body("senha")
        .notEmpty().withMessage('A senha é obrigatória!'),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/login', { erro: 'E-mail ou senha inválidos!' });
        }

        const usuario = db.findUsuario(req.body.email);
        
        if (usuario && req.body.senha === usuario.senhan) {
            req.session.usuarioEmail = usuario.email;
            return res.redirect('/home');
        } else {
            return res.render('pages/login', { erro: 'E-mail ou senha inválidos!' });
        }
    }
);

// Rota home
router.get('/home', function(req, res) {
    const produtos = db.getProdutos();
    res.render('pages/home', { produtos: produtos });
});

// Rota usuário
router.get('/usuario', function(req, res) {
    if (!req.session.usuarioEmail) {
        return res.render('pages/usuario', { usuario: null });
    }
    
    const usuario = db.findUsuario(req.session.usuarioEmail);
    res.render('pages/usuario', { usuario: usuario });
});

// Atualizar dados do usuário
router.post('/usuario/atualizar', function(req, res) {
    if (req.session.usuarioEmail) {
        db.updateUsuario(req.session.usuarioEmail, {
            tel: req.body.tel,
            cep: req.body.cep
        });
    }
    res.redirect('/usuario');
});

// Rota admin
router.get('/admin', function(req, res) {
    const produtos = db.getProdutos();
    const totalAvaliacoes = db.getTotalAvaliacoes();
    
    res.render('pages/admin', { 
        produtos: produtos, 
        totalProdutos: produtos.length, 
        totalAvaliacoes: totalAvaliacoes,
        erro: null,
        sucesso: null
    });
});

// Adicionar produto
router.post('/admin/adicionar-produto', upload.single('imagem'), function(req, res) {
    try {
        // Define o caminho da imagem
        let imagemPath = '/imagens/foto.jpg'; // Imagem padrão
        
        if (req.file) {
            imagemPath = '/imagens/produtos/' + req.file.filename;
        }
        
        const novoProduto = {
            nome: req.body.nome,
            preco: parseFloat(req.body.preco),
            precoDesconto: req.body.precoDesconto ? parseFloat(req.body.precoDesconto) : null,
            categoria: req.body.categoria,
            descricao: req.body.descricao,
            imagem: imagemPath
        };
        
        db.addProduto(novoProduto);
        res.redirect('/admin');
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        const produtos = db.getProdutos();
        const totalAvaliacoes = db.getTotalAvaliacoes();
        
        res.render('pages/admin', { 
            produtos: produtos, 
            totalProdutos: produtos.length, 
            totalAvaliacoes: totalAvaliacoes,
            erro: 'Erro ao adicionar produto: ' + error.message,
            sucesso: null
        });
    }
});

// Ver produto específico
router.get('/produto/:id', function(req, res) {
    const produto = db.getProdutoById(req.params.id);
    if (!produto) {
        return res.redirect('/home');
    }
    
    const produtos = db.getProdutos();
    res.render('pages/produto', { produto: produto, produtos: produtos });
});

// Adicionar ao carrinho
router.post('/produto/:id/adicionar-carrinho', function(req, res) {
    db.addToCarrinho(req.params.id);
    res.redirect('/carrinho');
});

// Ver carrinho
router.get('/carrinho', function(req, res) {
    const carrinho = db.getCarrinho();
    res.render('pages/carrinho', { carrinho: carrinho });
});

// Avaliar produto
router.post('/produto/:id/avaliar', function(req, res) {
    const novaAvaliacao = {
        nota: parseInt(req.body.nota),
        texto: req.body.texto
    };
    
    db.addAvaliacao(req.params.id, novaAvaliacao);
    res.redirect('/produto/' + req.params.id);
});

// Ver categoria
router.get('/categoria/:nome', function(req, res) {
    const produtosCategoria = db.getProdutosByCategoria(req.params.nome);
    res.render('pages/categoria', { categoria: req.params.nome, produtos: produtosCategoria });
});

// Logout
router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) {
            console.error('Erro ao destruir sessão:', err);
        }
        res.redirect('/login');
    });
});

module.exports = router;