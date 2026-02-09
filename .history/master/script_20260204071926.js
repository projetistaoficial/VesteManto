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
let currentClientOrders = []; // Variável global unificada para o financeiro

const listContainer = document.getElementById('clients-list');
const clientModal = document.getElementById('client-modal');

window.addEventListener('DOMContentLoaded', () => {
    loadClients();
    
    // Globais
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
        listContainer.innerHTML = '<div class="text-center text-red-500 mt-10 text-xs">Erro ao carregar</div>';
    }
}

// --- RENDERIZAR TABELA ---
function renderClients(clients) {
    listContainer.innerHTML = '';
    
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Nenhum cliente</div>';
        return;
    }

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

        const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
        const displayName = client.name || 'Sem Nome';
        const displayCode = client.code || '#';

        const row = document.createElement('div');
        row.className = "grid grid-cols-12 gap-2 px-4 py-3 bg-[#161821] border-b border-gray-800 items-center hover:bg-[#1e2029] cursor-pointer transition rounded mb-1";
        
        row.onclick = (e) => {
            if(!e.target.closest('a') && !e.target.closest('button')) openClientModal(client.docId);
        };

        row.innerHTML = `
            <div class="col-span-1 text-center text-white font-bold text-xs">${displayCode}</div>
            <div class="col-span-4 font-bold text-white truncate text-sm pl-2">${displayName}</div>
            
            <div class="col-span-3 text-center flex items-center justify-center gap-2 bg-[#0f1014] border border-gray-700 rounded px-2 py-1">
                 <a href="${fullLink}" target="_blank" class="text-blue-400 text-[10px] truncate w-full hover:underline">
                    .../?site=${client.docId}
                 </a>
                 <button onclick="copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white transition" title="Copiar">
                    <i class="far fa-copy text-xs"></i>
                 </button>
            </div>

            <div class="col-span-2 text-center text-gray-400 text-[10px]">${client.plan?.name || 'Mensal'}</div>
            <div class="col-span-2 text-center">
                <span class="${badgeColor} border px-2 py-1 rounded text-[10px] font-bold uppercase block w-24 mx-auto">
                    ${statusText}
                </span>
            </div>
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

    // Reset visual inicial
    updateStatusBadge('ativo', true);
    renderActionButtons(null);
    resetFinancialUI(); // Limpa dados financeiros antigos

    if (docId) {
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name || 'Editar Cliente';
            document.getElementById('inp-id').value = client.code;
            document.getElementById('inp-name').value = client.name;
            
            // Slug e Link
            document.getElementById('inp-site-slug').value = client.docId;
            document.getElementById('inp-site-slug').disabled = true;
            const link = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
            document.getElementById('inp-site-link').value = link;

            if (client.plan) document.getElementById('inp-plan').value = client.plan.name || '30 dias (Mensal)';
            if (client.ownerData) {
                document.getElementById('inp-owner').value = client.ownerData.name || '';
                document.getElementById('inp-doc').value = client.ownerData.doc || '';
                document.getElementById('inp-insta').value = client.ownerData.insta || '';
                document.getElementById('inp-face').value = client.ownerData.face || '';
                document.getElementById('inp-yt').value = client.ownerData.yt || '';
                document.getElementById('inp-tel').value = client.ownerData.tel || '';
                document.getElementById('inp-whats').value = client.ownerData.whats || '';
                document.getElementById('inp-email').value = client.ownerData.email || '';
            }
            
            // ATUALIZA VISUAL
            updateStatusBadge(client.status, client.active);
            renderActionButtons(client.status, client.active);

            // Carrega Financeiro
            loadFinancials(docId);
        }
    } else {
        // NOVO
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        renderActionButtons('ativo');
    }
    switchTab('cadastro');
}

// --- GERAR SLUG ---
window.generateSiteLink = () => {
    const name = document.getElementById('inp-name').value;
    if (!name) return alert("Digite o nome da loja");
    
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    document.getElementById('inp-site-slug').value = slug;
    document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${slug}`;
}

