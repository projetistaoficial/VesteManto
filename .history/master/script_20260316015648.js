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

// Variáveis para segurar o status antes de salvar
let pendingClientStatus = 'ativo';
let pendingClientActive = true;

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
        
        updateClientCounters(); // <--- COLOQUE ESTA LINHA AQUI
        
        // Se estiver no modo de lote, não perde a seleção ao recarregar
        refreshClientList(); 
    } catch (e) {
        // ...
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    
    // --- 1. BARRA DE CONTROLES EM MASSA ---
    if (isClientSelectionMode) {
        const controlsBar = document.createElement('div');
        controlsBar.className = "flex flex-wrap justify-between items-center bg-[#161821] p-3 rounded-t-lg border-b border-gray-800 mb-2 gap-2 sticky top-0 z-10 shadow-md";
        
        const count = selectedClients.size;
        const allSelected = clients.length > 0 && clients.every(c => selectedClients.has(c.docId));
        
        controlsBar.innerHTML = `
            <div class="flex items-center gap-3 pl-2">
                <input type="checkbox" id="master-check-clients" onchange="toggleSelectAllClients(this)" ${allSelected ? 'checked' : ''} class="cursor-pointer w-5 h-5 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0">
                <label for="master-check-clients" class="text-sm text-gray-400 font-bold uppercase tracking-wider cursor-pointer select-none hover:text-white transition">
                    Selecionar Todos
                </label>
            </div>
            
            <div class="flex items-center gap-2">
                ${count > 0 ? `
                    <span class="text-white text-xs font-bold bg-blue-600 px-3 py-2 rounded">${count} Loja${count > 1 ? 's' : ''}</span>
                    <button onclick="bulkChangeStatus('ativo')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm">
                        <i class="fas fa-play"></i> Ativar
                    </button>
                    <button onclick="bulkChangeStatus('pausado')" class="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm">
                        <i class="fas fa-pause"></i> Pausar
                    </button>
                    <button onclick="bulkChangeStatus('bloqueado')" class="bg-red-900 hover:bg-red-800 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 border border-red-700 shadow-sm">
                        <i class="fas fa-lock"></i> Bloquear
                    </button>
                    <div class="w-px h-6 bg-gray-700 mx-1"></div>
                    <button onclick="bulkDeleteClients()" class="bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded text-xs uppercase font-bold transition flex items-center gap-1 shadow-sm">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                ` : `
                    <span class="text-gray-500 text-xs font-bold px-3 py-2">Selecione clientes para ver as ações</span>
                `}
            </div>
        `;
        listContainer.appendChild(controlsBar);
    }

    // --- 2. VERIFICA SE ESTÁ VAZIO ---
    if (clients.length === 0) {
        listContainer.innerHTML += '<div class="text-center text-gray-500 mt-10 text-sm py-8 bg-[#161821] rounded-lg">Nenhum cliente encontrado</div>';
        return;
    }

    // --- 3. RENDERIZA OS CLIENTES ---
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
        const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
        
        // Puxa o Documento (CPF ou CNPJ)
        const docText = (client.ownerData && client.ownerData.doc) ? client.ownerData.doc : (client.cpf || client.cnpj || 'Sem Documento');
        
        const row = document.createElement('div');
        // Aumentei o py-3 para py-4 para dar mais respiro nas linhas
        row.className = `grid grid-cols-12 gap-3 px-4 py-4 ${bgClass} border-b items-center cursor-pointer transition rounded mb-1 select-none`;
        
        row.onclick = (e) => {
            if (isClientSelectionMode) {
                if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'A' && e.target.tagName !== 'I') {
                    toggleClientSelection(client.docId);
                }
            } else {
                if(!e.target.closest('a') && !e.target.closest('button')) {
                    openClientModal(client.docId);
                }
            }
        };

        const firstCol = isClientSelectionMode 
            ? `<div class="col-span-1 flex justify-start pl-1"><input type="checkbox" class="w-5 h-5 cursor-pointer pointer-events-none rounded border-gray-600 text-blue-500" ${isChecked}></div>` 
            : `<div class="col-span-1 text-center text-gray-400 font-bold text-sm">${client.code || '#'}</div>`; // ID agora é text-sm

        row.innerHTML = `
            ${firstCol}
            <div class="col-span-3 font-bold text-white truncate text-base" title="${client.name || ''}">${client.name || 'Sem Nome'}</div>
            
            <div class="col-span-2 text-center text-gray-300 text-sm font-mono truncate" title="${docText}">${docText}</div>
            
            <div class="col-span-2 text-center flex items-center justify-center gap-2 bg-[#0f1014] border border-gray-700 rounded px-3 py-1.5">
                 <a href="${fullLink}" target="_blank" onclick="event.stopPropagation()" class="text-blue-400 text-xs truncate w-full hover:underline">.../?site=${client.docId}</a>
                 <button onclick="event.stopPropagation(); copyToClipboard('${fullLink}')" class="text-gray-400 hover:text-white transition" title="Copiar"><i class="far fa-copy text-sm"></i></button>
            </div>
            
            <div class="col-span-2 text-center text-gray-300 text-sm truncate">${client.plan?.name || '30 dias (Mensal)'}</div>
            
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
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name || 'Editar';
            document.getElementById('inp-id').value = client.code || '';
            document.getElementById('inp-name').value = client.name || '';
            document.getElementById('inp-site-slug').value = client.docId || '';
            document.getElementById('inp-site-slug').disabled = true;
            document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${client.docId}`
            // ...
