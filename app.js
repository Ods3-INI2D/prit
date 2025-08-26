const express = require('express');
<<<<<<< HEAD
const { body, validationResult} = require("express-validator");
=======
>>>>>>> d7d26b30f29f12e78884a74ca7fbfc29f3570efa
const app = express();
const port = 3000;

app.use(express.static('app/public'));

app.set('view engine', 'ejs');
app.set('views', './app/views');

<<<<<<< HEAD
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

=======
>>>>>>> d7d26b30f29f12e78884a74ca7fbfc29f3570efa
var rotas=require('./app/routes/router');
app.use('/', rotas);

app.listen(port, ()=> {
    console.log(`Servidor online\nHttp://localhost:${port}`);
});