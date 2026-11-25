require('dotenv').config();
const { enviarEmail } = require('../helpers/email');

const COR_PRINCIPAL = '#2364aa';
const COR_ESCURA    = '#174a85';
const FONTE         = "Arial, Helvetica, sans-serif";

function escapar(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');
}

function dataHoraAtual() {
    return new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function rotulo(texto) {
    return '<p style="margin:0 0 4px;font-family:' + FONTE + ';font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#6b7280;">' + texto + '</p>';
}

function montarHtmlReclamacao({ nome, email, mensagem }) {
    const assuntoResposta = encodeURIComponent('Re: sua mensagem para a central de atendimento +Saúde');
    const linkResposta = 'mailto:' + escapar(email) + '?subject=' + assuntoResposta;

    return '<!DOCTYPE html>' +
    '<html lang="pt-br"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>' +
    '<body style="margin:0;padding:0;background-color:#eef2f7;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef2f7" style="background-color:#eef2f7;">' +
    '<tr><td align="center" style="padding:28px 12px;">' +

    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-radius:14px;overflow:hidden;border:1px solid #d9e1ec;">' +

    '<tr><td bgcolor="' + COR_PRINCIPAL + '" style="background-color:' + COR_PRINCIPAL + ';padding:28px 32px;">' +
    '<h1 style="margin:0;font-family:' + FONTE + ';font-size:26px;line-height:1.2;color:#ffffff;">+Saúde</h1>' +
    '<p style="margin:6px 0 0;font-family:' + FONTE + ';font-size:14px;color:#cfe0f5;">Central de Atendimento</p>' +
    '</td></tr>' +

    '<tr><td bgcolor="' + COR_ESCURA + '" style="background-color:' + COR_ESCURA + ';padding:12px 32px;">' +
    '<p style="margin:0;font-family:' + FONTE + ';font-size:14px;font-weight:bold;color:#ffffff;">Nova reclamação recebida</p>' +
    '</td></tr>' +

    '<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 32px 8px;">' +
    rotulo('Nome') +
    '<p style="margin:0 0 20px;font-family:' + FONTE + ';font-size:18px;font-weight:bold;color:#111827;">' + escapar(nome) + '</p>' +
    rotulo('E-mail para resposta') +
    '<p style="margin:0 0 20px;font-family:' + FONTE + ';font-size:16px;"><a href="mailto:' + escapar(email) + '" style="color:' + COR_PRINCIPAL + ';text-decoration:underline;">' + escapar(email) + '</a></p>' +
    rotulo('Recebida em') +
    '<p style="margin:0 0 20px;font-family:' + FONTE + ';font-size:15px;color:#374151;">' + dataHoraAtual() + '</p>' +
    rotulo('Mensagem') +
    '</td></tr>' +

    '<tr><td bgcolor="#ffffff" style="background-color:#ffffff;padding:0 32px 8px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td width="4" bgcolor="' + COR_PRINCIPAL + '" style="background-color:' + COR_PRINCIPAL + ';width:4px;"></td>' +
    '<td bgcolor="#f3f6fa" style="background-color:#f3f6fa;padding:16px 18px;font-family:' + FONTE + ';font-size:16px;line-height:1.6;color:#1f2937;">' + escapar(mensagem) + '</td>' +
    '</tr></table>' +
    '</td></tr>' +

    '<tr><td bgcolor="#ffffff" align="center" style="background-color:#ffffff;padding:24px 32px 32px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td bgcolor="' + COR_PRINCIPAL + '" style="background-color:' + COR_PRINCIPAL + ';border-radius:8px;">' +
    '<a href="' + linkResposta + '" style="display:inline-block;padding:14px 28px;font-family:' + FONTE + ';font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">Responder ao cliente</a>' +
    '</td></tr></table>' +
    '</td></tr>' +

    '<tr><td bgcolor="#f9fafb" style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">' +
    '<p style="margin:0;font-family:' + FONTE + ';font-size:12px;line-height:1.5;color:#6b7280;">Mensagem enviada pelo formulário de reclamações do site +Saúde. Ao clicar em Responder, a resposta vai direto para o e-mail do cliente.</p>' +
    '</td></tr>' +

    '</table>' +
    '</td></tr></table></body></html>';
}

async function enviarReclamacao({ nome, email, mensagem }) {
    return enviarEmail({
        to: process.env.EMAIL_SAC,
        replyTo: email,
        subject: 'Nova reclamação de ' + nome,
        text: 'Nova reclamação recebida em ' + dataHoraAtual() + '\n\nNome: ' + nome + '\nE-mail: ' + email + '\n\n' + mensagem,
        html: montarHtmlReclamacao({ nome, email, mensagem })
    });
}

module.exports = { enviarReclamacao };