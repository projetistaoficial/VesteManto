import { db, doc, setDoc } from './firebase-config.js';

window.gerarLinkTrial = async () => {
    const nome = document.getElementById('new-store-name').value;
    const siteId = document.getElementById('new-store-id').value.trim().toLowerCase();
    const displayLink = document.getElementById('display-link-gerado');

    if (!nome || !siteId) {
        alert("Preencha o nome e o ID da loja!");
        return;
    }

    // Calcula a data de expiração (Hoje + 7 dias)
    const seteDiasEmMs = 7 * 24 * 60 * 60 * 1000;
    const dataExpiracao = new Date(Date.now() + seteDiasEmMs);

    try {
        // Salva o novo cliente no Firestore
        await setDoc(doc(db, "sites", siteId), {
            nome: nome,
            status: 'ativo',
            criadoEm: new Date(),
            trialExpires: dataExpiracao, // Campo importante para a trava
            tipoPlano: 'trial'
        });

        // Gera o link (ajuste o domínio para o seu real quando fizer o deploy)
        const linkFinal = `${window.location.origin}/index.html?site=${siteId}`;
        
        displayLink.innerHTML = `
            <p class="text-green-400 mb-1">Loja criada com sucesso! Expira em: ${dataExpiracao.toLocaleDateString('pt-BR')}</p>
            <strong class="text-white">${linkFinal}</strong>
        `;
        displayLink.classList.remove('hidden');

    } catch (error) {
        console.error("Erro ao gerar trial:", error);
        alert("Erro ao salvar no banco de dados.");
    }
};