import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

// ELEMENTOS DOM
const listContainer = document.getElementById('clients-list');
const modal = document.getElementById('client-modal');

// INICIALIZAÇÃO
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
    
    // Filtro
    const searchInput = document.getElementById('search-input');
    if(searchInput) searchInput.addEventListener('input', (e) => filterClients(e.target.value));
});

// --- CARREGAR CLIENTES ---
async function loadClients() {
    listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Carregando...</div>';
    try {
        const snap = await getDocs(collection(db, "sites"));
        allClients = [];
        snap.forEach(doc => allClients.push({ docId: doc.id, ...doc.data() }));
        
        allClients.sort((a, b) => (a.code || 0) - (b.code || 0));
        renderClients(allClients);
    } catch (e) {
        console.error(e);
        listContainer.innerHTML = '<div class="p-4 text-center text-red-500">Erro ao carregar lista.</div>';
    }
}

function renderClients(clients) {
    listContainer.innerHTML = '';
    if (clients.length === 0) {
        listContainer.innerHTML = '<div class="p-4 text-center text-gray-500">Nenhum cliente cadastrado.</div>';
        return;
    }

    clients.forEach(client => {
        let statusBadge = '<span class="px-2 py-1 rounded bg-green-900 text-green-400 text-xs font-bold border border-green-700">ATIVO</span>';
        
        if (client.status === 'pausado') {
            statusBadge = '<span class="px-2 py-1 rounded bg-yellow-900 text-yellow-400 text-xs font-bold border border-yellow-700">PAUSADO</span>';
        } else if (client.status === 'bloqueado' || client.active === false) {
            statusBadge = '<span class="px-2 py-1 rounded bg-red-900 text-red-400 text-xs font-bold border border-red-700">BLOQUEADO</span>';
        }

        const fullLink = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
        const row = document.createElement('div');
        row.className = "grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition";
        row.onclick = (e) => {
            if(!e.target.closest('button') && !e.target.closest('input')) openClientModal(client.docId);
        };

        row.innerHTML = `
            <div class="col-span-1 text-center font-mono text-gray-500 font-bold">${client.code || '#'}</div>
            <div class="col-span-4 font-bold text-white truncate">${client.name}</div>
            <div class="col-span-3 flex items-center bg-black border border-gray-700 rounded px-2 py-1">
                <input type="text" value="${fullLink}" class="bg-transparent text-blue-400 text-xs w-full focus:outline-none" readonly>
                <button onclick="copyToClipboard('${fullLink}')" class="text-gray-500 hover:text-white ml-2"><i class="far fa-copy"></i></button>
            </div>
            <div class="col-span-2 text-center text-gray-400 text-xs">${client.plan?.name || 'Mensal'}</div>
            <div class="col-span-2 text-center">${statusBadge}</div>
        `;
        listContainer.appendChild(row);
    });
}

