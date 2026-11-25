var express    = require('express');
var router     = express.Router();
var { body, validationResult } = require('express-validator');
const { sessaoComConsentimento, exigirCookies } = require('../middlewares/cookiesSessao');
const rotasCookies = require('./cookies');
var multer     = require('multer');
var path       = require('path');
var fs         = require('fs');
var nodemailer = require('nodemailer');
require('dotenv').config();
const {
    criarPreferencia,
    buscarPagamento,
    buscarPagamentosPorPedido,
    prazoPagamentoHoras,
    validarAssinaturaWebhook
} = require('../services/mercadopago');

// models mysql
const { usuariosModel  } = require('../models/usuariosmodel');
const { produtosModel  } = require('../models/produtosmodel');
const { carrinhoModel  } = require('../models/carrinhomodel');
const { bannersModel   } = require('../models/bannersmodel');
const { pedidosModel   } = require('../models/pedidosmodel');

// validacoes
var { valCPF, valDDD, valTel, valNasc, valSenha, valCsenha } = require('../helpers/validacoes');
const { compareSenha } = require('../helpers/auth');
const { ORIGEM, FRETE_GRATIS_A_PARTIR_DE, normalizarCep, formatarCep, consultarCep, calcularFrete } = require('../helpers/frete');

// ativacao de conta por e-mail
const { verificarTokenAtivacao } = require('../helpers/tokenAtivacao');
const { enviarEmailAtivacao, urlBaseDaRequisicao, podeReenviar, VALIDADE_HORAS } = require('../services/ativacaoConta');
const { enviarReclamacao } = require('../services/contatoService');

// >>> RECUPERAR SENHA (início: import) ---------------------------------
const { solicitarRecuperacao, validarLinkRecuperacao, VALIDADE_MINUTOS } = require('../services/recuperacaoSenha');
// <<< RECUPERAR SENHA (fim: import) -----------------------------------



// algoritmo de personalizacao
const { ordenarPorRelevancia, pontuar } = require('../helpers/personalizacao');

// chatbot Maisa
const { consultarMaisa, gerarSugestoesPersonalizadas } = require('../services/maisaService');

// cloudinary
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

// Multer upload de foto de perfil 
const uploadFoto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase();
        const mime = file.mimetype;
        const extsPermitidas  = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
        const mimesPermitidos = ['image/svg+xml', 'image/svg', 'image/png', 'image/jpeg', 'image/webp'];
        if (extsPermitidas.includes(ext) && mimesPermitidos.includes(mime)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens SVG, PNG, JPG ou WEBP são permitidas!'));
        }
    }
});

// sessao
router.use(sessaoComConsentimento);
router.use(rotasCookies);

// ── Multer: memória (sem disco) ───────────────────────────────────────────────

const fileFilter = (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;
    const extsPermitidas  = ['.svg', '.png', '.jpg', '.jpeg', '.webp'];
    const mimesPermitidos = ['image/svg+xml', 'image/svg', 'image/png', 'image/jpeg', 'image/webp'];
    if (extsPermitidas.includes(ext) && mimesPermitidos.includes(mime)) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens SVG, PNG, JPG ou WEBP são permitidas!'));
    }
};

const uploadProduto = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

const uploadBanner = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});

// ── Helper: faz upload do buffer para o Cloudinary ───────────────────────────

function uploadBufferToCloudinary(buffer, folder) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
}


function deleteCloudinaryImage(url) {
    if (!url || !url.includes('cloudinary.com')) return Promise.resolve();
    try {
        // Remove a extensão e tudo antes do primeiro segmento após /upload/
        const parts  = url.split('/upload/');
        if (parts.length < 2) return Promise.resolve();
        // Remove versionamento opcional (v1234567890/)
        const withoutVersion = parts[1].replace(/^v\d+\//, '');
        // Remove extensão
        const publicId = withoutVersion.replace(/\.[^/.]+$/, '');
        return cloudinary.uploader.destroy(publicId);
    } catch (_) {
        return Promise.resolve();
    }
}

// constantes admin
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'maisaudeods3@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// mensagens para o painel admin
const MSGS_SUCESSO = {
    produto_adicionado: 'Produto adicionado com sucesso!',
    produto_editado:    'Produto editado com sucesso!',
    produto_excluido:   'Produto excluído com sucesso!',
    usuario_excluido:   'Usuário excluído com sucesso!',
    banner_editado:     'Banner editado com sucesso!',
    banner_criado:      'Banner criado com sucesso!',
    banner_excluido:    'Banner excluído com sucesso!',
    categoria_criada:   'Categoria criada com sucesso!',
    categoria_excluida: 'Categoria excluída com sucesso!',
    categoria_editada: 'Faixa etária da categoria atualizada com sucesso!'
};

const MSGS_ERRO = {
    adicionar_produto:       'Erro ao adicionar produto! Verifique se preencheu todos os campos obrigatórios.',
    editar_produto:          'Erro ao editar produto!',
    excluir_produto:         'Erro ao excluir produto!',
    produto_nao_encontrado:  'Produto não encontrado!',
    excluir_usuario:         'Erro ao excluir usuário!',
    editar_banner:           'Erro ao editar banner! Verifique se a imagem é válida (JPG, PNG ou WEBP com máximo de 5MB).',
    criar_banner:            'Erro ao criar banner! A imagem é obrigatória e deve ser JPG, PNG ou WEBP (máx. 5MB).',
    banner_nao_encontrado:   'Banner não encontrado!',
    excluir_banner:          'Erro ao excluir banner!',
    categoria_invalida:      'Selecione ao menos uma categoria válida!',
    categoria_nome_invalido: 'Nome de categoria inválido (mínimo 2 caracteres)!',
    categoria_ja_existe:     'Já existe uma categoria com esse nome!',
    criar_categoria:         'Erro ao criar categoria!',
    excluir_categoria:       'Erro ao excluir categoria! Pode haver produtos vinculados.',
    editar_categoria: 'Erro ao atualizar faixa etária da categoria!',
    imagem_obrigatoria:      'A imagem do banner é obrigatória!'
};

// middleware global — gera sessionId para visitantes
router.use((req, res, next) => {
    if (!req.session.sessionId) {
        req.session.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    next();
});

// middleware global — popula res.locals
router.use(async (req, res, next) => {
    res.locals.usuario        = null;
    res.locals.isAdmin        = false;
    res.locals.categoriasMenu = [];

    try {
        const cats = await produtosModel.findAllCategorias();
        res.locals.categoriasMenu = Array.isArray(cats) ? cats : [];
    } catch (_) {
        res.locals.categoriasMenu = [];
    }

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

// guards
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

// helpers
function getIdentificador(req) {
    return {
        id_usuario: req.session.idUsuario || null,
        session_id: req.session.sessionId
    };
}

function parseCategorias(body) {
    let cats = body.categorias || body.id_categorias || [];
    if (typeof cats === 'string') cats = [cats];
    return cats
        .map(v => parseInt(String(v).trim(), 10))
        .filter(n => Number.isFinite(n) && n > 0);
}

// ROTAS

router.get('/', (req, res) => res.redirect('/home'));

// ── Cadastro ──────────────────────────────────────────────
router.get('/cadastro', (req, res) => {
    res.render('pages/cadastro', {
        erros: null,
        valores: { nome: '', nasc: '', cpf: '', ddd: '', tel: '', email: '', senhan: '', csenha: '' },
        listaErros: null
    });
});

router.post('/cadastro',
    body('nome').isLength({ min: 3, max: 50 }).withMessage('O nome precisa ter de 3 a 50 letras. Exemplo: Maria da Silva.'),
    body('cpf').isLength({ min: 11, max: 11 }).withMessage('O CPF precisa ter 11 números. Confira e tente de novo.')
        .custom(v => { if (!valCPF(v)) throw new Error('Esse CPF não parece certo. Confira os números e tente de novo.'); return true; }),
    body('nasc').isISO8601().withMessage('Essa data não parece certa. Confira o dia, o mês e o ano.')
        .custom(v => { if (!valNasc(v)) throw new Error('Essa data não parece certa. Confira o dia, o mês e o ano.'); return true; }),
    body('ddd').isLength({ min: 2, max: 2 }).withMessage('Digite o DDD com 2 números. Exemplo: 11.')
        .custom(v => { if (!valDDD(v)) throw new Error('Esse DDD não existe. Confira e tente de novo.'); return true; }),
    body('tel').isLength({ min: 9, max: 9 }).withMessage('O telefone precisa ter 9 números, sem o DDD. Exemplo: 99999-9999.')
        .custom(v => { if (!valTel(v)) throw new Error('Esse telefone não parece certo. Confira os números.'); return true; }),
    body('email').isEmail().withMessage('Esse e-mail não parece certo. Exemplo: nome@email.com.')
        .custom(async v => {
            const existe = await usuariosModel.findByEmail(v);
            if (existe) throw new Error('E-mail já cadastrado!');
            return true;
        }),
    body('senhan').isLength({ min: 6, max: 20 }).withMessage('A senha precisa ter de 6 a 20 caracteres.')
        .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .withMessage('Falta algo na senha: use uma letra maiúscula, um número e um símbolo (! @ # $ % ^ & *).'),
    body('csenha').custom((v, { req }) => {
        if (v !== req.body.senhan) throw new Error('As duas senhas estão diferentes. Digite a mesma senha nos dois campos.');
        return true;
    }),
    body('sexo').notEmpty().withMessage('Escolha uma das opções.')
        .isIn(['masculino','feminino','prefiro-nao-dizer']).withMessage('Escolha uma das opções.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/cadastro', { erros: true, valores: req.body, listaErros: errors });
        }
        const resultado = await usuariosModel.create(req.body);
 
        // o model devolve o erro (em vez de lançar) quando o INSERT falha
        if (!resultado || !resultado.insertId) {
            const duplicado = resultado && resultado.code === 'ER_DUP_ENTRY';
            const msg       = String((resultado && resultado.sqlMessage) || '');
            if (duplicado) {
                const campo = msg.includes('cpf') ? 'cpf' : 'email';
                const texto = campo === 'cpf' ? 'CPF já cadastrado!' : 'E-mail já cadastrado!';
                return res.render('pages/cadastro', {
                    erros: true, valores: req.body,
                    listaErros: { errors: [{ path: campo, msg: texto }] }
                });
            }
            return res.render('pages/cadastro', {
                erros: null, valores: req.body, listaErros: null,
                erroGeral: 'Não foi possível concluir o cadastro. Tente novamente em instantes.'
            });
        }
 
        // a conta só passa a valer depois que o link enviado por e-mail for acessado
        const enviado = await enviarEmailAtivacao({
            id_usuario: resultado.insertId,
            nome:       req.body.nome,
            email:      req.body.email
        });
 
        res.render('partial/ativacao', {
            estado: enviado ? 'aguardando' : 'falha-envio',
            email:  req.body.email,
            validadeHoras: VALIDADE_HORAS
        });
    }
);

// ── Ativação de conta ─────────────────────────────────────
// Rota pública: quem está ativando ainda não consegue fazer login.
router.get('/ativar-conta', async (req, res) => {
    const renderizar = (status, estado) =>
        res.status(status).render('partial/ativacao', { estado, email: null, validadeHoras: VALIDADE_HORAS });
 
    const token = verificarTokenAtivacao(req.query.token);
    if (!token.ok) return renderizar(400, 'link-invalido');
 
    const usuario = await usuariosModel.findParaAtivacao(token.idUsuario);
    // o e-mail dentro do token precisa ser o mesmo da conta
    if (!usuario || usuario.email !== token.email) return renderizar(400, 'link-invalido');
 
    if (Number(usuario.ativo) !== 0) return renderizar(200, 'ja-ativa');
 
    const ativada = await usuariosModel.ativarConta(usuario.id_usuario);
    if (!ativada) return renderizar(500, 'erro-ativacao');
 
    return renderizar(200, 'sucesso');
});
 
router.get('/reenviar-ativacao', (req, res) => {
    res.render('partial/reenviar-ativacao', { erro: null, email: '' });
});
 
router.post('/reenviar-ativacao',
    body('email').trim().isEmail().withMessage('Digite um e-mail válido. Exemplo: nome@email.com.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('partial/reenviar-ativacao', {
                erro:  errors.array()[0].msg,
                email: req.body.email || ''
            });
        }
 
        const email   = req.body.email.trim();
        const usuario = await usuariosModel.findParaAtivacaoPorEmail(email);
 
        // só reenvia para conta existente e ainda inativa, respeitando o intervalo mínimo
        if (usuario && Number(usuario.ativo) === 0 && podeReenviar(usuario.email)) {
            await enviarEmailAtivacao(usuario, urlBaseDaRequisicao(req));
        }
 
        // resposta idêntica em qualquer caso: não revela se o e-mail está cadastrado
        res.render('partial/ativacao', { estado: 'reenviado', email, validadeHoras: VALIDADE_HORAS });
    }
);

