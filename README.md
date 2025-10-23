Para instalar as dependencias use:
npm i --save

Analise o protótipo prit (1) e, replique as páginas no html e css USANDO SOMENTE HTML SEMÂNTICO, a aplicação é para celular e não insira nenhum comentário no código. 
Use como referência para  os nomes de class e tipo de elementos usados no css, os arquivos .ejs e .css já completos.
Lembrando, as dimensões originais de cada página é 393px X 852px,  ou seja, você deve utilizar vw e vh para as dimensões, assim, um exemplo: se algum item tiver 20px de largura, você deve fazer um cálculo para descobrir a porcentagem equivalente a 20 para 393.
Substitua as logos +Saúde do protótipo pela logo.png, e substitua a cor #5C7BE1 pela cor #163069.
Crie uma rota de administrador onde existam telas que seja possível analisar os status de desempenho do site e que contenha um formulário capaz de adicionar novos produtos ao site, esses formulários devem conter: nome do produto; Preço( e se tem desconto); Categoria; Descrição do produto. Ao adicionar o produto ao site, deve se criar uma nova tela de produto e um novo bloco de produto, contendo suas informações.
Adicione função de Adicionar ao carrinho ao clicar no botão 'Comprar' e, ao adicionar ao carrinho, seja possível escrever uma avaliação, sendo um formulário possível de atribuir uma nota de 0 a 5 estrelas e um texto de avaliação. Ao adicionar um produto ao carrinho, ele aparecerá na tela de carrinho.
Cada produto deve ter sua própria tela de avaliação.
Crie uma função onde a categoria do produto o insira na página da respectiva categoria.
Aplique validação no front-end das telas de Cadastro e Login.
Crie uma página de usuário que pegue os dados cadastrais e os insira nas informações do usuário, e seja possível alterar o Telefone e o CEP.
Há funções que seram necessárias o uso de javascript e node.js, você está autorizado a ultilizar.



veja os códigos dos arquivos e corrija o erro que faz com o que a aplicação seja impedida de ser executada.

login.ejs :

<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <link rel="stylesheet" href="/css/login.css">
    <script src="/js/validacao.js" defer></script>
</head>
<body>
    <header>
        <img class="icon" src="/imagens/logo.png" alt="Logo da Aplicação">
    </header>

    <main>
        <section class="login-module">
            <header class="title-group">
                <h1 class="tit">Login</h1>
            </header>

            <% if(erro) { %>
                <article class="erro-login">
                    <p class="mensagem-erro"><%= erro %></p>
                </article>
            <% } %>

            <form id="loginForm" method="POST" action="/login">
                <label for="email">
                    <h2>E-mail ou nome de usuário</h2>
                </label>
                <input type="text" placeholder="exemplo@dominio.com" id="email" name="email" required>
                <small id="email-erro-msg" class="erro" style="display: none;"></small>

                <label for="senha">
                    <h2>Senha</h2>
                </label>
                <input type="password" placeholder="Sua senha" id="senha" name="senha" required>
                <small id="senha-erro-msg" class="erro" style="display: none;"></small>

                <button type="submit" id="btn-login">Login</button>
            </form>
        </section>

        <p class="ou">Ou</p>

        <button id="google" type="button">
            <img class="google" src="/imagens/google.png" alt="Ícone do Google">
            <strong>Entrar com o Google</strong>
        </button>

        <article class="signup-prompt">
            <a href="/" class="link">
                Não tem uma conta?
                <strong class="link2">Cadastre-se aqui</strong>
            </a>
        </article>
    </main>

    <footer></footer>
</body>
</html>



const express = require('express');
const { body, validationResult} = require("express-validator");
const app = express();
const port = 3000;

app.use(express.static('app/public'));

app.set('view engine', 'ejs');
app.set('views', './app/views');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var rotas=require('./app/routes/router');
app.use('/', rotas);

app.listen(port, ()=> {
    console.log(`Servidor online\nHttp://localhost:${port}`);
});
