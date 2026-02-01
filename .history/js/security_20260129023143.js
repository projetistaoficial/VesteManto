import { db, doc, getDoc } from './firebase-config.js';

// 1. Mantenha a função de interface no topo
function exibirTelaBloqueio(mensagem) {
    // Se já existir um bloqueio, não cria outro
    if (document.getElementById('bloqueio-saas')) return;

    const overlay = document.createElement('div');
    overlay.id = "bloqueio-saas";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; align-items:center; justify-content:center; color:white; text-align:center; font-family:sans-serif; padding:20px;";
    overlay.innerHTML = `
        <div style="max-width: 500px;">
            <h1 style="font-size:35px; color:#facc15; font-weight:bold;">ACESSO RESTRITO</h1>
            <p style="margin:20px 0; color:#ccc; font-size:18px;">${mensagem}</p>
            <a href="https://wa.me/SEU_NUMERO" target="_blank" style="display:inline-block; background:#25d366; padding:15px 30px; border-radius:8px; color:white; text-decoration:none; font-weight:bold; font-size:16px;">
                <i class="fab fa-whatsapp"></i> Falar com Suporte
            </a>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Pequeno atraso para garantir que o DOM pare
    setTimeout(() => { window.stop(); }, 100);
}

// 2. A lógica de verificação
export async function verificarStatusLoja(siteId) {
    if (!siteId) {
        exibirTelaBloqueio("Por favor, acesse através de um link válido.");
        return false;
    }

    try {
        const siteRef = doc(db, "sites", siteId);
        const siteSnap = await getDoc(siteRef);

        if (siteSnap.exists()) {
            const dados = siteSnap.data();

            // Verifica Status Ativo/Inativo
            if (dados.status !== 'ativo') {
                exibirTelaBloqueio(dados.mensagemSuspensao || "Este sistema está temporariamente suspenso.");
                return false;
            }

            // Verifica Expiração de Trial (7 dias)
            if (dados.trialExpires) {
                const dataExp = dados.trialExpires.toDate ? dados.trialExpires.toDate() : new Date(dados.trialExpires);
                if (new Date() > dataExp) {
                    exibirTelaBloqueio("Seu período de teste expirou. Entre em contato para ativar sua licença!");
                    return false;
                }
            }

            return true; // LIBERADO!
        } else {
            exibirTelaBloqueio("Loja não encontrada em nossa base de dados.");
            return false;
        }
    } catch (error) {
        console.error("Erro na verificação:", error);
        // Se der erro de permissão no Firebase, ele cai aqui
        exibirTelaBloqueio("Erro de conexão com o servidor de segurança.");
        return false;
    }
}