// >>> RECUPERAR SENHA (início: rotas) ---------------------------------
// ── Recuperação de senha ("Esqueci minha senha") ──────────
const MSG_LINK_INVALIDO = 'Este link é inválido ou expirou. Informe seu e-mail para receber um novo.';

// quem já está logado não precisa recuperar a senha (mesma ideia do verificarUsuAutenticado dos slides)
function redirecionarSeLogado(req, res, next) {
    if (req.session && req.session.usuarioEmail) {
        return res.redirect(req.session.isAdmin ? '/admin' : '/home');
    }
    next();
}

// regras da nova senha: as mesmas do cadastro
const regrasNovaSenha = [
    body('senhan').isLength({ min: 6, max: 20 }).withMessage('A senha precisa ter de 6 a 20 caracteres.')
        .matches(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .withMessage('Falta algo na senha: use uma letra maiúscula, um número e um símbolo (! @ # $ % ^ & *).'),
    body('csenha').custom((v, { req }) => {
        if (v !== req.body.senhan) throw new Error('As duas senhas estão diferentes. Digite a mesma senha nos dois campos.');
        return true;
    })
];

function renderRecuperarSenha(res, { status = 200, erro = null, email = '', enviado = false } = {}) {
    return res.status(status).render('pages/recuperar-senha', {
        erro, email, enviado, validadeMinutos: VALIDADE_MINUTOS
    });
}

// 1) formulário onde o usuário informa o e-mail
router.get('/recuperar-senha', redirecionarSeLogado, (req, res) => {
    renderRecuperarSenha(res);
});

router.post('/recuperar-senha', redirecionarSeLogado,
    body('email').trim().isEmail().withMessage('Digite um e-mail válido. Exemplo: nome@email.com.'),
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return renderRecuperarSenha(res, {
                status: 400,
                erro:   errors.array()[0].msg,
                email:  req.body.email || ''
            });
        }

        const email = req.body.email.trim();

        // sem "await" de propósito: a resposta demora o mesmo tempo exista o e-mail ou não,
        // então não dá para descobrir quais e-mails estão cadastrados medindo o tempo
        solicitarRecuperacao(email, urlBaseDaRequisicao(req));

        // resposta idêntica em qualquer caso: não revela se o e-mail está cadastrado
        renderRecuperarSenha(res, { email, enviado: true });
    }
);

// 2) link recebido por e-mail: valida o token e mostra o formulário da nova senha
router.get('/resetar-senha', async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const token     = String(req.query.token || '');
    const validacao = await validarLinkRecuperacao(token);
    if (!validacao.ok) {
        return renderRecuperarSenha(res, { status: 400, erro: MSG_LINK_INVALIDO });
    }

    res.render('pages/resetar-senha', { token, erros: {}, erroGeral: null });
});

// 3) grava a nova senha. O usuário vem do TOKEN (revalidado aqui), nunca de um
// campo do formulário: assim ninguém consegue trocar a senha de outra conta.
router.post('/resetar-senha', regrasNovaSenha, async (req, res) => {
    res.set('Cache-Control', 'no-store');

    const token     = String(req.body.token || '');
    const validacao = await validarLinkRecuperacao(token);
    if (!validacao.ok) {
        return renderRecuperarSenha(res, { status: 400, erro: MSG_LINK_INVALIDO });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const erros = {};
        errors.array().forEach(e => { if (!erros[e.path]) erros[e.path] = e.msg; });
        return res.status(400).render('pages/resetar-senha', { token, erros, erroGeral: null });
    }

    const { id_usuario, senhan: hashAtual } = validacao.usuario;
    const trocou = await usuariosModel.redefinirSenha(id_usuario, hashAtual, req.body.senhan);
    if (!trocou) {
        // link já usado em outra aba, ou falha ao gravar
        return renderRecuperarSenha(res, { status: 400, erro: MSG_LINK_INVALIDO });
    }

    res.redirect('/login?senha=redefinida');
});
// <<< RECUPERAR SENHA (fim: rotas) ------------------------------------

// ── Login
router.get('/login', (req, res) => {
    const erroAdmin = req.query.erro === 'admin'
        ? 'Acesso negado. Apenas administradores podem acessar esta área.'
        : null;
    // >>> RECUPERAR SENHA (início: aviso de senha redefinida) ----------
    const notificacao = req.query.senha === 'redefinida'
        ? { titulo: 'Senha redefinida', mensagem: 'Sua nova senha foi registrada. Entre com ela para continuar.' }
        : null;
    // <<< RECUPERAR SENHA (fim) ----------------------------------------
    res.render('pages/login', {
        erro:     erroAdmin,
        notificacao,                      // <<< RECUPERAR SENHA (linha nova)
        redirect: req.query.redirect || '/home'
    });
});

