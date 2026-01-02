let deps = {}; 
const MASTER_SUPPORT_KEY = ""; 

export function initSupportModule(dependencies) {
    deps = dependencies;
    
    // Persistência: Se der F5 e estiver logado, volta pra tela de suporte
    if (sessionStorage.getItem('support_mode') === 'true') {
        // Aguarda o DOM carregar (pequeno delay seguro) ou chama direto se o app.js já carregou
        setTimeout(() => {
             // Precisamos acessar a função global showView, mas como é module, 
             // o app.js não a exportou globalmente ainda? 
             // Vamos forçar via HTML class manipulation aqui mesmo para garantir.
             const viewSupport = document.getElementById('view-support');
             const viewCatalog = document.getElementById('view-catalog');
             const viewAdmin = document.getElementById('view-admin');
             
             if(viewSupport) viewSupport.classList.remove('hidden');
             if(viewCatalog) viewCatalog.classList.add('hidden');
             if(viewAdmin) viewAdmin.classList.add('hidden');
        }, 100);
    }

    exposeToWindow();
}

export function checkAndActivateSupport(password) {
    if (password === MASTER_SUPPORT_KEY) {
        sessionStorage.setItem('support_mode', 'true');
        return true;
    }
    return false;
}

// Função para Sair do Suporte
function exitSupportMode() {
    sessionStorage.removeItem('support_mode');
    window.location.reload(); // Recarrega para limpar estado e voltar à vitrine
}

// --- Ferramentas ---
function emergencyClearCache() {
    if(!confirm("Limpar cache e reiniciar?")) return;
    localStorage.clear(); // Limpa tudo radicalmente no modo suporte
    window.location.reload();
}

function emergencyResetOrders() {
    localStorage.removeItem('site_orders_history');
    if (deps.state) deps.state.myOrders = [];
    deps.showToast("Sistema reiniciado.", "success");
    
    // Tenta resetar visualmente
    if(deps.checkActiveOrders) deps.checkActiveOrders();
}

function runDiagnostics() {
    const box = document.getElementById('debug-info-box');
    const info = {
        Status: 'SYSTEM OK',
        Memory: window.performance ? window.performance.memory : 'N/A',
        StorageUsed: localStorage.length,
        ModulesLoaded: true
    };
    if(box) box.innerHTML = `> Executing diagnostic...\n> ${JSON.stringify(info, null, 2)}`;
}

function exposeToWindow() {
    window.exitSupportMode = exitSupportMode;
    window.emergencyClearCache = emergencyClearCache;
    window.emergencyResetOrders = emergencyResetOrders;
    window.runDiagnostics = runDiagnostics;
}

//===============================================================================//===============================================================================
//FUNÇÕES INICIO
//===============================================================================//===============================================================================


//===============================================================================//===============================================================================
//FUNÇÕES FIM
//===============================================================================//===============================================================================