document.getElementById('inp-id').value = client.code || '';
document.getElementById('inp-alt-code').value = client.altCode || ''; // <--- ADICIONE ESTA LINHA
document.getElementById('inp-name').value = client.name || '';
// ...

            if (client.plan) document.getElementById('inp-plan').value = client.plan.name || '30 dias (Mensal)';
            
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
            if(document.getElementById('inp-cep')) document.getElementById('inp-cep').value = address.cep || '';
            if(document.getElementById('inp-rua')) document.getElementById('inp-rua').value = address.rua || '';
            if(document.getElementById('inp-numero')) document.getElementById('inp-numero').value = address.numero || '';
            if(document.getElementById('inp-complemento')) document.getElementById('inp-complemento').value = address.complemento || '';
            if(document.getElementById('inp-bairro')) document.getElementById('inp-bairro').value = address.bairro || '';
            if(document.getElementById('inp-cidade')) document.getElementById('inp-cidade').value = address.cidade || '';
            if(document.getElementById('inp-uf')) document.getElementById('inp-uf').value = address.uf || '';

            const access = client.access || {};
            const elPassAdmin = document.getElementById('inp-pass-admin');
            const elPassDev = document.getElementById('inp-pass-dev');
            if (elPassAdmin) elPassAdmin.value = access.admin || '';
            if (elPassDev) elPassDev.value = access.dev || '';

            // CARREGA O STATUS PARA A MEMÓRIA
            pendingClientStatus = client.status || 'ativo';
            pendingClientActive = client.active !== false;

            updateStatusBadge(pendingClientStatus, pendingClientActive);
            renderActionButtons(pendingClientStatus, pendingClientActive);
            loadFinancials(docId);
        }
    } else {
        // NOVO CLIENTE
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        
        // ZERA A MEMÓRIA PARA ATIVO
        pendingClientStatus = 'ativo';
        pendingClientActive = true;

        renderActionButtons(pendingClientStatus, pendingClientActive);
        updateStatusBadge(pendingClientStatus, pendingClientActive);
    }
    switchTab('cadastro');
}

