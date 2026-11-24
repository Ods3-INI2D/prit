(function () {
    'use strict';

    const root = document.getElementById('maisa-chatbot');
    if (!root) return;

    const launcher = document.getElementById('maisa-launcher');
    const backdrop = document.getElementById('maisa-backdrop');
    const panel = document.getElementById('maisa-panel');
    const closeBtn = document.getElementById('maisa-close');
    const clearBtn = document.getElementById('maisa-clear');
    const fontToggleBtn = document.getElementById('maisa-font-toggle');
    const messagesEl = document.getElementById('maisa-messages');
    const form = document.getElementById('maisa-form');
    const input = document.getElementById('maisa-input');
    const sendBtn = document.getElementById('maisa-send');
    const voiceBtn = document.getElementById('maisa-voice');
    const voiceStatus = document.getElementById('maisa-voice-status');

    const userName = root.dataset.userName || '';
    const isAdmin = root.dataset.isAdmin === 'true';

    function ehDesktop() {
        return window.matchMedia('(min-width: 901px)').matches;
    }

    function obterLimiteSugestoes() {
        return ehDesktop() ? 4 : 2;
    }

    function obterDispositivo() {
        return ehDesktop() ? 'desktop' : 'mobile';
    }

    function lerCategoriasDoSite() {
        const el = document.getElementById('maisa-categorias-data');
        if (!el) return [];
        try {
            const lista = JSON.parse(el.textContent || '[]');
            if (!Array.isArray(lista)) return [];
            const usados = new Set();
            const out = [];
            for (const item of lista) {
                const nome = item && item.nome ? String(item.nome).trim() : '';
                if (!nome) continue;
                const chave = nome.toLowerCase();
                if (usados.has(chave)) continue;
                usados.add(chave);
                out.push({
                    titulo: nome,
                    pergunta: 'Quero ver opções da categoria ' + nome + '.'
                });
            }
            return out;
        } catch (_) {
            return [];
        }
    }

    const TOPICOS_CATEGORIAS_SITE = lerCategoriasDoSite();

    let letraGrande = localStorage.getItem('maisa_font_large') === 'true';
    let historico = [];
    let enviando = false;
    let recognition = null;
    let ouvindoVoz = false;

    function aplicarTamanhoFonte(grande) {
        letraGrande = grande;
        root.setAttribute('data-maisa-size', grande ? 'large' : 'normal');
        localStorage.setItem('maisa_font_large', grande ? 'true' : 'false');
        if (fontToggleBtn) {
            fontToggleBtn.setAttribute('aria-pressed', grande ? 'true' : 'false');
            fontToggleBtn.setAttribute('aria-label', grande ? 'Voltar ao tamanho normal da letra' : 'Aumentar tamanho da letra');
            fontToggleBtn.innerHTML = grande
                ? 'A-<span class="maisa-desktop-only"> Letra normal</span>'
                : 'A+<span class="maisa-desktop-only"> Letra maior</span>';
        }
    }
    aplicarTamanhoFonte(letraGrande);

    if (fontToggleBtn) {
        fontToggleBtn.addEventListener('click', function () {
            aplicarTamanhoFonte(!letraGrande);
        });
    }

    let sugestoesPersonalizadas = null;
    let sugestoesLimiteCache = null;
    let carregandoSugestoes = false;

    async function carregarSugestoesPersonalizadas() {
        const limiteAtual = obterLimiteSugestoes();
        if ((sugestoesPersonalizadas && sugestoesLimiteCache === limiteAtual) || carregandoSugestoes) return;
        carregandoSugestoes = true;
        try {
            const resp = await fetch('/api/maisa/sugestoes?limite=' + limiteAtual + '&dispositivo=' + obterDispositivo());
            if (!resp.ok) return;
            const data = await resp.json();
            if (data && data.ok && Array.isArray(data.topicos) && data.topicos.length > 0) {
                sugestoesLimiteCache = limiteAtual;
                sugestoesPersonalizadas = {
                    saudacao: data.saudacao || null,
                    topicos: data.topicos
                };
                if (historico.length === 0 && document.getElementById('maisa-topics-list') && !enviando) {
                    messagesEl.innerHTML = '';
                    renderBoasVindas();
                }
            }
        } catch (_) {
            // mantém sugestões padrão
        } finally {
            carregandoSugestoes = false;
        }
    }

    function abrirPainel() {
        panel.hidden = false;
        backdrop.hidden = false;
        launcher.hidden = true;
        launcher.setAttribute('aria-expanded', 'true');
        if (messagesEl.children.length === 0) {
            renderBoasVindas();
            carregarSugestoesPersonalizadas();
        }
        setTimeout(function () {
            input.focus();
        }, 60);
    }

    function fecharPainel() {
        panel.hidden = true;
        backdrop.hidden = true;
        launcher.hidden = false;
        launcher.setAttribute('aria-expanded', 'false');
        pararLeituraVoz();
        if (recognition && ouvindoVoz) {
            try { recognition.stop(); } catch (_) {}
        }
        launcher.focus();
    }

    launcher.addEventListener('click', abrirPainel);
    closeBtn.addEventListener('click', fecharPainel);
    backdrop.addEventListener('click', fecharPainel);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !panel.hidden) {
            fecharPainel();
        }
    });

    clearBtn.addEventListener('click', function () {
        historico = [];
        pararLeituraVoz();
        messagesEl.innerHTML = '';
        clearBtn.hidden = true;
        renderBoasVindas();
        input.focus();
    });

    let vozesDisponiveis = [];

    function atualizarListaVozes() {
        if ('speechSynthesis' in window && typeof window.speechSynthesis.getVoices === 'function') {
            vozesDisponiveis = window.speechSynthesis.getVoices() || [];
        }
    }

    if ('speechSynthesis' in window) {
        atualizarListaVozes();
        if (typeof window.speechSynthesis.addEventListener === 'function') {
            window.speechSynthesis.addEventListener('voiceschanged', atualizarListaVozes);
        } else if ('onvoiceschanged' in window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = atualizarListaVozes;
        }
    }

    const NOMES_VOZ_FEMININA = [
        'francisca', 'thalita', 'maria', 'luciana', 'leila', 'leticia', 'heloisa',
        'raquel', 'camila', 'vitoria', 'fernanda', 'clara', 'ana',
        'sofia', 'julia', 'beatriz', 'yara', 'joana', 'ines',
        'catarina', 'brenda', 'manuela', 'giovanna', 'female', 'feminina',
        'mulher', 'woman', 'google portugues do brasil'
    ];

    const NOMES_VOZ_MASCULINA = [
        'daniel', 'antonio', 'ricardo', 'thiago', 'tiago', 'felipe',
        'fabio', 'humberto', 'julio', 'nicolau', 'duarte',
        'cristiano', 'valerio', 'male', 'masculino', 'masculina', 'homem', 'man'
    ];

    function normalizarNomeVoz(str) {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function contemPalavraVoz(nomeNorm, termo) {
        return (' ' + nomeNorm + ' ').indexOf(' ' + termo + ' ') !== -1;
    }

    function selecionarVozFemininaPtBr() {
        if (vozesDisponiveis.length === 0) atualizarListaVozes();
        const ptVoices = vozesDisponiveis.filter(function (v) {
            return v && typeof v.lang === 'string' && v.lang.toLowerCase().indexOf('pt') === 0;
        });
        if (ptVoices.length === 0) return { voz: null, femininaConfirmada: false };

        let melhorVoz = null;
        let melhorScore = -999;
        let femininaConfirmada = false;

        ptVoices.forEach(function (v) {
            const langNorm = String(v.lang || '').toLowerCase();
            const nomeNorm = normalizarNomeVoz((v.name || '') + ' ' + (v.voiceURI || ''));
            let score = langNorm === 'pt-br' ? 20 : 10;

            const ehFem = NOMES_VOZ_FEMININA.some(function (n) {
                return contemPalavraVoz(nomeNorm, n);
            });
            const ehMasc = NOMES_VOZ_MASCULINA.some(function (n) {
                return contemPalavraVoz(nomeNorm, n);
            });

            if (ehFem) score += 100;
            if (ehMasc) score -= 120;
            if (contemPalavraVoz(nomeNorm, 'natural') || contemPalavraVoz(nomeNorm, 'neural') || contemPalavraVoz(nomeNorm, 'google')) {
                score += 15;
            }
            if (v.localService) score += 2;

            if (score > melhorScore) {
                melhorScore = score;
                melhorVoz = v;
                femininaConfirmada = ehFem;
            }
        });

        return { voz: melhorVoz, femininaConfirmada: femininaConfirmada };
    }

    function pararLeituraVoz() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        document.querySelectorAll('.maisa-speak-btn').forEach(function (b) {
            b.dataset.speaking = 'false';
            b.textContent = 'Ouvir';
        });
    }

    function falarTexto(texto, btn) {
        if (!('speechSynthesis' in window)) return;
        const jaFalando = btn.dataset.speaking === 'true';
        pararLeituraVoz();
        if (jaFalando) return;

        const utterance = new SpeechSynthesisUtterance(texto);
        const escolha = selecionarVozFemininaPtBr();
        if (escolha.voz) {
            utterance.voice = escolha.voz;
            utterance.lang = escolha.voz.lang || 'pt-BR';
        } else {
            utterance.lang = 'pt-BR';
        }
        utterance.rate = 0.92;
        utterance.pitch = escolha.femininaConfirmada ? 1.04 : 1.18;

        btn.dataset.speaking = 'true';
        btn.textContent = 'Parar';
        utterance.onend = function () {
            btn.dataset.speaking = 'false';
            btn.textContent = 'Ouvir';
        };
        utterance.onerror = function () {
            btn.dataset.speaking = 'false';
            btn.textContent = 'Ouvir';
        };
        window.speechSynthesis.speak(utterance);
    }

    function formatarMoeda(valor) {
        return 'R$ ' + Number(valor || 0).toFixed(2).replace('.', ',');
    }

    function rolarParaBaixo() {
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function limparOpcoesTemporarias() {
        const topics = document.getElementById('maisa-topics-list');
        if (topics) topics.remove();
        document.querySelectorAll('.maisa-chips').forEach(function (el) {
            el.remove();
        });
    }

    function criarBotaoChip(texto) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'maisa-chip';
        btn.textContent = texto;
        btn.addEventListener('click', function () {
            enviarMensagem(texto);
        });
        return btn;
    }

    function renderBoasVindas() {
        const limite = obterLimiteSugestoes();
        const listaBase = (sugestoesPersonalizadas && Array.isArray(sugestoesPersonalizadas.topicos))
            ? sugestoesPersonalizadas.topicos
            : TOPICOS_CATEGORIAS_SITE;
        const listaTopicos = listaBase.slice(0, limite);

        const saudacaoNome = userName ? ', ' + userName.split(' ')[0] : '';
        const textoBoasVindas = (sugestoesPersonalizadas && sugestoesPersonalizadas.saudacao)
            ? sugestoesPersonalizadas.saudacao
            : (listaTopicos.length > 0
                ? 'Olá' + saudacaoNome + '! Escolha uma categoria da loja abaixo ou digite o que você procura:'
                : 'Olá' + saudacaoNome + '! Digite o que você procura:');

        adicionarMensagemBot(textoBoasVindas, [], [], true);

        if (listaTopicos.length > 0) {
            const list = document.createElement('div');
            list.className = 'maisa-topics-list';
            list.id = 'maisa-topics-list';

            listaTopicos.forEach(function (item) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'maisa-topic-btn';
                btn.textContent = item.titulo;
                btn.addEventListener('click', function () {
                    enviarMensagem(item.pergunta);
                });
                list.appendChild(btn);
            });

            messagesEl.appendChild(list);
        }
        rolarParaBaixo();
    }

    function adicionarMensagemUsuario(texto) {
        const wrapper = document.createElement('div');
        wrapper.className = 'maisa-msg maisa-msg-user';

        const bubble = document.createElement('div');
        bubble.className = 'maisa-bubble';
        bubble.textContent = texto;

        wrapper.appendChild(bubble);
        messagesEl.appendChild(wrapper);
        rolarParaBaixo();
    }

    function criarCardProduto(produto) {
        const card = document.createElement('article');
        card.className = 'maisa-product-card';

        const top = document.createElement('div');
        top.className = 'maisa-product-top';

        const img = document.createElement('img');
        img.className = 'maisa-product-img';
        img.src = produto.imagem || '/imagens/foto.svg';
        img.alt = produto.nome;

        const info = document.createElement('div');
        info.className = 'maisa-product-info';

        const name = document.createElement('h3');
        name.className = 'maisa-product-name';
        name.textContent = produto.nome;

        const priceBox = document.createElement('div');
        priceBox.className = 'maisa-product-price-box';

        const price = document.createElement('span');
        price.className = 'maisa-product-price';

        if (produto.precoDesconto) {
            price.textContent = formatarMoeda(produto.precoDesconto);
            const oldSpan = document.createElement('span');
            oldSpan.className = 'maisa-product-old-price';
            oldSpan.textContent = formatarMoeda(produto.preco);
            priceBox.appendChild(price);
            priceBox.appendChild(oldSpan);
        } else {
            price.textContent = formatarMoeda(produto.preco);
            priceBox.appendChild(price);
        }

        info.appendChild(name);
        info.appendChild(priceBox);

        const fora = produto.status === 'fora-de-estoque';
        if (fora) {
            const outText = document.createElement('p');
            outText.className = 'maisa-product-out';
            outText.textContent = 'Indisponível no momento';
            info.appendChild(outText);
        }

        top.appendChild(img);
        top.appendChild(info);
        card.appendChild(top);

        if (produto.motivo) {
            const reason = document.createElement('p');
            reason.className = 'maisa-product-reason';
            reason.textContent = produto.motivo;
            card.appendChild(reason);
        }

        const actions = document.createElement('div');
        actions.className = 'maisa-product-actions';

        const verLink = document.createElement('a');
        verLink.className = 'maisa-card-link';
        verLink.href = '/produto/' + produto.id;
        verLink.textContent = 'Ver produto';
        actions.appendChild(verLink);

        const feedback = document.createElement('p');
        feedback.className = 'maisa-card-feedback';
        feedback.hidden = true;

        if (!isAdmin && !fora) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'maisa-card-cart';
            addBtn.textContent = 'Adicionar ao carrinho';
            addBtn.addEventListener('click', async function () {
                addBtn.disabled = true;
                addBtn.textContent = 'Adicionando...';
                try {
                    const resp = await fetch('/api/maisa/adicionar-carrinho/' + produto.id, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await resp.json();
                    feedback.hidden = false;
                    if (resp.ok && data.ok) {
                        feedback.classList.remove('is-error');
                        feedback.textContent = 'Adicionado ao carrinho (' + data.totalItens + ' no carrinho).';
                        addBtn.textContent = 'Adicionado';
                    } else {
                        feedback.classList.add('is-error');
                        feedback.textContent = data.erro || 'Não foi possível adicionar agora.';
                        addBtn.disabled = false;
                        addBtn.textContent = 'Adicionar ao carrinho';
                    }
                } catch (_) {
                    feedback.hidden = false;
                    feedback.classList.add('is-error');
                    feedback.textContent = 'Erro de conexão ao adicionar.';
                    addBtn.disabled = false;
                    addBtn.textContent = 'Adicionar ao carrinho';
                }
            });
            actions.appendChild(addBtn);
        }

        card.appendChild(actions);
        card.appendChild(feedback);
        return card;
    }

    function adicionarMensagemBot(texto, produtos, sugestoes, ehInicial) {
        const wrapper = document.createElement('div');
        wrapper.className = 'maisa-msg maisa-msg-bot';

        const bubble = document.createElement('div');
        bubble.className = 'maisa-bubble';
        bubble.textContent = texto;
        wrapper.appendChild(bubble);

        if (!ehInicial && 'speechSynthesis' in window) {
            const speakBtn = document.createElement('button');
            speakBtn.type = 'button';
            speakBtn.className = 'maisa-speak-btn';
            speakBtn.textContent = 'Ouvir';
            speakBtn.setAttribute('aria-label', 'Ouvir resposta da Maisa');
            speakBtn.addEventListener('click', function () {
                falarTexto(texto, speakBtn);
            });
            wrapper.appendChild(speakBtn);
        }

        if (Array.isArray(produtos) && produtos.length > 0) {
            const prodList = document.createElement('div');
            prodList.className = 'maisa-products-list';
            produtos.slice(0, 3).forEach(function (p) {
                prodList.appendChild(criarCardProduto(p));
            });
            wrapper.appendChild(prodList);
        }

        if (!ehInicial && Array.isArray(sugestoes) && sugestoes.length > 0) {
            const chips = document.createElement('div');
            chips.className = 'maisa-chips';
            sugestoes.slice(0, obterLimiteSugestoes()).forEach(function (s) {
                chips.appendChild(criarBotaoChip(s));
            });
            wrapper.appendChild(chips);
        }

        messagesEl.appendChild(wrapper);
        rolarParaBaixo();
    }

    function mostrarDigitando() {
        const el = document.createElement('div');
        el.className = 'maisa-typing';
        el.id = 'maisa-typing';
        el.setAttribute('role', 'status');
        el.textContent = 'Procurando...';
        messagesEl.appendChild(el);
        rolarParaBaixo();
    }

    function removerDigitando() {
        const el = document.getElementById('maisa-typing');
        if (el) el.remove();
    }

    async function enviarMensagem(textoParam) {
        if (enviando) return;
        const texto = (typeof textoParam === 'string' ? textoParam : input.value).trim();
        if (!texto) return;

        enviando = true;
        sendBtn.disabled = true;
        if (typeof textoParam !== 'string') {
            input.value = '';
        }

        clearBtn.hidden = false;
        limparOpcoesTemporarias();
        adicionarMensagemUsuario(texto);
        mostrarDigitando();

        try {
            const resp = await fetch('/api/maisa/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensagem: texto,
                    historico: historico,
                    limiteSugestoes: obterLimiteSugestoes(),
                    dispositivo: obterDispositivo()
                })
            });
            const data = await resp.json();
            removerDigitando();

            if (!resp.ok || !data.ok) {
                adicionarMensagemBot(
                    data.erro || 'Não consegui responder agora. Tente novamente em instantes.',
                    [],
                    ['Tentar novamente'],
                    false
                );
            } else {
                historico.push({ role: 'user', texto: texto });
                historico.push({ role: 'model', texto: data.resposta });
                if (historico.length > 12) {
                    historico = historico.slice(-12);
                }
                adicionarMensagemBot(data.resposta, data.produtos || [], data.sugestoes || [], false);
            }
        } catch (_) {
            removerDigitando();
            adicionarMensagemBot(
                'Sem conexão no momento. Verifique sua internet e tente novamente.',
                [],
                ['Tentar novamente'],
                false
            );
        } finally {
            enviando = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        enviarMensagem();
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            enviarMensagem();
        }
    });

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec && voiceBtn) {
        voiceBtn.hidden = false;
        recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = function () {
            ouvindoVoz = true;
            voiceBtn.classList.add('is-listening');
            voiceBtn.textContent = 'Parar';
            voiceBtn.setAttribute('aria-label', 'Parar gravação de voz');
            if (voiceStatus) voiceStatus.hidden = false;
        };

        recognition.onresult = function (event) {
            const transcricao = event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
            if (transcricao) {
                input.value = transcricao;
                enviarMensagem(transcricao);
            }
        };

        function resetarVoz() {
            ouvindoVoz = false;
            voiceBtn.classList.remove('is-listening');
            voiceBtn.textContent = 'Falar';
            voiceBtn.setAttribute('aria-label', 'Falar pelo microfone');
            if (voiceStatus) voiceStatus.hidden = true;
        }

        recognition.onerror = resetarVoz;
        recognition.onend = resetarVoz;

        voiceBtn.addEventListener('click', function () {
            if (ouvindoVoz) {
                recognition.stop();
            } else {
                pararLeituraVoz();
                recognition.start();
            }
        });
    }
})();
