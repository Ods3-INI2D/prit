
const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

function obterTransporter() {
    if (transporter) return transporter;

    const auth = { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS };

    transporter = process.env.SMTP_HOST
        ? nodemailer.createTransport({
            host:   process.env.SMTP_HOST,
            port:   Number(process.env.SMTP_PORT) || 587,
            secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
            auth
        })
        : nodemailer.createTransport({ service: 'gmail', auth });

    return transporter;
}

/**
 * Envia um e-mail com versão em texto e em HTML.
 * Nunca lança exceção: retorna true se enviou e false se falhou.
 * @param {{ to: string, subject: string, text: string, html: string }} email
 * @returns {Promise<boolean>}
 */
async function enviarEmail({ to, subject, text, html }) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('[email] EMAIL_USER/EMAIL_PASS não configurados; e-mail não enviado.');
        return false;
    }
    try {
        await obterTransporter().sendMail({
            from: '"+Saúde" <' + process.env.EMAIL_USER + '>',
            to,
            subject,
            text,
            html
        });
        return true;
    } catch (erro) {
        console.error('[email] Falha ao enviar e-mail:', erro.message);
        return false;
    }
}

module.exports = { enviarEmail };