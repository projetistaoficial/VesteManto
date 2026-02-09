import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
        // Cores do Status (Lógica Corrigida aqui também)
        let badgeColor = 'text-green-500 bg-green-900/20 border-green-900';
        let statusText = 'Ativo';

        // Verifica Pausado PRIMEIRO
        if (client.status === 'pausado') {
            badgeColor = 'text-yellow-500 bg-yellow-900/20 border-yellow-900';
            statusText = 'Pausado';
        } 
        // Verifica Bloqueado/Inativo DEPOIS
        else if (client.status === 'bloqueado' || client.active === false) {
            badgeColor = 'text-red-500 bg-red-900/20 border-red-900';
            statusText = 'Bloqueado';
        }

        const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
        const displayName = client.name || 'Sem Nome'; // Fallback para undefined
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

            loadFinancials(docId);
        }
    } else {
        // NOVO
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        renderActionButtons('ativo');

        resetFinancialUI();
    }
    switchTab('cadastro');
}

// --- STATUS BADGE (CORRIGIDO AQUI) ---
function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
    
    // 1. PRIMEIRO VERIFICA SE ESTÁ PAUSADO
    if (status === 'pausado') {
        el.className = "bg-yellow-900/20 border border-yellow-900 text-yellow-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "PAUSADO";
    } 
    // 2. DEPOIS VERIFICA SE ESTÁ BLOQUEADO OU INATIVO
    else if (status === 'bloqueado' || active === false) {
        el.className = "bg-red-900/20 border border-red-900 text-red-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "BLOQUEADO";
    } 
    // 3. SE NÃO, ESTÁ ATIVO
    else {
        el.className = "bg-green-900/20 border border-green-900 text-green-500 text-[10px] font-bold rounded p-2 text-center uppercase w-full block";
        el.innerText = "ATIVO";
    }
}

