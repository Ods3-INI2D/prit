var express = require('express');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { valCPF, valDDD, valTel, valTelCompleto, valNasc, valSenha, valCsenha } = require('../helpers/validacoes');
var db = require('../models/database');
var multer = require('multer');
var path = require('path');
var fs = require('fs');
var session = require('express-session');

require('dotenv').config();
const nodemailer = require('nodemailer');

router.use(session({
    secret: 'chave-secreta-farmacia-super-segura-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
    }
}));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/imagens/produtos');
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'produto-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const storageBanner = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/imagens');
        
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024
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

const uploadBanner = multer({
    storage: storageBanner,
    limits: {
        fileSize: 5 * 1024 * 1024
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

const ADMIN_EMAIL = 'maisaudeods3@gmail.com';
const ADMIN_PASSWORD = '+SaudeINI2D';

router.use(function(req, res, next) {
    if (!req.session.sessionId) {
        req.session.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    next();
});

router.use(function(req, res, next) {
    res.locals.usuario = null;
    res.locals.isAdmin = false;
    
    if (req.session && req.session.usuarioEmail) {
        if (req.session.usuarioEmail === ADMIN_EMAIL && req.session.isAdmin) {
            res.locals.isAdmin = true;
            res.locals.usuario = { email: ADMIN_EMAIL, nome: 'Administrador' };
        } else {
            const usuario = db.findUsuario(req.session.usuarioEmail);
            if (usuario) {
                res.locals.usuario = usuario;
            }
        }
    }
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.usuarioEmail) {
        return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.isAdmin || req.session.usuarioEmail !== ADMIN_EMAIL) {
        return res.redirect('/login?erro=admin');
    }
    next();
}

function blockAdmin(req, res, next) {
    if (req.session.isAdmin && req.session.usuarioEmail === ADMIN_EMAIL) {
        return res.redirect('/admin?erro=funcao_restrita');
    }
    next();
}

router.get('/', function(req, res) {
    res.redirect('/home');
});

router.get('/cadastro', function(req, res) {
    res.render('pages/cadastro', { 
        erros: null, 
        valores: {nome: "", nasc: "", cpf: "", ddd: "", tel: "", email: "", senhan: "", csenha: ""},
        listaErros: null
    });
});

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
    body("ddd")
        .isLength({ min: 2, max: 2 }).withMessage('O DDD deve conter 2 caracteres!')
        .custom((value) => {
            if (valDDD(value)) {
                return true;
            } else {
                throw new Error('DDD inválido!');
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

router.get('/login', function(req, res) {
    const erroAdmin = req.query.erro === 'admin' ? 'Acesso negado. Apenas administradores podem acessar esta área.' : null;
    res.render('pages/login', { erro: erroAdmin, redirect: req.query.redirect || '/home' });
});

router.post('/login', 
    body("email")
        .isEmail().withMessage('O e-mail deve ser válido!'),
    body("senha")
        .notEmpty().withMessage('A senha é obrigatória!'),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/login', { erro: 'E-mail ou senha inválidos!', redirect: '/home' });
        }

        if (req.body.email === ADMIN_EMAIL && req.body.senha === ADMIN_PASSWORD) {
            req.session.usuarioEmail = ADMIN_EMAIL;
            req.session.isAdmin = true;
            return res.redirect('/admin');
        }

        const usuario = db.findUsuario(req.body.email);
        
        if (usuario && req.body.senha === usuario.senhan) {
            const carrinhoAnonimo = db.getCarrinho(req.session.sessionId);
            if (carrinhoAnonimo && carrinhoAnonimo.length > 0) {
                carrinhoAnonimo.forEach(function(item) {
                    db.addToCarrinho(item.id, usuario.email, item.quantidade);
                });
                db.clearCarrinhoBySession(req.session.sessionId);
            }
            
            req.session.usuarioEmail = usuario.email;
            req.session.isAdmin = false;
            const redirectUrl = req.body.redirect || '/home';
            return res.redirect(redirectUrl);
        } else {
            return res.render('pages/login', { erro: 'E-mail ou senha inválidos!', redirect: '/home' });
        }
    }
);

router.get('/home', function(req, res) {
    const produtos = db.getProdutos();
    const banners = db.getBanners();
    res.render('pages/home', { produtos: produtos, banners: banners });
});

router.get('/usuario', function(req, res) {
    if (!req.session.usuarioEmail) {
        return res.render('pages/usuario', { 
            usuario: null,
            mensagemSucesso: null,
            mensagemErro: null
        });
    }
    
    const usuario = db.findUsuario(req.session.usuarioEmail);
    res.render('pages/usuario', { 
        usuario: usuario,
        mensagemSucesso: req.query.sucesso ? decodeURIComponent(req.query.sucesso) : null,
        mensagemErro: req.query.erro ? decodeURIComponent(req.query.erro) : null
    });
});

router.post('/usuario/atualizar-campo', requireLogin, 
    body("campo")
        .notEmpty().withMessage('Campo é obrigatório!')
        .isIn(['nome', 'nasc', 'cpf', 'ddd', 'tel']).withMessage('Campo inválido!'),
    body("valor")
        .notEmpty().withMessage('Valor é obrigatório!'),
    function(req, res) {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const mensagemErro = errors.array()[0].msg;
            return res.redirect('/usuario?erro=' + encodeURIComponent(mensagemErro));
        }

        const campo = req.body.campo;
        const valor = req.body.valor;
        
        // Validações específicas por campo
        if (campo === 'nome') {
            if (valor.length < 3 || valor.length > 50) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('Nome deve ter entre 3 e 50 caracteres!'));
            }
        }
        
        if (campo === 'cpf') {
            if (!valCPF(valor)) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('CPF inválido!'));
            }
            
            const usuarioExistente = db.getAllUsuarios().find(function(u) {
                return u.cpf === valor && u.email !== req.session.usuarioEmail;
            });
            
            if (usuarioExistente) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('CPF já cadastrado por outro usuário!'));
            }
        }
        
        if (campo === 'nasc') {
            if (!valNasc(valor)) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('Data de nascimento inválida!'));
            }
        }
        
        if (campo === 'ddd') {
            if (!valDDD(valor)) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('DDD inválido!'));
            }
        }
        
        if (campo === 'tel') {
            if (!valTel(valor)) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('Telefone inválido! Deve conter 9 dígitos.'));
            }
        }
        
        // Atualiza o campo
        const updateData = {};
        updateData[campo] = valor;
        
        db.updateUsuario(req.session.usuarioEmail, updateData);
        
        const mensagensCampo = {
            'nome': 'Nome',
            'nasc': 'Data de nascimento',
            'cpf': 'CPF',
            'ddd': 'DDD',
            'tel': 'Telefone'
        };
        
        const mensagemSucesso = mensagensCampo[campo] + ' atualizado com sucesso!';
        res.redirect('/usuario?sucesso=' + encodeURIComponent(mensagemSucesso));
    }
);

