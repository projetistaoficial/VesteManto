import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// === CONFIGURAÇÃO FIREBASE ===
const firebaseConfig = {
    apiKey: "AIzaSyD_pZ7lWPQA1OniOJrjTinG2HN5UhjMzbI",
    authDomain: "vestemanto-app.firebaseapp.com",
    projectId: "vestemanto-app",
    storageBucket: "vestemanto-app.appspot.com",
    messagingSenderId: "340174016008",
    appId: "1:340174016008:web:301a01750404af8b5a8bbd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Adicione o /master no final do domínio de produção
const PRODUCTION_DOMAIN = "https://projetistaoficial.com";

// Variáveis de controle
let pendingClientStatus = 'ativo';
let pendingClientActive = true;
let currentCodeDisplay = 'code';
let currentSortDirection = 'asc';

let allClients = [];
let currentDocId = null;
let currentClientOrders = [];
let currentClientProducts = [];

let isClientSelectionMode = false;
let selectedClients = new Set();

const listContainer = document.getElementById('clients-list');
const clientModal = document.getElementById('client-modal');

window.addEventListener('DOMContentLoaded', () => {
    loadClients();

    window.openClientModal = openClientModal;
    window.closeClientModal = closeClientModal;
    window.switchTab = switchTab;
    window.saveClientData = saveClientData;
    window.changeClientStatus = changeClientStatus;
    window.deleteCurrentClient = deleteCurrentClient;
    window.generateSiteLink = generateSiteLink;
    window.copyToClipboard = copyToClipboard;
    window.applyFinancialFilter = applyFinancialFilter;
    window.filtrarFinanceiro = applyFinancialFilter;

    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', (e) => filterClients(e.target.value));

    // ✨ O Piloto Automático que bagunçava as datas foi apagado daqui!
});

// --- CARREGAR LISTA ---
async function loadClients() {
    listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Carregando...</div>';
    try {
        const snap = await getDocs(collection(db, "sites"));
        allClients = [];
        snap.forEach(doc => allClients.push({ docId: doc.id, ...doc.data() }));
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));

        updateClientCounters();
        refreshClientList();
    } catch (e) {
        console.error("Erro ao carregar clientes", e);
    }
}

// --- RENDERIZAR CLIENTES ---
function renderClients(clients) {
    listContainer.innerHTML = '';

    if (isClientSelectionMode) {
        const controlsBar = document.createElement('div');
        controlsBar.className = "flex flex-wrap justify-between items-center bg-[#161821] p-3 rounded-t-lg border-b border-gray-800 mb-2 gap-2 sticky top-0 z-10 shadow-md";

        const count = selectedClients.size;
        const allSelected = clients.length > 0 && clients.every(c => selectedClients.has(c.docId));

        controlsBar.innerHTML = `
            <div class="flex items-center gap-3 pl-2">
                <input type="checkbox" id="master-check-clients" onchange="toggleSelectAllClients(this)" ${allSelected ? 'checked' : ''} class="cursor-pointer w-5 h-5 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0">
                <label for="master-check-clients" class="text-sm text-gray-400 font-bold uppercase tracking-wider cursor-pointer select-none hover:text-white transition">Selecionar Todos</label>
            </div>
            <div class="flex items-center gap-2">
                ${count > 0 ? `
                    <span class="text-white text-xs font-bold bg-blue-600 px-3 py-2 rounded">${count} Loja${count > 1 ? 's' : ''}</span>
                    <button onclick="bulkChangeStatus('ativo')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm"><i class="fas fa-play"></i> Ativar</button>
                    <button onclick="bulkChangeStatus('pausado')" class="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm"><i class="fas fa-pause"></i> Pausar</button>
                    <button onclick="bulkChangeStatus('bloqueado')" class="bg-red-900 hover:bg-red-800 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 border border-red-700 shadow-sm"><i class="fas fa-lock"></i> Bloquear</button>
                    <div class="w-px h-6 bg-gray-700 mx-1"></div>
                    <button onclick="bulkDeleteClients()" class="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm"><i class="fas fa-trash"></i> Excluir</button>
                ` : `<span class="text-gray-500 text-xs font-bold px-3 py-2">Selecione clientes para ver as ações</span>`}
            </div>
        `;
        listContainer.appendChild(controlsBar);
    }

    if (clients.length === 0) {
        listContainer.innerHTML += '<div class="text-center text-gray-500 mt-10 text-sm py-8 bg-[#161821] rounded-lg">Nenhum cliente encontrado</div>';
        return;
    }

    clients.forEach(client => {
        let badgeColor = 'text-green-500 bg-green-900/20 border-green-900';
        let statusText = 'ATIVO';

        if (client.status === 'pausado') {
            badgeColor = 'text-yellow-500 bg-yellow-900/20 border-yellow-900';
            statusText = 'PAUSADO';
        } else if (client.status === 'bloqueado' || client.active === false) {
            badgeColor = 'text-red-500 bg-red-900/20 border-red-900';
            statusText = 'BLOQUEADO';
        }

        const isChecked = selectedClients.has(client.docId) ? 'checked' : '';
        const bgClass = selectedClients.has(client.docId) ? 'bg-blue-900/20 border-blue-900/50' : 'bg-[#161821] border-gray-800 hover:bg-[#1e2029]';
        
        // --- GERADOR DAS DUAS URLs (À PROVA DE SERVIDOR) ---
        const baseUrl = PRODUCTION_DOMAIN.endsWith('/') ? PRODUCTION_DOMAIN.slice(0, -1) : PRODUCTION_DOMAIN;
        
        // Link Vitrine: Limpo e público
        const linkVitrine = `${baseUrl}/${client.docId}`;
        
        // Link Admin: Usando a cerquilha (#) que o servidor não consegue apagar!
        const linkAdmin = `${baseUrl}/${client.docId}#admin`;
        
        const docText = (client.ownerData && client.ownerData.doc) ? client.ownerData.doc : (client.cpf || client.cnpj || 'Sem Documento');

        const row = document.createElement('div');
        row.className = `grid grid-cols-12 gap-3 px-4 py-4 ${bgClass} border-b items-center cursor-pointer transition rounded mb-1 select-none`;

        row.onclick = (e) => {
            if (isClientSelectionMode) {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'I') {
                    toggleClientSelection(client.docId);
                }
            } else {
                if (!e.target.closest('a') && !e.target.closest('button')) openClientModal(client.docId);
            }
        };

        const displayCode = currentCodeDisplay === 'code' ? (client.code || '#') : (client.altCode || '#');

        const firstCol = isClientSelectionMode
            ? `<div class="col-span-1 flex justify-start pl-1"><input type="checkbox" class="w-5 h-5 cursor-pointer pointer-events-none rounded border-gray-600 text-blue-500" ${isChecked}></div>`
            : `<div class="col-span-1 text-center text-blue-400 font-bold text-sm bg-[#0f1014] rounded border border-gray-700 mx-2 py-0.5">${displayCode}</div>`;

        row.innerHTML = `
            ${firstCol}
            <div class="col-span-3 font-bold text-white truncate text-base" title="${client.name || ''}">${client.name || 'Sem Nome'}</div>
            <div class="col-span-2 text-center text-gray-300 text-sm font-mono truncate" title="${docText}">${docText}</div>
            
            <div class="col-span-3 flex flex-col gap-1.5 justify-center pr-2">
                 
                 <div class="flex items-center justify-between bg-blue-900/10 px-2 py-1 rounded border border-blue-900/40 hover:border-blue-500/50 transition">
                     <a href="${linkVitrine}" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-blue-400 font-bold hover:underline flex-1 truncate tracking-wide" title="Abrir Loja">
                         <i class="fas fa-store mr-1"></i> LOJA
                     </a>
                     <button onclick="event.stopPropagation(); copyToClipboard('${linkVitrine}')" class="text-gray-500 hover:text-blue-400 transition ml-2" title="Copiar Link da Loja">
                         <i class="far fa-copy text-xs"></i>
                     </button>
                 </div>

                 <div class="flex items-center justify-between bg-yellow-900/10 px-2 py-1 rounded border border-yellow-900/40 hover:border-yellow-500/50 transition">
                     <a href="${linkAdmin}" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-yellow-500 font-bold hover:underline flex-1 truncate tracking-wide" title="Acesso do Vendedor">
                         <i class="fas fa-lock mr-1"></i> ADMIN
                     </a>
                     <button onclick="event.stopPropagation(); copyToClipboard('${linkAdmin}')" class="text-gray-500 hover:text-yellow-500 transition ml-2" title="Copiar Link do Admin">
                         <i class="far fa-copy text-xs"></i>
                     </button>
                 </div>

            </div>

            <div class="col-span-1 text-center text-gray-400 text-[10px] truncate">${client.plan?.name || '30 dias'}</div>
            <div class="col-span-2 text-center"><span class="${badgeColor} border px-2 py-1.5 rounded text-xs font-bold uppercase block w-full max-w-[100px] mx-auto truncate">${statusText}</span></div>
        `;
        listContainer.appendChild(row);
    });
}

