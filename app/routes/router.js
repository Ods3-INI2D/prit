var express = require('express');
const { body, validationResult } = require('express-validator');
var router = express.Router();
var { valCPF, valTel, valNasc } = require('../helpers/validacao');

var produtos = [];
var avaliacoes = [];
var carrinho = [];
var usuarioCadastrado = null;

router.get('/', function(req, res) {
    res.render('pages/cadastro', { 
        "erros": null, 
        "valores": {"nome": "", "nasc": "", "cpf": "", "tel": "", "email": "", "senhan": "", "csenha": ""},
        "listaErros": null
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
        .isEmail().withMessage('O e-mail deve ser válido!'),
    body("senhan")
        .isLength({ min: 6, max: 20 }).withMessage('A senha deve conter de 6 a 20 caracteres!')
        .custom((value) => {
            const regex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{6,20}$/;
            if (!regex.test(value)) {
                throw new Error('A senha deve conter pelo menos um número, uma letra maiúscula e um caractere especial!');
            }
            return true;
        }),
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
                "erros": true, 
                "valores": req.body, 
                "listaErros": errors 
            });
        }
        
        usuarioCadastrado = req.body;
        res.redirect('/login');
    }
);

router.get('/login', function(req, res) {
    res.render('pages/login', { erro: null });
});

router.post('/login', function(req, res) {
    if (usuarioCadastrado && req.body.email === usuarioCadastrado.email && req.body.senha === usuarioCadastrado.senhan) {
        res.redirect('/home');
    } else {
        res.render('pages/login', { erro: 'E-mail ou senha inválidos!' });
    }
});

router.get('/home', function(req, res) {
    res.render('pages/home', { produtos: produtos });
});

router.get('/usuario', function(req, res) {
    res.render('pages/usuario', { usuario: usuarioCadastrado });
});

router.post('/usuario/atualizar', function(req, res) {
    if (usuarioCadastrado) {
        usuarioCadastrado.tel = req.body.tel;
        usuarioCadastrado.cep = req.body.cep;
    }
    res.redirect('/usuario');
});

router.get('/admin', function(req, res) {
    res.render('pages/admin', { produtos: produtos, totalProdutos: produtos.length, totalAvaliacoes: avaliacoes.length });
});

router.post('/admin/adicionar-produto', function(req, res) {
    const novoProduto = {
        id: Date.now(),
        nome: req.body.nome,
        preco: parseFloat(req.body.preco),
        precoDesconto: req.body.precoDesconto ? parseFloat(req.body.precoDesconto) : null,
        categoria: req.body.categoria,
        descricao: req.body.descricao,
        imagem: '/imagens/foto.jpg',
        avaliacoes: []
    };
    produtos.push(novoProduto);
    res.redirect('/admin');
});

router.get('/produto/:id', function(req, res) {
    const produto = produtos.find(p => p.id == req.params.id);
    if (!produto) {
        return res.redirect('/home');
    }
    res.render('pages/produto', { produto: produto, produtos: produtos });
});

router.post('/produto/:id/adicionar-carrinho', function(req, res) {
    const produto = produtos.find(p => p.id == req.params.id);
    if (produto) {
        carrinho.push(produto);
    }
    res.redirect('/carrinho');
});

router.get('/carrinho', function(req, res) {
    res.render('pages/carrinho', { carrinho: carrinho });
});

router.post('/produto/:id/avaliar', function(req, res) {
    const produto = produtos.find(p => p.id == req.params.id);
    if (produto) {
        const novaAvaliacao = {
            nota: parseInt(req.body.nota),
            texto: req.body.texto,
            data: new Date()
        };
        produto.avaliacoes.push(novaAvaliacao);
        avaliacoes.push(novaAvaliacao);
    }
    res.redirect('/produto/' + req.params.id);
});

router.get('/categoria/:nome', function(req, res) {
    const produtosCategoria = produtos.filter(p => p.categoria.toLowerCase() === req.params.nome.toLowerCase());
    res.render('pages/categoria', { categoria: req.params.nome, produtos: produtosCategoria });
});

router.get('/bloco', function(req, res) {
    res.render('partial/bloco');
});

router.get('/blocod', function(req, res) {
    res.render('partial/blocod');
});

router.get('/grid', function(req, res) {
    res.render('partial/grid');
});

router.get('/menu', function(req, res) {
    res.render('partial/menu');
});

router.get('/footer', function(req, res) {
    res.render('partial/footer');
});

module.exports = router;