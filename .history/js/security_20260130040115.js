import { db, doc, getDoc } from './firebase-config.js';

// Função que desenha a tela de bloqueio
function blockAccess(message) {
    document.body.innerHTML = ''; // Apaga o site inteiro
    document.body.style.backgroundColor = "#0f172a";
    document.body.style.display = "flex";
    document.body.style.alignItems = "center";
    document.body.style.justifyContent = "center";
    document.body.style.height = "100vh";
    document.body.style.color = "white";
    document.body.style.fontFamily = "sans-serif";

    document.body.innerHTML = `
        <div style="text-align:center; max-width:400px; padding:20px;">
            <div style="font-size:50px; margin-bottom:20px;">🔒</div>
            <h1 style="font-size:24px; font-weight:bold; color:#ef4444; margin-bottom:10px;">Acesso Suspenso</h1>
            <p style="color:#94a3b8; line-height:1.5;">${message}</p>
            <a href="#" style="display:inline-block; margin-top:20px; color:#3b82f6; text-decoration:none; border:1px solid #3b82f6; padding:10px 20px; border-radius:5px;">Entrar em Contato</a>
        </div>
    `;
    
    // Lança erro para parar a execução do JavaScript restante
    throw new Error("Loja Bloqueada: " + message);
}

export async function validateStoreAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('site');

    // 1. Se não tem ID na URL, mostra erro ou redireciona
    if (!siteId) {
        blockAccess("Loja não especificada. Verifique o link.");
        return null;
    }

    try {
        // 2. Busca o documento Mestre da loja
        const docRef = doc(db, "sites", siteId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            blockAccess("Loja não encontrada em nossa base de dados.");
            return null;
        }

        const data = docSnap.data();

        // 3. Verifica se está ativada manualmente
        if (data.status !== 'active') {
            blockAccess("Esta loja foi desativada temporariamente pelo administrador.");
            return null;
        }

        // 4. Verifica Validade (Trial/Mensal)
        if (data.expiryDate) {
            const now = new Date();
            // Converte Timestamp do Firebase para Date do JS
            const expiry = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);

            if (now > expiry) {
                blockAccess("O período de assinatura desta loja expirou.");
                return null;
            }
        }

        // Se passou por tudo, retorna o ID validado
        return siteId;

    } catch (error) {
        console.error("Erro de segurança:", error);
        blockAccess("Erro de conexão. Tente recarregar.");
        return null;
    }
}