// --- ABRIR MODAL ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    clientModal.classList.remove('translate-y-full');

    document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toLocaleDateString('pt-BR');

    resetFinancialUI();

    if (docId) {
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name || 'Editar';
            document.getElementById('inp-id').value = client.code || '';
            document.getElementById('inp-alt-code').value = client.altCode || '';
            document.getElementById('inp-name').value = client.name || '';
            document.getElementById('inp-site-slug').value = client.docId || '';
            document.getElementById('inp-site-slug').disabled = true;
            document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}/${client.docId}`;


            // --- CARREGAR DADOS DO PLANO ---
            const plan = client.plan || {};
            document.getElementById('plan-period').value = plan.period || '30';
            document.getElementById('plan-value').value = formatForInput(plan.value);
            document.getElementById('plan-next-due').value = plan.nextDue || '';

            document.getElementById('conf-carencia-active').checked = plan.carenciaActive || false;
            document.getElementById('conf-carencia-days').value = plan.carenciaDays || 4;
            document.getElementById('conf-carencia-action').value = plan.carenciaAction || 'pausar';
            document.getElementById('conf-auto-unlock').checked = plan.autoUnlock !== false; // Padrão é true
            document.getElementById('conf-auto-delete').checked = plan.autoDelete || false;
            document.getElementById('conf-delete-days').value = plan.deleteDays || 30;

            // Carrega as faturas daquele cliente
            loadInvoices(client.docId);

            if (client.createdAt) {
                const dataCriacao = new Date(client.createdAt);
                document.getElementById('inp-date').value = dataCriacao.toLocaleDateString('pt-BR');
            } else {
                document.getElementById('inp-date').value = "--/--/----";
            }

            const owner = client.ownerData || {};
            document.getElementById('inp-owner').value = owner.name || client.ownerName || '';
            document.getElementById('inp-doc').value = owner.doc || client.cpf || client.cnpj || '';
            document.getElementById('inp-insta').value = owner.insta || client.instagram || '';
            document.getElementById('inp-face').value = owner.face || client.facebook || '';
            document.getElementById('inp-yt').value = owner.yt || client.youtube || '';
            document.getElementById('inp-tel').value = owner.tel || client.phone || client.whatsapp || '';
            document.getElementById('inp-whats').value = owner.whats || client.whatsapp || '';
            document.getElementById('inp-email').value = owner.email || client.email || '';

            const address = client.address || {};
            if (document.getElementById('inp-cep')) document.getElementById('inp-cep').value = address.cep || '';
            if (document.getElementById('inp-rua')) document.getElementById('inp-rua').value = address.rua || '';
            if (document.getElementById('inp-numero')) document.getElementById('inp-numero').value = address.numero || '';
            if (document.getElementById('inp-complemento')) document.getElementById('inp-complemento').value = address.complemento || '';
            if (document.getElementById('inp-bairro')) document.getElementById('inp-bairro').value = address.bairro || '';
            if (document.getElementById('inp-cidade')) document.getElementById('inp-cidade').value = address.cidade || '';
            if (document.getElementById('inp-uf')) document.getElementById('inp-uf').value = address.uf || '';

            const access = client.access || {};
            const elPassAdmin = document.getElementById('inp-pass-admin');
            const elPassDev = document.getElementById('inp-pass-dev');
            if (elPassAdmin) elPassAdmin.value = access.admin || '';
            if (elPassDev) elPassDev.value = access.dev || '';

            // ✨ CARREGA O ESCUDO DE IMUNIDADE DO BANCO DE DADOS
            window.manualOverrideFlag = client.manualOverride || false;

            pendingClientStatus = client.status || 'ativo';
            pendingClientActive = client.active !== false;

            // ✨ XERIFE INSTANTÂNEO (AO ABRIR)
            if (plan.nextDue && pendingClientStatus === 'ativo') {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const venc = new Date(plan.nextDue + "T12:00:00");
                venc.setHours(0, 0, 0, 0);

                if (hoje > venc) {
                    const diffDays = Math.ceil(Math.abs(hoje - venc) / (1000 * 60 * 60 * 24));
                    const carenciaAtiva = plan.carenciaActive === true || String(plan.carenciaActive).toLowerCase() === "true";

                    // 🔥 REGRA ABSOLUTA: Só pune se a caixinha estiver marcada
                    if (carenciaAtiva) {
                        const carenciaDias = parseInt(plan.carenciaDays) || 0;

                        if (diffDays > carenciaDias) {
                            let action = plan.carenciaAction || 'pausado';
                            if (action === 'pausar') action = 'pausado';
                            if (action === 'bloquear') action = 'bloqueado';

                            pendingClientStatus = action;
                            pendingClientActive = action === 'bloqueado' ? false : true;
                        }
                    }
                }
            }

            updateStatusBadge(pendingClientStatus, pendingClientActive);
            renderActionButtons(pendingClientStatus, pendingClientActive);
            loadFinancials(docId);


        }
    } else {
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();

        // --- RESETAR PLANO (Novo Cliente) ---
        document.getElementById('plan-period').value = '30';
        document.getElementById('plan-value').value = '';
        document.getElementById('plan-next-due').value = '';
        document.getElementById('invoice-list-body').innerHTML = '<div class="text-center p-4 text-gray-500 text-xs italic w-full">Salve o cliente para gerar faturas.</div>';
        document.getElementById('plan-total-paid').innerText = 'R$ 0,00';

        if (document.getElementById('plan-paid-count')) {
            document.getElementById('plan-paid-count').innerText = '0';
        };

        // ✨ PREPARA O TERRENO PARA O PLANO OBRIGATÓRIO
        const planBadge = document.getElementById('plan-status-badge');
        if (planBadge) {
            planBadge.className = "w-full bg-[#0f1014] border-2 border-dashed border-gray-600 text-gray-400 font-bold uppercase text-[10px] rounded p-3 text-center transition-colors";
            planBadge.innerText = "AGUARDANDO PLANO";
        }

        // Exibe o botão e zera a lista
        const btnCriarPlano = document.getElementById('btn-criar-plano');
        if (btnCriarPlano) btnCriarPlano.classList.remove('hidden');

        document.getElementById('invoice-list-body').innerHTML = '<div class="text-center p-4 text-gray-500 text-xs italic w-full">Clique em Criar Plano para gerar a primeira fatura.</div>';

        window.planGeneratedInUI = false;

        // Pega o maior codigo alternativo pra somar +1 pro novo
        const maxCode = allClients.reduce((max, c) => Math.max(max, parseInt(c.altCode) || 0), 0);
        document.getElementById('inp-alt-code').value = maxCode + 1;

        pendingClientStatus = 'ativo';
        pendingClientActive = true;

        renderActionButtons(pendingClientStatus, pendingClientActive);
        updateStatusBadge(pendingClientStatus, pendingClientActive);

    }
    switchTab('cadastro');
}

// --- SALVAR DADOS ---
async function saveClientData() {
    // 1. CAPTURA DOS CAMPOS
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim(); 
    const docInput = document.getElementById('inp-doc').value.trim(); 
    const telInput = document.getElementById('inp-tel').value.trim(); 
    const passAdmin = document.getElementById('inp-pass-admin').value.trim();
    const passDev = document.getElementById('inp-pass-dev').value.trim();

    // 2. VERIFICAÇÕES (VALIDAÇÃO)
    if (!name) return alert("⚠️ O campo 'Nome da Loja' é obrigatório.");
    if (!slug) return alert("⚠️ O 'Slug do Site' é obrigatório.");
    if (!docInput) return alert("⚠️ É necessário informar um CPF ou CNPJ.");
    if (!telInput) return alert("⚠️ O número de telefone/WhatsApp é obrigatório.");
    if (!passAdmin || !passDev) return alert("⚠️ Defina as senhas de Admin e Desenvolvedor.");
    if (passAdmin === passDev) return alert("❌ Segurança: A senha de Admin e a de Desenvolvedor NÃO podem ser iguais.");

    // ✨ TRAVA: OBRIGA A CRIAR O PLANO ANTES DE SALVAR (Somente para clientes novos)
    if (!currentDocId && !window.planGeneratedInUI) {
        alert("⚠️ Informe o Plano do Cliente (Vá na aba Assinatura e clique em Criar Plano).");
        return; 
    }

    const docId = currentDocId || slug;
    const elPassAdmin = document.getElementById('inp-pass-admin');
    const elPassDev = document.getElementById('inp-pass-dev');

    let oldAltCode = null;
    if (currentDocId) {
        const existing = allClients.find(c => c.docId === docId);
        oldAltCode = existing ? (parseInt(existing.altCode) || null) : null;
    }

    let inputAltCode = parseInt(document.getElementById('inp-alt-code').value);
    if (isNaN(inputAltCode) || inputAltCode < 1) {
        if (oldAltCode) {
            inputAltCode = oldAltCode;
        } else {
            const maxCode = allClients.reduce((max, c) => Math.max(max, parseInt(c.altCode) || 0), 0);
            inputAltCode = maxCode + 1;
        }
    }

    // Pegando os dados da nova aba de Assinatura
    const planData = {
        period: document.getElementById('plan-period').value,
        value: parseCurrencyVal(document.getElementById('plan-value').value),
        nextDue: document.getElementById('plan-next-due').value,
        carenciaActive: document.getElementById('conf-carencia-active').checked,
        carenciaDays: parseInt(document.getElementById('conf-carencia-days').value) || 4,
        carenciaAction: document.getElementById('conf-carencia-action').value,
        autoUnlock: document.getElementById('conf-auto-unlock').checked,
        autoDelete: document.getElementById('conf-auto-delete').checked,
        deleteDays: parseInt(document.getElementById('conf-delete-days').value) || 30
    };

    let finalStatus = pendingClientStatus;
    let finalActive = pendingClientActive;

    if (planData.nextDue && finalStatus === 'ativo') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(planData.nextDue + "T12:00:00");
        venc.setHours(0, 0, 0, 0);

        if (hoje > venc) {
            const diffDays = Math.ceil(Math.abs(hoje - venc) / (1000 * 60 * 60 * 24));
            const carenciaAtiva = planData.carenciaActive === true || String(planData.carenciaActive).toLowerCase() === "true";

            if (carenciaAtiva) {
                const carenciaDias = parseInt(planData.carenciaDays) || 0;
                if (diffDays > carenciaDias) {
                    let action = planData.carenciaAction || 'pausado';
                    if (action === 'pausar') action = 'pausado';
                    if (action === 'bloquear') action = 'bloqueado';

                    finalStatus = action;
                    finalActive = action === 'bloqueado' ? false : true;

                    pendingClientStatus = finalStatus;
                    pendingClientActive = finalActive;
                    updateStatusBadge(finalStatus, finalActive);
                    renderActionButtons(finalStatus, finalActive);
                }
            }
        }
    }

    const data = {
        name: name,
        altCode: inputAltCode,
        status: finalStatus,
        active: finalActive,
        ownerData: {
            name: document.getElementById('inp-owner').value.trim(),
            doc: document.getElementById('inp-doc').value.trim(),
            insta: document.getElementById('inp-insta').value.trim(),
            face: document.getElementById('inp-face').value.trim(),
            yt: document.getElementById('inp-yt').value.trim(),
            tel: document.getElementById('inp-tel').value.trim(),
            whats: document.getElementById('inp-whats').value.trim(),
            email: document.getElementById('inp-email').value.trim()
        },
        address: {
            cep: document.getElementById('inp-cep') ? document.getElementById('inp-cep').value.trim() : '',
            rua: document.getElementById('inp-rua') ? document.getElementById('inp-rua').value.trim() : '',
            numero: document.getElementById('inp-numero') ? document.getElementById('inp-numero').value.trim() : '',
            complemento: document.getElementById('inp-complemento') ? document.getElementById('inp-complemento').value.trim() : '',
            bairro: document.getElementById('inp-bairro') ? document.getElementById('inp-bairro').value.trim() : '',
            cidade: document.getElementById('inp-cidade') ? document.getElementById('inp-cidade').value.trim() : '',
            uf: document.getElementById('inp-uf') ? document.getElementById('inp-uf').value.trim().toUpperCase() : ''
        },
        access: {
            admin: elPassAdmin ? elPassAdmin.value.trim() : '',
            dev: elPassDev ? elPassDev.value.trim() : ''
        },
        plan: planData
    };

    if (!currentDocId) {
        data.code = parseInt(document.getElementById('inp-id').value);
        data.createdAt = new Date().toISOString();
    }

    try {
        await setDoc(doc(db, "sites", docId), data, { merge: true });

        // Gera a primeira fatura automaticamente caso não exista nenhuma
        await checkAndCreateFirstInvoice(docId, planData);

        // ✨ SINCRONIZADOR FORÇADO E ABSOLUTO
        // Agora ele roda INDEPENDENTE de ser cadastro novo ou edição.
        const faturasRef = collection(db, `sites/${docId}/faturas`);
        const q = query(faturasRef, where("status", "==", "pendente"));
        const pendentesSnap = await getDocs(q);

        const updatePromises = [];
        pendentesSnap.forEach((docSnap) => {
            updatePromises.push(updateDoc(docSnap.ref, {
                vencimento: planData.nextDue,
                valor: planData.value
            }));
        });
        await Promise.all(updatePromises);

        await shiftAltCodes(docId, oldAltCode, inputAltCode);

        showToast("Dados salvos com sucesso!");
        closeClientModal();
        loadClients();
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

// --- MOTOR DE CÓDIGOS ALTERNATIVOS (DESLIZAMENTO INTELIGENTE) ---
async function shiftAltCodes(docIdToIgnore, oldCode, newCode) {
    let updates = [];
    let others = allClients.filter(c => c.docId !== docIdToIgnore);

    for (let c of others) {
        let currentCode = parseInt(c.altCode) || 0;
        let modifiedCode = currentCode;

        if (oldCode !== null && currentCode > oldCode) {
            modifiedCode -= 1;
        }

        if (newCode !== null && modifiedCode >= newCode) {
            modifiedCode += 1;
        }

        if (modifiedCode !== currentCode) {
            c.altCode = modifiedCode;
            updates.push(updateDoc(doc(db, "sites", c.docId), { altCode: modifiedCode }));
        }
    }

    if (updates.length > 0) {
        console.log(`Reorganizando fila: ${updates.length} lojas ajustadas.`);
        await Promise.all(updates);
    }
}

// =================================================================
// FUNÇÃO DE BUSCA DE CEP AUTOMÁTICA (ViaCEP)
// =================================================================
window.buscarCep = async (cep) => {
    if (!cep) return;
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
        alert("CEP inválido. Digite um CEP com 8 números.");
        return;
    }

    document.getElementById('inp-rua').value = "Buscando...";
    document.getElementById('inp-bairro').value = "...";
    document.getElementById('inp-cidade').value = "...";
    document.getElementById('inp-uf').value = "...";

    try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();

        if (data.erro) {
            alert("CEP não encontrado nos Correios.");
            document.getElementById('inp-rua').value = "";
            document.getElementById('inp-bairro').value = "";
            document.getElementById('inp-cidade').value = "";
            document.getElementById('inp-uf').value = "";
            return;
        }

        document.getElementById('inp-rua').value = data.logradouro || '';
        document.getElementById('inp-bairro').value = data.bairro || '';
        document.getElementById('inp-cidade').value = data.localidade || '';
        document.getElementById('inp-uf').value = data.uf || '';
        document.getElementById('inp-numero').focus();

    } catch (error) {
        console.error("Erro ao conectar com ViaCEP:", error);
        alert("Erro na conexão ao buscar o CEP.");
    }
};

// =================================================================
// --- MÓDULO FINANCEIRO ---
// =================================================================
async function loadFinancials(siteId) {
    resetFinancialUI();
    try {
        currentClientOrders = [];
        currentClientProducts = [];

        let productsRef = collection(db, `sites/${siteId}/products`);
        let productsSnap = await getDocs(productsRef);
        productsSnap.forEach(doc => {
            currentClientProducts.push({ id: doc.id, ...doc.data() });
        });

        let salesRef = collection(db, `sites/${siteId}/sales`);
        let salesSnap = await getDocs(salesRef);
        salesSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let ordersSnap = await getDocs(ordersRef);
        ordersSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        setFinancialFilterType('tudo');

    } catch (error) {
        console.error("Erro Financeiro:", error);
        const elRev = document.getElementById('fin-faturamento');
        if (elRev) elRev.innerText = "Erro Perm.";
    }
}

function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0, confirmedSales = 0, totalRevenue = 0, totalCosts = 0, capitalGiro = 0;

    currentClientProducts.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        if (stock > 0) {
            let val = parseFloat(p.cost);
            if (isNaN(val) || val <= 0) val = parseFloat(p.promoPrice) || parseFloat(p.price) || 0;
            capitalGiro += (stock * val);
        }
    });

    const elCapital = document.getElementById('fin-capital-giro');
    if (elCapital) elCapital.innerText = formatMoney(capitalGiro);

    const validStatuses = ['confirmado', 'entregue', 'concluído', 'concluido'];

    currentClientOrders.forEach(order => {
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++;
        const status = (order.status || '').toLowerCase().trim();

        if (validStatuses.includes(status)) {
            confirmedSales++;
            let val = order.total || 0;
            if (typeof val === 'string') val = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalRevenue += val;

            let orderCost = 0;
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    let itemCost = parseFloat(item.cost) || 0;
                    let itemQty = parseInt(item.qty) || 1;
                    orderCost += (itemCost * itemQty);
                });
            }
            totalCosts += orderCost;
        }
    });

    animateValue("fin-pedidos", totalOrders);
    animateValue("fin-vendas", confirmedSales);

    const elFaturamento = document.getElementById('fin-faturamento');
    if (elFaturamento) elFaturamento.innerText = formatMoney(totalRevenue);

    const elCustos = document.getElementById('fin-custos');
    if (elCustos) elCustos.innerText = formatMoney(totalCosts);

    const profit = totalRevenue - totalCosts;
    const elLucro = document.getElementById('fin-lucro');
    if (elLucro) {
        elLucro.innerText = formatMoney(profit);
        elLucro.className = profit >= 0 ? "text-2xl font-bold text-green-400" : "text-2xl font-bold text-red-500";
    }
}

window.setFinancialFilterType = (type) => {
    const btnTudo = document.getElementById('btn-fin-tudo');
    const btnPeriodo = document.getElementById('btn-fin-periodo');
    const dateContainer = document.getElementById('fin-date-container');

    if (type === 'tudo') {
        if (btnTudo) btnTudo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-green-500 text-white shadow";
        if (btnPeriodo) btnPeriodo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-transparent text-gray-400 hover:text-white";
        if (dateContainer) {
            dateContainer.classList.add('hidden');
            dateContainer.classList.remove('flex');
        }
        if (document.getElementById('fin-data-inicio')) document.getElementById('fin-data-inicio').value = '';
        if (document.getElementById('fin-data-fim')) document.getElementById('fin-data-fim').value = '';
        calculateAndRenderStats(null, null);
    } else {
        if (btnPeriodo) btnPeriodo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-green-500 text-white shadow";
        if (btnTudo) btnTudo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-transparent text-gray-400 hover:text-white";
        if (dateContainer) {
            dateContainer.classList.remove('hidden');
            dateContainer.classList.add('flex');
        }
        applyFinancialFilter();
    }
};

window.applyFinancialFilter = () => {
    const dateContainer = document.getElementById('fin-date-container');
    if (dateContainer && dateContainer.classList.contains('hidden')) return;

    const s = document.getElementById('fin-data-inicio')?.value;
    const e = document.getElementById('fin-data-fim')?.value;

    if (!s || !e) {
        calculateAndRenderStats(null, null);
        return;
    }

    const dS = new Date(s); dS.setHours(0, 0, 0, 0);
    const dE = new Date(e); dE.setHours(23, 59, 59, 999);
    calculateAndRenderStats(dS, dE);
};

// --- UTILS ---
function resetFinancialUI() {
    ['fin-pedidos', 'fin-vendas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '-';
    });
    ['fin-faturamento', 'fin-custos', 'fin-lucro'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = 'R$ 0,00';
    });

    if (document.getElementById('fin-data-inicio')) document.getElementById('fin-data-inicio').value = '';
    if (document.getElementById('fin-data-fim')) document.getElementById('fin-data-fim').value = '';
    if (document.getElementById('fin-capital-giro')) document.getElementById('fin-capital-giro').innerText = 'R$ 0,00';
}

function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
    if (!el) return; // ✨ Trava de segurança: Se a badge não existir na tela, não trava o código.

    if (status === 'pausado') {
        el.className = "bg-yellow-900/20 border border-yellow-900 text-yellow-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "PAUSADO";
    } else if (status === 'bloqueado' || active === false) {
        el.className = "bg-red-900/20 border border-red-900 text-red-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "BLOQUEADO";
    } else {
        el.className = "bg-green-900/20 border border-green-900 text-green-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "ATIVO";
    }
}

function renderActionButtons(status, active = true) {
    const container = document.getElementById('action-buttons-container');
    container.innerHTML = '';

    if (status === 'pausado') {
        container.innerHTML = `<div class="bg-yellow-900/20 border border-yellow-700 p-3 rounded mb-3 text-center"><p class="text-yellow-500 text-xs font-bold mb-2">LOJA PAUSADA</p><button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2"><i class="fas fa-play"></i> Ativar Loja Novamente</button></div>`;
    } else if (status === 'bloqueado' || active === false) {
        container.innerHTML = `<div class="bg-red-900/20 border border-red-700 p-3 rounded mb-3 text-center"><p class="text-red-500 text-xs font-bold mb-2">LOJA BLOQUEADA</p><button onclick="changeClientStatus('activate')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2"><i class="fas fa-unlock"></i> Desbloquear Loja</button></div>`;
    } else {
        container.innerHTML = `<div class="flex gap-2"><button onclick="changeClientStatus('block')" class="bg-red-900/40 border border-red-800 text-red-400 hover:bg-red-600 hover:text-white px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition">Bloquear</button><button onclick="changeClientStatus('pause')" class="bg-yellow-900/40 border border-yellow-800 text-yellow-400 hover:bg-yellow-500 hover:text-black px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition">Pausar</button></div>`;
    }
}

