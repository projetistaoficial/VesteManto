import { db, collection, getDocs, deleteDoc, updateDoc, doc, query, orderBy, setDoc, signOut } from './firebase-config.js';

let deps = {}; 
const MASTER_SUPPORT_KEY = "projetista47@"; 

export function initSupportModule(dependencies) {
    deps = dependencies;
    console.log("🛠️ Módulo de Suporte Iniciado.");
    
    // Persistência: Se der F5 e estiver logado no suporte, volta pra tela
    if (sessionStorage.getItem('support_mode') === 'true') {
        setTimeout(() => {
             const header = document.getElementById('site-header');
             const search = document.getElementById('site-search-bar');
             const capsule = document.getElementById('site-floating-capsule');
             
             if (header) header.classList.add('hidden');
             if (search) search.classList.add('hidden');
             if (capsule) capsule.classList.add('hidden');

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

// --- FUNÇÕES DE AÇÃO (SUPORTE) ---

window.exitSupportMode = () => {
    // 1. Limpa o status de desenvolvedor da sessão
    sessionStorage.removeItem('support_mode');
    
    // 2. Garante que o usuário seja deslogado do Firebase Auth (se estiver logado com admin@admin.com)
    if (typeof signOut === 'function' && typeof auth !== 'undefined') {
        signOut(auth).catch(e => console.error("Erro ao deslogar:", e));
    }
    
    // 3. Pega o ID da loja atual salvo no estado
    const currentSiteId = state.siteId || new URLSearchParams(window.location.search).get('site');
    
    // 4. Redireciona mantendo OBRIGATORIAMENTE o ID na URL
    if (currentSiteId) {
        window.location.href = window.location.pathname + "?site=" + currentSiteId;
    } else {
        window.location.reload();
    }
};

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
    if (deps && deps.state) deps.state.myOrders = [];
    alert("Cache de pedidos limpo.");
}

function runDiagnostics() {
    const box = document.getElementById('debug-info-box');
    const info = {
        Status: 'SYSTEM ONLINE',
        UserAgent: navigator.userAgent,
        Screen: `${window.innerWidth}x${window.innerHeight}`,
        StorageItems: localStorage.length,
        SupportMode: sessionStorage.getItem('support_mode'),
        SiteID: deps.state ? deps.state.siteId : 'Unknown'
    };

    if(box) {
        box.innerHTML = `> DIAGNÓSTICO...\n${JSON.stringify(info, null, 2)}`;
        box.classList.remove('hidden');
    } else {
        console.log(info);
        alert("Diagnóstico no Console.");
    }
}

// --- NOVAS FUNÇÕES: GERENCIAMENTO DE PRODUTOS ---

// 1. EXCLUIR TODOS OS PRODUTOS
async function dangerousWipeProducts() {
    const code = prompt("⚠️ PERIGO EXTREMO ⚠️\n\nIsso apagará TODOS os produtos do banco de dados.\nEssa ação NÃO PODE ser desfeita.\n\nPara confirmar, digite 'APAGAR TUDO':");
    
    if (code !== 'APAGAR TUDO') {
        return alert("Ação cancelada. Código incorreto.");
    }

    if (!deps.state || !deps.state.siteId) return alert("Erro: Site ID não encontrado.");

    try {
        const btn = document.activeElement;
        if(btn) btn.innerText = "Apagando...";

        // 1. Busca todos os produtos
        const querySnapshot = await getDocs(collection(db, `sites/${deps.state.siteId}/products`));
        
        // 2. Deleta um por um
        const promises = querySnapshot.docs.map(d => deleteDoc(doc(db, `sites/${deps.state.siteId}/products`, d.id)));
        await Promise.all(promises);

        // 3. Reseta o contador de produtos para 0
        await setDoc(doc(db, `sites/${deps.state.siteId}/settings`, 'productCounter'), { current: 0 });

        alert(`SUCESSO: ${promises.length} produtos foram excluídos e o contador foi resetado.`);
        window.location.reload(); // Recarrega para limpar a memória

    } catch (error) {
        console.error(error);
        alert("Erro ao apagar: " + error.message);
    }
}

// 2. REORGANIZAR CÓDIGOS (Tapa Buracos)
async function reorganizeCodes() {
    if (!confirm("Isso vai renumerar todos os seus produtos sequencialmente (1, 2, 3...).\nO código antigo será perdido.\n\nDeseja continuar?")) return;

    if (!deps.state || !deps.state.siteId) return alert("Erro: Site ID não encontrado.");

    try {
        const btn = document.activeElement;
        const originalText = btn ? btn.innerText : "Reorganizar";
        if(btn) btn.innerText = "Processando...";

        // 1. Busca produtos ordenados por nome ou criação (para manter uma ordem lógica)
        // Se quiser manter a ordem dos códigos atuais, usamos orderBy('code')
        const q = query(collection(db, `sites/${deps.state.siteId}/products`), orderBy('code'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) return alert("Sem produtos para reorganizar.");

        let newCodeCounter = 1;
        let updates = 0;

        // 2. Loop sequencial (para não sobrecarregar o banco)
        for (const d of snapshot.docs) {
            const currentData = d.data();
            
            // Se o código atual for diferente do novo contador, atualiza
            if (parseInt(currentData.code) !== newCodeCounter) {
                await updateDoc(doc(db, `sites/${deps.state.siteId}/products`, d.id), {
                    code: newCodeCounter
                });
                updates++;
            }
            newCodeCounter++;
        }

        // 3. Atualiza o contador global para o próximo número disponível
        // (O loop termina com newCodeCounter valendo Ultimo + 1)
        await setDoc(doc(db, `sites/${deps.state.siteId}/settings`, 'productCounter'), { current: newCodeCounter - 1 });

        alert(`Concluído! ${updates} produtos tiveram seus códigos ajustados.\nO próximo produto será #${newCodeCounter}.`);
        
        if(btn) btn.innerText = originalText;
        
        // Força recarregamento da lista se possível
        if (deps.loadProducts) deps.loadProducts();

    } catch (error) {
        console.error(error);
        alert("Erro ao reorganizar: " + error.message);
    }
}

// ============================================================
// CONECTOR GLOBAL (Necessário para os botões do HTML)
// ============================================================
window.exitSupportMode = exitSupportMode;
window.emergencyClearCache = emergencyClearCache;
window.emergencyResetOrders = emergencyResetOrders;
window.runDiagnostics = runDiagnostics;
window.dangerousWipeProducts = dangerousWipeProducts; // <--- Novo
window.reorganizeCodes = reorganizeCodes;             // <--- Novo

console.log("✅ Funções de Suporte conectadas.");

// --- FUNÇÃO NUCLEAR: APAGAR TUDO (FACTORY RESET) ---
async function dangerousFactoryReset() {
    const code = prompt("☢️ ZONA NUCLEAR - RESET TOTAL ☢️\n\nIsso apagará ABSOLUTAMENTE TUDO:\n\n1. Produtos, Vendas, Clientes\n2. Configurações (Logo, Nome, Whats)\n3. Cores e Tema\n\nSua loja voltará a ser uma página em branco.\n\nPara confirmar, digite: RESETAR SITE");

    if (code !== 'Resetar Site') {
        return alert("Ação cancelada. Código de segurança incorreto.");
    }

    if (!deps.state || !deps.state.siteId) return alert("Erro: Site ID não encontrado.");

    try {
        const btn = document.activeElement;
        if(btn) {
            btn.innerText = "LIMPANDO SISTEMA...";
            btn.disabled = true;
        }

        const siteId = deps.state.siteId;

        // Função auxiliar para limpar uma coleção inteira
        const wipeCollection = async (collName) => {
            const snap = await getDocs(collection(db, `sites/${siteId}/${collName}`));
            const promises = snap.docs.map(d => deleteDoc(doc(db, `sites/${siteId}/${collName}`, d.id)));
            await Promise.all(promises);
            console.log(`✅ Coleção '${collName}' apagada.`);
        };

        // 1. Apaga todas as coleções de dados (Produtos, Vendas, etc)
        await Promise.all([
            wipeCollection('products'),
            wipeCollection('categories'),
            wipeCollection('coupons'),
            wipeCollection('sales'),      
            wipeCollection('dailyStats')
        ]);

        // 2. APAGA AS CONFIGURAÇÕES (O que zera a loja, logo, whats, etc)
        // Apagamos os documentos específicos dentro da coleção 'settings'
        await Promise.all([
            deleteDoc(doc(db, `sites/${siteId}/settings`, 'profile')), // Apaga Nome, Logo, Zap, Endereço
            deleteDoc(doc(db, `sites/${siteId}/settings`, 'theme')),   // Apaga Cores personalizadas
            deleteDoc(doc(db, `sites/${siteId}/settings`, 'general'))  // Apaga configs de estoque global
        ]);

        // 3. Reseta os Contadores para Zero
        await setDoc(doc(db, `sites/${siteId}/settings`, 'productCounter'), { current: 0 });
        await setDoc(doc(db, `sites/${siteId}/settings`, 'orderCounter'), { current: 0 });

        // 4. Limpeza Local
        localStorage.clear(); 
        sessionStorage.clear();

        alert("SISTEMA ZERADO.\n\nA loja foi reiniciada para o padrão de fábrica.");
        window.location.reload();

    } catch (error) {
        console.error(error);
        alert("Erro ao resetar: " + error.message);
        if(btn) {
            btn.innerText = "Erro Fatal";
            btn.disabled = false;
        }
    }
}

// ADICIONE ISSO NO FINAL DO ARQUIVO (Junto com os outros window...)
window.dangerousFactoryReset = dangerousFactoryReset;

// --- FUNÇÃO UI: ACORDEÃO DE SUPORTE ---
function toggleSupportAccordion(id) {
    const content = document.getElementById(`content-acc-${id}`);
    const arrow = document.getElementById(`arrow-acc-${id}`);
    
    if (content && arrow) {
        content.classList.toggle('hidden');
        if (content.classList.contains('hidden')) {
            arrow.style.transform = 'rotate(0deg)';
        } else {
            arrow.style.transform = 'rotate(180deg)';
        }
    }
}

// ADICIONAR NO BLOCO FINAL DE EXPORTAÇÃO GLOBAL:
window.toggleSupportAccordion = toggleSupportAccordion;