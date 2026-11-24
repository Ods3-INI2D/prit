// Envio de e-mails.
//
// Duas formas de envio, escolhidas pelas variáveis de ambiente:
//
//  1) API HTTPS do Resend  -> quando RESEND_API_KEY estiver definida.
//     Funciona em hospedagens que bloqueiam SMTP (ex.: Render gratuito bloqueia
//     as portas 25, 465 e 587). Remetente em EMAIL_FROM (domínio verificado no
//     Resend); sem EMAIL_FROM usa onboarding@resend.dev, que só entrega para o
//     e-mail dono da conta Resend (serve para testar).
//
//  2) SMTP (nodemailer)    -> caso contrário.
//     SMTP_HOST/SMTP_PORT/SMTP_SECURE (ou Gmail, se SMTP_HOST não existir).
//     Usuário/senha: SMTP_USER/SMTP_PASS, ou EMAIL_USER/EMAIL_PASS (senha de app).
//     Remetente: EMAIL_FROM, ou EMAIL_USER.

const nodemailer = require('nodemailer');
require('dotenv').config();

const TEMPO_LIMITE_MS = 15000; // falha em vez de deixar o cadastro travado
const NOME_REMETENTE  = '+Saúde';

let transporter = null;

function formatarRemetente(endereco) {
    return endereco.includes('<') ? endereco : '"' + NOME_REMETENTE + '" <' + endereco + '>';
}

// ── Resend (HTTPS) ───────────────────────────────────────
async function enviarPeloResend({ to, subject, text, html, replyTo }) {
    let de = process.env.EMAIL_FROM;
    if (!de) {
        de = 'onboarding@resend.dev';
        console.warn('[email] EMAIL_FROM ausente: usando onboarding@resend.dev (só entrega para o dono da conta Resend).');
    }

    const resposta = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
            'Content-Type':  'application/json'
        },
        body: JSON.stringify({ from: formatarRemetente(de), to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS)
    });

    if (!resposta.ok) {
        const corpo = await resposta.text().catch(() => '');
        throw new Error('Resend respondeu ' + resposta.status + ': ' + corpo.slice(0, 300));
    }
}

// ── SMTP (nodemailer) ────────────────────────────────────
function obterTransporter() {
    if (transporter) return transporter;

    const auth = {
        user: process.env.SMTP_USER || process.env.EMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS
    };
    const tempos = {
        connectionTimeout: TEMPO_LIMITE_MS,
        greetingTimeout:   TEMPO_LIMITE_MS,
        socketTimeout:     TEMPO_LIMITE_MS
    };

    // SOMENTE em desenvolvimento: aceita certificado não confiável (antivírus/proxy/rede
    // que interceptam o TLS). Ative com SMTP_TLS_INSECURE=true no .env local.
    if (String(process.env.SMTP_TLS_INSECURE).toLowerCase() === 'true') {
        if (process.env.NODE_ENV === 'production') {
            console.warn('[email] SMTP_TLS_INSECURE ignorado em produção.');
        } else {
            tempos.tls = { rejectUnauthorized: false };
            console.warn('[email] Verificação do certificado TLS desativada (apenas desenvolvimento).');
        }
    }

    if (process.env.SMTP_HOST) {
        const porta = Number(process.env.SMTP_PORT) || 587;
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: porta,
            // 465 exige TLS direto; nas demais portas o TLS é negociado (STARTTLS)
            secure: porta === 465 || String(process.env.SMTP_SECURE).toLowerCase() === 'true',
            auth,
            ...tempos
        });
    } else {
        transporter = nodemailer.createTransport({ service: 'gmail', auth, ...tempos });
    }
    return transporter;
}

async function enviarPorSmtp({ to, subject, text, html, replyTo }) {
    const de = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await obterTransporter().sendMail({ from: formatarRemetente(de), to, subject, text, html, replyTo });
}

