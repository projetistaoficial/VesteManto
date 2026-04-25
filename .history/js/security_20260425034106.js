import { db, doc, getDoc } from './firebase-config.js';

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
    throw new Error(mensagem);
}

export async function verificarPermissaoDeAcesso() {
    // 1. Tenta pegar o ID do window (definido no index.html da nuvem) ou da URL (Localhost)
    let siteId = window.SITE_ID;

    if (!siteId) {
        const urlParams = new URLSearchParams(window.location.search);
        siteId = urlParams.get('site');
    }

    // 2. Se não tem ID e não é localhost, bloqueia
    if (!siteId) {
        if(window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
            return false; 
        }
        bloquearAcesso("Loja não identificada.");
        return null;
    }

    try {
        const docRef = doc(db, "sites", siteId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            bloquearAcesso("Loja não encontrada.");
            return null;
        }

        const data = docSnap.data();

        // Verifica status (aceita 'active', 'ativo' ou 'pausado')
        // Se estiver 'pausado', o app.js vai tratar a tela amarela depois
        const statusValido = ['active', 'ativo', 'pausado'].includes(data.status?.toLowerCase());
        
        if (!statusValido && data.active !== true) {
            bloquearAcesso("Esta loja encontra-se suspensa.");
            return null;
        }

        return siteId;

    } catch (error) {
        console.error("Erro de segurança:", error);
        return null;
    }
}