window.changeClientStatus = (action) => {
    if (action === 'activate') {
        // ✨ VALIDAÇÃO INSTANTÂNEA: Lê o que está na tela antes de deixar ativar
        const nextDue = document.getElementById('plan-next-due').value;
        const carenciaAtiva = document.getElementById('conf-carencia-active').checked;
        const carenciaDias = parseInt(document.getElementById('conf-carencia-days').value) || 0;

        if (nextDue && carenciaAtiva) {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            const venc = new Date(nextDue + "T12:00:00");
            venc.setHours(0, 0, 0, 0);

            if (hoje > venc) {
                const diffDays = Math.ceil(Math.abs(hoje - venc) / (1000 * 60 * 60 * 24));
                if (diffDays > carenciaDias) {
                    alert(`⚠️ AÇÃO RECUSADA: Você não pode forçar a ativação da loja enquanto a opção "Ativar Carência" estiver marcada e a fatura continuar em atraso.\n\nPara desbloquear manualmente, DESMARQUE a caixinha "Ativar Carência" primeiro e tente novamente.`);
                    return; // Cancela o clique na hora! Não deixa o botão ficar verde.
                }
            }
        }

        pendingClientStatus = 'ativo';
        pendingClientActive = true;
    }
    else if (action === 'block') {
        pendingClientStatus = 'bloqueado';
        pendingClientActive = false;
    }
    else if (action === 'pause') {
        pendingClientStatus = 'pausado';
        pendingClientActive = false;
    }

    updateStatusBadge(pendingClientStatus, pendingClientActive);
    renderActionButtons(pendingClientStatus, pendingClientActive);
};