// Traduz o erro do SMTP/API em uma orientação objetiva.
function explicarErro(erro) {
    const texto = String((erro && erro.message) || '') + ' ' + String((erro && erro.response) || '');
    const codigo = erro && erro.code;

    if (/self[- ]signed|certificate|CERT_|unable to verify/i.test(texto)) {
        return 'Certificado TLS não confiável: algo na sua rede (antivírus, proxy, rede da escola) está ' +
               'interceptando a conexão. Em desenvolvimento, adicione SMTP_TLS_INSECURE=true ao .env e reinicie; ' +
               'ou desative a verificação de HTTPS/e-mail do antivírus.';
    }
    // O Google reconheceu o login, mas bloqueou a tentativa e exige confirmação pelo navegador
    if (/WebLoginRequired|log in with your web browser|534-5\.7\.14/i.test(texto)) {
        return 'O Google bloqueou este login e exige confirmação pelo navegador (a senha não é o problema). ' +
               '1) Entre no Gmail dessa conta pelo navegador e confirme qualquer "Alerta de segurança" ("Fui eu"); ' +
               '2) acesse https://accounts.google.com/DisplayUnlockCaptcha, clique em Continuar e tente de novo em instantes; ' +
               '3) em myaccount.google.com/apppasswords gere uma NOVA senha de app (a antiga pode ter sido bloqueada) e atualize EMAIL_PASS; ' +
               '4) confira se a verificação em 2 etapas está ativa. Se continuar, use RESEND_API_KEY (envio por HTTPS).';
    }
    if (/Application-specific password required/i.test(texto)) {
        return 'O Gmail exige uma "senha de app" em EMAIL_PASS (gerada em myaccount.google.com/apppasswords), não a senha normal da conta.';
    }
    if (codigo === 'EAUTH' || /535|Invalid login|Username and Password not accepted|BadCredentials/i.test(texto)) {
        return 'Login recusado pelo Gmail. É preciso usar uma "senha de app" (16 letras, gerada em ' +
               'myaccount.google.com/apppasswords, com verificação em 2 etapas ativa) em EMAIL_PASS — não a senha normal da conta. ' +
               'Confira também se EMAIL_USER é o mesmo e-mail que gerou a senha.';
    }
    if (['ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'ECONNREFUSED', 'ENOTFOUND', 'EDNS'].includes(codigo)) {
        return 'Não foi possível conectar ao servidor SMTP (rede bloqueando a porta ou sem internet). Teste: ' +
               'SMTP_PORT=465 (com SMTP_SECURE=true), outra rede (ex.: hotspot do celular) ou use RESEND_API_KEY (envio por HTTPS). ' +
               'Hospedagens como o Render gratuito também bloqueiam as portas 25/465/587.';
    }
    if (codigo === 'EENVELOPE') {
        return 'Endereço de destinatário/remetente inválido.';
    }
    return null;
}

/**
 * Envia um e-mail com versão em texto e em HTML.
 * Nunca lança exceção: retorna true se enviou e false se falhou
 * (o motivo é registrado no log do servidor).
 * @param {{ to: string, subject: string, text: string, html: string, replyTo?: string }} email
 * @returns {Promise<boolean>}
 */
async function enviarEmail(email) {
    const viaResend = Boolean(process.env.RESEND_API_KEY);

    if (!viaResend && !((process.env.SMTP_USER || process.env.EMAIL_USER) && (process.env.SMTP_PASS || process.env.EMAIL_PASS))) {
        console.error('[email] Nenhum envio configurado: defina RESEND_API_KEY ou EMAIL_USER/EMAIL_PASS.');
        return false;
    }

    try {
        if (viaResend) await enviarPeloResend(email);
        else           await enviarPorSmtp(email);
        return true;
    } catch (erro) {
        console.error('[email] Falha ao enviar e-mail (' + (viaResend ? 'Resend' : 'SMTP') + '):', erro.code || '', erro.message);
        const dica = viaResend ? null : explicarErro(erro);
        if (dica) console.error('[email] O que fazer: ' + dica);
        return false;
    }
}

module.exports = { enviarEmail, explicarErro };