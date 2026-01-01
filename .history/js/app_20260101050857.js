import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs, getDoc, runTransaction } from './firebase-config.js';
import { initStatsModule, updateStatsData } from './stats.js';
// =================================================================
// 1. HELPERS (FUNÇÕES AUXILIARES)
// =================================================================

const getEl = (id) => document.getElementById(id);

const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

function setupAccordion(btnId, contentId, arrowId) {
    const btn = getEl(btnId);
    const content = getEl(contentId);
    const arrow = getEl(arrowId);

    if (btn && content && arrow) {
        btn.onclick = () => {
            content.classList.toggle('hidden');
            arrow.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        };
    }
}


function formatarEnderecoAdmin(customer) {
    if (!customer) return '<span class="text-gray-500 italic text-xs">Retirada ou não informado</span>';

    // Pega os dados que já existem no seu objeto customer
    const rua = customer.street || "Rua não informada";
    const numero = customer.addressNum || "S/N";
    const bairro = customer.district || "";
    const cep = customer.cep || "";
    // Tenta pegar o complemento (vamos adicionar no passo 3) ou deixa vazio
    const complemento = customer.comp ? ` - ${customer.comp}` : "";

    return `
        <div class="flex flex-col text-left">
            <span class="text-gray-200 font-bold text-xs leading-tight">
                ${rua}, ${numero}${complemento}
            </span>
            <span class="text-gray-400 text-[10px] mt-0.5">
                ${bairro} - ${cep}
            </span>
        </div>
    `;
}

// --- FUNÇÕES DE IMAGEM ---
// 1. Converte e Comprime Imagem
async function processImageFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                // Redimensiona para no máximo 800px de largura (mantendo proporção)
                const scale = 800 / Math.max(img.width, img.height, 800);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Converte para JPEG com 70% de qualidade
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- CARROSSEL DE IMAGENS ---
window.changeViewerImage = (delta) => {
    // Reutiliza a lógica do modal para manter tudo sincronizado
    // Ao mudar a imagem aqui, mudamos no modal de fundo também
    changeModalImage(delta);

    // Atualiza a fonte da imagem do visualizador
    const p = state.products.find(x => x.id === state.focusedProductId);
    if (p && p.images) {
        const img = getEl('image-viewer-src');

        // Pequeno efeito de fade para transição suave
        img.style.opacity = '0.5';
        setTimeout(() => {
            img.src = p.images[state.currentImgIndex];
            img.style.opacity = '1';

            // Se estiver com zoom, reseta ao trocar de foto
            if (isZoomed) {
                isZoomed = false;
                img.style.transform = "scale(1)";
                img.style.cursor = "zoom-in";
                // Garante que as setas voltem a aparecer
                getEl('viewer-prev').classList.remove('hidden');
                getEl('viewer-next').classList.remove('hidden');
            }
        }, 150);
    }
};

window.changeModalImage = (delta) => {
    const p = state.products.find(x => x.id === state.focusedProductId);
    if (!p || !p.images || p.images.length <= 1) return;

    let newIndex = state.currentImgIndex + delta;

    // Lógica de loop infinito (se passar do último, volta pro primeiro)
    if (newIndex < 0) newIndex = p.images.length - 1;
    if (newIndex >= p.images.length) newIndex = 0;

    state.currentImgIndex = newIndex;
    updateCarouselUI(p.images);
};

window.setModalImage = (index) => {
    state.currentImgIndex = index;
    const p = state.products.find(x => x.id === state.focusedProductId);
    if (p) updateCarouselUI(p.images);
};

function updateCarouselUI(images) {
    const imgEl = getEl('modal-img');
    const thumbnailsEl = getEl('modal-thumbnails');

    // 1. Atualiza Imagem Principal com efeito de fade rápido
    imgEl.style.opacity = '0.5';
    setTimeout(() => {
        imgEl.src = images[state.currentImgIndex];
        imgEl.style.opacity = '1';
    }, 150);

    // 2. Atualiza Thumbnails
    if (images.length > 1) {
        thumbnailsEl.innerHTML = images.map((src, idx) => {
            const isActive = idx === state.currentImgIndex;
            const border = isActive ? 'border-yellow-500 scale-110' : 'border-gray-600 opacity-60 hover:opacity-100';
            return `
                <img src="${src}" onclick="event.stopPropagation(); setModalImage(${idx})" 
                     class="w-12 h-12 object-cover rounded border-2 ${border} cursor-pointer transition-all duration-200 shadow-lg bg-black">
            `;
        }).join('');
    } else {
        thumbnailsEl.innerHTML = '';
    }
}

// 2. Renderiza as miniaturas no formulário
function renderImagePreviews() {
    const container = getEl('prod-imgs-preview');
    if (!container) return;

    container.innerHTML = '';

    if (state.tempImages.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-xs italic w-full text-center py-4">Nenhuma imagem selecionada</p>';
        return;
    }

    state.tempImages.forEach((imgSrc, index) => {
        const div = document.createElement('div');
        div.className = "relative w-16 h-16 group border border-gray-600 rounded overflow-hidden";
        div.innerHTML = `
            <img src="${imgSrc}" class="w-full h-full object-cover">
            <button type="button" onclick="removeTempImage(${index})" class="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <i class="fas fa-trash text-red-500"></i>
            </button>
        `;
        container.appendChild(div);
    });
}

// 3. Remove imagem da lista temporária
window.removeTempImage = (index) => {
    state.tempImages.splice(index, 1);
    renderImagePreviews();
};

function showToast(message, type = 'success') {
    // Cria o elemento se não existir
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded shadow-2xl z-[100] transition-all duration-300 opacity-0 translate-y-[-20px] border border-gray-700 font-bold flex items-center gap-2';
        document.body.appendChild(toast);
    }

    // Ícone baseado no tipo
    const icon = type === 'success' ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-info-circle text-yellow-500"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;

    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-[-20px]');
    });

    // Remove depois de 1.5s
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-20px]');
    }, 1500);
}

//Esta função controla a abertura e o desaparecimento das informações do cabeçalho da PEDIDOS na aba VENDAS.
window.toggleOrderAccordion = (id) => {
    const content = document.getElementById(`order-content-${id}`);
    const arrow = document.getElementById(`order-arrow-${id}`);
    const headerInfo = document.getElementById(`order-header-info-${id}`); // O container da data/status
    const headerContainer = document.getElementById(`order-header-${id}`); // O cabeçalho em si

    if (content.classList.contains('hidden')) {
        // ABRIR
        content.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';

        // Esconde status e data do cabeçalho ao abrir
        if (headerInfo) headerInfo.classList.add('hidden');

        // Ajusta bordas para ficar grudado no conteúdo
        headerContainer.classList.remove('rounded-xl');
        headerContainer.classList.add('rounded-t-xl');
    } else {
        // FECHAR
        content.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';

        // Mostra status e data novamente ao fechar
        if (headerInfo) headerInfo.classList.remove('hidden');

        // Volta a ser arredondado completo
        headerContainer.classList.add('rounded-xl');
        headerContainer.classList.remove('rounded-t-xl');
    }
};

// Gera código sequencial para produtos (1, 2, 3...) USA TRANSACTION!!
/* async function getNextProductCode(siteId) {
    const counterRef = doc(db, `sites/${siteId}/settings`, 'productCounter');

    try {
        return await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let newCount;
            if (!counterDoc.exists()) {
                newCount = 1;
                transaction.set(counterRef, { current: newCount });
            } else {
                const current = counterDoc.data().current || 0;
                newCount = current + 1;
                transaction.update(counterRef, { current: newCount });
            }
            return newCount;
        });
    } catch (error) {
        console.error("Erro ao gerar código sequencial:", error);
        // Fallback de segurança: usa timestamp se a transação falhar
        return Date.now();
    }
}
*/
//NÃO USA TRANSACTION
async function getNextProductCode(siteId) {
    const counterRef = doc(db, `sites/${siteId}/settings`, 'productCounter');

    try {
        const counterSnap = await getDoc(counterRef);
        let newCount = 1;

        if (counterSnap.exists()) {
            // Pega o atual e soma 1
            newCount = (counterSnap.data().current || 0) + 1;
        }

        // Atualiza o contador com o novo número
        // setDoc com merge garante que cria se não existir ou atualiza se existir
        await setDoc(counterRef, { current: newCount }, { merge: true });

        return newCount;
    } catch (error) {
        console.error("Erro ao gerar código (Quota ou Permissão):", error);
        // Se der erro de cota, infelizmente só gera aleatório para não travar a venda
        // Mas com essa função mais leve, a chance de erro diminui.
        return Math.floor(1000 + Math.random() * 9000);
    }
}
// =================================================================
// 2. ESTADO GLOBAL E DOM
// =================================================================

const state = {
    siteId: new URLSearchParams(window.location.search).get('site') || 'demo',
    products: [],
    categories: [],
    coupons: [],
    orders: [], // Vendas do admin

    // Carrinho e Usuário
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: null,

    // Histórico de Pedidos do Cliente (Chave Corrigida)
    myOrders: JSON.parse(localStorage.getItem('site_orders_history')) || [],
    activeOrder: null, // Mantido apenas para compatibilidade de detalhes

    // Configurações e UI
    currentCoupon: null,
    isDarkMode: true,
    tempImages: [],
    selectedProducts: new Set(),

    // Perfil da Loja (Inicial)
    storeProfile: {
        name: 'Veste Manto',
        logo: '',
        whatsapp: '',
        description: '',
        installments: { active: false },
        deliveryConfig: { ownDelivery: false, cancelTimeMin: 5 }
    },

    // Variáveis de Dashboard/Stats
    dashDate: new Date(),
    dashViewMode: 'month',
    statsDate: new Date(),
    statsViewMode: 'month',
    statsFilterType: 'all',
    dailyStats: [],
    siteStats: { visits: 0, shares: 0 },

    // UI Helpers
    editingCouponId: null,
    focusedCouponIndex: -1,
    focusedProductId: null,
    selectedCategoryParent: null,
    globalSettings: { allowNoStock: false },
    cardSelections: {},

    //Configurações da aba PRODUTOS
    isSelectionMode: false, // : Controla se checkboxes aparecem
    selectedProducts: new Set(),
    //Configuração padrão de ordenação
    sortConfig: { key: 'code', direction: 'desc' },
};

const els = {
    // ... (Mantenha os existentes: grid, cartCount, etc.) ...
    grid: getEl('product-grid'),
    cartCount: getEl('cart-count'),
    cartCountMobile: getEl('cart-count-mobile'),
    cartModal: getEl('cart-modal'),
    cartItems: getEl('cart-items'),
    modalProduct: getEl('product-modal'),
    searchInput: getEl('search-input'),
    catFilter: getEl('category-filter'),
    pageTitle: getEl('page-title'),
    sidebar: getEl('sidebar'),
    sidebarOverlay: getEl('sidebar-overlay'),
    sidebarCategories: getEl('sidebar-categories'),
    themeToggle: getEl('theme-toggle'),
    menuBtnAdmin: getEl('menu-btn-admin'),
    menuLinkHome: getEl('menu-link-home'),
    viewCatalog: getEl('view-catalog'),
    viewAdmin: getEl('view-admin'),
    ordersList: getEl('orders-list'),
    ordersCount: getEl('orders-count'),
    productListAdmin: getEl('admin-product-list'),
    couponListAdmin: getEl('admin-coupon-list'),

    // Filtros Admin e Bulk
    filterOrderId: getEl('filter-order-id'),
    filterStatus: getEl('filter-order-status'),
    filterDateStart: getEl('filter-date-start'),
    filterDateEnd: getEl('filter-date-end'),
    btnClearFilters: getEl('btn-clear-filters'),
    adminSearchProd: getEl('admin-search-prod'),
    adminFilterCat: getEl('admin-filter-cat'),
    adminSortProd: getEl('admin-sort-prod'),
    bulkActionsBar: getEl('bulk-actions-bar'),
    selectedCount: getEl('selected-count'),
    bulkCategorySelect: getEl('bulk-category-select'),

    // Forms e Dashboard
    productFormModal: getEl('product-form-modal'),
    toggleStockGlobal: getEl('toggle-stock-global'),
    catListAdmin: getEl('admin-cat-list'),
    newCatName: getEl('new-cat-name'),
    btnAddCat: getEl('btn-add-cat'),
    dashDateDisplay: getEl('dash-date-display'),
    dashTotalItems: getEl('dash-total-items'),
    dashConfirmedCount: getEl('dash-confirmed-count'),
    dashTotalValue: getEl('dash-total-value'),
    btnViewDay: getEl('btn-view-day'),
    btnViewMonth: getEl('btn-view-month'),
    checkDay: getEl('check-day'),
    checkMonth: getEl('check-month'),
    dashPrevDate: getEl('dash-prev-date'),
    dashNextDate: getEl('dash-next-date'),
    ordersSummaryBar: getEl('orders-summary-bar'),

    // Estatísticas Avançadas
    statsFilterAll: getEl('stats-filter-all'),
    statsFilterPeriod: getEl('stats-filter-period'),
    statsDateControls: getEl('stats-date-controls'),
    statsPrevDate: getEl('stats-prev-date'),
    statsNextDate: getEl('stats-next-date'),
    statsDateDisplay: getEl('stats-date-display'),
    statsViewDay: getEl('stats-view-day'),
    statsViewMonth: getEl('stats-view-month'),
    statsCheckDay: getEl('stats-check-day'),
    statsCheckMonth: getEl('stats-check-month'),
    statVisits: getEl('stat-visits'),
    statShares: getEl('stat-shares'),
    statCapitalGiro: getEl('stat-capital-giro'),
    statSalesCount: getEl('stat-sales-count'),
    statSalesTotal: getEl('stat-sales-total'),
    statCostTotal: getEl('stat-cost-total'),
    statProfitTotal: getEl('stat-profit-total'),
    statRefunded: getEl('stat-refunded'),
    statCancelled: getEl('stat-cancelled'),
    statPending: getEl('stat-pending'),
    statRateApproval: getEl('stat-rate-approval'),
    statRateRefund: getEl('stat-rate-refund'),
    statTrend30: getEl('stat-trend-30'),

    // Sidebar Perfil
    sidebarStoreLogo: getEl('sidebar-store-logo'),
    sidebarStoreName: getEl('sidebar-store-name'),
    sidebarStoreDesc: getEl('sidebar-store-desc'),
    linkWhatsapp: getEl('link-whatsapp'),
    linkInstagram: getEl('link-instagram'),
    linkFacebook: getEl('link-facebook'),
    btnShowAddress: getEl('btn-show-address'),

    // --- CONFIGURAÇÕES DA LOJA (ATUALIZADO) ---
    confStoreName: getEl('conf-store-name'),
    confStoreLogo: getEl('conf-store-logo'),
    confStoreWpp: getEl('conf-store-wpp'),
    confStoreInsta: getEl('conf-store-insta'),
    confStoreFace: getEl('conf-store-face'),
    confStoreAddress: getEl('conf-store-address'),
    confStoreDesc: getEl('conf-store-desc'),
    btnSaveProfile: getEl('btn-save-profile'),

    // Novos campos de Logística
    confStoreCep: getEl('conf-store-cep'),
    confMaxDist: getEl('conf-max-dist'),

    // Configurações de Parcelamento Global
    btnAccInstallments: getEl('btn-acc-installments'),
    contentAccInstallments: getEl('content-acc-installments'),
    arrowAccInstallments: getEl('arrow-acc-installments'),

    confCardActive: getEl('conf-card-active'),
    confCardDetails: getEl('conf-card-details'),
    confCardMax: getEl('conf-card-max'),
    confCardFree: getEl('conf-card-free'),
    confCardRate: getEl('conf-card-rate'),

    // --- CHECKOUT MODAL (NOVO) ---
    checkoutModal: getEl('checkout-modal'),
    checkoutCep: getEl('checkout-cep'),
    checkoutNumber: getEl('checkout-number'),
    checkoutComp: getEl('checkout-comp'),
    addressDetails: getEl('address-details'),
    addrText: getEl('addr-text'),
    deliveryError: getEl('delivery-error'),
    paymentSection: getEl('payment-section'),
    btnFinishOrder: getEl('btn-finish-order'),
    checkoutTotalDisplay: getEl('checkout-total-display'),
    labelPixDiscount: getEl('label-pix-discount'),
    checkoutInstallments: getEl('checkout-installments'),
    installmentsArea: getEl('installments-area'),
    installmentObs: getEl('installment-obs'),
    btnCheckout: getEl('btn-checkout'), // Botão no carrinho

};

// =================================================================
// 3. INICIALIZAÇÃO
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    setupKeyboardListeners();
});

function initApp() {
    // 1. Carregamentos Iniciais (Mantenha apenas uma vez)
    loadSiteStats();
    incrementVisitsCounter();

    loadSettings();
    loadCategories();
    loadProducts();
    loadStoreProfile(); // <--- Importante
    loadCoupons();      // <--- Faltava carregar cupons aqui no início

    updateCartUI();
    // updateDashboardUI(); <--- Pode remover, pois o listener de loadAdminSales já vai chamar isso

    startBackgroundListeners(); // <--- Inicia o monitoramento em tempo real

    initStatsModule();


    // 2. Tema
    if (localStorage.getItem('theme') === 'light') toggleTheme(false);

    // 3. Auth Listener
    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';

        if (els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `
                <i class="fas fa-user-shield text-yellow-500 group-hover:text-white transition"></i>
                <span class="font-bold uppercase text-sm tracking-wide">${btnText}</span>
            `;
        }

        // Compatibilidade
        const btnLoginNav = getEl('btn-admin-login');
        if (btnLoginNav) btnLoginNav.innerText = btnText;

        if (user) {
            filterAndRenderProducts();
            loadAdminSales(); // Carrega vendas apenas se for admin
        } else {
            showView('catalog');
            // Se não é admin, não precisamos carregar todas as vendas do site, economiza dados
        }
    });

    // 4. Timer de atualização de cupons (mantém)
    setInterval(() => {
        if (state.coupons.length > 0 && !getEl('view-admin').classList.contains('hidden')) {
            renderAdminCoupons();
        }
    }, 10000);

    // 5. Verifica Pedidos Ativos (Motoquinha)
    // Recupera do LocalStorage para mostrar a bolinha vermelha se tiver pedido pendente
    const savedHistory = localStorage.getItem('site_orders_history');
    if (savedHistory) {
        state.myOrders = JSON.parse(savedHistory);
    }
    checkActiveOrders();
}

// =================================================================
// 4. LÓGICA DE DADOS (CARREGAMENTO)
// =================================================================

function loadSettings() {
    const docRef = doc(db, `sites/${state.siteId}/settings`, 'general');
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            state.globalSettings = docSnap.data();
            if (els.toggleStockGlobal) els.toggleStockGlobal.checked = state.globalSettings.allowNoStock;
        } else {
            setDoc(docRef, { allowNoStock: false });
            state.globalSettings = { allowNoStock: false };
        }
        renderCatalog(state.products);
    });
}

function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatalog(state.products);
        if (state.user) filterAndRenderProducts();

        // Recalcula Capital de Giro sempre que produtos mudarem
        calculateStatsMetrics();
        renderAdminCategoryList();
        updateStatsData(state.orders, state.products, state.siteStats);
    });
}

function loadCategories() {
    const q = query(collection(db, `sites/${state.siteId}/categories`), orderBy('name'));
    onSnapshot(q, (snapshot) => {
        state.categories = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCategories();
        renderAdminCategoryList();
    });
}

function loadCoupons() {
    const q = query(collection(db, `sites/${state.siteId}/coupons`));
    onSnapshot(q, (snapshot) => {
        state.coupons = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminCoupons();
    });
}

// Carrega TODAS as vendas (Usado para ambos dashboards)
function loadAdminSales() {
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));

    onSnapshot(q, (snapshot) => {
        state.orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Atualiza Dashboard e Tabela de Vendas
        if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
        if (typeof updateDashboardMetrics === 'function') updateDashboardMetrics();

        // --- CORREÇÃO IMPORTANTE ---
        // Assim que as vendas chegarem, redesenha os produtos para preencher a coluna "Vendas" e "Data"
        // Verifica se a tabela de produtos está na tela antes de chamar
        if (document.getElementById('admin-product-list')) {
            filterAndRenderProducts();
        }
        updateStatsData(state.orders, state.products, state.dailyStats);
    });
}

// Carrega Contadores de Visitas/Compartilhamentos
function loadSiteStats() {
    // Carrega a coleção de estatísticas diárias
    const q = query(collection(db, `sites/${state.siteId}/dailyStats`));
    
    onSnapshot(q, (snapshot) => {
        const dailyData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.dailyStats = dailyData; // Salva no estado global

        // Atualiza o módulo de estatísticas
        // IMPORTANTE: O terceiro parâmetro agora é state.dailyStats (array), não mais state.siteStats (objeto)
        updateStatsData(state.orders, state.products, state.dailyStats);
    });
}


// Função para registrar estatísticas diárias (Visita ou Share)
async function logDailyStat(type) {
    // type deve ser 'visits' ou 'shares'
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docRef = doc(db, `sites/${state.siteId}/dailyStats`, today);

    try {
        // Usa setDoc com merge para criar se não existir ou atualizar se existir
        // Não podemos usar runTransaction facilmente aqui sem complicar, 
        // então vamos ler e atualizar ou usar increment se possível.
        // Vamos usar uma leitura simples e escrita para simplificar o código.

        await runTransaction(db, async (transaction) => {
            const docSnap = await transaction.get(docRef);
            if (!docSnap.exists()) {
                transaction.set(docRef, { [type]: 1 });
            } else {
                const newVal = (docSnap.data()[type] || 0) + 1;
                transaction.update(docRef, { [type]: newVal });
            }
        });
        console.log(`Stat ${type} registrada para ${today}`);
    } catch (e) {
        console.error("Erro ao logar stat:", e);
    }
}

// Incrementa Visitas (Seguro: Não conta Admin)
async function incrementVisitsCounter() {
    // Evita contar admin e evita contar F5 repetido na mesma sessão
    if (auth.currentUser) return;
    if (sessionStorage.getItem('visit_logged')) return;

    sessionStorage.setItem('visit_logged', 'true');
    logDailyStat('visits');
}

// =================================================================
// 5. CÁLCULO E RENDERIZAÇÃO DE ESTATÍSTICAS (NOVO)
// =================================================================

function updateStatsUI() {
    // Alternância Visual dos Botões (Tudo vs Períodos)
    if (state.statsFilterType === 'all') {
        if (els.statsFilterAll) {
            els.statsFilterAll.classList.replace('text-black', 'text-black'); // Garante estilo
            els.statsFilterAll.classList.replace('bg-white', 'bg-white');
            els.statsFilterAll.className = "px-4 py-1 rounded-md text-sm font-bold bg-white text-black transition";
        }
        if (els.statsFilterPeriod) {
            els.statsFilterPeriod.className = "px-4 py-1 rounded-md text-sm font-bold text-gray-400 hover:text-white transition";
        }

        if (els.statsDateControls) {
            els.statsDateControls.classList.add('hidden', 'opacity-0');
            els.statsDateControls.classList.remove('flex');
        }
    } else {
        if (els.statsFilterPeriod) {
            els.statsFilterPeriod.className = "px-4 py-1 rounded-md text-sm font-bold bg-white text-black transition";
        }
        if (els.statsFilterAll) {
            els.statsFilterAll.className = "px-4 py-1 rounded-md text-sm font-bold text-gray-400 hover:text-white transition";
        }

        if (els.statsDateControls) {
            els.statsDateControls.classList.remove('hidden');
            setTimeout(() => els.statsDateControls.classList.remove('opacity-0'), 10);
            els.statsDateControls.classList.add('flex');
        }
    }

    // Display Data
    const date = state.statsDate;
    if (els.statsDateDisplay) {
        if (state.statsViewMode === 'day') {
            els.statsDateDisplay.innerText = date.toLocaleDateString('pt-BR');
            if (els.statsCheckDay) els.statsCheckDay.classList.add('bg-green-500', 'border-none');
            if (els.statsCheckMonth) {
                els.statsCheckMonth.classList.remove('bg-green-500', 'border-none');
                els.statsCheckMonth.classList.add('border-white');
            }
        } else {
            els.statsDateDisplay.innerText = date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
            if (els.statsCheckMonth) els.statsCheckMonth.classList.add('bg-green-500', 'border-none');
            if (els.statsCheckDay) {
                els.statsCheckDay.classList.remove('bg-green-500', 'border-none');
                els.statsCheckDay.classList.add('border-white');
            }
        }
    }

    calculateStatsMetrics();
}

function calculateStatsMetrics() {
    // --- 1. CAPITAL DE GIRO (Independente de Filtros de Data) ---
    // Regra: Estoque Atual * (Preço Promo ou Preço Normal)
    let capitalGiro = 0;
    if (state.products) {
        state.products.forEach(p => {
            if (p.stock > 0) {
                const val = p.promoPrice || p.price;
                capitalGiro += p.stock * val;
            }
        });
    }
    if (els.statCapitalGiro) els.statCapitalGiro.innerText = formatCurrency(capitalGiro);

    // --- 2. FILTRAGEM DE PEDIDOS ---
    if (!state.orders) return;

    let filteredOrders = state.orders;

    if (state.statsFilterType === 'period') {
        filteredOrders = state.orders.filter(o => {
            const orderDate = new Date(o.date);
            const statsDate = state.statsDate;

            // Comparação precisa de datas
            const sameYear = orderDate.getFullYear() === statsDate.getFullYear();
            const sameMonth = orderDate.getMonth() === statsDate.getMonth();
            const sameDay = orderDate.getDate() === statsDate.getDate();

            if (state.statsViewMode === 'month') return sameYear && sameMonth;
            return sameYear && sameMonth && sameDay;
        });
    }

    // --- 3. CÁLCULOS FINANCEIROS E KPIS ---
    let totalSalesCount = 0;
    let totalSalesValue = 0;
    let totalCost = 0;

    let countRefunded = 0;
    let countCancelled = 0;
    let countPending = 0;

    // Para KPIs
    let totalPaidOrders = 0; // Confirmado + Reembolsado (pedidos que foram pagos um dia)
    let totalCreatedOrders = filteredOrders.length; // Todos gerados

    filteredOrders.forEach(o => {
        if (o.status === 'Reembolsado') {
            countRefunded++;
            totalPaidOrders++;
        }
        if (o.status === 'Cancelado') countCancelled++;
        if (o.status === 'Pendente') countPending++;

        if (o.status === 'Confirmado') {
            totalSalesCount++;
            totalPaidOrders++;
            totalSalesValue += o.total;

            // Cálculo de Custo e Lucro
            o.items.forEach(item => {
                let itemCost = 0;
                // Prioridade 1: Custo salvo no momento da venda (histórico)
                if (item.cost !== undefined) {
                    itemCost = item.cost;
                } else {
                    // Prioridade 2: Custo atual do produto (fallback)
                    const currentProd = state.products.find(p => p.id === item.id);
                    if (currentProd) itemCost = currentProd.cost || 0;
                }
                totalCost += itemCost * item.qty;
            });
        }
    });

    const totalProfit = totalSalesValue - totalCost;

    // Renderização no DOM
    if (els.statSalesCount) els.statSalesCount.innerText = totalSalesCount;
    if (els.statSalesTotal) els.statSalesTotal.innerText = formatCurrency(totalSalesValue);
    if (els.statCostTotal) els.statCostTotal.innerText = formatCurrency(totalCost);
    if (els.statProfitTotal) els.statProfitTotal.innerText = formatCurrency(totalProfit);

    if (els.statRefunded) els.statRefunded.innerText = countRefunded;
    if (els.statCancelled) els.statCancelled.innerText = countCancelled;
    if (els.statPending) els.statPending.innerText = countPending;

    // KPIs Percentuais
    const approvalRate = totalCreatedOrders > 0 ? (totalSalesCount / totalCreatedOrders) * 100 : 0;
    if (els.statRateApproval) els.statRateApproval.innerText = Math.round(approvalRate) + '%';

    const refundRate = totalPaidOrders > 0 ? (countRefunded / totalPaidOrders) * 100 : 0;
    if (els.statRateRefund) els.statRateRefund.innerText = Math.round(refundRate) + '%';

    calculateTrend30();
}

