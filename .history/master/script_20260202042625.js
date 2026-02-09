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
// Esse é o link que vai aparecer para o cliente
const PRODUCTION_DOMAIN = "https://projetistaoficial.github.io/VesteManto/";

let allClients = [];
let currentDocId = null; // ID do documento no Firebase (ex: veste-manto)
let isSelectionMode = false;
let selectedClientIds = new Set();

// Elementos
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
    window.generateSiteLink = generateSiteLink; // Nova função

    // Input Search
    searchInput.addEventListener('input', (e) => filterClients(e.target.value));

    // Listeners de seleção (mantidos do anterior)
    document.getElementById('btn-select-mode').addEventListener('click', toggleSelectionMode);
    document.getElementById('btn-delete-selected').addEventListener('click', deleteSelectedClients);
});

// --- FUNÇÃO DE AUTO INCREMENTO ---
function getNextCode() {
    if (allClients.length === 0) return 1;

    // Pega o maior código existente na lista
    // Convertemos para numero para garantir ordenação correta
    const maxCode = allClients.reduce((max, client) => {
        const code = parseInt(client.code) || 0;
        return code > max ? code : max;
    }, 0);

    return maxCode + 1;
}

// --- GERADOR DE LINK (Slug) ---
window.generateSiteLink = () => {
    const nameInput = document.getElementById('inp-name').value;
    const slugInput = document.getElementById('inp-site-slug');
    const previewText = document.getElementById('preview-url');

    if (!nameInput) return alert("Digite o nome da loja primeiro!");

    // Transforma "Veste Manto & Cia" em "veste-manto-cia"
    const slug = nameInput
        .toString()
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .trim()
        .replace(/\s+/g, '-')     // Espaços viram hifens
        .replace(/[^\w\-]+/g, '') // Remove caracteres especiais
        .replace(/\-\-+/g, '-');  // Remove hifens duplicados

    slugInput.value = slug;
    previewText.innerText = `${PRODUCTION_DOMAIN}?site=${slug}`;
};

// --- CARREGAMENTO ---
async function loadClients() {
    listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Carregando...</div>';

    try {
        const querySnapshot = await getDocs(collection(db, "sites"));
        allClients = [];
        querySnapshot.forEach(doc => {
            // O ID do documento é o slug (ex: veste-manto)
            // O 'code' é o número sequencial (ex: 1)
            allClients.push({ docId: doc.id, ...doc.data() });
        });

        // Ordenar por código (1, 2, 3...)
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));

        renderClients(allClients);
    } catch (error) {
        console.error(error);
        listContainer.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar.</div>';
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Nenhum cliente.</div>';
        return;
    }

    clients.forEach(client => {
        // Lógica de Status
        let statusClass = 'ativo';
        let statusLabel = 'ATIVO';

        // Prioriza o campo 'status', mas usa 'active' como fallback
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

// Adicione esta função auxiliar no final do arquivo master/script.js
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
        alert("Link copiado: " + text); // Ou use seu showToast se tiver
    });
};

// --- MODAL ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    modal.classList.remove('translate-y-full');
    
    // --- RESET GERAL (Limpa campos comuns antes de decidir se é Edição ou Novo) ---
    // Reseta Financeiro
    if (typeof resetFinancials === 'function') resetFinancials();

    // Habilita edição do slug por padrão (será desabilitado se for edição)
    document.getElementById('inp-site-slug').disabled = false; 
    
    // Define data de hoje
    document.getElementById('inp-date').value = new Date().toISOString().split('T')[0];

    // Limpa o campo de Link Completo (evita mostrar link antigo ao criar novo)
    document.getElementById('inp-site-link').value = '';

    if (docId) {
        // ========================
        // MODO EDIÇÃO
        // ========================
        const client = allClients.find(c => c.docId === docId);
        
        if (client) {
            document.getElementById('modal-title').innerText = 'Editar Cliente';
            
            // Preenche campos
            document.getElementById('inp-id').value = client.code || '-';
            document.getElementById('inp-name').value = client.name || '';
            document.getElementById('inp-site-slug').value = client.docId || '';
            
            // Trava o slug (não pode mudar ID de site existente)
            document.getElementById('inp-site-slug').disabled = true; 
            
            // Preview e Link Completo
            const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
            document.getElementById('preview-url').innerText = fullLink;
            document.getElementById('inp-site-link').value = fullLink;

            // Preenche Status, Dono e Redes Sociais
            if (typeof fillClientData === 'function') fillClientData(client);
            
            // Carrega Financeiro
            if (typeof loadFinancials === 'function') loadFinancials(docId, client);
        }
    } else {
        // ========================
        // MODO NOVO CLIENTE
        // ========================
        document.getElementById('modal-title').innerText = 'Novo Cliente';
        
        // Auto Incremento
        if (typeof getNextCode === 'function') {
            document.getElementById('inp-id').value = getNextCode();
        }

        // Limpa campos de texto
        document.getElementById('inp-name').value = '';
        document.getElementById('inp-site-slug').value = '';
        document.getElementById('preview-url').innerText = `${PRODUCTION_DOMAIN}?site=...`;

        // Reseta o Status Visual para "Novo" (Verde/Neutro)
        const statusEl = document.getElementById('inp-status-display');
        if (statusEl) {
            statusEl.innerText = 'Novo (Ativo)';
            statusEl.className = 'w-full bg-black border border-gray-700 rounded p-2 text-sm font-bold text-green-500';
        }

        // Limpa inputs de dono/responsável
        if (typeof clearOwnerInputs === 'function') clearOwnerInputs();
    }

    // Sempre abre na primeira aba
    if (typeof switchTab === 'function') switchTab('cadastro');
}

