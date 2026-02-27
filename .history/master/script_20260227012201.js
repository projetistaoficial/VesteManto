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
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Nenhum cliente</div>';
        return;
    }

    clients.forEach(client => {
        let badgeColor = 'text-green-500 bg-green-900/20 border-green-900';
        let statusText = 'Ativo';

        // Lógica de Status
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

// --- FINANCEIRO ---
async function loadFinancials(siteId) {
    resetFinancialUI(); // Limpa visualmente antes de carregar
    
    try {
        currentClientOrders = []; // Zera a lista para preencher

        // 1. Busca na coleção NOVA ('sales' - onde os pedidos atuais caem)
        let salesRef = collection(db, `sites/${siteId}/sales`);
        let salesSnap = await getDocs(salesRef);
        
        salesSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            // Aceita o formato novo (date) ou antigo (createdAt)
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        // 2. Busca na coleção ANTIGA ('orders' - legado/clientes velhos)
        let ordersRef = collection(db, `sites/${siteId}/orders`);
        let ordersSnap = await getDocs(ordersRef);

        ordersSnap.forEach(doc => {
            const d = doc.data();
            let dateObj = new Date();
            if (d.date) dateObj = new Date(d.date);
            else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
            currentClientOrders.push({ ...d, dateObj });
        });

        // 3. Se AMBAS estiverem vazias, tenta a global (Fallback do seu código original)
        if (salesSnap.empty && ordersSnap.empty) {
            console.log("Subcoleções vazias. Tentando busca global...");
            const q = query(collection(db, "orders"), where("siteId", "==", siteId));
            const globalSnap = await getDocs(q);
            
            globalSnap.forEach(doc => {
                const d = doc.data();
                let dateObj = new Date();
                if (d.date) dateObj = new Date(d.date);
                else if (d.createdAt) dateObj = d.createdAt.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
                currentClientOrders.push({ ...d, dateObj });
            });
        }

        // Chama a função para calcular os totais
        calculateAndRenderStats();

    } catch (error) {
        console.error("Erro Financeiro (Verifique as Regras do Firestore):", error);
        // Fallback pro id em português ou inglês dependendo do seu HTML
        const elRev = document.getElementById('fin-revenue') || document.getElementById('fin-faturamento');
        if (elRev) elRev.innerText = "Erro Perm.";
    }
}

function calculateAndRenderStats(startDate = null, endDate = null) {
    let totalOrders = 0, confirmedSales = 0, totalRevenue = 0, totalCosts = 0;
    
    // LISTA ESTRITA: Apenas status de vendas FINALIZADAS contam no faturamento
    const validStatuses = [
        'confirmado',           // Antigo (Legado - onde estão as suas 2 vendas)
        'entregue',             // Universal (Finalizado na porta do cliente)
        'concluído',            // Universal (Finalizado no sistema)
        'concluido'             // Sem acento (Garantia contra erros de digitação)
    ];

    currentClientOrders.forEach(order => {
        if (startDate && endDate) {
            if (order.dateObj < startDate || order.dateObj > endDate) return;
        }

        totalOrders++; // "Pedidos" soma tudo (é o total de intenções de compra)
        
        const status = (order.status || '').toLowerCase().trim();

        // "Vendas" e "Faturamento" só somam se o status estiver na lista estrita acima
        if (validStatuses.includes(status)) {
            confirmedSales++; // Conta como venda efetivada
            
            // 1. Soma Faturamento
            let val = order.total || 0;
            if (typeof val === 'string') {
                val = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0;
            }
            totalRevenue += val;

            // 2. Soma Custo (Calculando de dentro dos itens do carrinho)
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

    // Atualiza os elementos visuais na tela
    animateValue("fin-pedidos", totalOrders); // Vai mostrar 3 (ou o total real de pedidos)
    animateValue("fin-vendas", confirmedSales); // Vai mostrar 2 (ou apenas os finalizados)
    
    const elFaturamento = document.getElementById('fin-faturamento');
    if (elFaturamento) elFaturamento.innerText = formatMoney(totalRevenue);
    
    const elCustos = document.getElementById('fin-custos');
    if (elCustos) elCustos.innerText = formatMoney(totalCosts);
    
    const profit = totalRevenue - totalCosts;
    const elLucro = document.getElementById('fin-lucro');
    if (elLucro) {
        elLucro.innerText = formatMoney(profit);
        elLucro.className = profit >= 0 ? "text-2xl font-bold text-white" : "text-2xl font-bold text-red-500";
    }
}

// --- FILTROS DE DATA ---
window.applyFinancialFilter = () => {
    const s = document.getElementById('fin-data-inicio').value;
    const e = document.getElementById('fin-data-fim').value;
    if(!s || !e) return alert("Selecione as datas");
    
    const dS = new Date(s); dS.setHours(0,0,0,0);
    const dE = new Date(e); dE.setHours(23,59,59,999);
    calculateAndRenderStats(dS, dE);
}

window.clearFinancialFilter = () => {
    document.getElementById('fin-data-inicio').value = '';
    document.getElementById('fin-data-fim').value = '';
    calculateAndRenderStats(null, null);
}

// --- UTILS ---
function resetFinancialUI() {
    ['fin-pedidos', 'fin-vendas'].forEach(id => document.getElementById(id).innerText = '-');
    ['fin-faturamento', 'fin-custos', 'fin-lucro'].forEach(id => document.getElementById(id).innerText = '...');
    document.getElementById('fin-data-inicio').value = '';
    document.getElementById('fin-data-fim').value = '';
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