router.use(async (req, res, next) => {
    res.locals.usuario        = null;
    res.locals.isAdmin        = false;
    res.locals.categoriasMenu = [];
    res.locals.notificacao    = req.session.notificacao || null;

    if (req.session.notificacao) {
        delete req.session.notificacao;
    }
    
});