function formatMoney(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function animateValue(id, v) { const e = document.getElementById(id); if (e) e.innerText = v; }

async function deleteCurrentClient() {
    if (!currentDocId) return;
    const idAlvo = currentDocId;

    const targetClient = allClients.find(c => c.docId === idAlvo);
    const deletedAltCode = targetClient ? (parseInt(targetClient.altCode) || null) : null;

    const confirmacao = prompt(`ATENÇÃO: EXCLUSÃO TOTAL!\n\nIsso apagará a loja "${idAlvo}" e TODOS os seus dados.\n\nDigite DELETAR para confirmar:`);
    if (confirmacao !== "DELETAR") return alert("Ação cancelada.");

    const btnDelete = document.querySelector('#action-buttons-container button.bg-red-900\\/40');
    if (btnDelete) btnDelete.innerText = "Apagando... (Não feche)";

    try {
        const subcollections = ['products', 'categories', 'sales', 'orders', 'coupons', 'settings', 'dailyStats'];

        for (const subColName of subcollections) {
            const colRef = collection(db, `sites/${idAlvo}/${subColName}`);
            const snapshot = await getDocs(colRef);
            if (!snapshot.empty) {
                const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                await Promise.all(deletePromises);
            }
        }

        await deleteDoc(doc(db, "sites", idAlvo));

        // CHAMA O MOTOR CERTO!
        if (deletedAltCode !== null) {
            await shiftAltCodes(idAlvo, deletedAltCode, null);
        }

        allClients = allClients.filter(c => c.docId !== idAlvo);
        currentDocId = null;

        document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
        closeClientModal();
        await loadClients();
        alert(`SUCESSO: A loja '${idAlvo}' foi totalmente removida.`);

    } catch (e) {
        console.error("Erro na exclusão:", e);
        alert("Erro técnico ao excluir: " + e.message);
        if (btnDelete) btnDelete.innerHTML = '<i class="fas fa-trash"></i> Excluir';
    }
}

function getNextCode() { if (allClients.length === 0) return 1; return Math.max(...allClients.map(c => parseInt(c.code) || 0)) + 1; }

let currentStatusFilter = 'todos';

window.updateClientCounters = () => {
    if (!allClients) return;
    let ativos = 0, pausados = 0, bloqueados = 0;
    allClients.forEach(c => {
        if (c.status === 'pausado') pausados++;
        else if (c.status === 'bloqueado' || c.active === false) bloqueados++;
        else ativos++;
    });
    const elTotal = document.getElementById('count-total');
    if (elTotal) {
        elTotal.innerText = allClients.length;
        document.getElementById('count-active').innerText = ativos;
        document.getElementById('count-paused').innerText = pausados;
        document.getElementById('count-blocked').innerText = bloqueados;
    }
};

window.filterByStatus = (status) => {
    currentStatusFilter = status;
    const nomes = { 'todos': 'Todos', 'ativo': 'Ativos', 'pausado': 'Pausados', 'bloqueado': 'Bloqueados' };
    document.getElementById('current-status-filter').innerText = nomes[status];
    document.getElementById('status-dropdown').classList.add('hidden');
    const term = document.getElementById('search-input').value;
    filterClients(term);
};

window.filterClients = (searchTerm = '') => {
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/\D/g, '');

    const filtered = allClients.filter(c => {
        const matchName = (c.name || '').toLowerCase().includes(term);
        const matchSlug = (c.docId || '').toLowerCase().includes(term);
        const matchCode = c.code ? String(c.code).includes(term) : false;
        const matchAlt = c.altCode ? String(c.altCode).includes(term) : false;

        const docText = (c.ownerData && c.ownerData.doc) ? c.ownerData.doc : (c.cpf || c.cnpj || '');
        const docTextClean = docText.replace(/\D/g, '');

        const matchDoc = docText.toLowerCase().includes(term) || (cleanTerm !== '' && docTextClean.includes(cleanTerm));
        const textMatch = term === '' || matchName || matchSlug || matchCode || matchAlt || matchDoc;

        let statusMatch = true;
        if (currentStatusFilter !== 'todos') {
            let s = 'ativo';
            if (c.status === 'pausado') s = 'pausado';
            else if (c.status === 'bloqueado' || c.active === false) s = 'bloqueado';
            statusMatch = (s === currentStatusFilter);
        }
        return textMatch && statusMatch;
    });

    filtered.sort((a, b) => {
        let valA = parseInt(a[currentCodeDisplay]) || 0;
        let valB = parseInt(b[currentCodeDisplay]) || 0;
        return currentSortDirection === 'asc' ? (valA - valB) : (valB - valA);
    });

    renderClients(filtered);
};