function calculateTrend30() {
    // Tendência fixa de 30 dias (independente do filtro de data visual)
    const now = new Date();
    const last30 = new Date(); last30.setDate(now.getDate() - 30);
    const prior30 = new Date(); prior30.setDate(last30.getDate() - 30);

    let salesLast30 = 0;
    let salesPrior30 = 0;

    state.orders.forEach(o => {
        if (o.status !== 'Confirmado') return;
        const d = new Date(o.date);

        // Vendas dos últimos 30 dias
        if (d >= last30 && d <= now) {
            salesLast30 += o.total;
        }
        // Vendas dos 30 dias anteriores a isso (para comparar)
        else if (d >= prior30 && d < last30) {
            salesPrior30 += o.total;
        }
    });

    let trend = 0;
    if (salesPrior30 === 0) {
        trend = salesLast30 > 0 ? 100 : 0; // Se antes era 0 e agora vendeu, subiu 100% (simbólico)
    } else {
        trend = ((salesLast30 - salesPrior30) / salesPrior30) * 100;
    }

    const symbol = trend >= 0 ? '+' : '';
    const colorClass = trend >= 0 ? 'text-green-500' : 'text-red-500';

    if (els.statTrend30) {
        els.statTrend30.innerText = `${Math.round(Math.abs(trend))}% ${symbol}`;
        els.statTrend30.className = `text-3xl font-bold ${colorClass}`;
    }
}

// =================================================================
// 6. RENDERIZADORES DE CATÁLOGO E ADMIN (MANTIDOS)
// =================================================================

function renderCatalog(products) {
    if (!els.grid) return;
    els.grid.innerHTML = '';

    // --- ORDENAÇÃO: Esgotados vão para o final ---
    // Cria uma cópia para não bagunçar o estado original
    const sortedProducts = [...products].sort((a, b) => {
        // Define o que é "Esgotado" (Estoque <= 0 E não permite venda negativa)
        const isSoldOutA = a.stock <= 0 && (!state.globalSettings.allowNoStock && !a.allowNoStock);
        const isSoldOutB = b.stock <= 0 && (!state.globalSettings.allowNoStock && !b.allowNoStock);

        if (isSoldOutA && !isSoldOutB) return 1; // A é esgotado, vai pro fim
        if (!isSoldOutA && isSoldOutB) return -1; // B é esgotado, vai pro fim
        return 0; // Mantém a ordem atual (alfabética ou filtro)
    });

    // Pega configuração global de parcelamento
    const globalInst = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3 };

    sortedProducts.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;

        // --- LÓGICA DO PIX ---
        let pixHtml = '';
        if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
            const pix = p.paymentOptions.pix;
            const valDisplay = pix.type === 'percent' ? `${pix.val}%` : `R$ ${pix.val}`;
            pixHtml = `<p class="text-green-500 text-xs font-bold mt-1">${valDisplay} OFF no Pix</p>`;
        }

        // --- LÓGICA DO PARCELAMENTO ---
        let installmentHtml = '';
        if (globalInst.active) {
            const price = p.promoPrice || p.price;
            if (globalInst.freeUntil > 1) {
                const parcVal = price / globalInst.freeUntil;
                installmentHtml = `<p class="text-gray-400 text-xs mt-0.5">Ou ${globalInst.freeUntil}x de ${formatCurrency(parcVal)} sem juros</p>`;
            } else {
                installmentHtml = `<p class="text-gray-400 text-xs mt-0.5">Em até ${globalInst.max}x no cartão</p>`;
            }
        }

        // --- CARD ---
        const imgUrl = p.images && p.images.length > 0 ? p.images[0] : 'https://placehold.co/400?text=Sem+Foto';

        const priceDisplay = p.promoPrice ?
            `<div class="flex flex-col">
                <span class="text-gray-500 line-through text-xs">${formatCurrency(p.price)}</span>
                <span class="text-white font-bold text-lg">${formatCurrency(p.promoPrice)}</span>
             </div>` :
            `<div class="flex flex-col">
                <span class="text-white font-bold text-lg">${formatCurrency(p.price)}</span>
             </div>`;

        // Se estiver esgotado, diminui a opacidade da imagem
        const imgOpacity = isOut ? 'opacity-50 grayscale' : '';

        const card = document.createElement('div');
        card.className = "bg-black border border-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full group relative cursor-pointer";
        card.onclick = () => openProductModal(p.id);

        card.innerHTML = `
            <div class="relative w-full aspect-[4/5] bg-gray-900 overflow-hidden">
                <img src="${imgUrl}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${imgOpacity}">
                ${isOut ? `<div class="absolute inset-0 flex items-center justify-center z-10"><span class="bg-red-600 text-white font-bold px-4 py-1 rounded shadow-lg transform -rotate-6 text-sm uppercase tracking-wide">Esgotado</span></div>` : ''}
            </div>

            <div class="p-3 flex flex-col flex-1">
                <h3 class="text-white font-bold text-sm leading-tight line-clamp-2 mb-1">${p.name}</h3>
                
                <div class="mt-auto pt-2 border-t border-gray-800">
                    ${priceDisplay}
                    ${pixHtml}
                    ${installmentHtml}
                </div>
            </div>
        `;
        els.grid.appendChild(card);
    });
}


