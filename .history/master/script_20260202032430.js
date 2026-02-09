import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// === CONFIGURAÇÃO DO FIREBASE (Copie do seu arquivo principal) ===
const firebaseConfig = {
    const firebaseConfig = {
  apiKey: "AIzaSyD_pZ7lWPQA1OniOJrjTinG2HN5UhjMzbI",
  authDomain: "vestemanto-app.firebaseapp.com",
  projectId: "vestemanto-app",
  storageBucket: "vestemanto-app.appspot.com",
  messagingSenderId: "340174016008",
  appId: "1:340174016008:web:301a01750404af8b5a8bbd"
};
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Estado da Aplicação
let allClients = [];
let currentClientId = null;
let isSelectionMode = false;
let selectedClientIds = new Set();

// Elementos DOM
const listContainer = document.getElementById('clients-list');
const modal = document.getElementById('client-modal');
const searchInput = document.getElementById('search-input');
const btnSelectMode = document.getElementById('btn-select-mode');
const btnDeleteSelected = document.getElementById('btn-delete-selected');
const countSelectedSpan = document.getElementById('count-selected');

// --- INICIALIZAÇÃO ---
window.addEventListener('DOMContentLoaded', () => {
    loadClients();
    setupEventListeners();
});

function setupEventListeners() {
    // Pesquisa
    searchInput.addEventListener('input', (e) => filterClients(e.target.value));

    // Botão Modo Seleção
    btnSelectMode.addEventListener('click', toggleSelectionMode);

    // Botão Excluir Selecionados
    btnDeleteSelected.addEventListener('click', deleteSelectedClients);

    // Expor funções globais para o HTML
    window.openClientModal = openClientModal;
    window.closeClientModal = closeClientModal;
    window.switchTab = switchTab;
    window.saveClientData = saveClientData;
    window.changeClientStatus = changeClientStatus;
    window.deleteCurrentClient = deleteCurrentClient;
}

// --- CARREGAMENTO DE DADOS ---
async function loadClients() {
    listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Carregando...</div>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "sites"));
        allClients = [];
        querySnapshot.forEach(doc => {
            allClients.push({ id: doc.id, ...doc.data() });
        });
        renderClients(allClients);
    } catch (error) {
        console.error("Erro ao carregar:", error);
        listContainer.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar clientes.</div>';
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Nenhum cliente encontrado.</div>';
        return;
    }

    clients.forEach(client => {
        const status = client.active !== false ? 'ativo' : 'bloqueado';
        const statusText = client.active !== false ? 'Ativo' : 'Bloqueado';
        const planName = client.plan?.name || 'Não definido';
        
        // Determina link do site (URL base + ?site=id)
        // Se estiver rodando no github pages, ajusta a base
        const currentUrl = window.location.href; // master/index.html
        const baseUrl = currentUrl.replace('/master/index.html', '').replace('/master/', ''); 
        const siteLink = `${baseUrl}?site=${client.id}`;
        
        const row = document.createElement('div');
        row.className = `client-row grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-800 cursor-pointer transition`;
        row.onclick = (e) => {
            // Se clicar no checkbox ou no modo seleção, não abre modal
            if (e.target.type === 'checkbox' || e.target.closest('.select-checkbox')) return;
            
            if (isSelectionMode) {
                const checkbox = row.querySelector('.select-checkbox');
                checkbox.checked = !checkbox.checked;
                handleSelect(client.id, checkbox.checked);
            } else {
                openClientModal(client.id);
            }
        };

        // Renderização Condicional (Checkbox ou ID)
        const firstCol = isSelectionMode 
            ? `<input type="checkbox" class="select-checkbox" ${selectedClientIds.has(client.id) ? 'checked' : ''} onchange="handleSelect('${client.id}', this.checked)">` 
            : `<span class="text-white font-mono">${client.id.substring(0, 6)}...</span>`;

        row.innerHTML = `
            <div class="col-span-1 text-center flex justify-center">${firstCol}</div>
            <div class="col-span-4 font-bold text-white truncate">${client.name}</div>
            <div class="col-span-3 text-center">
                <a href="${siteLink}" target="_blank" class="link-btn truncate block w-full" onclick="event.stopPropagation()">
                    vestemanto.com
                </a>
            </div>
            <div class="col-span-2 text-center text-gray-400 text-xs">${planName}</div>
            <div class="col-span-2 text-center flex justify-between items-center px-2">
                <span class="status-badge status-${status}">${statusText}</span>
                <i class="fas fa-chevron-right text-gray-600 text-xs"></i>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

function filterClients(term) {
    const lowerTerm = term.toLowerCase();
    const filtered = allClients.filter(c => 
        c.name.toLowerCase().includes(lowerTerm) || 
        c.id.toLowerCase().includes(lowerTerm)
    );
    renderClients(filtered);
}

// --- MODO SELEÇÃO ---
function toggleSelectionMode() {
    isSelectionMode = !isSelectionMode;
    selectedClientIds.clear();
    updateSelectionUI();
    renderClients(allClients); // Re-renderiza para mostrar checkboxes
    
    btnSelectMode.innerText = isSelectionMode ? 'Cancelar' : 'Selecionar';
    btnSelectMode.classList.toggle('bg-gray-700');
}

window.handleSelect = (id, isChecked) => {
    if (isChecked) selectedClientIds.add(id);
    else selectedClientIds.delete(id);
    updateSelectionUI();
};

function updateSelectionUI() {
    if (selectedClientIds.size > 0) {
        btnDeleteSelected.classList.remove('hidden');
        countSelectedSpan.innerText = selectedClientIds.size;
    } else {
        btnDeleteSelected.classList.add('hidden');
    }
}

async function deleteSelectedClients() {
    if (!confirm(`Tem certeza que deseja excluir ${selectedClientIds.size} clientes?`)) return;
    
    try {
        const promises = Array.from(selectedClientIds).map(id => deleteDoc(doc(db, "sites", id)));
        await Promise.all(promises);
        
        toggleSelectionMode(); // Sai do modo seleção
        loadClients(); // Recarrega
        alert('Clientes excluídos com sucesso.');
    } catch (err) {
        console.error(err);
        alert('Erro ao excluir clientes.');
    }
}

// --- MODAL & TABS ---
async function openClientModal(id = null) {
    currentClientId = id;
    modal.classList.remove('translate-y-full');
    
    // Reseta Form
    document.getElementById('inp-id').value = '';
    document.getElementById('inp-id').disabled = false;
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-site-link').value = '';
    document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('inp-status-display').innerText = 'Novo';
    document.getElementById('modal-title').innerText = 'Novo Cliente';

    // Reseta Dados Responsável
    ['inp-owner', 'inp-doc', 'inp-insta', 'inp-face', 'inp-yt', 'inp-tel', 'inp-whats', 'inp-email'].forEach(fid => {
        document.getElementById(fid).value = '';
    });

    // Reseta Financeiro
    document.getElementById('fin-orders').innerText = '0';
    document.getElementById('fin-sales').innerText = '0';
    document.getElementById('fin-revenue').innerText = 'R$ 0,00';
    document.getElementById('fin-costs').innerText = 'R$ 0,00';
    document.getElementById('fin-profit').innerText = 'R$ 0,00';

    // Se for edição
    if (id) {
        document.getElementById('modal-title').innerText = 'Editar Cliente';
        const client = allClients.find(c => c.id === id);
        if (client) {
            document.getElementById('inp-id').value = client.id;
            document.getElementById('inp-id').disabled = true; // Não muda ID
            document.getElementById('inp-name').value = client.name;
            
            // Link Visual
            const currentUrl = window.location.href.replace('/master/index.html', '').replace('/master/', ''); 
            document.getElementById('inp-site-link').value = `${currentUrl}?site=${client.id}`;
            
            // Status
            const isActive = client.active !== false;
            const statusEl = document.getElementById('inp-status-display');
            statusEl.innerText = isActive ? 'Ativo' : 'Bloqueado';
            statusEl.className = `w-full bg-black border border-gray-700 rounded p-2 text-sm font-bold ${isActive ? 'text-green-500' : 'text-red-500'}`;

            // Dados Extras
            if(client.ownerData) {
                document.getElementById('inp-owner').value = client.ownerData.name || '';
                document.getElementById('inp-doc').value = client.ownerData.doc || '';
                document.getElementById('inp-insta').value = client.ownerData.insta || '';
                document.getElementById('inp-face').value = client.ownerData.face || '';
                document.getElementById('inp-yt').value = client.ownerData.yt || '';
                document.getElementById('inp-tel').value = client.ownerData.tel || '';
                document.getElementById('inp-whats').value = client.ownerData.whats || '';
                document.getElementById('inp-email').value = client.ownerData.email || '';
            }

            // Carregar Financeiro (Async)
            loadFinancials(id, client);
        }
    }
    
    switchTab('cadastro'); // Sempre abre na aba cadastro
}

function closeClientModal() {
    modal.classList.add('translate-y-full');
    currentClientId = null;
}

function switchTab(tabName) {
    // Esconde todos
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Mostra alvo
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    
    // Atualiza botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if(btn.dataset.target === tabName) {
            btn.classList.add('bg-gray-700', 'text-white');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('bg-gray-700', 'text-white');
            btn.classList.add('text-gray-400');
        }
    });
}

// --- LÓGICA FINANCEIRA ---
async function loadFinancials(siteId, clientData) {
    // Busca Pedidos na subcoleção 'orders' deste site
    try {
        const q = query(collection(db, `sites/${siteId}/orders`));
        const snapshot = await getDocs(q);
        
        let totalOrders = 0;
        let confirmedSales = 0;
        let revenue = 0;
        let productCosts = 0;

        snapshot.forEach(doc => {
            const order = doc.data();
            totalOrders++;
            
            // Consideramos venda confirmada se status for 'approved' ou 'delivered'
            if (['approved', 'delivered', 'paid'].includes(order.status)) {
                confirmedSales++;
                revenue += (parseFloat(order.total) || 0);
                
                // Se você tiver custo salvo no pedido (custo do produto)
                productCosts += (parseFloat(order.totalCost) || 0);
            }
        });

        // Custo do Plano (Server Cost)
        const planCost = parseFloat(clientData.plan?.serverCost || 0);
        const totalCosts = productCosts + planCost;
        const profit = revenue - totalCosts;

        // Atualiza UI
        document.getElementById('fin-orders').innerText = totalOrders;
        document.getElementById('fin-sales').innerText = confirmedSales;
        document.getElementById('fin-revenue').innerText = `R$ ${revenue.toFixed(2)}`;
        document.getElementById('fin-costs').innerText = `R$ ${totalCosts.toFixed(2)}`;
        
        const profitEl = document.getElementById('fin-profit');
        profitEl.innerText = `R$ ${profit.toFixed(2)}`;
        profitEl.className = `text-xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`;

    } catch (e) {
        console.error("Erro financeiro:", e);
    }
}

// --- SALVAR / EDITAR ---
async function saveClientData() {
    const idInput = document.getElementById('inp-id');
    const newId = idInput.value.trim();
    
    if (!newId) return alert("Código do cliente é obrigatório");

    const data = {
        name: document.getElementById('inp-name').value,
        // Mantém plano e active se já existirem, senão cria padrão
        active: currentClientId ? undefined : true, 
        ownerData: {
            name: document.getElementById('inp-owner').value,
            doc: document.getElementById('inp-doc').value,
            insta: document.getElementById('inp-insta').value,
            face: document.getElementById('inp-face').value,
            yt: document.getElementById('inp-yt').value,
            tel: document.getElementById('inp-tel').value,
            whats: document.getElementById('inp-whats').value,
            email: document.getElementById('inp-email').value,
        }
    };

    // Remove undefined fields (para merge funcionar bem)
    if(data.active === undefined) delete data.active;

    try {
        await setDoc(doc(db, "sites", newId), data, { merge: true });
        showToast("Dados salvos com sucesso!");
        closeClientModal();
        loadClients();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar.");
    }
}

// --- AÇÕES (Bloquear/Pausar) ---
async function changeClientStatus(action) {
    if (!currentClientId) return;
    
    let isActive = true;
    if (action === 'block' || action === 'pause') isActive = false;
    
    if (!confirm(`Deseja alterar o status para ${action}?`)) return;

    try {
        await updateDoc(doc(db, "sites", currentClientId), { active: isActive });
        alert(`Status alterado com sucesso.`);
        closeClientModal();
        loadClients();
    } catch (err) {
        alert("Erro ao alterar status.");
    }
}

async function deleteCurrentClient() {
    if (!currentClientId) return;
    if (!confirm("ATENÇÃO: Isso apagará o cliente permanentemente. Continuar?")) return;
    
    try {
        await deleteDoc(doc(db, "sites", currentClientId));
        closeClientModal();
        loadClients();
        alert("Cliente excluído.");
    } catch (err) {
        alert("Erro ao excluir.");
    }
}

function showToast(msg) {
    // Implementação simples de toast ou alert
    alert(msg); 
}