window.generateSiteLink = () => {
    const n = document.getElementById('inp-name').value;
    if (n) {
        const s = n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-');
        document.getElementById('inp-site-slug').value = s;
        // O ERRO ESTAVA AQUI: Você estava tentando usar 'client.docId' onde o correto era 's'
        document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}/${s}`;
    }
}

window.copyToClipboard = (t) => navigator.clipboard.writeText(t).then(() => alert("Copiado!"));
window.closeClientModal = () => { clientModal.classList.add('translate-y-full'); currentDocId = null; }
window.switchTab = (t) => { document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden')); document.getElementById(`tab-${t}`).classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b => b.className = b.dataset.target === t ? "tab-btn px-3 py-1 text-[10px] font-bold rounded bg-gray-700 text-white" : "tab-btn px-3 py-1 text-[10px] font-bold rounded text-gray-400 hover:text-white"); }

// --- LOTE ---
function refreshClientList() {
    const searchInput = document.getElementById('search-input');
    const term = searchInput ? searchInput.value : '';
    filterClients(term);
}

window.toggleClientSelectionMode = () => {
    isClientSelectionMode = !isClientSelectionMode;
    if (!isClientSelectionMode) selectedClients.clear();
    const btnSel = document.getElementById('btn-selecionar-lote');
    const btnCan = document.getElementById('btn-cancelar-lote');
    if (btnSel && btnCan) {
        if (isClientSelectionMode) {
            btnSel.classList.add('hidden');
            btnCan.classList.remove('hidden');
        } else {
            btnSel.classList.remove('hidden');
            btnCan.classList.add('hidden');
        }
    }
    refreshClientList();
};

window.toggleClientSelection = (docId) => {
    if (selectedClients.has(docId)) selectedClients.delete(docId);
    else selectedClients.add(docId);
    refreshClientList();
};

window.toggleSelectAllClients = (checkbox) => {
    const searchInput = document.getElementById('search-input');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    const visibleClients = term ? allClients.filter(c => (c.name || '').toLowerCase().includes(term)) : allClients;
    if (checkbox.checked) {
        visibleClients.forEach(c => selectedClients.add(c.docId));
    } else {
        selectedClients.clear();
    }
    refreshClientList();
};

window.bulkChangeStatus = async (newStatus) => {
    const count = selectedClients.size;
    let actionText = newStatus === 'ativo' ? 'ATIVAR' : 'PAUSAR';
    if (!confirm(`Tem certeza que deseja ${actionText} ${count} loja(s)?`)) return;
    try {
        document.body.style.cursor = 'wait';
        const updatePromises = Array.from(selectedClients).map(docId => {
            const isActive = newStatus === 'ativo';
            return updateDoc(doc(db, "sites", docId), { status: newStatus, active: isActive });
        });
        await Promise.all(updatePromises);
        showToast(`${count} loja(s) atualizada(s)!`);
        selectedClients.clear();
        isClientSelectionMode = false;
        await loadClients();
    } catch (e) {
        alert("Erro ao atualizar em lote.");
    } finally {
        document.body.style.cursor = 'default';
    }
};

window.bulkDeleteClients = async () => {
    const count = selectedClients.size;
    const confirmacao = prompt(`ATENÇÃO EXTREMA!\n\nVocê está prestes a EXCLUIR DEFINITIVAMENTE ${count} loja(s) e TODOS os seus dados.\n\nDigite DELETAR para confirmar:`);
    if (confirmacao !== "DELETAR") return alert("Ação cancelada.");

    try {
        document.body.style.cursor = 'wait';
        const subcollections = ['products', 'categories', 'sales', 'orders', 'coupons', 'settings', 'dailyStats'];

        for (const docId of selectedClients) {
            const targetClient = allClients.find(c => c.docId === docId);
            const deletedAltCode = targetClient ? (parseInt(targetClient.altCode) || null) : null;

            for (const subColName of subcollections) {
                const colRef = collection(db, `sites/${docId}/${subColName}`);
                const snapshot = await getDocs(colRef);
                if (!snapshot.empty) {
                    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                    await Promise.all(deletePromises);
                }
            }

            await deleteDoc(doc(db, "sites", docId));

            // CHAMA O MOTOR CERTO!
            if (deletedAltCode !== null) {
                await shiftAltCodes(docId, deletedAltCode, null);
            }
            allClients = allClients.filter(c => c.docId !== docId);
        }

        alert(`SUCESSO: ${count} loja(s) apagada(s) permanentemente.`);
        selectedClients.clear();
        isClientSelectionMode = false;
        await loadClients();

    } catch (e) {
        alert("Erro durante a exclusão em lote.");
    } finally {
        document.body.style.cursor = 'default';
    }
};

// --- TOAST ---
window.showToast = (message) => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[999999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'bg-green-900/90 border border-green-500 text-green-400 px-6 py-3 rounded shadow-lg shadow-green-900/20 font-bold text-sm transform transition-all duration-300 translate-x-full opacity-0 flex items-center gap-2 backdrop-blur-sm';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-x-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// --- ALTERNAR CABEÇALHO ---
window.toggleCodeType = () => {
    currentCodeDisplay = currentCodeDisplay === 'code' ? 'altCode' : 'code';
    document.getElementById('header-code-text').innerText = currentCodeDisplay === 'code' ? 'CÓD' : 'ALT';
    const term = document.getElementById('search-input')?.value || '';
    filterClients(term);
};

window.toggleSortDirection = () => {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    const icon = document.getElementById('header-code-icon');
    icon.className = currentSortDirection === 'asc'
        ? 'fas fa-sort-numeric-down cursor-pointer hover:text-white transition text-[13px] text-blue-400'
        : 'fas fa-sort-numeric-up-alt cursor-pointer hover:text-white transition text-[13px] text-blue-400';
    const term = document.getElementById('search-input')?.value || '';
    filterClients(term);
};


// =================================================================
// 🚀 MOTOR DE ASSINATURAS E FATURAS (SaaS)
// =================================================================

// Verifica e cria a primeira fatura se não existir nenhuma
async function checkAndCreateFirstInvoice(clientId, planData) {
    if (!planData.nextDue || !planData.value) return;

    const faturasRef = collection(db, `sites/${clientId}/faturas`);
    const snap = await getDocs(faturasRef);

    // Se não tiver nenhuma fatura, cria a primeira
    if (snap.empty) {
        const novaFatura = {
            vencimento: planData.nextDue,
            valor: planData.value,
            status: 'pendente',
            createdAt: new Date().toISOString()
        };
        await setDoc(doc(faturasRef), novaFatura); // Gera um ID automático na subcoleção
        console.log(`Primeira fatura gerada para ${clientId}`);
    }
}

// Carrega as faturas e calcula o total pago
async function loadInvoices(clientId) {
    const tbody = document.getElementById('invoice-list-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500 text-xs italic">Carregando...</td></tr>';

    try {
        const faturasRef = collection(db, `sites/${clientId}/faturas`);
        const snap = await getDocs(faturasRef);

        let faturas = [];
        let totalPago = 0;
        let qtdPagas = 0;

        snap.forEach(d => {
            const fatura = { id: d.id, ...d.data() };
            faturas.push(fatura);
            if (fatura.status === 'pago') {
                totalPago += parseFloat(fatura.valorPago || fatura.valor || 0);
                qtdPagas++;
            }
        });

        // ✨ ORDENAÇÃO INTELIGENTE DE FATURAS
        faturas.sort((a, b) => {
            // 1. Prioridade: Pendentes SEMPRE no topo
            if (a.status !== 'pago' && b.status === 'pago') return -1;
            if (a.status === 'pago' && b.status !== 'pago') return 1;

            // Transforma em data real para comparar
            const dateA = new Date(a.vencimento + "T12:00:00");
            const dateB = new Date(b.vencimento + "T12:00:00");

            // 2. Se as duas estão pendentes -> Ordem Crescente (Cronológica: Jan, Fev, Mar...)
            if (a.status !== 'pago') {
                return dateA - dateB;
            }
            // 3. Se as duas estão pagas -> Ordem Decrescente (Mais recentes que ele pagou no topo das pagas)
            else {
                return dateB - dateA;
            }
        });

        document.getElementById('plan-total-paid').innerText = formatMoney(totalPago);

        const elQtdPagas = document.getElementById('plan-paid-count');
        if (elQtdPagas) elQtdPagas.innerText = qtdPagas;
        const client = allClients.find(c => c.docId === clientId);
        const planData = client ? client.plan : {};

        // Passa para desenhar a lista já com a ordem perfeita
        renderInvoices(faturas, planData);

        // Passa o planData para a badge e controla o botão de Criar Plano
        updatePlanStatusBadge(faturas, planData);

        const btnCriarPlano = document.getElementById('btn-criar-plano');
        if (btnCriarPlano) {
            if (faturas.length === 0) btnCriarPlano.classList.remove('hidden');
            else btnCriarPlano.classList.add('hidden');
        }

    } catch (e) {
        console.error("Erro ao carregar faturas:", e);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-red-500 text-xs">Erro ao carregar faturas.</td></tr>';
    }
}

function renderInvoices(faturas, plan = {}) {
    const tbody = document.getElementById('invoice-list-body');
    tbody.innerHTML = '';

    if (faturas.length === 0) {
        tbody.innerHTML = '<div class="text-center p-4 text-gray-500 text-xs italic w-full">Nenhuma fatura encontrada.</div>';
        return;
    }

    // ✨ TRAVA DE SEGURANÇA: Identifica a fatura principal (A pendente mais antiga/próxima a vencer)
    // Como a lista já está ordenada, é só pegar a primeira que não está paga!
    const faturaPrincipal = faturas.find(f => f.status !== 'pago');
    const idProtegido = faturaPrincipal ? faturaPrincipal.id : null;

    faturas.forEach(f => {
        const dataVenc = f.vencimento ? f.vencimento.split('-').reverse().join('/') : '--/--/----';
        const dataPag = f.dataPagamento ? f.dataPagamento.split('-').reverse().join('/') : 'Pendente';
        const valorFatura = formatMoney(parseFloat(f.valor));

        let statusHtml = '';
        let acaoHtml = '';

        if (f.status === 'pago') {
            statusHtml = `<span class="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase block w-full text-center shadow-sm">Pago</span>`;
            acaoHtml = `<span class="text-gray-500 text-[10px] flex items-center justify-center gap-1"><i class="fas fa-check text-green-500"></i> Registrado</span>`;
        } else {
            const hojeDate = new Date();
            hojeDate.setHours(0, 0, 0, 0);
            const vencDate = new Date(f.vencimento + "T12:00:00");
            vencDate.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(hojeDate - vencDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isAtrasado = hojeDate > vencDate;

            const carenciaActive = plan.carenciaActive || false;
            const carenciaDays = parseInt(plan.carenciaDays) || 0;

            if (isAtrasado) {
                if (carenciaActive && diffDays <= carenciaDays) {
                    statusHtml = `
                    <div class="flex flex-col items-center justify-center">
                        <span class="bg-orange-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase block w-full text-center shadow-sm">Carência</span>
                        <span class="text-[9px] text-orange-400 font-bold mt-1">${diffDays} dia(s)</span>
                    </div>`;
                } else {
                    statusHtml = `
                    <div class="flex flex-col items-center justify-center">
                        <span class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase block w-full text-center shadow-sm">Atrasado</span>
                        <span class="text-[9px] text-red-400 font-bold mt-1">${diffDays} dia(s)</span>
                    </div>`;
                }
            } else {
                statusHtml = `<span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold uppercase block w-full text-center shadow-sm">A Vencer</span>`;
            }

            acaoHtml = `<button onclick="openPayModal('${f.id}', ${f.valor})" class="bg-[#00d65f] hover:bg-green-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase transition w-full flex items-center justify-center gap-1"><i class="fas fa-check-circle"></i> Informar</button>`;
        }

        let valorHtml = `<div class="p-3 truncate text-green-400">${valorFatura}</div>`;

        if (f.status !== 'pago') {
            valorHtml = `
            <div class="p-3 truncate text-green-400 cursor-pointer hover:text-white transition group flex items-center gap-1" onclick="editInvoiceValue('${f.id}', ${f.valor})" title="Clique para editar valor">
                ${valorFatura} <i class="fas fa-edit text-gray-500 group-hover:text-white opacity-50 text-[10px]"></i>
            </div>`;
        }

        const wrapper = document.createElement('div');
        wrapper.className = "relative w-full border-b border-gray-800/50 group overflow-hidden";

        // ✨ A MÁGICA DO CADEADO: Verifica se é a fatura protegida
        let acaoFundoHtml = '';
        if (f.id === idProtegido) {
            // Fundo Cinza com Cadeado (Sem a função onclick)
            acaoFundoHtml = `
                <div class="absolute inset-y-0 right-0 w-[80px] bg-gray-700 flex flex-col items-center justify-center text-gray-400 transition cursor-not-allowed" title="A fatura atual não pode ser excluída">
                    <i class="fas fa-lock mb-1 text-lg"></i>
                    <span class="text-[9px] font-bold uppercase text-center leading-tight">Sistema<br>Protegido</span>
                </div>
            `;
        } else {
            // Lixeira Vermelha normal para o resto das faturas
            acaoFundoHtml = `
                <div class="absolute inset-y-0 right-0 w-[80px] bg-red-600 flex flex-col items-center justify-center text-white cursor-pointer hover:bg-red-700 transition" onclick="deleteInvoice('${f.id}')">
                    <i class="fas fa-trash mb-1 text-lg"></i>
                    <span class="text-[9px] font-bold uppercase">Excluir</span>
                </div>
            `;
        }

        const frontHtml = `
            <div class="grid grid-cols-5 w-full bg-[#161821] relative z-10 transition-transform duration-200 ease-out swipeable-row items-center min-h-[60px]" data-id="${f.id}">
                <div class="p-3 truncate">${dataVenc}</div>
                <div class="p-3 text-gray-400 truncate text-xs">${dataPag}</div>
                ${valorHtml} 
                <div class="p-3 flex justify-center">${statusHtml}</div>
                <div class="p-3 flex justify-center">${acaoHtml}</div>
            </div>
        `;

        wrapper.innerHTML = acaoFundoHtml + frontHtml;
        tbody.appendChild(wrapper);
    });
}