// =======================================================================================================================// =======================================================================================================================
//LÓGICA DE CATEGORIAS, EXIBIÇÃO, ORDEM, EDIÇÃO E EXCLUSÃO - FIM
function renderCategories() {
    // Se não tiver o container da sidebar, para.
    if (!els.sidebarCategories) return;

    const catNames = state.categories.map(c => c.name);

    // 1. Preenche Selects (Filtros)
    const populateSelect = (selectEl) => {
        if (!selectEl) return;
        const currentVal = selectEl.value;
        selectEl.innerHTML = '<option value="">Todas as Categorias</option>';
        catNames.forEach(c => {
            selectEl.innerHTML += `<option value="${c}">${c}</option>`;
        });
        if (currentVal) selectEl.value = currentVal;
    };

    populateSelect(els.catFilter);
    populateSelect(els.adminFilterCat);
    populateSelect(els.bulkCategorySelect);
    populateSelect(getEl('prod-cat-select'));
    // Se existir o select da barra de ação nova, preenche também
    const bulkDynamic = document.getElementById('bulk-category-select-dynamic');
    if (bulkDynamic) populateSelect(bulkDynamic);

    // 2. Monta a Árvore
    const tree = {};
    catNames.forEach(name => {
        const parts = name.split(' - ');
        let currentLevel = tree;
        parts.forEach((part, index) => {
            if (!currentLevel[part]) {
                const fullPath = parts.slice(0, index + 1).join(' - ');
                currentLevel[part] = { _path: fullPath, _children: {} };
            }
            currentLevel = currentLevel[part]._children;
        });
    });

    // Função Recursiva HTML
    const buildHtml = (node, level = 0) => {
        let html = '';
        const keys = Object.keys(node).sort();

        keys.forEach(key => {
            const item = node[key];
            const hasChildren = Object.keys(item._children).length > 0;
            // Escapa aspas
            const safePath = item._path.replace(/'/g, "\\'");

            // Cálculo de recuo (Padding)
            // Se for nível 0, padding menor. Se for filho, aumenta.
            const paddingLeft = level === 0 ? 12 : (level * 20) + 12;

            // Estilos de Texto
            const textStyle = level === 0
                ? "text-yellow-500 font-bold uppercase tracking-wide text-sm"
                : "text-gray-300 font-medium text-sm hover:text-white";

            // Se tiver filhos, usa <details> para o accordion
            if (hasChildren) {
                html += `
                    <details class="group mb-1">
                        <summary class="list-none flex items-center justify-between cursor-pointer rounded hover:bg-gray-800 transition pr-2 py-2">
                            <span class="${textStyle} flex-1" 
                                  style="padding-left:${paddingLeft}px"
                                  onclick="event.preventDefault(); filterByCat('${safePath}')">
                                ${key}
                            </span>
                            
                            <span class="text-gray-500 text-[10px] transform transition-transform duration-200 group-open:rotate-180 p-2">
                                ▼
                            </span>
                        </summary>
                        <div class="border-l border-gray-800 ml-4">
                            ${buildHtml(item._children, level + 1)}
                        </div>
                    </details>
                `;
            } else {
                // Se NÃO tiver filhos, é apenas um botão simples (sem seta)
                html += `
                    <div class="block w-full text-left py-2 mb-1 rounded hover:bg-gray-800 cursor-pointer transition flex items-center"
                         onclick="filterByCat('${safePath}')">
                        <span class="${textStyle}" style="padding-left:${paddingLeft}px">
                            ${key}
                        </span>
                    </div>
                `;
            }
        });
        return html;
    };

    // Renderiza SEM o botão "Ver Todos" (limpando o innerHTML antes)
    els.sidebarCategories.innerHTML = `
        <div class="space-y-1 mt-2">
            ${buildHtml(tree)}
        </div>
    `;
}

// Função Helper para selecionar o pai sem fechar o menu visualmente
window.selectParentCategory = (id, name, event) => {
    // Impede que o clique no nome dispare o abrir/fechar do accordion (opcional, se quiser separar as ações)
    // Se quiser que clique no nome TAMBÉM abra, remova a linha abaixo.
    if (event) event.preventDefault();

    if (state.selectedCategoryParent === name) {
        state.selectedCategoryParent = null;
        if (els.newCatName) els.newCatName.placeholder = "Nome da Categoria Principal...";
    } else {
        state.selectedCategoryParent = name;
        const displayName = name.split(' - ').pop();
        if (els.newCatName) els.newCatName.placeholder = `Adicionar em: ${displayName} > ...`;
    }

    // Re-renderiza para mostrar a borda amarela de seleção
    renderAdminCategoryList();
};

function renderAdminCategoryList() {
    if (!els.catListAdmin) return;

    // 1. PERSISTÊNCIA (Mantém aberto o que já estava aberto)
    const openDetailsIds = new Set();
    els.catListAdmin.querySelectorAll('details[open]').forEach(el => {
        if (el.dataset.catId) openDetailsIds.add(el.dataset.catId);
    });

    els.catListAdmin.innerHTML = '';

    const catMap = {};
    state.categories.forEach(c => catMap[c.name] = c.id);

    // Helper de Contagem
    const getProductCount = (catName) => {
        if (!state.products) return 0;
        return state.products.filter(p => {
            if (!p.category) return false;
            return p.category === catName || p.category.startsWith(catName + ' - ');
        }).length;
    };

    // Monta a Árvore
    const tree = {};
    const sortedCats = [...state.categories].sort((a, b) => a.name.localeCompare(b.name));

    sortedCats.forEach(c => {
        const parts = c.name.split(' - ');
        let currentLevel = tree;
        parts.forEach((part, index) => {
            if (!currentLevel[part]) {
                const fullPath = parts.slice(0, index + 1).join(' - ');
                currentLevel[part] = { _path: fullPath, _children: {} };
            }
            currentLevel = currentLevel[part]._children;
        });
    });

    // Renderização
    const buildHtml = (node, level = 0) => {
        let html = '';
        const keys = Object.keys(node).sort();

        keys.forEach(key => {
            const item = node[key];
            const childrenKeys = Object.keys(item._children);
            const hasChildren = childrenKeys.length > 0;
            const fullPath = item._path;
            const id = catMap[fullPath];

            // --- CONTAGENS ---
            const prodCount = getProductCount(fullPath);
            const subCatCount = childrenKeys.length;

            let statsText = `${prodCount} produto(s)`;
            if (subCatCount > 0) {
                statsText += ` • ${subCatCount} subcategoria(s)`;
            }

            const isMain = level === 0;
            const isSelected = state.selectedCategoryParent === fullPath;
            const selectBorder = isSelected ? 'border-yellow-500' : 'border-gray-700';
            const isOpenAttr = openDetailsIds.has(id) ? 'open' : '';

            const bgClass = isMain
                ? 'bg-[#1f2937] mb-2'
                : 'bg-black/30 mt-1 ml-4 border-l-2 border-gray-700';

            const rowContent = `
                <div class="flex items-center justify-between p-3 rounded hover:bg-white/5 transition cursor-pointer group min-h-[60px]">
                    
                    <div class="flex flex-col justify-center flex-1" 
                         onclick="selectParentCategory('${id}', '${fullPath}', event)">
                        
                        <span class="${isMain ? 'text-white font-bold text-sm' : 'text-gray-300 text-sm'} ${isSelected ? 'text-yellow-500' : ''}">
                            ${key}
                        </span>
                        
                        <span class="text-xs text-gray-400 font-bold mt-1 flex items-center gap-1">
                            ${statsText}
                        </span>
                    </div>

                    <div class="flex items-center gap-3">
                        ${hasChildren ?
                    `<div class="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center border border-gray-600 transition-transform group-open:rotate-180 group-open:bg-yellow-500/20 group-open:border-yellow-500 cursor-pointer">
                                <span class="text-gray-300 text-xs group-open:text-yellow-500">▼</span>
                             </div>`
                    : ''}

                        <div class="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pl-2 border-l border-gray-700">
                            <button type="button" 
                                    onclick="event.stopPropagation(); renameCategory('${id}', '${fullPath}')" 
                                    class="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition"
                                    title="Editar Nome">
                                <i class="fas fa-pen text-xs"></i>
                            </button>

                            <button type="button" 
                                    onclick="event.stopPropagation(); deleteCategory('${id}', '${fullPath}')" 
                                    class="w-8 h-8 rounded-full bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition"
                                    title="Excluir Categoria">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (hasChildren) {
                html += `
                    <details class="rounded border ${selectBorder} ${bgClass} overflow-hidden group transition-all duration-300" ${isOpenAttr} data-cat-id="${id}">
                        <summary class="list-none select-none outline-none">
                            ${rowContent}
                        </summary>
                        <div class="pb-2 pr-2 border-t border-gray-700/50 animate-fade-in">
                            ${buildHtml(item._children, level + 1)}
                        </div>
                    </details>
                `;
            } else {
                html += `
                    <div class="rounded border ${selectBorder} ${bgClass}">
                        ${rowContent}
                    </div>
                `;
            }
        });
        return html;
    };

    els.catListAdmin.innerHTML = buildHtml(tree);
}

window.renameCategory = async (id, oldFullName) => {
    const newNameShort = prompt("Novo nome para a categoria:", oldFullName.split(' - ').pop());

    if (!newNameShort || newNameShort.trim() === "") return;

    // Reconstrói o nome completo mantendo o pai (se houver)
    const parts = oldFullName.split(' - ');
    parts.pop(); // Remove o nome antigo
    parts.push(newNameShort.trim()); // Adiciona o novo
    const newFullName = parts.join(' - ');

    if (newFullName === oldFullName) return;

    if (!confirm(`Renomear "${oldFullName}" para "${newFullName}"?\nIsso atualizará produtos e subcategorias vinculados.`)) return;

    try {
        // 1. Atualiza a Categoria em si
        await updateDoc(doc(db, `sites/${state.siteId}/categories`, id), { name: newFullName });

        // 2. ATUALIZAÇÃO EM CASCATA (Cascading Update)
        // Precisamos encontrar produtos e subcategorias que dependem desse nome

        // A. Produtos
        const productsToUpdate = state.products.filter(p => p.category === oldFullName || p.category.startsWith(oldFullName + ' - '));

        // B. Subcategorias (ex: se mudei "Roupas", tenho que mudar "Roupas - Calças")
        const catsToUpdate = state.categories.filter(c => c.id !== id && c.name.startsWith(oldFullName + ' - '));

        const batchPromises = [];

        // Atualiza Produtos
        productsToUpdate.forEach(p => {
            const newCatName = p.category.replace(oldFullName, newFullName);
            batchPromises.push(updateDoc(doc(db, `sites/${state.siteId}/products`, p.id), { category: newCatName }));
        });

        // Atualiza Subcategorias
        catsToUpdate.forEach(c => {
            const newCatName = c.name.replace(oldFullName, newFullName);
            batchPromises.push(updateDoc(doc(db, `sites/${state.siteId}/categories`, c.id), { name: newCatName }));
        });

        await Promise.all(batchPromises);

        showToast(`Categoria renomeada! (${batchPromises.length} vínculos atualizados)`);

        // Limpa seleção se estava nela
        if (state.selectedCategoryParent === oldFullName) {
            state.selectedCategoryParent = null;
        }

    } catch (error) {
        console.error("Erro ao renomear:", error);
        alert("Erro ao renomear: " + error.message);
    }
};
//LÓGICA DE CATEGORIAS, EXIBIÇÃO, ORDEM, EDIÇÃO E EXCLUSÃO - FIM
// =======================================================================================================================// =======================================================================================================================

// =================================================================
// NOVA LÓGICA DE PRODUTOS (ADMIN)
// =================================================================

// 1. Filtra e Ordena (Substitui a lógica antiga)
function filterAndRenderProducts() {
    // 1. Filtra
    let filtered = getCurrentFilteredProducts();

    // 2. Prepara Métricas (Para poder ordenar por elas)
    // Precisamos saber as vendas de cada produto ANTES de ordenar
    const metricsMap = {};
    const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];

    if (state.orders) {
        state.orders.forEach(order => {
            if (validStatuses.includes(order.status)) {
                const orderDate = new Date(order.date);
                order.items.forEach(item => {
                    if (!metricsMap[item.id]) metricsMap[item.id] = { qtd: 0, lastDate: 0 }; // 0 para facilitar sort
                    metricsMap[item.id].qtd += (parseInt(item.qty) || 0);
                    if (orderDate.getTime() > metricsMap[item.id].lastDate) {
                        metricsMap[item.id].lastDate = orderDate.getTime();
                    }
                });
            }
        });
    }

    // 3. Ordena
    const { key, direction } = state.sortConfig;

    filtered.sort((a, b) => {
        let valA, valB;

        // Define os valores baseados na coluna clicada
        switch (key) {
            case 'code':
                valA = a.code ? parseInt(a.code) : 0;
                valB = b.code ? parseInt(b.code) : 0;
                break;
            case 'product':
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
                break;
            case 'stock':
                valA = parseInt(a.stock) || 0;
                valB = parseInt(b.stock) || 0;
                break;
            case 'price':
                valA = parseFloat(a.price) || 0;
                valB = parseFloat(b.price) || 0;
                break;
            case 'sales': // Ordenar por vendas
                valA = metricsMap[a.id]?.qtd || 0;
                valB = metricsMap[b.id]?.qtd || 0;
                break;
            case 'lastmov': // Ordenar por data
                valA = metricsMap[a.id]?.lastDate || 0;
                valB = metricsMap[b.id]?.lastDate || 0;
                break;
            default: return 0;
        }

        // Lógica Asc/Desc
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. Renderiza passando as métricas calculadas (para não calcular de novo)
    renderProductsList(filtered, metricsMap);
}



// --- LÓGICA DE ORDENAÇÃO ---
function getCurrentFilteredProducts() {
    const searchInput = els.adminSearchProd || getEl('admin-search-prod');
    const categoryInput = els.adminFilterCat || getEl('admin-filter-cat');
    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const catFilter = categoryInput ? categoryInput.value : '';

    return state.products.filter(p => {
        const codeStr = p.code ? String(p.code) : '';
        const matchText = p.name.toLowerCase().includes(term) || codeStr.includes(term);
        const matchCat = catFilter ? p.category === catFilter : true;
        return matchText && matchCat;
    });
}


window.sortProducts = (key) => {
    // Se clicou na mesma coluna, inverte a direção
    if (state.sortConfig.key === key) {
        state.sortConfig.direction = state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        // Se mudou de coluna, começa decrescente (maior para menor)
        state.sortConfig.key = key;
        state.sortConfig.direction = 'desc';
    }
    filterAndRenderProducts();
};

// --- LÓGICA SELECIONAR TODOS ---
window.toggleSelectAll = (checkbox) => {
    // Pega apenas os produtos que estão aparecendo na tela (respeita a busca/filtro)
    // Se a função getCurrentFilteredProducts não existir, usa state.products direto
    const visibleProducts = (typeof getCurrentFilteredProducts === 'function')
        ? getCurrentFilteredProducts()
        : state.products;

    if (checkbox.checked) {
        // Marca todos
        visibleProducts.forEach(p => state.selectedProducts.add(p.id));
    } else {
        // Desmarca todos (limpa o Set)
        state.selectedProducts.clear();
    }

    // Atualiza a tela para mostrar a barra de ação
    renderProductsList(visibleProducts);
};

// --- CORREÇÃO DO BUG: CANCELAR SELEÇÃO ---
window.toggleSelectionMode = () => {
    state.isSelectionMode = !state.isSelectionMode;

    // Se estiver SAINDO do modo de seleção, limpa tudo IMEDIATAMENTE
    if (!state.isSelectionMode) {
        state.selectedProducts.clear();
    }

    // Força re-renderização para sumir a barra
    filterAndRenderProducts();
};

// 2. Renderiza a Lista Visual (Com Preço Promo e Código)
function renderProductsList(products, preCalcMetrics = null) {
    const listEl = els.productListAdmin || getEl('admin-product-list');
    if (!listEl) return;

    // --- CORREÇÃO: REMOVE A BARRA AMARELA ANTIGA À FORÇA ---
    const oldBar = document.getElementById('bulk-actions-bar');
    if (oldBar) {
        oldBar.classList.add('hidden'); // Esconde via classe
        oldBar.style.display = 'none';  // Garante via CSS inline
    }
    // --------------------------------------------------------

    listEl.innerHTML = '';

    // --- 1. BARRA DE CONTROLES NOVA (Azul/Escura) ---
    const controlsBar = document.createElement('div');
    controlsBar.className = "flex flex-wrap justify-between items-center mb-2 px-1 gap-2 min-h-[40px]";

    // Botão Selecionar
    const selectBtnText = state.isSelectionMode ?
        '<i class="fas fa-times mr-2"></i> Cancelar' :
        '<i class="fas fa-check-square mr-2"></i> Selecionar';

    const selectBtnClass = state.isSelectionMode ?
        "text-red-400 hover:text-red-300 text-xs font-bold uppercase cursor-pointer py-2 px-2 bg-red-900/20 rounded border border-red-900/50" :
        "text-yellow-500 hover:text-yellow-400 text-xs font-bold uppercase cursor-pointer py-2 px-2 hover:bg-yellow-900/20 rounded transition";

    let bulkActionsHTML = '';
    // Só mostra os botões se tiver itens selecionados
    if (state.isSelectionMode && state.selectedProducts.size > 0) {
        bulkActionsHTML = `
            <div class="flex items-center gap-2 animate-fade-in bg-[#151720] border border-gray-700 rounded p-1 shadow-lg flex-1 justify-end">
                <span class="text-white text-[10px] font-bold bg-blue-600 px-2 py-1 rounded ml-1 whitespace-nowrap">${state.selectedProducts.size} <span class="hidden sm:inline">item(s)</span></span>
                
                <select id="bulk-category-select-dynamic" class="bg-black text-white text-[10px] border border-gray-600 rounded px-1 h-7 outline-none w-24 sm:w-auto">
                    <option value="">Mover...</option>${state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
                
                <button onclick="bulkMoveDynamic()" class="bg-blue-600 hover:bg-blue-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition">
                    <i class="fas fa-exchange-alt sm:hidden"></i> <span class="hidden sm:inline">Mover</span>
                </button>
                
                <button onclick="document.getElementById('btn-bulk-delete').click()" class="bg-red-600 hover:bg-red-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition">
                    <i class="fas fa-trash-alt sm:hidden"></i> <span class="hidden sm:inline">Excluir</span>
                </button>
            </div>
        `;
    }

    controlsBar.innerHTML = `
        <button onclick="toggleSelectionMode()" class="${selectBtnClass}">
            ${selectBtnText}
        </button>
        ${bulkActionsHTML}
    `;
    listEl.appendChild(controlsBar);

    if (products.length === 0) {
        listEl.innerHTML += '<p class="text-center text-gray-500 py-12 italic border border-gray-800 rounded-xl bg-[#0f111a]">Nenhum produto encontrado.</p>';
        return;
    }

    // --- 2. HEADER ---
    const allSelected = products.length > 0 && products.every(p => state.selectedProducts.has(p.id));
    const masterCheckAttr = allSelected ? 'checked' : '';

    const getSortIcon = (key) => {
        if (state.sortConfig.key !== key) return '<i class="fas fa-sort text-gray-700 ml-1 opacity-30"></i>';
        return state.sortConfig.direction === 'asc'
            ? '<i class="fas fa-sort-up text-yellow-500 ml-1 mt-1"></i>'
            : '<i class="fas fa-sort-down text-yellow-500 ml-1 -mt-1"></i>';
    };

    const checkColContent = state.isSelectionMode
        ? `<input type="checkbox" onchange="toggleSelectAll(this)" ${masterCheckAttr} class="cursor-pointer rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-0 w-4 h-4" title="Selecionar Todos">`
        : ``;

    const headerHTML = `
        <div class="hidden md:grid grid-cols-12 gap-2 bg-[#1f1f1f] text-gray-400 font-bold p-3 rounded-t-xl text-[10px] uppercase tracking-wider border-b border-gray-800 sticky top-0 z-20 select-none items-center shadow-lg">
            <div class="${state.isSelectionMode ? 'col-span-1 block' : 'hidden'} text-center flex items-center justify-center">
                ${checkColContent}
            </div>
            <div class="${state.isSelectionMode ? 'col-span-1' : 'col-span-1'} text-center border-r border-gray-700 cursor-pointer hover:text-white flex items-center justify-left h-full" onclick="sortProducts('code')">
                Cód ${getSortIcon('code')}
            </div>
            <div class="col-span-5 pl-2 cursor-pointer hover:text-white flex items-center" onclick="sortProducts('product')">
                Produto ${getSortIcon('product')}
            </div>
            <div class="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('lastmov')">
                Última Mov. ${getSortIcon('lastmov')}
            </div>
            <div class="col-span-1 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('sales')">
                Vendas ${getSortIcon('sales')}
            </div>
            <div class="col-span-1 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('stock')">
                Estoque ${getSortIcon('stock')}
            </div>
            <div class="col-span-1 text-right pr-4 cursor-pointer hover:text-white flex items-center justify-end" onclick="sortProducts('price')">
                Valor ${getSortIcon('price')}
            </div>
            <div class="col-span-1"></div>
        </div>
        
        <div class="md:hidden flex items-center justify-between px-4 py-2 text-gray-400 text-xs uppercase font-bold bg-[#1f1f1f] rounded-t-lg border-b border-gray-800">
            <div class="flex items-center gap-2">
                ${state.isSelectionMode ? checkColContent : ''}
                <span>Produto</span>
            </div>
            <span>Estoque / Valor</span>
        </div>
    `;

    const scrollContainer = document.createElement('div');
    scrollContainer.className = "max-h-[65vh] overflow-y-auto overflow-x-hidden border-x border-b border-gray-800 rounded-b-xl bg-[#0f111a] custom-scrollbar relative";

    listEl.insertAdjacentHTML('beforeend', headerHTML);
    listEl.appendChild(scrollContainer);

    let metricsMap = preCalcMetrics;
    if (!metricsMap) {
        metricsMap = {};
        const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];
        if (state.orders) {
            state.orders.forEach(order => {
                if (validStatuses.includes(order.status)) {
                    const ts = new Date(order.date).getTime();
                    order.items.forEach(item => {
                        if (!metricsMap[item.id]) metricsMap[item.id] = { qtd: 0, lastDate: 0 };
                        metricsMap[item.id].qtd += (parseInt(item.qty) || 0);
                        if (ts > metricsMap[item.id].lastDate) metricsMap[item.id].lastDate = ts;
                    });
                }
            });
        }
    }

    // --- 3. LISTA ---
    products.forEach(p => {
        const metrics = metricsMap[p.id] || { qtd: 0, lastDate: 0 };

        let lastMovStr = "-";
        if (metrics.lastDate > 0) {
            lastMovStr = new Date(metrics.lastDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        let priceHtml = p.promoPrice && p.promoPrice > 0
            ? `<div class="flex flex-col items-end"><span class="text-green-400 font-bold text-xs">${formatCurrency(p.promoPrice)}</span><span class="text-gray-600 text-[10px] line-through">${formatCurrency(p.price)}</span></div>`
            : `<span class="text-gray-200 font-bold text-xs">${formatCurrency(p.price)}</span>`;

        const isChecked = state.selectedProducts.has(p.id) ? 'checked' : '';
        const bgClass = isChecked ? 'bg-blue-900/10 border-blue-500/30' : 'bg-[#151720] border-gray-800 hover:bg-[#1c1f2b]';
        const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/100?text=Sem+Foto';
        const codeStr = p.code ? p.code : '-';

        // Esconde o fundo vermelho se estiver selecionando
        const deleteBgClass = state.isSelectionMode ? 'hidden' : 'absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center cursor-pointer z-0';

        const row = document.createElement('div');
        row.className = `relative overflow-hidden border-b border-gray-800 last:border-0 select-none group`;
        row.ondblclick = () => editProduct(p.id);

        row.innerHTML = `
            <div class="${deleteBgClass}" onclick="confirmDeleteProduct('${p.id}')">
                <i class="fas fa-trash-alt text-white text-lg"></i>
            </div>

            <div class="relative z-10 p-3 transition-transform duration-200 ease-out prod-swipe-content ${bgClass} h-full flex flex-col md:grid md:grid-cols-12 gap-2 items-center">
                
                <div class="flex md:contents items-center justify-between w-full">
                    <div class="flex items-center gap-3 md:col-span-6 w-full">
                        
                        <div class="${state.isSelectionMode ? 'flex' : 'hidden'} md:col-span-1 items-center justify-center">
                             <input type="checkbox" class="w-5 h-5 rounded border-gray-600 bg-gray-900 text-yellow-500 cursor-pointer" 
                               onclick="event.stopPropagation(); toggleProductSelection('${p.id}')" ${isChecked}>
                        </div>

                        <div class="hidden md:flex ${state.isSelectionMode ? 'md:col-span-1' : 'md:col-span-2'} items-center justify-center border-r border-gray-800 h-full">
                            <span class="text-base font-bold text-white font-mono opacity-80">#${codeStr}</span>
                        </div>

                        <div class="flex items-center gap-3 md:col-span-4 min-w-0 flex-1">
                            <img src="${imgUrl}" class="w-10 h-10 rounded object-cover border border-gray-700 bg-black">
                            <div class="flex flex-col min-w-0">
                                <div class="flex items-center">
                                    <span class="md:hidden text-xs bg-gray-700 text-white px-1.5 py-0.5 rounded mr-2 font-bold">#${codeStr}</span>
                                    <span class="text-gray-200 font-bold text-sm truncate group-hover:text-yellow-500 transition">${p.name}</span>
                                </div>
                                <span class="text-gray-500 text-[10px] truncate">${p.category || 'Geral'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="md:hidden flex flex-col items-end min-w-[80px]">
                        ${priceHtml}
                        ${p.stock <= 0 ? '<span class="text-red-500 text-[10px] font-bold">Esgotado</span>' : `<span class="text-gray-500 text-[10px]">Est.: ${p.stock}</span>`}
                    </div>
                </div>

                <div class="hidden md:block col-span-2 text-center text-gray-500 text-xs font-mono">${lastMovStr}</div>
                <div class="hidden md:block col-span-1 text-center text-gray-400 text-xs">
                    ${metrics.qtd > 0 ? `<span class="bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-bold">${metrics.qtd}</span>` : '-'}
                </div>
                <div class="hidden md:block col-span-1 text-center">
                    ${p.stock <= 0 ? '<span class="text-red-500 text-xs font-bold">0</span>' : `<span class="text-gray-400 text-xs font-bold">${p.stock}</span>`}
                </div>
                <div class="hidden md:block col-span-1 text-right pr-4">${priceHtml}</div>
                
                <div class="hidden ${state.isSelectionMode ? 'hidden' : 'md:flex'} col-span-1 justify-center items-center">
                     <button onclick="event.stopPropagation(); confirmDeleteProduct('${p.id}')" class="text-gray-600 hover:text-red-500 transition p-2 rounded-full hover:bg-red-500/10" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;

        setupSwipe(row.querySelector('.prod-swipe-content'));
        scrollContainer.appendChild(row);
    });
}

// 3. Funções Auxiliares de Seleção
window.toggleProductSelection = (id) => {
    if (state.selectedProducts.has(id)) state.selectedProducts.delete(id);
    else state.selectedProducts.add(id);

    // Atualiza a lista para pintar o fundo e mostrar a barra
    filterAndRenderProducts();
};

window.clearProductSelection = () => {
    state.selectedProducts.clear();
    filterAndRenderProducts();
};

// Helper para o botão mover da barra dinâmica
window.bulkMoveDynamic = async () => {
    const select = document.getElementById('bulk-category-select-dynamic');
    if (!select) return;
    const targetCat = select.value;
    if (!targetCat) return alert("Selecione uma categoria de destino.");

    if (!confirm(`Mover ${state.selectedProducts.size} produtos para "${targetCat}"?`)) return;

    try {
        const promises = Array.from(state.selectedProducts).map(id => updateDoc(doc(db, `sites/${state.siteId}/products`, id), { category: targetCat }));
        await Promise.all(promises);
        state.selectedProducts.clear();
        filterAndRenderProducts(); // Recarrega
        alert("Produtos movidos!");
    } catch (error) { alert("Erro ao mover: " + error.message); }
};

window.toggleSelectionMode = () => {
    state.isSelectionMode = !state.isSelectionMode;
    // Se sair do modo de seleção, limpa as seleções
    if (!state.isSelectionMode) {
        state.selectedProducts.clear();
    }
    filterAndRenderProducts();
};

function renderAdminCoupons() {
    if (!els.couponListAdmin) return;

    els.couponListAdmin.innerHTML = state.coupons.map((c, index) => {
        // ... (código de formatação de valores e datas mantém igual) ...
        const typeDisplay = c.type === 'percent' ? `<span class="text-green-400 font-bold">${c.val}%</span>` : `<span class="text-green-400 font-bold">${formatCurrency(c.val)}</span>`;

        let isExpired = false;
        let expiryDisplay = `<span class="text-xs text-green-500 font-bold">∞ Permanente</span>`;

        if (c.expiryDate) {
            const expiryDate = new Date(c.expiryDate);
            const now = new Date();
            if (now > expiryDate) {
                isExpired = true;
                expiryDisplay = `<span class="text-xs text-red-500 font-bold bg-red-900/30 px-2 py-0.5 rounded">EXPIRADO: ${expiryDate.toLocaleString()}</span>`;
            } else {
                expiryDisplay = `<span class="text-xs text-white">Expira em: <span class="font-bold">${expiryDate.toLocaleString()}</span></span>`;
            }
        }

        const borderClass = isExpired ? 'border-red-600 opacity-75' : 'border-green-500';
        const isFocused = index === state.focusedCouponIndex;
        const bgClass = isFocused ? 'bg-gray-700 ring-2 ring-yellow-500 z-10' : 'bg-gray-800';

        // --- A MUDANÇA ESTÁ AQUI EMBAIXO (onclick="selectCoupon") ---
        return `
            <div id="coupon-item-${index}" 
                 onclick="selectCoupon(${index})" 
                 ondblclick="editCoupon('${c.id}')" 
                 class="${bgClass} border-l-4 ${borderClass} p-3 rounded flex justify-between items-center shadow-sm mb-2 cursor-pointer transition select-none group relative">
                
                ${isFocused ? '<div class="absolute -left-2 top-1/2 -translate-y-1/2 text-yellow-500"><i class="fas fa-caret-right"></i></div>' : ''}

                <div class="flex flex-col pointer-events-none">
                    <span class="text-yellow-500 font-bold text-lg tracking-wider group-hover:text-white transition">${c.code}</span>
                    <div class="flex gap-2 items-center flex-wrap">
                        ${typeDisplay}
                        ${expiryDisplay}
                    </div>
                </div>
                
                <button onclick="event.stopPropagation(); deleteCoupon('${c.id}')" class="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white transition z-20">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
}



// =================================================================
// 7. DASHBOARD E VENDAS SIMPLES
// =================================================================

function updateDashboardUI() {
    const date = state.dashDate;
    if (state.dashViewMode === 'day') {
        els.dashDateDisplay.innerText = date.toLocaleDateString('pt-BR');
        els.checkDay.classList.add('bg-green-500', 'border-none');
        els.checkMonth.classList.remove('bg-green-500', 'border-none');
    } else {
        els.dashDateDisplay.innerText = date.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        els.checkMonth.classList.add('bg-green-500', 'border-none');
        els.checkDay.classList.remove('bg-green-500', 'border-none');
    }
    updateDashboardMetrics();
}

function updateDashboardMetrics() {
    if (!state.orders) return;

    // --- PROTEÇÃO CONTRA ERROS ---
    // Verifica se os elementos do dashboard existem na tela.
    // Se não existirem (porque está na aba Produtos), a função para aqui e não trava o resto.
    const elTotalRev = document.getElementById('dash-total-value'); // ID corrigido conforme seu HTML padrão
    const elTotalCount = document.getElementById('dash-total-items'); // ou dash-confirmed-count

    if (!elTotalRev && !document.getElementById('dash-confirmed-count')) return;

    // Se chegou aqui, é seguro calcular
    // ... (Sua lógica de filtro por data do dashboard continua aqui se houver) ...
    // Vou usar uma lógica simplificada baseada no que você já tinha:

    let confirmedCount = 0;
    let totalValue = 0;
    let totalItems = 0;

    // Filtra apenas o que está visível no dashboard (mesmo mês/dia)
    const filteredOrders = state.orders.filter(o => {
        const orderDate = new Date(o.date);
        const dashDate = state.dashDate;
        const sameYear = orderDate.getFullYear() === dashDate.getFullYear();
        const sameMonth = orderDate.getMonth() === dashDate.getMonth();
        const sameDay = orderDate.getDate() === dashDate.getDate();

        if (state.dashViewMode === 'month') return sameYear && sameMonth;
        return sameYear && sameMonth && sameDay;
    });

    filteredOrders.forEach(o => {
        if (o.status === 'Confirmado' || o.status === 'Concluído' || o.status === 'Entregue' || o.status === 'Aprovado' || o.status === 'Saiu para entrega' || o.status === 'Preparando pedido') {
            confirmedCount++;
            totalValue += (parseFloat(o.total) || 0);
            if (o.items) o.items.forEach(i => totalItems += (parseInt(i.qty) || 0));
        }
    });

    // Atualiza apenas se os elementos existirem
    if (getEl('dash-total-items')) getEl('dash-total-items').innerText = totalItems;
    if (getEl('dash-confirmed-count')) getEl('dash-confirmed-count').innerText = confirmedCount;
    if (getEl('dash-total-value')) getEl('dash-total-value').innerText = formatCurrency(totalValue);
}

function filterAndRenderSales() {
    // 1. Captura Inputs
    const codeInput = document.getElementById('filter-search-code'); // NOVO
    const searchInput = document.getElementById('filter-search-general');
    const prodInput = document.getElementById('filter-search-product-value');

    if (!searchInput) return;

    // Valores Tratados
    const termCode = codeInput ? codeInput.value.trim() : ''; // Valor numérico do pedido
    const termGeneral = searchInput.value.toLowerCase().trim();
    const termProduct = prodInput ? prodInput.value.toLowerCase().trim() : '';

    const status = document.getElementById('filter-status').value;
    const payment = document.getElementById('filter-payment').value;
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;

    // 2. Filtragem
    let filtered = state.orders.filter(o => {
        // A. Busca por CÓDIGO (Prioritária)
        let matchCode = true;
        if (termCode) {
            // Verifica se o código do pedido contem o que foi digitado
            // Ex: Digitar "5" mostra "5", "15", "50", "501"
            matchCode = String(o.code).includes(termCode);
        }

        // B. Busca Geral (Cliente, Telefone) - REMOVIDO CÓDIGO DAQUI
        let matchGeneral = true;
        if (termGeneral) {
            const name = (o.customer?.name || '').toLowerCase();
            const phone = (o.customer?.phone || '').toLowerCase();
            // Agora busca geral olha apenas nome e telefone
            matchGeneral = name.includes(termGeneral) || phone.includes(termGeneral);
        }

        // C. Busca por Produto
        let matchProduct = true;
        if (termProduct) {
            if (o.items && Array.isArray(o.items)) {
                matchProduct = o.items.some(item => item.name.toLowerCase().includes(termProduct));
            } else {
                matchProduct = false;
            }
        }

        // D. Status
        let matchStatus = true;
        if (status) {
            if (status === 'Cancelado_All') matchStatus = o.status.includes('Cancelado');
            else matchStatus = o.status === status;
        }

        // E. Pagamento
        let matchPayment = true;
        if (payment) {
            const method = (o.paymentMethod || '').toLowerCase();
            if (payment === 'pix') matchPayment = method.includes('pix');
            else if (payment === 'card') matchPayment = method.includes('cartão') || method.includes('crédito') || method.includes('débito');
            else if (payment === 'cash') matchPayment = method.includes('dinheiro');
        }

        // F. Data
        let matchDate = true;
        if (dateStart || dateEnd) {
            const oDate = new Date(o.date).getTime();
            if (dateStart) {
                const s = new Date(dateStart); s.setHours(0, 0, 0, 0);
                if (oDate < s.getTime()) matchDate = false;
            }
            if (dateEnd) {
                const e = new Date(dateEnd); e.setHours(23, 59, 59, 999);
                if (oDate > e.getTime()) matchDate = false;
            }
        }

        return matchCode && matchGeneral && matchProduct && matchStatus && matchPayment && matchDate;
    });

    // 3. Ordenação Inteligente (Proximidade Numérica)
    filtered.sort((a, b) => {
        // SE o usuário digitou um número de pedido...
        if (termCode) {
            const target = parseInt(termCode);
            const codeA = parseInt(a.code) || 0;
            const codeB = parseInt(b.code) || 0;

            // Calcula a distância absoluta (quem está mais perto do número digitado)
            const distA = Math.abs(codeA - target);
            const distB = Math.abs(codeB - target);

            // Se as distâncias forem diferentes, o menor ganha (mais perto)
            if (distA !== distB) {
                return distA - distB;
            }
            // Se forem iguais (improvável com ID único), desempata por data
        }

        // ORDENAÇÃO PADRÃO (Data Decrescente)
        // Se não tiver busca por código, ou para desempatar
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
    });

    // 4. Renderiza
    renderSalesList(filtered);
    renderOrdersSummary(filtered, status);

    const countEl = document.getElementById('orders-count');
    if (countEl) countEl.innerText = filtered.length;
}

function renderSalesList(orders) {
    const listEl = document.getElementById('orders-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (orders.length === 0) {
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-4xl mb-2 opacity-50"></i><p>Nenhum pedido encontrado.</p></div>';
        return;
    }

    orders.forEach(o => {
        // 1. Formatação de Data e Hora
        const dataObj = new Date(o.date);
        const dataStr = dataObj.toLocaleDateString('pt-BR');
        const horaStr = dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dataHoraFormatada = `${dataStr} às ${horaStr}`;

        // 2. Cores do Status
        let statusColorClass = 'text-gray-400';
        switch (o.status) {
            case 'Aprovado':
            case 'Preparando pedido': statusColorClass = 'text-yellow-500'; break;
            case 'Saiu para entrega': statusColorClass = 'text-orange-500'; break;
            case 'Entregue':
            case 'Concluído': statusColorClass = 'text-green-500'; break;
        }
        if (o.status.includes('Cancelado')) statusColorClass = 'text-red-500';

        // 3. HTML dos Itens
        let itemsHtml = o.items.map(i => `
            <div class="bg-gray-800/50 p-2 rounded mb-1 border border-gray-700 flex justify-between items-center">
                <span class="text-gray-300 text-sm font-medium">${i.qty}x ${i.name} <span class="text-gray-500 text-xs">(${i.size})</span></span>
                <span class="text-white text-xs font-bold">${formatCurrency(i.price)}</span>
            </div>
        `).join('');

        // 4. Lógica de Desconto (Cupom/Pix)
        const subTotalItens = o.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const valFrete = o.shippingFee || 0;
        const valTotalPago = o.total || 0;
        const valDescontoTotal = Math.max(0, (subTotalItens + valFrete) - valTotalPago);

        let discountHtml = '';
        if (valDescontoTotal > 0.05) {
            const isPix = (o.paymentMethod || '').toLowerCase().includes('pix');
            const hasCupom = (o.cupom && o.cupom.trim().length > 0);

            // Verifica dados salvos do cupom
            let valDescontoCupom = 0;
            let nomeCupom = null;
            if (o.couponData && o.couponData.value) {
                valDescontoCupom = o.couponData.value;
                nomeCupom = o.couponData.code;
            } else if (o.cupom) {
                nomeCupom = o.cupom;
            }

            // Calcula sobra para Pix
            const totalEsperadoSemPix = (subTotalItens + valFrete) - valDescontoCupom;
            const valDescontoPix = Math.max(0, totalEsperadoSemPix - valTotalPago);

            discountHtml += `<div class="mt-2 mb-2 border-y border-gray-700/50 py-2 space-y-1">`;
            if (nomeCupom) {
                discountHtml += `
                    <div class="flex justify-between text-xs text-gray-300">
                        <span>Cupom: <span class="text-yellow-500 font-bold uppercase tracking-wider border border-yellow-500/30 px-1 rounded bg-yellow-500/10">${nomeCupom}</span></span>
                        ${valDescontoCupom > 0 ? `<span>- ${formatCurrency(valDescontoCupom)}</span>` : ''}
                    </div>
                `;
            }
            if (valDescontoPix > 0.05) {
                discountHtml += `
                    <div class="flex justify-between text-xs text-gray-300">
                        <span>Desconto Pix:</span>
                        <span class="text-green-400 font-bold">- ${formatCurrency(valDescontoPix)}</span>
                    </div>
                `;
            }
            discountHtml += `</div>`;
        }

        // --- LÓGICA DO TIPO DE PAGAMENTO (NOVO) ---
        // Analisa a string salva para definir o tipo
        const rawMethod = o.paymentMethod || '';
        const isOnline = rawMethod.includes('Online');
        const isDelivery = rawMethod.includes('Entrega');

        // Limpa o nome do método (Tira o texto entre colchetes)
        const cleanMethodName = rawMethod.split('[')[0].trim();

        let typeBadge = '';
        if (isOnline) {
            typeBadge = `<span class="text-[10px] bg-green-900/40 text-green-400 border border-green-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Online</span>`;
        } else if (isDelivery) {
            typeBadge = `<span class="text-[10px] bg-orange-900/40 text-orange-400 border border-orange-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Na Entrega</span>`;
        }
        // ------------------------------------------

        // 5. Controles
        let controlsHtml = '';
        if (o.status.includes('Cancelado')) {
            controlsHtml = `<div class="flex justify-end mt-4"><span class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">PEDIDO CANCELADO</span></div>`;
        } else if (o.status === 'Concluído') {
            controlsHtml = `
                <div class="flex justify-end items-center gap-2 mt-4 pt-2 border-t border-gray-700">
                    <span class="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs">FINALIZADO</span>
                    <button onclick="adminRevertStatus('${o.id}')" class="border border-gray-500 text-gray-400 hover:text-white px-3 py-2 rounded text-xs transition">Reabrir</button>
                </div>`;
        } else {
            controlsHtml = `
                <div class="flex flex-col md:flex-row gap-4 justify-end items-center mt-4 border-t border-gray-700 pt-4">
                    <div class="flex items-center gap-2">
                        <label class="text-gray-500 text-xs uppercase font-bold">Status:</label>
                        <select onchange="handleStatusChange(this, '${o.id}')" class="bg-gray-900 text-white text-xs border border-gray-600 rounded p-2 focus:border-yellow-500 outline-none">
                            <option value="Aguardando aprovação" ${o.status === 'Aguardando aprovação' ? 'selected' : ''}>Aguardando aprovação</option>
                            <option value="Aprovado" ${o.status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                            <option value="Preparando pedido" ${o.status === 'Preparando pedido' ? 'selected' : ''}>Preparando</option>
                            <option value="Saiu para entrega" ${o.status === 'Saiu para entrega' ? 'selected' : ''}>Saiu para entrega</option>
                            <option value="Entregue" ${o.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                        </select>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="adminCancelOrder('${o.id}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition">Cancelar</button>
                        <button onclick="adminFinalizeOrder('${o.id}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold transition">Finalizar</button>
                    </div>
                </div>
            `;
        }

        // 6. Monta Card
        const cardWrapper = document.createElement('div');
        cardWrapper.className = "mb-4";

        cardWrapper.innerHTML = `
            <div id="order-header-${o.id}" onclick="toggleOrderAccordion('${o.id}')" 
                 class="bg-black border border-gray-800 p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-gray-600 transition-all shadow-md relative z-10">
                <div class="flex items-center gap-4 flex-1">
                    <span class="text-yellow-500 font-bold text-xl tracking-wide">Pedidos #${o.code}</span>
                    <div id="order-header-info-${o.id}" class="hidden md:flex items-center gap-4 text-sm transition-opacity duration-200">
                        <span class="${statusColorClass} font-bold uppercase text-xs tracking-wider">${o.status}</span>
                        <span class="text-gray-500 text-xs border-l border-gray-800 pl-3">${dataHoraFormatada}</span>
                    </div>
                </div>
                <i id="order-arrow-${o.id}" class="fas fa-chevron-down text-yellow-500 text-xl transition-transform duration-300"></i>
            </div>

            <div id="order-content-${o.id}" class="hidden bg-[#0f172a] border-x border-b border-gray-800 rounded-b-xl p-4 -mt-1 pt-6 shadow-inner">
                <div class="flex justify-between items-start mb-4 pb-4 border-b border-gray-800">
                    <div>
                         <p class="text-gray-500 text-xs uppercase">Data do Pedido</p>
                         <p class="text-white font-bold text-sm">${dataHoraFormatada}</p>
                    </div>
                    <div class="text-right">
                         <p class="text-gray-500 text-xs uppercase">Status Atual</p>
                         <p class="${statusColorClass} font-bold text-sm uppercase">${o.status}</p>
                    </div>
                </div>

                <div class="mb-4">
                    <p class="text-xs text-gray-500 uppercase font-bold mb-2">Itens do Pedido</p>
                    ${itemsHtml}
                    <div class="text-right mt-2 bg-black/20 p-2 rounded border border-gray-700/50">
                        ${o.shippingFee && o.shippingFee > 0 ? `
                        <div class="mb-1 flex justify-between text-xs">
                            <span class="text-gray-500">Frete</span>
                            <span class="text-yellow-500 font-bold">+ ${formatCurrency(o.shippingFee)}</span>
                        </div>` : ''}
                        ${discountHtml}
                        <div class="flex justify-between items-center pt-2 border-t border-gray-700 mt-1">
                            <span class="text-gray-400 text-xs font-bold uppercase">Total Final</span>
                            <span class="text-white font-bold text-xl">${formatCurrency(o.total)}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-gray-900 p-3 rounded border border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-4">
                    <div class="flex flex-col">
                        <span class="text-gray-500 font-bold mb-1">Cliente:</span>
                        <span class="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 w-full text-center truncate flex items-center justify-center h-full">${o.customer?.name || '-'}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-gray-500 font-bold mb-1">Telefone:</span>
                        <span class="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 w-full text-center flex items-center justify-center h-full">${o.customer?.phone || '-'}</span>
                    </div>
                    
                    <div class="flex flex-col">
                        <span class="text-gray-500 font-bold mb-1">Pagamento:</span>
                        <div class="bg-gray-800 text-white px-2 py-2 rounded border border-gray-700 w-full text-center flex flex-col items-center justify-center h-full">
                            <span class="truncate w-full font-bold" title="${rawMethod}">${cleanMethodName}</span>
                            ${typeBadge}
                        </div>
                    </div>
                    <div class="col-span-1 md:col-span-3 mt-1">
                        <span class="text-gray-500 font-bold block mb-1 uppercase">Endereço de Entrega:</span>
                        <div class="bg-gray-800 p-2 rounded border border-gray-700 w-full">
                            ${formatarEnderecoAdmin(o.customer)}
                        </div>
                    </div>
                </div>

                ${controlsHtml}
            </div>
        `;
        listEl.appendChild(cardWrapper);
    });
}

// =================================================================
// 8. EVENT LISTENERS
// =================================================================

function setupEventListeners() {
    setupAccordion('btn-acc-cat', 'content-acc-cat', 'arrow-acc-cat');
    setupAccordion('btn-acc-coupon', 'content-acc-coupon', 'arrow-acc-coupon');

    // Filtros Admin
    // Filtros Admin (Apontando para a nova função filterAndRenderProducts)
    if (els.adminSearchProd) els.adminSearchProd.addEventListener('input', filterAndRenderProducts);
    if (els.adminFilterCat) els.adminFilterCat.addEventListener('change', filterAndRenderProducts);
    if (els.adminSortProd) els.adminSortProd.addEventListener('change', filterAndRenderProducts);

    if (els.confCardActive) {
        els.confCardActive.addEventListener('change', (e) => {
            if (e.target.checked) els.confCardDetails.classList.remove('opacity-50', 'pointer-events-none');
            else els.confCardDetails.classList.add('opacity-50', 'pointer-events-none');
        });
    }
    setupAccordion('btn-acc-installments', 'content-acc-installments', 'arrow-acc-installments');


    // Ações em Massa
    const btnBulkDel = getEl('btn-bulk-delete');
    if (btnBulkDel) btnBulkDel.onclick = async () => {
        if (!confirm(`Excluir ${state.selectedProducts.size} produtos selecionados?`)) return;
        try {
            const promises = Array.from(state.selectedProducts).map(id => deleteDoc(doc(db, `sites/${state.siteId}/products`, id)));
            await Promise.all(promises);
            state.selectedProducts.clear();
            updateBulkActionBar();
        } catch (error) { alert("Erro ao excluir: " + error.message); }
    };

    const btnBulkMove = getEl('btn-bulk-move');
    if (btnBulkMove) btnBulkMove.onclick = async () => {
        const targetCat = els.bulkCategorySelect.value;
        if (!targetCat) return alert("Selecione uma categoria de destino.");
        try {
            const promises = Array.from(state.selectedProducts).map(id => updateDoc(doc(db, `sites/${state.siteId}/products`, id), { category: targetCat }));
            await Promise.all(promises);
            state.selectedProducts.clear();
            updateBulkActionBar();
            filterAndRenderProducts();
            alert("Produtos movidos!");
        } catch (error) { alert("Erro ao mover: " + error.message); }
    };

    // Filtros Vitrine
    if (els.searchInput) els.searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)); renderCatalog(filtered); });
    if (els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); });

    // --- FILTROS DE VENDAS (ATUALIZADO) ---
    // 1. Ativa o Acordeão de Filtros
    setupAccordion('btn-acc-sales-filters', 'content-acc-sales-filters', 'arrow-acc-sales-filters');

    // 2. Listeners dos inputs
    const idsFiltros = [
        'filter-search-general',
        'filter-search-product', // <--- ADICIONEI O NOVO INPUT AQUI
        'filter-status',
        'filter-payment',
        'filter-sort',
        'filter-date-start',
        'filter-date-end',
        'filter-search-code'
    ];

    idsFiltros.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const eventType = id.includes('search') ? 'input' : 'change';
            el.addEventListener(eventType, filterAndRenderSales);
        }
    });

    // 3. Botão Limpar Filtros
    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
        btnClear.onclick = () => {
            idsFiltros.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            // Reset do select de ordenação se existir
            const sort = document.getElementById('filter-sort');
            if (sort) sort.value = 'date_desc';

            filterAndRenderSales();
        };
    }

    // Dashboard Vendas Simples - Controles
    if (els.dashPrevDate) els.dashPrevDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() - 1); else state.dashDate.setMonth(state.dashDate.getMonth() - 1); updateDashboardUI(); };
    if (els.dashNextDate) els.dashNextDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() + 1); else state.dashDate.setMonth(state.dashDate.getMonth() + 1); updateDashboardUI(); };
    if (els.btnViewDay) els.btnViewDay.onclick = () => { state.dashViewMode = 'day'; updateDashboardUI(); };
    if (els.btnViewMonth) els.btnViewMonth.onclick = () => { state.dashViewMode = 'month'; updateDashboardUI(); };

    // --- CONTROLES ESTATÍSTICAS AVANÇADAS (NOVO) ---
    if (els.statsFilterAll) els.statsFilterAll.onclick = () => { state.statsFilterType = 'all'; updateStatsUI(); };
    if (els.statsFilterPeriod) els.statsFilterPeriod.onclick = () => { state.statsFilterType = 'period'; updateStatsUI(); };

    if (els.statsPrevDate) els.statsPrevDate.onclick = () => {
        if (state.statsViewMode === 'day') state.statsDate.setDate(state.statsDate.getDate() - 1);
        else state.statsDate.setMonth(state.statsDate.getMonth() - 1);
        updateStatsUI();
    };
    if (els.statsNextDate) els.statsNextDate.onclick = () => {
        if (state.statsViewMode === 'day') state.statsDate.setDate(state.statsDate.getDate() + 1);
        else state.statsDate.setMonth(state.statsDate.getMonth() + 1);
        updateStatsUI();
    };
    if (els.statsViewDay) els.statsViewDay.onclick = () => { state.statsViewMode = 'day'; updateStatsUI(); };
    if (els.statsViewMonth) els.statsViewMonth.onclick = () => { state.statsViewMode = 'month'; updateStatsUI(); };

    //=====================================================================================================//=====================================================================================================
    // --- LÓGICA DO SELETOR DE PRODUTOS nos filtro da ABA VENDAS - INICIO ---

    window.openProductSelectorModal = () => {
        const modal = document.getElementById('modal-product-selector');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');

            // Limpa a busca interna e foca
            const input = document.getElementById('selector-internal-search');
            if (input) {
                input.value = '';
                input.focus();
            }

            // Renderiza a lista completa
            renderProductSelectorList('');
        }
    };

    window.closeProductSelectorModal = () => {
        const modal = document.getElementById('modal-product-selector');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    window.renderProductSelectorList = (term = '') => {
        const container = document.getElementById('product-selector-list');
        if (!container) return;

        container.innerHTML = '';
        const cleanTerm = term.toLowerCase().trim();

        // Filtra produtos pelo termo (Nome ou Código)
        const filtered = state.products.filter(p => {
            const name = p.name.toLowerCase();
            const code = p.code ? String(p.code).toLowerCase() : '';
            return name.includes(cleanTerm) || code.includes(cleanTerm);
        });

        if (filtered.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4 text-sm">Nenhum produto encontrado.</p>';
            return;
        }

        filtered.forEach(p => {
            const codeStr = p.code ? `#${p.code}` : '-';

            const item = document.createElement('div');
            item.className = "flex items-center justify-between p-3 rounded-lg hover:bg-gray-800 cursor-pointer border border-transparent hover:border-gray-700 transition mb-1 group";

            item.onclick = () => confirmProductSelection(p.name, p.code);

            item.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-yellow-500 font-mono font-bold text-xs bg-yellow-900/20 px-2 py-1 rounded">${codeStr}</span>
                <span class="text-gray-300 font-medium text-sm group-hover:text-white transition">${p.name}</span>
            </div>
            <i class="fas fa-chevron-right text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition"></i>
        `;
            container.appendChild(item);
        });
    };

    window.confirmProductSelection = (name, code) => {
        // 1. Atualiza o Input Oculto (Valor real)
        const inputHidden = document.getElementById('filter-search-product-value');
        if (inputHidden) inputHidden.value = name; // Vamos buscar pelo NOME exato

        // 2. Atualiza o Visual
        const display = document.getElementById('selected-product-display');
        const btnClear = document.getElementById('btn-clear-prod-selection');

        if (display) {
            display.innerText = name;
            display.classList.add('text-white', 'font-bold');
            display.classList.remove('text-gray-400');
        }
        if (btnClear) btnClear.classList.remove('hidden');

        // 3. Fecha Modal e Dispara Filtro
        closeProductSelectorModal();
        filterAndRenderSales();
    };

    window.clearProductFilter = () => {
        // Limpa valor oculto
        const inputHidden = document.getElementById('filter-search-product-value');
        if (inputHidden) inputHidden.value = '';

        // Reseta visual
        const display = document.getElementById('selected-product-display');
        const btnClear = document.getElementById('btn-clear-prod-selection');

        if (display) {
            display.innerText = "Selecionar produto...";
            display.classList.remove('text-white', 'font-bold');
            display.classList.add('text-gray-400');
        }
        if (btnClear) btnClear.classList.add('hidden');

        // Dispara Filtro
        filterAndRenderSales();
    };
    // --- LÓGICA DO SELETOR DE PRODUTOS nos filtro da ABA VENDAS - FIM ---
    //=====================================================================================================//=====================================================================================================

    // Carrinho
    // Carrinho Desktop
    const btnCart = document.getElementById('cart-btn');
    if (btnCart) {
        // btnCart.onclick = toggleCart;  <-- SE TIVER ASSIM, APAGUE!
        btnCart.onclick = window.openCart; // <-- TEM QUE SER ASSIM
    }

    // Carrinho Mobile
    const btnCartMob = document.getElementById('cart-btn-mobile');
    if (btnCartMob) {
        // btnCartMob.onclick = toggleCart; <-- SE TIVER ASSIM, APAGUE!
        btnCartMob.onclick = window.openCart; // <-- TEM QUE SER ASSIM
    }

    // Login
    const btnAdminLogin = getEl('btn-admin-login'); if (btnAdminLogin) { btnAdminLogin.onclick = () => { if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } }; }
    const btnLoginCancel = getEl('btn-login-cancel'); if (btnLoginCancel) btnLoginCancel.onclick = () => getEl('login-modal').close();
    const btnLoginSubmit = getEl('btn-login-submit'); if (btnLoginSubmit) { btnLoginSubmit.onclick = () => { const pass = getEl('admin-pass').value; signInWithEmailAndPassword(auth, "admin@admin.com", pass).then(() => { getEl('login-modal').close(); showView('admin'); }).catch((error) => { alert("Erro login: " + error.message); }); }; }

    // Sidebar e UI Geral
    const btnMob = getEl('mobile-menu-btn'); if (btnMob) btnMob.onclick = window.toggleSidebar;
    const btnCloseSide = getEl('close-sidebar'); if (btnCloseSide) btnCloseSide.onclick = window.toggleSidebar;
    if (els.sidebarOverlay) els.sidebarOverlay.onclick = window.toggleSidebar;
    if (els.themeToggle) els.themeToggle.onclick = () => { toggleTheme(true); };
    if (els.menuLinkHome) {
        els.menuLinkHome.onclick = (e) => {
            if (e) e.preventDefault(); // Evita recarregar a página se for um <a>

            // 1. Garante que a visualização é o catálogo (e não o admin)
            showView('catalog');

            // 2. O PULO DO GATO: Chama o filtro vazio para mostrar TODOS os produtos
            filterByCat('');

            // 3. Fecha a sidebar no mobile se estiver aberta
            if (window.innerWidth < 1024) {
                const sidebar = getEl('sidebar');
                const overlay = getEl('sidebar-overlay');
                if (sidebar) sidebar.classList.add('-translate-x-full');
                if (overlay) overlay.classList.add('hidden');
            }
        };
    }
    if (els.menuBtnAdmin) els.menuBtnAdmin.onclick = () => { window.toggleSidebar(); if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } };

    const btnCat = getEl('btn-toggle-categories'); const containerCat = getEl('sidebar-categories-container'); const iconArrow = getEl('icon-cat-arrow');
    if (btnCat && containerCat) { btnCat.onclick = () => { containerCat.classList.toggle('hidden'); if (iconArrow) { iconArrow.style.transform = containerCat.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; } }; }
    const btnToggleFilters = getEl('btn-toggle-filters'); const filtersBody = getEl('filters-body'); const iconFilter = getEl('icon-filter-arrow');
    if (btnToggleFilters && filtersBody) { btnToggleFilters.onclick = () => { filtersBody.classList.toggle('hidden'); if (iconFilter) { iconFilter.style.transform = filtersBody.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)'; } }; }

    // Modais
    const btnCloseModal = getEl('close-modal-btn'); if (btnCloseModal) btnCloseModal.onclick = closeProductModal;
    const backdrop = getEl('modal-backdrop'); if (backdrop) backdrop.onclick = closeProductModal;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !getEl('product-modal').classList.contains('hidden')) closeProductModal();
    });

    // Forms e Botões de Ação
    if (els.btnAddCat) {
        els.btnAddCat.onclick = async () => {
            const nameInput = els.newCatName.value.trim();
            if (!nameInput) return alert("Digite o nome");
            let finalName = nameInput;
            if (state.selectedCategoryParent) { finalName = `${state.selectedCategoryParent} - ${nameInput}`; }
            try {
                await addDoc(collection(db, `sites/${state.siteId}/categories`), { name: finalName });
                els.newCatName.value = '';
                state.selectedCategoryParent = null;
                renderAdminCategoryList();
            } catch (error) { alert("Erro: " + error.message); }
        };

        // Configurações da Loja
        setupAccordion('btn-acc-profile', 'content-acc-profile', 'arrow-acc-profile');

        if (els.btnSaveProfile) {
            els.btnSaveProfile.onclick = saveStoreProfile;
        }
    }

    // --- LÓGICA DO FORMULÁRIO DE PRODUTO (NOVO) ---
    // Toggle Pix
    const checkPix = getEl('prod-pix-active');
    const settingsPix = getEl('pix-settings');
    if (checkPix && settingsPix) {
        checkPix.addEventListener('change', (e) => {
            if (e.target.checked) {
                settingsPix.classList.remove('opacity-50', 'pointer-events-none');
                getEl('prod-pix-val').focus();
            } else {
                settingsPix.classList.add('opacity-50', 'pointer-events-none');
            }
        });
    }

    // Toggle Tipo Pix (% vs R$)
    const btnPixPercent = getEl('btn-pix-percent');
    const btnPixFixed = getEl('btn-pix-fixed');
    const inputPixType = getEl('prod-pix-type');

    if (btnPixPercent && btnPixFixed) {
        btnPixPercent.onclick = () => {
            inputPixType.value = 'percent';
            btnPixPercent.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition";
            btnPixFixed.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition";
        };
        btnPixFixed.onclick = () => {
            inputPixType.value = 'fixed';
            btnPixFixed.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition";
            btnPixPercent.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition";
        };
    }

    // Toggle Cartão
    const checkCard = getEl('prod-card-active');
    const settingsCard = getEl('card-settings');
    if (checkCard && settingsCard) {
        checkCard.addEventListener('change', (e) => {
            if (e.target.checked) {
                settingsCard.classList.remove('opacity-50', 'pointer-events-none');
                getEl('prod-card-installments').focus();
            } else {
                settingsCard.classList.add('opacity-50', 'pointer-events-none');
            }
        });
    }


    const btnAddCoupon = getEl('btn-add-coupon');
    if (btnAddCoupon) {
        btnAddCoupon.onclick = async () => {
            const code = getEl('coupon-code').value.trim().toUpperCase();
            const val = parseFloat(getEl('coupon-val').value);
            const isPercent = getEl('coupon-is-percent').checked;
            const expiry = getEl('coupon-expiry').value;

            if (!code || isNaN(val)) {
                return showToast("Preencha Código e Valor.", 'error');
            }

            const data = {
                code: code,
                val: val,
                type: isPercent ? 'percent' : 'fixed',
                expiryDate: expiry || null
            };

            try {
                if (state.editingCouponId) {
                    // Tenta atualizar
                    await updateDoc(doc(db, `sites/${state.siteId}/coupons`, state.editingCouponId), data);
                    showToast('Cupom atualizado!');
                } else {
                    // Cria novo
                    const exists = state.coupons.some(c => c.code === code);
                    if (exists) return alert("Já existe um cupom com este código.");

                    await addDoc(collection(db, `sites/${state.siteId}/coupons`), data);
                    showToast('Cupom criado!');
                }

                // Usa a nova função para limpar tudo corretamente
                resetCouponForm();

            } catch (error) {
                console.error("Erro no cupom:", error);

                // Se o erro for "Não encontrado", significa que o cupom sumiu enquanto editava
                if (error.code === 'not-found' || error.message.includes('No document to update')) {
                    alert("Atenção: O cupom que você estava editando não existe mais (talvez foi excluído). Tente criar como um novo.");
                    state.editingCouponId = null; // Força reset para permitir criar de novo
                } else {
                    alert("Erro ao salvar: " + error.message);
                }
            }
        };
    }

    if (els.toggleStockGlobal) {
        els.toggleStockGlobal.addEventListener('change', async (e) => {
            const newValue = e.target.checked;
            try {
                await setDoc(doc(db, `sites/${state.siteId}/settings`, 'general'), { allowNoStock: newValue });
                state.globalSettings.allowNoStock = newValue;
            } catch (error) { e.target.checked = !newValue; }
        });
    }

    // 1. Listener para o Input de Arquivo (Quando seleciona fotos)
    const fileInput = getEl('prod-imgs-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // Processa cada arquivo
            for (const file of files) {
                try {
                    const base64 = await processImageFile(file);
                    state.tempImages.push(base64);
                } catch (err) {
                    console.error("Erro ao processar imagem", err);
                }
            }
            renderImagePreviews();
            fileInput.value = ''; // Limpa input para permitir selecionar a mesma foto se quiser
        });
    }

    // 2. Botão Novo Produto (Resetar imagens)
    const btnAddProd = getEl('btn-add-product');
    if (btnAddProd) {
        btnAddProd.onclick = () => {
            getEl('form-product').reset();
            getEl('edit-prod-id').value = '';

            // RESET DAS IMAGENS
            state.tempImages = [];
            renderImagePreviews();

            const checkNoStock = getEl('prod-allow-no-stock');
            if (checkNoStock) checkNoStock.checked = false;
            if (els.productFormModal) els.productFormModal.classList.remove('hidden');
        };
    }
    const btnCancelProd = getEl('btn-cancel-prod'); if (btnCancelProd) btnCancelProd.onclick = () => { if (els.productFormModal) els.productFormModal.classList.add('hidden'); };

    setupAccordion('btn-acc-installments', 'content-acc-installments', 'arrow-acc-installments');

    if (els.confCardActive) {
        els.confCardActive.addEventListener('change', (e) => {
            const details = els.confCardDetails;
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
        });
    }

    // --- ATUALIZADO: Botão de Finalizar no Carrinho ---
    // Removemos a lógica antiga de mandar direto pro zap e abrimos o modal
    if (els.btnCheckout) {
        els.btnCheckout.onclick = () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            // Fecha carrinho e abre checkout
            els.cartModal.classList.add('hidden');
            openCheckoutModal();
        };
    }

    const formProd = getEl('form-product');
    if (formProd) {
        formProd.onsubmit = async (e) => {
            e.preventDefault();
            try {
                const idEl = getEl('edit-prod-id');
                const nameEl = getEl('prod-name');
                const catEl = getEl('prod-cat-select');
                const descEl = getEl('prod-desc');
                const priceEl = getEl('prod-price');
                const promoEl = getEl('prod-promo');
                const stockEl = getEl('prod-stock');
                const costEl = getEl('prod-cost');
                const sizesEl = getEl('prod-sizes');
                const noStockEl = getEl('prod-allow-no-stock');

                const parseVal = (val) => val ? parseFloat(val.replace(/\./g, '').replace(',', '.')) : 0;

                // Validação de Imagem
                if (state.tempImages.length === 0) {
                    return alert("Adicione pelo menos uma imagem!");
                }

                // --- CORREÇÃO: Captura dos Dados do PIX ---
                const pixActive = getEl('prod-pix-active').checked;
                const pixVal = parseFloat(getEl('prod-pix-val').value) || 0;
                const pixType = getEl('prod-pix-type').value || 'percent';

                // --- Captura Dados Básicos ---
                const data = {
                    name: nameEl ? nameEl.value : 'Sem Nome',
                    category: catEl ? catEl.value : "Geral",
                    description: descEl ? descEl.value : '',
                    price: priceEl ? parseVal(priceEl.value) : 0,
                    promoPrice: promoEl && promoEl.value ? parseVal(promoEl.value) : null,
                    stock: stockEl ? parseInt(stockEl.value) : 0,
                    cost: costEl ? parseVal(costEl.value) : 0,
                    sizes: sizesEl ? sizesEl.value.split(',').map(s => s.trim()).filter(s => s !== '') : [],
                    images: state.tempImages, // Usa as imagens processadas
                    allowNoStock: noStockEl ? noStockEl.checked : false,

                    // --- CORREÇÃO: Objeto de Pagamento Inserido Corretamente ---
                    paymentOptions: {
                        pix: {
                            active: pixActive,
                            val: pixVal,
                            type: pixType
                        }
                        // Futuramente pode adicionar 'card' aqui se for configuração individual
                    }
                };

                // Gera código se for novo produto
                if (!idEl.value) {
                    // Chama a função que conta 1, 2, 3...
                    const nextCode = await getNextProductCode(state.siteId);

                    data.code = nextCode;
                    data.createdAt = new Date().toISOString();
                }

                const id = idEl.value;

                if (id) {
                    await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data);
                    showToast('Produto atualizado!');
                } else {
                    await addDoc(collection(db, `sites/${state.siteId}/products`), data);
                    showToast('Produto criado!');
                }

                if (els.productFormModal) els.productFormModal.classList.add('hidden');
                e.target.reset();
                state.tempImages = [];

            } catch (err) {
                console.error(err);
                alert("Erro ao salvar produto: " + err.message);
            }
        };
    }


    const btnLogout = getEl('btn-logout'); if (btnLogout) btnLogout.onclick = () => signOut(auth);

    document.querySelectorAll('.tab-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); const target = getEl(btn.dataset.tab); if (target) target.classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500'); b.classList.add('text-gray-400'); }); btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500'); btn.classList.remove('text-gray-400'); }; });

    const btnCheckout = getEl('btn-checkout');
    if (btnCheckout) {
        btnCheckout.onclick = async () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            const totalText = document.getElementById('cart-total').innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();

            // ATENÇÃO: Adicionando Custo ao Pedido para Relatórios Futuros
            const cartItemsWithCost = state.cart.map(item => {
                const product = state.products.find(p => p.id === item.id);
                return {
                    ...item,
                    cost: product ? parseFloat(product.cost || 0) : 0
                };
            });

            const orderData = {
                items: cartItemsWithCost,
                total: parseFloat(totalText),
                cupom: state.currentCoupon ? state.currentCoupon.code : null,
                date: new Date().toISOString(),
                status: 'Pendente',
                code: Math.floor(10000 + Math.random() * 90000)
            };

            try { await addDoc(collection(db, `sites/${state.siteId}/sales`), orderData); } catch (e) { console.log("Erro pedido:", e); }
            let msg = `*NOVO PEDIDO - ${orderData.code}*\n\n`;
            state.cart.forEach(i => { msg += `▪ ${i.qty}x ${i.name} (${i.size}) - ${formatCurrency(i.price)}\n`; });
            msg += `\nSubtotal: ${document.getElementById('cart-subtotal').innerText}`;
            if (state.currentCoupon) msg += `\nCupom: ${state.currentCoupon.code}`;
            msg += `\n*TOTAL: ${document.getElementById('cart-total').innerText}*`;
            msg += `\n\nAguardo link de pagamento!`;
            const sellerPhone = "5511941936976";
            window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
            state.cart = []; state.currentCoupon = null; saveCart();
            els.cartModal.classList.add('hidden');
        };
    }

    const elCheck = document.getElementById('conf-card-active');
    if (elCheck) {
        elCheck.addEventListener('change', (e) => {
            const details = document.getElementById('conf-card-details');
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
        });
    }

    //==============================================================   
    //LÓGICA DA ABA CONFIGURAÇÕES:
    // --- AUTOSALVAMENTO: LOGÍSTICA (CEP) ---
    const elCep = document.getElementById('conf-store-cep');
    const elDist = document.getElementById('conf-max-dist');

    // Usa 'blur' (quando clica fora do campo) para não salvar enquanto digita cada letra
    if (elCep) elCep.addEventListener('blur', () => autoSaveSettings('logistics'));
    if (elDist) elDist.addEventListener('blur', () => autoSaveSettings('logistics'));

    // --- AUTOSALVAMENTO: PARCELAMENTO ---
    const elCardActive = document.getElementById('conf-card-active');
    const elCardMax = document.getElementById('conf-card-max');
    const elCardFree = document.getElementById('conf-card-free');
    const elCardRate = document.getElementById('conf-card-rate');

    // Para o Checkbox, usamos 'change' (salva assim que clica)
    if (elCardActive) {
        elCardActive.addEventListener('change', (e) => {
            // Controle visual da opacidade
            const details = document.getElementById('conf-card-details');
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
            // Chama o salvamento automático
            autoSaveSettings('installments');
        });
    }

    // Para os outros campos de parcelamento, usamos 'change' ou 'blur'
    if (elCardMax) elCardMax.addEventListener('change', () => autoSaveSettings('installments'));
    if (elCardFree) elCardFree.addEventListener('change', () => autoSaveSettings('installments'));
    if (elCardRate) elCardRate.addEventListener('blur', () => autoSaveSettings('installments'));


    // 1. Lógica Admin: Dependência dos Checkboxes de Entrega
    const checkOwnDelivery = document.getElementById('conf-own-delivery');
    const checkReqCode = document.getElementById('conf-req-code');
    const inputCancelTime = document.getElementById('conf-cancel-time');

    // --- LISTENER DO FRETE ---
    const elShipCheck = document.getElementById('conf-shipping-active');
    const elShipInput = document.getElementById('conf-shipping-value');

    if (elShipCheck) {
        elShipCheck.addEventListener('change', (e) => {
            const container = document.getElementById('shipping-value-container');
            if (e.target.checked) container.classList.remove('opacity-50', 'pointer-events-none');
            else container.classList.add('opacity-50', 'pointer-events-none');

            autoSaveSettings('orders');
        });
    }
    if (elShipInput) {
        // Usa blur para salvar só quando sair do campo
        elShipInput.addEventListener('blur', () => autoSaveSettings('orders'));
    }

    if (checkOwnDelivery && checkReqCode) {
        // Estado inicial
        toggleReqCodeState(checkOwnDelivery.checked);

        // Ao mudar "Entrega Própria"
        checkOwnDelivery.addEventListener('change', (e) => {
            const isActive = e.target.checked;
            toggleReqCodeState(isActive);

            // Se desativou a entrega, desativa o código obrigatoriamente
            if (!isActive) {
                checkReqCode.checked = false;
            }

            // Salva
            autoSaveSettings('orders');
        });

        // Ao mudar "Solicitar Código"
        checkReqCode.addEventListener('change', () => autoSaveSettings('orders'));

        // Ao mudar Tempo de Cancelamento
        if (inputCancelTime) {
            inputCancelTime.addEventListener('blur', () => autoSaveSettings('orders'));
        }
    }

    // Função visual para travar/destravar o checkbox dependente
    function toggleReqCodeState(isActive) {
        if (!checkReqCode) return;
        const parentLabel = checkReqCode.closest('label');

        if (isActive) {
            checkReqCode.disabled = false;
            if (parentLabel) parentLabel.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            checkReqCode.disabled = true;
            if (parentLabel) parentLabel.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    // 2. Lógica do Modal de Carrinho (Botões de Navegação)
    const btnGoCheckout = document.getElementById('btn-go-checkout');
    const btnFinishPayment = document.getElementById('btn-finish-payment');
    const btnCloseCart = document.getElementById('close-cart');

    if (btnGoCheckout) btnGoCheckout.onclick = goToCheckoutView;
    if (btnFinishPayment) {
        btnFinishPayment.onclick = window.submitOrder;
    }
    if (btnCloseCart) btnCloseCart.onclick = closeCartModal;

    // 1. Troca Online / Entrega (Radio Principal)
    const radiosPayMode = document.getElementsByName('pay-mode');
    radiosPayMode.forEach(r => r.addEventListener('change', togglePaymentMode));

    // 2. Troca Pix / Cartão / Dinheiro (Radio Secundário)
    const radiosMethod = document.getElementsByName('payment-method-selection');
    radiosMethod.forEach(r => r.addEventListener('change', toggleMethodSelection));

    // 3. Troca de Parcelas
    const selectInst = document.getElementById('checkout-installments');
    if (selectInst) selectInst.addEventListener('change', calcCheckoutTotal);


    // --- DENTRO DE setupEventListeners ---

    const btnTrack = document.getElementById('btn-track-icon');
    if (btnTrack) {
        btnTrack.onclick = () => {
            // Chama a função que abre a LISTA e verifica se tem pedidos
            openTrackModal();
        };
    }


    // --- LÓGICA DE PAGAMENTO (VALIDAÇÃO E UI) ---
    const checkOnlineActive = document.getElementById('conf-pay-online-active');
    const checkDeliveryActive = document.getElementById('conf-pay-delivery-active');
    const groupOnline = document.getElementById('group-online-methods');
    const groupDelivery = document.getElementById('group-delivery-methods');

    // 1. Validação dos Mestres (Pelo menos um tipo ativo)
    const validateMasterSwitch = (e) => {
        if (!checkOnlineActive.checked && !checkDeliveryActive.checked) {
            alert("⚠️ Pelo menos uma forma de pagamento (Online ou Entrega) deve permanecer ativa.");
            e.target.checked = true;
            return;
        }
        updateOpacity();
        autoSaveSettings('installments');
    };

    const updateOpacity = () => {
        if (groupOnline) groupOnline.className = checkOnlineActive.checked ? "space-y-3 opacity-100" : "space-y-3 opacity-30 pointer-events-none";
        if (groupDelivery) groupDelivery.className = checkDeliveryActive.checked ? "space-y-3 opacity-100" : "space-y-3 opacity-30 pointer-events-none";
    }

    if (checkOnlineActive) checkOnlineActive.addEventListener('change', validateMasterSwitch);
    if (checkDeliveryActive) checkDeliveryActive.addEventListener('change', validateMasterSwitch);

    // 2. Validação dos Sub-itens (Pelo menos uma opção dentro do grupo)
    const validateSubOptions = (className) => {
        const checkboxes = document.querySelectorAll(`.${className}`);

        checkboxes.forEach(chk => {
            chk.addEventListener('change', (e) => {
                // Conta quantos estão marcados neste grupo
                const checkedCount = document.querySelectorAll(`.${className}:checked`).length;

                if (checkedCount === 0) {
                    alert("⚠️ Pelo menos uma opção deve estar selecionada neste grupo.");
                    e.target.checked = true; // Reverte a ação
                    return;
                }
                autoSaveSettings('installments');
            });
        });
    };

    // Aplica a validação nos grupos (adicionei classes no HTML do passo 1)
    validateSubOptions('sub-check-online');
    validateSubOptions('sub-check-delivery');
}

function updateCardStyles(isLight) {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        const title = card.querySelector('h3');
        if (isLight) {
            card.classList.remove('bg-gray-800'); card.classList.add('bg-white', 'text-gray-900', 'shadow-md');
            if (title) title.classList.replace('text-white', 'text-gray-900');
        } else {
            card.classList.add('bg-gray-800'); card.classList.remove('bg-white', 'text-gray-900', 'shadow-md');
            if (title) title.classList.replace('text-gray-900', 'text-white');
        }
    });
}

function toggleTheme(save = true) {
    state.isDarkMode = !state.isDarkMode;
    const body = document.body;
    const nav = document.querySelector('nav');
    const icon = getEl('theme-icon');
    const text = getEl('theme-text');

    if (!state.isDarkMode) {
        body.classList.replace('bg-black', 'bg-gray-100');
        body.classList.replace('text-white', 'text-gray-900');
        if (nav) { nav.classList.replace('bg-black', 'bg-white'); nav.classList.remove('border-gray-800'); nav.classList.add('border-gray-200', 'shadow-sm'); }
        if (icon) { icon.classList.replace('fa-sun', 'fa-moon'); text.innerText = "Modo Escuro"; }
        if (save) localStorage.setItem('theme', 'light');
    } else {
        body.classList.replace('bg-gray-100', 'bg-black');
        body.classList.replace('text-gray-900', 'text-white');
        if (nav) { nav.classList.replace('bg-white', 'bg-black'); nav.classList.remove('border-gray-200', 'shadow-sm'); nav.classList.add('border-gray-800'); }
        if (icon) { icon.classList.replace('fa-moon', 'fa-sun'); text.innerText = "Modo Claro"; }
        if (save) localStorage.setItem('theme', 'dark');
    }
    updateCardStyles(!state.isDarkMode);
}

function showView(viewName) {
    if (viewName === 'admin') {
        if (els.viewCatalog) els.viewCatalog.classList.add('hidden');
        if (els.viewAdmin) els.viewAdmin.classList.remove('hidden');
        loadAdminSales(); // Garante o carregamento ao trocar de aba
    } else {
        if (els.viewCatalog) els.viewCatalog.classList.remove('hidden');
        if (els.viewAdmin) els.viewAdmin.classList.add('hidden');
    }
}

function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        // --- 1. TECLA ESC (Fechar Modais) ---
        if (e.key === 'Escape') {
            // Se o visualizador de imagem estiver aberto, fecha ele primeiro
            const viewer = getEl('image-viewer');
            if (!viewer.classList.contains('hidden')) {
                closeImageViewer();
                return; // Para aqui para não fechar o modal do produto junto
            }

            // Se o modal de produto estiver aberto, fecha ele
            const prodModal = getEl('product-modal');
            if (!prodModal.classList.contains('hidden')) {
                closeProductModal();
                return;
            }

            // Se o carrinho estiver aberto, fecha ele
            const cartModal = getEl('cart-modal');
            if (!cartModal.classList.contains('hidden')) {
                cartModal.classList.add('hidden');
                return;
            }
        }
        // Verifica bloqueios (Carrinho aberto, digitando, etc)
        const isCartOpen = !getEl('cart-modal').classList.contains('hidden');
        const isProductModalOpen = !getEl('product-modal').classList.contains('hidden');
        const isTyping = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';

        // Se estiver digitando ou com modais abertos, ignora atalhos globais
        if (isTyping || isCartOpen || isProductModalOpen) return;

        // --- 1. Lógica DELETE (Produtos e Cupons) ---
        if (e.key === 'Delete') {

            // Caso A: Deletar Produto da Tabela
            if (state.focusedProductId) {
                e.preventDefault();
                confirmDeleteProduct(state.focusedProductId);
                return;
            }

            // Caso B: Deletar Cupom Selecionado
            // Verifica se a aba de cupons está visível
            const isCouponTabVisible = !getEl('tab-loja').classList.contains('hidden') && !getEl('view-admin').classList.contains('hidden');

            if (isCouponTabVisible && state.focusedCouponIndex >= 0 && state.coupons[state.focusedCouponIndex]) {
                e.preventDefault();
                const couponId = state.coupons[state.focusedCouponIndex].id;
                deleteCoupon(couponId);
                return;
            }
        }

        // --- 2. Navegação CUPONS (Setas e Enter) ---
        const isCouponTabVisible = !getEl('tab-loja').classList.contains('hidden') && !getEl('view-admin').classList.contains('hidden');

        if (isCouponTabVisible && state.coupons.length > 0) {

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                state.focusedCouponIndex = Math.min(state.focusedCouponIndex + 1, state.coupons.length - 1);
                renderAdminCoupons();
                // Garante que o item apareça na tela
                const el = document.getElementById(`coupon-item-${state.focusedCouponIndex}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                state.focusedCouponIndex = Math.max(state.focusedCouponIndex - 1, 0);
                renderAdminCoupons();
                const el = document.getElementById(`coupon-item-${state.focusedCouponIndex}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                if (state.focusedCouponIndex >= 0) {
                    const coupon = state.coupons[state.focusedCouponIndex];
                    if (coupon) editCoupon(coupon.id);
                }
            }
        }
    });
}

// function updateBulkActionBar() {
//     if (!els.bulkActionsBar) return;
//     const count = state.selectedProducts.size;
//     els.selectedCount.innerText = count;
//     if (count > 0) {
//         els.bulkActionsBar.classList.remove('hidden');
//         els.bulkActionsBar.classList.add('flex');
//     } else {
//         els.bulkActionsBar.classList.add('hidden');
//         els.bulkActionsBar.classList.remove('flex');
//     }
// }

function setupSwipe(element) {
    if (!element) return;

    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    // Limite para considerar que abriu (largura do botão vermelho)
    const SWIPE_THRESHOLD = -80;

    element.addEventListener('touchstart', (e) => {
        // Se estiver em modo de seleção, desativa o swipe para não atrapalhar o checkbox
        if (state.isSelectionMode) return;

        startX = e.touches[0].clientX;
        isSwiping = true;
        element.style.transition = 'none'; // Remove transição para arrastar em tempo real
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;

        // Só permite arrastar para a esquerda (diff negativo)
        if (diff < 0 && diff > -120) {
            element.style.transform = `translateX(${diff}px)`;
        }
    }, { passive: true });

    element.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;
        element.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'; // Animação suave na soltura

        const diff = currentX - startX;

        // Se arrastou o suficiente, trava aberto
        if (diff < SWIPE_THRESHOLD) {
            element.style.transform = `translateX(-100px)`;

            // Fecha automaticamente após 3 segundos se não clicar
            setTimeout(() => {
                element.style.transform = `translateX(0)`;
            }, 3000);
        } else {
            // Se não arrastou muito, volta pro lugar (cancela)
            element.style.transform = `translateX(0)`;
        }
    });
}

// =================================================================
// 9. FUNÇÕES GLOBAIS (HTML ONCLICK)
// =================================================================

window.updateStatus = async (orderId, newStatus, oldStatus) => {
    if (!confirm(`Alterar status para ${newStatus}?`)) return;
    await updateDoc(doc(db, `sites/${state.siteId}/sales`, orderId), { status: newStatus });

    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    if (newStatus === 'Confirmado' && oldStatus !== 'Confirmado') {
        for (const item of order.items) {
            const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
            const prodInState = state.products.find(p => p.id === item.id);
            if (prodInState) {
                const allowNegative = state.globalSettings.allowNoStock || prodInState.allowNoStock;
                let newStock = prodInState.stock - item.qty;
                if (!allowNegative && newStock < 0) newStock = 0;
                await updateDoc(prodRef, { stock: newStock });
            }
        }
    }
    if ((newStatus === 'Cancelado' || newStatus === 'Reembolsado') && oldStatus === 'Confirmado') {
        for (const item of order.items) {
            const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
            const prodInState = state.products.find(p => p.id === item.id);
            if (prodInState) {
                const newStock = prodInState.stock + item.qty;
                await updateDoc(prodRef, { stock: newStock });
            }
        }
    }
};

window.openProductModal = (productId) => {
    const p = state.products.find(x => x.id === productId);
    if (!p) return;

    state.focusedProductId = productId;
    state.currentImgIndex = 0;

    const modal = getEl('product-modal');
    const backdrop = getEl('modal-backdrop');
    const card = getEl('modal-card');

    if (!modal || !card) return;

    // 1. CONFIGURAÇÃO DO CARD
    // max-h-[90vh]: Limita altura para não estourar a tela
    // overflow-hidden: Garante bordas arredondadas
    card.className = "bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-700 flex flex-col md:flex-row overflow-hidden transform transition-all duration-300 pointer-events-auto relative scale-95 opacity-0";

    // 2. IMAGENS
    let images = p.images || [];
    if (images.length === 0) images = ['https://placehold.co/600'];

    const btnPrev = getEl('btn-prev-img');
    const btnNext = getEl('btn-next-img');

    if (images.length > 1) {
        if (btnPrev) btnPrev.classList.remove('hidden');
        if (btnNext) btnNext.classList.remove('hidden');
    } else {
        if (btnPrev) btnPrev.classList.add('hidden');
        if (btnNext) btnNext.classList.add('hidden');
    }
    updateCarouselUI(images);

    // 3. TEXTOS
    if (getEl('modal-title')) getEl('modal-title').innerText = p.name;
    if (getEl('modal-desc')) getEl('modal-desc').innerText = p.description || "Sem descrição detalhada.";

    const price = p.promoPrice || p.price;
    if (getEl('modal-price')) getEl('modal-price').innerHTML = formatCurrency(price);

    // 4. ESTRUTURA DE ROLAGEM (AJUSTE PRINCIPAL)
    const rightCol = card.children[2]; // Coluna da direita

    if (rightCol) {
        // AQUI ESTÁ A MUDANÇA:
        // overflow-y-auto: A coluna inteira rola.
        // no-scrollbar: Esconde a barra visualmente.
        // h-full: Ocupa toda a altura disponível.
        rightCol.className = "w-full md:w-1/2 flex flex-col h-full bg-gray-900 overflow-y-auto no-scrollbar relative";

        // A. Header (Título/Preço)
        if (rightCol.children[0]) {
            // Removemos borda fixa se quiser fluxo contínuo, ou mantemos para organização
            rightCol.children[0].className = "p-6 md:p-8 pb-4 shrink-0";
        }

        // B. Miolo (Texto)
        if (rightCol.children[1]) {
            const scrollContent = rightCol.children[1];
            // Removemos 'overflow-y-auto' e 'flex-1' daqui, pois quem rola agora é o pai (rightCol)
            // min-h-0 evita bugs de flexbox
            scrollContent.className = "px-6 md:px-8 pb-4 space-y-6";
        }
    }

    // 5. TAMANHOS
    const sizesDiv = getEl('modal-sizes');
    const sizesWrapper = getEl('modal-sizes-wrapper');
    let selectedSizeInModal = 'U';

    if (sizesDiv) {
        sizesDiv.innerHTML = '';
        if (p.sizes && p.sizes.length > 0) {
            if (sizesWrapper) sizesWrapper.classList.remove('hidden');
            selectedSizeInModal = p.sizes[0];

            p.sizes.forEach(s => {
                const btn = document.createElement('button');
                btn.className = `w-10 h-10 rounded border font-bold transition flex items-center justify-center text-sm ${s === selectedSizeInModal ? 'bg-yellow-500 text-black border-yellow-500' : 'border-gray-600 text-gray-300 hover:border-yellow-500 hover:text-yellow-500'}`;
                btn.innerText = s;
                btn.onclick = () => {
                    selectedSizeInModal = s;
                    Array.from(sizesDiv.children).forEach(b => {
                        if (b.innerText === s) {
                            b.className = "w-10 h-10 rounded border border-yellow-500 bg-yellow-500 text-black font-bold transition flex items-center justify-center text-sm";
                        } else {
                            b.className = "w-10 h-10 rounded border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center text-sm";
                        }
                    });
                };
                sizesDiv.appendChild(btn);
            });
        } else {
            if (sizesWrapper) sizesWrapper.classList.add('hidden');
        }
    }

    // 6. BOTÃO (Agora flui com o texto)
    const btnAdd = getEl('modal-add-cart');
    if (btnAdd) {
        // Container do botão: Apenas padding e fundo, sem fixação
        if (btnAdd.parentElement) {
            btnAdd.parentElement.className = "p-6 md:p-8 pt-4 bg-gray-900";
        }

        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;

        if (isOut) {
            btnAdd.disabled = true;
            btnAdd.innerHTML = "<span>ESGOTADO</span>";
            btnAdd.className = "w-full bg-gray-700 text-gray-500 font-bold text-sm py-4 rounded-xl cursor-not-allowed uppercase tracking-wide flex items-center justify-center";
        } else {
            btnAdd.disabled = false;
            btnAdd.innerHTML = `<i class="fas fa-shopping-bag mr-2"></i><span>ADICIONAR</span>`;
            btnAdd.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold text-sm py-4 rounded-xl shadow-lg shadow-green-900/50 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide";
            btnAdd.onclick = () => { addToCart(p, selectedSizeInModal); closeProductModal(); };
        }
    }

    // 7. EXIBIÇÃO
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        card.classList.remove('opacity-0', 'scale-95');
        card.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.closeProductModal = () => {
    const modal = getEl('product-modal');
    const backdrop = getEl('modal-backdrop');
    const card = getEl('modal-card');
    if (!modal) return;
    backdrop.classList.add('opacity-0');
    card.classList.remove('scale-100');
    card.classList.add('opacity-0', 'scale-95');
    setTimeout(() => { modal.classList.add('hidden'); }, 300);
};

// Variável para controlar zoom
// Variável para controlar zoom
let isZoomed = false;

window.openImageViewer = () => {
    const p = state.products.find(x => x.id === state.focusedProductId);
    if (!p) return;

    const viewer = getEl('image-viewer');
    const img = getEl('image-viewer-src');
    const images = p.images && p.images.length > 0 ? p.images : ['https://placehold.co/600'];

    // Define a imagem atual baseada no índice do modal
    img.src = images[state.currentImgIndex];

    // Reseta zoom e cursor
    isZoomed = false;
    img.style.transform = "scale(1)";
    img.style.cursor = "zoom-in";

    // Mostra/Esconde setas baseado na quantidade de fotos
    const btnPrev = getEl('viewer-prev');
    const btnNext = getEl('viewer-next');
    if (images.length > 1) {
        btnPrev.classList.remove('hidden');
        btnNext.classList.remove('hidden');
    } else {
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
    }

    viewer.classList.remove('hidden');
    viewer.classList.add('flex');

    // Lógica de Zoom ao clicar na imagem
    img.onclick = (e) => {
        e.stopPropagation();
        isZoomed = !isZoomed;
        if (isZoomed) {
            img.style.transform = "scale(2.5)";
            img.style.cursor = "zoom-out";
            // Esconde setas durante o zoom para não atrapalhar
            btnPrev.classList.add('hidden');
            btnNext.classList.add('hidden');
        } else {
            img.style.transform = "scale(1)";
            img.style.cursor = "zoom-in";
            // Mostra setas de volta (se tiver mais de 1 foto)
            if (images.length > 1) {
                btnPrev.classList.remove('hidden');
                btnNext.classList.remove('hidden');
            }
        }
    };

    // Clique fora fecha
    viewer.onclick = (e) => {
        if (e.target === viewer) closeImageViewer();
    };
};

window.closeImageViewer = () => {
    const viewer = getEl('image-viewer');
    const viewerSrc = getEl('image-viewer-src');
    viewer.classList.add('hidden');
    viewer.classList.remove('flex');
    if (viewerSrc) viewerSrc.src = '';
};

window.selectSizeCard = (prodId, size) => {
    state.cardSelections[prodId] = size;
    renderCatalog(state.products);
};

window.addToCartCard = (prodId, size) => {
    const product = state.products.find(p => p.id === prodId);
    if (!product) return;
    addToCart(product, size);
};

window.updateCartQtyCard = (prodId, size, delta) => {
    const product = state.products.find(p => p.id === prodId);
    if (!product) return;

    const index = state.cart.findIndex(i => i.id === prodId && i.size === size);
    if (index === -1) return;

    // Se estiver adicionando (+), verifica o estoque TOTAL do produto
    if (delta > 0) {
        const allowNegative = state.globalSettings.allowNoStock || product.allowNoStock;

        // Conta quantos desse produto (qualquer tamanho) já existem no carrinho
        const currentTotalQty = state.cart.reduce((total, item) => {
            return item.id === prodId ? total + item.qty : total;
        }, 0);

        if (!allowNegative && (currentTotalQty + 1 > product.stock)) {
            alert("Estoque máximo atingido para este produto.");
            return;
        }
    }

    state.cart[index].qty += delta;
    if (state.cart[index].qty <= 0) {
        state.cart.splice(index, 1);
    }
    saveCart();
};

window.changeQty = (index, delta) => {
    const item = state.cart[index];
    const product = state.products.find(p => p.id === item.id);

    // Se estiver aumentando a quantidade
    if (delta > 0 && product) {
        const allowNegative = state.globalSettings.allowNoStock || product.allowNoStock;

        // Conta total no carrinho
        const currentTotalQty = state.cart.reduce((total, cartItem) => {
            return cartItem.id === item.id ? total + cartItem.qty : total;
        }, 0);

        if (!allowNegative && (currentTotalQty + 1 > product.stock)) {
            alert("Limite de estoque atingido.");
            return;
        }
    }

    state.cart[index].qty += delta;
    if (state.cart[index].qty <= 0) state.cart.splice(index, 1);
    saveCart();
};

window.confirmDeleteProduct = async (id) => {
    // 1. Verifica se há pedidos ativos ou finalizados vinculados a este produto
    // Status que IMPEDEM a exclusão (Basicamente qualquer coisa que não seja Cancelado)
    // Se o pedido foi concluído, tecnicamente faz parte do histórico fiscal/venda, então também não deveria apagar,
    // mas vou seguir sua regra: "Diferente de Cancelado ou Concluído".

    // Porém, por segurança contábil, o ideal é nunca apagar produto vendido. 
    // Mas seguindo sua regra estrita (Bloquear apenas se estiver EM ANDAMENTO):
    const activeStatuses = ['Aguardando aprovação', 'Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue'];

    // Procura em todas as vendas carregadas
    const hasActiveOrder = state.orders.some(order => {
        // Verifica se o status do pedido está na lista de bloqueio
        const isActive = activeStatuses.includes(order.status);

        // Verifica se o produto está dentro dos itens desse pedido
        const hasProduct = order.items.some(item => item.id === id);

        return isActive && hasProduct;
    });

    if (hasActiveOrder) {
        alert("⛔ AÇÃO BLOQUEADA\n\nEste produto faz parte de um pedido em andamento (Aberto, Preparando ou Entrega).\nVocê não pode excluí-lo até que o pedido seja Cancelado ou Concluído.");
        return;
    }

    // 2. Confirmação padrão
    if (confirm('Tem certeza? Se este produto já foi vendido anteriormente, o histórico dele pode ficar incompleto.')) {
        try {
            await deleteDoc(doc(db, `sites/${state.siteId}/products`, id));
            showToast("Produto excluído!");
            // Se usou a seleção em massa, limpa ela
            if (state.selectedProducts.has(id)) {
                state.selectedProducts.delete(id);
                updateBulkActionBar();
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao excluir: " + error.message);
        }
    }
};

window.saveProduct = async () => {
    const btnSave = getEl('btn-save-product') || document.querySelector('button[onclick="saveProduct()"]');
    const originalText = btnSave ? btnSave.innerText : 'Salvar';

    // 1. Pega os inputs
    const id = getEl('edit-prod-id').value;
    const name = getEl('prod-name').value;
    const cat = getEl('prod-cat-select').value;

    const priceRaw = getEl('prod-price').value;
    const promoRaw = getEl('prod-promo').value;
    const costRaw = getEl('prod-cost').value;
    const stockRaw = getEl('prod-stock').value;

    const desc = getEl('prod-desc').value;
    const sizesStr = getEl('prod-sizes').value;
    const allowNoStock = getEl('prod-allow-no-stock').checked;

    // --- NOVA FUNÇÃO DE CONVERSÃO (BRL -> FLOAT) ---
    // Transforma "1.250,90" em 1250.90 para o banco de dados
    const parseBRL = (val) => {
        if (!val) return 0;
        // Remove os pontos de milhar (.) e troca a vírgula decimal por ponto (.)
        const cleanVal = val.toString().replace(/\./g, '').replace(',', '.');
        return parseFloat(cleanVal);
    };

    const price = parseBRL(priceRaw);

    // Validação
    if (!name || isNaN(price) || price <= 0) {
        return alert('Preencha o Nome e o Preço corretamente.');
    }

    if (btnSave) {
        btnSave.innerText = 'Salvando...';
        btnSave.disabled = true;
    }

    try {
        // 2. Monta o Objeto
        const productData = {
            name: name,
            description: desc,
            category: cat,
            price: price, // Valor numérico limpo
            promoPrice: promoRaw ? parseBRL(promoRaw) : null,
            stock: parseInt(stockRaw) || 0,
            cost: costRaw ? parseBRL(costRaw) : null,
            allowNoStock: allowNoStock,
            sizes: sizesStr ? sizesStr.split(',').map(s => s.trim()) : [],
            images: state.tempImages || []
        };

        // 3. PIX
        const pixActive = getEl('prod-pix-active').checked;
        const pixValRaw = getEl('prod-pix-val').value;
        const pixType = getEl('prod-pix-type').value;

        productData.paymentOptions = {
            pix: {
                active: pixActive,
                val: parseBRL(pixValRaw),
                type: pixType
            }
        };

        // 4. Salva no Firebase
        if (!id) { // Se não tem ID, é CRIAÇÃO

            // AQUI ESTAVA O ERRO: Chamamos a função sequencial agora
            const nextCode = await getNextProductCode(state.siteId);

            productData.code = nextCode; // Grava o 1, 2, 3...
            productData.createdAt = new Date().toISOString();

            await addDoc(collection(db, `sites/${state.siteId}/products`), productData);
            showToast(`Produto #${nextCode} criado!`);

        } else {
            // Se tem ID, é EDIÇÃO (não muda o código)
            await updateDoc(doc(db, `sites/${state.siteId}/products`, id), productData);
            showToast('Produto atualizado!');
        }

        // 5. Fecha Modal e Atualiza
        if (els.productFormModal) els.productFormModal.classList.add('hidden');

        if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
        else window.location.reload();

    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert('Erro: ' + error.message);
    } finally {
        if (btnSave) {
            btnSave.innerText = originalText;
            btnSave.disabled = false;
        }
    }
};

window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id); if (!p) return;

    getEl('edit-prod-id').value = p.id;
    getEl('prod-name').value = p.name;

    const catSelect = getEl('prod-cat-select');
    if (catSelect && p.category) catSelect.value = p.category;

    getEl('prod-desc').value = p.description;
    getEl('prod-price').value = formatMoneyForInput(p.price);
    getEl('prod-promo').value = formatMoneyForInput(p.promoPrice);
    getEl('prod-stock').value = p.stock; // Estoque continua igual (número inteiro)
    getEl('prod-cost').value = formatMoneyForInput(p.cost);
    getEl('prod-sizes').value = p.sizes ? p.sizes.join(',') : '';

    // CARREGA IMAGENS EXISTENTES NO STATE TEMPORÁRIO
    state.tempImages = p.images ? [...p.images] : [];
    renderImagePreviews();

    const checkNoStock = getEl('prod-allow-no-stock');
    if (checkNoStock) checkNoStock.checked = p.allowNoStock || false;

    if (els.productFormModal) els.productFormModal.classList.remove('hidden');

    // --- CORREÇÃO: CARREGAMENTO DO PIX ---
    const pixOptions = (p.paymentOptions && p.paymentOptions.pix) ? p.paymentOptions.pix : { active: false, val: 0, type: 'percent' };

    const checkPix = getEl('prod-pix-active');
    const inputPixVal = getEl('prod-pix-val');
    const inputPixType = getEl('prod-pix-type');
    const settingsPix = getEl('pix-settings');

    if (checkPix) {
        checkPix.checked = pixOptions.active;
        // Ativa visualmente a área se estiver marcado
        if (pixOptions.active) settingsPix.classList.remove('opacity-50', 'pointer-events-none');
        else settingsPix.classList.add('opacity-50', 'pointer-events-none');
    }

    // Só formata se o tipo for fixo (dinheiro). Se for porcentagem, deixa normal.
    if (inputPixVal) {
        if (pixOptions.type === 'percent') {
            inputPixVal.value = pixOptions.val;
        } else {
            inputPixVal.value = formatMoneyForInput(pixOptions.val);
        }
    }
    if (inputPixType) inputPixType.value = pixOptions.type;

    // Atualiza visual dos botões % / R$
    const btnPercent = getEl('btn-pix-percent');
    const btnFixed = getEl('btn-pix-fixed');
    if (btnPercent && btnFixed) {
        if (pixOptions.type === 'fixed') {
            btnFixed.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition";
            btnPercent.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition";
        } else {
            btnPercent.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition";
            btnFixed.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition";
        }
    }

    // Exibe Modal
    if (els.productFormModal) els.productFormModal.classList.remove('hidden');
};