// --- SALVAR ---
async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    if (!slug || !name) return alert("Preencha Nome e Slug");
    
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
        plan: { name: document.getElementById('inp-plan').value },
        ...(!currentDocId && { code: parseInt(document.getElementById('inp-id').value), createdAt: new Date().toISOString(), status: 'ativo', active: true })
    };

    try {
        await setDoc(doc(db, "sites", docId), data, { merge: true });
        alert("Salvo!");
        closeClientModal();
        loadClients();
    } catch (e) { alert("Erro ao salvar: " + e.message); }
}

// --- MUDAR STATUS ---
async function changeClientStatus(action) {
    if (!currentDocId) return;
    let newStatus = 'ativo';
    let isActive = true;
    if (action === 'block') { newStatus = 'bloqueado'; isActive = false; }
    if (action === 'pause') { newStatus = 'pausado'; isActive = false; }
    try {
        await updateDoc(doc(db, "sites", currentDocId), { status: newStatus, active: isActive });
        updateStatusBadge(newStatus, isActive);
        renderActionButtons(newStatus, isActive);
        loadClients();
    } catch (e) { alert("Erro ao mudar status"); }
}

// --- STATUS BADGE ---
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

// --- BOTÕES DE AÇÃO ---
function renderActionButtons(status, active = true) {
    const container = document.getElementById('action-buttons-container');
    container.innerHTML = '';

    if (status === 'pausado') {
        container.innerHTML = `
            <div class="bg-yellow-900/20 border border-yellow-700 p-3 rounded mb-3 text-center">
                <p class="text-yellow-500 text-xs font-bold mb-2">LOJA PAUSADA</p>
                <button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20">
                    <i class="fas fa-play"></i> Ativar Loja Novamente
                </button>
            </div>`;
    } else if (status === 'bloqueado' || active === false) {
        container.innerHTML = `
            <div class="bg-red-900/20 border border-red-700 p-3 rounded mb-3 text-center">
                <p class="text-red-500 text-xs font-bold mb-2">LOJA BLOQUEADA</p>
                <button onclick="changeClientStatus('activate')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                    <i class="fas fa-unlock"></i> Desbloquear Loja
                </button>
            </div>`;
    } else {
        container.innerHTML = `
            <div class="flex gap-2">
                <button onclick="changeClientStatus('block')" class="bg-red-900/40 border border-red-800 text-red-400 hover:bg-red-600 hover:text-white px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition flex flex-col items-center gap-1 group">
                    <i class="fas fa-lock text-sm group-hover:scale-110 transition"></i> Bloquear
                </button>
                <button onclick="changeClientStatus('pause')" class="bg-yellow-900/40 border border-yellow-800 text-yellow-400 hover:bg-yellow-500 hover:text-black px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition flex flex-col items-center gap-1 group">
                    <i class="far fa-calendar-alt text-sm group-hover:scale-110 transition"></i> Pausar
                </button>
            </div>`;
    }
}

// ====================================================================================================
// --- LÓGICA FINANCEIRA UNIFICADA ---
// ====================================================================================================

async function loadFinancials(siteId) {
    resetFinancialUI();
    console.log(`🔍 Buscando financeiro para: ${siteId}`);

    try {
        // Tenta buscar na subcoleção do site
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let snap = await getDocs(ordersRef);

        // Se falhar (vazio), tenta buscar na coleção global filtrando por siteId
        if (snap.empty) {
            console.log("⚠️ Subcoleção vazia. Tentando busca global em 'orders'...");
            const q = query(collection(db, "orders"), where("siteId", "==", siteId));
            snap = await getDocs(q);
        }

        currentClientOrders = []; // Limpa o array global

        snap.forEach(doc => {
            const data = doc.data();
            
            // Tratamento robusto de data para o filtro funcionar
            let dateObj = new Date(); 
            if (data.createdAt) {
                // Tenta converter se for Timestamp do Firebase ou String
                dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            }

            currentClientOrders.push({
                ...data,
                dateObj: dateObj
            });
        });

        console.log(`✅ Total de pedidos carregados: ${currentClientOrders.length}`);
        
        // Renderiza tudo (sem filtro de data inicialmente)
        calculateAndRenderStats();

    } catch (error) {
        console.error("❌ Erro ao carregar dados financeiros:", error);
    }
}

