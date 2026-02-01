import { db, doc, getDoc } from './firebase-config.js';

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