window.deleteCoupon = async (id) => {
    if (!confirm('Excluir cupom?')) return;

    try {
        await deleteDoc(doc(db, `sites/${state.siteId}/coupons`, id));

        // CORREÇÃO DO ERRO:
        // Se o cupom excluído for o que está sendo editado agora, limpa o formulário
        if (state.editingCouponId === id) {
            resetCouponForm();
            showToast('Cupom excluído e edição cancelada.', 'info');
        } else {
            showToast('Cupom excluído!');
        }

    } catch (error) {
        console.error(error);
        alert("Erro ao excluir: " + error.message);
    }
};

window.filterByCat = (catName) => {
    // 1. Atualiza Título e Select Visual
    if (els.pageTitle) els.pageTitle.innerText = catName ? catName : 'Vitrine';
    if (els.catFilter) els.catFilter.value = catName;

    // 2. Lógica de Filtragem (Hierárquica)
    // Se não tiver categoria (clicou em "Todos"), mostra tudo.
    if (!catName) {
        renderCatalog(state.products);
    } else {
        const term = catName.toLowerCase();

        const filtered = state.products.filter(p => {
            if (!p.category) return false;
            const prodCat = p.category.toLowerCase();

            // CASO 1: É a categoria exata (Ex: clicou em "Camisas", produto é "Camisas")
            const isExact = prodCat === term;

            // CASO 2: É uma categoria Pai (Ex: clicou em "Roupas", produto é "Roupas - Camisas")
            // O " - " garante que "Camisa" não pegue "Camisete" por engano, apenas subníveis reais.
            const isParent = prodCat.startsWith(term + ' -');

            return isExact || isParent;
        });

        renderCatalog(filtered);
    }

    // 3. Rola para o topo da grade
    if (els.grid) els.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 4. FECHA O MENU LATERAL (MOBILE)
    // Verifica se estamos no celular e se o menu está aberto
    if (window.innerWidth < 1024) { // 1024px é o padrão lg do Tailwind, ou use 768 para md
        const sidebar = getEl('sidebar');
        const overlay = getEl('sidebar-overlay');

        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full'); // Fecha sidebar
            if (overlay) overlay.classList.add('hidden'); // Esconde fundo escuro
        }
    }
};