// --- SALVAR DADOS ---
async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    if (!slug || !name) return alert("Preencha Nome e Slug");
    
    const elPassAdmin = document.getElementById('inp-pass-admin');
    const elPassDev = document.getElementById('inp-pass-dev');

    const docId = currentDocId || slug;
    
    const data = {
        name: name,
        // SALVA O STATUS QUE ESTÁ NA MEMÓRIA
        status: pendingClientStatus,
        active: pendingClientActive,
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
        plan: { name: document.getElementById('inp-plan').value }
    };

    if (!currentDocId) {
        data.code = parseInt(document.getElementById('inp-id').value);
        data.createdAt = new Date().toISOString();
    }

    try {
        await setDoc(doc(db, "sites", docId), data, { merge: true });
        
        if (typeof showToast === 'function') {
            showToast("Dados salvos com sucesso!");
        } else {
            alert("Salvo com sucesso!");
        }
        
        closeClientModal();
        loadClients(); 
    } catch (e) { 
        alert("Erro ao salvar: " + e.message); 
    }
}

// =================================================================
// FUNÇÃO DE BUSCA DE CEP AUTOMÁTICA (ViaCEP)
// =================================================================
window.buscarCep = async (cep) => {
    if (!cep) return;

    // Remove tudo que não for número (ex: traços, pontos)
    const cepLimpo = cep.replace(/\D/g, ''); 
    
    // Se não tiver exatamente 8 números, avisa o erro e para
    if (cepLimpo.length !== 8) {
        alert("CEP inválido. Digite um CEP com 8 números.");
        return;
    }

    // Coloca um aviso de "Buscando..." enquanto a internet carrega
    document.getElementById('inp-rua').value = "Buscando...";
    document.getElementById('inp-bairro').value = "...";
    document.getElementById('inp-cidade').value = "...";
    document.getElementById('inp-uf').value = "...";

    try {
        // Vai nos Correios (ViaCEP) buscar os dados
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();

        // Se o CEP não existir nos correios
        if (data.erro) {
            alert("CEP não encontrado nos Correios.");
            document.getElementById('inp-rua').value = "";
            document.getElementById('inp-bairro').value = "";
            document.getElementById('inp-cidade').value = "";
            document.getElementById('inp-uf').value = "";
            return;
        }

        // Se deu certo, preenche os campos automaticamente
        document.getElementById('inp-rua').value = data.logradouro || '';
        document.getElementById('inp-bairro').value = data.bairro || '';
        document.getElementById('inp-cidade').value = data.localidade || '';
        document.getElementById('inp-uf').value = data.uf || '';
        
        // Joga o cursor piscando direto pro campo "Número" para facilitar a vida
        document.getElementById('inp-numero').focus();

    } catch (error) {
        console.error("Erro ao conectar com ViaCEP:", error);
        alert("Erro na conexão ao buscar o CEP. Verifique a internet.");
    }
};
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


// --- MUDAR STATUS (AGORA SÓ MUDA NA TELA, ESPERA O SALVAR) ---
window.changeClientStatus = (action) => {
    if (action === 'block') { 
        pendingClientStatus = 'bloqueado'; 
        pendingClientActive = false; 
    }
    else if (action === 'pause') { 
        pendingClientStatus = 'pausado'; 
        pendingClientActive = false; 
    }
    else if (action === 'activate') { 
        pendingClientStatus = 'ativo'; 
        pendingClientActive = true; 
    }

    // Atualiza a cor da etiqueta e os botões na tela
    updateStatusBadge(pendingClientStatus, pendingClientActive);
    renderActionButtons(pendingClientStatus, pendingClientActive);
};

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

// --- VARIÁVEL GLOBAL DO FILTRO ---
let currentStatusFilter = 'todos';

// --- FUNÇÃO PARA ATUALIZAR OS NÚMEROS DAS ETIQUETAS ---
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

// --- FUNÇÃO DE CLIQUE NO DROPDOWN ---
window.filterByStatus = (status) => {
    currentStatusFilter = status;
    
    // Altera o texto do botão
    const nomes = { 'todos': 'Todos', 'ativo': 'Ativos', 'pausado': 'Pausados', 'bloqueado': 'Bloqueados' };
    document.getElementById('current-status-filter').innerText = nomes[status];
    
    // Esconde o menu
    document.getElementById('status-dropdown').classList.add('hidden');
    
    // Puxa o que estiver digitado na busca e refaz o filtro
    const term = document.getElementById('search-input').value;
    filterClients(term);
};

