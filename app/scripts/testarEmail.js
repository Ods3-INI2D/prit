// Testa o envio de e-mail sem passar pelo cadastro.
// Uso (na pasta do projeto):
//     node app/scripts/testarEmail.js                 -> envia para EMAIL_USER
//     node app/scripts/testarEmail.js alguem@x.com    -> envia para o endereço informado
// O motivo de qualquer falha (e o que fazer) aparece no terminal.

require('dotenv').config();
const { enviarEmail } = require('../helpers/email');

const destino = process.argv[2] || process.env.EMAIL_USER;

if (!destino) {
    console.error('Informe o destinatário: node app/scripts/testarEmail.js seu@email.com');
    process.exit(1);
}

(async () => {
    const via = process.env.RESEND_API_KEY ? 'Resend (HTTPS)' : (process.env.SMTP_HOST || 'smtp.gmail.com') + ':' + (process.env.SMTP_PORT || '587');
    console.log('Enviando e-mail de teste para ' + destino + ' via ' + via + '...');

    const ok = await enviarEmail({
        to: destino,
        subject: 'Teste de e-mail - +Saúde',
        text: 'Se você recebeu esta mensagem, o envio de e-mails está funcionando.',
        html: '<p>Se você recebeu esta mensagem, o envio de e-mails está funcionando.</p>'
    });

    console.log(ok ? 'OK: e-mail enviado. Confira a caixa de entrada (e o spam).' : 'FALHOU: veja a mensagem "[email] ..." acima.');
    process.exit(ok ? 0 : 1);
})();