router.get('/admin', requireAdmin, function(req, res) {
    const produtos = db.getProdutos();
    const usuarios = db.getAllUsuarios();
    const banners = db.getBanners();
    
    res.render('pages/admin', { 
        produtos: produtos, 
        totalProdutos: produtos.length,
        usuarios: usuarios,
        banners: banners,
        erro: req.query.erro || null,
        sucesso: req.query.sucesso || null
    });
});

router.post('/admin/adicionar-produto', requireAdmin, upload.single('imagem'), function(req, res) {
    try {
        let imagemPath = '/imagens/foto.jpg';
        
        if (req.file) {
            imagemPath = '/imagens/produtos/' + req.file.filename;
        }
        
        let preco = parseFloat(req.body.preco);
        if (isNaN(preco) || preco < 0) {
            preco = 0;
        }
        
        let precoDesconto = null;
        if (req.body.precoDesconto && req.body.precoDesconto !== '') {
            precoDesconto = parseFloat(req.body.precoDesconto);
            if (isNaN(precoDesconto) || precoDesconto < 0) {
                precoDesconto = null;
            }
        }
        
        const novoProduto = {
            nome: req.body.nome || 'Produto sem nome',
            preco: preco,
            precoDesconto: precoDesconto,
            categoria: req.body.categoria || 'Geral',
            descricao: req.body.descricao || '',
            imagem: imagemPath,
            status: req.body.status || 'em-estoque'
        };
        
        db.addProduto(novoProduto);
        res.redirect('/admin?sucesso=produto_adicionado');
    } catch (error) {
        console.error('Erro ao adicionar produto:', error);
        res.redirect('/admin?erro=adicionar_produto');
    }
});

