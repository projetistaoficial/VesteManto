import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
const PRODUCTION_DOMAIN = "https://projetistaoficial.github.io/VesteManto/";

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
    window.clearFinancialFilter = clearFinancialFilter;
    // Atalho para filtro
    window.filtrarFinanceiro = applyFinancialFilter; 

    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.addEventListener('input', (e) => filterClients(e.target.value));
});

// --- CARREGAR LISTA ---
async function loadClients() {
    listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Carregando...</div>';
    try {
        const snap = await getDocs(collection(db, "sites"));
        allClients = [];
        snap.forEach(doc => allClients.push({ docId: doc.id, ...doc.data() }));
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));
        renderClients(allClients);
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div class="text-center text-red-500 mt-10 text-xs">Erro ao carregar lista</div>';
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    
    // --- 1. BARRA DE CONTROLES EM MASSA ---
    const controlsBar = document.createElement('div');
    controlsBar.className = "flex flex-wrap justify-between items-center bg-[#161821] p-3 rounded-t-lg border-b border-gray-800 mb-1 gap-2 sticky top-0 z-10 shadow-md";
    
    const selectBtnText = isClientSelectionMode ? '<i class="fas fa-times mr-2"></i> Cancelar' : '<i class="fas fa-check-square mr-2"></i> Selecionar Lote';
    const selectBtnClass = isClientSelectionMode 
        ? "text-red-400 hover:text-red-300 text-xs font-bold uppercase py-1.5 px-3 bg-red-900/20 rounded border border-red-900/50 transition" 
        : "text-yellow-500 hover:text-yellow-400 text-xs font-bold uppercase py-1.5 px-3 hover:bg-yellow-900/20 border border-transparent hover:border-yellow-900/50 rounded transition";

    let bulkActionsHTML = '';
    if (isClientSelectionMode && selectedClients.size > 0) {
        bulkActionsHTML = `
            <div class="flex items-center gap-2 animate-fade-in bg-black p-1 rounded-lg border border-gray-700">
                <span class="text-white text-[10px] font-bold bg-blue-600 px-2 py-1.5 rounded ml-1">${selectedClients.size} Lojas</span>
                
                <button onclick="bulkChangeStatus('ativo')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded text-[10px] uppercase font-bold transition flex items-center gap-1" title="Ativar Todos">
                    <i class="fas fa-play"></i> <span class="hidden sm:inline">Ativar</span>
                </button>
                
                <button onclick="bulkChangeStatus('pausado')" class="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1.5 rounded text-[10px] uppercase font-bold transition flex items-center gap-1" title="Pausar Todos">
                    <i class="fas fa-pause"></i> <span class="hidden sm:inline">Pausar</span>
                </button>
                
                <div class="w-px h-6 bg-gray-700 mx-1"></div>
                
                <button onclick="bulkDeleteClients()" class="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-[10px] uppercase font-bold transition flex items-center gap-1" title="Excluir Todos">
                    <i class="fas fa-trash"></i> <span class="hidden sm:inline">Excluir</span>
                </button>
            </div>
        `;
    }

    const allSelected = clients.length > 0 && clients.every(c => selectedClients.has(c.docId));
    const masterCheckHTML = isClientSelectionMode 
        ? `<input type="checkbox" onchange="toggleSelectAllClients(this)" ${allSelected ? 'checked' : ''} class="cursor-pointer w-4 h-4 ml-3 rounded border-gray-600 bg-gray-900 text-yellow-500 focus:ring-0">` 
        : '';

    controlsBar.innerHTML = `
        <div class="flex items-center">
            <button onclick="toggleClientSelectionMode()" class="${selectBtnClass}">${selectBtnText}</button>
            ${masterCheckHTML}
        </div>
        ${bulkActionsHTML}
    `;
    listContainer.appendChild(controlsBar);

    // --- 2. VERIFICA SE ESTÁ VAZIO ---
    if (clients.length === 0) {
        listContainer.innerHTML += '<div class="text-center text-gray-500 mt-10 text-xs py-8 bg-[#161821] rounded-b-lg">Nenhum cliente encontrado</div>';
        return;
    }

    // --- 3. RENDERIZA OS CLIENTES ---
    clients.forEach(client => {
        let badgeColor = 'text-green-500 bg-green-900/20 border-green-900';
        let statusText = 'Ativo';

        if (client.status === 'pausado') {
            badgeColor = 'text-yellow-500 bg-yellow-900/20 border-yellow-900';
            statusText = 'Pausado';
        } else if (client.status === 'bloqueado' || client.active === false) {
            badgeColor = 'text-red-500 bg-red-900/20 border-red-900';
            statusText = 'Bloqueado';
        }

        const isChecked = selectedClients.has(client.docId) ? 'checked' : '';
        const bgClass = selectedClients.has(client.docId) ? 'bg-blue-900/20 border-blue-900/50' : 'bg-[#161821] border-gray-800 hover:bg-[#1e2029]';
        const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
        
        const row = document.createElement('div');
        row.className = `grid grid-cols-12 gap-2 px-4 py-3 ${bgClass} border-b items-center cursor-pointer transition rounded mb-1 select-none`;
        
        // Lógica do clique (Abre modal ou seleciona)
        row.onclick = (e) => {
            if (isClientSelectionMode) {
                if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A') {
                    toggleClientSelection(client.docId);
                }
            } else {
                if(!e.target.closest('a') && !e.target.closest('button')) {
                    openClientModal(client.docId);
                }
            }
        };

        const firstCol = isClientSelectionMode 
            ? `<div class="col-span-1 flex justify-center"><input type="checkbox" class="w-4 h-4 cursor-pointer pointer-events-none rounded border-gray-600 text-yellow-500" ${isChecked}></div>` 
            : `<div class="col-span-1 text-center text-gray-500 font-bold text-xs">${client.code || '#'}</div>`;

        row.innerHTML = `
            ${firstCol}
            <div class="col-span-4 font-bold text-white truncate text-sm pl-2">${client.name || 'Sem Nome'}</div>
            <div class="col-span-3 text-center flex items-center justify-center gap-2 bg-[#0f1014] border border-gray-700 rounded px-2 py-1">
                 <a href="${fullLink}" target="_blank" onclick="event.stopPropagation()" class="text-blue-400 text-[10px] truncate w-full hover:underline">.../?site=${client.docId}</a>
                 <button onclick="event.stopPropagation(); copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white transition" title="Copiar"><i class="far fa-copy text-xs"></i></button>
            </div>
            <div class="col-span-2 text-center text-gray-400 text-[10px]">${client.plan?.name || 'Mensal'}</div>
            <div class="col-span-2 text-center"><span class="${badgeColor} border px-2 py-1 rounded text-[10px] font-bold uppercase block w-24 mx-auto">${statusText}</span></div>
        `;
        listContainer.appendChild(row);
    });
}

