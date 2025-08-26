var express=require('express');
const {body, validationResult } = require('express-validator');
var router=express.Router();
var { valCPF, valTel, valSenha, valCsenha } = require('../helpers/validacoes')

router.get('/', function(req, res) {
    res.render('pages/cadastro', {"erros": null, "valores": {"nome": "", "nasc": "", "cpf": "", "tel": "",  "email" : "", "senhan": "", "csenha": ""}});
});

router.get('/login', function(req, res) {
    res.render('pages/login');
});
router.get('/home', function(req, res) {
    res.render('pages/home');
});
router.get('/usuario', function(req, res) {
    res.render('pages/usuario');
});

router.post("/cadastro",

    body("nome").isLength({ min: 3, max: 50})
    .withMessage("Nome deve conter de 3 a 50 caracteres"),
    body("cpf").isLength({min: 11, max: 11})
    .withMessage('O CPF deve conter 11 caracteres')
    .custom((value) => {
      if (valCPF(value)) {
        return true;
      } else {
        throw new Error('CPF inválido');
      }
    }),
    body("tel").isLength({min: 9, max: 9})
    .withMessage('O telefone deve conter 9 caracteres')
    .custom((value) => {
      if (valTel(value)) {
        return true;
      } else {
        throw new Error('Telefone inválido');
      }
    }),
    body("email")
    .isEmail().withMessage('O e-mail deve ser válido!'),
    body("senhan")
    .isLength({ min: 6, max: 20 }).withMessage('A senha deve conter de 6 a 20 caracteres')
    .custom((value) => {
      if (valSenha(value)) {
        return true;
      } else {
        throw new Error('A senha deve conter pelo menos um número, uma letra maiúscula e um caractere especial');
      }
    }),
    body("csenha")
    .custom((value) => {
      if (valCsenha(value)) {
        return true;
      } else {
        throw new Error('As senhas devem ser iguais');
      }
    }),
    
    function va (req, res) {
    res.json(req.body);
});

router.post("/usuario", function (req, res) {
   const errors = validationResult(req);
    if(!errors.isEmpty()){
        console.log(errors);
        return res.render("pages/cadastro", { "erros" : null, "valores" : req.body, "retorno" : null});
    }
    res.json(req.body);
});

function rerros (req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors);
      return res.render("pages/cadastro", { resultado: null, "erros": errors, "valores": req.body });
    }
    return res.render("pages/cadastro", { resultado: req.body, "erros": errors, "valores": req.body });
  };

module.exports = router;