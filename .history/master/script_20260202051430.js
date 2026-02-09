import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// COPIE SUA FIREBASE CONFIG DO ARQUIVO PRINCIPAL
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

// ELEMENTOS
const listContainer = document.getElementById('clients-list');
const modalOverlay = document.getElementById('client-modal');
const modalContent = document.getElementById('modal-content');

// START
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

    // Filtro
    document.getElementById('search-input').addEventListener('input', (e) => filterClients(e.target.value));
});

// --- CARREGAR LISTA ---
async function loadClients() {
    listContainer.innerHTML = '<div class="text-center text-gray-500 mt-4">Carregando...</div>';
    try {
        const snap = await getDocs(collection(db, "sites"));
        allClients = [];
        snap.forEach(doc => allClients.push({ docId: doc.id, ...doc.data() }));
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));
        renderClients(allClients);
    } catch (e) {
        console.error(e);
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    clients.forEach(client => {
        // Badges
        let badge = '<span class="text-green-500 bg-green-900/20 border border-green-900 px-2 py-1 rounded text-xs font-bold">Ativo</span>';
        if (client.status === 'pausado') badge = '<span class="text-yellow-500 bg-yellow-900/20 border border-yellow-900 px-2 py-1 rounded text-xs font-bold">Pausado</span>';
        if (client.status === 'bloqueado' || client.active === false) badge = '<span class="text-red-500 bg-red-900/20 border border-red-900 px-2 py-1 rounded text-xs font-bold">Bloqueado</span>';

        const row = document.createElement('div');
        row.className = "grid grid-cols-12 gap-2 px-4 py-3 bg-[#161821] rounded-lg border border-gray-800 items-center hover:bg-[#1e2029] cursor-pointer transition mb-2";
        row.onclick = () => openClientModal(client.docId);

        row.innerHTML = `
            <div class="col-span-2 text-center font-bold text-white text-lg">${client.code || '#'}</div>
            <div class="col-span-3 font-bold text-white truncate">${client.name}</div>
            <div class="col-span-3 text-center">
                 <span class="bg-[#0f1014] border border-gray-700 text-gray-300 px-2 py-1 rounded text-xs truncate block w-full">
                    vestemanto.com
                 </span>
            </div>
            <div class="col-span-2 text-center text-gray-400 text-xs">${client.plan?.name || '30 dias(Recorrente)'}</div>
            <div class="col-span-2 text-center flex justify-between items-center px-2">
                ${badge}
                <i class="fas fa-chevron-right text-white"></i>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

// --- ABRIR MODAL (PREENCHIMENTO) ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    modalOverlay.classList.remove('pointer-events-none', 'opacity-0');
    modalContent.classList.remove('translate-y-full');

    // Limpeza
    document.querySelectorAll('input').forEach(i => i.value = '');
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toLocaleDateString('pt-BR');

    // Botões de Ação
    renderActionButtons(null);

    if (docId) {
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name;
            document.getElementById('inp-id').value = client.code;
            document.getElementById('inp-name').value = client.name;
            document.getElementById('inp-site-slug').value = client.docId;
            document.getElementById('inp-site-slug').disabled = true;
            document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
            
            // Plano
            if(client.plan && client.plan.name) document.getElementById('inp-plan').value = client.plan.name;

            // Status Visual
            updateStatusBadge(client.status, client.active);

            // Dados Dono
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

            // Renderiza Botões com base no status atual
            renderActionButtons(client.status, client.active);
            loadFinancials(client.docId);
        }
    } else {
        // NOVO
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        updateStatusBadge('ativo', true);
        renderActionButtons('ativo'); // Padrão
    }

    switchTab('cadastro');
}

// --- RENDERIZAR BOTÕES DE AÇÃO (Lógica Crítica) ---
function renderActionButtons(status, active = true) {
    const container = document.getElementById('action-buttons-container');
    container.innerHTML = '';

    // Se estiver Bloqueado ou Inativo -> Botão Verde de Desbloquear
    if (status === 'bloqueado' || active === false) {
        container.innerHTML = `
            <button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs">
                Desbloquear Loja
            </button>
        `;
    } 
    // Se estiver Pausado -> Botão Verde de Ativar
    else if (status === 'pausado') {
        container.innerHTML = `
            <button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs">
                Ativar Loja
            </button>
        `;
    } 
    // Se estiver Ativo -> Botões Vermelho (Bloquear) e Amarelo (Pausar)
    else {
        container.innerHTML = `
            <button onclick="changeClientStatus('block')" class="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold uppercase text-xs w-full mb-2">
                Bloquear
            </button>
            <button onclick="changeClientStatus('pause')" class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded font-bold uppercase text-xs w-full flex items-center justify-center gap-2">
                Pausar <i class="far fa-calendar-alt"></i>
            </button>
        `;
    }
}

function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
    if (status === 'bloqueado' || active === false) {
        el.className = "bg-black border border-red-900 text-red-500 text-xs font-bold rounded px-2 py-2 text-center uppercase";
        el.innerText = "Bloqueado";
    } else if (status === 'pausado') {
        el.className = "bg-black border border-yellow-900 text-yellow-500 text-xs font-bold rounded px-2 py-2 text-center uppercase";
        el.innerText = "Pausado";
    } else {
        el.className = "bg-black border border-green-900 text-green-500 text-xs font-bold rounded px-2 py-2 text-center uppercase";
        el.innerText = "Ativo";
    }
}

// --- SALVAR (PERSISTÊNCIA COMPLETA) ---
async function saveClientData() {
    const slug = document.getElementById('inp-site-slug').value.trim();
    const name = document.getElementById('inp-name').value.trim();
    
    if (!slug || !name) return alert("Preencha Nome e Slug!");

    const ownerData = {
        name: document.getElementById('inp-owner').value,
        doc: document.getElementById('inp-doc').value,
        insta: document.getElementById('inp-insta').value,
        face: document.getElementById('inp-face').value,
        yt: document.getElementById('inp-yt').value,
        tel: document.getElementById('inp-tel').value,
        whats: document.getElementById('inp-whats').value,
        email: document.getElementById('inp-email').value
    };

    const docId = currentDocId || slug;
    
    // Plano Selecionado
    const planName = document.getElementById('inp-plan').value;

    const data = {
        name: name,
        ownerData: ownerData,
        plan: { name: planName, monthlyValue: 0, serverCost: 0 },
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

// --- MUDAR STATUS ---
async function changeClientStatus(action) {
    if (!currentDocId) return;

    let newStatus = 'ativo';
    let isActive = true;

    if (action === 'block') { newStatus = 'bloqueado'; isActive = false; }
    if (action === 'pause') { newStatus = 'pausado'; isActive = false; }
    
    // Atualização Otimista (Visual imediato)
    updateStatusBadge(newStatus, isActive);
    renderActionButtons(newStatus, isActive);

    try {
        await updateDoc(doc(db, "sites", currentDocId), { status: newStatus, active: isActive });
        loadClients(); // Recarrega lista
    } catch (e) {
        alert("Erro ao alterar status.");
    }
}

// --- EXCLUIR ---
async function deleteCurrentClient() {
    if(!currentDocId) return;
    if(!confirm("Tem certeza que deseja EXCLUIR este cliente?")) return;
    try {
        await deleteDoc(doc(db, "sites", currentDocId));
        closeClientModal();
        loadClients();
    } catch (e) { alert("Erro ao excluir"); }
}

// --- FINANCEIRO SIMULADO/REAL ---
async function loadFinancials(siteId) {
    // Aqui você implementa a busca real na subcoleção 'orders'
    // Por enquanto, vou limpar os campos para não mostrar lixo
    document.getElementById('fin-orders').innerText = "0";
    document.getElementById('fin-sales').innerText = "0";
    document.getElementById('fin-revenue').innerText = "R$ 0,00";
    document.getElementById('fin-costs').innerText = "R$ 0,00";
    document.getElementById('fin-profit').innerText = "R$ 0,00";
    
    try {
        const q = await getDocs(collection(db, `sites/${siteId}/orders`));
        let total = 0, rev = 0;
        q.forEach(d => {
            total++;
            if(['approved', 'paid', 'delivered'].includes(d.data().status)) {
                rev += parseFloat(d.data().total || 0);
            }
        });
        document.getElementById('fin-orders').innerText = total;
        document.getElementById('fin-revenue').innerText = `R$ ${rev.toFixed(2)}`;
    } catch(e) { }
}

// --- UTILS ---
function getNextCode() {
    if (allClients.length === 0) return 1;
    return Math.max(...allClients.map(c => parseInt(c.code) || 0)) + 1;
}

window.generateSiteLink = () => {
    const name = document.getElementById('inp-name').value;
    if(!name) return;
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    document.getElementById('inp-site-slug').value = slug;
}

window.closeClientModal = () => {
    modalOverlay.classList.add('pointer-events-none', 'opacity-0');
    modalContent.classList.add('translate-y-full');
    currentDocId = null;
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
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(t));
    renderClients(filtered);
}