router.post('/login',
    body('email').isEmail().withMessage('Esse e-mail não parece certo. Exemplo: nome@email.com.'),
    body('senha').notEmpty().withMessage('Digite a sua senha.'),
    async (req, res) => {
                if (!req.cookiesAceitos) {
            res.locals.cookiesAviso = true;
            return res.render('pages/login', {
                erro:     'Para entrar, aceite o aviso de cookies que aparece na parte de baixo da tela.',
                redirect: req.body.redirect || '/home'
            });
        };
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.render('pages/login', {
                erro:     'Não encontramos essa combinação de e-mail e senha. Confira os dados e tente de novo, ou use "Esqueci minha senha".',
                redirect: req.body.redirect || '/home'
            });
        }

        if (ADMIN_PASSWORD && req.body.email === ADMIN_EMAIL && req.body.senha === ADMIN_PASSWORD) {
            req.session.usuarioEmail = ADMIN_EMAIL;
            req.session.isAdmin      = true;
            req.session.notificacao = {
                titulo: "Bem-vindo!",
                mensagem: `Login realizado com sucesso, Administrador!`,
                tipo: "success"
        };
            return res.redirect('/admin');
        }

        const usuario = await usuariosModel.findByEmail(req.body.email);
        let senhaConfere = false;
        if (usuario) {
            const senhaSalva = String(usuario.senhan || '');
            try {
                senhaConfere = /^\$2[aby]\$\d{2}\$/.test(senhaSalva)
                    ? await compareSenha(req.body.senha, senhaSalva)
                    : req.body.senha === senhaSalva;
            } catch (erro) {
                senhaConfere = false;
            }
        }

        // senha correta, mas e-mail ainda não confirmado
        if (usuario && senhaConfere && Number(usuario.ativo) === 0) {
            return res.status(403).render('pages/login', {
                erro:          'Sua conta ainda não foi ativada. Abra o e-mail que enviamos no cadastro e clique no link (veja também a caixa de spam).',
                emailPendente: true,
                redirect:      req.body.redirect || '/home'
            });
        }
        
        if (usuario && senhaConfere) {
            await carrinhoModel.migrarParaUsuario(req.session.sessionId, usuario.id_usuario);
            req.session.usuarioEmail = usuario.email;
            req.session.idUsuario    = usuario.id_usuario;
            req.session.isAdmin      = false;
            req.session.notificacao = {
                titulo: "Bem-vindo!",
                mensagem: `Login realizado com sucesso, ${usuario.nome}!`,
                tipo: "success"
        };
            const redirectUrl = req.body.redirect || '/home';
            return res.redirect(redirectUrl);
        }

        return res.render('pages/login', {
            erro:     'Não encontramos essa combinação de e-mail e senha. Confira os dados e tente de novo, ou use "Esqueci minha senha".',
            redirect: req.body.redirect || '/home'
        });
    }
);

// ── Logout 
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) console.error('Erro ao destruir sessão:', err);
        res.redirect('/login');
    });
});

// ── Home 
router.get('/home', async (req, res) => {
    const produtos   = await produtosModel.findAll();
    const banners    = await bannersModel.findAll();
    const categorias = await produtosModel.findAllCategorias();

    let usuarioCompleto = null;
    if (req.session.usuarioEmail && !req.session.isAdmin) {
        usuarioCompleto = await usuariosModel.findByEmail(req.session.usuarioEmail);
    }

    const notificacao = req.session.notificacao || null;
    if (req.session.notificacao) {
        delete req.session.notificacao;
    }

    const produtosNormalizados = (Array.isArray(produtos) ? produtos : []).map(p => ({
        ...p,
        id:            p.id_produto,
        preco:         parseFloat(p.preco) || 0,
        precoDesconto: p.preco_desconto ? parseFloat(p.preco_desconto) : null,
        avaliacoes:    []
    }));

    const produtosOrdenados   = ordenarPorRelevancia(produtosNormalizados, usuarioCompleto);
    const categoriasOrdenadas = ordenarPorRelevancia(
        Array.isArray(categorias) ? categorias : [],
        usuarioCompleto
    );

    // [NOVO] banners seguem o mesmo algoritmo da faixa "Para Você":
    // mais recentes primeiro (como os produtos, que vêm por id DESC) e depois ordenarPorRelevancia
    // (faixa etária + sexo do usuário). A home exibe apenas os primeiros (ver LIMITE_BANNERS em home.ejs).
    const bannersRecentes  = (Array.isArray(banners) ? banners : [])
        .slice()
        .sort((a, b) => b.id_banner - a.id_banner);
    const bannersOrdenados = ordenarPorRelevancia(bannersRecentes, usuarioCompleto);

    res.render('pages/home', {
        produtos:   produtosOrdenados,
        banners:    bannersOrdenados,   // [ALTERADO] era "banners" (lista crua, ordem do banco)
        categorias: categoriasOrdenadas,
        notificacao: notificacao
    });
});

// ── Usuário 
router.get('/usuario', async (req, res) => {
    if (!req.session.usuarioEmail) {
        return res.render('pages/usuario', { usuario: null, mensagemSucesso: null, mensagemErro: null, notificacao: null });
    }
    const usuario = await usuariosModel.findByEmail(req.session.usuarioEmail);
    
    // Capturar notificação da sessão (se existir)
    const notificacao = req.session.notificacao || null;
    if (req.session.notificacao) {
        delete req.session.notificacao;
    }
    
    res.render('pages/usuario', {
        usuario,
        mensagemSucesso: req.query.sucesso ? decodeURIComponent(req.query.sucesso) : null,
        mensagemErro:    req.query.erro    ? decodeURIComponent(req.query.erro)    : null,
        notificacao: notificacao
    });
});

router.post('/usuario/atualizar-campo', requireLogin,
    body('campo').isIn(['nome', 'nasc', 'cpf', 'ddd', 'tel']).withMessage('Campo inválido!'),
    body('valor').notEmpty().withMessage('Preencha o campo antes de salvar.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.redirect('/usuario?erro=' + encodeURIComponent(errors.array()[0].msg));
        }

        const { campo, valor } = req.body;

        if (campo === 'nome' && (valor.length < 3 || valor.length > 50))
            return res.redirect('/usuario?erro=' + encodeURIComponent('O nome precisa ter de 3 a 50 letras. Exemplo: Maria da Silva.'));
        if (campo === 'cpf'  && !valCPF(valor))
            return res.redirect('/usuario?erro=' + encodeURIComponent('Esse CPF não parece certo. Confira os números e tente de novo.'));
        if (campo === 'nasc' && !valNasc(valor))
            return res.redirect('/usuario?erro=' + encodeURIComponent('Essa data não parece certa. Confira o dia, o mês e o ano.'));
        if (campo === 'ddd'  && !valDDD(valor))
            return res.redirect('/usuario?erro=' + encodeURIComponent('Esse DDD não existe. Confira e tente de novo.'));
        if (campo === 'tel'  && !valTel(valor))
            return res.redirect('/usuario?erro=' + encodeURIComponent('Esse telefone não parece certo. Confira os números.'));

        await usuariosModel.updateCampo(req.session.usuarioEmail, campo, valor);
        const labels = { nome: 'Nome', nasc: 'Data de nascimento', cpf: 'CPF', ddd: 'DDD', tel: 'Telefone', sexo: 'Sexo' };
        res.redirect('/usuario?sucesso=' + encodeURIComponent(labels[campo] + ' atualizado com sucesso!'));
    }
);

// ── Atualizar Foto de Perfil 
router.post('/usuario/atualizar-foto', requireLogin, (req, res) => {
    uploadFoto.single('foto')(req, res, async (err) => {
        if (err) {
            return res.redirect('/usuario?erro=' + encodeURIComponent('Não conseguimos enviar a foto. Tente outra imagem ou tente de novo em instantes.'));
        }
        try {
            if (!req.file) {
                return res.redirect('/usuario?erro=' + encodeURIComponent('Escolha uma foto antes de enviar.'));
            }

            let fotoUrl = null;
            if (req.file) {
                fotoUrl = await uploadBufferToCloudinary(req.file.buffer, 'mais-saude/perfil');
            }

            // Adiciona 'foto_perfil' à lista de campos permitidos
            await usuariosModel.updateCampo(req.session.usuarioEmail, 'foto_perfil', fotoUrl);
            
            req.session.notificacao = {
                titulo: "Foto Atualizada!",
                mensagem: "Sua foto de perfil foi atualizada com sucesso!",
                tipo: "success"
            };
            res.redirect('/usuario');
        } catch (err) {
            console.error('Erro ao atualizar foto:', err);
            res.redirect('/usuario?erro=' + encodeURIComponent('Não conseguimos salvar a foto. Tente de novo em instantes.'));
        }
    });
});
// ── Meus Pedidos 
router.get('/meus-pedidos', requireLogin, blockAdmin, async (req, res) => {
    try {
        const porPagina = 10;
        const total = await pedidosModel.contarPorUsuario(req.session.idUsuario);
        const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
        const pagina = Math.min(Math.max(parseInt(req.query.pagina, 10) || 1, 1), totalPaginas);
        const pedidos = await pedidosModel.findByUsuarioComDetalhes(req.session.idUsuario, {
            limite:       porPagina,
            deslocamento: (pagina - 1) * porPagina
        });
        res.render('pages/meus-pedidos', {
            pedidos,
            total,
            pagina,
            totalPaginas,
            usuario:       res.locals.usuario,
            mensagemErro:  null,
            query:         req.query
        });
    } catch (err) {
        console.error('Erro ao carregar meus pedidos:', err);
        res.render('pages/meus-pedidos', {
            pedidos:      [],
            usuario:      res.locals.usuario,
            mensagemErro: 'Erro ao carregar seus pedidos. Tente novamente.'
        });
    }
});