router.get('/admin/editar-produto/:id', requireAdmin, function(req, res) {
    const produto = db.getProdutoById(req.params.id);
    if (!produto) {
        return res.redirect('/admin?erro=produto_nao_encontrado');
    }
    res.render('pages/editar-produto', { produto: produto, erro: null });
});

router.post('/admin/editar-produto/:id', requireAdmin, upload.single('imagem'), function(req, res) {
    try {
        const produto = db.getProdutoById(req.params.id);
        if (!produto) {
            return res.redirect('/admin?erro=produto_nao_encontrado');
        }

        let imagemPath = produto.imagem;
        
        if (req.file) {
            imagemPath = '/imagens/produtos/' + req.file.filename;
            
            if (produto.imagem !== '/imagens/foto.jpg') {
                const imagemAntiga = path.join(__dirname, '../public', produto.imagem);
                if (fs.existsSync(imagemAntiga)) {
                    fs.unlinkSync(imagemAntiga);
                }
            }
        }
        
        let preco = parseFloat(req.body.preco);
        if (isNaN(preco) || preco < 0) {
            preco = 0;
        }
        
        let precoDesconto = null;
        if (req.body.precoDesconto && req.body.precoDesconto !== '') {
            precoDesconto = parseFloat(req.body.precoDesconto);
            if (isNaN(precoDesconto) || precoDesconto < 0) {
                precoDesconto = null;
            }
        }
        
        const produtoAtualizado = {
            nome: req.body.nome || produto.nome,
            preco: preco,
            precoDesconto: precoDesconto,
            categoria: req.body.categoria || produto.categoria,
            descricao: req.body.descricao || produto.descricao,
            imagem: imagemPath,
            status: req.body.status || produto.status
        };
        
        db.updateProduto(req.params.id, produtoAtualizado);
        res.redirect('/admin?sucesso=produto_editado');
    } catch (error) {
        console.error('Erro ao editar produto:', error);
        res.redirect('/admin?erro=editar_produto');
    }
});

router.post('/admin/excluir-produto/:id', requireAdmin, function(req, res) {
    try {
        const produto = db.getProdutoById(req.params.id);
        if (!produto) {
            return res.redirect('/admin?erro=produto_nao_encontrado');
        }

        if (produto.imagem !== '/imagens/foto.jpg') {
            const imagemPath = path.join(__dirname, '../public', produto.imagem);
            if (fs.existsSync(imagemPath)) {
                fs.unlinkSync(imagemPath);
            }
        }

        db.deleteProduto(req.params.id);
        res.redirect('/admin?sucesso=produto_excluido');
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        res.redirect('/admin?erro=excluir_produto');
    }
});

router.post('/admin/excluir-usuario/:email', requireAdmin, function(req, res) {
    try {
        db.deleteUsuario(req.params.email);
        res.redirect('/admin?sucesso=usuario_excluido');
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.redirect('/admin?erro=excluir_usuario');
    }
});

router.post('/admin/editar-banner/:id', requireAdmin, function(req, res) {
    uploadBanner.single('imagem')(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            console.error('Erro Multer ao fazer upload do banner:', err);
            return res.redirect('/admin?erro=editar_banner');
        } else if (err) {
            console.error('Erro ao fazer upload do banner:', err);
            return res.redirect('/admin?erro=editar_banner');
        }
        
        try {
            const bannerId = parseInt(req.params.id);
            
            if (isNaN(bannerId)) {
                console.error('ID do banner inválido:', req.params.id);
                return res.redirect('/admin?erro=banner_nao_encontrado');
            }
            
            const banner = db.getBannerById(bannerId);
            
            if (!banner) {
                console.error(`Banner com ID ${bannerId} não encontrado no banco`);
                return res.redirect('/admin?erro=banner_nao_encontrado');
            }
            
            let imagemPath = banner.imagem;
            
            if (req.file) {
                imagemPath = '/imagens/' + req.file.filename;
                
                const imagensOriginais = ['/imagens/1.png', '/imagens/2.png', '/imagens/3.png'];
                if (!imagensOriginais.includes(banner.imagem)) {
                    const imagemAntiga = path.join(__dirname, '../public', banner.imagem);
                    if (fs.existsSync(imagemAntiga)) {
                        try {
                            fs.unlinkSync(imagemAntiga);
                        } catch (err) {
                            console.error('Erro ao deletar imagem antiga:', err);
                        }
                    }
                }
            }
            
            let legenda = req.body.legenda || '';
            legenda = legenda.trim();
            
            if (legenda.length === 0) {
                legenda = banner.legenda;
            }
            
            let link = req.body.link || '/home';
            link = link.trim();
            
            if (!link.startsWith('/')) {
                link = '/' + link;
            }
            
            if (link.includes('javascript:') || link.includes('<script') || link.includes('onclick')) {
                console.error('Link potencialmente malicioso bloqueado:', link);
                return res.redirect('/admin?erro=editar_banner');
            }
            
            const bannerAtualizado = {
                legenda: legenda,
                imagem: imagemPath,
                link: link
            };
            
            const sucesso = db.updateBanner(bannerId, bannerAtualizado);
            
            if (sucesso) {
                return res.redirect('/admin?sucesso=banner_editado');
            } else {
                if (req.file) {
                    const arquivoNovo = path.join(__dirname, '../public/imagens', req.file.filename);
                    if (fs.existsSync(arquivoNovo)) {
                        try {
                            fs.unlinkSync(arquivoNovo);
                        } catch (err) {
                            console.error('Erro ao remover arquivo após falha:', err);
                        }
                    }
                }
                
                return res.redirect('/admin?erro=editar_banner');
            }
        } catch (error) {
            console.error('Erro crítico ao editar banner:', error);
            
            if (req.file) {
                const arquivoPath = path.join(__dirname, '../public/imagens', req.file.filename);
                if (fs.existsSync(arquivoPath)) {
                    try {
                        fs.unlinkSync(arquivoPath);
                    } catch (err) {
                        console.error('Erro ao remover arquivo após erro crítico:', err);
                    }
                }
            }
            
            return res.redirect('/admin?erro=editar_banner');
        }
    });
});