window.toggleSidebar = () => {
    const isOpen = !els.sidebar.classList.contains('-translate-x-full');
    if (isOpen) { els.sidebar.classList.add('-translate-x-full'); els.sidebarOverlay.classList.add('hidden'); }
    else { els.sidebar.classList.remove('-translate-x-full'); els.sidebarOverlay.classList.remove('hidden'); }
};

window.toggleProductSelection = (id) => {
    if (state.selectedProducts.has(id)) {
        state.selectedProducts.delete(id);
    } else {
        state.selectedProducts.add(id);
    }

    // Como você excluiu o updateBulkActionBar, chamamos a renderização geral
    // Isso vai fazer a barra aparecer/sumir automaticamente
    filterAndRenderProducts();
};

window.shareStoreLink = () => {
    const url = window.location.href;
    const text = `Confira nossa loja: ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');

    // Se não for admin, conta como share
    if (!auth.currentUser) {
        logDailyStat('shares');
    }
};

// =================================================================
// 10. CARRINHO (Lógica Interna)
// =================================================================

function addToCart(product, size) {
    const allowNegative = state.globalSettings.allowNoStock || product.allowNoStock;

    // 1. Calcula o TOTAL deste produto no carrinho (somando todos os tamanhos: P + M + G...)
    const currentTotalQty = state.cart.reduce((total, item) => {
        return item.id === product.id ? total + item.qty : total;
    }, 0);

    // 2. Valida Estoque Geral
    if (!allowNegative && product.stock <= 0) {
        alert('Este produto está esgotado.');
        return;
    }

    // 3. Valida se adicionar +1 vai estourar o estoque total
    if (!allowNegative && (currentTotalQty + 1 > product.stock)) {
        alert(`Limite de estoque atingido! Você já tem ${currentTotalQty} unidades deste produto (soma de tamanhos) e o estoque total é ${product.stock}.`);
        return;
    }

    const existing = state.cart.find(i => i.id === product.id && i.size === size);

    if (existing) {
        existing.qty++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.promoPrice || product.price),
            cost: parseFloat(product.cost || 0),
            size: size,
            qty: 1,
            code: product.code || '00000'
        });
    }
    saveCart();

    // Efeito visual no botão do carrinho
    const btn = getEl('cart-btn');
    if (btn) {
        btn.classList.add('text-yellow-500');
        setTimeout(() => btn.classList.remove('text-yellow-500'), 200);
    }
}

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
    renderCatalog(state.products);
}

// Substitua a função updateCartUI inteira por esta:
function updateCartUI() {
    const cartEl = els.cartItems;
    const totalEl = getEl('cart-total');

    // 1. Atualiza contadores
    const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
    if (els.cartCount) els.cartCount.innerText = totalQty;
    if (els.cartCountMobile) els.cartCountMobile.innerText = totalQty;

    if (!cartEl) return;
    cartEl.innerHTML = '';

    // Se vazio
    if (state.cart.length === 0) {
        cartEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-gray-500">
                <i class="fas fa-shopping-basket text-5xl mb-4 opacity-20"></i>
                <p class="text-sm">Seu carrinho está vazio.</p>
            </div>`;
        if (totalEl) totalEl.innerText = formatCurrency(0);
        state.currentCoupon = null;
        return;
    }

    // 2. Calcula Subtotal
    let subtotal = 0;
    state.cart.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        const imgUrl = (item.image && item.image.length > 10) ? item.image : 'https://placehold.co/100?text=Foto';

        const li = document.createElement('div');
        li.className = "flex justify-between items-center bg-[#151720] p-3 rounded-xl mb-3 border border-gray-800 shadow-sm relative group";
        li.innerHTML = `
            <div class="flex items-center gap-3 flex-1">
                <img src="${imgUrl}" class="w-14 h-14 rounded-lg object-cover border border-gray-700 bg-black">
                <div class="flex flex-col">
                    <h4 class="text-white text-sm font-bold line-clamp-1 mr-2">${item.name}</h4>
                    <div class="flex items-center gap-2 mt-1">
                        ${item.size !== 'U' ? `<span class="text-[10px] bg-gray-800 border border-gray-600 px-1.5 rounded text-gray-300">${item.size}</span>` : ''}
                        <span class="text-green-400 text-xs font-bold">${formatCurrency(item.price)}</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end gap-2">
                <button onclick="changeQty(${index}, -${item.qty})" class="text-gray-600 hover:text-red-500 transition absolute top-2 right-2 p-1"><i class="fas fa-times text-xs"></i></button>
                <div class="flex items-center bg-black rounded-lg border border-gray-700 mt-4">
                    <button onclick="changeQty(${index}, -1)" class="w-7 h-7 text-gray-400 hover:text-white flex items-center justify-center transition hover:bg-gray-800 rounded-l">-</button>
                    <span class="text-xs text-white w-6 text-center font-mono">${item.qty}</span>
                    <button onclick="changeQty(${index}, 1)" class="w-7 h-7 text-gray-400 hover:text-white flex items-center justify-center transition hover:bg-gray-800 rounded-r">+</button>
                </div>
            </div>`;
        cartEl.appendChild(li);
    });

    // 3. Desconto
    let discount = 0;
    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') discount = subtotal * (state.currentCoupon.val / 100);
        else discount = state.currentCoupon.val;
        if (discount > subtotal) discount = subtotal;
    }

    // 4. Total Final (SEM FRETE AQUI)
    const total = subtotal - discount;

    // 5. Renderiza Resumo
    const summaryDiv = document.createElement('div');
    summaryDiv.className = "mt-6 pt-4 border-t border-dashed border-gray-700 space-y-4";

    let couponHTML = state.currentCoupon ?
        `<div class="bg-green-900/10 border border-green-500/30 p-3 rounded-lg flex justify-between items-center animate-fade-in">
            <div class="flex items-center gap-3"><div class="bg-green-500/20 w-8 h-8 rounded-full flex items-center justify-center text-green-500"><i class="fas fa-ticket-alt text-xs"></i></div>
            <div><p class="text-green-500 text-xs font-bold uppercase tracking-wider">${state.currentCoupon.code}</p><p class="text-green-400 text-[10px]">Desconto aplicado</p></div></div>
            <button onclick="removeCoupon()" class="text-gray-500 hover:text-red-500 transition w-8 h-8 flex items-center justify-center"><i class="fas fa-trash-alt text-xs"></i></button>
        </div>` :
        `<div class="relative flex gap-2">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><i class="fas fa-tag text-xs"></i></div>
            <input type="text" id="cart-coupon-input-dynamic" placeholder="CUPOM DE DESCONTO" class="bg-[#0f111a] border border-gray-700 text-white text-xs rounded-lg pl-9 pr-3 h-10 flex-1 outline-none focus:border-yellow-500 uppercase transition font-bold tracking-wide" onkeydown="if(event.key === 'Enter') applyCouponDynamic()">
            <button onclick="applyCouponDynamic()" class="bg-gray-800 hover:bg-gray-700 text-white px-4 h-10 rounded-lg text-xs font-bold uppercase border border-gray-700 transition">Aplicar</button>
        </div>`;

    summaryDiv.innerHTML = `
        ${couponHTML}
        <div class="space-y-1 pt-2">
            <div class="flex justify-between text-gray-400 text-xs"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            ${state.currentCoupon ? `<div class="flex justify-between text-green-500 text-xs font-bold"><span>Desconto</span><span>- ${formatCurrency(discount)}</span></div>` : ''}
        </div>
        <div class="flex justify-between items-end pt-2 border-t border-gray-800">
            <span class="text-gray-300 text-sm font-bold">Total (Sem Frete)</span>
            <div class="text-right">
                <span class="text-yellow-500 text-2xl font-extrabold tracking-tight block leading-none" id="cart-total-display">${formatCurrency(total)}</span>
                ${state.storeProfile.installments?.active ? `<span class="text-[10px] text-gray-500">ou até ${state.storeProfile.installments.max}x</span>` : ''}
            </div>
        </div>
    `;
    cartEl.appendChild(summaryDiv);
    if (totalEl) totalEl.innerText = formatCurrency(total);
}
// --- FUNÇÕES DE CONTROLE DE CUPOM ---