router.post('/meus-pedidos/:id/comprar-novamente', requireLogin, blockAdmin, async (req, res) => {
    try {
        const idPedido  = parseInt(req.params.id);
        const idUsuario = req.session.idUsuario;

        const pedido = await pedidosModel.findById(idPedido);

        if (!pedido || pedido.id_usuario !== idUsuario) {
            return res.redirect('/meus-pedidos?erro=pedido_nao_encontrado');
        }

        if (['aprovado', 'enviado', 'entregue'].indexOf(pedido.status) === -1) {
            return res.redirect('/meus-pedidos?erro=pedido_nao_pago');
        }

        if (!pedido.itens || pedido.itens.length === 0) {
            return res.redirect('/meus-pedidos?erro=pedido_sem_itens');
        }

        const { session_id } = getIdentificador(req);

        for (const item of pedido.itens) {
            const produto = await produtosModel.findById(item.id_produto);

            if (produto && produto.status === 'em-estoque') {
                await carrinhoModel.addProduto(
                    item.id_produto,
                    idUsuario,
                    session_id,
                    parseInt(item.qtd) || 1
                );
            }
        }

        res.redirect('/carrinho');
    } catch (err) {
        console.error('Erro em comprar-novamente:', err);
        res.redirect('/meus-pedidos?erro=erro_comprar_novamente');
    }
});

router.post('/meus-pedidos/:id/pagar', requireLogin, blockAdmin, async (req, res) => {
    try {
        const idPedido  = parseInt(req.params.id, 10);
        const idUsuario = req.session.idUsuario;

        const pedido = await pedidosModel.findById(idPedido);
        if (!pedido || pedido.id_usuario !== idUsuario) {
            return res.redirect('/meus-pedidos?erro=pedido_nao_encontrado');
        }
        if (pedido.status !== 'pendente') {
            return res.redirect('/meus-pedidos?erro=pedido_nao_pendente');
        }

        const pagamentoLocal = await pedidosModel.findPagamentoByPedido(idPedido);
        if (!pagamentoLocal) {
            return res.redirect('/meus-pedidos?erro=erro_concluir_pagamento');
        }

        const pagamentosMP = await buscarPagamentosPorPedido(idPedido);
        const aprovado = pagamentosMP.find(p => p.status === 'approved');
        if (aprovado) {
            await aplicarPagamentoMP(aprovado);
            return res.redirect('/pagamento/resultado?pedido=' + idPedido);
        }

        const checkoutUrl = await criarPreferencia({
            idPedido: idPedido,
            valorTotal: pedido.valor_total,
            formaPagamento: pagamentoLocal.forma,
            email: req.session.usuarioEmail
        });
        return res.redirect(checkoutUrl);
    } catch (err) {
        console.error('Erro em concluir pagamento:', err.message);
        return res.redirect('/meus-pedidos?erro=erro_concluir_pagamento');
    }
});

// ── Produto ───────────────────────────────────────────────
router.get('/produto/:id', async (req, res) => {
    const produto = await produtosModel.findById(req.params.id);
    if (!produto) return res.redirect('/home');

    const produtos                   = await produtosModel.findAll();
    const { id_usuario, session_id } = getIdentificador(req);
    const temNoCarrinho              = await carrinhoModel.temProduto(req.params.id, id_usuario, session_id);
    const isAdmin                    = req.session.isAdmin || false;

    const produtoNorm  = {
        ...produto,
        id:            produto.id_produto,
        preco:         parseFloat(produto.preco) || 0,
        precoDesconto: produto.preco_desconto ? parseFloat(produto.preco_desconto) : null
    };
    const produtosNorm = (Array.isArray(produtos) ? produtos : []).map(p => ({
        ...p,
        id:            p.id_produto,
        preco:         parseFloat(p.preco) || 0,
        precoDesconto: p.preco_desconto ? parseFloat(p.preco_desconto) : null,
        avaliacoes:    []
    }));

    res.render('pages/produto', {
        produto:              produtoNorm,
        produtos:             produtosNorm,
        usuarioLogado:        !!req.session.usuarioEmail,
        temProdutoNoCarrinho: temNoCarrinho,
        isAdmin
    });
});

// ── Produto: cálculo de frete e prazo (ViaCEP) ────────────
router.get('/produto/:id/frete', async (req, res) => {
    const cep = normalizarCep(req.query.cep);
    if (!cep) {
        return res.status(400).json({ ok: false, erro: 'cep_invalido', mensagem: 'CEP inválido! Digite os 8 números do CEP.' });
    }

    try {
        const produto = await produtosModel.findById(req.params.id);
        if (!produto) {
            return res.status(404).json({ ok: false, erro: 'produto_nao_encontrado', mensagem: 'Produto não encontrado!' });
        }

        const endereco = await consultarCep(cep);
        if (!endereco) {
            return res.status(404).json({ ok: false, erro: 'cep_nao_encontrado', mensagem: 'CEP não encontrado. Confira os números e tente novamente.' });
        }

        const preco    = parseFloat(produto.preco) || 0;
        const desconto = produto.preco_desconto ? parseFloat(produto.preco_desconto) : null;
        const frete    = calcularFrete(endereco, desconto || preco);

        res.json({
            ok:       true,
            cep:      formatarCep(cep),
            endereco: {
                logradouro: endereco.logradouro,
                bairro:     endereco.bairro,
                localidade: endereco.localidade,
                uf:         endereco.uf
            },
            frete,
            gratisAPartirDe: FRETE_GRATIS_A_PARTIR_DE,
            origem:          { cidade: ORIGEM.cidade, uf: ORIGEM.uf }
        });
    } catch (erro) {
        console.error('frete erro:', erro.message);
        res.status(503).json({ ok: false, erro: 'servico_indisponivel', mensagem: 'Não foi possível calcular o frete agora. Tente novamente em instantes.' });
    }
});

router.post('/produto/:id/adicionar-carrinho', exigirCookies, blockAdmin, async (req, res) => {
    const produto = await produtosModel.findById(req.params.id);
    if (!produto || produto.status === 'fora-de-estoque') {
        return res.redirect('/produto/' + req.params.id + '?erro=fora_de_estoque');
    }
    const { id_usuario, session_id } = getIdentificador(req);
    await carrinhoModel.addProduto(req.params.id, id_usuario, session_id);
    res.redirect('/carrinho');
});

// avaliacao
router.post('/produto/:id/avaliar', requireLogin, blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const temNoCarrinho = await carrinhoModel.temProduto(req.params.id, id_usuario, session_id);
    if (!temNoCarrinho) {
        return res.redirect('/produto/' + req.params.id + '?erro=carrinho');
    }
    await produtosModel.addAvaliacao(req.params.id, id_usuario, parseInt(req.body.nota), req.body.texto);
    res.redirect('/produto/' + req.params.id);
});

// ── Carrinho ──────────────────────────────────────────────
router.get('/carrinho', blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const itens = await carrinhoModel.findByIdentificador(id_usuario, session_id);

    const carrinho = (Array.isArray(itens) ? itens : []).map(function(i) {
        return {
            ...i,
            id:            i.id_produto,
            preco:         parseFloat(i.preco)          || 0,
            precoDesconto: i.preco_desconto != null ? parseFloat(i.preco_desconto) : null
        };
    });

    const AVISOS_CARRINHO = {
        removido:   'Pronto! O produto foi retirado do carrinho.',
        atualizado: 'Pronto! A quantidade foi atualizada.'
    };

    res.render('pages/carrinho', {
        carrinho,
        usuarioLogado: !!req.session.usuarioEmail,
        aviso: AVISOS_CARRINHO[req.query.aviso] || null
    });
});

router.post('/carrinho/atualizar/:id', exigirCookies, blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const novaQtd = parseInt(req.body.quantidade);
    await carrinhoModel.updateQuantidade(req.params.id, id_usuario, session_id, novaQtd);
    // volta para o mesmo item (a pessoa não perde o lugar na lista)
    res.redirect(novaQtd > 0
        ? '/carrinho?aviso=atualizado#item-' + encodeURIComponent(req.params.id)
        : '/carrinho?aviso=removido');
});

router.post('/carrinho/remover/:id', exigirCookies, blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    await carrinhoModel.removerProduto(req.params.id, id_usuario, session_id);
    res.redirect('/carrinho?aviso=removido');
});