// --- CÁLCULO E RENDERIZAÇÃO ---
function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0;
    let confirmedSales = 0;
    let totalRevenue = 0;
    let totalCosts = 0;

    // Lista de status considerados venda (Português e Inglês)
    const statusAprovados = [
        'approved', 'aprovado', 
        'paid', 'pago', 
        'delivered', 'entregue', 
        'shipped', 'enviado',
        'completed', 'concluido'
    ];

    currentClientOrders.forEach(order => {
        // 1. Filtro de Data
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++;

        // 2. Normaliza Status
        const status = (order.status || '').toLowerCase().trim();

        // 3. Verifica Venda
        if (statusAprovados.includes(status)) {
            confirmedSales++;

            // Trata Receita (string ou number)
            let val = 0;
            if (typeof order.total === 'number') val = order.total;
            else if (typeof order.total === 'string') {
                val = parseFloat(order.total.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            }
            totalRevenue += val;

            // Trata Custo (string ou number)
            let cost = 0;
            const rawCost = order.totalCost || order.cost || 0;
            if (typeof rawCost === 'number') cost = rawCost;
            else if (typeof rawCost === 'string') {
                cost = parseFloat(rawCost.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            }
            totalCosts += cost;
        }
    });

    // Atualiza DOM
    animateValue("fin-orders", totalOrders);
    animateValue("fin-sales", confirmedSales);
    document.getElementById('fin-revenue').innerText = formatMoney(totalRevenue);
    document.getElementById('fin-costs').innerText = formatMoney(totalCosts);
    
    const profit = totalRevenue - totalCosts;
    const profitEl = document.getElementById('fin-profit');
    profitEl.innerText = formatMoney(profit);
    
    if (profit >= 0) {
        profitEl.className = "text-3xl font-bold text-white drop-shadow-md"; // Verde/Branco
    } else {
        profitEl.className = "text-3xl font-bold text-red-500 drop-shadow-md"; // Prejuízo
    }
}

// --- FILTROS DE DATA ---
window.applyFinancialFilter = () => {
    const startVal = document.getElementById('fin-date-start').value;
    const endVal = document.getElementById('fin-date-end').value;

    if (!startVal || !endVal) return alert("Selecione a data inicial e final.");

    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999);

    calculateAndRenderStats(startDate, endDate);
}

window.clearFinancialFilter = () => {
    document.getElementById('fin-date-start').value = '';
    document.getElementById('fin-date-end').value = '';
    calculateAndRenderStats(null, null);
}

// --- AUXILIARES FINANCEIROS ---
function resetFinancialUI() {
    ['fin-orders', 'fin-sales'].forEach(id => document.getElementById(id).innerText = '-');
    ['fin-revenue', 'fin-costs', 'fin-profit'].forEach(id => document.getElementById(id).innerText = '...');
    document.getElementById('fin-date-start').value = '';
    document.getElementById('fin-date-end').value = '';
}

function formatMoney(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function animateValue(id, end) {
    const obj = document.getElementById(id);
    if(obj) obj.innerText = end;
}

// --- OUTROS ---
window.copyToClipboard = (text) => { navigator.clipboard.writeText(text).then(() => alert("Copiado!")); }
window.closeClientModal = () => { clientModal.classList.add('translate-y-full'); currentDocId = null; }
async function deleteCurrentClient() {
    if (!currentDocId) return;
    if (!confirm("Excluir?")) return;
    try { await deleteDoc(doc(db, "sites", currentDocId)); closeClientModal(); loadClients(); } catch (e) { alert("Erro"); }
}
function getNextCode() {
    if (allClients.length === 0) return 1;
    return Math.max(...allClients.map(c => parseInt(c.code) || 0)) + 1;
}
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-gray-700', 'text-white');
        btn.classList.add('text-gray-400');
        if (btn.dataset.target === tab) {
            btn.classList.add('bg-gray-700', 'text-white');
            btn.classList.remove('text-gray-400');
        }
    });
}
function filterClients(term) {
    const t = term.toLowerCase();
    const filtered = allClients.filter(c => (c.name || '').toLowerCase().includes(t));
    renderClients(filtered);
}