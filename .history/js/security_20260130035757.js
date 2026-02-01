import { db, doc, getDoc } from './firebase-config.js';

// Função visual de bloqueio
function exibirTelaBloqueio(mensagem) {
    document.body.innerHTML = ''; // Limpa o site inteiro
    document.body.style.backgroundColor = "#111";
    document.body.style.color = "#fff";
    document.body.style.fontFamily = "sans-serif";
    document.body.style.display = "flex";
    document.body.style.flexDirection = "column";
    document.body.style.alignItems = "center";
    document.body.style.justifyContent = "center";
    document.body.style.height = "100vh";

    const div = document.createElement('div');
    div.style.textAlign = "center";
    div.innerHTML = `
        <h1 style="color: #facc15; font-size: 2rem; margin-bottom: 1rem;">ACESSO RESTRITO</h1>
        <p style="color: #ccc; font-size: 1.2rem;">${mensagem}</p>
        <a href="#" style="margin-top: 2rem; display: inline-block; color: #3b82f6; text-decoration: underline;">Entrar em contato com suporte</a>
    `;
    document.body.appendChild(div);
    
    // Para a execução de scripts
    throw new Error("Acesso negado: " + mensagem);
}

// Função Principal de Verificação
export async function validarAcessoLoja() {
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('site');

    if (!siteId) {
        exibirTelaBloqueio("Link incompleto. Nenhuma loja especificada.");
        return null;
    }

    try {
        const docRef = doc(db, "sites", siteId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const dados = docSnap.data();

            // 1. Verifica se está ativo
            if (dados.status !== 'ativo') {
                exibirTelaBloqueio("Esta loja encontra-se suspensa.");
                return null;
            }

            // 2. Verifica validade (Trial/Mensal)
            if (dados.trialExpires) {
                const validade = dados.trialExpires.toDate ? dados.trialExpires.toDate() : new Date(dados.trialExpires);
                if (new Date() > validade) {
                    exibirTelaBloqueio("O período de licença desta loja expirou.");
                    return null;
                }
            }

            // Se passou por tudo, retorna o ID para o app.js usar
            return siteId;

        } else {
            exibirTelaBloqueio("Loja não encontrada.");
            return null;
        }

    } catch (error) {
        console.error("Erro Firebase:", error);
        exibirTelaBloqueio("Erro de conexão com o servidor.");
        return null;
    }
}