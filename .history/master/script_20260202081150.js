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

// --- RENDERIZAR TABELA (Corrigido colunas) ---
function renderClients(clients) {
    listContainer.innerHTML = '';
    
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 mt-10 text-xs">Nenhum cliente</div>';
        return;
    }

    clients.forEach(client => {
        // Cores do Status
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
        
        // Clicar na linha abre o modal (exceto se clicar no link)
        row.onclick = (e) => {
            if(!e.target.closest('a') && !e.target.closest('button')) openClientModal(client.docId);
        };

        row.innerHTML = `
            <div class="col-span-1 text-center text-white font-bold text-xs">${client.code || '#'}</div>
            <div class="col-span-4 font-bold text-white truncate text-sm pl-2">${client.name || 'Sem Nome'}</div>
            
            <div class="col-span-3 flex items-center bg-[#0f1014] border border-gray-700 rounded px-2 py-1 gap-2">
                 <a href="${fullLink}" target="_blank" class="text-blue-400 text-[10px] truncate w-full hover:underline">
                    .../?site=${client.docId}
                 </a>
                 <button onclick="copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white transition" title="Copiar">
                    <i class="far fa-copy text-xs"></i>
                 </button>
            </div>

            <div class="col-span-2 text-center text-gray-400 text-[10px]">${client.plan?.name || 'Mensal'}</div>
            <div class="col-span-2 text-center">
                <span class="${badgeColor} border px-2 py-1 rounded text-[10px] font-bold uppercase block w-20 mx-auto">
                    ${statusText}
                </span>
            </div>
        `;
        listContainer.appendChild(row);
    });
}

// --- ABRIR MODAL (Popula Link Completo) ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    clientModal.classList.remove('translate-y-full');

    // Reseta Form
    document.querySelectorAll('#client-modal input').forEach(i => i.value = '');
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-date').value = new Date().toLocaleDateString('pt-BR');

    renderActionButtons(null);
    updateStatusBadge('ativo', true);

    if (docId) {
        // EDIÇÃO
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = client.name;
            document.getElementById('inp-id').value = client.code;
            document.getElementById('inp-name').value = client.name;
            document.getElementById('inp-site-slug').value = client.docId;
            document.getElementById('inp-site-slug').disabled = true;
            
            // PREENCHE LINK COMPLETO
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
            updateStatusBadge(client.status, client.active);
            renderActionButtons(client.status, client.active);
            loadFinancials(client.docId);
        }
    } else {
        // NOVO
        document.getElementById('modal-title').innerText = "Novo Cliente";
        document.getElementById('inp-id').value = getNextCode();
        renderActionButtons('ativo');
    }
    switchTab('cadastro');
}

// --- GERAR SLUG + LINK ---
window.generateSiteLink = () => {
    const name = document.getElementById('inp-name').value;
    if (!name) return alert("Digite o nome da loja");
    
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    document.getElementById('inp-site-slug').value = slug;
    
    // ATUALIZA CAMPO DO LINK
    document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${slug}`;
}

// --- OUTRAS FUNÇÕES (Mantidas) ---
window.copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert("Copiado!"));
}

window.closeClientModal = () => {
    clientModal.classList.add('translate-y-full');
    currentDocId = null;
}

function renderActionButtons(status, active = true) {
    const container = document.getElementById('action-buttons-container');
    container.innerHTML = '';
    if (status === 'bloqueado' || active === false) {
        container.innerHTML = `<button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs transition">Desbloquear Loja</button>`;
    } else if (status === 'pausado') {
        container.innerHTML = `<button onclick="changeClientStatus('activate')" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase text-xs transition">Ativar Loja</button>`;
    } else {
        container.innerHTML = `<div class="flex gap-2"><button onclick="changeClientStatus('block')" class="bg-red-600 hover:bg-red-500 text-white px-4 py-3 rounded font-bold uppercase text-xs w-1/2 transition">Bloquear</button><button onclick="changeClientStatus('pause')" class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-3 rounded font-bold uppercase text-xs w-1/2 transition">Pausar</button></div>`;
    }
}

function updateStatusBadge(status, active) {
    const el = document.getElementById('inp-status-display');
    if (status === 'bloqueado' || active === false) {
        el.className = "bg-red-900/20 border border-red-900 text-red-500 text-[10px] font-bold rounded p-2 text-center uppercase";
        el.innerText = "Bloqueado";
    } else if (status === 'pausado') {
        el.className = "bg-yellow-900/20 border border-yellow-900 text-yellow-500 text-[10px] font-bold rounded p-2 text-center uppercase";
        el.innerText = "Pausado";
    } else {
        el.className = "bg-green-900/20 border border-green-900 text-green-500 text-[10px] font-bold rounded p-2 text-center uppercase";
        el.innerText = "Ativo";
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

async function deleteCurrentClient() {
    if (!currentDocId) return;
    if (!confirm("Excluir?")) return;
    try {
        await deleteDoc(doc(db, "sites", currentDocId));
        closeClientModal();
        loadClients();
    } catch (e) { alert("Erro ao excluir"); }
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

async function loadFinancials(siteId) {
    document.getElementById('fin-orders').innerText = "0";
    document.getElementById('fin-sales').innerText = "0";
    document.getElementById('fin-revenue').innerText = "R$ 0,00";
    
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
        document.getElementById('fin-sales').innerText = total; 
        document.getElementById('fin-revenue').innerText = `R$ ${rev.toFixed(2)}`;
    } catch(e) { }
}