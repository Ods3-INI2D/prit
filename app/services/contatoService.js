require('dotenv').config();
const { enviarEmail } = require('../helpers/email');

function escapar(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

function montarHtmlReclamacao({ nome, email, mensagem }) {
    return '<!DOCTYPE html>' +
        '<html lang="pt-br"><body style="margin:0;padding:24px;background:#f2f5f9;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">' +
        '<article style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dde3ec;">' +
        '<header style="background:#2364aa;padding:20px 24px;">' +
        '<h1 style="margin:0;font-size:20px;color:#ffffff;">+Saúde | Nova reclamação</h1>' +
        '</header>' +
        '<section style="padding:24px;">' +
        '<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Nome</p>' +
        '<p style="margin:0 0 16px;font-size:16px;font-weight:bold;">' + escapar(nome) + '</p>' +
        '<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">E-mail para resposta</p>' +
        '<p style="margin:0 0 16px;font-size:16px;"><a href="mailto:' + escapar(email) + '" style="color:#2364aa;">' + escapar(email) + '</a></p>' +
        '<p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Mensagem</p>' +
        '<blockquote style="margin:0;padding:12px 16px;background:#f2f5f9;border-left:4px solid #2364aa;border-radius:4px;font-size:15px;line-height:1.5;">' + escapar(mensagem) + '</blockquote>' +
        '</section>' +
        '<footer style="padding:16px 24px;background:#f9fafb;border-top:1px solid #dde3ec;font-size:12px;color:#6b7280;">' +
        'Para responder, clique em Responder: a resposta vai direto para o cliente.' +
        '</footer>' +
        '</article>' +
        '</body></html>';
}

async function enviarReclamacao({ nome, email, mensagem }) {
    return enviarEmail({
        to: process.env.EMAIL_SAC,
        replyTo: email,
        subject: 'Nova reclamação de ' + nome,
        text: 'Nome: ' + nome + '\nE-mail: ' + email + '\n\n' + mensagem,
        html: montarHtmlReclamacao({ nome, email, mensagem })
    });
}

module.exports = { enviarReclamacao };