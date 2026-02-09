import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// === SUA CONFIG FIREBASE ===
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

// === CONFIGURAÇÃO DO DOMÍNIO ===
const PRODUCTION_DOMAIN = "https://projetistaoficial.github.io/VesteManto/";

let allClients = [];
let currentDocId = null;
let isSelectionMode = false;
let selectedClientIds = new Set();

// Elementos Globais
const listContainer = document.getElementById('clients-list');
const modal = document.getElementById('client-modal');
const searchInput = document.getElementById('search-input');

window.addEventListener('DOMContentLoaded', () => {
    loadClients();

    // Expor funções globais
    window.openClientModal = openClientModal;
    window.closeClientModal = closeClientModal;
    window.switchTab = switchTab;
    window.saveClientData = saveClientData;
    window.changeClientStatus = changeClientStatus;
    window.deleteCurrentClient = deleteCurrentClient;
    window.generateSiteLink = generateSiteLink;
    window.handleSelect = handleSelect; // Expor handleSelect também
    window.copyToClipboard = copyToClipboard;

    // Listeners
    if(searchInput) searchInput.addEventListener('input', (e) => filterClients(e.target.value));
    
    const btnSelect = document.getElementById('btn-select-mode');
    if(btnSelect) btnSelect.addEventListener('click', toggleSelectionMode);
    
    const btnDelete = document.getElementById('btn-delete-selected');
    if(btnDelete) btnDelete.addEventListener('click', deleteSelectedClients);
});

// --- FUNÇÃO DE AUTO INCREMENTO ---
function getNextCode() {
    if (allClients.length === 0) return 1;
    const maxCode = allClients.reduce((max, client) => {
        const code = parseInt(client.code) || 0;
        return code > max ? code : max;
    }, 0);
    return maxCode + 1;
}

// --- GERADOR DE LINK ---
window.generateSiteLink = () => {
    const nameInput = document.getElementById('inp-name').value;
    const slugInput = document.getElementById('inp-site-slug');
    const previewText = document.getElementById('preview-url');

    if (!nameInput) return alert("Digite o nome da loja primeiro!");

    const slug = nameInput.toString().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-');

    slugInput.value = slug;
    previewText.innerText = `${PRODUCTION_DOMAIN}?site=${slug}`;
};

// --- CARREGAMENTO ---
async function loadClients() {
    if(listContainer) listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Carregando...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, "sites"));
        allClients = [];
        querySnapshot.forEach(doc => {
            allClients.push({ docId: doc.id, ...doc.data() });
        });

        // Ordenar por código
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));
        renderClients(allClients);
    } catch (error) {
        console.error(error);
        if(listContainer) listContainer.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar.</div>';
    }
}

