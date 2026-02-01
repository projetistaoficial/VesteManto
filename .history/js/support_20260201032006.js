let deps = {}; 
const MASTER_SUPPORT_KEY = "projetista47@"; 

export function initSupportModule(dependencies) {
    deps = dependencies;
    
    // Persistência: Se der F5 e estiver logado, volta pra tela de suporte
    if (sessionStorage.getItem('support_mode') === 'true') {
        a
        // Pequeno delay para garantir que o DOM existe
        setTimeout(() => {
             // 1. ESCONDE O TOPO (O que faltava)
             const header = document.getElementById('site-header');
             const search = document.getElementById('site-search-bar');
             const capsule = document.getElementById('site-floating-capsule'); // Ícones flutuantes
             
             if (header) header.classList.add('hidden');
             if (search) search.classList.add('hidden');
             if (capsule) capsule.classList.add('hidden');

             // 2. TROCA AS TELAS
             const viewSupport = document.getElementById('view-support');
             const viewCatalog = document.getElementById('view-catalog');
             const viewAdmin = document.getElementById('view-admin');
             
             if(viewSupport) viewSupport.classList.remove('hidden');
             if(viewCatalog) viewCatalog.classList.add('hidden');
             if(viewAdmin) viewAdmin.classList.add('hidden');
             
             // Remove padding do body se necessário (para ficar tela cheia real)
             document.body.classList.remove('pt-6');
        }, 50);
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