// --- BUSCA HÍBRIDA (TEXTO, DOCUMENTO + STATUS) ---
window.filterClients = (searchTerm = '') => {
    const term = searchTerm.toLowerCase().trim();
    // Limpa pontos e traços para facilitar a busca de CPF/CNPJ
    const cleanTerm = term.replace(/\D/g, ''); 
    
    const filtered = allClients.filter(c => {
        // 1. Regra do Texto Principal (Nome, Slug ou ID)
        const matchName = (c.name || '').toLowerCase().includes(term);
        const matchSlug = (c.docId || '').toLowerCase().includes(term);
        const matchCode = c.code ? String(c.code).includes(term) : false;
        
        // 2. Regra do Documento (CPF/CNPJ)
        const docText = (c.ownerData && c.ownerData.doc) ? c.ownerData.doc : (c.cpf || c.cnpj || '');
        const docTextClean = docText.replace(/\D/g, ''); // Tira pontos do doc original para comparar
        
        // Compara tanto o texto digitado normal quanto apenas os números
        const matchDoc = docText.toLowerCase().includes(term) || (cleanTerm !== '' && docTextClean.includes(cleanTerm));

        const textMatch = term === '' || matchName || matchSlug || matchCode || matchDoc;
        
        // 3. Regra do Status (Filtro Dropdown)
        let statusMatch = true;
        if (currentStatusFilter !== 'todos') {
            let s = 'ativo';
            if (c.status === 'pausado') s = 'pausado';
            else if (c.status === 'bloqueado' || c.active === false) s = 'bloqueado';
            
            statusMatch = (s === currentStatusFilter);
        }
        
        // Só exibe se passar nas regras
        return textMatch && statusMatch;
    });
    
    renderClients(filtered);
};

window.generateSiteLink = () => { const n = document.getElementById('inp-name').value; if(n) { const s=n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'-'); document.getElementById('inp-site-slug').value=s; document.getElementById('inp-site-link').value=`${PRODUCTION_DOMAIN}?site=${s}`; } }
window.copyToClipboard = (t) => navigator.clipboard.writeText(t).then(()=>alert("Copiado!"));
window.closeClientModal = () => { clientModal.classList.add('translate-y-full'); currentDocId=null; }
window.switchTab = (t) => { document.querySelectorAll('.tab-content').forEach(e=>e.classList.add('hidden')); document.getElementById(`tab-${t}`).classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b=>b.className=b.dataset.target===t?"tab-btn px-3 py-1 text-[10px] font-bold rounded bg-gray-700 text-white":"tab-btn px-3 py-1 text-[10px] font-bold rounded text-gray-400 hover:text-white"); }


// =================================================================
// FUNÇÕES DE AÇÃO EM MASSA (LOTE)
// =================================================================

// Atualiza a tela baseada no filtro de busca atual
function refreshClientList() {
    const searchInput = document.getElementById('search-input');
    const term = searchInput ? searchInput.value : '';
    filterClients(term);
}

// Liga/Desliga o modo de seleção
window.toggleClientSelectionMode = () => {
    isClientSelectionMode = !isClientSelectionMode;
    if (!isClientSelectionMode) selectedClients.clear();
    
    // Controle visual dos botões no rodapé
    const btnSel = document.getElementById('btn-selecionar-lote');
    const btnCan = document.getElementById('btn-cancelar-lote');
    
    if(btnSel && btnCan) {
        if(isClientSelectionMode) {
            btnSel.classList.add('hidden');
            btnCan.classList.remove('hidden');
        } else {
            btnSel.classList.remove('hidden');
            btnCan.classList.add('hidden');
        }
    }
    
    refreshClientList();
};

// Seleciona um cliente específico
window.toggleClientSelection = (docId) => {
    if (selectedClients.has(docId)) selectedClients.delete(docId);
    else selectedClients.add(docId);
    refreshClientList();
};

