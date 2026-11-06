ALTER TABLE `pagamentos`
    ADD COLUMN `mp_payment_id` VARCHAR(100) NULL,
    ADD COLUMN `pix_qr_code` TEXT NULL,
    ADD COLUMN `pix_qr_code_base64` MEDIUMTEXT NULL,
    ADD COLUMN `pix_ticket_url` TEXT NULL;