window.applyCouponDynamic = async () => {
    const input = document.getElementById('cart-coupon-input-dynamic');
    if (!input || !input.value.trim()) return showToast('Digite um código.', 'error');

    const code = input.value.trim().toUpperCase();

    // 1. Procura na memória local primeiro (rápido)
    let coupon = state.coupons.find(c => c.code === code);

    // 2. Se não achar, busca no banco (caso tenha sido criado agora por outro admin)
    if (!coupon) {
        try {
            const q = query(collection(db, `sites/${state.siteId}/coupons`), where('code', '==', code));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            }
        } catch (e) { console.error(e); }
    }

    if (!coupon) {
        showToast('Cupom inválido.', 'error');
        input.classList.add('border-red-500', 'text-red-500');
        setTimeout(() => input.classList.remove('border-red-500', 'text-red-500'), 1000);
        return;
    }

    // 3. Valida Data
    if (coupon.expiryDate) {
        const expiry = new Date(coupon.expiryDate);
        if (new Date() > expiry) {
            showToast('Este cupom expirou.', 'error');
            return;
        }
    }

    // 4. Aplica
    state.currentCoupon = coupon;
    updateCartUI(); // Redesenha com a etiqueta verde
    showToast(`Cupom ${code} aplicado!`, 'success');
};

window.removeCoupon = () => {
    state.currentCoupon = null;
    updateCartUI(); // Redesenha com o input de volta
    showToast('Cupom removido.', 'info');
};


window.deleteCategory = async (id, name) => {
    // 1. VERIFICAÇÃO DE VÍNCULO (NOVO)
    // Filtra produtos que são desta categoria exata OU de subcategorias (ex: "Roupas" e "Roupas - Camisas")
    const linkedProducts = state.products.filter(p =>
        p.category === name || (p.category && p.category.startsWith(name + ' -'))
    );

    // Se encontrar produtos, bloqueia e avisa
    if (linkedProducts.length > 0) {
        alert(`❌ AÇÃO BLOQUEADA\n\nNão é possível excluir a categoria "${name}".\n\nExistem ${linkedProducts.length} produto(s) vinculados a ela.\nPor favor, mova ou exclua esses produtos antes de apagar a categoria.`);
        return; // Interrompe a função aqui
    }

    // 2. Confirmação padrão
    if (!confirm(`Tem certeza que deseja excluir a categoria "${name}"?`)) return;

    try {
        await deleteDoc(doc(db, `sites/${state.siteId}/categories`, id));

        // Limpa seleção se for a categoria atual
        if (state.selectedCategoryParent === name) {
            state.selectedCategoryParent = null;
            if (els.newCatName) els.newCatName.placeholder = "Nome da Categoria Principal...";
        }

        alert('Categoria excluída com sucesso!');
    } catch (error) {
        console.error(error);
        alert('Erro ao excluir: ' + error.message);
    }
};

window.editCoupon = (id) => {
    const c = state.coupons.find(x => x.id === id);
    if (!c) return;

    getEl('coupon-code').value = c.code;
    getEl('coupon-val').value = c.val;
    getEl('coupon-is-percent').checked = (c.type === 'percent');

    if (c.expiryDate) {
        const d = new Date(c.expiryDate);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        getEl('coupon-expiry').value = d.toISOString().slice(0, 16);
    } else {
        getEl('coupon-expiry').value = '';
    }

    state.editingCouponId = id;

    const btn = getEl('btn-add-coupon');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-save mr-2"></i> SALVAR';
        btn.classList.replace('bg-green-600', 'bg-blue-600');
        btn.classList.replace('hover:bg-green-700', 'hover:bg-blue-700');
    }

    getEl('coupon-code').focus();
    // Mensagem discreta
    showToast(`Editando: ${c.code}`, 'info');
    state.editingCouponId = id;
};

window.resetCouponForm = () => {
    // Limpa os campos
    getEl('coupon-code').value = '';
    getEl('coupon-val').value = '';
    getEl('coupon-expiry').value = '';

    // Reseta o ID de edição para NULL (Isso é o mais importante para evitar o erro)
    state.editingCouponId = null;

    // Volta o botão para o visual "Adicionar" (Verde)
    const btn = getEl('btn-add-coupon');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-plus"></i>';
        btn.classList.replace('bg-blue-600', 'bg-green-600');
        btn.classList.replace('hover:bg-blue-700', 'hover:bg-green-700');
    }
};

// Função global para lidar com o clique de seleção
window.selectCoupon = (index) => {
    state.focusedCouponIndex = index;
    renderAdminCoupons();
};

// --- PERFIL DA LOJA ---

function loadStoreProfile() {
    const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            state.storeProfile = docSnap.data();
        } else {
            // Define padrão se não existir
            state.storeProfile = { installments: { active: false } };
        }

        renderStoreProfile(); // Atualiza Sidebar
        fillProfileForm();    // Atualiza Inputs do Admin

        // --- ADIÇÃO CRÍTICA: ---
        // Força a vitrine a se redesenhar com as novas regras de parcelamento
        renderCatalog(state.products);
    });
}

function renderStoreProfile() {
    const p = state.storeProfile;

    // 1. Sidebar
    if (els.sidebarStoreName) els.sidebarStoreName.innerText = p.name || 'Veste Manto';
    if (els.sidebarStoreDesc) els.sidebarStoreDesc.innerText = p.description || '';

    // Logo
    if (els.sidebarStoreLogo) {
        if (p.logo) {
            els.sidebarStoreLogo.src = p.logo;
            els.sidebarStoreLogo.classList.remove('hidden');
        } else {
            els.sidebarStoreLogo.classList.add('hidden');
        }
    }

    // Redes Sociais
    const updateLink = (el, val, prefix = '') => {
        if (!el) return;
        if (val) {
            el.href = val.startsWith('http') ? val : prefix + val;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    };

    updateLink(els.linkWhatsapp, p.whatsapp, 'https://wa.me/');
    updateLink(els.linkInstagram, p.instagram, 'https://instagram.com/');
    updateLink(els.linkFacebook, p.facebook);

    // Endereço (Botão com Alert ou Modal Simples)
    if (els.btnShowAddress) {
        if (p.address) {
            els.btnShowAddress.classList.remove('hidden');
            els.btnShowAddress.onclick = () => alert(`📍 Endereço da Loja:\n\n${p.address}`);
        } else {
            els.btnShowAddress.classList.add('hidden');
        }
    }
}

// Função para carregar dados nos inputs de configuração
function fillProfileForm() {
    // Garante que existe um objeto
    const p = state.storeProfile || {};

    // --- Parte antiga (Nome, Logo, etc...) ---
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('conf-store-name', p.name);
    setVal('conf-store-logo', p.logo);
    setVal('conf-store-wpp', p.whatsapp);
    setVal('conf-store-insta', p.instagram);
    setVal('conf-store-face', p.facebook);
    setVal('conf-store-address', p.address);
    setVal('conf-store-desc', p.description);
    setVal('conf-store-cep', p.cep);
    setVal('conf-max-dist', p.maxDistance);

    // --- Parcelamento ---
    const inst = p.installments || { active: false, max: 12, freeUntil: 3, rate: 4.0 };
    const elCardCheck = document.getElementById('conf-card-active');
    const elCardDetails = document.getElementById('conf-card-details');

    if (elCardCheck) elCardCheck.checked = (inst.active === true);
    if (elCardDetails) {
        if (inst.active) elCardDetails.classList.remove('opacity-50', 'pointer-events-none');
        else elCardDetails.classList.add('opacity-50', 'pointer-events-none');
    }
    setVal('conf-card-max', inst.max);
    setVal('conf-card-free', inst.freeUntil);
    setVal('conf-card-rate', inst.rate);

    // --- CORREÇÃO AQUI: CONFIGURAÇÕES DE PEDIDO (ENTREGA/TEMPO) ---
    const dConfig = p.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5 };

    const elOwn = document.getElementById('conf-own-delivery');
    const elReq = document.getElementById('conf-req-code');
    const elTime = document.getElementById('conf-cancel-time');

    // 1. Aplica os valores (Checked/Value)
    if (elOwn) elOwn.checked = (dConfig.ownDelivery === true);
    if (elReq) elReq.checked = (dConfig.reqCustomerCode === true);

    // CORREÇÃO DO TEMPO: Garante que se for 0 ou null, use 5
    if (elTime) elTime.value = dConfig.cancelTimeMin || 5;

    // 2. CORREÇÃO DO TRAVAMENTO: Aplica o estado visual imediatamente
    if (elOwn && elReq) {
        const parentLabel = elReq.closest('label');

        if (dConfig.ownDelivery === true) {
            elReq.disabled = false;
            if (parentLabel) parentLabel.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            elReq.disabled = true;
            if (parentLabel) parentLabel.classList.add('opacity-50', 'pointer-events-none');
        }
    }

    // --- NOVO: Carregar Configuração de Frete ---
    const elShipRule = document.getElementById('conf-shipping-rule');
    const elShipVal = document.getElementById('conf-shipping-value');
    const elShipCont = document.getElementById('shipping-value-container');

    if (elShipRule) {
        // Carrega regra salva ou padrão 'none'
        elShipRule.value = dConfig.shippingRule || 'none';

        // Compatibilidade com versão anterior (se shippingActive era true)
        if (!dConfig.shippingRule && dConfig.shippingActive === true) {
            elShipRule.value = 'both';
        }

        // Controle visual (Opacidade)
        if (elShipRule.value !== 'none') {
            if (elShipCont) elShipCont.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            if (elShipCont) elShipCont.classList.add('opacity-50', 'pointer-events-none');
        }

        // Listener para mudar visual em tempo real (sem precisar salvar)
        elShipRule.onchange = (e) => {
            if (e.target.value !== 'none') {
                if (elShipCont) elShipCont.classList.remove('opacity-50', 'pointer-events-none');
            } else {
                if (elShipCont) elShipCont.classList.add('opacity-50', 'pointer-events-none');
            }
            autoSaveSettings('orders'); // Salva ao mudar
        };
    }

    if (elShipVal) {
        // Formata o valor carregado do banco
        elShipVal.value = formatMoneyForInput(dConfig.shippingValue || 0);
        // Salva ao sair do campo
        elShipVal.onblur = () => autoSaveSettings('orders');
    }

    // --- CARREGAR FORMAS DE PAGAMENTO (NOVO) ---
    // Estrutura padrão: tudo ativado se não existir config
    const payConfig = p.paymentMethods || {
        online: { active: true, pix: true, card: true },
        delivery: { active: true, pix: true, card: true, cash: true }
    };

    const setCheck = (id, val) => {
        const el = document.getElementById(id);
        // Se val for undefined, assume true. Se for false, é false.
        if (el) el.checked = (val !== false);
    };

    // ATENÇÃO AQUI: Carrega os botões mestres
    setCheck('conf-pay-online-active', payConfig.online?.active);
    setCheck('conf-pay-delivery-active', payConfig.delivery?.active);

    // Carrega os sub-itens
    setCheck('conf-pay-online-pix', payConfig.online?.pix);
    setCheck('conf-pay-online-card', payConfig.online?.card);
    setCheck('conf-pay-delivery-pix', payConfig.delivery?.pix);
    setCheck('conf-pay-delivery-card', payConfig.delivery?.card);
    setCheck('conf-pay-delivery-cash', payConfig.delivery?.cash);

    // Atualiza a opacidade visual
    const groupOnline = document.getElementById('group-online-methods');
    const groupDelivery = document.getElementById('group-delivery-methods');

    if (groupOnline) {
        groupOnline.className = (payConfig.online?.active !== false) ? "space-y-3 opacity-100" : "space-y-3 opacity-30 pointer-events-none";
    }
    if (groupDelivery) {
        groupDelivery.className = (payConfig.delivery?.active !== false) ? "space-y-3 opacity-100" : "space-y-3 opacity-30 pointer-events-none";
    }

}

// Função para salvar no Firebase
async function saveStoreProfile() {
    // Helper para pegar valor de texto com segurança
    const getVal = (el) => el ? el.value.trim() : '';

    // Helper ESPECÍFICO para Checkbox (O segredo está aqui)
    const getCheck = (el) => el ? el.checked : false;

    // Monta o objeto com os dados
    const data = {
        name: getVal(els.confStoreName),
        logo: getVal(els.confStoreLogo),
        whatsapp: getVal(els.confStoreWpp).replace(/\D/g, ''),
        instagram: getVal(els.confStoreInsta),
        facebook: getVal(els.confStoreFace),
        address: getVal(els.confStoreAddress),
        description: getVal(els.confStoreDesc),

        // CORREÇÃO DO CEP: Salvando string limpa
        cep: getVal(els.confStoreCep).replace(/\D/g, ''),
        maxDistance: parseFloat(getVal(els.confMaxDist)) || 0,

        // CORREÇÃO DO PARCELAMENTO: Criando o objeto installments corretamente
        installments: {
            active: getCheck(els.confCardActive), // <--- AQUI ESTAVA O ERRO (Usar checked)
            max: parseInt(getVal(els.confCardMax)) || 12,
            freeUntil: parseInt(getVal(els.confCardFree)) || 3,
            rate: parseFloat(getVal(els.confCardRate).replace(',', '.')) || 0
        }
    };

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), data);

        // Atualiza a memória local imediatamente
        state.storeProfile = data;

        // Atualiza a vitrine para mostrar/esconder o parcelamento nos cards
        renderCatalog(state.products);

        showToast('Perfil salvo com sucesso!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar: ' + error.message, 'error');
    }
}

// --- FUNÇÃO DE AUTOSALVAMENTO (LOGÍSTICA E PARCELAMENTO) ---
async function autoSaveSettings(type) {
    console.log(`Autosalvando: ${type}...`);

    const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
    let dataToUpdate = {};
    let message = '';

    // 1. LOGÍSTICA (CEP e Raio)
    if (type === 'logistics') {
        const cep = document.getElementById('conf-store-cep').value.replace(/\D/g, '');
        const dist = parseFloat(document.getElementById('conf-max-dist').value) || 0;

        dataToUpdate = {
            cep: cep,
            maxDistance: dist
        };
        message = 'Logística salva!';
    }
    // 2. PARCELAMENTO
    else if (type === 'installments') {
        const active = document.getElementById('conf-card-active').checked;
        const max = parseInt(document.getElementById('conf-card-max').value) || 12;
        const free = parseInt(document.getElementById('conf-card-free').value) || 3;
        const rate = parseFloat(document.getElementById('conf-card-rate').value.replace(',', '.')) || 0;


        dataToUpdate = {
            installments: {
                active: active,
                max: max,
                freeUntil: free,
                rate: rate
            }
        };
        message = active ? 'Parcelamento salvo!' : 'Parcelamento desativado.';

        // Dados de Formas de Pagamento (NOVO)
        const payConfig = {
            online: {
                active: document.getElementById('conf-pay-online-active').checked, // NOVO
                pix: document.getElementById('conf-pay-online-pix').checked,
                card: document.getElementById('conf-pay-online-card').checked
            },
            delivery: {
                active: document.getElementById('conf-pay-delivery-active').checked, // NOVO
                pix: document.getElementById('conf-pay-delivery-pix').checked,
                card: document.getElementById('conf-pay-delivery-card').checked,
                cash: document.getElementById('conf-pay-delivery-cash').checked
            }
        };

        dataToUpdate = {
            installments: { active, max, freeUntil: free, rate },
            paymentMethods: payConfig
        };
    }
    // 3. PEDIDOS E FRETE (AQUI ESTAVA O PROBLEMA)
    if (type === 'orders') {
        const ownDelivery = document.getElementById('conf-own-delivery').checked;
        const reqCode = document.getElementById('conf-req-code').checked;
        const cancelTime = parseInt(document.getElementById('conf-cancel-time').value) || 5;

        // --- CAPTURA FRETE ---
        const shipRule = document.getElementById('conf-shipping-rule').value; // 'none', 'both', 'online', 'delivery'

        const shipValRaw = document.getElementById('conf-shipping-value').value;
        // LIMPEZA CRÍTICA: Remove "R$", espaços e pontos de milhar antes de converter
        const cleanVal = shipValRaw.replace(/[^\d,]/g, '');
        const shipVal = parseFloat(cleanVal.replace(',', '.')) || 0;

        dataToUpdate = {
            deliveryConfig: {
                ownDelivery: ownDelivery,
                reqCustomerCode: reqCode,
                cancelTimeMin: cancelTime,
                shippingRule: shipRule,   // Nova Regra
                shippingValue: shipVal    // Valor Limpo
            }
        };
        message = 'Regras de entrega salvas!';
    }

    // Grava no Firebase
    try {
        // Grava no Banco
        await setDoc(docRef, dataToUpdate, { merge: true });

        // --- CORREÇÃO DO ESTADO LOCAL ---
        // Atualiza a variável global state.storeProfile IMEDIATAMENTE
        if (state.storeProfile) {
            if (dataToUpdate.paymentMethods) {
                state.storeProfile.paymentMethods = dataToUpdate.paymentMethods;
            }
            if (dataToUpdate.deliveryConfig) {
                state.storeProfile.deliveryConfig = { ...state.storeProfile.deliveryConfig, ...dataToUpdate.deliveryConfig };
            }
            if (dataToUpdate.installments) {
                state.storeProfile.installments = { ...state.storeProfile.installments, ...dataToUpdate.installments };
            }
            if (dataToUpdate.cep) state.storeProfile.cep = dataToUpdate.cep;
            if (dataToUpdate.maxDistance) state.storeProfile.maxDistance = dataToUpdate.maxDistance;
        }

        renderCatalog(state.products);
        if (typeof updateCartUI === 'function') updateCartUI();

        showToast(message, 'success');

    } catch (error) {
        console.error("Erro no autosave:", error);
        showToast('Erro ao salvar.', 'error');
    }
}

// =================================================================
// 11. CHECKOUT, GEOLOCALIZAÇÃO E PAGAMENTO (NOVO)
// =================================================================

let checkoutState = {
    address: null,
    distance: 0,
    isValidDelivery: false
};

window.openCheckoutModal = () => {
    // 1. Limpa campos anteriores
    ['checkout-cep', 'checkout-number', 'checkout-comp'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    ['address-details', 'delivery-error'].forEach(id => {
        const el = document.getElementById(id); if (el) el.classList.add('hidden');
    });

    // 2. RECUPERA CONFIGURAÇÕES (Com Defaults Seguros)
    // Se active for undefined, assume true (ativado)
    const pm = state.storeProfile.paymentMethods || {};

    // --- CORREÇÃO AQUI: FORÇAR BOOLEANO ---
    // Verifica explicitamente se é false. Se for undefined ou true, considera ativo.
    const onlineActive = pm.online?.active !== false;
    const deliveryActive = pm.delivery?.active !== false;

    // Compatibilidade com logística antiga (opcional, mas vamos priorizar o botão financeiro)
    // Se quiser que o botão financeiro seja SOBERANO, ignore o oldOwnDelivery.
    // Vou manter apenas para garantir que não quebre lojas antigas, mas a prioridade é o novo botão.
    const logisticsActive = state.storeProfile.deliveryConfig?.ownDelivery !== false;

    // 3. REFERÊNCIAS AOS ELEMENTOS
    const containerDelivery = document.getElementById('container-delivery-option'); // Div do Pagar na Entrega
    const labelOnline = document.getElementById('label-pay-online'); // Div do Pagar Online

    const radioOnline = document.querySelector('input[name="pay-mode"][value="online"]');
    const radioDelivery = document.querySelector('input[name="pay-mode"][value="delivery"]');

    console.log("Status Online:", onlineActive);
    console.log("Status Entrega (Fin):", deliveryActive);
    console.log("Status Entrega (Log):", logisticsActive);

    // --- A. VISIBILIDADE ONLINE ---
    if (!onlineActive) {
        if (labelOnline) {
            labelOnline.classList.add('hidden');
            labelOnline.style.setProperty('display', 'none', 'important'); // Força ocultar
        }
    } else {
        if (labelOnline) {
            labelOnline.classList.remove('hidden');
            labelOnline.style.display = ''; // Volta ao padrão (flex)
        }
    }

    // --- B. VISIBILIDADE ENTREGA ---
    // AQUI ESTAVA O ERRO: A lógica deve ser restritiva.
    // Se o botão financeiro estiver OFF, some. Ponto final.
    // Se o botão financeiro estiver ON, mas a logística OFF, também some.

    const showDelivery = deliveryActive && logisticsActive;

    if (!showDelivery) {
        if (containerDelivery) {
            containerDelivery.classList.add('hidden');
            containerDelivery.style.setProperty('display', 'none', 'important');
        }
    } else {
        if (containerDelivery) {
            containerDelivery.classList.remove('hidden');
            containerDelivery.style.display = ''; // Volta ao padrão (block)
        }
    }

    // --- C. AUTO-SELEÇÃO DO RADIO (Para não ficar nenhum marcado) ---

    // Se o Online está ativo, marcamos ele por padrão
    if (onlineActive) {
        if (radioOnline) radioOnline.checked = true;
    }
    // Se o Online está OFF, mas Entrega está ON, marcamos a Entrega
    else if (showDelivery) {
        if (radioDelivery) radioDelivery.checked = true;
    }

    // 4. Atualiza Interface Interna
    if (typeof window.togglePaymentMode === 'function') window.togglePaymentMode();
    if (typeof window.calcCheckoutTotal === 'function') window.calcCheckoutTotal();

    // 5. NAVEGAÇÃO
    const viewCart = document.getElementById('view-cart-list');
    const viewCheckout = document.getElementById('view-checkout');

    if (viewCart) viewCart.classList.add('hidden');
    if (viewCheckout) viewCheckout.classList.remove('hidden');

    const cartTitle = document.getElementById('cart-modal-title');
    if (cartTitle) cartTitle.innerText = "FINALIZAR PEDIDO";

    document.getElementById('btn-modal-back')?.classList.remove('hidden');
    document.getElementById('btn-go-checkout')?.classList.add('hidden');

    const btnFinish = document.getElementById('btn-finish-payment');
    if (btnFinish) {
        btnFinish.classList.remove('hidden');
        btnFinish.disabled = true;
    }
};

window.closeCheckoutModal = () => {
    els.checkoutModal.classList.add('hidden');
    els.checkoutModal.classList.remove('flex');
};

// --- LÓGICA DE CEP E DISTÂNCIA ---
window.handleCheckoutCep = async () => {
    const cepInput = document.getElementById('checkout-cep');
    if (!cepInput) return;

    const cep = cepInput.value.replace(/\D/g, '');

    // Elementos da UI
    const elDistDisplay = document.getElementById('distance-display');
    const elErrorMsg = document.getElementById('delivery-error-msg');
    const elErrorDiv = document.getElementById('delivery-error');
    const elAddrFields = document.getElementById('address-fields');
    const elLoading = document.getElementById('cep-loading');
    const btnFinish = document.getElementById('btn-finish-payment');

    if (cep.length !== 8) return;

    // Reset visual inicial
    if (elLoading) elLoading.classList.remove('hidden');
    if (elErrorDiv) elErrorDiv.classList.add('hidden');
    if (elDistDisplay) elDistDisplay.classList.add('hidden');

    // Reseta estado de entrega
    checkoutState.isValidDelivery = false;

    try {
        // 1. Busca Endereço (ViaCEP)
        const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await resp.json();

        if (data.erro) throw new Error("CEP não encontrado.");

        // Preenche campos
        if (document.getElementById('checkout-street')) document.getElementById('checkout-street').value = data.logradouro;
        if (document.getElementById('checkout-district')) document.getElementById('checkout-district').value = data.bairro;
        if (document.getElementById('checkout-city')) document.getElementById('checkout-city').value = `${data.localidade} - ${data.uf}`;

        // Libera campos de endereço
        if (elAddrFields) {
            elAddrFields.classList.remove('opacity-50', 'pointer-events-none');
        }

        // Foca no número
        const numInput = document.getElementById('checkout-number');
        if (numInput) numInput.focus();

        // 2. VALIDAÇÃO DE DISTÂNCIA E FRETE
        const config = state.storeProfile.deliveryConfig || {};
        const storeCep = state.storeProfile.cep ? state.storeProfile.cep.replace(/\D/g, '') : '';
        const maxDist = parseFloat(state.storeProfile.maxDistance) || 0;

        // Se tiver entrega própria configurada, calcula distância
        if (storeCep && maxDist > 0 && config.ownDelivery === true) {
            if (elDistDisplay) {
                elDistDisplay.innerText = "Calculando...";
                elDistDisplay.classList.remove('hidden', 'text-red-500', 'text-green-500');
            }

            try {
                const dist = await calculateDistanceByCEP(storeCep, cep);

                if (dist !== null) {
                    if (elDistDisplay) {
                        elDistDisplay.innerText = `${dist.toFixed(1)} km`;
                        elDistDisplay.classList.remove('hidden');

                        if (dist > maxDist) {
                            elDistDisplay.classList.add('text-red-500');
                            throw new Error(`Muito longe (${dist.toFixed(1)}km). Raio máx: ${maxDist}km`);
                        } else {
                            elDistDisplay.classList.add('text-green-500');
                        }
                    }
                }
            } catch (eDist) {
                if (eDist.message.includes('Muito longe')) throw eDist;
                // Se der erro de API mas não for distância, deixamos passar (opcional)
                console.warn("Erro cálculo distância (ignorado):", eDist);
            }
        }

        // SE CHEGOU AQUI, O ENDEREÇO/ENTREGA É VÁLIDO
        checkoutState.isValidDelivery = true;

        if (btnFinish) {
            btnFinish.disabled = false;
            btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
        }

    } catch (err) {
        console.error("Erro CEP:", err);
        checkoutState.isValidDelivery = false; // Garante que frete não será cobrado

        if (elErrorMsg) elErrorMsg.innerText = err.message;
        if (elErrorDiv) elErrorDiv.classList.remove('hidden');
        if (btnFinish) btnFinish.disabled = true;

    } finally {
        if (elLoading) elLoading.classList.add('hidden');

        // --- CORREÇÃO DA ORDEM DE ATUALIZAÇÃO ---

        // 1º: Recria a lista de parcelas (Dropdown) JÁ COM O FRETE INCLUSO
        // Isso é crucial porque a função seguinte lê o valor de dentro desse dropdown
        if (typeof populateInstallments === 'function') {
            populateInstallments();
        }

        // 2º: Calcula o Total Final (Verde) e exibe o aviso "+ Frete"
        if (typeof calcCheckoutTotal === 'function') {
            calcCheckoutTotal();
        }
    }
};

async function calculateDistanceByCEP(cepOrigin, cepDest) {
    const getCoords = async (c) => {
        try {
            // Tenta buscar no Nominatim
            const url = `https://nominatim.openstreetmap.org/search?format=json&country=Brazil&postalcode=${c}&limit=1`;
            const r = await fetch(url, { headers: { 'User-Agent': 'VesteMantoApp/1.0' } });
            const d = await r.json();
            if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
            return null;
        } catch (e) {
            console.error("Erro API Mapa:", e);
            return null;
        }
    };

    const [c1, c2] = await Promise.all([getCoords(cepOrigin), getCoords(cepDest)]);

    if (!c1 || !c2) return null; // Retorna null se falhar a API

    return getDistanceFromLatLonInKm(c1.lat, c1.lon, c2.lat, c2.lon);
}


function enablePaymentSection() {
    els.paymentSection.classList.remove('hidden');
    setTimeout(() => {
        els.paymentSection.classList.remove('opacity-50', 'pointer-events-none');
        updateCheckoutTotal();
        els.btnFinishOrder.disabled = false;
    }, 100);
}


function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da terra
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}
function deg2rad(deg) { return deg * (Math.PI / 180); }