// Atualiza a Badge Principal do Plano (Laranja se na carência, Vermelho se estourou)
function updatePlanStatusBadge(faturas, plan = {}) {
    const badge = document.getElementById('plan-status-badge');
    if (!badge) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let maxAtrasoDias = 0;

    // Busca qual é a fatura com o pior atraso
    faturas.forEach(f => {
        if (f.status !== 'pago') {
            const venc = new Date(f.vencimento + "T12:00:00");
            venc.setHours(0, 0, 0, 0);
            if (hoje > venc) {
                const diffTime = Math.abs(hoje - venc);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays > maxAtrasoDias) maxAtrasoDias = diffDays;
            }
        }
    });

    if (maxAtrasoDias > 0) {
        const carenciaAtiva = plan.carenciaActive === true || String(plan.carenciaActive).toLowerCase() === "true";
        const carenciaDias = carenciaAtiva ? (parseInt(plan.carenciaDays) || 0) : 0;

        if (maxAtrasoDias <= carenciaDias) {
            // Está Atrasado, mas DENTRO da carência (Laranja)
            badge.className = "w-full bg-orange-500 text-white font-bold uppercase text-xs rounded p-3 text-center shadow-sm";
            badge.innerText = "CARÊNCIA (PENDENTE)";
        } else {
            // Estourou a carência (Vermelho)
            badge.className = "w-full bg-red-600 text-white font-bold uppercase text-xs rounded p-3 text-center shadow-sm";
            badge.innerText = "ATRASADO (PENDENTE)";
        }
    } else {
        // Tudo pago ou ainda vai vencer (Amarelo)
        badge.className = "w-full bg-yellow-500 text-black font-bold uppercase text-xs rounded p-3 text-center shadow-sm";
        badge.innerText = "EM DIA / A VENCER";
    }
}

