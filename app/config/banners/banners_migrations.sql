-- Público-alvo dos banners (faixa etária e sexo).
-- Só é necessário se a criação automática feita por app/models/bannersmodel.js falhar
-- (por exemplo, usuário do banco sem permissão de ALTER). Execute uma única vez;
-- se as colunas já existirem, o MySQL responde "Duplicate column name".
ALTER TABLE `banners`
    ADD COLUMN `faixa_etaria` VARCHAR(10) NULL DEFAULT NULL,
    ADD COLUMN `sexo`         VARCHAR(12) NULL DEFAULT NULL;
