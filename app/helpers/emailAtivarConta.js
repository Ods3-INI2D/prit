
function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * @param {{ nome: string, link: string, validadeHoras: number }} dados
 * @returns {{ assunto: string, texto: string, html: string }}
 */
function emailAtivarConta({ nome, link, validadeHoras }) {
    const primeiroNome = String(nome || '').trim().split(/\s+/)[0] || '';
    const saudacao     = primeiroNome ? 'Olá, ' + primeiroNome + '!' : 'Olá!';
    const assunto      = 'Ative sua conta na +Saúde';

    const texto = [
        saudacao,
        '',
        'Obrigado por se cadastrar na +Saúde. Para ativar sua conta, acesse o link abaixo:',
        link,
        '',
        'Este link é válido por ' + validadeHoras + ' horas.',
        'Se você não solicitou este cadastro, ignore este e-mail.'
    ].join('\n');

    const linkHtml = escaparHtml(link);

    const html = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escaparHtml(assunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;color:#222222;">
    <main style="display:block;max-width:37.5rem;margin:2rem auto;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <header style="display:block;background-color:#001863;color:#ffffff;padding:1.25rem;text-align:center;">
            <h1 style="margin:0;font-size:1.5rem;">+Saúde</h1>
        </header>

        <section style="display:block;padding:1.5rem;text-align:center;">
            <h2 style="margin:0 0 1rem;font-size:1.25rem;">${escaparHtml(saudacao)}</h2>
            <p style="margin:0 0 1rem;font-size:1rem;line-height:1.5;">
                Obrigado por se cadastrar. Clique no botão abaixo para ativar sua conta:
            </p>
            <p style="margin:1.5rem 0;">
                <a href="${linkHtml}" style="display:inline-block;padding:0.75rem 1.5rem;background-color:#007bff;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">Ativar conta</a>
            </p>
            <p style="margin:0 0 0.5rem;font-size:0.875rem;color:#555555;">
                O link é válido por ${escaparHtml(validadeHoras)} horas. Se o botão não funcionar, copie e cole este endereço no navegador:
            </p>
            <p style="margin:0;font-size:0.8125rem;word-break:break-all;">
                <a href="${linkHtml}" style="color:#0056b3;">${linkHtml}</a>
            </p>
        </section>

        <footer style="display:block;padding:1rem 1.5rem;background-color:#f4f4f4;text-align:center;font-size:0.75rem;color:#777777;">
            <p style="margin:0;">Se você não solicitou este cadastro, ignore este e-mail.</p>
        </footer>
    </main>
</body>
</html>`;

    return { assunto, texto, html };
}

module.exports = { emailAtivarConta };