router.get('/produto/:id', function(req, res) {
    const produto = db.getProdutoById(req.params.id);
    if (!produto) {
        return res.redirect('/home');
    }
    
    const produtos = db.getProdutos();
    const usuarioLogado = req.session.usuarioEmail ? true : false;
    const isAdmin = req.session.isAdmin || false;
    
    const identificador = usuarioLogado && !isAdmin ? req.session.usuarioEmail : req.session.sessionId;
    const temProdutoNoCarrinho = db.usuarioTemProdutoNoCarrinho(req.params.id, identificador);
    
    res.render('pages/produto', { 
        produto: produto, 
        produtos: produtos,
        usuarioLogado: usuarioLogado,
        temProdutoNoCarrinho: temProdutoNoCarrinho,
        isAdmin: isAdmin
    });
});

router.post('/produto/:id/adicionar-carrinho', blockAdmin, function(req, res) {
    const produto = db.getProdutoById(req.params.id);
    
    if (!produto || produto.status === 'fora-de-estoque') {
        return res.redirect('/produto/' + req.params.id + '?erro=fora_de_estoque');
    }
    
    const identificador = req.session.usuarioEmail || req.session.sessionId;
    db.addToCarrinho(req.params.id, identificador);
    res.redirect('/carrinho');
});

router.get('/carrinho', blockAdmin, function(req, res) {
    const identificador = req.session.usuarioEmail || req.session.sessionId;
    const carrinho = db.getCarrinho(identificador);
    const usuarioLogado = req.session.usuarioEmail ? true : false;
    res.render('pages/carrinho', { carrinho: carrinho, usuarioLogado: usuarioLogado });
});

router.post('/carrinho/atualizar/:id', blockAdmin, function(req, res) {
    const novaQuantidade = parseInt(req.body.quantidade);
    const identificador = req.session.usuarioEmail || req.session.sessionId;
    db.updateQuantidadeCarrinho(req.params.id, identificador, novaQuantidade);
    res.redirect('/carrinho');
});

router.post('/carrinho/remover/:id', blockAdmin, function(req, res) {
    const identificador = req.session.usuarioEmail || req.session.sessionId;
    db.removeFromCarrinho(req.params.id, identificador);
    res.redirect('/carrinho');
});

router.post('/produto/:id/avaliar', requireLogin, blockAdmin, function(req, res) {
    const novaAvaliacao = {
        nota: parseInt(req.body.nota),
        texto: req.body.texto
    };
    
    const sucesso = db.addAvaliacao(req.params.id, novaAvaliacao, req.session.usuarioEmail);
    
    if (!sucesso) {
        return res.redirect('/produto/' + req.params.id + '?erro=carrinho');
    }
    
    res.redirect('/produto/' + req.params.id);
});

