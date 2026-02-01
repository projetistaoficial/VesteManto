import { signOut } from './firebase-config.js'; // Garante que temos acesso a funcoes basicas se precisar

let deps = {}; 
const MASTER_SUPPORT_KEY = "projetista47@"; 

export function initSupportModule(dependencies) {
    deps = dependencies;
    console.log("🛠️ Módulo de Suporte Iniciado.");
    
    // Persistência: Se der F5 e estiver logado no suporte, volta pra tela
    if (sessionStorage.getItem('support_mode') === 'true') {
        
        // Pequeno delay para garantir que o DOM existe
        setTimeout(() => {
             // 1. ESCONDE O TOPO
             const header = document.getElementById('site-header');
             const search = document.getElementById('site-search-bar');
             const capsule = document.getElementById('site-floating-capsule');
             
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
             
             document.body.classList.remove('pt-6');
        }, 50);
    }
}

export function checkAndActivateSupport(password) {
    if (password === MASTER_SUPPORT_KEY) {
        sessionStorage.setItem('support_mode', 'true');
        return true;
    }
    return false;
}

// --- FUNÇÕES INTERNAS (Ações dos Botões) ---

function exitSupportMode() {
    sessionStorage.removeItem('support_mode');
    window.location.href = window.location.pathname; // Recarrega limpo (melhor que reload)
}

function emergencyClearCache() {
    if(!confirm("⚠️ ATENÇÃO: Isso limpará TODOS os dados locais (Login, Carrinho, Cache).\nDeseja continuar?")) return;
    
    localStorage.clear();
    sessionStorage.clear();
    
    alert("Sistema limpo. A página será recarregada.");
    window.location.reload();
}

function emergencyResetOrders() {
    if(!confirm("Isso apagará o histórico de pedidos SALVO NO NAVEGADOR (cache visual).\nNão apaga do banco de dados.\nContinuar?")) return;

    localStorage.removeItem('site_orders_history');
    
    // Tenta limpar na memória se o app principal estiver rodando
    if (deps && deps.state) {
        deps.state.myOrders = [];
    }
    
    if (deps && typeof deps.showToast === 'function') {
        deps.showToast("Cache de pedidos limpo.", "success");
    } else {
        alert("Cache de pedidos limpo.");
    }
    
    // Atualiza visualmente se possível
    if(deps && typeof deps.checkActiveOrders === 'function') deps.checkActiveOrders();
}

function runDiagnostics() {
    const box = document.getElementById('debug-info-box');
    
    // Coleta dados básicos
    const info = {
        Status: 'SYSTEM ONLINE',
        UserAgent: navigator.userAgent,
        Screen: `${window.innerWidth}x${window.innerHeight}`,
        StorageItems: localStorage.length,
        SupportMode: sessionStorage.getItem('support_mode'),
        AppLoaded: (typeof deps.state !== 'undefined') ? 'YES' : 'NO'
    };

    if(box) {
        box.innerHTML = `> DIAGNÓSTICO INICIADO...\n> Timestamp: ${new Date().toLocaleTimeString()}\n--------------------------\n${JSON.stringify(info, null, 2)}`;
        box.classList.remove('hidden');
    } else {
        console.log("Diagnóstico:", info);
        alert("Diagnóstico rodado (veja console). Status: OK");
    }
}

// ============================================================
// CONECTOR GLOBAL DE SUPORTE (Obrigatório para os botões HTML)
// ============================================================
// Colocamos isso aqui fora para rodar assim que o arquivo for importado
// Independente se o initSupportModule foi chamado ou não.

window.exitSupportMode = exitSupportMode;
window.emergencyClearCache = emergencyClearCache;
window.emergencyResetOrders = emergencyResetOrders;
window.runDiagnostics = runDiagnostics;

console.log("✅ Funções de Suporte conectadas ao Window.");