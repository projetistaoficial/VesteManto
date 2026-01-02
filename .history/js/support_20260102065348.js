// js/support.js

// Variáveis locais do módulo
let isSupportAuthenticated = false;
const MASTER_SUPPORT_KEY = "suporte123"; // <--- SUA SENHA AQUI
let deps = {}; // Armazena as dependências (state, showToast, etc)

// Função Principal de Inicialização
export function initSupportModule(dependencies) {
    // 1. Guarda as dependências para usar nas funções internas
    deps = dependencies;

    // 2. Configura o Sistema de Abas com Proteção
    setupTabSecurity();

    // 3. Torna as funções acessíveis no HTML (window)
    exposeToWindow();

    // 4. Listener do Enter na senha
    const passInput = document.getElementById('support-password-input');
    if(passInput) {
        passInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') verifySupportAccess();
        });
    }
}

// Lógica de Interceptação das Abas
function setupTabSecurity() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        // Remove listeners antigos (cloneNode) para evitar duplicação ou conflito
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.onclick = (e) => {
            const targetId = newBtn.dataset.tab;

            // 1. Bloqueio de Segurança para Aba Suporte
            if (targetId === 'tab-suporte') {
                if (!isSupportAuthenticated) {
                    openSupportAuth(); 
                    return; // Para aqui, não troca a aba
                }
            }

            // 2. Comportamento Padrão de Troca de Abas
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const target = document.getElementById(targetId);
            if (target) target.classList.remove('hidden');

            // 3. Estilos dos Botões
            document.querySelectorAll('.tab-btn').forEach(b => {
                b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500');
                // Se não for o botão de suporte (que é vermelho), fica cinza
                if (b.dataset.tab !== 'tab-suporte') b.classList.add('text-gray-400');
                
                // Se for o botão de suporte, volta a ser vermelho inativo
                if (b.dataset.tab === 'tab-suporte') {
                    b.classList.remove('text-red-500', 'border-red-500');
                    b.classList.add('text-red-500'); // Mantém vermelho texto
                }
            });

            // 4. Estilo Ativo
            if (targetId === 'tab-suporte') {
                newBtn.classList.add('border-b-2', 'border-red-500');
            } else {
                newBtn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500');
                newBtn.classList.remove('text-gray-400');
            }
        };
    });
}

// --- Funções Internas de Lógica ---

function openSupportAuth() {
    const modal = document.getElementById('modal-support-auth');
    const input = document.getElementById('support-password-input');
    if (modal) {
        modal.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeSupportAuth() {
    const modal = document.getElementById('modal-support-auth');
    if (modal) modal.classList.add('hidden');
}

function verifySupportAccess() {
    const input = document.getElementById('support-password-input');
    const pass = input.value.trim();

    if (pass === MASTER_SUPPORT_KEY) {
        isSupportAuthenticated = true;
        closeSupportAuth();
        deps.showToast("Modo Suporte Ativado!", "success");
        
        // Simula clique para abrir a aba agora que está liberado
        const tabBtn = document.querySelector('button[data-tab="tab-suporte"]');
        if (tabBtn) tabBtn.click();
    } else {
        deps.showToast("Acesso Negado.", "error");
        input.classList.add('border-red-500');
        setTimeout(() => input.classList.remove('border-red-500'), 500);
    }
}

// Ferramentas de Manutenção

function emergencyClearCache() {
    if(!confirm("Isso irá deslogar sua conta e limpar o carrinho local.\nContinuar?")) return;
    
    localStorage.removeItem('cart');
    localStorage.removeItem('site_orders_history');
    // localStorage.clear(); // Opcional: Limpar tudo
    
    alert("Cache limpo. A página será recarregada.");
    window.location.reload();
}

function emergencyResetOrders() {
    // Tenta limpar os listeners do app.js se foram passados
    if (deps.windowRef && deps.windowRef.activeListeners) {
        deps.windowRef.activeListeners.forEach(u => u());
        deps.windowRef.activeListeners = [];
    }

    localStorage.removeItem('site_orders_history');
    deps.state.myOrders = [];
    
    deps.showToast("Monitoramento resetado. Recarregando lista...", "info");
    
    // Chama funções do app.js para recarregar
    if(deps.loadAdminSales) deps.loadAdminSales();
    if(deps.checkActiveOrders) deps.checkActiveOrders();
}

function runDiagnostics() {
    const box = document.getElementById('debug-info-box');
    const authUser = deps.auth.currentUser;

    const info = {
        AppVersion: '1.1.0 (Modular)',
        User: authUser ? authUser.email : 'Não logado',
        SiteID: deps.state.siteId,
        TotalProdutos: deps.state.products.length,
        TotalPedidosMemoria: deps.state.orders.length,
        TemaAtual: localStorage.getItem('theme') || 'Padrão',
        Carrinho: deps.state.cart.length + ' itens',
        DataHora: new Date().toLocaleString()
    };

    box.innerHTML = `<pre class="text-[10px] text-green-400">${JSON.stringify(info, null, 2)}</pre>`;
}

// --- Expor para o HTML (Window) ---
// Como é type="module", as funções não são globais por padrão.
// Precisamos anexar manualmente ao window para o onclick="" funcionar.
function exposeToWindow() {
    window.closeSupportAuth = closeSupportAuth;
    window.verifySupportAccess = verifySupportAccess;
    window.emergencyClearCache = emergencyClearCache;
    window.emergencyResetOrders = emergencyResetOrders;
    window.runDiagnostics = runDiagnostics;
}