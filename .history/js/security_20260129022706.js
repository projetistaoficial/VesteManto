import { db, doc, getDoc } from './firebase-config.js';

// Certifique-se de que esta função NÃO tenha a palavra "export" antes dela, 
// para que ela seja uma função interna do arquivo.
function exibirTelaBloqueio(mensagem) {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; align-items:center; justify-content:center; color:white; text-align:center; font-family:sans-serif; padding:20px;";
    overlay.innerHTML = `
        <div>
            <h1 style="font-size:30px; color:#facc15;">ACESSO RESTRITO</h1>
            <p style="margin:20px 0; color:#ccc;">${mensagem}</p>
            <a href="https://wa.me/SEU_NUMERO" style="background:#25d366; padding:10px 20px; border-radius:5px; color:white; text-decoration:none; font-weight:bold;">Falar com Suporte</a>
        </div>
    `;
    document.body.appendChild(overlay);
    // IMPORTANTE: Não use window.stop() aqui se quiser ver os logs do console, 
    // mas em produção ele ajuda a travar tudo.
}



export async function verificarStatusLoja(siteId) {
    if (!siteId) return false;

    const siteRef = doc(db, "sites", siteId);
    const siteSnap = await getDoc(siteRef);

    if (siteSnap.exists()) {
        const dados = siteSnap.data();
        const agora = new Date();

        // 1. Verifica se está inativo manualmente pelo Master
        if (dados.status !== 'ativo') {
            exibirTelaBloqueio(dados.mensagemSuspensao || "Acesso suspenso pelo administrador.");
            return false;
        }

        // 2. Verifica se o período de teste (trial) venceu
        if (dados.trialExpires) {
            // Se o trialExpires for um Timestamp do Firebase, usamos .toDate()
            const dataExpiracao = dados.trialExpires.toDate ? dados.trialExpires.toDate() : new Date(dados.trialExpires);
            
            if (agora > dataExpiracao) {
                exibirTelaBloqueio("Seu período de teste de 7 dias expirou. Entre em contato para ativar o plano oficial!");
                return false;
            }
        }

        return true; // Tudo ok!
    }
    
    exibirTelaBloqueio("Loja não encontrada em nossa base de dados.");
    return false;
}