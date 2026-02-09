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
    clientModal.classList.remove('translate-y-full');

    // Reseta Form
    document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toLocaleDateString('pt-BR');
    
    // CORREÇÃO CRÍTICA: Nome da função corrigido para resetFinancialUI
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
            
            // Híbrido: Tenta ler dados novos ou antigos
            const owner = client.ownerData || {};
            
            document.getElementById('inp-owner').value = owner.name || client.ownerName || '';
            document.getElementById('inp-doc').value = owner.doc || client.cpf || client.cnpj || '';
            document.getElementById('inp-insta').value = owner.insta || client.instagram || '';
            document.getElementById('inp-face').value = owner.face || client.facebook || '';
            document.getElementById('inp-yt').value = owner.yt || client.youtube || '';
            document.getElementById('inp-tel').value = owner.tel || client.phone || client.whatsapp || '';
            document.getElementById('inp-whats').value = owner.whats || client.whatsapp || '';
            document.getElementById('inp-email').value = owner.email || client.email || '';

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

// --- FINANCEIRO ---
async function loadFinancials(siteId) {
    resetFinanceiroUI(); // Limpa a tela antes de começar
    console.log(`🔍 Buscando financeiro para: ${siteId}`);

    try {
        // Tenta buscar na pasta do cliente
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let snap = await getDocs(ordersRef);

        // Se não achar nada, tenta buscar na pasta geral
        if (snap.empty) {
            console.log("⚠️ Subcoleção vazia. Tentando busca global...");
            // IMPORTANTE: Isso precisa da Regra de Segurança liberada no Firebase
            const q = query(collection(db, "orders"), where("siteId", "==", siteId));
            snap = await getDocs(q);
        }

        cacheOrders = [];
        snap.forEach(doc => {
            const data = doc.data();
            // Tratamento seguro de data
            let dateObj = new Date();
            if(data.createdAt) {
                dateObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
            }
            cacheOrders.push({ ...data, dateObj });
        });

        console.log(`✅ Pedidos carregados: ${cacheOrders.length}`);
        calculateAndRenderStats(); // Calcula tudo (sem filtro de data)

    } catch (error) {
        console.error("❌ Erro Financeiro:", error);
        safeSetText('fin-faturamento', "Erro Acesso");
    }
}

// 2. CÁLCULO E EXIBIÇÃO
function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0;
    let confirmedSales = 0;
    let totalRevenue = 0;
    let totalCosts = 0;

    // Lista de status considerados "Venda Realizada"
    const validStatuses = ['approved', 'aprovado', 'paid', 'pago', 'delivered', 'entregue', 'concluido', 'completed', 'shipped'];

    cacheOrders.forEach(order => {
        // Filtro de Data
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++;
        const status = (order.status || '').toLowerCase().trim();

        if (validStatuses.includes(status)) {
            confirmedSales++;
            
            // Soma Receita (limpa caracteres estranhos)
            let val = order.total;
            if (typeof val === 'string') val = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalRevenue += (val || 0);

            // Soma Custos
            let cost = order.totalCost || order.cost || 0;
            if (typeof cost === 'string') cost = parseFloat(cost.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            totalCosts += (cost || 0);
        }
    });

    // Atualiza a tela usando função segura
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

// 3. FUNÇÕES DE FILTRO
window.filtrarFinanceiro = () => {
    const s = document.getElementById('fin-data-inicio')?.value;
    const e = document.getElementById('fin-data-fim')?.value;

    if (!s || !e) return alert("Selecione data inicial e final.");

    const dS = new Date(s); dS.setHours(0,0,0,0);
    const dE = new Date(e); dE.setHours(23,59,59,999);
    
    calculateAndRenderStats(dS, dE);
}

window.limparFiltroFinanceiro = () => {
    const i1 = document.getElementById('fin-data-inicio');
    const i2 = document.getElementById('fin-data-fim');
    if(i1) i1.value = '';
    if(i2) i2.value = '';
    
    calculateAndRenderStats(null, null);
}

// 4. UTILITÁRIOS SEGUROS (Para não travar se o HTML mudar)
function resetFinanceiroUI() {
    safeSetText('fin-pedidos', '-');
    safeSetText('fin-vendas', '-');
    safeSetText('fin-faturamento', '...');
    safeSetText('fin-custos', '...');
    safeSetText('fin-lucro', '...');
    
    const i1 = document.getElementById('fin-data-inicio');
    const i2 = document.getElementById('fin-data-fim');
    if(i1) i1.value = '';
    if(i2) i2.value = '';
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function formatMoney(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Atalho para manter compatibilidade com HTML antigo se houver
window.applyFinancialFilter = window.filtrarFinanceiro;
window.clearFinancialFilter = window.limparFiltroFinanceiro;