// Abre o modal para preencher a data que pagou
window.openPayModal = (faturaId, valorEsperado) => {
    document.getElementById('pay-invoice-id').value = faturaId;

    const inputValor = document.getElementById('pay-invoice-value');
    inputValor.value = formatForInput(valorEsperado);

    // ✨ NOVO: Guarda o valor máximo (valor do plano) "escondido" no input
    inputValor.setAttribute('data-max', valorEsperado);

    // Preenche com a data de hoje por padrão
    document.getElementById('pay-invoice-date').value = new Date().toISOString().split('T')[0];

    document.getElementById('modal-pay-invoice').showModal();
};

// Salva o pagamento e gera a próxima conta
window.confirmInvoicePayment = async () => {
    const faturaId = document.getElementById('pay-invoice-id').value;
    const inputValorHTML = document.getElementById('pay-invoice-value');
    const valorPago = parseCurrencyVal(inputValorHTML.value);
    const dataPagamento = document.getElementById('pay-invoice-date').value;
    const valorMaximo = parseFloat(inputValorHTML.getAttribute('data-max')) || 0;

    if (!dataPagamento || isNaN(valorPago) || valorPago <= 0) {
        return alert("Preencha a data e um valor válido.");
    }

    if (valorPago > valorMaximo) {
        return alert(`⚠️ Ops! Valor maior que a fatura.`);
    }

    const btn = event.target;
    const txtOriginal = btn.innerText;
    btn.innerText = "Processando...";
    btn.disabled = true;

    try {
        const faturaRef = doc(db, `sites/${currentDocId}/faturas`, faturaId);

        // ✨ BUSCA A DATA DE VENCIMENTO DA FATURA QUE ESTÁ SENDO PAGA
        const snapFatura = await getDoc(faturaRef); // Use getDoc (importado do firestore)
        const dataVencimentoDestaFatura = snapFatura.data().vencimento;

        // Marca a fatura atual como paga
        await updateDoc(faturaRef, {
            status: 'pago',
            dataPagamento: dataPagamento,
            valorPago: valorPago
        });

        // ✨ PASSA A DATA BASE PARA O GERADOR
        await gerarProximaFatura(currentDocId, dataVencimentoDestaFatura);

        await verificarDesbloqueioAutomatico(currentDocId);
        document.getElementById('modal-pay-invoice').close();
        showToast("Pagamento registrado com sucesso!");
        loadInvoices(currentDocId);

    } catch (e) {
        console.error("Erro ao pagar:", e);
        alert("Erro ao registrar pagamento.");
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
};

// Calcula a próxima data baseada na DATA DA FATURA PAGA
async function gerarProximaFatura(clientId, dataBase) {
    const client = allClients.find(c => c.docId === clientId);
    if (!client || !client.plan || !dataBase) return;

    const periodoDias = parseInt(client.plan.period) || 30;
    const valorPlano = client.plan.value;

    // ✨ USA A dataBase (Data da fatura paga) para calcular a próxima
    const [ano, mes, dia] = dataBase.split('-').map(Number);
    let d = new Date(ano, mes - 1, dia);

    if (periodoDias === 7) d.setDate(d.getDate() + 7);
    else if (periodoDias === 30) d.setMonth(d.getMonth() + 1);
    else if (periodoDias === 180) d.setMonth(d.getMonth() + 6);
    else if (periodoDias === 365) d.setFullYear(d.getFullYear() + 1);
    else d.setDate(d.getDate() + periodoDias);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const novoVencimento = `${y}-${m}-${day}`;

    // Atualiza o novo vencimento no cadastro do cliente e remove imunidade manual
    await updateDoc(doc(db, "sites", clientId), {
        "plan.nextDue": novoVencimento
    });

    if (currentDocId === clientId) window.manualOverrideFlag = false;

    const inputDue = document.getElementById('plan-next-due');
    if (inputDue) inputDue.value = novoVencimento;

    const novaFatura = {
        vencimento: novoVencimento,
        valor: valorPlano,
        status: 'pendente',
        createdAt: new Date().toISOString()
    };

    await setDoc(doc(collection(db, `sites/${clientId}/faturas`)), novaFatura);
}

// Se o auto-desbloqueio estiver ativo e o site bloqueado, volta para "ativo"
async function verificarDesbloqueioAutomatico(clientId) {
    const client = allClients.find(c => c.docId === clientId);
    if (!client || !client.plan) return;

    if (client.plan.autoUnlock !== false) { // Se for true ou indefinido (padrão)
        if (client.status === 'pausado' || client.status === 'bloqueado' || !client.active) {

            await updateDoc(doc(db, "sites", clientId), {
                status: 'ativo',
                active: true
            });

            // Atualiza variáveis globais e UI se for o cliente atual
            if (currentDocId === clientId) {
                pendingClientStatus = 'ativo';
                pendingClientActive = true;
                updateStatusBadge('ativo', true);
                renderActionButtons('ativo', true);
            }
            console.log(`Site ${clientId} desbloqueado automaticamente após pagamento.`);
        }
    }
}

// --- TOGGLE ACORDEÃO DE PLANOS ---
window.togglePlanAccordion = () => {
    const content = document.getElementById('content-acc-plan');
    const arrow = document.getElementById('arrow-acc-plan');

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        arrow.classList.remove('rotate-180');
    }
};
// =================================================================
// 💥 FUNÇÃO DE EXCLUIR E SWIPE TO DELETE (ARRASTAR)
// =================================================================
window.deleteInvoice = async (faturaId) => {
    if (!confirm("Tem certeza que deseja EXCLUIR este registro de pagamento?")) return;

    try {
        await deleteDoc(doc(db, `sites/${currentDocId}/faturas`, faturaId));
        showToast("Registro excluído com sucesso!");
        loadInvoices(currentDocId); // Recarrega a tabela e recalcula o total
    } catch (e) {
        console.error("Erro ao excluir faturas", e);
        alert("Erro ao excluir registro.");
    }
};
// =================================================================
// 💰 MÁSCARAS E FORMATAÇÃO DE MOEDA
// =================================================================

// 1. A máscara que roda enquanto você digita
window.maskCurrency = (input) => {
    let value = input.value.replace(/\D/g, ''); // Remove tudo que não é número

    if (value === '') {
        input.value = '';
        return;
    }

    value = parseInt(value, 10).toString(); // Tira zeros à esquerda
    value = value.padStart(3, '0'); // Garante que tenha pelo menos 3 dígitos (ex: 001)

    let integerPart = value.slice(0, -2);
    let decimalPart = value.slice(-2);

    // Coloca os pontos de milhar
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    input.value = integerPart + ',' + decimalPart;
};

// 2. Converte "1.200,50" para número real (1200.50) para salvar no Firebase
window.parseCurrencyVal = (str) => {
    if (!str) return 0;
    let cleanStr = String(str).replace(/\./g, '').replace(',', '.');
    return parseFloat(cleanStr) || 0;
};

// 3. Converte número real (1200.5) para formato de input ("1.200,50") ao carregar a tela
window.formatForInput = (num) => {
    if (!num || isNaN(num)) return '';
    return parseFloat(num).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Variáveis de controle do movimento
let swipeStartX = 0;
let swipeCurrentX = 0;
let swipeIsDragging = false;
let swipeActiveRow = null;

// INÍCIO DO ARRASTO
const handleDragStart = (e) => {
    const row = e.target.closest('.swipeable-row');
    if (row) {
        swipeIsDragging = true;
        swipeActiveRow = row;
        swipeStartX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
        swipeActiveRow.style.transition = 'none'; // Desliga animação pra seguir o dedo junto
    }
};

// MOVIMENTO DO ARRASTO
const handleDragMove = (e) => {
    if (!swipeIsDragging || !swipeActiveRow) return;
    const x = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
    swipeCurrentX = x - swipeStartX;

    // Permite arrastar apenas para a esquerda (valores negativos)
    if (swipeCurrentX < 0) {
        if (swipeCurrentX < -100) swipeCurrentX = -100; // Trava o máximo que ele pode ir
        swipeActiveRow.style.transform = `translateX(${swipeCurrentX}px)`;
    } else {
        swipeActiveRow.style.transform = `translateX(0px)`;
    }
};

// FIM DO ARRASTO
const handleDragEnd = () => {
    if (!swipeIsDragging || !swipeActiveRow) return;
    swipeIsDragging = false;
    swipeActiveRow.style.transition = 'transform 0.2s ease-out';

    // Se puxou mais que 40px pra esquerda, o botão "encaixa" aberto (-80px)
    if (swipeCurrentX < -40) {
        swipeActiveRow.style.transform = `translateX(-80px)`;

        // Detalhe premium: fecha sozinho depois de 4 segundos se o usuário não clicar na lixeira
        const rowToClose = swipeActiveRow;
        setTimeout(() => {
            if (rowToClose) rowToClose.style.transform = `translateX(0px)`;
        }, 4000);

    } else {
        // Se puxou muito pouco, volta pro lugar (cancela)
        swipeActiveRow.style.transform = `translateX(0px)`;
    }

    swipeActiveRow = null;
};

// Registra os ouvintes globais (Funciona em PC e Mobile)
document.addEventListener('touchstart', handleDragStart, { passive: true });
document.addEventListener('touchmove', handleDragMove, { passive: true });
document.addEventListener('touchend', handleDragEnd);

document.addEventListener('mousedown', handleDragStart);
document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);