router.get('/categoria/:nome', function(req, res) {
    const produtosCategoria = db.getProdutosByCategoria(req.params.nome);
    res.render('pages/categoria', { categoria: req.params.nome, produtos: produtosCategoria });
});

router.get('/parceiros', function(req, res) {
    res.render('pages/parceiros', { 
        sucesso: null, 
        erro: null,
        valores: { empresa: '', email: '', categorias: [], descricao: '' }
    });
});

router.post('/parceiros',
    body("empresa")
        .notEmpty().withMessage('Nome da empresa é obrigatório!')
        .isLength({ min: 3, max: 100 }).withMessage('Nome da empresa deve ter entre 3 e 100 caracteres!'),
    body("email")
        .notEmpty().withMessage('E-mail é obrigatório!')
        .isEmail().withMessage('E-mail inválido!'),
    body("categorias")
        .custom((value) => {
            if (!value || (Array.isArray(value) && value.length === 0)) {
                throw new Error('Selecione pelo menos uma categoria!');
            }
            return true;
        }),
    body("descricao")
        .notEmpty().withMessage('Descrição é obrigatória!')
        .isLength({ min: 50, max: 1000 }).withMessage('Descrição deve ter entre 50 e 1000 caracteres!'),
    async (req, res) => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const primeiroErro = errors.array()[0].msg;
            return res.render('pages/parceiros', { 
                sucesso: null, 
                erro: primeiroErro,
                valores: req.body
            });
        }

        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_PARCEIROS,
                    pass: process.env.EMAIL_PARCEIROS_PASS
                },
                tls: {
                    rejectUnauthorized: false
                },
                debug: true,
                logger: true
            });

            await transporter.verify();

            const categoriasSelecionadas = Array.isArray(req.body.categorias) 
                ? req.body.categorias.join(', ') 
                : req.body.categorias;

            const mailOptions = {
                from: `"Sistema +Saúde" <${process.env.EMAIL_PARCEIROS}>`,
                to: process.env.EMAIL_PARCEIROS || 'maisaudeods3parceiros@gmail.com',
                subject: `Nova Solicitação de Parceria - ${req.body.empresa}`,
                html: `
                    <section style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                        <h2 style="color: #163069; border-bottom: 3px solid #4da6ff; padding-bottom: 10px;">Nova Solicitação de Parceria</h2>
                        
                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">Nome da Empresa</h3>
                            <output style="color: #555; display: block;">${req.body.empresa}</output>
                        </article>
                        
                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">Categoria dos Produtos</h3>
                            <output style="color: #555; display: block;">${categoriasSelecionadas}</output>
                        </article>

                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">E-mail de Contato</h3>
                            <output style="color: #555; display: block;"><a href="mailto:${req.body.email}" style="color: #4da6ff; text-decoration: none;">${req.body.email}</a></output>
                        </article>
                        
                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">Proposta</h3>
                            <output style="color: #555; display: block; white-space: pre-wrap;">${req.body.descricao.replace(/\n/g, '<br>')}</output>
                        </article>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <footer style="text-align: center; padding: 10px;">
                            <output style="color: #888; font-size: 12px; display: block;"><em>E-mail enviado automaticamente pelo sistema de parcerias +Saúde</em></output>
                        </footer>
                    </section>
                `,
                text: `
Nova Solicitação de Parceria

Nome da Empresa:
${req.body.empresa}

Categoria dos Produtos:
${categoriasSelecionadas}

E-mail de Contato:
${req.body.email}

Proposta:
${req.body.descricao}

---
E-mail enviado automaticamente pelo sistema de parcerias +Saúde
                `.trim()
            };

            await transporter.sendMail(mailOptions);

            res.render('pages/parceiros', { 
                sucesso: true, 
                erro: null,
                valores: { empresa: '', email: '', categorias: [], descricao: '' }
            });

        } catch (error) {
            console.error('=== ERRO AO ENVIAR E-MAIL ===');
            console.error('Tipo de erro:', error.name);
            console.error('Mensagem:', error.message);
            console.error('Código:', error.code);
            console.error('Stack completo:', error.stack);
            console.error('=== FIM DO ERRO ===');
            
            let mensagemErro = 'Erro ao enviar solicitação. Tente novamente mais tarde.';
            
            if (error.code === 'EAUTH') {
                mensagemErro = 'Erro de autenticação. Verifique as credenciais de e-mail.';
            } else if (error.code === 'ESOCKET') {
                mensagemErro = 'Erro de conexão. Verifique sua conexão com a internet.';
            } else if (error.responseCode === 535) {
                mensagemErro = 'Senha incorreta ou Senha de App não configurada.';
            }
            
            res.render('pages/parceiros', { 
                sucesso: null, 
                erro: mensagemErro,
                valores: req.body
            });
        }
    }
);