// Seleciona Todos da lista atual
window.toggleSelectAllClients = (checkbox) => {
    const searchInput = document.getElementById('search-input');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Pega só os visíveis se houver filtro
    const visibleClients = term 
        ? allClients.filter(c => (c.name||'').toLowerCase().includes(term))
        : allClients;

    if (checkbox.checked) {
        visibleClients.forEach(c => selectedClients.add(c.docId));
    } else {
        selectedClients.clear();
    }
    refreshClientList();
};

// Pausar/Ativar em Lote
window.bulkChangeStatus = async (newStatus) => {
    const count = selectedClients.size;
    let actionText = newStatus === 'ativo' ? 'ATIVAR' : 'PAUSAR';
    
    if(!confirm(`Tem certeza que deseja ${actionText} ${count} loja(s)?`)) return;

    try {
        // Mostra loading no botão
        document.body.style.cursor = 'wait';
        
        const updatePromises = Array.from(selectedClients).map(docId => {
            const isActive = newStatus === 'ativo';
            return updateDoc(doc(db, "sites", docId), { status: newStatus, active: isActive });
        });
        
        await Promise.all(updatePromises);
        
        alert(`${count} loja(s) atualizada(s) para ${newStatus.toUpperCase()}!`);
        selectedClients.clear();
        isClientSelectionMode = false;
        await loadClients(); // Recarrega do banco
        
    } catch (e) {
        console.error("Erro em lote:", e);
        alert("Erro ao atualizar em lote.");
    } finally {
        document.body.style.cursor = 'default';
    }
};

// Excluir em Lote (Com limpeza profunda)
window.bulkDeleteClients = async () => {
    const count = selectedClients.size;
    const confirmacao = prompt(`ATENÇÃO EXTREMA!\n\nVocê está prestes a EXCLUIR DEFINITIVAMENTE ${count} loja(s) e TODOS os seus dados (produtos, vendas, etc).\n\nDigite DELETAR para confirmar:`);
    
    if(confirmacao !== "DELETAR") return alert("Ação cancelada.");

    try {
        document.body.style.cursor = 'wait';
        const subcollections = ['products', 'categories', 'sales', 'orders', 'coupons', 'settings', 'dailyStats'];
        
        // Exclui loja por loja para garantir que todas as subcoleções sejam limpas
        for (const docId of selectedClients) {
            console.log(`Apagando dados da loja: ${docId}`);
            
            for (const subColName of subcollections) {
                const colRef = collection(db, `sites/${docId}/${subColName}`); 
                const snapshot = await getDocs(colRef);
                
                if (!snapshot.empty) {
                    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
                    await Promise.all(deletePromises);
                }
            }
            // Apaga documento raiz
            await deleteDoc(doc(db, "sites", docId));
        }

        alert(`SUCESSO: ${count} loja(s) apagada(s) permanentemente.`);
        selectedClients.clear();
        isClientSelectionMode = false;
        await loadClients();

    } catch (e) {
        console.error("Erro exclusão lote:", e);
        alert("Erro durante a exclusão em lote. Veja o console (F12).");
    } finally {
        document.body.style.cursor = 'default';
    }
};


// =================================================================
// SISTEMA DE NOTIFICAÇÃO FLUTUANTE (TOAST)
// =================================================================
window.showToast = (message) => {
    // 1. Verifica se já existe o container das notificações, se não, cria.
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-5 right-5 z-[999999] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    // 2. Cria a notificação com tons de verde (Sucesso)
    const toast = document.createElement('div');
    toast.className = 'bg-green-900/90 border border-green-500 text-green-400 px-6 py-3 rounded shadow-lg shadow-green-900/20 font-bold text-sm transform transition-all duration-300 translate-x-full opacity-0 flex items-center gap-2 backdrop-blur-sm';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;

    container.appendChild(toast);

    // 3. Animação de entrada (desliza da direita)
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // 4. Animação de saída e remoção (após 3 segundos)
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300); // Aguarda a animação terminar para remover do HTML
    }, 3000);
};