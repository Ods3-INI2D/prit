CREATE DATABASE IF NOT EXISTS `buue1yllxo67imoeiw0b`;

USE `buue1yllxo67imoeiw0b`;


CREATE TABLE IF NOT EXISTS `usuarios` (
    `id_usuario`  INT           NOT NULL AUTO_INCREMENT,
    `nome`        VARCHAR(50)   NOT NULL,
    `nasc`        DATE          NOT NULL,
    `cpf`         CHAR(11)      NOT NULL UNIQUE,
    `ddd`         CHAR(2)       NOT NULL,
    `tel`         CHAR(9)       NOT NULL,
    `email`       VARCHAR(100)  NOT NULL UNIQUE,
    `senhan`      VARCHAR(255)  NOT NULL,
    `criado_em`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_usuario`)
);


CREATE TABLE IF NOT EXISTS `categorias` (
    `id_categoria`  INT          NOT NULL AUTO_INCREMENT,
    `nome`          VARCHAR(60)  NOT NULL UNIQUE,
    PRIMARY KEY (`id_categoria`)
);


CREATE TABLE IF NOT EXISTS `produtos` (
    `id_produto`     BIGINT         NOT NULL AUTO_INCREMENT,
    `nome`           VARCHAR(150)   NOT NULL,
    `descricao`      TEXT,
    `preco`          DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    `preco_desconto` DECIMAL(10,2)  DEFAULT NULL,
    `imagem`         VARCHAR(255)   NOT NULL DEFAULT '/imagens/foto.jpg',
    `status`         ENUM('em-estoque','fora-de-estoque') NOT NULL DEFAULT 'em-estoque',
    `id_categoria`   INT            NOT NULL,
    `criado_em`      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_produto`),
    FOREIGN KEY (`id_categoria`) REFERENCES `categorias`(`id_categoria`)
        ON UPDATE CASCADE ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS `avaliacoes` (
    `id_avaliacao`  INT   NOT NULL AUTO_INCREMENT,
    `id_produto`    BIGINT NOT NULL,
    `id_usuario`    INT   NOT NULL,
    `nota`          TINYINT NOT NULL CHECK (`nota` BETWEEN 0 AND 5),
    `texto`         TEXT,
    `criado_em`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_avaliacao`),
    FOREIGN KEY (`id_produto`) REFERENCES `produtos`(`id_produto`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`)
        ON UPDATE CASCADE ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `pedidos` (
    `id_pedido`    INT            NOT NULL AUTO_INCREMENT,
    `id_usuario`   INT            NOT NULL,
    `data_pedido`  DATE           NOT NULL DEFAULT (CURDATE()),
    `valor_total`  DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    `status`       ENUM('pendente','aprovado','enviado','entregue','cancelado')
                   NOT NULL DEFAULT 'pendente',
    `criado_em`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_pedido`),
    FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`)
        ON UPDATE CASCADE ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS `itens_pedido` (
    `id_item`      INT            NOT NULL AUTO_INCREMENT,
    `id_pedido`    INT            NOT NULL,
    `id_produto`   BIGINT         NOT NULL,
    `qtd`          INT            NOT NULL DEFAULT 1,
    `preco_unit`   DECIMAL(10,2)  NOT NULL,
    PRIMARY KEY (`id_item`),
    FOREIGN KEY (`id_pedido`)  REFERENCES `pedidos`(`id_pedido`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`id_produto`) REFERENCES `produtos`(`id_produto`)
        ON UPDATE CASCADE ON DELETE RESTRICT
);


CREATE TABLE IF NOT EXISTS `carrinho` (
    `id_carrinho`  INT     NOT NULL AUTO_INCREMENT,
    `id_usuario`   INT     DEFAULT NULL COMMENT 'NULL = sessão anônima',
    `session_id`   VARCHAR(100) DEFAULT NULL,
    `id_produto`   BIGINT  NOT NULL,
    `quantidade`   INT     NOT NULL DEFAULT 1,
    `adicionado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_carrinho`),
    FOREIGN KEY (`id_produto`)  REFERENCES `produtos`(`id_produto`)
        ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (`id_usuario`)  REFERENCES `usuarios`(`id_usuario`)
        ON UPDATE CASCADE ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `pagamentos` (
    `id_pagamento` INT            NOT NULL AUTO_INCREMENT,
    `id_pedido`    INT            NOT NULL,
    `forma`        VARCHAR(50),
    `valor`        DECIMAL(10,2),
    `status`       VARCHAR(30),
    PRIMARY KEY (`id_pagamento`),
    FOREIGN KEY (`id_pedido`) REFERENCES `pedidos`(`id_pedido`)
        ON UPDATE CASCADE ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `entregas` (
    `id_entrega`       INT          NOT NULL AUTO_INCREMENT,
    `id_pagamento`     INT          NOT NULL,
    `codigo_rastreio`  VARCHAR(50),
    `transportadora`   VARCHAR(100),
    `status`           VARCHAR(30),
    PRIMARY KEY (`id_entrega`),
    FOREIGN KEY (`id_pagamento`) REFERENCES `pagamentos`(`id_pagamento`)
        ON UPDATE CASCADE ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS `banners` (
    `id_banner`  INT          NOT NULL AUTO_INCREMENT,
    `imagem`     VARCHAR(255) NOT NULL,
    `legenda`    VARCHAR(150) NOT NULL DEFAULT '',
    `link`       VARCHAR(200) NOT NULL DEFAULT '/home',
    PRIMARY KEY (`id_banner`)
);