// --- ABRIR MODAL (CORRIGIDO PARA DADOS E BOTÕES) ---
async function openClientModal(docId = null) {
    currentDocId = docId;
    modal.classList.remove('translate-y-full');
    
    // Limpa campos antes de preencher
    document.getElementById('inp-name').value = '';
    document.getElementById('inp-site-slug').value = '';
    document.getElementById('inp-site-slug').disabled = false;
    document.getElementById('inp-site-link').value = '';
    
    // Limpa Inputs do Dono (IMPORTANTE PARA EVITAR DADOS MISTURADOS)
    ['inp-owner', 'inp-doc', 'inp-insta', 'inp-face', 'inp-yt', 'inp-tel', 'inp-whats', 'inp-email'].forEach(id => {
        document.getElementById(id).value = '';
    });

    // Elementos de Botão
    const actActive = document.getElementById('actions-active');
    const actInactive = document.getElementById('actions-inactive');
    const btnReactivate = document.getElementById('btn-reactivate');
    const statusDisplay = document.getElementById('inp-status-display');

    if (docId) {
        // === MODO EDIÇÃO ===
        const client = allClients.find(c => c.docId === docId);
        if (client) {
            document.getElementById('modal-title').innerText = `Editar: ${client.name}`;
            document.getElementById('inp-id').value = client.code;
            document.getElementById('inp-name').value = client.name;
            document.getElementById('inp-site-slug').value = client.docId;
            document.getElementById('inp-site-slug').disabled = true;
            document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${client.docId}`;
            
            // PREENCHE DADOS DO DONO (Se existirem)
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

            // ATUALIZA BOTÕES E STATUS
            if (client.status === 'bloqueado' || client.active === false) {
                // ESTÁ BLOQUEADO
                statusDisplay.innerText = "BLOQUEADO";
                statusDisplay.className = "w-full bg-red-900/30 border border-red-700 rounded p-2 text-sm text-red-500 font-bold text-center";
                
                actActive.classList.add('hidden');
                actInactive.classList.remove('hidden');
                btnReactivate.innerHTML = '<i class="fas fa-unlock"></i> <span>DESBLOQUEAR LOJA</span>';
                btnReactivate.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded transition flex justify-center items-center gap-2";
            } 
            else if (client.status === 'pausado') {
                // ESTÁ PAUSADO
                statusDisplay.innerText = "PAUSADO";
                statusDisplay.className = "w-full bg-yellow-900/30 border border-yellow-700 rounded p-2 text-sm text-yellow-500 font-bold text-center";
                
                actActive.classList.add('hidden');
                actInactive.classList.remove('hidden');
                btnReactivate.innerHTML = '<i class="fas fa-play"></i> <span>REATIVAR LOJA</span>';
                btnReactivate.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded transition flex justify-center items-center gap-2";
            } 
            else {
                // ESTÁ ATIVO
                statusDisplay.innerText = "ATIVO";
                statusDisplay.className = "w-full bg-green-900/30 border border-green-700 rounded p-2 text-sm text-green-500 font-bold text-center";
                
                actActive.classList.remove('hidden');
                actInactive.classList.add('hidden');
            }
            
            // Carrega financeiro (simples)
            loadFinancials(client.docId);
        }
    } else {
        // === MODO NOVO ===
        document.getElementById('modal-title').innerText = 'Novo Cliente';
        document.getElementById('inp-id').value = getNextCode();
        
        statusDisplay.innerText = "NOVO (ATIVO)";
        statusDisplay.className = "w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-gray-400 font-bold text-center";
        
        actActive.classList.remove('hidden');
        actInactive.classList.add('hidden');
    }
    
    switchTab('cadastro');
}

// --- SALVAR DADOS (GARANTIR QUE OWNER DATA É SALVO) ---
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
    
    const data = {
        name: name,
        ownerData: ownerData,
        // Se novo, adiciona código e data
        ...(!currentDocId && { code: parseInt(document.getElementById('inp-id').value), createdAt: new Date().toISOString(), status: 'ativo', active: true })
    };

    try {
        await setDoc(doc(db, "sites", docId), data, { merge: true });
        alert("Salvo com sucesso!");
        closeClientModal();
        loadClients(); // Recarrega lista para atualizar dados
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    }
}

// --- MUDAR STATUS (Pausar/Bloquear/Ativar) ---
async function changeClientStatus(action) {
    if (!currentDocId) return;

    let newStatus = 'ativo';
    let isActive = true;
    let msg = "ATIVAR";

    if (action === 'block') { newStatus = 'bloqueado'; isActive = false; msg = "BLOQUEAR"; }
    if (action === 'pause') { newStatus = 'pausado'; isActive = false; msg = "PAUSAR"; }
    
    if(!confirm(`Deseja realmente ${msg} este cliente?`)) return;

    try {
        await updateDoc(doc(db, "sites", currentDocId), { status: newStatus, active: isActive });
        alert(`Status alterado para: ${newStatus.toUpperCase()}`);
        closeClientModal(); // Fecha para forçar atualização
        loadClients();      // Recarrega lista
    } catch (e) {
        alert("Erro ao alterar status.");
    }
}

// --- EXCLUIR ---
async function deleteCurrentClient() {
    if(!currentDocId) return;
    const confirmCode = prompt(`DIGITE O CÓDIGO DA LOJA PARA CONFIRMAR EXCLUSÃO:\n${currentDocId}`);
    
    if(confirmCode !== currentDocId) return alert("Código incorreto. Cancelado.");

    try {
        await deleteDoc(doc(db, "sites", currentDocId));
        alert("Cliente excluído.");
        closeClientModal();
        loadClients();
    } catch (e) {
        alert("Erro ao excluir: " + e.message);
    }
}

// --- UTILITÁRIOS ---
function getNextCode() {
    if (allClients.length === 0) return 1;
    return Math.max(...allClients.map(c => parseInt(c.code) || 0)) + 1;
}

window.generateSiteLink = () => {
    const name = document.getElementById('inp-name').value;
    if(!name) return alert("Digite o nome primeiro");
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    document.getElementById('inp-site-slug').value = slug;
    document.getElementById('inp-site-link').value = `${PRODUCTION_DOMAIN}?site=${slug}`;
}

window.copyToClipboard = (txt) => { navigator.clipboard.writeText(txt).then(() => alert("Copiado!")); }
window.closeClientModal = () => { modal.classList.add('translate-y-full'); currentDocId = null; }
window.switchTab = (tab) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = btn.dataset.target === tab ? "tab-btn px-3 py-1 rounded bg-gray-700 text-white text-xs font-bold" : "tab-btn px-3 py-1 rounded text-gray-400 text-xs font-bold hover:bg-gray-800";
    });
}
function filterClients(term) {
    const t = term.toLowerCase();
    const filtered = allClients.filter(c => c.name.toLowerCase().includes(t) || c.docId.includes(t));
    renderClients(filtered);
}
async function loadFinancials(siteId) {
    const ordersEl = document.getElementById('fin-orders');
    const salesEl = document.getElementById('fin-sales');
    const revEl = document.getElementById('fin-revenue');
    if(ordersEl) {
        ordersEl.innerText = "Carregando...";
        try {
            const q = await getDocs(collection(db, `sites/${siteId}/orders`));
            let total = 0, sales = 0, rev = 0;
            q.forEach(d => {
                total++;
                if(['approved', 'paid', 'delivered'].includes(d.data().status)) {
                    sales++;
                    rev += parseFloat(d.data().total || 0);
                }
            });
            ordersEl.innerText = total;
            salesEl.innerText = sales;
            revEl.innerText = `R$ ${rev.toFixed(2)}`;
        } catch(e) {
            ordersEl.innerText = "Erro";
        }
    }
}