// --- ABRIR MODAL ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    clientModal.classList.remove('translate-y-full');

    // Reseta Form
    document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toLocaleDateString('pt-BR');
    
    resetFinancialUI(); 

    if (docId) {
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name || 'Editar';
            document.getElementById('inp-id').value = client.code;
            document.getElementById('inp-name').value = client.name;
            document.getElementById('inp-site-slug').value = client.docId;
            document.getElementById('inp-site-slug').disabled = true;
            document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${client.docId}`;

            if (client.plan) document.getElementById('inp-plan').value = client.plan.name || '30 dias (Mensal)';
            
            // === DADOS DO DONO ===
            const owner = client.ownerData || {};
            document.getElementById('inp-owner').value = owner.name || client.ownerName || '';
            document.getElementById('inp-doc').value = owner.doc || client.cpf || client.cnpj || '';
            document.getElementById('inp-insta').value = owner.insta || client.instagram || '';
            document.getElementById('inp-face').value = owner.face || client.facebook || '';
            document.getElementById('inp-yt').value = owner.yt || client.youtube || '';
            document.getElementById('inp-tel').value = owner.tel || client.phone || client.whatsapp || '';
            document.getElementById('inp-whats').value = owner.whats || client.whatsapp || '';
            document.getElementById('inp-email').value = owner.email || client.email || '';

            // === [NOVO] CARREGA AS SENHAS ===
            const access = client.access || {};
            // Certifique-se que no seu HTML os inputs tenham esses IDs
            const elPassAdmin = document.getElementById('inp-pass-admin');
            const elPassDev = document.getElementById('inp-pass-dev');
            
            if (elPassAdmin) elPassAdmin.value = access.admin || '';
            if (elPassDev) elPassDev.value = access.dev || '';
            // ================================

            updateStatusBadge(client.status, client.active);
            renderActionButtons(client.status, client.active);
            loadFinancials(docId);
        }
    } else {
        // NOVO
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        renderActionButtons('ativo');
        updateStatusBadge('ativo', true);
    }
    switchTab('cadastro');
}

// =================================================================
// --- MÓDULO FINANCEIRO DO PAINEL MESTRE ---
// =================================================================

// =================================================================
// --- MÓDULO FINANCEIRO DO PAINEL MESTRE ---
// =================================================================

async function loadFinancials(siteId) {
    resetFinancialUI(); 
    
    try {
        currentClientOrders = []; 
        currentClientProducts = []; 

        // 1. BUSCA O ESTOQUE (Necessário para o Capital de Giro)
        let productsRef = collection(db, `sites/${siteId}/products`);
        let productsSnap = await getDocs(productsRef);
        productsSnap.forEach(doc => {
            currentClientProducts.push({ id: doc.id, ...doc.data() });
        });

        // 2. BUSCA VENDAS (Coleção 'sales' - atual)
        let salesRef = collection(db, `sites/${siteId}/sales`);
        let salesSnap = await getDocs(salesRef);
        salesSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        // 3. BUSCA VENDAS LEGADAS (Coleção 'orders' - antigas)
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let ordersSnap = await getDocs(ordersRef);
        ordersSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        // Força a UI a começar exibindo "TUDO" E CHAMA O CÁLCULO
        setFinancialFilterType('tudo');

    } catch (error) {
        console.error("Erro Financeiro:", error);
        const elRev = document.getElementById('fin-faturamento');
        if (elRev) elRev.innerText = "Erro Perm.";
    }
}

function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0, confirmedSales = 0, totalRevenue = 0, totalCosts = 0;
    let capitalGiro = 0;
    
    // --- 1. CÁLCULO DE CAPITAL DE GIRO ---
    currentClientProducts.forEach(p => {
        const stock = parseInt(p.stock) || 0;
        if (stock > 0) {
            // PRIORIDADE: Usa o CUSTO do produto (Capital Real Investido)
            let val = parseFloat(p.cost);
            
            // FALLBACK: Se o lojista não preencheu o Custo, usa o preço de venda para não zerar
            if (isNaN(val) || val <= 0) {
                val = parseFloat(p.promoPrice) || parseFloat(p.price) || 0;
            }
            
            capitalGiro += (stock * val);
        }
    });

    const elCapital = document.getElementById('fin-capital-giro');
    if (elCapital) elCapital.innerText = formatMoney(capitalGiro);

    // --- 2. CÁLCULO DE VENDAS E LUCROS ---
    const validStatuses = ['confirmado', 'entregue', 'concluído', 'concluido'];

    currentClientOrders.forEach(order => {
        // FILTRO DE DATA
        if (startDate && endDate) {
            // Se a data do pedido for menor que a data inicial ou maior que a final, pula
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++; // Contabiliza a intenção de compra
        const status = (order.status || '').toLowerCase().trim();

        if (validStatuses.includes(status)) {
            confirmedSales++; // Venda finalizada
            
            // Faturamento
            let val = order.total || 0;
            if (typeof val === 'string') {
                val = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            }
            totalRevenue += val;

            // Custos
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

    // --- 3. ATUALIZAÇÃO VISUAL ---
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

// --- CONTROLES DE FILTRO (TUDO / PERÍODO) ---
window.setFinancialFilterType = (type) => {
    const btnTudo = document.getElementById('btn-fin-tudo');
    const btnPeriodo = document.getElementById('btn-fin-periodo');
    const dateContainer = document.getElementById('fin-date-container');

    if (type === 'tudo') {
        if(btnTudo) btnTudo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-green-500 text-white shadow";
        if(btnPeriodo) btnPeriodo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-transparent text-gray-400 hover:text-white";
        
        if(dateContainer) {
            dateContainer.classList.add('hidden');
            dateContainer.classList.remove('flex');
        }

        // Limpa as datas na UI e calcula tudo sem filtro
        if (document.getElementById('fin-data-inicio')) document.getElementById('fin-data-inicio').value = '';
        if (document.getElementById('fin-data-fim')) document.getElementById('fin-data-fim').value = '';
        
        calculateAndRenderStats(null, null);

    } else {
        if(btnPeriodo) btnPeriodo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-green-500 text-white shadow";
        if(btnTudo) btnTudo.className = "px-4 py-1.5 text-xs font-bold rounded-md transition-colors bg-transparent text-gray-400 hover:text-white";
        
        if(dateContainer) {
            dateContainer.classList.remove('hidden');
            dateContainer.classList.add('flex');
        }
        
        // Dispara o filtro para aplicar o que tiver no input de data (se já tiver)
        applyFinancialFilter();
    }
};

window.applyFinancialFilter = () => {
    // Se o filtro "Tudo" estiver ativo, aborta a busca
    const dateContainer = document.getElementById('fin-date-container');
    if (dateContainer && dateContainer.classList.contains('hidden')) {
        return;
    }

    const s = document.getElementById('fin-data-inicio')?.value;
    const e = document.getElementById('fin-data-fim')?.value;
    
    // Se faltar alguma data, calcula como nulo
    if(!s || !e) {
        calculateAndRenderStats(null, null);
        return;
    }
    
    // Data inicio (00:00:00)
    const dS = new Date(s); dS.setHours(0,0,0,0);
    // Data Fim (23:59:59 do dia escolhido - previne timezone)
    const dE = new Date(e); dE.setHours(23,59,59,999);
    
    calculateAndRenderStats(dS, dE);
};

// --- UTILS ---
function resetFinancialUI() {
    ['fin-pedidos', 'fin-vendas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = '-';
    });
    ['fin-faturamento', 'fin-custos', 'fin-lucro'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerText = 'R$ 0,00';
    });
    
    if(document.getElementById('fin-data-inicio')) document.getElementById('fin-data-inicio').value = '';
    if(document.getElementById('fin-data-fim')) document.getElementById('fin-data-fim').value = '';
    if(document.getElementById('fin-capital-giro')) document.getElementById('fin-capital-giro').innerText = 'R$ 0,00';
}

function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
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

async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    if (!slug || !name) return alert("Preencha Nome e Slug");
    
    // Captura os elementos de senha (verifique se os IDs no HTML batem com esses)
    const elPassAdmin = document.getElementById('inp-pass-admin');
    const elPassDev = document.getElementById('inp-pass-dev');

    const docId = currentDocId || slug;
    
    const data = {
        name: name,
        ownerData: {
            name: document.getElementById('inp-owner').value,
            doc: document.getElementById('inp-doc').value,
            insta: document.getElementById('inp-insta').value,
            face: document.getElementById('inp-face').value,
            yt: document.getElementById('inp-yt').value,
            tel: document.getElementById('inp-tel').value,
            whats: document.getElementById('inp-whats').value,
            email: document.getElementById('inp-email').value
        },
        // === [NOVO] SALVA AS SENHAS ===
        access: {
            admin: elPassAdmin ? elPassAdmin.value.trim() : '',
            dev: elPassDev ? elPassDev.value.trim() : ''
        },
        // ==============================
        plan: { name: document.getElementById('inp-plan').value },
        ...(!currentDocId && { code: parseInt(document.getElementById('inp-id').value), createdAt: new Date().toISOString(), status: 'ativo', active: true })
    };

    try {
        await setDoc(doc(db, "sites", docId), data, { merge: true });
        alert("Salvo com sucesso!");
        closeClientModal();
        loadClients();
    } catch (e) { 
        alert("Erro ao salvar: " + e.message); 
    }
}

async function changeClientStatus(action) {
    if (!currentDocId) return;
    let newStatus = 'ativo'; let isActive = true;
    if (action === 'block') { newStatus = 'bloqueado'; isActive = false; }
    if (action === 'pause') { newStatus = 'pausado'; isActive = false; }
    try {
        await updateDoc(doc(db, "sites", currentDocId), { status: newStatus, active: isActive });
        updateStatusBadge(newStatus, isActive); renderActionButtons(newStatus, isActive); loadClients();
    } catch (e) { alert("Erro status"); }
}

// --- BOILERPLATE ---
function formatMoney(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function animateValue(id, v) { const e=document.getElementById(id); if(e) e.innerText=v; }
async function deleteCurrentClient() {
    // 1. Verificação Inicial
    if (!currentDocId) return;

    // === TRAVA DE SEGURANÇA (CORREÇÃO DO ERRO) ===
    // Guardamos o ID numa constante local. 
    // Assim, se currentDocId mudar durante o processo, o idAlvo permanece seguro.
    const idAlvo = currentDocId; 

    // 2. Confirmação
    const confirmacao = prompt(`ATENÇÃO: EXCLUSÃO TOTAL!\n\nIsso apagará a loja "${idAlvo}" e TODOS os seus dados.\n\nDigite DELETAR para confirmar:`);
    
    if (confirmacao !== "DELETAR") return alert("Ação cancelada.");

    // Feedback no botão
    const btnDelete = document.querySelector('#action-buttons-container button.bg-red-900\\/40'); 
    if(btnDelete) btnDelete.innerText = "Apagando... (Não feche)";

    try {
        console.log(` iniciando protocolo de exclusão para: ${idAlvo}`);

        // 3. LISTA DE SUBCOLEÇÕES
        const subcollections = [
            'products', 
            'categories', 
            'sales',
            'orders',
            'coupons', 
            'settings',
            'dailyStats'
        ];

        // 4. APAGA AS SUBCOLEÇÕES (Usando idAlvo)
        for (const subColName of subcollections) {
            console.log(`Verificando coleção: ${subColName}...`);
            // Usa idAlvo em vez de currentDocId
            const colRef = collection(db, `sites/${idAlvo}/${subColName}`); 
            const snapshot = await getDocs(colRef);

            if (!snapshot.empty) {
                console.log(`Apagando ${snapshot.size} itens de ${subColName}...`);
                
                // Renomeei a variável interna para 'docSnap' para não confundir com a função doc()
                const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                await Promise.all(deletePromises);
            }
        }

        // 5. APAGA O DOCUMENTO DO SITE (AQUI DAVA O ERRO)
        console.log(`Apagando documento principal: ${idAlvo}`);
        
        // Agora usamos idAlvo, que garantimos que não é null
        await deleteDoc(doc(db, "sites", idAlvo));

        // 6. LIMPEZA E SUCESSO
        currentDocId = null; // Agora sim limpamos a global
        
        // Reset visual
        document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
        closeClientModal();
        
        await loadClients(); 

        alert(`SUCESSO: A loja '${idAlvo}' foi totalmente removida.`);

    } catch (e) {
        console.error("Erro na exclusão:", e);
        alert("Erro técnico ao excluir: " + e.message + "\n(Veja o console F12)");
        
        // Restaura o botão se der erro
        if(btnDelete) btnDelete.innerHTML = '<i class="fas fa-trash"></i> Excluir';
    }
}
function getNextCode() { if(allClients.length===0) return 1; return Math.max(...allClients.map(c=>parseInt(c.code)||0))+1; }
function filterClients(t) { const f = allClients.filter(c => (c.name||'').toLowerCase().includes(t.toLowerCase())); renderClients(f); }
window.generateSiteLink = () => { const n = document.getElementById('inp-name').value; if(n) { const s=n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-'); document.getElementById('inp-site-slug').value=s; document.getElementById('inp-site-link').value=`${PRODUCTION_DOMAIN}?site=${s}`; } }
window.copyToClipboard = (t) => navigator.clipboard.writeText(t).then(()=>alert("Copiado!"));
window.closeClientModal = () => { clientModal.classList.add('translate-y-full'); currentDocId=null; }
window.switchTab = (t) => { document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('hidden')); document.getElementById(`tab-${t}`).classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b=>b.className=b.dataset.target===t?"tab-btn px-3 py-1 text-[10px] font-bold rounded bg-gray-700 text-white":"tab-btn px-3 py-1 text-[10px] font-bold rounded text-gray-400 hover:text-white"); }