// ── Finalizar Compra ──────────────────────────────────────
async function aplicarPagamentoMP(pagamentoMP) {
    const idPedido = Number(pagamentoMP.external_reference);
    if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
        return { codigo: 400 };
    }

    const pedido = await pedidosModel.findById(idPedido);
    const pagamentoLocal = await pedidosModel.findPagamentoByPedido(idPedido);
    const valorPago = Math.round(Number(pagamentoMP.tration_amount) * 100);
    const valorPedido = pedido ? Math.round(Number(pedido.valor_total) * 100) : NaN;
    const valorLocal = pagamentoLocal ? Math.round(Number(pagamentoLocal.valor) * 100) : NaN;

    if (!pedido || !pagamentoLocal ||
        pagamentoMP.currency_id !== 'BRL' ||
        valorPago !== valorPedido ||
        valorPago !== valorLocal) {
        console.error('Mercado Pago: pagamento não confere com o pedido.', {
            idPedido,
            pedidoEncontrado: !!pedido,
            pagamentoLocalEncontrado: !!pagamentoLocal,
            moeda: pagamentoMP.currency_id,
            valorPagoCentavos: valorPago,
            valorPedidoCentavos: valorPedido,
            valorLocalCentavos: valorLocal
        });
        return { codigo: 422 };
    }

    const statusPedido = pagamentoMP.status === 'approved'
        ? 'aprovado'
        : ['cancelled', 'refunded', 'charged_back', 'rejected'].includes(pagamentoMP.status)
            ? 'cancelado'
            : 'pendente';

    if (pedido.status === 'aprovado' &&
        (statusPedido === 'pendente' || pagamentoMP.status === 'rejected')) {
        return { codigo: 200 };
    }

    const atualizado = await pedidosModel.atualizarStatusPagamento(
        idPedido,
        pagamentoMP.status,
        statusPedido
    );
    return { codigo: atualizado ? 200 : 404 };
}

router.post('/webhooks/mercadopago', async (req, res) => {
    console.log('MP webhook recebido:', {
        query: req.query,
        type: req.body && req.body.type,
        temAssinatura: !!req.get('x-signature')
    });

    let idPagamento;

    const ehIpn = !!req.query.topic && !req.query['data.id'];

    if (ehIpn) {
        if (req.query.topic !== 'payment') {
            return res.sendStatus(200);
        }
        idPagamento = req.query.id;
    } else {
        if (req.body && req.body.type && req.body.type !== 'payment') {
            return res.sendStatus(200);
        }

        const segredo = process.env.MP_WEBHOOK_SECRET;
        if (!segredo) {
            console.error('Webhook do Mercado Pago recebido sem MP_WEBHOOK_SECRET configurado.');
            return res.sendStatus(503);
        }

        idPagamento = req.query['data.id'] ||
            (req.body && req.body.data && req.body.data.id);
        const requestId = req.get('x-request-id');
        const assinatura = req.get('x-signature');
        if (!validarAssinaturaWebhook(idPagamento, requestId, assinatura, segredo)) {
            console.error('Webhook do Mercado Pago com assinatura inválida. ' +
                'Confira se MP_WEBHOOK_SECRET é o segredo da aplicação (modo teste x produção).');
            return res.sendStatus(401);
        }
    }

    if (!idPagamento || !/^\d+$/.test(String(idPagamento))) {
        return res.sendStatus(400);
    }

    try {
        const pagamentoMP = await buscarPagamento(idPagamento);
        const resultado = await aplicarPagamentoMP(pagamentoMP);
        return res.sendStatus(resultado.codigo);
    } catch (erro) {
        console.error('Erro ao processar webhook do Mercado Pago:', erro.message);
        return res.sendStatus(500);
    }
});

router.get('/finalizar-compra', requireLogin, blockAdmin, async (req, res) => {
    const { id_usuario, session_id } = getIdentificador(req);
    const itens = await carrinhoModel.findByIdentificador(id_usuario, session_id);

    if (!itens || itens.length === 0) {
        return res.redirect('/carrinho');
    }

    const carrinho = itens.map(function(i) {
        return {
            ...i,
            id:            i.id_produto,
            preco:         parseFloat(i.preco)         || 0,
            precoDesconto: i.preco_desconto != null ? parseFloat(i.preco_desconto) : null
        };
    });

    res.render('pages/finalizar-compra', {
        carrinho,
        mensagemErro: req.query.erro ? decodeURIComponent(req.query.erro) : null
    });
});

router.post('/finalizar-compra', requireLogin, blockAdmin,
    body('cep').notEmpty().withMessage('Digite o seu CEP (8 números).')
        .matches(/^\d{5}-?\d{3}$/).withMessage('Esse CEP não parece certo. Digite os 8 números.'),
    body('rua').notEmpty().isLength({ min: 3, max: 150 }).withMessage('Digite o nome da rua.'),
    body('numero').notEmpty().withMessage('Digite o número da casa ou do prédio. Se não tiver, escreva "s/n".'),
    body('bairro').notEmpty().isLength({ min: 2, max: 80 }).withMessage('Digite o nome do bairro.'),
    body('cidade').notEmpty().isLength({ min: 2, max: 80 }).withMessage('Digite o nome da cidade.'),
    body('estado').notEmpty().isLength({ min: 2, max: 2 }).withMessage('Escolha o estado.'),
    body('forma_pagamento').notEmpty()
        .isIn(['cartao_credito', 'cartao_debito', 'pix', 'boleto'])
        .withMessage('Escolha uma forma de pagamento.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const msg = encodeURIComponent(errors.array()[0].msg);
            return res.redirect('/finalizar-compra?erro=' + msg);
        }

        const { id_usuario, session_id } = getIdentificador(req);
        const itens = await carrinhoModel.findByIdentificador(id_usuario, session_id);

        if (!itens || itens.length === 0) {
            return res.redirect('/carrinho');
        }

        const temForaEstoque = itens.some(function(i) {
            return i.status === 'fora-de-estoque';
        });
        if (temForaEstoque) {
            return res.redirect('/finalizar-compra?erro=' +
                encodeURIComponent('Remova os itens fora de estoque antes de finalizar.'));
        }

        const itensMapeados = itens.map(function(i) {
            return {
                id_produto:    i.id_produto,
                preco:         parseFloat(i.preco)         || 0,
                precoDesconto: i.preco_desconto != null ? parseFloat(i.preco_desconto) : null,
                quantidade:    parseInt(i.quantidade)      || 1
            };
        });

        var subtotal = itensMapeados.reduce(function(acc, i) {
            var p = (i.precoDesconto && i.precoDesconto > 0) ? i.precoDesconto : i.preco;
            return acc + p * i.quantidade;
        }, 0);

        var desconto = 0;
        if (req.body.forma_pagamento === 'pix')    desconto = subtotal * 0.05;
        if (req.body.forma_pagamento === 'boleto') desconto = subtotal * 0.03;

        var cepNumeros = (req.body.cep || '').replace(/\D/g, '');
        var frete = 19.90;
        if (cepNumeros.length === 8) {
            var prefixo = parseInt(cepNumeros.substring(0, 5));
            if      (prefixo >= 1000  && prefixo <= 19999) frete = 9.90;
            else if (prefixo >= 20000 && prefixo <= 28999) frete = 12.90;
            else if (prefixo >= 30000 && prefixo <= 39999) frete = 14.90;
        }
        if (subtotal >= 150) frete = 0;

        const valor_total = parseFloat((subtotal + frete - desconto).toFixed(2));

        const pedidoResult = await pedidosModel.create(id_usuario, itensMapeados, valor_total);
        if (pedidoResult.erro) {
            return res.redirect('/finalizar-compra?erro=' +
                encodeURIComponent('Erro ao criar pedido. Tente novamente.'));
        }

        const pagResult = await pedidosModel.createPagamento(
            pedidoResult.id_pedido,
            req.body.forma_pagamento,
            valor_total
        );
        if (pagResult.erro) {
            return res.redirect('/finalizar-compra?erro=' +
                encodeURIComponent('Não foi possível registrar o pagamento. Tente novamente.'));
        }
        const { rua, numero, complemento, bairro, cidade, estado, cep } = req.body;
        const enderecoFormatado = [
            rua + ', ' + numero + (complemento ? ' ' + complemento : ''),
            bairro + ' — ' + cidade + '/' + estado,
            'CEP: ' + cep
        ].join(' | ');

        await pedidosModel.createEntrega(
            pagResult.id_pagamento,
            '+Saúde Entregas',
            enderecoFormatado
        );

        let checkoutUrl;
        try {
            checkoutUrl = await criarPreferencia({
                idPedido: pedidoResult.id_pedido,
                valorTotal: valor_total,
                formaPagamento: req.body.forma_pagamento,
                email: req.session.usuarioEmail
            });
        } catch (erro) {
            console.error('Erro ao criar checkout do Mercado Pago:', erro.message);
            return res.redirect('/finalizar-compra?erro=' +
                encodeURIComponent('Não foi possível iniciar o pagamento. Verifique a configuração do Mercado Pago e tente novamente.'));
        }

        if (id_usuario) {
            await carrinhoModel.limparPorUsuario(id_usuario);
        } else {
            await carrinhoModel.limparPorSession(session_id);
        }

        return res.redirect(checkoutUrl);
    }
);

