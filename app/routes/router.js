var express    = require('express');
var router     = express.Router();
var { body, validationResult } = require('express-validator');
var session    = require('express-session');
var multer     = require('multer');
var path       = require('path');
var fs         = require('fs');
var nodemailer = require('nodemailer');
require('dotenv').config();

// ── Models MySQL ──────────────────────────────────────────────────────────────
const { usuariosModel  } = require('../models/usuariosmodel');
const { produtosModel  } = require('../models/produtosmodel');
const { carrinhoModel  } = require('../models/carrinhomodel');
const { bannersModel   } = require('../models/bannersmodel');

// ── Validações ────────────────────────────────────────────────────────────────
var { valCPF, valDDD, valTel, valNasc, valSenha, valCsenha } = require('../helpers/validacoes');

// ── Sessão ────────────────────────────────────────────────────────────────────
router.use(session({
    secret: process.env.SESSION_SECRET || 'chave-secreta-farmacia-super-segura-2024',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── Multer — produtos ─────────────────────────────────────────────────────────
const storageProduto = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/imagens/produtos');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'produto-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
    }
});
const uploadProduto = multer({
    storage: storageProduto,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) &&
        /jpeg|jpg|png|webp/.test(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Apenas imagens JPG, PNG ou WEBP são permitidas!'));
    }
});

// ── Multer — banners ──────────────────────────────────────────────────────────
const storageBanner = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../public/imagens');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, 'banner-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname));
    }
});
const uploadBanner = multer({
    storage: storageBanner,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())
            ? cb(null, true)
            : cb(new Error('Apenas imagens são permitidas!'));
    }
});

// ── Constantes admin ──────────────────────────────────────────────────────────
const ADMIN_EMAIL    = process.env.EMAIL_USER || 'maisaudeods3@gmail.com';
const ADMIN_PASSWORD = '+SaudeINI2D';

// ── Middleware global — session_id anônimo ────────────────────────────────────
router.use((req, res, next) => {
    if (!req.session.sessionId) {
        req.session.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    next();
});

// ── Middleware global — injeta usuario/isAdmin nas views ──────────────────────
router.use(async (req, res, next) => {
    res.locals.usuario  = null;
    res.locals.isAdmin  = false;

    if (req.session && req.session.usuarioEmail) {
        if (req.session.usuarioEmail === ADMIN_EMAIL && req.session.isAdmin) {
            res.locals.isAdmin = true;
            res.locals.usuario = { email: ADMIN_EMAIL, nome: 'Administrador' };
        } else {
            const usuario = await usuariosModel.findByEmail(req.session.usuarioEmail);
            if (usuario) res.locals.usuario = usuario;
        }
    }
    next();
});

// ── Guards ────────────────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIdentificador(req) {
    return {
        id_usuario: req.session.idUsuario || null,
        session_id: req.session.sessionId
    };
}

// Garante array de ids de categoria a partir do body
function parseCategorias(body) {
    let cats = body.categorias || body.id_categorias || [];
    if (!Array.isArray(cats)) cats = [cats];
    return cats.map(Number).filter(n => n > 0);
}

// =============================================================================
// ROTAS
// =============================================================================

router.get('/', (req, res) => res.redirect('/home'));

// ── Cadastro ──────────────────────────────────────────────────────────────────
router.get('/cadastro', (req, res) => {
    res.render('pages/cadastro', {
        erros: null,
        valores: { nome: '', nasc: '', cpf: '', ddd: '', tel: '', email: '', senhan: '', csenha: '' },
        listaErros: null
    });
});

