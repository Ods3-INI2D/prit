// Cálculo de frete na página do produto: consulta /produto/:id/frete (ViaCEP no servidor).
(function () {
    var form = document.getElementById('form-frete');
    if (!form) return;

    var campoCep    = document.getElementById('cep');
    var botao       = form.querySelector('button[type="submit"]');
    var status      = document.getElementById('frete-status');
    var resultado   = document.getElementById('frete-resultado');
    var destino     = document.getElementById('frete-destino');
    var valor       = document.getElementById('frete-valor');
    var prazo       = document.getElementById('frete-prazo');
    var linhaEnd    = document.getElementById('frete-linha-endereco');
    var endereco    = document.getElementById('frete-endereco');
    var observacao  = document.getElementById('frete-observacao');

    var moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    function somenteDigitos(texto) {
        return String(texto || '').replace(/\D/g, '').slice(0, 8);
    }

    function formatarCep(digitos) {
        return digitos.length > 5 ? digitos.slice(0, 5) + '-' + digitos.slice(5) : digitos;
    }

    function textoPrazo(min, max) {
        if (min === max) return min + (min === 1 ? ' dia útil' : ' dias úteis');
        return min + ' a ' + max + ' dias úteis';
    }

    function mostrarStatus(mensagem, estado) {
        status.textContent = mensagem;
        if (estado) status.setAttribute('data-estado', estado);
        else status.removeAttribute('data-estado');
    }

    function mostrarErro(mensagem) {
        resultado.hidden = true;
        mostrarStatus(mensagem, 'erro');
    }

    function mostrarResultado(dados) {
        var frete = dados.frete;
        var end   = dados.endereco;
        var partes = [];

        destino.textContent = end.localidade + '/' + end.uf;

        valor.textContent = frete.gratis ? 'Grátis' : moeda.format(frete.valor);
        valor.classList.toggle('frete-valor-gratis', frete.gratis);
        prazo.textContent = textoPrazo(frete.prazoMin, frete.prazoMax);

        if (end.logradouro) partes.push(end.logradouro);
        if (end.bairro)     partes.push(end.bairro);
        endereco.textContent = partes.join(' - ');
        linhaEnd.hidden = partes.length === 0;

        observacao.textContent = 'Prazo estimado em dias úteis, com envio a partir de ' +
            dados.origem.cidade + '/' + dados.origem.uf + '.' +
            (frete.gratis ? '' : ' Frete grátis em compras a partir de ' + moeda.format(dados.gratisAPartirDe) + '.');

        resultado.hidden = false;
        mostrarStatus('Frete calculado.', 'sucesso');
    }

    function definirCarregando(carregando) {
        botao.disabled = carregando;
        form.setAttribute('aria-busy', carregando ? 'true' : 'false');
    }

    campoCep.addEventListener('input', function () {
        campoCep.value = formatarCep(somenteDigitos(campoCep.value));
    });

    form.addEventListener('submit', function (evento) {
        evento.preventDefault();

        var cep = somenteDigitos(campoCep.value);
        if (cep.length !== 8) {
            campoCep.setAttribute('aria-invalid', 'true');
            mostrarErro('Digite um CEP válido com 8 números.');
            campoCep.focus();
            return;
        }
        campoCep.removeAttribute('aria-invalid');

        definirCarregando(true);
        resultado.hidden = true;
        mostrarStatus('Calculando frete...', 'carregando');

        fetch(form.getAttribute('action') + '?cep=' + cep, { headers: { Accept: 'application/json' } })
            .then(function (resposta) {
                return resposta.json().then(function (corpo) {
                    return { ok: resposta.ok, corpo: corpo };
                });
            })
            .then(function (retorno) {
                if (retorno.ok && retorno.corpo.ok) {
                    mostrarResultado(retorno.corpo);
                } else {
                    mostrarErro(retorno.corpo.mensagem || 'Não foi possível calcular o frete.');
                }
            })
            .catch(function () {
                mostrarErro('Não foi possível calcular o frete agora. Tente novamente em instantes.');
            })
            .then(function () {
                definirCarregando(false);
            });
    });
})();