// --- LÓGICA DE PAGAMENTO ---

window.handlePaymentSelection = (method) => {
    // Exibe ou oculta área de parcelas
    if (method === 'card') {
        const instConfig = state.storeProfile.installments || { active: false };
        if (instConfig.active) {
            els.installmentsArea.classList.remove('hidden');
            populateInstallmentsSelect();
        } else {
            els.installmentsArea.classList.add('hidden');
        }
    } else {
        els.installmentsArea.classList.add('hidden');
    }
    updateCheckoutTotal();
};

function populateInstallments() {
    const instConfig = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3, rate: 0 };
    const select = document.getElementById('checkout-installments');

    if (!select) return;

    select.innerHTML = '';

    // 1. Calcula o Total Base (Produtos)
    let totalBase = 0;
    state.cart.forEach(i => totalBase += i.price * i.qty);

    // 2. Aplica Cupom
    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') {
            totalBase -= totalBase * (state.currentCoupon.val / 100);
        } else {
            totalBase -= state.currentCoupon.val;
        }
    }

    // --- 3. ADICIONA O FRETE AO CÁLCULO DAS PARCELAS ---
    // (Lógica idêntica ao calcCheckoutTotal para garantir consistência)
    const dConfig = state.storeProfile.deliveryConfig || {};
    const shipRule = dConfig.shippingRule || 'none';
    const shipValue = parseFloat(dConfig.shippingValue) || 0;
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value || 'online';

    // Só soma se CEP for válido e regra bater
    if (checkoutState.isValidDelivery && shipValue > 0) {
        if (shipRule === 'both') {
            totalBase += shipValue;
        }
        else if (shipRule === 'online' && payMode === 'online') {
            totalBase += shipValue;
        }
        else if (shipRule === 'delivery' && payMode === 'delivery') {
            totalBase += shipValue;
        }
    }
    // ----------------------------------------------------

    totalBase = Math.max(0, totalBase);

    // 4. Gera Opções
    const maxParcelas = (instConfig.active && totalBase > 0) ? instConfig.max : 1;

    for (let i = 1; i <= maxParcelas; i++) {
        let finalVal = totalBase;
        let valorParcela = totalBase / i;
        let label = `${i}x Sem Juros`;

        // Aplica Juros
        if (instConfig.active && i > instConfig.freeUntil && instConfig.rate > 0) {
            const taxa = instConfig.rate / 100;
            const fator = Math.pow(1 + taxa, i);
            valorParcela = totalBase * ((taxa * fator) / (fator - 1));
            finalVal = valorParcela * i;
            label = `${i}x (c/ juros)`;
        }

        const option = document.createElement('option');
        option.value = i;
        option.dataset.total = finalVal.toFixed(2);
        option.text = `${label} de ${formatCurrency(valorParcela)}`;
        select.appendChild(option);
    }
}

window.updateCheckoutTotal = () => {
    const methodEl = document.querySelector('input[name="payment-method"]:checked');
    if (!methodEl) return;
    const method = methodEl.value;

    let cartTotal = 0;
    state.cart.forEach(item => { cartTotal += item.price * item.qty; });

    let discountCoupon = 0;
    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') discountCoupon = cartTotal * (state.currentCoupon.val / 100);
        else discountCoupon = state.currentCoupon.val;
    }

    // Valor Inicial
    let finalTotal = Math.max(0, cartTotal - discountCoupon);

    // Reseta textos
    if (els.labelPixDiscount) els.labelPixDiscount.innerText = '';
    if (els.installmentObs) els.installmentObs.innerText = '';

    // --- CASO PIX (Desconto por Produto) ---
    if (method === 'pix') {
        let totalWithPixDiscount = 0;
        state.cart.forEach(item => {
            const product = state.products.find(p => p.id === item.id);
            let itemPrice = item.price;

            // Verifica desconto específico
            if (product && product.paymentOptions && product.paymentOptions.pix && product.paymentOptions.pix.active) {
                const pixConfig = product.paymentOptions.pix;
                let discountVal = 0;
                if (pixConfig.type === 'percent') discountVal = itemPrice * (pixConfig.val / 100);
                else discountVal = pixConfig.val;

                itemPrice = Math.max(0, itemPrice - discountVal);
            }
            totalWithPixDiscount += itemPrice * item.qty;
        });

        // Reaplica cupom sobre novo total
        let discountOnPix = 0;
        if (state.currentCoupon) {
            if (state.currentCoupon.type === 'percent') discountOnPix = totalWithPixDiscount * (state.currentCoupon.val / 100);
            else discountOnPix = state.currentCoupon.val;
        }

        const oldTotal = finalTotal;
        finalTotal = Math.max(0, totalWithPixDiscount - discountOnPix);

        const saved = oldTotal - finalTotal;
        if (saved > 0 && els.labelPixDiscount) {
            els.labelPixDiscount.innerText = `Economia de ${formatCurrency(saved)}`;
        }
    }
    // --- CASO CARTÃO (Juros) ---
    else if (method === 'card') {
        const select = els.checkoutInstallments;
        if (select && select.options.length > 0) {
            const selectedOption = select.options[select.selectedIndex];
            if (selectedOption && selectedOption.dataset.total) {
                finalTotal = parseFloat(selectedOption.dataset.total);
            }

            // Texto de Obs
            const instConfig = state.storeProfile.installments;
            const parcelas = parseInt(select.value);
            if (instConfig && parcelas >= instConfig.freeUntil) {
                if (els.installmentObs) els.installmentObs.innerText = `* Inclui juros de ${instConfig.rate}% a.m.`;
            }
        }
    }

    // Atualiza Display
    els.checkoutTotalDisplay.innerText = formatCurrency(finalTotal);

    // Atualiza Botão
    if (method === 'whatsapp') els.btnFinishOrder.innerText = 'Enviar Pedido no Zap';
    else if (method === 'pix') els.btnFinishOrder.innerText = 'Gerar Chave Pix';
    else els.btnFinishOrder.innerText = 'Gerar Link Cartão';
};



// --- ACCORDION CONFIGURAÇÕES DE PEDIDOS ---
const btnAccOrders = document.getElementById('btn-acc-orders');
const contentAccOrders = document.getElementById('content-acc-orders');
const arrowAccOrders = document.getElementById('arrow-acc-orders');

if (btnAccOrders && contentAccOrders && arrowAccOrders) {
    btnAccOrders.onclick = () => {
        contentAccOrders.classList.toggle('hidden');
        arrowAccOrders.style.transform = contentAccOrders.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    };
}

// --- NAVEGAÇÃO DO MODAL ---

// --- CORREÇÃO: ABRE APENAS O CARRINHO ---
function hideAllViews() {
    // Lista de todas as telas possíveis dentro do modal
    const views = [
        'view-cart-list',
        'view-checkout',
        'view-order-list',
        'view-order-status'
    ];

    // Percorre e esconde todas
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            // Remove flex caso tenha sido adicionado em algum momento
            el.classList.remove('flex');
        }
    });

    // Esconde botão de voltar
    const btnBack = document.getElementById('btn-modal-back');
    if (btnBack) btnBack.classList.add('hidden');
}

window.openCart = () => {
    const modal = document.getElementById('cart-modal');
    if (!modal) return;

    // Abre o Modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // OBRIGATÓRIO: Reseta a visualização para a lista de compras
    showCartListView();
};

window.closeCartModal = () => {
    const modal = document.getElementById('cart-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};

// Certifique-se que showCartListView também esconde as outras telas:
window.showCartListView = () => {
    // 1. FAXINA: Esconde todas as outras telas
    hideAllViews();

    // 2. MOSTRA O CARRINHO
    const viewCart = document.getElementById('view-cart-list');
    if (viewCart) viewCart.classList.remove('hidden');

    // 3. Reseta Textos e Botões
    const title = document.getElementById('cart-modal-title');
    if (title) title.innerText = "SEU CARRINHO";

    const footer = document.getElementById('cart-footer-actions');
    if (footer) footer.classList.remove('hidden');

    const btnGo = document.getElementById('btn-go-checkout');
    if (btnGo) btnGo.classList.remove('hidden'); // Mostra "Ir para Pagamento"

    const btnFinish = document.getElementById('btn-finish-payment');
    if (btnFinish) btnFinish.classList.add('hidden'); // Esconde "Confirmar"
};

window.goToCheckoutView = () => {
    if (state.cart.length === 0) return alert("Carrinho vazio!");

    hideAllViews();
    document.getElementById('view-checkout').classList.remove('hidden');

    document.getElementById('cart-modal-title').innerText = "PAGAMENTO";
    document.getElementById('cart-footer-actions').classList.remove('hidden');
    document.getElementById('btn-go-checkout').classList.add('hidden');
    document.getElementById('btn-finish-payment').classList.remove('hidden');

    // Inicia lógica de pagamento
    if (typeof togglePaymentMode === 'function') togglePaymentMode();
    if (typeof calcCheckoutTotal === 'function') calcCheckoutTotal();
};

// --- INTERATIVIDADE DO CHECKOUT ---
// Função auxiliar para formatar campo de troco (R$)
window.formatMoneyInput = (el) => {
    let v = el.value.replace(/\D/g, '');
    v = (v / 100).toFixed(2) + '';
    v = v.replace(".", ",");
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    el.value = 'R$ ' + v;
};

// 1. Controla o Modo Principal (Online vs Entrega)
window.togglePaymentMode = () => {
    const mode = document.querySelector('input[name="pay-mode"]:checked')?.value;
    const lblMethod = document.getElementById('lbl-payment-method');
    const optionsDiv = document.getElementById('checkout-payment-options');

    // Remove opacidade
    if (optionsDiv) optionsDiv.classList.remove('opacity-50', 'pointer-events-none');

    // Recupera Configurações (ou usa padrão tudo ativado)
    const payConfig = state.storeProfile.paymentMethods || {
        online: { pix: true, card: true },
        delivery: { pix: true, card: true, cash: true }
    };

    // Referências aos Labels (Pais dos Radios) para esconder/mostrar
    // Precisamos achar o elemento pai <label> que contem o input radio
    const getLabelByVal = (val) => document.querySelector(`input[name="payment-method-selection"][value="${val}"]`)?.closest('label');
    const containerCash = document.getElementById('container-cash-option'); // Div especial do dinheiro
    const divCardContainer = document.getElementById('card-installments-container')?.parentElement; // Div que envolve o label do cartão

    const lblPix = getLabelByVal('pix');
    const lblCard = divCardContainer?.querySelector('label') || getLabelByVal('card'); // O cartão tem estrutura diferente

    // Reset visual (mostra tudo antes de filtrar)
    if (lblPix) lblPix.classList.remove('hidden');
    if (lblCard) lblCard.parentElement.classList.remove('hidden'); // Esconde a div container do cartão
    if (containerCash) containerCash.classList.remove('hidden');


    // --- LÓGICA DE FILTRAGEM ---

    if (mode === 'delivery') {
        if (lblMethod) lblMethod.innerText = "Pagarei na entrega com:";

        // Filtra opções de ENTREGA
        if (!payConfig.delivery.pix && lblPix) lblPix.classList.add('hidden');
        if (!payConfig.delivery.card && lblCard) lblCard.parentElement.classList.add('hidden');
        if (!payConfig.delivery.cash && containerCash) containerCash.classList.add('hidden');

    } else {
        // ONLINE
        if (lblMethod) lblMethod.innerText = "Pagar agora com:";

        // Dinheiro nunca existe no online
        if (containerCash) containerCash.classList.add('hidden');

        // Filtra opções ONLINE
        if (!payConfig.online.pix && lblPix) lblPix.classList.add('hidden');
        if (!payConfig.online.card && lblCard) lblCard.parentElement.classList.add('hidden');
    }

    // --- SELEÇÃO AUTOMÁTICA (AUTO-CORREÇÃO) ---
    // Se a opção selecionada ficou oculta, seleciona a primeira visível
    const currentChecked = document.querySelector('input[name="payment-method-selection"]:checked');
    const currentLabel = currentChecked?.closest('label');
    const isHidden = currentLabel?.classList.contains('hidden') || currentLabel?.parentElement?.classList.contains('hidden');

    if (isHidden || !currentChecked) {
        // Tenta achar um visível para marcar
        const allRadios = document.querySelectorAll('input[name="payment-method-selection"]');
        for (let radio of allRadios) {
            const label = radio.closest('label');
            const parentHidden = label.parentElement.classList.contains('hidden'); // Caso do cartão/dinheiro em divs
            if (!label.classList.contains('hidden') && !parentHidden && !radio.disabled) {
                radio.checked = true;
                break;
            }
        }
    }

    // Chama o toggle secundário para ajustar parcelas/troco
    toggleMethodSelection();
};

// 2. Controla a Seleção Específica (Pix vs Cartão vs Dinheiro)
window.toggleMethodSelection = () => {
    // Verifica o Modo Principal (Online ou Entrega)
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value;
    // Verifica o Método Específico (Pix, Cartão, Dinheiro)
    const method = document.querySelector('input[name="payment-method-selection"]:checked')?.value;

    const cardContainer = document.getElementById('card-installments-container');
    const cashChangeContainer = document.getElementById('cash-change-container');

    // 1. Reseta visibilidades (Esconde tudo primeiro)
    if (cardContainer) cardContainer.classList.add('hidden');
    if (cashChangeContainer) cashChangeContainer.classList.add('hidden');

    // 2. Lógica para CARTÃO
    if (method === 'card') {
        // SÓ mostra parcelas se for pagamento ONLINE
        if (payMode === 'online') {
            if (cardContainer) cardContainer.classList.remove('hidden');
            populateInstallments(); // Gera as parcelas
        }
        // Se for ENTREGA, mantém o container hidden (apenas o radio fica marcado)
    }
    // 3. Lógica para DINHEIRO
    else if (method === 'cash') {
        if (cashChangeContainer) cashChangeContainer.classList.remove('hidden');
        setTimeout(() => {
            const inputTroco = document.getElementById('checkout-change-for');
            if (inputTroco) inputTroco.focus();
        }, 100);
    }

    // Recalcula totais
    calcCheckoutTotal();
};



// --- FUNÇÃO ÚNICA: CALCULAR TOTAL DO CHECKOUT ---
window.calcCheckoutTotal = () => {
    // 1. Configurações e Estado
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value || 'online';
    const method = document.querySelector('input[name="payment-method-selection"]:checked')?.value || 'pix';

    const dConfig = state.storeProfile.deliveryConfig || {};
    const shipRule = dConfig.shippingRule || 'none';
    const shipValue = parseFloat(dConfig.shippingValue) || 0;

    let finalTotal = 0;
    let savingsMsg = '';
    let appliedShipping = 0; // Valor do frete que será aplicado

    // --- LÓGICA DE APLICAÇÃO DO FRETE ---
    // Só calcula se CEP for válido
    if (checkoutState.isValidDelivery && shipValue > 0) {
        if (shipRule === 'both') {
            appliedShipping = shipValue;
        }
        else if (shipRule === 'online' && payMode === 'online') {
            appliedShipping = shipValue;
        }
        else if (shipRule === 'delivery' && payMode === 'delivery') {
            appliedShipping = shipValue;
        }
    }

    // 2. Calcula Base (Itens - Cupom)
    let itemsTotal = 0;
    state.cart.forEach(item => itemsTotal += item.price * item.qty);

    let discountCoupon = 0;
    if (state.currentCoupon) {
        discountCoupon = state.currentCoupon.type === 'percent'
            ? itemsTotal * (state.currentCoupon.val / 100)
            : state.currentCoupon.val;
    }

    // Valor base dos produtos (sem frete ainda)
    let productsTotal = Math.max(0, itemsTotal - discountCoupon);

    // --- CÁLCULOS POR MÉTODO ---

    // A. PIX
    if (method === 'pix') {
        let totalWithPixDesc = 0;
        state.cart.forEach(item => {
            const prod = state.products.find(p => p.id === item.id);
            let price = item.price;
            if (prod && prod.paymentOptions?.pix?.active) {
                const descVal = prod.paymentOptions.pix.type === 'percent'
                    ? price * (prod.paymentOptions.pix.val / 100)
                    : prod.paymentOptions.pix.val;
                price = Math.max(0, price - descVal);
            }
            totalWithPixDesc += price * item.qty;
        });

        let cupomPix = state.currentCoupon?.type === 'percent'
            ? totalWithPixDesc * (state.currentCoupon.val / 100)
            : discountCoupon;

        // Base Pix (Produtos com desconto Pix)
        productsTotal = Math.max(0, totalWithPixDesc - cupomPix);

        // No Pix, somamos o frete manualmente no final
        finalTotal = productsTotal + appliedShipping;

        const baseWithoutPix = Math.max(0, itemsTotal - discountCoupon);
        const saved = baseWithoutPix - productsTotal;
        if (saved > 0.01) savingsMsg = `Economia de ${formatCurrency(saved)} no Pix!`;
    }

    // B. CARTÃO (ONLINE)
    else if (method === 'card' && payMode === 'online') {
        const select = document.getElementById('checkout-installments');

        // Se tem opção selecionada no dropdown, ela JÁ CONTÉM O FRETE (calculado no populateInstallments)
        if (select && select.options.length > 0) {
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.total) {
                // CORREÇÃO: Não soma appliedShipping aqui, pois já está dentro do dataset.total
                finalTotal = parseFloat(selectedOpt.dataset.total);
            }
        } else {
            // Fallback caso não tenha select carregado
            finalTotal = productsTotal + appliedShipping;
        }
    }

    // C. QUALQUER OUTRO (Dinheiro, Pagar na Entrega, etc)
    else {
        finalTotal = productsTotal + appliedShipping;
    }

    // 4. ATUALIZA VISUAL
    const elTotal = document.getElementById('checkout-final-total');
    if (elTotal) elTotal.innerText = formatCurrency(finalTotal);

    // Aviso do Frete (Mostra/Esconde)
    let elShipDisplay = document.getElementById('checkout-shipping-display');
    if (!elShipDisplay) {
        const totalContainer = elTotal.parentElement;
        const shipDiv = document.createElement('div');
        shipDiv.id = 'checkout-shipping-display';
        shipDiv.className = "text-xs text-yellow-500 font-bold uppercase mr-4 bg-yellow-900/20 px-2 py-1 rounded border border-yellow-500/30";
        totalContainer.insertBefore(shipDiv, elTotal);
        elShipDisplay = shipDiv;
    }

    if (appliedShipping > 0) {
        elShipDisplay.innerText = `+ Frete: ${formatCurrency(appliedShipping)}`;
        elShipDisplay.classList.remove('hidden');
    } else {
        elShipDisplay.classList.add('hidden');
    }

    // Aviso do Pix
    const msgEl = document.getElementById('checkout-pix-discount-msg');
    if (msgEl) {
        msgEl.innerText = savingsMsg;
        if (savingsMsg) msgEl.classList.remove('hidden');
        else msgEl.classList.add('hidden');
    }
};


// Função para gerar número sequencial seguro
async function getNextOrderNumber(siteId) {
    const counterRef = doc(db, `sites/${siteId}/settings`, 'orderCounter');

    try {
        // Tenta pegar o contador atual
        const counterSnap = await getDoc(counterRef);

        let newCount;

        if (counterSnap.exists()) {
            // Se já existe, pega o atual e soma 1
            const current = counterSnap.data().current || 0;
            newCount = current + 1;
            await updateDoc(counterRef, { current: newCount });
        } else {
            // Se é o primeiro pedido da loja, começa do 1
            newCount = 1;
            await setDoc(counterRef, { current: newCount });
        }

        return newCount; // Retorna o número pronto para usar (ex: 1, 2, 3...)

    } catch (error) {
        console.error("Erro ao gerar sequencial:", error);
        // Fallback de segurança: se der erro no contador, gera aleatório para não travar a venda
        return Math.floor(10000 + Math.random() * 90000);
    }
}

// --- ENVIAR PEDIDO (ATUALIZADO COM TROCO) ---
// --- FUNÇÃO FINALIZAR PEDIDO (BLINDADA) ---
window.submitOrder = async () => {
    try {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

        const name = getVal('checkout-name');
        const phone = getVal('checkout-phone');
        const cep = getVal('checkout-cep');
        const street = getVal('checkout-street');
        const district = getVal('checkout-district');
        const number = getVal('checkout-number');
        const comp = getVal('checkout-comp');

        if (!name || !phone || !cep || !number || !street) {
            return alert("⚠️ Preencha todos os campos obrigatórios.");
        }

        const payModeEl = document.querySelector('input[name="pay-mode"]:checked');
        const methodEl = document.querySelector('input[name="payment-method-selection"]:checked');

        if (!payModeEl || !methodEl) {
            return alert("⚠️ Selecione a forma de pagamento.");
        }

        const payMode = payModeEl.value;
        const method = methodEl.value;

        // Monta texto do pagamento
        let paymentDetails = "";
        if (method === 'pix') paymentDetails = "Pix";
        else if (method === 'card') {
            const select = document.getElementById('checkout-installments');
            let parcelas = "Crédito/Débito";
            if (payMode === 'online' && select && select.selectedIndex >= 0) {
                parcelas = select.options[select.selectedIndex].text;
            }
            paymentDetails = `Cartão (${parcelas})`;
        }
        else if (method === 'cash') {
            const trocoVal = getVal('checkout-change-for');
            paymentDetails = `Dinheiro (Troco para: ${trocoVal || 'Não precisa'})`;
        }
        paymentDetails += (payMode === 'online') ? " [Pago Online]" : " [Pagar na Entrega]";

        // Valor Final
        const totalEl = document.getElementById('checkout-final-total');
        let finalValue = 0;
        if (totalEl) {
            finalValue = parseFloat(totalEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        }

        // --- CÁLCULO E SALVAMENTO DO CUPOM (NOVO) ---
        let couponData = null;
        if (state.currentCoupon) {
            // Calcula o valor exato que o cupom descontou
            let subtotal = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            let discountVal = 0;

            if (state.currentCoupon.type === 'percent') {
                discountVal = subtotal * (state.currentCoupon.val / 100);
            } else {
                discountVal = state.currentCoupon.val;
            }

            if (discountVal > subtotal) discountVal = subtotal;

            couponData = {
                code: state.currentCoupon.code,
                value: discountVal
            };
        }
        // --------------------------------------------

        const deliveryConfig = state.storeProfile?.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5 };
        const cancelMinutes = parseInt(deliveryConfig.cancelTimeMin) || 5;

        let securityCode = null;
        if (payMode === 'delivery' && deliveryConfig.reqCustomerCode === true) {
            securityCode = Math.floor(1000 + Math.random() * 9000);
        }

        const fullAddress = `${street}, ${number} ${comp ? '(' + comp + ')' : ''} - ${district} - CEP: ${cep}`;
        const nextCode = await getNextOrderNumber(state.siteId);

        // Frete
        const dConfig = state.storeProfile.deliveryConfig || {};
        const shipRule = dConfig.shippingRule || 'none';
        const shipValue = parseFloat(dConfig.shippingValue) || 0;

        let valueToSave = 0;
        if (checkoutState.isValidDelivery && shipValue > 0) {
            if (shipRule === 'both') valueToSave = shipValue;
            else if (shipRule === 'online' && payMode === 'online') valueToSave = shipValue;
            else if (shipRule === 'delivery' && payMode === 'delivery') valueToSave = shipValue;
        }

        // Cria o objeto do pedido
        const order = {
            code: nextCode,
            date: new Date().toISOString(),
            customer: {
                name, phone, address: fullAddress,
                addressNum: number, cep, district, street, comp: comp
            },
            items: state.cart || [],
            total: finalValue,
            status: 'Aguardando aprovação',
            paymentMethod: paymentDetails,
            securityCode: securityCode,
            shippingFee: valueToSave,

            // --- SALVA DADOS DO CUPOM ---
            couponData: couponData, // Objeto { code: 'NOME', value: 10.00 }
            cupom: couponData ? couponData.code : null, // Mantém compatibilidade simples

            cancelLimit: new Date(new Date().getTime() + cancelMinutes * 60000).toISOString()
        };

        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "⏳ Enviando...";
        }

        const docRef = await addDoc(collection(db, `sites/${state.siteId}/sales`), order);

        const newOrderLocal = { id: docRef.id, ...order };
        if (!Array.isArray(state.myOrders)) state.myOrders = [];
        state.myOrders.push(newOrderLocal);
        localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));

        startBackgroundListeners();
        checkActiveOrders();
        state.cart = [];
        state.currentCoupon = null; // Limpa cupom da memória
        localStorage.setItem('cart', JSON.stringify([]));
        updateCartUI();

        if (payMode === 'online') {
            sendOrderToWhatsapp(newOrderLocal);
        }

        openTrackModal();

    } catch (e) {
        console.error("Erro Submit:", e);
        alert("Erro ao enviar pedido: " + e.message);
    } finally {
        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerText = "Confirmar Pedido";
        }
    }
};

window.sendOrderToWhatsapp = (order) => {
    console.log("Gerando link do WhatsApp...");

    // 1. Cabeçalho
    let msg = `*NOVO PEDIDO - ${order.code}*\n`;
    msg += `Aguardo link de pagamento!\n\n`;

    // 2. Itens
    order.items.forEach(i => {
        msg += `📦 ${i.qty}x ${i.name} (${i.size}) - ${formatCurrency(i.price)}\n`;
    });

    // 3. Totais
    msg += `\n💰 *TOTAL: ${formatCurrency(order.total)}*`;

    // 4. Detalhes
    msg += `\n💳 Pagamento: ${order.paymentMethod}`;
    msg += `\n📍 Entrega: ${order.customer.addressNum}, ${order.customer.cep}`;
    msg += `\n👤 Cliente: ${order.customer.name}`;

    msg += `\n\nAguardo confirmação!`;

    // 5. Envio
    const sellerPhone = state.storeProfile.whatsapp || "";
    // Remove caracteres não numéricos do telefone para evitar erros no link
    const cleanPhone = sellerPhone.replace(/\D/g, '');

    if (cleanPhone) {
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
        alert("Número de WhatsApp da loja não configurado no Admin!");
    }
};



function getStepIcon(step) {
    return ["", "fa-clock", "fa-box-open", "fa-motorcycle", "fa-check"][step];
}

//Esta função configura o modal para exibir o status, inicia o "ouvinte" em tempo real do Firebase e ajusta a barra de progresso conforme seu design
window.showOrderStatusView = () => {
    // 1. Configura Visibilidade do Modal
    const modal = document.getElementById('cart-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('view-cart-list').classList.add('hidden');
    document.getElementById('view-checkout').classList.add('hidden');
    document.getElementById('view-order-status').classList.remove('hidden');

    document.getElementById('cart-modal-title').innerText = "STATUS DE PEDIDO";
    document.getElementById('cart-footer-actions').classList.add('hidden'); // Esconde botões de checkout

    // Ativa o indicador no ícone da navbar
    const indicator = document.getElementById('track-indicator');
    if (indicator) indicator.classList.remove('hidden');

    // 2. Inicia Listener em Tempo Real (Se já não tiver um rodando para esse ID)
    if (state.activeOrder && state.activeOrder.id) {
        // Cancela listener anterior se existir (boa prática)
        if (window.currentOrderListener) window.currentOrderListener();

        window.currentOrderListener = onSnapshot(doc(db, `sites/${state.siteId}/sales`, orderId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const fullOrder = { id: snap.id, ...data };

                updateStatusUI(fullOrder);

                // Atualiza array local
                const idx = state.myOrders.findIndex(o => o.id === orderId);
                if (idx > -1) {
                    state.myOrders[idx] = fullOrder;
                    localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));

                    // --- ADICIONE ISTO AQUI ---
                    // Verifica a bolinha toda vez que o status mudar em tempo real
                    checkActiveOrders();
                }
            }
        });
    }
};