router.post('/cadastro',
    body('nome').isLength({ min: 3, max: 50 }).withMessage('Nome deve conter de 3 a 50 caracteres!'),
    body('cpf').isLength({ min: 11, max: 11 }).withMessage('CPF deve ter 11 dígitos!')
        .custom(v => { if (!valCPF(v)) throw new Error('CPF inválido!'); return true; }),
    body('nasc').isISO8601().withMessage('Data inválida!')
        .custom(v => { if (!valNasc(v)) throw new Error('Data de nascimento inválida!'); return true; }),
    body('ddd').isLength({ min: 2, max: 2 }).withMessage('DDD deve ter 2 dígitos!')
        .custom(v => { if (!valDDD(v)) throw new Error('DDD inválido!'); return true; }),
    body('tel').isLength({ min: 9, max: 9 }).withMessage('Telefone deve ter 9 dígitos!')
        .custom(v => { if (!valTel(v)) throw new Error('Telefone inválido!'); return true; }),
    body('email').isEmail().withMessage('E-mail inválido!')
        .custom(async v => {
            const existe = await usuariosModel.findByEmail(v);
            if (existe) throw new Error('E-mail já cadastrado!');
            return true;
        }),
    body('senhan').isLength({ min: 6, max: 20 }).withMessage('Senha deve ter de 6 a 20 caracteres!')
        .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .withMessage('Senha precisa de maiúscula, número e caractere especial!'),
    body('csenha').custom((v, { req }) => {
        if (v !== req.body.senhan) throw new Error('As senhas não conferem!');
        return true;
    }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/cadastro', { erros: true, valores: req.body, listaErros: errors });
        }
        await usuariosModel.create(req.body);
        res.redirect('/login');
    }
);

// ── Login ─────────────────────────────────────────────────────────────────────
router.get('/login', (req, res) => {
    const erroAdmin = req.query.erro === 'admin'
        ? 'Acesso negado. Apenas administradores podem acessar esta área.'
        : null;
    res.render('pages/login', { erro: erroAdmin, redirect: req.query.redirect || '/home' });
});

router.post('/login',
    body('email').isEmail().withMessage('E-mail inválido!'),
    body('senha').notEmpty().withMessage('Senha obrigatória!'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/login', { erro: 'E-mail ou senha inválidos!', redirect: '/home' });
        }

        if (req.body.email === ADMIN_EMAIL && req.body.senha === ADMIN_PASSWORD) {
            req.session.usuarioEmail = ADMIN_EMAIL;
            req.session.isAdmin      = true;
            return res.redirect('/admin');
        }

        const usuario = await usuariosModel.findByEmail(req.body.email);
        if (usuario && req.body.senha === usuario.senhan) {
            await carrinhoModel.migrarParaUsuario(req.session.sessionId, usuario.id_usuario);
            req.session.usuarioEmail = usuario.email;
            req.session.idUsuario    = usuario.id_usuario;
            req.session.isAdmin      = false;
            const redirectUrl = req.body.redirect || '/home';
            return res.redirect(redirectUrl);
        }

        return res.render('pages/login', { erro: 'E-mail ou senha inválidos!', redirect: '/home' });
    }
);

// ── Home ──────────────────────────────────────────────────────────────────────
router.get('/home', async (req, res) => {
    const produtos    = await produtosModel.findAll();
    const banners     = await bannersModel.findAll();
    const categorias  = await produtosModel.findAllCategorias();

    const produtosNormalizados = produtos.map(p => ({
        ...p,
        id:            p.id_produto,
        precoDesconto: p.preco_desconto,
        avaliacoes:    []
    }));

    res.render('pages/home', { produtos: produtosNormalizados, banners, categorias });
});

// ── Usuário ───────────────────────────────────────────────────────────────────
router.get('/usuario', async (req, res) => {
    if (!req.session.usuarioEmail) {
        return res.render('pages/usuario', { usuario: null, mensagemSucesso: null, mensagemErro: null });
    }
    const usuario = await usuariosModel.findByEmail(req.session.usuarioEmail);
    res.render('pages/usuario', {
        usuario,
        mensagemSucesso: req.query.sucesso ? decodeURIComponent(req.query.sucesso) : null,
        mensagemErro:    req.query.erro    ? decodeURIComponent(req.query.erro)    : null
    });
});

