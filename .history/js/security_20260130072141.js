import { db, doc, getDoc } from './firebase-config.js';

// Função visual para bloquear a tela
function bloquearAcesso(mensagem) {
    document.body.innerHTML = ''; 
    document.body.style.backgroundColor = "#000";
    document.body.style.display = "flex";
    document.body.style.flexDirection = "column";
    document.body.style.alignItems = "center";
    document.body.style.justifyContent = "center";
    document.body.style.height = "100vh";
    document.body.style.color = "white";
    document.body.style.fontFamily = "sans-serif";
    document.body.style.textAlign = "center";

    document.body.innerHTML = `
        <div style="font-size: 50px; margin-bottom: 20px;">🔒</div>
        <h1 style="color: #ef4444; font-size: 24px; margin-bottom: 10px;">Acesso Restrito</h1>
        <p style="color: #9ca3af;">${mensagem}</p>
    `;
    
    // Trava execução
    throw new Error(mensagem);
}

// AQUI ESTÁ O NOME QUE O SEU INDEX.HTML ESTÁ PROCURANDO
export async function verificarPermissaoDeAcesso() {
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('site');

    // 1. Se não tem ID na URL
    if (!siteId) {
        // Se for localhost e não tiver site, não bloqueia, deixa cair no fallback do index.html
        if(window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            return false; 
        }
        bloquearAcesso("Loja não identificada. Use o link correto.");
    }

    try {
        // 2. Busca o documento da loja no Firebase
        const docRef = doc(db, "sites", siteId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            bloquearAcesso("Esta loja não foi encontrada em nosso sistema.");
            return null;
        }

        const data = docSnap.data();

        // 3. Verifica se está Ativa
        if (data.status !== 'active' && data.status !== 'ativo') {
            bloquearAcesso("Esta loja encontra-se suspensa temporariamente.");
            return null;
        }

        // 4. Verifica Data de Validade (Trial ou Mensal)
        if (data.expiryDate) {
            const now = new Date();
            // Converte Timestamp do Firebase para Date JS, se necessário
            const expiry = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);

            if (now > expiry) {
                bloquearAcesso("O plano desta loja expirou. Entre em contato com o suporte.");
                return null;
            }
        }

        // TUDO CERTO! Retorna true/ID
        return siteId;

    } catch (error) {
        console.error("Erro de segurança:", error);
        bloquearAcesso("Erro ao validar licença de uso.");
        return null;
    }
}