// --- LÓGICA DE STATUS DE PEDIDOS (ADMIN) ---
// 1. Mudança via Dropdown (Select)
window.handleStatusChange = async (selectEl, orderId) => {
    const newStatus = selectEl.value;

    // REGRA: Se selecionar "Entregue", pergunta se quer finalizar
    if (newStatus === 'Entregue') {
        const confirmFinalize = confirm("O pedido foi entregue. Deseja marcar como FINALIZADO (Concluído)?\n\nOK = Sim, Finalizar.\nCancelar = Não, manter apenas como 'Entregue'.");

        if (confirmFinalize) {
            // Marca direto como Concluído
            await updateOrderStatusDB(orderId, 'Concluído');
        } else {
            // Marca apenas como Entregue
            await updateOrderStatusDB(orderId, 'Entregue');
        }
    } else {
        // Outros status (Aprovado, Preparando, etc) apenas atualizam
        await updateOrderStatusDB(orderId, newStatus);
    }
};

// 2. Botão Cancelar
window.adminCancelOrder = async (orderId) => {
    if (confirm("Tem certeza que deseja CANCELAR este pedido?")) {
        await updateOrderStatusDB(orderId, 'Cancelado');
    }
};

// 3. Botão Finalizado
window.adminFinalizeOrder = async (orderId) => {
    if (confirm("Confirmar finalização do pedido?\nIsso arquiva a venda como concluída.")) {
        await updateOrderStatusDB(orderId, 'Concluído');
    }
};

// 4. Botão Estornar (Reabrir pedido fechado)
window.adminRevertStatus = async (orderId) => {
    if (confirm("Deseja reabrir este pedido? Ele voltará para 'Aguardando aprovação'.")) {
        await updateOrderStatusDB(orderId, 'Aguardando aprovação');
    }
};

// Função auxiliar para atualizar no Firebase com BAIXA DE ESTOQUE AUTOMÁTICA
async function updateOrderStatusDB(orderId, newStatus) {
    try {
        const orderRef = doc(db, `sites/${state.siteId}/sales`, orderId);

        // 1. Busca o pedido ATUAL
        const docSnap = await getDoc(orderRef);
        if (!docSnap.exists()) return alert("Pedido não encontrado.");

        const currentOrder = docSnap.data();
        const oldStatus = currentOrder.status || 'Aguardando aprovação';

        // 2. CONFIGURAÇÃO DAS REGRAS
        const stockConsumingStatuses = [
            'Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'
        ];

        const wasConsuming = stockConsumingStatuses.includes(oldStatus);
        const isConsuming = stockConsumingStatuses.includes(newStatus);
        const items = currentOrder.items || [];

        // --- CENÁRIO A: BAIXA DE ESTOQUE (Entrou em status válido) ---
        if (!wasConsuming && isConsuming) {
            for (const item of items) {
                if (item.id) {
                    const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
                    const pSnap = await getDoc(prodRef);
                    if (pSnap.exists()) {
                        const currentStock = parseInt(pSnap.data().stock) || 0;
                        const qty = parseInt(item.qty) || 0;
                        let newStock = currentStock - qty;
                        if (newStock < 0) newStock = 0;
                        await updateDoc(prodRef, { stock: newStock });
                    }
                }
            }
            showToast(`Estoque baixado!`, 'success');
        }

        // --- CENÁRIO B: DEVOLUÇÃO DE ESTOQUE (Saiu de status válido) ---
        else if (wasConsuming && !isConsuming) {
            for (const item of items) {
                if (item.id) {
                    const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
                    const pSnap = await getDoc(prodRef);
                    if (pSnap.exists()) {
                        const currentStock = parseInt(pSnap.data().stock) || 0;
                        const qty = parseInt(item.qty) || 0;
                        await updateDoc(prodRef, { stock: currentStock + qty });
                    }
                }
            }
            showToast(`Estoque devolvido.`, 'info');
        }

        // 3. Atualiza o pedido
        const updateData = { status: newStatus };
        if (newStatus === 'Concluído' && oldStatus !== 'Concluído') {
            updateData.completedAt = new Date().toISOString();
        }

        await updateDoc(orderRef, updateData);
        // O onSnapshot do loadAdminSales cuidará de atualizar a tela automaticamente.

    } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Erro ao atualizar: " + error.message);
    }
}


// ÍCONE DE RASTREIO CHAMA ISSO:
window.openTrackModal = async () => {
    const modal = document.getElementById('cart-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    if (!state.myOrders || state.myOrders.length === 0) {
        document.getElementById('view-cart-list').classList.add('hidden');
        document.getElementById('view-checkout').classList.add('hidden');
        document.getElementById('view-order-status').classList.add('hidden');
        document.getElementById('view-order-list').classList.remove('hidden');

        const container = document.getElementById('orders-list-container');
        container.innerHTML = '<div class="text-gray-500 text-center mt-10 p-4">Você ainda não fez pedidos.</div>';

        // Configura Header Básico
        document.getElementById('cart-modal-title').innerText = "ACOMPANHAMENTO";
        document.getElementById('cart-footer-actions').classList.add('hidden');
        document.getElementById('btn-modal-back').classList.add('hidden');
        return;
    }

    // --- CORREÇÃO DE SINCRONIA: ATUALIZA TUDO ANTES DE MOSTRAR ---
    // Mostra um carregando simples se quiser, ou apenas atualiza rápido
    const container = document.getElementById('orders-list-container');
    container.innerHTML = '<div class="text-white text-center mt-10"><i class="fas fa-circle-notch fa-spin"></i> Atualizando pedidos...</div>';

    showOrderListView(); // Mostra a estrutura da tela

    // Atualiza os dados de cada pedido no banco
    const freshOrders = [];
    for (const localOrder of state.myOrders) {
        try {
            // Busca o documento atualizado no Firebase
            const docRef = doc(db, `sites/${state.siteId}/sales`, localOrder.id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                // Se existe, usa os dados novos
                freshOrders.push({ id: docSnap.id, ...docSnap.data() });
            } else {
                // Se não existe mais (foi deletado), mantém o antigo ou ignora
                // Opção: Manter histórico para o cliente não achar que sumiu
                freshOrders.push(localOrder);
            }
        } catch (e) {
            console.error("Erro ao atualizar pedido:", e);
            freshOrders.push(localOrder); // Fallback para o local se der erro de rede
        }
    }

    // Salva a lista atualizada e renderiza
    state.myOrders = freshOrders;
    localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));

    // Agora renderiza a lista com dados frescos
    showOrderListView();
};

window.showOrderListView = () => {
    // Esconde tudo, mostra Lista
    document.getElementById('view-cart-list').classList.add('hidden');
    document.getElementById('view-checkout').classList.add('hidden');
    document.getElementById('view-order-status').classList.add('hidden');
    document.getElementById('view-order-list').classList.remove('hidden');

    // Configura Header
    document.getElementById('cart-modal-title').innerText = "ACOMPANHAMENTO";
    document.getElementById('cart-footer-actions').classList.add('hidden');
    document.getElementById('btn-modal-back').classList.add('hidden');

    const container = document.getElementById('orders-list-container');
    container.innerHTML = '';

    // Ordena: Mais recente em cima
    const sortedList = [...state.myOrders].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedList.forEach(order => {
        // --- Definição de Cores e Status ---
        let statusColor = 'bg-gray-400';
        let statusLabel = order.status; // Padrão: usa o texto do próprio status

        // Mapeamento visual
        switch (order.status) {
            case 'Aguardando aprovação':
                statusColor = 'bg-gray-400';
                break;

            // --- CORREÇÃO: SEPARANDO OS STATUS ---
            case 'Aprovado':
                statusColor = 'bg-yellow-500';
                statusLabel = 'Aprovado'; // Exibe exatamente "Aprovado"
                break;

            case 'Preparando pedido':
                statusColor = 'bg-yellow-600';
                statusLabel = 'Preparando Pedido';
                break;
            // -------------------------------------

            case 'Saiu para entrega':
                statusColor = 'bg-orange-500';
                statusLabel = 'Saiu para Entrega';
                break;
            case 'Entregue':
                statusColor = 'bg-green-500'; // Entregue mas não finalizado
                statusLabel = 'Entregue';
                break;
            case 'Concluído':
                statusColor = 'bg-green-600';
                statusLabel = 'Concluído';
                break;
            case 'Cancelado':
            case 'Cancelado pelo Cliente':
                statusColor = 'bg-red-600';
                statusLabel = 'Cancelado';
                break;
        }

        // --- Legenda Superior ---
        let metaLabel = "Em andamento";
        if (['Concluído', 'Entregue', 'Cancelado', 'Cancelado pelo Cliente'].includes(order.status)) {
            metaLabel = "Finalizado";
        }

        const item = document.createElement('div');
        item.className = "bg-[#0f111a] border border-gray-800 rounded-2xl p-4 flex justify-between items-center cursor-pointer hover:border-gray-600 transition mb-3 relative group";
        item.onclick = () => showOrderDetail(order.id);

        item.innerHTML = `
            <div class="flex flex-col">
                <span class="text-yellow-500 font-bold text-xs mb-1">Pedido ${order.code}</span>
                <span class="text-white font-bold text-lg leading-tight">${statusLabel}</span>
            </div>
            
            <div class="flex flex-col items-end gap-1">
                <span class="text-[10px] text-gray-400 font-medium uppercase tracking-wide">${metaLabel}</span>
                <div class="flex items-center gap-3">
                    <div class="w-4 h-4 rounded-full ${statusColor} shadow-[0_0_8px_rgba(255,255,255,0.1)]"></div>
                    <i class="fas fa-chevron-right text-white text-sm"></i>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
};

window.showOrderDetail = (orderId) => {
    // Esconde as outras views
    document.getElementById('view-cart-list').classList.add('hidden');
    document.getElementById('view-checkout').classList.add('hidden');
    document.getElementById('view-order-list').classList.add('hidden');
    document.getElementById('view-order-status').classList.remove('hidden');

    document.getElementById('cart-modal-title').innerText = "DETALHES";
    document.getElementById('cart-footer-actions').classList.add('hidden');

    // Botão Voltar para Lista
    const btnBack = document.getElementById('btn-modal-back');
    btnBack.classList.remove('hidden');
    btnBack.onclick = () => {
        // Ao voltar, atualiza a lista novamente para garantir sincronia
        openTrackModal();
    };

    // Renderiza inicial com o que tem na memória (pra não piscar tela branca)
    const localOrder = state.myOrders.find(o => o.id === orderId);
    if (localOrder) updateStatusUI(localOrder);

    // --- LISTENER EM TEMPO REAL ---
    if (window.currentOrderListener) window.currentOrderListener();

    // Listener no documento específico
    window.currentOrderListener = onSnapshot(doc(db, `sites/${state.siteId}/sales`, orderId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            // --- CORREÇÃO CRÍTICA DO UNDEFINED ---
            // O objeto 'data' do firebase NÃO tem o ID dentro dele por padrão.
            // Precisamos criar um novo objeto com o ID e os dados.
            const fullOrder = { id: snap.id, ...data };

            // Atualiza a UI de Detalhes
            updateStatusUI(fullOrder);

            // Atualiza também o array local para manter tudo sincronizado
            const idx = state.myOrders.findIndex(o => o.id === orderId);
            if (idx > -1) {
                state.myOrders[idx] = fullOrder;
                localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));
            }
        }
    });
};



// Variável global para controlar o timer e não criar múltiplos intervalos
window.cancelTimerInterval = null;

window.updateStatusUI = (order) => {
    if (window.cancelTimerInterval) clearInterval(window.cancelTimerInterval);

    const detailsContainer = document.getElementById('order-details-body');
    if (!detailsContainer) return;

    const s = order.status;
    const isCancelled = s.includes('Cancelado');

    // 1. LÓGICA DA TIMELINE
    let currentStep = 0;

    // Mapeamento
    if (s === 'Aguardando aprovação') currentStep = 0;
    else if (s === 'Aprovado') currentStep = 1;
    else if (s === 'Preparando pedido') currentStep = 1;
    else if (s === 'Saiu para entrega') currentStep = 2;
    else if (s === 'Entregue' || s === 'Concluído') currentStep = 3;

    // Configuração da primeira bolinha
    const step0Label = (s === 'Aguardando aprovação' || isCancelled) ? 'Aguardando' : 'Aprovado';
    const step0Icon = (s === 'Aguardando aprovação' || isCancelled) ? 'fa-clock' : 'fa-thumbs-up';

    const steps = [
        { label: step0Label, icon: step0Icon },
        { label: 'Preparando', icon: 'fa-box-open' },
        { label: 'Saiu', icon: 'fa-motorcycle' },
        { label: 'Entregue', icon: 'fa-check' }
    ];

    // --- HTML DA TIMELINE (AJUSTADO) ---
    let timelineHTML = `<div class="flex justify-between items-start mb-8 relative px-2">`;

    // Linha de Fundo (Cinza) - Ajustei left/right de 4 para 7 para esconder a ponta
    // Ajustei top para 18px (metade exata da altura da bolinha de 36px/w-9)
    timelineHTML += `<div class="absolute top-[18px] left-7 right-7 h-0.5 bg-gray-700 -z-0"></div>`;

    // Linha de Progresso (Verde)
    const progressWidth = Math.min(currentStep * 33.33, 100);
    if (!isCancelled) {
        // Ajustei o cálculo da largura (subtraindo 3.5rem) para compensar o novo recuo
        timelineHTML += `<div class="absolute top-[18px] left-7 h-0.5 bg-green-500 -z-0 transition-all duration-1000" style="width: calc(${progressWidth}% - 3.5rem)"></div>`;
    }

    steps.forEach((step, index) => {
        let circleClass = "bg-[#1f2937] border-2 border-gray-600 text-gray-500"; // Padrão Inativo
        let iconClass = step.icon;
        let labelClass = "text-gray-500";
        let glowEffect = "";

        if (isCancelled) {
            if (index === 0) {
                circleClass = "bg-red-900 border-2 border-red-500 text-red-500";
                iconClass = "fa-times";
                labelClass = "text-red-500 font-bold";
            }
        } else {
            // Passos Concluídos
            if (index < currentStep) {
                circleClass = "bg-green-500 border-2 border-green-500 text-black";
                labelClass = "text-green-500 font-bold";
            }
            // Passo Atual (Preenchido + Brilho)
            else if (index === currentStep) {
                circleClass = "bg-green-500 border-2 border-green-500 text-white";
                glowEffect = "shadow-[0_0_15px_rgba(34,197,94,0.8)] scale-110";
                labelClass = "text-white font-bold";
            }
        }

        timelineHTML += `
            <div class="flex flex-col items-center relative z-10">
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all duration-500 ${circleClass} ${glowEffect}">
                    <i class="fas ${iconClass}"></i>
                </div>
                <span class="text-[10px] uppercase mt-2 tracking-wide ${labelClass}">${step.label}</span>
            </div>
        `;
    });
    timelineHTML += `</div>`;


    // 2. CONTEÚDO DOS ITENS
    let itemsHtml = order.items.map(i => `
        <div class="flex justify-between items-center text-sm text-gray-300 mb-2 border-b border-gray-800 pb-2 last:border-0">
            <div class="flex items-center gap-2">
                 <span class="text-yellow-500 font-bold font-mono text-xs bg-yellow-900/20 px-1.5 rounded">${i.qty}x</span>
                 <span>${i.name} ${i.size !== 'U' ? `<span class="text-xs text-gray-500">(${i.size})</span>` : ''}</span>
            </div>
            <span class="text-white font-bold text-xs">${formatCurrency(i.price * i.qty)}</span>
        </div>
    `).join('');

    const addressBlock = `
        <div class="flex items-start gap-3 mt-4 bg-gray-900 p-3 rounded-lg border border-gray-800">
            <i class="fas fa-map-marker-alt text-red-500 mt-1"></i>
            <div class="flex-1">
                <p class="text-gray-300 text-xs leading-relaxed">
                    <span class="text-white font-bold block mb-0.5">Endereço de Entrega</span>
                    ${order.customer.street}, ${order.customer.addressNum} ${order.customer.comp ? '- ' + order.customer.comp : ''}<br>
                    ${order.customer.district}
                </p>
            </div>
        </div>
    `;

    // 3. RENDERIZAÇÃO
    detailsContainer.innerHTML = `
        <div class="mb-6">
            <h2 class="text-2xl font-extrabold text-yellow-500 tracking-tight">PEDIDO #${order.code}</h2>
            <p class="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">
                ${new Date(order.date).toLocaleDateString('pt-BR')} às ${new Date(order.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
        </div>

        ${timelineHTML}

        ${order.securityCode && order.status === 'Saiu para entrega' ? `
            <div class="bg-gray-800 border border-yellow-500/30 rounded-xl p-4 mb-6 text-center relative overflow-hidden group animate-pulse">
                <div class="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition"></div>
                <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Código de Segurança</p>
                <p class="text-3xl font-mono font-bold text-yellow-500 tracking-[0.3em]">${order.securityCode}</p>
                <p class="text-[10px] text-yellow-600/80 mt-1">Informe ao entregador</p>
            </div>
        ` : ''}

        <div class="bg-[#151720] rounded-xl p-4 border border-gray-800">
            <div class="mb-4 text-center border-b border-gray-700 pb-3">
                <span class="text-xs text-gray-500 uppercase font-bold">Status Atual</span>
                <h3 class="text-xl font-bold text-white mt-1">${order.status}</h3>
            </div>

            <h3 class="text-xs font-bold text-gray-400 uppercase mb-3">Resumo do Pedido</h3>
            ${itemsHtml}
            
            <div class="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-1">
                ${order.shippingFee > 0 ? `
                <div class="flex justify-between text-xs text-gray-400">
                    <span>Taxa de Entrega</span>
                    <span>${formatCurrency(order.shippingFee)}</span>
                </div>` : ''}
                
                <div class="flex justify-between items-end mt-1">
                    <span class="text-gray-300 font-bold text-sm">Total</span>
                    <span class="text-green-400 font-extrabold text-xl">${formatCurrency(order.total)}</span>
                </div>
            </div>
        </div>

        ${addressBlock}
        
        <div id="cancel-btn-area" class="mt-6"></div>
    `;

    // 4. LÓGICA DO BOTÃO CANCELAR
    const btnArea = document.getElementById('cancel-btn-area');
    if (!btnArea || isCancelled || currentStep > 0) {
        if (btnArea) btnArea.innerHTML = '';
        return;
    }

    if (order.status === 'Aguardando aprovação' || order.status === 'Pendente') {
        const checkTimer = () => {
            const now = new Date().getTime();
            const limit = new Date(order.cancelLimit).getTime();
            const distance = limit - now;

            if (distance < 0) {
                btnArea.innerHTML = `
                    <div class="text-center">
                        <p class="text-[10px] text-gray-600 mb-2">Tempo para cancelamento automático expirado</p>
                        <button disabled class="w-full bg-gray-800 text-gray-600 font-bold py-3 rounded-xl cursor-not-allowed border border-gray-700 text-sm">Cancelamento indisponível</button>
                    </div>`;
                clearInterval(window.cancelTimerInterval);
            } else {
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                const fmtSec = seconds < 10 ? `0${seconds}` : seconds;

                btnArea.innerHTML = `
                    <button onclick="clientCancelOrder('${order.id}')" class="w-full bg-red-900/20 hover:bg-red-900/40 border border-red-900 text-red-500 hover:text-red-400 font-bold py-3 rounded-xl flex justify-between px-6 transition group">
                        <span class="text-xs uppercase tracking-wide">Cancelar Pedido</span>
                        <span class="font-mono text-sm bg-red-900/50 px-2 rounded text-white group-hover:bg-red-600 transition">${minutes}:${fmtSec}</span>
                    </button>
                    <p class="text-[10px] text-center text-gray-500 mt-2">Você pode cancelar até o cronômetro zerar.</p>
                `;
            }
        };
        checkTimer();
        window.cancelTimerInterval = setInterval(checkTimer, 1000);
    }
};

// Nova função helper para o cliente cancelar
window.clientCancelOrder = async (orderId) => {
    if (!confirm("Tem certeza que deseja cancelar seu pedido?")) return;

    try {
        // --- AQUI MUDA O STATUS PARA O QUE VAI APARECER NO ADMIN ---
        await updateDoc(doc(db, `sites/${state.siteId}/sales`, orderId), {
            status: 'Cancelado pelo Cliente',
            cancelReason: 'Cancelado pelo cliente no app'
        });

        // Não precisa de alert, a UI vai atualizar sozinha pelo listener
    } catch (e) {
        console.error(e);
        alert("Erro ao cancelar: " + e.message);
    }
};



// Função Auxiliar: Controla a bolinha vermelha da moto
function checkActiveOrders() {
    const indicator = document.getElementById('track-indicator');
    if (!indicator) return;

    // Se não tiver lista ou estiver vazia, esconde a bolinha
    if (!state.myOrders || state.myOrders.length === 0) {
        indicator.classList.add('hidden');
        return;
    }

    // Filtra para contar apenas os pedidos que AINDA estão ativos/vivos
    const activeOrders = state.myOrders.filter(o => {
        const s = o.status;

        // Verifica se o status é considerado "Finalizado"
        // (Inclui: Concluído, Entregue, e qualquer tipo de Cancelado)
        const isFinished =
            s === 'Concluído' ||
            s === 'Entregue' ||
            s.includes('Cancelado'); // Pega 'Cancelado' e 'Cancelado pelo Cliente'

        // Retorna TRUE se o pedido NÃO estiver finalizado (ou seja, é um pedido ativo)
        return !isFinished;
    });

    // Se tiver pelo menos 1 pedido ativo, mostra a bolinha. Senão, esconde.
    if (activeOrders.length > 0) {
        indicator.classList.remove('hidden');
    } else {
        indicator.classList.add('hidden');
    }
}

// Variável para guardar os ouvintes e evitar duplicidade
window.activeListeners = [];

function startBackgroundListeners() {
    // Se não tem histórico, não faz nada
    if (!state.myOrders || state.myOrders.length === 0) {
        checkActiveOrders();
        return;
    }

    // Limpa ouvintes antigos para não duplicar se chamar a função de novo
    window.activeListeners.forEach(unsubscribe => unsubscribe());
    window.activeListeners = [];

    // Para cada pedido no histórico local...
    state.myOrders.forEach(localOrder => {
        // ... cria um ouvinte em tempo real no Firebase
        const unsub = onSnapshot(doc(db, `sites/${state.siteId}/sales`, localOrder.id), (docSnap) => {
            if (docSnap.exists()) {
                const freshData = docSnap.data();

                // 1. Atualiza os dados na memória local
                const index = state.myOrders.findIndex(o => o.id === localOrder.id);
                if (index !== -1) {
                    // Mantém o ID e atualiza o resto
                    state.myOrders[index] = { id: localOrder.id, ...freshData };

                    // 2. Salva no LocalStorage para persistir
                    localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));

                    // 3. O MAIS IMPORTANTE: Verifica a bolinha imediatamente
                    checkActiveOrders();

                    // Se o modal de lista estiver aberto, atualiza a lista visualmente também
                    const listModal = document.getElementById('view-order-list');
                    if (listModal && !listModal.classList.contains('hidden')) {
                        showOrderListView();
                    }
                }
            }
        });

        // Guarda o ouvinte para poder limpar depois se precisar
        window.activeListeners.push(unsub);
    });
}

//recebe a lista de pedidos, conta quantos tem em cada status e monta os botões coloridos.
function renderOrdersSummary(orders, filterStatus = '') {
    const container = document.getElementById('orders-summary-bar');
    if (!container) return;

    // 1. Inicializa Contadores
    const counts = {
        'Aguardando aprovação': 0,
        'Aprovado': 0,
        'Preparando pedido': 0,
        'Saiu para entrega': 0,
        'Entregue': 0,
        'Concluído': 0,
        'Cancelado': 0
    };

    let totalItensVendidos = 0;

    // 2. Processa os totais
    orders.forEach(o => {
        // A. Contagem de Status (Conta tudo para exibir nas caixinhas normais)
        if (o.status.includes('Cancelado')) {
            counts['Cancelado']++;
        } else if (counts.hasOwnProperty(o.status)) {
            counts[o.status]++;
        }

        // B. Contagem de Itens Vendidos (Regra Ajustada)
        // Só conta se NÃO for Cancelado E se NÃO estiver Aguardando Aprovação
        const isCancelado = o.status.includes('Cancelado');
        const isAguardando = o.status === 'Aguardando aprovação';

        if (!isCancelado && !isAguardando) {
            const itensDoPedido = o.items ? o.items.reduce((acc, item) => acc + (parseInt(item.qty) || 0), 0) : 0;
            totalItensVendidos += itensDoPedido;
        }
    });

    // 3. Definição dos Cards
    let cards = [
        { label: 'Aguardando', key: 'Aguardando aprovação', bg: 'bg-gray-600' },
        { label: 'Aprovados', key: 'Aprovado', bg: 'bg-yellow-600' },
        { label: 'Preparando', key: 'Preparando pedido', bg: 'bg-yellow-700' },
        { label: 'Na Entrega', key: 'Saiu para entrega', bg: 'bg-orange-600' },
        { label: 'Entregues', key: 'Entregue', bg: 'bg-green-500' },
        { label: 'Concluídos', key: 'Concluído', bg: 'bg-green-700' },
        { label: 'Cancelados', key: 'Cancelado', bg: 'bg-red-600' }
    ];

    // 4. Filtro de Visibilidade (Se selecionou um status, mostra só ele)
    if (filterStatus && filterStatus !== '') {
        if (filterStatus === 'Cancelado_All') {
            cards = cards.filter(c => c.key === 'Cancelado');
        } else {
            cards = cards.filter(c => c.key === filterStatus);
        }
    }

    // Adiciona o card de ITENS no final (Sempre mostra itens REAIS vendidos/aprovados)
    cards.push({ label: 'Itens Vendidos', val: totalItensVendidos, bg: 'bg-blue-600', key: 'total_items' });

    // 5. Renderiza
    let html = '';
    cards.forEach(card => {
        const value = card.val !== undefined ? card.val : (counts[card.key] || 0);

        html += `
            <div class="${card.bg} text-white rounded p-3 flex flex-col items-center justify-center border border-white/10 min-h-[70px] animate-fade-in">
                <span class="text-2xl font-bold leading-none mb-1">${value}</span>
                <span class="text-[10px] uppercase font-medium tracking-wider opacity-90">${card.label}</span>
            </div>
        `;
    });

    const gridCols = cards.length > 4 ? 'lg:grid-cols-8' : `lg:grid-cols-${cards.length}`;
    container.className = `grid grid-cols-2 md:grid-cols-4 ${gridCols} gap-2 mb-6 transition-all`;

    container.innerHTML = html;
}

// --- MÁSCARA DE MOEDA (Input Mask) ---
function setupCurrencyMasks() {
    const ids = ['prod-price', 'prod-promo', 'prod-cost', 'prod-pix-val'];

    ids.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;

        // Evento ao digitar
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número

            // Se o campo estiver vazio, mantém vazio ou 0,00
            if (value === "") {
                e.target.value = "";
                return;
            }

            // Converte para decimal (divide por 100)
            value = (parseFloat(value) / 100).toFixed(2) + '';

            // Troca ponto por vírgula
            value = value.replace('.', ',');

            // Adiciona ponto de milhar (ex: 1.000,00)
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');

            e.target.value = value;
        });
    });
};
// Formata números do banco (1250.90) para o padrão do input (1.250,90)
function formatMoneyForInput(value) {
    if (value === null || value === undefined || value === '') return '';
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// IMPORTANTE: Adicione essa chamada dentro do seu initApp ou logo após carregar 

// Ativa as máscaras assim que o site carregar
window.addEventListener('DOMContentLoaded', () => {
    setupCurrencyMasks();
});

// E TAMBÉM chame ao abrir o modal de criar produto,
// caso o modal seja criado dinamicamente, para garantir que o evento pegue.

// Digite isso no Console do navegador para limpar o estado travado:
// localStorage.removeItem('activeOrder');
// location.reload();