router.post('/usuario/atualizar-campo', requireLogin,
    body('campo').isIn(['nome', 'nasc', 'cpf', 'ddd', 'tel']).withMessage('Campo inválido!'),
    body('valor').notEmpty().withMessage('Valor obrigatório!'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.redirect('/usuario?erro=' + encodeURIComponent(errors.array()[0].msg));
        }

        const { campo, valor } = req.body;

        if (campo === 'nome' && (valor.length < 3 || valor.length > 50)) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('Nome deve ter entre 3 e 50 caracteres!'));
        }
        if (campo === 'cpf' && !valCPF(valor)) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('CPF inválido!'));
        }
        if (campo === 'nasc' && !valNasc(valor)) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('Data de nascimento inválida!'));
        }
        if (campo === 'ddd' && !valDDD(valor)) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('DDD inválido!'));
        }
        if (campo === 'tel' && !valTel(valor)) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('Telefone inválido!'));
        }

        await usuariosModel.updateCampo(req.session.usuarioEmail, campo, valor);
        const labels = { nome: 'Nome', nasc: 'Data de nascimento', cpf: 'CPF', ddd: 'DDD', tel: 'Telefone' };
        res.redirect('/usuario?sucesso=' + encodeURIComponent(labels[campo] + ' atualizado com sucesso!'));
    }
);

// ── Admin — Painel ────────────────────────────────────────────────────────────
router.get('/admin', requireAdmin, async (req, res) => {
    const produtos   = await produtosModel.findAll();
    const usuarios   = await usuariosModel.findAll();
    const banners    = await bannersModel.findAll();
    const categorias = await produtosModel.findAllCategorias();

    const produtosNorm = produtos.map(p => ({
        ...p,
        id:            p.id_produto,
        precoDesconto: p.preco_desconto
    }));

    res.render('pages/admin', {
        produtos:      produtosNorm,
        totalProdutos: produtosNorm.length,
        usuarios,
        banners,
        categorias,
        erro:    req.query.erro    || null,
        sucesso: req.query.sucesso || null
    });
});

// ── Admin — Adicionar produto ─────────────────────────────────────────────────
router.post('/admin/adicionar-produto', requireAdmin, uploadProduto.single('imagem'), async (req, res) => {
    try {
        const imagemPath = req.file ? '/imagens/produtos/' + req.file.filename : '/imagens/foto.jpg';
        const preco      = parseFloat(req.body.preco) || 0;
        const precoDesc  = req.body.precoDesconto ? parseFloat(req.body.precoDesconto) || null : null;

        // Pega array de ids_categorias enviados pelo formulário
        const ids_categorias = parseCategorias(req.body);

        if (ids_categorias.length === 0) {
            return res.redirect('/admin?erro=categoria_invalida');
        }

        const result = await produtosModel.create({
            nome:           req.body.nome || 'Produto sem nome',
            descricao:      req.body.descricao || '',
            preco,
            preco_desconto: precoDesc,
            imagem:         imagemPath,
            status:         req.body.status || 'em-estoque'
        }, ids_categorias);

        if (result && result.errno) {
            console.error('Erro ao criar produto:', result);
            return res.redirect('/admin?erro=adicionar_produto');
        }

        res.redirect('/admin?sucesso=produto_adicionado');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=adicionar_produto');
    }
});

// ── Admin — Editar produto (GET) ──────────────────────────────────────────────
router.get('/admin/editar-produto/:id', requireAdmin, async (req, res) => {
    const produto    = await produtosModel.findById(req.params.id);
    if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');
    const categorias = await produtosModel.findAllCategorias();

    // ids das categorias já associadas
    const ids_atual = produto.ids_categorias
        ? produto.ids_categorias.split(',').map(Number)
        : [];

    res.render('pages/editar-produto', {
        produto: { ...produto, id: produto.id_produto, precoDesconto: produto.preco_desconto, ids_categorias_atual: ids_atual },
        categorias,
        erro: null
    });
});

