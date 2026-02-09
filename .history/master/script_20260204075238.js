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
let currentClientOrders = []; // Cache de pedidos

const listContainer = document.getElementById('clients-list');
const clientModal = document.getElementById('client-modal');

window.addEventListener('DOMContentLoaded', () => {
    loadClients();
    
    // Funções Globais
    window.openClientModal = openClientModal;
    window.closeClientModal = closeClientModal;
    window.switchTab = switchTab;
    window.saveClientData = saveClientData;
    window.changeClientStatus = changeClientStatus;
    window.deleteCurrentClient = deleteCurrentClient;
    window.generateSiteLink = generateSiteLink;
    window.copyToClipboard = copyToClipboard;
    window.filtrarFinanceiro = filtrarFinanceiro;
    window.limparFiltroFinanceiro = limparFiltroFinanceiro;

    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.addEventListener('input', (e) => filterClients(e.target.value));
});

// --- CARREGAR LISTA ---
async function loadClients() {
    if(listContainer) listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Carregando...</div>';
    try {
        const snap = await getDocs(collection(db, "sites"));
        allClients = [];
        snap.forEach(doc => allClients.push({ docId: doc.id, ...doc.data() }));
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));
        renderClients(allClients);
    } catch (e) {
        console.error("Erro ao carregar:", e);
        if(listContainer) listContainer.innerHTML = '<div class="text-center text-red-500 mt-10 text-xs">Erro ao carregar lista</div>';
    }
}