// --- BOTÕES DE AÇÃO (Lógica também prioriza Pausado) ---
function renderActionButtons(status, active = true) {
    const container = document.getElementById('action-buttons-container');
    container.innerHTML = '';

    // 1. PAUSADO
    if (status === 'pausado') {
        container.innerHTML = `
            <div class="bg-yellow-900/20 border border-yellow-700 p-3 rounded mb-3 text-center">
                <p class="text-yellow-500 text-xs font-bold mb-2">LOJA PAUSADA</p>
                <button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-green-900/20">
                    <i class="fas fa-play"></i> Ativar Loja Novamente
                </button>
            </div>
        `;
    } 
    // 2. BLOQUEADO
    else if (status === 'bloqueado' || active === false) {
        container.innerHTML = `
            <div class="bg-red-900/20 border border-red-700 p-3 rounded mb-3 text-center">
                <p class="text-red-500 text-xs font-bold mb-2">LOJA BLOQUEADA</p>
                <button onclick="changeClientStatus('activate')" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded uppercase text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                    <i class="fas fa-unlock"></i> Desbloquear Loja
                </button>
            </div>
        `;
    } 
    // 3. ATIVO
    else {
        container.innerHTML = `
            <div class="flex gap-2">
                <button onclick="changeClientStatus('block')" class="bg-red-900/40 border border-red-800 text-red-400 hover:bg-red-600 hover:text-white px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition flex flex-col items-center gap-1 group">
                    <i class="fas fa-lock text-sm group-hover:scale-110 transition"></i> Bloquear
                </button>
                <button onclick="changeClientStatus('pause')" class="bg-yellow-900/40 border border-yellow-800 text-yellow-400 hover:bg-yellow-500 hover:text-black px-4 py-3 rounded font-bold uppercase text-[10px] w-1/2 transition flex flex-col items-center gap-1 group">
                    <i class="far fa-calendar-alt text-sm group-hover:scale-110 transition"></i> Pausar
                </button>
            </div>
        `;
    }
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




//====================================================================================================
//CARREGAR DADOS FINANCEIROS DOS CLIENTES:
let currentClientOrders = []; 

let cacheOrders = []; // Armazena os pedidos para filtrar por data sem nova consulta

async function loadFinancials(siteId) {
    resetFinanceiroUI();
    console.log(`Buscando financeiro para: ${siteId}`);

    try {
        // Tentativa 1: Subcoleção (sites/ID/orders)
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let snap = await getDocs(ordersRef);

        // Tentativa 2: Coleção Global (orders) se a primeira falhar
        if (snap.empty) {
            console.log("Subcoleção vazia. Tentando busca global...");
            ordersRef = query(collection(db, "orders"), where("siteId", "==", siteId));
            snap = await getDocs(ordersRef);
        }

        cacheOrders = [];
        snap.forEach(doc => cacheOrders.push(doc.data()));

        console.log(`Total de pedidos carregados: ${cacheOrders.length}`);
        processarDadosFinanceiros(cacheOrders);

    } catch (error) {
        console.error("Erro ao carregar dados financeiros:", error);
    }
}

function processarDadosFinanceiros(pedidos) {
    let stats = { pedidos: 0, vendas: 0, faturamento: 0, custos: 0 };
    const statusAprovados = ['approved', 'pago', 'entregue', 'concluido'];

    pedidos.forEach(p => {
        stats.pedidos++;
        
        // Verifica se a venda foi confirmada
        if (statusAprovados.includes(p.status?.toLowerCase())) {
            stats.vendas++;
            const total = parseFloat(p.total) || 0;
            const custo = parseFloat(p.totalCost || p.cost) || 0;
            
            stats.faturamento += total;
            stats.custos += custo;
        }
    });

    atualizarUIFinanceira(stats);
}

function filtrarFinanceiro() {
    const inicio = document.getElementById('fin-data-inicio').value;
    const fim = document.getElementById('fin-data-fim').value;

    if (!inicio || !fim) return alert("Selecione o período completo");

    const filtrados = cacheOrders.filter(p => {
        const dataPedido = new Date(p.createdAt).getTime();
        return dataPedido >= new Date(inicio).getTime() && dataPedido <= new Date(fim).getTime();
    });

    processarDadosFinanceiros(filtrados);
}

function atualizarUIFinanceira(s) {
    document.getElementById('fin-pedidos').innerText = s.pedidos;
    document.getElementById('fin-vendas').innerText = s.vendas;
    document.getElementById('fin-faturamento').innerText = s.faturamento.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    document.getElementById('fin-custos').innerText = s.custos.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    const lucro = s.faturamento - s.custos;
    document.getElementById('fin-lucro').innerText = lucro.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
}

function resetFinanceiroUI() {
    ['fin-pedidos', 'fin-vendas'].forEach(id => document.getElementById(id).innerText = '0');
    ['fin-faturamento', 'fin-custos', 'fin-lucro'].forEach(id => document.getElementById(id).innerText = 'R$ 0,00');
}


// Auxiliar de formatação
function formatMoney(val) {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// --- APLICAR FILTRO DE DATA ---
window.applyFinancialFilter = () => {
    const startVal = document.getElementById('fin-date-start').value;
    const endVal = document.getElementById('fin-date-end').value;

    if (!startVal || !endVal) return alert("Selecione a data inicial e final.");

    // Cria objetos Date (ajustando o fuso se necessário, aqui assumindo simples)
    const startDate = new Date(startVal);
    startDate.setHours(0, 0, 0, 0); // Começo do dia

    const endDate = new Date(endVal);
    endDate.setHours(23, 59, 59, 999); // Fim do dia

    calculateAndRenderStats(startDate, endDate);
}

// --- LIMPAR FILTRO ---
window.clearFinancialFilter = () => {
    document.getElementById('fin-date-start').value = '';
    document.getElementById('fin-date-end').value = '';
    calculateAndRenderStats(null, null); // Passa null para pegar tudo
}

// --- MOTOR DE CÁLCULO (O Cérebro) ---
function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0;
    let confirmedSales = 0;
    let totalRevenue = 0;
    let totalCosts = 0;

    currentClientOrders.forEach(order => {
        // 1. Filtro de Data
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) {
                return; // Pula esse pedido se estiver fora da data
            }
        }

        // 2. Contagem Geral
        totalOrders++;

        // 3. Verifica se é Venda Confirmada
        // Ajuste os status conforme o que seu checkout salva (ex: 'approved', 'paid', 'delivered')
        if (['approved', 'paid', 'delivered', 'shipped', 'completed'].includes(order.status)) {
            confirmedSales++;
            
            // Receita (O que entrou)
            const orderVal = parseFloat(order.total) || 0;
            totalRevenue += orderVal;

            // Custos (O que saiu)
            // Tenta pegar o custo do produto salvo no pedido (se seu sistema salva isso)
            // Se não tiver 'totalCost' no pedido, assumimos 0 ou você pode definir uma % padrão aqui
            const orderCost = parseFloat(order.totalCost) || 0; 
            totalCosts += orderCost;
        }
    });

    // Cálculo do Lucro
    const profit = totalRevenue - totalCosts;

    // --- ATUALIZAÇÃO DA TELA (DOM) ---
    animateValue("fin-orders", totalOrders);
    animateValue("fin-sales", confirmedSales);
    
    document.getElementById('fin-revenue').innerText = formatMoney(totalRevenue);
    document.getElementById('fin-costs').innerText = formatMoney(totalCosts);
    
    const profitEl = document.getElementById('fin-profit');
    profitEl.innerText = formatMoney(profit);
    
    // Cor do Lucro (Verde se positivo, Vermelho se prejuízo)
    if (profit >= 0) {
        profitEl.classList.remove('text-red-500');
        profitEl.classList.add('text-white');
    } else {
        profitEl.classList.add('text-red-500');
        profitEl.classList.remove('text-white');
    }
}

// --- AUXILIARES ---
function resetFinancialUI() {
    document.getElementById('fin-orders').innerText = "-";
    document.getElementById('fin-sales').innerText = "-";
    document.getElementById('fin-revenue').innerText = "...";
    document.getElementById('fin-costs').innerText = "...";
    document.getElementById('fin-profit').innerText = "...";
    // Limpa inputs de data visualmente
    document.getElementById('fin-date-start').value = '';
    document.getElementById('fin-date-end').value = '';
}


// Efeito visual de contagem
function animateValue(id, end) {
    const obj = document.getElementById(id);
    if(!obj) return;
    obj.innerText = end; // Simples update. Se quiser animação complexa, podemos adicionar depois.
}

// EXPOR FUNÇÕES PARA O HTML
window.applyFinancialFilter = applyFinancialFilter;
window.clearFinancialFilter = clearFinancialFilter;