// ── Admin — Editar produto (POST) ─────────────────────────────────────────────
router.post('/admin/editar-produto/:id', requireAdmin, uploadProduto.single('imagem'), async (req, res) => {
    try {
        const produto = await produtosModel.findById(req.params.id);
        if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');

        let imagemPath = produto.imagem;
        if (req.file) {
            imagemPath = '/imagens/produtos/' + req.file.filename;
            if (produto.imagem && produto.imagem !== '/imagens/foto.jpg') {
                const old = path.join(__dirname, '../public', produto.imagem);
                if (fs.existsSync(old)) fs.unlinkSync(old);
            }
        }

        const ids_categorias = parseCategorias(req.body);
        if (ids_categorias.length === 0) {
            return res.redirect('/admin?erro=categoria_invalida');
        }

        const result = await produtosModel.update(req.params.id, {
            nome:           req.body.nome || produto.nome,
            descricao:      req.body.descricao || produto.descricao,
            preco:          parseFloat(req.body.preco) || 0,
            preco_desconto: req.body.precoDesconto ? parseFloat(req.body.precoDesconto) || null : null,
            imagem:         imagemPath,
            status:         req.body.status || produto.status
        }, ids_categorias);

        if (result && result.errno) {
            console.error('Erro ao atualizar produto:', result);
            return res.redirect('/admin?erro=editar_produto');
        }

        res.redirect('/admin?sucesso=produto_editado');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=editar_produto');
    }
});

// ── Admin — Excluir produto ───────────────────────────────────────────────────
router.post('/admin/excluir-produto/:id', requireAdmin, async (req, res) => {
    try {
        const produto = await produtosModel.findById(req.params.id);
        if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');
        if (produto.imagem && produto.imagem !== '/imagens/foto.jpg') {
            const imgPath = path.join(__dirname, '../public', produto.imagem);
            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }
        await produtosModel.delete(req.params.id);
        res.redirect('/admin?sucesso=produto_excluido');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=excluir_produto');
    }
});

// ── Admin — Excluir usuário ───────────────────────────────────────────────────
router.post('/admin/excluir-usuario/:email', requireAdmin, async (req, res) => {
    try {
        await usuariosModel.delete(req.params.email);
        res.redirect('/admin?sucesso=usuario_excluido');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=excluir_usuario');
    }
});

// ── Admin — Criar categoria ───────────────────────────────────────────────────
router.post('/admin/criar-categoria', requireAdmin, async (req, res) => {
    try {
        const nome = (req.body.nome_categoria || '').trim();
        if (!nome || nome.length < 2) {
            return res.redirect('/admin?erro=categoria_nome_invalido');
        }
        // Verifica se já existe
        const existe = await produtosModel.findCategoriaPorNome(nome);
        if (existe) {
            return res.redirect('/admin?erro=categoria_ja_existe');
        }
        const result = await produtosModel.createCategoria(nome);
        if (result && result.errno) {
            return res.redirect('/admin?erro=criar_categoria');
        }
        res.redirect('/admin?sucesso=categoria_criada');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=criar_categoria');
    }
});

// ── Admin — Excluir categoria ─────────────────────────────────────────────────
router.post('/admin/excluir-categoria/:id', requireAdmin, async (req, res) => {
    try {
        await produtosModel.deleteCategoria(req.params.id);
        res.redirect('/admin?sucesso=categoria_excluida');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=excluir_categoria');
    }
});

// ── Admin — Editar banner ─────────────────────────────────────────────────────
router.post('/admin/editar-banner/:id', requireAdmin, (req, res) => {
    uploadBanner.single('imagem')(req, res, async (err) => {
        if (err) return res.redirect('/admin?erro=editar_banner');
        try {
            const bannerId = parseInt(req.params.id);
            const banner   = await bannersModel.findById(bannerId);
            if (!banner) return res.redirect('/admin?erro=banner_nao_encontrado');

            let imagemPath = banner.imagem;
            if (req.file) {
                imagemPath = '/imagens/' + req.file.filename;
                const originais = ['/imagens/1.png', '/imagens/2.png', '/imagens/3.png'];
                if (!originais.includes(banner.imagem)) {
                    const old = path.join(__dirname, '../public', banner.imagem);
                    if (fs.existsSync(old)) { try { fs.unlinkSync(old); } catch(_) {} }
                }
            }

            let legenda = (req.body.legenda || '').trim() || banner.legenda;
            let link    = (req.body.link    || '/home').trim();
            if (!link.startsWith('/')) link = '/' + link;

            await bannersModel.update(bannerId, { imagem: imagemPath, legenda, link });
            res.redirect('/admin?sucesso=banner_editado');
        } catch (e) {
            console.error(e);
            res.redirect('/admin?erro=editar_banner');
        }
    });
});