router.get('/pagamento/resultado', requireLogin, blockAdmin, async (req, res) => {
    const idPedido = Number(req.query.pedido);
    if (!Number.isSafeInteger(idPedido) || idPedido <= 0) {
        return res.redirect('/meus-pedidos');
    }

    let pedido = await pedidosModel.findById(idPedido);
    if (!pedido || Number(pedido.id_usuario) !== Number(req.session.idUsuario)) {
        return res.sendStatus(404);
    }

    if (pedido.status === 'pendente') {
        try {
            const pagamentos = await buscarPagamentosPorPedido(idPedido);
            const escolhido = pagamentos.find(function(p) { return p.status === 'approved'; }) ||
                pagamentos[0];
            if (escolhido) {
                await aplicarPagamentoMP(escolhido);
                pedido = await pedidosModel.findById(idPedido) || pedido;
            }
        } catch (erro) {
            console.error('Erro ao sincronizar o pagamento do pedido ' + idPedido + ':', erro.message);
        }
    }

    const pagamento = await pedidosModel.findPagamentoByPedido(idPedido);
    const endereco = pagamento
        ? await pedidosModel.findEnderecoByPagamento(pagamento.id_pagamento)
        : null;
    const formasLabel = {
        cartao_credito: 'Cartão de Crédito',
        cartao_debito: 'Cartão de Débito',
        pix: 'PIX',
        boleto: 'Boleto Bancário'
    };
    res.render('pages/pedido-confirmado', {
        id_pedido: idPedido,
        valor_total: pedido.valor_total,
        itens: pedido.itens,
        endereco: endereco || 'Endereço de entrega informado no pedido',
        forma_pagamento_label: formasLabel[pagamento && pagamento.forma] || 'Mercado Pago',
        status_pedido: pedido.status,
        pix_qr_code: pagamento && pagamento.pix_qr_code,
        pix_qr_code_base64: pagamento && pagamento.pix_qr_code_base64,
        pix_ticket_url: pagamento && pagamento.pix_ticket_url
    });
});

// ── Categoria ─────────────────────────────────────────────
router.get('/categoria/:slug', async (req, res) => {
    const slug = req.params.slug;
    let categoriaInfo = await produtosModel.findCategoriaPorSlug(slug);
    let produtos, nomeExibicao;

    if (categoriaInfo) {
        produtos     = await produtosModel.findBySlugCategoria(slug);
        nomeExibicao = categoriaInfo.nome;
    } else {
        const nomeDecodificado = decodeURIComponent(slug);
        if (nomeDecodificado.toLowerCase() === 'geral') {
            produtos     = await produtosModel.findByCategoria('geral');
            nomeExibicao = 'Geral';
        } else {
            produtos     = await produtosModel.findByCategoria(nomeDecodificado);
            nomeExibicao = nomeDecodificado;
        }
    }

    const produtosNorm = (Array.isArray(produtos) ? produtos : []).map(p => ({
        ...p,
        id:            p.id_produto,
        preco:         parseFloat(p.preco) || 0,
        precoDesconto: p.preco_desconto ? parseFloat(p.preco_desconto) : null
    }));

    let usuarioCompleto = null;
    if (req.session.usuarioEmail && !req.session.isAdmin) {
        usuarioCompleto = await usuariosModel.findByEmail(req.session.usuarioEmail);
    }
    ordenarPorRelevancia(produtosNorm, usuarioCompleto);

    res.render('pages/categoria', { categoria: nomeExibicao, slug, produtos: produtosNorm });
});

// ── Busca ─────────────────────────────────────────────────
router.get('/busca', async (req, res) => {
    const termo = (req.query.q || '').trim();
    if (!termo) return res.redirect('/home');

    const produtos = await produtosModel.search(termo);

    const produtosNorm = (Array.isArray(produtos) ? produtos : []).map(p => ({
        ...p,
        id:            p.id_produto,
        preco:         parseFloat(p.preco) || 0,
        precoDesconto: p.preco_desconto ? parseFloat(p.preco_desconto) : null
    }));

    let usuarioCompleto = null;
    if (req.session.usuarioEmail && !req.session.isAdmin) {
        usuarioCompleto = await usuariosModel.findByEmail(req.session.usuarioEmail);
    }
    ordenarPorRelevancia(produtosNorm, usuarioCompleto);

    res.render('pages/busca', { termo, produtos: produtosNorm });
});

// ── Admin ─────────────────────────────────────────────────
router.get('/admin', requireAdmin, async (req, res) => {
    const produtos   = await produtosModel.findAll();
    const usuarios   = await usuariosModel.findAll();
    const banners    = await bannersModel.findAll();
    const categorias = await produtosModel.findAllCategorias();

    const usuariosComPedidos = await Promise.all(
    (Array.isArray(usuarios) ? usuarios : []).map(async (u) => {
        const pedidos = await pedidosModel.findByUsuario(u.id_usuario);
        return { ...u, total_pedidos: pedidos.length };
    }));

    const produtosNorm = (Array.isArray(produtos) ? produtos : []).map(p => ({
        ...p,
        id:            p.id_produto,
        preco:         parseFloat(p.preco) || 0,
        precoDesconto: p.preco_desconto ? parseFloat(p.preco_desconto) : null
    }));

    res.render('pages/admin', {
        produtos:         produtosNorm,
        totalProdutos:    produtosNorm.length,
        usuarios:         Array.isArray(usuariosComPedidos)   ? usuariosComPedidos   : [],
        banners:          Array.isArray(banners)    ? banners    : [],
        categorias:       Array.isArray(categorias) ? categorias : [],
        erro:             req.query.erro    || null,
        sucesso:          req.query.sucesso || null,
        mensagensSucesso: MSGS_SUCESSO,
        mensagensErro:    MSGS_ERRO
    });
});

router.get('/admin/usuario/:email', requireAdmin, async (req, res) => {
    const email = decodeURIComponent(req.params.email);
    const usuario = await usuariosModel.findByEmail(email);
    if (!usuario) return res.redirect('/admin?erro=excluir_usuario');

    const pedidos = await pedidosModel.findByUsuarioComDetalhes(usuario.id_usuario);

    res.render('pages/admin-usuario', {
        usuario,
        pedidos: pedidos || []
    });
});

// ── Admin: adicionar produto (com Cloudinary) ─────────────
router.post('/admin/adicionar-produto', requireAdmin, (req, res) => {
    uploadProduto.single('imagem')(req, res, async (err) => {
        if (err) {
            console.error('Multer erro produto:', err);
            return res.redirect('/admin?erro=adicionar_produto');
        }
        try {
            // Faz upload para o Cloudinary se um arquivo foi enviado
            let imagemUrl = '/imagens/foto.jpg';
            if (req.file) {
                imagemUrl = await uploadBufferToCloudinary(req.file.buffer, 'mais-saude/produtos');
            }

            const preco         = parseFloat(req.body.preco) || 0;
            const precoDesc     = req.body.precoDesconto && String(req.body.precoDesconto).trim() !== ''
                                  ? parseFloat(req.body.precoDesconto) || null
                                  : null;
            const ids_categorias = parseCategorias(req.body);

            if (ids_categorias.length === 0) return res.redirect('/admin?erro=categoria_invalida');

            const result = await produtosModel.create({
                nome:           (req.body.nome || '').trim() || 'Produto sem nome',
                descricao:      (req.body.descricao || '').trim(),
                preco,
                preco_desconto: precoDesc,
                imagem:         imagemUrl,
                status:         req.body.status || 'em-estoque',
                faixa_etaria:   req.body.faixa_etaria || null,
                sexo:           req.body.sexo || null
            }, ids_categorias);

            if (result && result.errno) return res.redirect('/admin?erro=adicionar_produto');
            res.redirect('/admin?sucesso=produto_adicionado');
        } catch (err) {
            console.error('Erro ao adicionar produto:', err);
            res.redirect('/admin?erro=adicionar_produto');
        }
    });
});

// ── Admin: página de edição de produto ───────────────────
router.get('/admin/editar-produto/:id', requireAdmin, async (req, res) => {
    const produto    = await produtosModel.findById(req.params.id);
    if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');
    const categorias = await produtosModel.findAllCategorias();
    const ids_atual  = produto.ids_categorias
                       ? produto.ids_categorias.split(',').map(Number)
                       : [];
    res.render('pages/editar-produto', {
        produto: { ...produto, id: produto.id_produto, precoDesconto: produto.preco_desconto, ids_categorias_atual: ids_atual },
        categorias,
        erro: null
    });
});

// ── Admin: salvar edição de produto (com Cloudinary) ─────
router.post('/admin/editar-produto/:id', requireAdmin, (req, res) => {
    uploadProduto.single('imagem')(req, res, async (err) => {
        if (err) return res.redirect('/admin?erro=editar_produto');
        try {
            const produto = await produtosModel.findById(req.params.id);
            if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');

            let imagemUrl = produto.imagem;

            // Se veio um novo arquivo, faz upload e apaga o anterior no Cloudinary
            if (req.file) {
                imagemUrl = await uploadBufferToCloudinary(req.file.buffer, 'mais-saude/produtos');
                // Apaga a imagem antiga apenas se era uma URL do Cloudinary
                await deleteCloudinaryImage(produto.imagem);
            }

            const ids_categorias = parseCategorias(req.body);
            if (ids_categorias.length === 0) return res.redirect('/admin?erro=categoria_invalida');

            const result = await produtosModel.update(req.params.id, {
                nome:           (req.body.nome || produto.nome).trim(),
                descricao:      req.body.descricao || produto.descricao,
                preco:          parseFloat(req.body.preco) || 0,
                preco_desconto: req.body.precoDesconto && String(req.body.precoDesconto).trim() !== ''
                                ? parseFloat(req.body.precoDesconto) || null
                                : null,
                imagem:         imagemUrl,
                faixa_etaria:   req.body.faixa_etaria || produto.faixa_etaria || null,
                sexo:           req.body.sexo || produto.sexo || null,
                status:         req.body.status || produto.status
            }, ids_categorias);

            if (result && result.errno) return res.redirect('/admin?erro=editar_produto');
            res.redirect('/admin?sucesso=produto_editado');
        } catch (err) {
            console.error('Erro ao editar produto:', err);
            res.redirect('/admin?erro=editar_produto');
        }
    });
});

