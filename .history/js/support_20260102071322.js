// js/support.js

let deps = {}; // Dependências (state, showToast, etc)
const MASTER_SUPPORT_KEY = "suporte123"; // <--- SUA SENHA MESTRA

export function initSupportModule(dependencies) {
    deps = dependencies;
    
    // Verifica se já estava logado como suporte (persistência de sessão)
    if (sessionStorage.getItem('support_mode') === 'true') {
        enableSupportModeUI();
    }

    exposeToWindow();
}

// --- Lógica de Acesso ---

// Função chamada pelo Login do App.js
export function checkAndActivateSupport(password) {
    if (password === MASTER_SUPPORT_KEY) {
        enableSupportModeUI();
        sessionStorage.setItem('support_mode', 'true'); // Mantém ativo se der F5
        return true; // Retorna sucesso
    }
    return false;
}

function enableSupportModeUI() {
    // Mostra o botão da aba de suporte
    const btnSupport = document.getElementById('btn-tab-support');
    if (btnSupport) {
        btnSupport.classList.remove('hidden');
        // Opcional: Adiciona um indicador visual no painel
        deps.showToast("Modo Suporte: Ativado", "success");
    }
}

// --- Ferramentas (Mantidas iguais) ---

function emergencyClearCache() {
    if(!confirm("Isso limpará dados locais e recarregará a página.\nContinuar?")) return;
    localStorage.removeItem('cart');
    localStorage.removeItem('site_orders_history');
    sessionStorage.removeItem('support_mode'); // Sai do modo suporte
    alert("Cache limpo.");
    window.location.reload();
}

function emergencyResetOrders() {
    if (deps.windowRef && deps.windowRef.activeListeners) {
        deps.windowRef.activeListeners.forEach(u => u());
        deps.windowRef.activeListeners = [];
    }
    localStorage.removeItem('site_orders_history');
    if (deps.state) deps.state.myOrders = [];
    deps.showToast("Monitoramento resetado.", "info");
    
    if(deps.loadAdminSales) deps.loadAdminSales();
    if(deps.checkActiveOrders) deps.checkActiveOrders();
}

function runDiagnostics() {
    const box = document.getElementById('debug-info-box');
    const info = {
        Mode: 'Support Access',
        SiteID: deps.state ? deps.state.siteId : 'N/A',
        ProdCount: deps.state ? deps.state.products.length : 0,
        LocalStorageKeys: Object.keys(localStorage),
        Time: new Date().toLocaleTimeString()
    };
    if(box) box.innerHTML = `<pre class="text-[10px] text-green-400">${JSON.stringify(info, null, 2)}</pre>`;
}

function exposeToWindow() {
    window.emergencyClearCache = emergencyClearCache;
    window.emergencyResetOrders = emergencyResetOrders;
    window.runDiagnostics = runDiagnostics;
}