// --- SALVAR (A Lógica Crucial) ---
async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();

    if (!slug || !name) return alert("Nome e Link do site são obrigatórios!");

    // Se for novo, usa o slug como ID do documento. Se edição, usa o currentDocId
    const docIdToSave = currentDocId || slug;

    // Dados básicos
    const data = {
        name: name,
        ownerData: getOwnerData(),
        // Se for novo, atribui o próximo código. Se edição, não mexe no code.
        ...(!currentDocId && { code: parseInt(document.getElementById('inp-id').value) }),
        ...(!currentDocId && { createdAt: new Date().toISOString() })
    };

    // Plano e Active (preservação simples)
    if (!currentDocId) {
        data.active = true; // Novo nasce ativo
        data.plan = { name: "30 dias (Mensal)", monthlyValue: 0, serverCost: 0 }; // Plano padrão
    }

    try {
        // Salva no Firebase: collection "sites", document "veste-manto"
        await setDoc(doc(db, "sites", docIdToSave), data, { merge: true });

        alert("Cliente salvo com sucesso!");
        closeClientModal();
        loadClients();
    } catch (err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
    }
}

// --- AUXILIARES (Preenchimento) ---
function fillClientData(client) {
    const statusEl = document.getElementById('inp-status-display');
    statusEl.innerText = client.active !== false ? 'Ativo' : 'Bloqueado';
    statusEl.className = `w-full bg-black border border-gray-700 rounded p-2 text-sm font-bold ${client.active !== false ? 'text-green-500' : 'text-red-500'}`;

    if (client.ownerData) {
        document.getElementById('inp-owner').value = client.ownerData.name || '';
        document.getElementById('inp-doc').value = client.ownerData.doc || '';
        document.getElementById('inp-insta').value = client.ownerData.insta || '';
        document.getElementById('inp-face').value = client.ownerData.face || '';
        document.getElementById('inp-yt').value = client.ownerData.yt || '';
        document.getElementById('inp-tel').value = client.ownerData.tel || '';
        document.getElementById('inp-whats').value = client.ownerData.whats || '';
        document.getElementById('inp-email').value = client.ownerData.email || '';
    } else {
        clearOwnerInputs();
    }
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

function clearOwnerInputs() {
    ['inp-owner', 'inp-doc', 'inp-insta', 'inp-face', 'inp-yt', 'inp-tel', 'inp-whats', 'inp-email'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

// --- FINANCEIRO, TABS, SELEÇÃO ---
// (Mantenha as funções switchTab, loadFinancials, toggleSelectionMode, etc. do código anterior, 
// apenas garantindo que loadFinancials use currentDocId para buscar a subcoleção)

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
    btn.innerText = isSelectionMode ? 'Cancelar' : 'Selecionar';
    btn.classList.toggle('bg-gray-700');
}

function updateSelectionUI() {
    const btnDel = document.getElementById('btn-delete-selected');
    const span = document.getElementById('count-selected');
    if (selectedClientIds.size > 0) {
        btnDel.classList.remove('hidden');
        span.innerText = selectedClientIds.size;
    } else {
        btnDel.classList.add('hidden');
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

async function changeClientStatus(action) {
    if (!currentDocId) return;
    
    let newStatus = 'ativo';
    let isActive = true;

    if (action === 'block') {
        newStatus = 'bloqueado';
        isActive = false;
    } else if (action === 'pause') {
        newStatus = 'pausado';
        isActive = false;
    }
    
    // Confirmação personalizada
    const actionText = action === 'pause' ? 'PAUSAR' : (action === 'block' ? 'BLOQUEAR' : 'ATIVAR');
    if (!confirm(`Deseja realmente ${actionText} este cliente?`)) return;

    try {
        await updateDoc(doc(db, "sites", currentDocId), { 
            active: isActive,   // Mantemos para compatibilidade
            status: newStatus   // Novo campo para diferenciar
        });
        
        alert(`Status alterado para: ${newStatus.toUpperCase()}`);
        closeClientModal();
        loadClients();
    } catch (err) {
        console.error(err);
        alert("Erro ao alterar status.");
    }
}

async function deleteCurrentClient() {
    if (!currentDocId) return;
    if (!confirm("Excluir permanentemente?")) return;
    try {
        await deleteDoc(doc(db, "sites", currentDocId));
        closeClientModal();
        loadClients();
    } catch (e) { alert("Erro."); }
}

// Reset Financeiro Simples
function resetFinancials() {
    document.getElementById('fin-orders').innerText = '0';
    document.getElementById('fin-sales').innerText = '0';
    document.getElementById('fin-revenue').innerText = 'R$ 0,00';
    document.getElementById('fin-costs').innerText = 'R$ 0,00';
    document.getElementById('fin-profit').innerText = 'R$ 0,00';
}

// Função loadFinancials (Simplificada para o exemplo, precisa ser igual a do script anterior)
async function loadFinancials(siteId, clientData) {
    // Mesma lógica do script anterior...
    // Se precisar, copie e cole aqui
}

function filterClients(term) {
    const t = term.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(t) || c.docId.includes(t));
    renderClients(filtered);
}