// ── Produto ───────────────────────────────────────────────────────────────────
router.get('/produto/:id', async (req, res) => {
    const produto = await produtosModel.findById(req.params.id);
    if (!produto) return res.redirect('/home');

    const produtos                       = await produtosModel.findAll();
    const { id_usuario, session_id }     = getIdentificador(req);
    const temNoCarrinho                  = await carrinhoModel.temProduto(req.params.id, id_usuario, session_id);
    const isAdmin                        = req.session.isAdmin || false;

    const produtoNorm  = { ...produto, id: produto.id_produto, precoDesconto: produto.preco_desconto };
    const produtosNorm = produtos.map(p => ({ ...p, id: p.id_produto, precoDesconto: p.preco_desconto, avaliacoes: [] }));

    res.render('pages/produto', {
        produto:              produtoNorm,
        produtos:             produtosNorm,
        usuarioLogado:        !!req.session.usuarioEmail,
        temProdutoNoCarrinho: temNoCarrinho,
        isAdmin
    });
});

router.post('/produto/:id/adicionar-carrinho', blockAdmin, async (req, res) => {
    const produto = await produtosModel.findById(req.params.id);
    if (!produto || produto.status === 'fora-de-estoque') {
        return res.redirect('/produto/' + req.params.id + '?erro=fora_de_estoque');
    }
    const { id_usuario, session_id } = getIdentificador(req);
    await carrinhoModel.addProduto(req.params.id, id_usuario, session_id);
    res.redirect('/carrinho');
});

// ── Carrinho ──────────────────────────────────────────────────────────────────
router.get('/carrinho', blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const itens = await carrinhoModel.findByIdentificador(id_usuario, session_id);
    const carrinho = itens.map(i => ({
        ...i,
        id:            i.id_produto,
        precoDesconto: i.preco_desconto
    }));
    res.render('pages/carrinho', { carrinho, usuarioLogado: !!req.session.usuarioEmail });
});

router.post('/carrinho/atualizar/:id', blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    await carrinhoModel.updateQuantidade(req.params.id, id_usuario, session_id, parseInt(req.body.quantidade));
    res.redirect('/carrinho');
});

router.post('/carrinho/remover/:id', blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    await carrinhoModel.removerProduto(req.params.id, id_usuario, session_id);
    res.redirect('/carrinho');
});

// ── Avaliação ─────────────────────────────────────────────────────────────────
router.post('/produto/:id/avaliar', requireLogin, blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const temNoCarrinho = await carrinhoModel.temProduto(req.params.id, id_usuario, session_id);
    if (!temNoCarrinho) {
        return res.redirect('/produto/' + req.params.id + '?erro=carrinho');
    }
    await produtosModel.addAvaliacao(req.params.id, id_usuario, parseInt(req.body.nota), req.body.texto);
    res.redirect('/produto/' + req.params.id);
});

// ── Categoria por slug ────────────────────────────────────────────────────────
router.get('/categoria/:slug', async (req, res) => {
    const slug = req.params.slug;

    // Verifica se é slug ou nome legado
    let categoriaInfo = await produtosModel.findCategoriaPorSlug(slug);

    let produtos;
    let nomeExibicao;

    if (categoriaInfo) {
        produtos     = await produtosModel.findBySlugCategoria(slug);
        nomeExibicao = categoriaInfo.nome;
    } else {
        // Fallback: tenta pelo nome (compatibilidade)
        const nomeDecodificado = decodeURIComponent(slug);
        if (nomeDecodificado.toLowerCase() === 'geral') {
            produtos     = await produtosModel.findByCategoria('geral');
            nomeExibicao = 'Geral';
        } else {
            produtos     = await produtosModel.findByCategoria(nomeDecodificado);
            nomeExibicao = nomeDecodificado;
        }
    }

    const produtosNorm = produtos.map(p => ({
        ...p,
        id:            p.id_produto,
        precoDesconto: p.preco_desconto,
        avaliacoes:    []
    }));

    res.render('pages/categoria', { categoria: nomeExibicao, slug, produtos: produtosNorm });
});