// --- SISTEMA DE AVISOS ---
window.openAlertModal = () => {
    if (!currentDocId) return alert("Selecione um cliente primeiro.");
    document.getElementById('alert-message-text').value = '';
    document.getElementById('modal-send-alert').showModal();
};

window.setAlertTemplate = (type) => {
    const txtArea = document.getElementById('alert-message-text');
    if (type === 1) {
        txtArea.value = "Lembrete de Pagamento de Fatura em Atraso. Por favor, regularize para evitar suspensão da sua loja, ou entre em contato com a Projetista ;)";
    } else if (type === 2) {
        txtArea.value = "O Site entrará em período de manutenção programada em breve. Algumas instabilidades podem ocorrer.";
    }
};

window.submitClientAlert = async () => {
    const msg = document.getElementById('alert-message-text').value.trim();
    if (!msg) return alert("Digite uma mensagem para enviar.");

    const btn = event.target;
    const txtOriginal = btn.innerText;
    btn.innerText = "Enviando...";
    btn.disabled = true;

    try {
        const aviso = {
            mensagem: msg,
            data: new Date().toISOString(),
            lido: false
        };
        // Salva na subcoleção "avisos" do cliente
        await setDoc(doc(collection(db, `sites/${currentDocId}/avisos`)), aviso);

        showToast("Aviso enviado com sucesso!");
        document.getElementById('modal-send-alert').close();
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar aviso.");
    } finally {
        btn.innerText = txtOriginal;
        btn.disabled = false;
    }
};

// =================================================================
// ⚙️ MOTOR DE AUTOMAÇÃO E PUNIÇÕES (MODO INVESTIGAÇÃO)
// =================================================================

window.runLazyPenaltyCheck = async () => {
    console.log("🤠 [Xerife] Iniciando ronda...");
    let sofreuAlteracao = false;

    try {
        const snap = await getDocs(collection(db, "sites"));

        for (const documento of snap.docs) {
            const c = { docId: documento.id, ...documento.data() };

            if (c.plan && c.plan.nextDue) {

                // Pega quem for 'ativo' ou tiver active: true
                if (c.status?.toLowerCase() === 'ativo' || c.active === true) {

                    // ✨ O XERIFE RESPEITA O CHEFE: Se tem liberação manual, ele vai embora
                    if (c.manualOverride === true) {
                        console.log(`   🛡️ [Xerife] Ignorando '${c.name}': Loja foi ativada manualmente pelo administrador.`);
                        continue; // Pula essa loja e vai pra próxima!
                    }

                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);

                    if (hoje > venc) {
                        const diffTime = Math.abs(hoje - venc);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        const carenciaAtiva = c.plan.carenciaActive === true || String(c.plan.carenciaActive).toLowerCase() === "true";

                        // 🔥 CORREÇÃO: O robô só pune se a carência estiver MARCADA
                        if (carenciaAtiva) {
                            const carenciaDias = parseInt(c.plan.carenciaDays) || 0;

                            if (diffDays > carenciaDias) {
                                let action = c.plan.carenciaAction || 'pausado';
                                if (action === 'pausar') action = 'pausado';
                                if (action === 'bloquear') action = 'bloqueado';

                                console.log(`🚨 [Xerife] ENQUADROU! Punindo '${c.name}' com: ${action.toUpperCase()}`);

                                await updateDoc(doc(db, "sites", c.docId), {
                                    status: action,
                                    active: action === 'bloqueado' ? false : true
                                });

                                sofreuAlteracao = true;

                                const index = allClients.findIndex(client => client.docId === c.docId);
                                if (index !== -1) {
                                    allClients[index].status = action;
                                    allClients[index].active = action === 'bloqueado' ? false : true;
                                }
                            }
                        } else {
                            console.log(`   🛡️ Ignorado: Carência está desativada para a loja '${c.name}'.`);
                        }
                    }
                }
            }
        }

        if (sofreuAlteracao) {
            console.log("🔄 [Xerife] Atualizando tela...");
            // ✨ CORREÇÃO DA TELA: Chama o refresh correto para remontar os cards
            if (typeof refreshClientList === 'function') refreshClientList();
        } else {
            console.log("✅ [Xerife] Ronda concluída. Todas as lojas em dia (ou dentro da carência).");
        }

    } catch (e) {
        console.error("❌ [Xerife] Erro:", e);
    }
};

// =================================================================
// 🔧 GERENCIAMENTO EXTRA DE FATURAS (EDITAR E CRIAR PLANO)
// =================================================================

// 1. Edita uma fatura pendente clicando no valor
window.editInvoiceValue = async (faturaId, valorAtual) => {
    const digitado = prompt(`Alterar valor da fatura pendente.\n\nDigite o novo valor (ex: ${valorAtual}):`, formatForInput(valorAtual));
    if (!digitado) return; // Se clicou em cancelar

    const novoValor = parseCurrencyVal(digitado);
    if (isNaN(novoValor) || novoValor <= 0) {
        return alert("Valor digitado é inválido.");
    }

    try {
        await updateDoc(doc(db, `sites/${currentDocId}/faturas`, faturaId), {
            valor: novoValor
        });
        showToast("Valor da fatura atualizado!");
        loadInvoices(currentDocId); // Recarrega a tabela na hora
    } catch (e) {
        console.error("Erro ao alterar valor:", e);
        alert("Erro ao alterar valor da fatura.");
    }
};

// =================================================================
// 🔧 CRIAÇÃO MANUAL DA PRIMEIRA FATURA (Botão Criar Plano)
// =================================================================

window.createManualPlan = async () => {
    const inputDue = document.getElementById('plan-next-due').value;
    const inputVal = document.getElementById('plan-value').value;
    const inputPeriod = document.getElementById('plan-period').value;

    if (!inputDue || !inputVal) {
        return alert("⚠️ Preencha a data em 'Próximo Vencimento' e o 'Valor (R$)' do plano antes de gerar a fatura.");
    }

    const valorParsed = parseCurrencyVal(inputVal);

    // ✨ SE FOR CLIENTE NOVO (Ainda não salvo) -> Gera a fatura visual e libera o salvamento
    if (!currentDocId) {
        const tbody = document.getElementById('invoice-list-body');
        const dataVenc = inputDue.split('-').reverse().join('/');
        const valorFatura = formatMoney(valorParsed);

        // Desenha a fatura provisória na tabela
        tbody.innerHTML = `
            <div class="grid grid-cols-5 w-full bg-[#161821] relative z-10 transition-transform duration-200 ease-out items-center min-h-[60px] border-b border-gray-800/50">
                <div class="p-3 truncate">${dataVenc}</div>
                <div class="p-3 text-gray-400 truncate text-xs">Pendente</div>
                <div class="p-3 truncate text-green-400">${valorFatura}</div>
                <div class="p-3 flex justify-center"><span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold uppercase block w-full text-center shadow-sm">A Vencer</span></div>
                <div class="p-3 flex justify-center"><span class="text-gray-500 text-[9px] uppercase font-bold text-center">Salvar para<br>confirmar</span></div>
            </div>
        `;

        const planBadge = document.getElementById('plan-status-badge');
        if (planBadge) {
            planBadge.className = "w-full bg-yellow-500 text-black font-bold uppercase text-xs rounded p-3 text-center shadow-sm transition-colors";
            planBadge.innerText = "EM DIA / A VENCER";
        }

        document.getElementById('btn-criar-plano').classList.add('hidden');
        window.planGeneratedInUI = true; // 🔓 Libera a trava de salvamento!

        showToast("Fatura pronta! Vá para o final e clique em 'Salvar Dados' para confirmar o cadastro.");
        return;
    }

    // ✨ SE FOR CLIENTE ANTIGO -> Salva direto no banco normalmente
    const btn = document.getElementById('btn-criar-plano');
    btn.innerText = "Gerando...";
    btn.disabled = true;

    try {
        await updateDoc(doc(db, "sites", currentDocId), {
            "plan.nextDue": inputDue,
            "plan.value": valorParsed,
            "plan.period": inputPeriod
        });

        const index = allClients.findIndex(c => c.docId === currentDocId);
        if (index !== -1) {
            if (!allClients[index].plan) allClients[index].plan = {};
            allClients[index].plan.nextDue = inputDue;
            allClients[index].plan.value = valorParsed;
            allClients[index].plan.period = inputPeriod;
        }

        const novaFaturaRef = doc(collection(db, `sites/${currentDocId}/faturas`));
        await setDoc(novaFaturaRef, {
            vencimento: inputDue,
            valor: valorParsed,
            status: 'pendente',
            createdAt: new Date().toISOString()
        });

        showToast("Plano ativado e Fatura gerada!");
        await loadInvoices(currentDocId);
        btn.classList.add('hidden');

    } catch (e) {
        console.error("Erro ao criar plano:", e);
        alert("Falha ao criar o plano.");
    } finally {
        btn.innerText = "Criar Plano";
        btn.disabled = false;
    }
};