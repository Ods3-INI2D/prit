var express=require('express');
var router=express.Router();

router.get('/', function(req, res) {
    res.render('pages/cadastro');
});
router.get('/login', function(req, res) {
    res.render('pages/login');
});
router.get('/home', function(req, res) {
    res.render('pages/home');
});
module.exports = router;