// ── Parceiros ─────────────────────────────────────────────────────────────────
router.get('/parceiros', (req, res) => {
    res.render('pages/parceiros', { sucesso: null, erro: null, valores: { empresa: '', email: '', categorias: [], descricao: '' } });
});

router.post('/parceiros',
    body('empresa').notEmpty().isLength({ min: 3, max: 100 }).withMessage('Nome da empresa inválido!'),
    body('email').isEmail().withMessage('E-mail inválido!'),
    body('categorias').custom(v => {
        if (!v || (Array.isArray(v) && v.length === 0)) throw new Error('Selecione pelo menos uma categoria!');
        return true;
    }),
    body('descricao').notEmpty().isLength({ min: 50, max: 1000 }).withMessage('Descrição deve ter entre 50 e 1000 caracteres!'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/parceiros', { sucesso: null, erro: errors.array()[0].msg, valores: req.body });
        }
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com', port: 587, secure: false,
                auth: { user: process.env.EMAIL_PARCEIROS, pass: process.env.EMAIL_PARCEIROS_PASS },
                tls: { rejectUnauthorized: false }
            });
            const cats = Array.isArray(req.body.categorias) ? req.body.categorias.join(', ') : req.body.categorias;
            await transporter.sendMail({
                from: `"Sistema +Saúde" <${process.env.EMAIL_PARCEIROS}>`,
                to:   process.env.EMAIL_PARCEIROS,
                subject: `Nova Solicitação de Parceria - ${req.body.empresa}`,
                text: `Empresa: ${req.body.empresa}\nCategorias: ${cats}\nE-mail: ${req.body.email}\nProposta:\n${req.body.descricao}`
            });
            res.render('pages/parceiros', { sucesso: true, erro: null, valores: { empresa: '', email: '', categorias: [], descricao: '' } });
        } catch (err) {
            console.error(err);
            res.render('pages/parceiros', { sucesso: null, erro: 'Erro ao enviar solicitação. Tente novamente.', valores: req.body });
        }
    }
);

// ── Atendimento ───────────────────────────────────────────────────────────────
router.get('/atendimento', (req, res) => {
    res.render('pages/atendimento', { sucesso: null, erro: null, valores: { email: '', mensagem: '' } });
});

router.post('/atendimento',
    body('email').isEmail().withMessage('E-mail inválido!'),
    body('mensagem').notEmpty().isLength({ min: 20, max: 1000 }).withMessage('Mensagem deve ter entre 20 e 1000 caracteres!'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/atendimento', { sucesso: null, erro: errors.array()[0].msg, valores: req.body });
        }
        try {
            const transporter = nodemailer.createTransport({
                host: 'smtp.gmail.com', port: 587, secure: false,
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
                tls: { rejectUnauthorized: false }
            });
            await transporter.sendMail({
                from:    `"Sistema +Saúde - SAC" <${process.env.EMAIL_USER}>`,
                to:      process.env.EMAIL_SAC,
                replyTo: req.body.email,
                subject: `Nova Mensagem do SAC - ${req.body.email}`,
                text:    `E-mail: ${req.body.email}\n\n${req.body.mensagem}`
            });
            res.render('pages/atendimento', { sucesso: true, erro: null, valores: { email: '', mensagem: '' } });
        } catch (err) {
            console.error(err);
            res.render('pages/atendimento', { sucesso: null, erro: 'Erro ao enviar mensagem. Tente novamente.', valores: req.body });
        }
    }
);

// ── Logout ────────────────────────────────────────────────────────────────────
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Erro ao destruir sessão:', err);
        res.redirect('/login');
    });
});

module.exports = router;