// ── Admin: excluir produto (com Cloudinary) ───────────────
router.post('/admin/excluir-produto/:id', requireAdmin, async (req, res) => {
    try {
        const produto = await produtosModel.findById(req.params.id);
        if (!produto) return res.redirect('/admin?erro=produto_nao_encontrado');

        // Apaga imagem do Cloudinary (ignora imagens locais de fallback)
        await deleteCloudinaryImage(produto.imagem);

        await produtosModel.delete(req.params.id);
        res.redirect('/admin?sucesso=produto_excluido');
    } catch (err) {
        console.error('Erro ao excluir produto:', err);
        res.redirect('/admin?erro=excluir_produto');
    }
});

router.post('/admin/excluir-usuario/:email', requireAdmin, async (req, res) => {
    try {
        await usuariosModel.delete(req.params.email);
        res.redirect('/admin?sucesso=usuario_excluido');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=excluir_usuario');
    }
});

router.post('/admin/criar-categoria', requireAdmin, async (req, res) => {
    try {
        const nome = (req.body.nome_categoria || '').trim();
        if (!nome || nome.length < 2) return res.redirect('/admin?erro=categoria_nome_invalido&tab=categorias');

        const existe = await produtosModel.findCategoriaPorNome(nome);
        if (existe)  return res.redirect('/admin?erro=categoria_ja_existe&tab=categorias');

        const faixaEtaria = (req.body.faixa_etaria_categoria || '').trim() || null;
        const sexo        = (req.body.sexo_categoria         || '').trim() || null;

        const result = await produtosModel.createCategoria(nome, faixaEtaria, sexo);
        if (!result || result.erro || result.errno || !result.insertId || result.insertId <= 0) {
            console.error('Erro ao criar categoria:', result);
            return res.redirect('/admin?erro=criar_categoria&tab=categorias');
        }
        res.redirect('/admin?sucesso=categoria_criada&tab=categorias');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=criar_categoria&tab=categorias');
    }
});

router.post('/admin/excluir-categoria/:id', requireAdmin, async (req, res) => {
    try {
        await produtosModel.deleteCategoria(req.params.id);
        res.redirect('/admin?sucesso=categoria_excluida&tab=categorias');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=excluir_categoria&tab=categorias');
    }
});

router.post('/admin/atualizar-faixa-categoria/:id', requireAdmin, async (req, res) => {
    try {
        const faixa = (req.body.faixa_etaria || '').trim() || null;
        const sexo  = (req.body.sexo         || '').trim() || null;
        await produtosModel.updateCategoria(req.params.id, faixa, sexo);
        res.redirect('/admin?sucesso=categoria_editada&tab=categorias');
    } catch (err) {
        console.error(err);
        res.redirect('/admin?erro=editar_categoria&tab=categorias');
    }
});

// [NOVO] ── Público-alvo do banner (mesmos valores de produtos e categorias) ──
const FAIXAS_BANNER = ['40+', '45+', '50+', '55+', '60+', '65+', '70+', '75+', '80+'];
const SEXOS_BANNER  = ['masculino', 'feminino', 'todos'];

function lerPublicoBanner(body) {
    const faixa = (body.faixa_etaria || '').trim();
    const sexo  = (body.sexo         || '').trim();
    return {
        faixa_etaria: FAIXAS_BANNER.includes(faixa) ? faixa : null,   // null = todas as idades
        sexo:         SEXOS_BANNER.includes(sexo)   ? sexo  : null    // null = sem restrição
    };
}

// Limites das colunas da tabela banners (legenda VARCHAR(150), link VARCHAR(200))
const MAX_LEGENDA_BANNER = 150;
const MAX_LINK_BANNER    = 200;

function lerLinkBanner(body) {
    let link = (body.link || '/home').trim();
    if (!link.startsWith('/')) link = '/' + link;
    return link.slice(0, MAX_LINK_BANNER);
}

// ── Admin: criar banner (com Cloudinary) ─────────────────
router.post('/admin/criar-banner', requireAdmin, (req, res) => {
    uploadBanner.single('imagem')(req, res, async (err) => {
        if (err) return res.redirect('/admin?erro=criar_banner&tab=banners');
        let imagemUrl = null;
        try {
            if (!req.file) return res.redirect('/admin?erro=imagem_obrigatoria&tab=banners');

            imagemUrl = await uploadBufferToCloudinary(req.file.buffer, 'mais-saude/banners');

            const legenda = ((req.body.legenda || '').trim() || 'Novo Banner').slice(0, MAX_LEGENDA_BANNER);
            const link    = lerLinkBanner(req.body);

            // [ALTERADO] inclui faixa_etaria e sexo vindos do formulário
            const result = await bannersModel.create({ imagem: imagemUrl, legenda, link, ...lerPublicoBanner(req.body) });
            if (result && result.errno) throw result;
            res.redirect('/admin?sucesso=banner_criado&tab=banners');
        } catch (e) {
            console.error('Erro ao criar banner:', e);
            // Banner não foi gravado: remove a imagem enviada para não deixá-la órfã no Cloudinary
            if (imagemUrl) await deleteCloudinaryImage(imagemUrl).catch(() => {});
            res.redirect('/admin?erro=criar_banner&tab=banners');
        }
    });
});

// ── Admin: editar banner (com Cloudinary) ────────────────
router.post('/admin/editar-banner/:id', requireAdmin, (req, res) => {
    uploadBanner.single('imagem')(req, res, async (err) => {
        if (err) return res.redirect('/admin?erro=editar_banner&tab=banners');
        let novaImagemUrl = null;
        let gravado       = false;
        try {
            const bannerId = parseInt(req.params.id);
            const banner   = await bannersModel.findById(bannerId);
            if (!banner) return res.redirect('/admin?erro=banner_nao_encontrado&tab=banners');

            let imagemUrl = banner.imagem;

            // Se veio um novo arquivo, faz upload (a imagem anterior só é apagada depois de gravar no banco)
            if (req.file) {
                novaImagemUrl = await uploadBufferToCloudinary(req.file.buffer, 'mais-saude/banners');
                imagemUrl     = novaImagemUrl;
            }

            const legenda = ((req.body.legenda || '').trim() || banner.legenda).slice(0, MAX_LEGENDA_BANNER);
            const link    = lerLinkBanner(req.body);

            // [ALTERADO] inclui faixa_etaria e sexo vindos do formulário
            const result = await bannersModel.update(bannerId, { imagem: imagemUrl, legenda, link, ...lerPublicoBanner(req.body) });
            if (result && result.errno) throw result;
            gravado = true;

            if (novaImagemUrl) await deleteCloudinaryImage(banner.imagem);
            res.redirect('/admin?sucesso=banner_editado&tab=banners');
        } catch (e) {
            console.error('Erro ao editar banner:', e);
            // Se nada foi gravado, descarta a imagem nova e mantém a atual intacta.
            if (novaImagemUrl && !gravado) await deleteCloudinaryImage(novaImagemUrl).catch(() => {});
            // Falha ao apagar a imagem antiga não desfaz a edição, que já foi salva.
            res.redirect(gravado
                ? '/admin?sucesso=banner_editado&tab=banners'
                : '/admin?erro=editar_banner&tab=banners');
        }
    });
});

// ── Admin: excluir banner (com Cloudinary) ────────────────
router.post('/admin/excluir-banner/:id', requireAdmin, async (req, res) => {
    try {
        const banner = await bannersModel.findById(parseInt(req.params.id));
        if (!banner) return res.redirect('/admin?erro=banner_nao_encontrado&tab=banners');

        // Apaga imagem do Cloudinary (ignora URLs locais de fallback)
        await deleteCloudinaryImage(banner.imagem);

        await bannersModel.delete(parseInt(req.params.id));
        res.redirect('/admin?sucesso=banner_excluido&tab=banners');
    } catch (err) {
        console.error('Erro ao excluir banner:', err);
        res.redirect('/admin?erro=excluir_banner&tab=banners');
    }
});

let limpezaEmAndamento = false;

async function cancelarPedidosVencidos() {
    if (limpezaEmAndamento) return;
    limpezaEmAndamento = true;
    try {
        const vencidos = await pedidosModel.findPendentesVencidos(
            prazoPagamentoHoras('boleto'),
            prazoPagamentoHoras('pix')
        );
        for (const idPedido of vencidos) {
            try {
                const pagamentos = await buscarPagamentosPorPedido(idPedido);
                const aprovado = pagamentos.find(p => p.status === 'approved');
                if (aprovado) {
                    await aplicarPagamentoMP(aprovado);
                    continue;
                }
                const emAndamento = pagamentos.some(p => ['in_process', 'authorized'].includes(p.status));
                if (emAndamento) continue;
                await pedidosModel.cancelarPedidoPendente(idPedido);
            } catch (erro) {
                console.error('Falha ao verificar o pedido vencido ' + idPedido + ':', erro.message);
            }
        }
    } catch (erro) {
        console.error('Falha ao cancelar pedidos vencidos:', erro.message);
    } finally {
        limpezaEmAndamento = false;
    }
}

