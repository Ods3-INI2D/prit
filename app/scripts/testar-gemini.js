// Uso: node scripts/testar-gemini.js
// Mostra o motivo REAL do erro do Gemini (sem imprimir sua chave).
require('dotenv').config();
const chave = process.env.GEMINI_API_KEY;
const oculta = t => String(t).split(chave || '\u0000').join('[CHAVE]');

(async () => {
    if (!chave) return console.log('❌ GEMINI_API_KEY não está definida no .env');
    console.log(`Chave carregada: ${chave.slice(0, 4)}…${chave.slice(-3)} (${chave.length} caracteres)`);

    const base = 'https://generativelanguage.googleapis.com/v1beta';
    const lista = await fetch(`${base}/models?key=${chave}&pageSize=200`);
    const jl = await lista.json().catch(() => ({}));
    console.log(`\nListar modelos -> HTTP ${lista.status}`);
    if (!lista.ok) console.log(oculta(JSON.stringify(jl.error || jl, null, 2)));
    else console.log('Modelos "flash" visíveis para esta chave:\n  ' +
        (jl.models || []).map(m => m.name.replace('models/', '')).filter(n => /flash/i.test(n)).join('\n  '));

    for (const modelo of ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']) {
        const r = await fetch(`${base}/models/${modelo}:generateContent?key=${chave}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Diga apenas: ok' }] }] })
        });
        const j = await r.json().catch(() => ({}));
        console.log(`\n${modelo} -> HTTP ${r.status}`);
        if (!r.ok) console.log('  ' + oculta((j.error && j.error.message) || JSON.stringify(j)));
        else console.log('  ✅ funcionou:', j.candidates?.[0]?.content?.parts?.[0]?.text?.trim());
    }
    console.log('\nSe todos deram 403 com "leaked"/"denied access": a chave/projeto foi bloqueado. Crie uma nova em https://aistudio.google.com/apikey');
})();