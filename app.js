const express = require('express');
const app     = express();
require('dotenv').config();
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}


app.use(express.static('app/public'));
app.set('view engine', 'ejs');
app.set('views', './app/views');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rotas = require('./app/routes/router');
app.use('/', rotas);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor online\nhttp://localhost:${PORT}`);
});