setTimeout(cancelarPedidosVencidos, 20000).unref();
setInterval(cancelarPedidosVencidos, 30 * 60 * 1000).unref();

// ── Chatbot Maisa (Assistente de IA para público idoso) ──────────────────────
function resolverLimiteSugestoes(req) {
    const dispositivo = String(req.body?.dispositivo || req.query?.dispositivo || '').toLowerCase();
    if (dispositivo === 'mobile') return 2;
    if (dispositivo === 'desktop') return 4;

    const limiteParam = Number(req.body?.limiteSugestoes ?? req.query?.limite);
    if (limiteParam === 2) return 2;
    if (limiteParam === 4) return 4;

    const ua = String(req.get('user-agent') || '');
    return /Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ? 2 : 4;
}

router.get('/api/maisa/sugestoes', async (req, res) => {
    try {
        const [produtos, categorias] = await Promise.all([
            produtosModel.findAll(),
            produtosModel.findAllCategorias()
        ]);
        const usuario = res.locals.usuario && !res.locals.isAdmin ? res.locals.usuario : null;
        const limite = resolverLimiteSugestoes(req);
        const sugestoes = gerarSugestoesPersonalizadas({
            produtos: Array.isArray(produtos) ? produtos : [],
            categorias: Array.isArray(categorias) ? categorias : [],
            usuario,
            limite
        });
        return res.json({
            ok: true,
            saudacao: sugestoes.saudacao,
            topicos: sugestoes.topicos
        });
    } catch (erro) {
        console.warn('[maisa] Erro ao gerar sugestões personalizadas:', erro && erro.message);
        return res.json({
            ok: true,
            saudacao: null,
            topicos: null
        });
    }
});

router.post('/api/maisa/chat', async (req, res) => {
    try {
        const mensagem = typeof req.body?.mensagem === 'string' ? req.body.mensagem.trim() : '';
        if (!mensagem) {
            return res.status(400).json({
                ok: false,
                erro: 'Por favor, escreva ou fale o que você procura para que eu possa ajudar.'
            });
        }
        if (mensagem.length > 1000) {
            return res.status(400).json({
                ok: false,
                erro: 'Sua mensagem ficou muito longa. Tente resumir em até 1000 caracteres.'
            });
        }

        const historico = Array.isArray(req.body?.historico) ? req.body.historico : [];
        const [produtos, categorias] = await Promise.all([
            produtosModel.findAll(),
            produtosModel.findAllCategorias()
        ]);

        const listaProdutos = Array.isArray(produtos) ? produtos : [];
        const listaCategorias = Array.isArray(categorias) ? categorias : [];

        const resultado = await consultarMaisa({
            mensagem,
            historico,
            produtos: listaProdutos,
            categorias: listaCategorias,
            usuario: res.locals.usuario && !res.locals.isAdmin ? res.locals.usuario : null,
            limiteSugestoes: resolverLimiteSugestoes(req)
        });

        const mapaProdutos = new Map(
            listaProdutos.map(p => [Number(p.id_produto), p])
        );

        const produtosRecomendados = [];
        const idsAdicionados = new Set();

        for (const rec of resultado.produtos_recomendados) {
            const idNum = Number(rec && rec.id_produto);
            if (!Number.isInteger(idNum) || idsAdicionados.has(idNum)) continue;
            const prod = mapaProdutos.get(idNum);
            if (!prod) continue;
            idsAdicionados.add(idNum);
            const preco = parseFloat(prod.preco) || 0;
            const precoDesconto = prod.preco_desconto != null ? parseFloat(prod.preco_desconto) : null;
            produtosRecomendados.push({
                id: Number(prod.id_produto),
                nome: prod.nome,
                imagem: prod.imagem || '/imagens/foto.svg',
                preco,
                precoDesconto: precoDesconto && precoDesconto > 0 ? precoDesconto : null,
                categoria: prod.categoria || '',
                faixa_etaria: prod.faixa_etaria || null,
                sexo: prod.sexo || 'todos',
                status: prod.status || 'em-estoque',
                relevancia: pontuar(prod, resultado.perfilAlvo),
                motivo: typeof rec.motivo === 'string' ? rec.motivo : ''
            });
            if (produtosRecomendados.length >= 3) break;
        }

        const produtosOrdenados = ordenarPorRelevancia(produtosRecomendados, resultado.perfilAlvo);

        return res.json({
            ok: true,
            resposta: resultado.resposta,
            produtos: produtosOrdenados,
            sugestoes: resultado.sugestoes_perguntas
        });
    } catch (erro) {
        const msgSegura = String((erro && erro.message) || 'Erro desconhecido').replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]');
        const statusUpstream = erro && (erro.status || erro.code);
        if (erro && erro.codigo === 'MISSING_API_KEY') {
            console.warn('[maisa] GEMINI_API_KEY ausente nas variáveis de ambiente.');
            return res.status(503).json({
                ok: false,
                erro: 'A assistente Maisa ainda não está conectada ao serviço de inteligência artificial. Configure a GEMINI_API_KEY em Settings > Secrets.'
            });
        }
        if (statusUpstream === 400 || statusUpstream === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(msgSegura)) {
            console.warn('[maisa] Chave ou projeto Gemini sem permissão/faturamento (' + (statusUpstream || 'auth') + ').');
            return res.status(502).json({
                ok: false,
                erro: 'A chave da API do Gemini configurada não possui permissão para os modelos usados. Verifique a GEMINI_API_KEY (crie uma nova em aistudio.google.com/apikey, em um projeto sem faturamento) ou defina GEMINI_MODEL com um modelo gratuito.'
            });
        }
        if (statusUpstream === 429 || /RESOURCE_EXHAUSTED/i.test(msgSegura)) {
            console.warn('[maisa] Limite de requisições do Gemini atingido (429).');
            return res.status(429).json({
                ok: false,
                erro: 'Muitas solicitações ao mesmo tempo. Aguarde alguns instantes e tente novamente.'
            });
        }
        console.error('[maisa] Erro ao processar consulta:', statusUpstream, msgSegura);
        return res.status(502).json({
            ok: false,
            erro: 'Tive uma instabilidade momentânea para responder. Por favor, tente novamente em alguns segundos.'
        });
    }
});

router.post('/api/maisa/adicionar-carrinho/:id', async (req, res) => {
    try {
        if (req.session && req.session.isAdmin && req.session.usuarioEmail === ADMIN_EMAIL) {
            return res.status(403).json({
                ok: false,
                erro: 'Contas de administrador não adicionam itens ao carrinho.'
            });
        }
        if (!req.cookiesAceitos) {
            return res.status(409).json({
                ok: false,
                needsCookies: true,
                erro: 'Para guardar produtos no carrinho, aceite os cookies no aviso da página ou clique em "Ver produto".'
            });
        }
        const produto = await produtosModel.findById(req.params.id);
        if (!produto) {
            return res.status(404).json({ ok: false, erro: 'Produto não encontrado.' });
        }
        if (produto.status === 'fora-de-estoque') {
            return res.status(400).json({ ok: false, erro: 'Este produto está fora de estoque no momento.' });
        }
        const { id_usuario, session_id } = getIdentificador(req);
        await carrinhoModel.addProduto(req.params.id, id_usuario, session_id, 1);
        const itens = await carrinhoModel.findByIdentificador(id_usuario, session_id);
        const totalItens = (Array.isArray(itens) ? itens : []).reduce((acc, i) => acc + (parseInt(i.quantidade, 10) || 1), 0);
        return res.json({
            ok: true,
            mensagem: `"${produto.nome}" foi adicionado ao seu carrinho!`,
            totalItens
        });
    } catch (erro) {
        console.error('[maisa] Erro ao adicionar ao carrinho:', erro);
        return res.status(500).json({
            ok: false,
            erro: 'Não foi possível adicionar ao carrinho agora.'
        });
    }
});

router.get('/reclamacao', (req, res) => {
    res.render('pages/reclamacao');
});

router.post('/reclamacao',
    body('nome').trim().notEmpty().withMessage('Escreva o seu nome.'),
    body('email').trim().isEmail().withMessage('Digite um e-mail válido. Exemplo: nome@email.com.'),
    body('mensagem').trim().isLength({ min: 10, max: 2000 }).withMessage('Escreva um pouco mais: a mensagem precisa ter pelo menos 10 letras.'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ ok: false, erro: errors.array()[0].msg });
        }
        const enviado = await enviarReclamacao(req.body);
        if (!enviado) {
            return res.status(500).json({ ok: false, erro: 'Não foi possível enviar agora. Tente novamente.' });
        }
        return res.json({ ok: true, mensagem: 'Reclamação enviada com sucesso!' });
    }
);

module.exports = router;