router.get('/atendimento', function(req, res) {
    res.render('pages/atendimento', { 
        sucesso: null, 
        erro: null,
        valores: { email: '', mensagem: '' }
    });
});

router.post('/atendimento',
    body("email")
        .notEmpty().withMessage('E-mail é obrigatório!')
        .isEmail().withMessage('E-mail inválido!'),
    body("mensagem")
        .notEmpty().withMessage('Mensagem é obrigatória!')
        .isLength({ min: 20, max: 1000 }).withMessage('A mensagem deve ter entre 20 e 1000 caracteres!'),
    async (req, res) => {
        const errors = validationResult(req);
        
        if (!errors.isEmpty()) {
            const primeiroErro = errors.array()[0].msg;
            return res.render('pages/atendimento', { 
                sucesso: null, 
                erro: primeiroErro,
                valores: req.body
            });
        }

        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                },
                debug: true,
                logger: true
            });

            await transporter.verify();

            const mailOptions = {
                from: `"Sistema +Saúde - SAC" <${process.env.EMAIL_USER}>`,
                to: 'maisaudeods3SAC@gmail.com',
                replyTo: req.body.email,
                subject: `Nova Mensagem do SAC - ${req.body.email}`,
                html: `
                    <section style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                        <h2 style="color: #163069; border-bottom: 3px solid #4da6ff; padding-bottom: 10px;">Nova Mensagem da Central de Atendimento</h2>
                        
                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">E-mail do Cliente</h3>
                            <output style="color: #555; display: block;">
                                <a href="mailto:${req.body.email}" style="color: #4da6ff; text-decoration: none;">${req.body.email}</a>
                            </output>
                        </article>
                        
                        <article style="background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px;">
                            <h3 style="color: #333; margin-top: 0;">Mensagem</h3>
                            <output style="color: #555; display: block; white-space: pre-wrap;">${req.body.mensagem.replace(/\n/g, '<br>')}</output>
                        </article>
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <footer style="text-align: center; padding: 10px;">
                            <output style="color: #888; font-size: 12px; display: block;">
                                <em>E-mail enviado automaticamente pelo sistema de atendimento +Saúde</em>
                            </output>
                            <output style="color: #888; font-size: 12px; display: block; margin-top: 5px;">
                                <em>Para responder, utilize o e-mail: ${req.body.email}</em>
                            </output>
                        </footer>
                    </section>
                `,
                text: `
Nova Mensagem da Central de Atendimento

E-mail do Cliente:
${req.body.email}

Mensagem:
${req.body.mensagem}

---
E-mail enviado automaticamente pelo sistema de atendimento +Saúde
Para responder, utilize o e-mail: ${req.body.email}
                `.trim()
            };

            await transporter.sendMail(mailOptions);

            res.render('pages/atendimento', { 
                sucesso: true, 
                erro: null,
                valores: { email: '', mensagem: '' }
            });

        } catch (error) {
            console.error('=== ERRO AO ENVIAR E-MAIL ===');
            console.error('Tipo de erro:', error.name);
            console.error('Mensagem:', error.message);
            console.error('Código:', error.code);
            console.error('Stack completo:', error.stack);
            console.error('=== FIM DO ERRO ===');
            
            let mensagemErro = 'Erro ao enviar mensagem. Tente novamente mais tarde.';
            
            if (error.code === 'EAUTH') {
                mensagemErro = 'Erro de autenticação. Verifique as credenciais de e-mail.';
            } else if (error.code === 'ESOCKET') {
                mensagemErro = 'Erro de conexão. Verifique sua conexão com a internet.';
            } else if (error.responseCode === 535) {
                mensagemErro = 'Senha incorreta ou Senha de App não configurada.';
            }
            
            res.render('pages/atendimento', { 
                sucesso: null, 
                erro: mensagemErro,
                valores: req.body
            });
        }
    }
);

router.get('/logout', function(req, res) {
    req.session.destroy(function(err) {
        if (err) {
            console.error('Erro ao destruir sessão:', err);
        }
        res.redirect('/login');
    });
});

module.exports = router;