document.addEventListener('DOMContentLoaded', function() {
    fetch("../cadastro/verificarsessao.php", {
        method: "GET",
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === false) {
            location.href = "../login/index.html";
        } else {
            carregarMensagens();
        }
    })
    .catch(error => console.error('Erro ao verificar sessão:', error));

    function carregarMensagens() {
        const listaMensagens = document.getElementById('mensagens-lista');

        if (!listaMensagens) {
            console.error('Elemento mensagens não encontrado');
            return;
        }

        fetch('buscar_mensagens.php')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro na solicitação. Código de status: ' + response.status);
                }
                return response.json();
            })
            .then(mensagens => {
                if (mensagens.length > 0) {
                    mensagens.forEach(mensagem => {
                        const mensagemItem = document.createElement('div');
                        mensagemItem.classList.add('message-item');
                        mensagemItem.innerHTML = `
                            <h2>${mensagem.remetenteNome || 'Remetente não identificado'}</h2>
                            <p>${mensagem.mensagem ? mensagem.mensagem.slice(0, 50) : 'Erro ao descriptografar a mensagem'}...</p>
                        `;
                        mensagemItem.addEventListener('click', () => abrirMensagemDetalhe(mensagem));
                        listaMensagens.appendChild(mensagemItem);
                    });
                } else {
                    listaMensagens.innerHTML = '<p>Nenhuma mensagem na caixa de entrada.</p>';
                }
            })
            .catch(error => console.error('Erro ao buscar mensagens:', error));
    }

    function abrirMensagemDetalhe(mensagem) {
        const mensagemDetalhe = document.getElementById('mensagem-detalhe');
        mensagemDetalhe.innerHTML = `
            <h2>De: ${mensagem.remetenteNome || 'Remetente não identificado'}</h2>
            <p>${mensagem.mensagem ? mensagem.mensagem : 'Erro ao descriptografar a mensagem'}</p>
            <p><strong>Enviado em:</strong> ${new Date(mensagem.data_envio).toLocaleString()}</p>
            <button class="contact-button" onclick="mostrarCaixaResposta(${mensagem.remetenteId}, '${mensagem.remetenteNome}')">Responder</button>
            <div id="resposta-container"></div>
        `;
    }

    window.mostrarCaixaResposta = function(destinatarioId, nomeCompleto) {
        const respostaContainer = document.getElementById('resposta-container');
        respostaContainer.innerHTML = `
            <textarea class="resposta-textarea" placeholder="Digite sua resposta aqui..."></textarea>
            <button class="send-button" onclick="enviarResposta(${destinatarioId}, this)">Enviar mensagem</button>
        `;
    }

    window.enviarResposta = async function(destinatarioId, botao) {
        const respostaContainer = botao.parentElement;
        const mensagem = respostaContainer.querySelector('textarea').value;

        if (mensagem.trim() === '') {
            alert('A mensagem não pode estar vazia.');
            return;
        }

        try {
            const response = await fetch('../cert/enviar_certificado.php');
            if (!response.ok) {
                throw new Error('Erro ao carregar o certificado');
            }
            const certText = await response.text();
            const publicKey = extractPublicKey(certText);

            const encrypt = new JSEncrypt();
            encrypt.setPublicKey(publicKey);
            const secretKey = generateSecretKey();
            console.log('Chave secreta gerada: ', secretKey);
            const encryptedSecretKey = encrypt.encrypt(secretKey);
            console.log('Chave secreta criptografada: ', encryptedSecretKey);

            // Geração do IV
            const iv = CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
            const encryptedMessage = CryptoJS.AES.encrypt(mensagem, CryptoJS.enc.Hex.parse(secretKey), { iv: CryptoJS.enc.Hex.parse(iv) }).toString();
            console.log('Mensagem criptografada: ', encryptedMessage);

            const encryptedData = {
                destinatarioId: destinatarioId,
                data: encryptedSecretKey,
                iv: iv,
                mensagem: encryptedMessage
            };

            const enviarResponse = await fetch('enviar_mensagem.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(encryptedData)
            });
            const result = await enviarResponse.json();

            if (result.success) {
                alert('Mensagem enviada com sucesso!');
                respostaContainer.innerHTML = '';
            } else {
                alert('Erro ao enviar mensagem: ' + result.error);
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
    }

    function extractPublicKey(cert) {
        const certificate = forge.pki.certificateFromPem(cert);
        const publicKey = forge.pki.publicKeyToPem(certificate.publicKey);
        return publicKey;
    }

    function generateSecretKey() {
        return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    }
});