function renderClients(clients) {
    if(!listContainer) return;
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
        const row = document.createElement('div');
        row.className = "grid grid-cols-12 gap-2 px-4 py-3 bg-[#161821] border-b border-gray-800 items-center hover:bg-[#1e2029] cursor-pointer transition rounded mb-1";
        
        row.onclick = (e) => {
            if(!e.target.closest('a') && !e.target.closest('button')) openClientModal(client.docId);
        };

        row.innerHTML = `
            <div class="col-span-1 text-center text-white font-bold text-xs">${client.code || '#'}</div>
            <div class="col-span-4 font-bold text-white truncate text-sm pl-2">${client.name || 'Sem Nome'}</div>
            <div class="col-span-3 text-center flex items-center justify-center gap-2 bg-[#0f1014] border border-gray-700 rounded px-2 py-1">
                 <a href="${fullLink}" target="_blank" class="text-blue-400 text-[10px] truncate w-full hover:underline">.../?site=${client.docId}</a>
                 <button onclick="copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white transition" title="Copiar"><i class="far fa-copy text-xs"></i></button>
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
    if(clientModal) clientModal.classList.remove('translate-y-full');

    // Reseta Form
    document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
    const slugInput = document.getElementById('inp-site-slug');
    if(slugInput) slugInput.disabled = false;
    
    // Reseta UI Financeira (Sem travar)
    resetFinanceiroUI();

    if (docId) {
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            safeSetText('modal-title', client.name || 'Editar');
            safeSetVal('inp-id', client.code);
            safeSetVal('inp-name', client.name);
            safeSetVal('inp-site-slug', client.docId);
            if(slugInput) slugInput.disabled = true;
            safeSetVal('inp-site-link', `${PRODUCTION_DOMAIN}?site=${client.docId}`);
            
            if (client.plan) safeSetVal('inp-plan', client.plan.name || '30 dias (Mensal)');

            // Dados do Dono (Híbrido)
            const owner = client.ownerData || {};
            safeSetVal('inp-owner', owner.name || client.ownerName || '');
            safeSetVal('inp-doc', owner.doc || client.cpf || '');
            safeSetVal('inp-insta', owner.insta || '');
            safeSetVal('inp-face', owner.face || '');
            safeSetVal('inp-yt', owner.yt || '');
            safeSetVal('inp-tel', owner.tel || client.phone || '');
            safeSetVal('inp-whats', owner.whats || client.whatsapp || '');
            safeSetVal('inp-email', owner.email || client.email || '');

            updateStatusBadge(client.status, client.active);
            renderActionButtons(client.status, client.active);
            
            // Carrega Financeiro
            loadFinancials(docId);
        }
    } else {
        // NOVO
        safeSetText('modal-title', "Novo Cliente");
        safeSetVal('inp-id', getNextCode());
        renderActionButtons('ativo');
        updateStatusBadge('ativo', true);
    }
    switchTab('cadastro');
}

// --- FINANCEIRO SEGURO (NÃO TRAVA) ---
async function loadFinancials(siteId) {
    resetFinanceiroUI(); 
    console.log(`Buscando financeiro para: ${siteId}`);

    try {
        // Tenta buscar na subcoleção
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let snap = await getDocs(ordersRef);

        // Se vazio, tenta global (depende das regras do Firebase estarem liberadas)
        if (snap.empty) {
            console.log("Subcoleção vazia. Tentando busca global...");
            const q = query(collection(db, "orders"), where("siteId", "==", siteId));
            snap = await getDocs(q);
        }

        currentClientOrders = [];
        snap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if(d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        calculateAndRenderStats();

    } catch (error) {
        console.error("Erro Financeiro:", error);
        safeSetText('fin-faturamento', 'Erro Perm.');
    }
}

function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0, confirmedSales = 0, totalRevenue = 0, totalCosts = 0;
    const validStatuses = ['approved', 'aprovado', 'paid', 'pago', 'delivered', 'entregue', 'concluido', 'completed', 'shipped'];

    currentClientOrders.forEach(order => {
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++;
        const status = (order.status || '').toLowerCase().trim();

        if (validStatuses.includes(status)) {
            confirmedSales++;
            
            let val = order.total;
            if (typeof val === 'string') val = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalRevenue += (val || 0);

            let cost = order.totalCost || order.cost || 0;
            if (typeof cost === 'string') cost = parseFloat(cost.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalCosts += (cost || 0);
        }
    });

    // Atualiza a tela usando função SEGURA (Nunca vai dar o erro 'Cannot set properties of null')
    safeSetText('fin-pedidos', totalOrders);
    safeSetText('fin-vendas', confirmedSales);
    safeSetText('fin-faturamento', formatMoney(totalRevenue));
    safeSetText('fin-custos', formatMoney(totalCosts));
    
    const profit = totalRevenue - totalCosts;
    const elLucro = document.getElementById('fin-lucro');
    if(elLucro) {
        elLucro.innerText = formatMoney(profit);
        elLucro.className = profit >= 0 ? "text-2xl font-bold text-white" : "text-2xl font-bold text-red-500";
    }
}

// --- FUNÇÕES AUXILIARES DE SEGURANÇA (O SEGREDO PARA NÃO QUEBRAR) ---
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function safeSetVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function resetFinanceiroUI() {
    safeSetText('fin-pedidos', '-');
    safeSetText('fin-vendas', '-');
    safeSetText('fin-faturamento', '...');
    safeSetText('fin-custos', '...');
    safeSetText('fin-lucro', '...');
    safeSetVal('fin-data-inicio', '');
    safeSetVal('fin-data-fim', '');
}

// --- FILTROS ---
function filtrarFinanceiro() {
    const s = document.getElementById('fin-data-inicio')?.value;
    const e = document.getElementById('fin-data-fim')?.value;
    if(!s || !e) return alert("Selecione data inicial e final.");
    
    const dS = new Date(s); dS.setHours(0,0,0,0);
    const dE = new Date(e); dE.setHours(23,59,59,999);
    calculateAndRenderStats(dS, dE);
}

function limparFiltroFinanceiro() {
    safeSetVal('fin-data-inicio', '');
    safeSetVal('fin-data-fim', '');
    calculateAndRenderStats(null, null);
}

// --- RESTO DO SISTEMA ---
function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
    if(!el) return;
    
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
    if(!container) return;
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
function animateValue(id, v) { safeSetText(id, v); }
async function deleteCurrentClient() { if(!currentDocId || !confirm("Excluir?")) return; try { await deleteDoc(doc(db, "sites", currentDocId)); closeClientModal(); loadClients(); } catch(e){ alert("Erro"); } }
function getNextCode() { if(allClients.length===0) return 1; return Math.max(...allClients.map(c=>parseInt(c.code)||0))+1; }
function filterClients(t) { const f = allClients.filter(c => (c.name||'').toLowerCase().includes(t.toLowerCase())); renderClients(f); }
window.generateSiteLink = () => { const n = document.getElementById('inp-name').value; if(n) { const s=n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-'); safeSetVal('inp-site-slug', s); safeSetVal('inp-site-link', `${PRODUCTION_DOMAIN}?site=${s}`); } }
window.copyToClipboard = (t) => navigator.clipboard.writeText(t).then(()=>alert("Copiado!"));
window.closeClientModal = () => { if(clientModal) clientModal.classList.add('translate-y-full'); currentDocId=null; }
window.switchTab = (t) => { document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('hidden')); document.getElementById(`tab-${t}`).classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b=>b.className=b.dataset.target===t?"tab-btn px-3 py-1 text-[10px] font-bold rounded bg-gray-700 text-white":"tab-btn px-3 py-1 text-[10px] font-bold rounded text-gray-400 hover:text-white"); }