function renderClients(clients) {
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Nenhum cliente.</div>';
        return;
    }

    clients.forEach(client => {
        let statusClass = 'ativo';
        let statusLabel = 'ATIVO';

        if (client.status === 'pausado') {
            statusClass = 'pausado';
            statusLabel = 'PAUSADO';
        } else if (client.status === 'bloqueado' || client.active === false) {
            statusClass = 'bloqueado';
            statusLabel = 'BLOQUEADO';
        }

        const planName = client.plan?.name || '-';
        const code = client.code || '#';
        const displayId = client.docId;
        const fullLink = `${PRODUCTION_DOMAIN}?site=${displayId}`;

        const row = document.createElement('div');
        row.className = `client-row grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition`;

        row.onclick = (e) => {
            if (e.target.type === 'checkbox' || e.target.closest('.select-checkbox') || e.target.closest('.copy-action')) return;
            if (isSelectionMode) {
                const cb = row.querySelector('.select-checkbox');
                cb.checked = !cb.checked;
                handleSelect(displayId, cb.checked);
            } else {
                openClientModal(displayId);
            }
        };

        const firstCol = isSelectionMode
            ? `<input type="checkbox" class="select-checkbox" ${selectedClientIds.has(displayId) ? 'checked' : ''} onchange="handleSelect('${displayId}', this.checked)">`
            : `<span class="text-white font-mono font-bold">${code}</span>`;

        row.innerHTML = `
            <div class="col-span-1 text-center flex justify-center">${firstCol}</div>
            <div class="col-span-4 font-bold text-white truncate">${client.name}</div>
            <div class="col-span-3">
                 <div class="flex items-center bg-black border border-gray-700 rounded px-2 py-1 copy-action group hover:border-blue-500 transition">
                    <input type="text" value="${fullLink}" class="bg-transparent text-blue-400 text-xs w-full focus:outline-none truncate cursor-pointer" readonly onclick="copyToClipboard('${fullLink}')">
                    <button onclick="copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white ml-2" title="Copiar Link">
                        <i class="far fa-copy"></i>
                    </button>
                </div>
            </div>
            <div class="col-span-2 text-center text-gray-400 text-xs">${planName}</div>
            <div class="col-span-2 text-center flex justify-between items-center px-2">
                <span class="status-badge status-${statusClass}">${statusLabel}</span>
                <i class="fas fa-chevron-right text-gray-600 text-xs"></i>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert("Link copiado!"));
};

// --- ABRIR MODAL (AQUI ESTAVA O PROBLEMA) ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    modal.classList.remove('translate-y-full');

    // Resets
    resetFinancials();
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inp-site-link').value = '';

    // Elementos de Botões (Lógica corrigida)
    const actionsActive = document.getElementById('actions-active');
    const actionsInactive = document.getElementById('actions-inactive');
    const btnReactivate = document.getElementById('btn-reactivate');

    if (docId) {
        // === MODO EDIÇÃO ===
        const client = allClients.find(c => c.docId === docId);

        if (client) {
            document.getElementById('modal-title').innerText = `Gerenciar: ${client.name}`;
            
            // Preenche Campos Principais
            document.getElementById('inp-id').value = client.code || '-';
            document.getElementById('inp-name').value = client.name || '';
            document.getElementById('inp-site-slug').value = client.docId || '';
            document.getElementById('inp-site-slug').disabled = true;

            const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
            document.getElementById('preview-url').innerText = fullLink;
            document.getElementById('inp-site-link').value = fullLink;

            // Preenche Dados do Dono e Financeiro
            fillClientData(client);
            loadFinancials(docId, client);

            // === LÓGICA DOS BOTÕES (Faltava isso no seu código) ===
            
            // 1. Se estiver BLOQUEADO ou INATIVO
            if (client.status === 'bloqueado' || client.active === false) {
                actionsActive.classList.add('hidden');
                actionsInactive.classList.remove('hidden');
                btnReactivate.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded transition flex justify-center items-center gap-2";
                btnReactivate.innerHTML = '<i class="fas fa-unlock"></i> <span>Desbloquear Loja</span>';
            }
            // 2. Se estiver PAUSADO
            else if (client.status === 'pausado') {
                actionsActive.classList.add('hidden');
                actionsInactive.classList.remove('hidden');
                btnReactivate.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded transition flex justify-center items-center gap-2";
                btnReactivate.innerHTML = '<i class="fas fa-play"></i> <span>Ativar Loja</span>';
            }
            // 3. Se estiver ATIVO
            else {
                actionsActive.classList.remove('hidden');
                actionsInactive.classList.add('hidden');
            }

        } else {
            console.error("Cliente não encontrado.");
        }
    } else {
        // === MODO NOVO ===
        document.getElementById('modal-title').innerText = 'Novo Cliente';
        document.getElementById('inp-id').value = getNextCode();
        document.getElementById('inp-name').value = '';
        document.getElementById('inp-site-slug').value = '';
        document.getElementById('preview-url').innerText = `${PRODUCTION_DOMAIN}?site=...`;
        
        clearOwnerInputs();

        // Novo nasce ativo
        actionsActive.classList.remove('hidden');
        actionsInactive.classList.add('hidden');

        const statusEl = document.getElementById('inp-status-display');
        if (statusEl) {
            statusEl.innerText = 'Novo (Ativo)';
            statusEl.className = 'w-full bg-black border border-gray-700 rounded p-2 text-sm font-bold text-green-500';
        }
    }

    switchTab('cadastro');
}

// --- PREENCHIMENTO DE DADOS (Reforçado) ---
function fillClientData(client) {
    const statusEl = document.getElementById('inp-status-display');
    let stText = 'Ativo';
    let stClass = 'text-green-500';

    if (client.status === 'pausado') {
        stText = 'Pausado';
        stClass = 'text-yellow-500';
    } else if (client.status === 'bloqueado' || client.active === false) {
        stText = 'Bloqueado';
        stClass = 'text-red-500';
    }
    
    statusEl.innerText = stText;
    statusEl.className = `w-full bg-black border border-gray-700 rounded p-2 text-sm font-bold ${stClass}`;

    // Garante que não quebre se ownerData não existir
    const owner = client.ownerData || {};

    document.getElementById('inp-owner').value = owner.name || '';
    document.getElementById('inp-doc').value = owner.doc || '';
    document.getElementById('inp-insta').value = owner.insta || '';
    document.getElementById('inp-face').value = owner.face || '';
    document.getElementById('inp-yt').value = owner.yt || '';
    document.getElementById('inp-tel').value = owner.tel || '';
    document.getElementById('inp-whats').value = owner.whats || '';
    document.getElementById('inp-email').value = owner.email || '';
}

function clearOwnerInputs() {
    ['inp-owner', 'inp-doc', 'inp-insta', 'inp-face', 'inp-yt', 'inp-tel', 'inp-whats', 'inp-email'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
}

function getOwnerData() {
    return {
        name: document.getElementById('inp-owner').value,
        doc: document.getElementById('inp-doc').value,
        insta: document.getElementById('inp-insta').value,
        face: document.getElementById('inp-face').value,
        yt: document.getElementById('inp-yt').value,
        tel: document.getElementById('inp-tel').value,
        whats: document.getElementById('inp-whats').value,
        email: document.getElementById('inp-email').value,
    };
}

// --- MUDAR STATUS ---
async function changeClientStatus(action) {
    if (!currentDocId) return alert("Erro: ID do cliente não identificado.");

    let newStatus = 'ativo';
    let isActive = true;
    let actionText = "ATIVAR";

    if (action === 'block') {
        newStatus = 'bloqueado';
        isActive = false;
        actionText = "BLOQUEAR";
    } else if (action === 'pause') {
        newStatus = 'pausado';
        isActive = false;
        actionText = "PAUSAR";
    } else if (action === 'activate') {
        newStatus = 'ativo';
        isActive = true;
        actionText = "DESBLOQUEAR/ATIVAR";
    }

    if (!confirm(`Deseja realmente ${actionText} este cliente?`)) return;

    try {
        await updateDoc(doc(db, "sites", currentDocId), {
            active: isActive,
            status: newStatus
        });

        alert(`Sucesso! Status alterado para: ${newStatus.toUpperCase()}`);
        closeClientModal();
        loadClients();
    } catch (err) {
        console.error("Erro ao alterar status:", err);
        alert("Erro ao alterar status no banco de dados.");
    }
}

// --- EXCLUIR ---
async function deleteCurrentClient() {
    if (!currentDocId) return alert("Erro: Nenhum cliente selecionado.");

    const confirmInput = prompt(`ATENÇÃO: EXCLUSÃO PERMANENTE!\n\nDigite o código da loja para confirmar: ${currentDocId}`);
    if (confirmInput !== currentDocId) return alert("Código incorreto.");

    try {
        await deleteDoc(doc(db, "sites", currentDocId));
        alert("Cliente excluído com sucesso.");
        closeClientModal();
        loadClients();
    } catch (err) {
        alert("Erro ao excluir: " + err.message);
    }
}

// --- SALVAR ---
async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();

    if (!slug || !name) return alert("Nome e Link obrigatórios!");

    const docIdToSave = currentDocId || slug;

    const data = {
        name: name,
        ownerData: getOwnerData(),
        ...(!currentDocId && { code: parseInt(document.getElementById('inp-id').value) }),
        ...(!currentDocId && { createdAt: new Date().toISOString() })
    };

    if (!currentDocId) {
        data.active = true;
        data.status = 'ativo';
        data.plan = { name: "30 dias (Mensal)", monthlyValue: 0, serverCost: 0 };
    }

    try {
        await setDoc(doc(db, "sites", docIdToSave), data, { merge: true });
        alert("Salvo com sucesso!");
        closeClientModal();
        loadClients();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
    }
}

// --- FINANCEIRO (Preenchido Agora) ---
function resetFinancials() {
    document.getElementById('fin-orders').innerText = '0';
    document.getElementById('fin-sales').innerText = '0';
    document.getElementById('fin-revenue').innerText = 'R$ 0,00';
    document.getElementById('fin-costs').innerText = 'R$ 0,00';
    document.getElementById('fin-profit').innerText = 'R$ 0,00';
}

async function loadFinancials(siteId, clientData) {
    try {
        // Busca pedidos da subcoleção 'orders'
        const q = query(collection(db, `sites/${siteId}/orders`));
        const snapshot = await getDocs(q);
        
        let totalOrders = 0;
        let confirmedSales = 0;
        let revenue = 0;
        let costs = 0;

        snapshot.forEach(doc => {
            const order = doc.data();
            totalOrders++;
            
            // Considera venda se status for pago/aprovado
            if (['approved', 'paid', 'delivered'].includes(order.status)) {
                confirmedSales++;
                revenue += (parseFloat(order.total) || 0);
            }
        });

        // Exemplo simples de custo (custo fixo do servidor)
        const serverCost = parseFloat(clientData.plan?.serverCost || 0);
        costs = serverCost; 
        const profit = revenue - costs;

        // Atualiza UI
        document.getElementById('fin-orders').innerText = totalOrders;
        document.getElementById('fin-sales').innerText = confirmedSales;
        document.getElementById('fin-revenue').innerText = `R$ ${revenue.toFixed(2)}`;
        document.getElementById('fin-costs').innerText = `R$ ${costs.toFixed(2)}`;
        
        const profitEl = document.getElementById('fin-profit');
        profitEl.innerText = `R$ ${profit.toFixed(2)}`;
        profitEl.className = `text-xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`;

    } catch (e) {
        console.error("Erro financeiro:", e);
    }
}

// --- UTILS ---
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.target === tabName) {
            btn.classList.add('bg-gray-700', 'text-white');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('bg-gray-700', 'text-white');
            btn.classList.add('text-gray-400');
        }
    });
}

function closeClientModal() {
    modal.classList.add('translate-y-full');
    currentDocId = null;
}

function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    selectedClientIds.clear();
    updateSelectionUI();
    renderClients(allClients);
    const btn = document.getElementById('btn-select-mode');
    if(btn) {
        btn.innerText = isSelectionMode ? 'Cancelar' : 'Selecionar';
        btn.classList.toggle('bg-gray-700');
    }
}

function updateSelectionUI() {
    const btnDel = document.getElementById('btn-delete-selected');
    const span = document.getElementById('count-selected');
    if (selectedClientIds.size > 0) {
        if(btnDel) btnDel.classList.remove('hidden');
        if(span) span.innerText = selectedClientIds.size;
    } else {
        if(btnDel) btnDel.classList.add('hidden');
    }
}

window.handleSelect = (id, isChecked) => {
    if (isChecked) selectedClientIds.add(id);
    else selectedClientIds.delete(id);
    updateSelectionUI();
};

async function deleteSelectedClients() {
    if (!confirm(`Excluir ${selectedClientIds.size} clientes?`)) return;
    try {
        const promises = Array.from(selectedClientIds).map(id => deleteDoc(doc(db, "sites", id)));
        await Promise.all(promises);
        toggleSelectionMode();
        loadClients();
        alert('Excluídos.');
    } catch (e) { alert('Erro ao excluir.'); }
}

function filterClients(term) {
    const t = term.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(t) || c.docId.includes(t));
    renderClients(filtered);
}