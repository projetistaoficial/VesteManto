import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs, getDoc } from './firebase-config.js';

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
    siteStats: { visits: 0, shares: 0 },

    // UI Helpers
    editingCouponId: null,
    focusedCouponIndex: -1,
    focusedProductId: null,
    selectedCategoryParent: null,
    globalSettings: { allowNoStock: false },
    cardSelections: {}
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
            renderAdminProducts();
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
        if (state.user) renderAdminProducts();

        // Recalcula Capital de Giro sempre que produtos mudarem
        calculateStatsMetrics();
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
        filterAndRenderSales();
        updateDashboardMetrics();
        updateStatsUI(); // Atualiza a aba Estatísticas
    });
}

// Carrega Contadores de Visitas/Compartilhamentos
function loadSiteStats() {
    const docRef = doc(db, `sites/${state.siteId}/stats`, 'general');
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            state.siteStats = docSnap.data();
            if (els.statVisits) els.statVisits.innerText = `${state.siteStats.visits || 0} Usuários`;
            if (els.statShares) els.statShares.innerText = state.siteStats.shares || 0;
        } else {
            setDoc(docRef, { visits: 0, shares: 0 });
        }
    });
}

// Incrementa Visitas (Seguro: Não conta Admin)
async function incrementVisitsCounter() {
    // Se o usuário já estiver autenticado (Admin), não conta
    if (auth.currentUser) return;

    const docRef = doc(db, `sites/${state.siteId}/stats`, 'general');
    try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const current = snap.data().visits || 0;
            await updateDoc(docRef, { visits: current + 1 });
        } else {
            await setDoc(docRef, { visits: 1, shares: 0 });
        }
    } catch (e) { console.log("Erro contador visitas (Adblock?):", e); }
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

    // Pega configuração global de parcelamento
    const globalInst = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3 };

    products.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;

        // --- LÓGICA DO PIX (Específica do Produto) ---
        let pixHtml = '';
        if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
            const pix = p.paymentOptions.pix;
            const valDisplay = pix.type === 'percent' ? `${pix.val}%` : `R$ ${pix.val}`;
            pixHtml = `<p class="text-green-500 text-xs font-bold mt-1">${valDisplay} OFF no Pix</p>`;
        }

        // --- LÓGICA DO PARCELAMENTO (Global) ---
        let installmentHtml = '';
        if (globalInst.active) {
            const price = p.promoPrice || p.price;
            // Se "freeUntil" for maior que 1, mostra a opção "X vezes sem juros"
            // Mostramos o máximo de parcelas sem juros permitidas ou o máximo do cartão

            let showInstallments = 1;
            let label = "";

            // Lógica: Mostrar a melhor condição (Maior qtd de parcelas sem juros)
            // Se freeUntil for 3, e max for 12. Mostramos "3x sem juros" (ou calculado).
            // Para simplificar na vitrine, mostramos até quantas vezes é sem juros.

            if (globalInst.freeUntil > 1) {
                // Calcula valor da parcela sem juros
                const parcVal = price / globalInst.freeUntil;
                installmentHtml = `<p class="text-gray-400 text-xs mt-0.5">Ou ${globalInst.freeUntil}x de ${formatCurrency(parcVal)} sem juros</p>`;
            } else {
                // Se tudo tem juros, mostra o máximo possível (com texto genérico ou calculado se quiser complexidade)
                installmentHtml = `<p class="text-gray-400 text-xs mt-0.5">Em até ${globalInst.max}x no cartão</p>`;
            }
        }

        // --- MONTAGEM DO CARD ---
        const imgUrl = p.images && p.images.length > 0 ? p.images[0] : 'https://placehold.co/400?text=Sem+Foto';

        // Exibição de Preço
        const priceDisplay = p.promoPrice ?
            `<div class="flex flex-col">
                <span class="text-gray-500 line-through text-xs">${formatCurrency(p.price)}</span>
                <span class="text-white font-bold text-lg">${formatCurrency(p.promoPrice)}</span>
             </div>` :
            `<div class="flex flex-col">
                <span class="text-white font-bold text-lg">${formatCurrency(p.price)}</span>
             </div>`;

        const card = document.createElement('div');
        card.className = "bg-black border border-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full group relative";
        card.onclick = () => openProductModal(p.id);

        card.innerHTML = `
            <div class="relative w-full aspect-[4/5] bg-gray-900 overflow-hidden">
                <img src="${imgUrl}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                ${isOut ? `<div class="absolute inset-0 bg-black/70 flex items-center justify-center z-10"><span class="text-red-500 font-bold border-2 border-red-500 px-2 py-1 transform -rotate-12">ESGOTADO</span></div>` : ''}
            </div>

            <div class="p-3 flex flex-col flex-1">
                <h3 class="text-white font-bold text-sm leading-tight line-clamp-2 mb-1">${p.name}</h3>
                <p class="text-gray-500 text-xs line-clamp-2 mb-2">${p.description || ''}</p>
                
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

function renderCategories() {
    const catNames = state.categories.map(c => c.name);

    // 1. Preenche Selects (Filtros e Formulário)
    const populateSelect = (selectEl) => {
        if (!selectEl) return;
        const currentVal = selectEl.value;
        selectEl.innerHTML = '<option value="">Selecione / Todas</option>';
        catNames.forEach(c => {
            selectEl.innerHTML += `<option value="${c}">${c}</option>`;
        });
        if (currentVal) selectEl.value = currentVal;
    };

    populateSelect(els.catFilter);
    populateSelect(els.adminFilterCat);
    populateSelect(els.bulkCategorySelect);
    populateSelect(getEl('prod-cat-select'));

    // 2. Sidebar Hierárquica (Menu Lateral)
    if (els.sidebarCategories) {
        const tree = {};

        // Monta a árvore de categorias
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

        // Função recursiva para gerar HTML
        const buildHtml = (node, level = 0) => {
            let html = '';
            const keys = Object.keys(node).sort();

            keys.forEach(key => {
                const item = node[key];
                const hasChildren = Object.keys(item._children).length > 0;
                const indent = level * 10;
                // Escapa aspas simples para não quebrar o onclick
                const safePath = item._path.replace(/'/g, "\\'");

                const textStyle = level === 0
                    ? 'font-bold text-yellow-500 text-sm uppercase'
                    : 'text-gray-400 text-sm hover:text-white';

                if (hasChildren) {
                    html += `
                        <details class="group mb-1">
                            <summary class="list-none flex items-center cursor-pointer p-1 rounded hover:bg-gray-800 transition" style="margin-left:${indent}px">
                                <span class="transition-transform duration-300 group-open:rotate-90 text-gray-500 mr-2 text-xs">▶</span>
                                
                                <span class="${textStyle}" onclick="event.preventDefault(); filterByCat('${safePath}')">
                                    ${key}
                                </span>
                            </summary>
                            <div class="border-l border-gray-800 ml-2">
                                ${buildHtml(item._children, level + 1)}
                            </div>
                        </details>
                    `;
                } else {
                    html += `
                        <button class="w-full text-left py-1 p-1 mb-1 rounded hover:bg-gray-800 transition ${textStyle}" 
                                style="margin-left:${indent + (level > 0 ? 12 : 0)}px"
                                onclick="filterByCat('${safePath}')">
                            ${level > 0 ? '↳ ' : ''}${key}
                        </button>
                    `;
                }
            });
            return html;
        };

        els.sidebarCategories.innerHTML = `
            <button class="w-full text-left py-2 px-2 mb-2 text-white bg-gray-800 rounded font-bold" onclick="filterByCat('')">
                VER TODOS
            </button>
            ${buildHtml(tree)}
        `;
    }
}

function renderAdminCategoryList() {
    if (!els.catListAdmin) return;
    els.catListAdmin.innerHTML = '';
    const sortedCats = [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
    sortedCats.forEach(c => {
        const isSelected = state.selectedCategoryParent === c.name;
        const level = (c.name.match(/-/g) || []).length;
        const displayName = c.name.split('-').pop().trim();
        const bgClass = isSelected ? 'bg-gray-700 border-yellow-500' : 'bg-gray-800 border-gray-700';
        const indent = level * 20;
        const item = document.createElement('div');
        item.className = `${bgClass} flex justify-between items-center p-3 rounded mb-1 border cursor-pointer hover:bg-gray-700 transition select-none`;
        item.style.marginLeft = `${indent}px`;
        item.innerHTML = `
            <div class="flex items-center">
                ${level > 0 ? '<i class="fas fa-level-up-alt rotate-90 mr-2 text-gray-500 text-xs"></i>' : ''}
                <span class="font-bold text-white text-sm">${displayName}</span>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="event.stopPropagation(); deleteCategory('${c.id}', '${c.name}')" class="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white transition">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;
        item.onclick = () => {
            if (state.selectedCategoryParent === c.name) {
                state.selectedCategoryParent = null;
                els.newCatName.placeholder = "Nome da Categoria Principal...";
            } else {
                state.selectedCategoryParent = c.name;
                els.newCatName.placeholder = `Adicionar em: ${displayName} > ...`;
            }
            renderAdminCategoryList();
        };
        els.catListAdmin.appendChild(item);
    });
}

function renderAdminProducts() {
    if (!els.productListAdmin) return;
    els.productListAdmin.innerHTML = '';
    const searchTerm = els.adminSearchProd ? els.adminSearchProd.value.toLowerCase().trim() : '';
    const catFilter = els.adminFilterCat ? els.adminFilterCat.value : '';
    let filtered = [...state.products];
    if (searchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.code && String(p.code).includes(searchTerm)));
    if (catFilter) filtered = filtered.filter(p => p.category === catFilter);

    filtered.forEach(p => {
        const stockClass = p.stock < 0 ? 'text-red-500 font-bold' : 'text-yellow-500';
        const isSelected = state.selectedProducts.has(p.id);
        const row = document.createElement('div');
        row.className = "relative overflow-hidden rounded bg-gray-800 border border-gray-700 group touch-pan-y outline-none focus:ring-2 focus:ring-yellow-500 mb-2";
        row.tabIndex = 0;
        row.innerHTML = `
            <div class="absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center text-white font-bold z-0 cursor-pointer" onclick="confirmDeleteProduct('${p.id}')"><i class="fas fa-trash"></i></div>
            <div class="relative z-10 bg-gray-800 p-3 flex items-center gap-3 transition-transform duration-200 ease-out prod-content-swipe" data-id="${p.id}">
                <input type="checkbox" class="form-checkbox h-5 w-5 text-yellow-500 rounded border-gray-600 bg-gray-900 focus:ring-yellow-500 cursor-pointer" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleProductSelection('${p.id}')">
                <img src="${p.images[0]}" class="w-12 h-12 object-cover rounded border border-gray-600">
                <div class="flex-1 min-w-0 cursor-pointer select-none" ondblclick="editProduct('${p.id}')">
                    <div class="flex justify-between"><p class="font-bold text-white text-sm truncate">${p.name}</p></div>
                    <div class="flex justify-between items-center mt-1"><p class="text-xs ${stockClass}">Estoque: ${p.stock}</p><p class="text-xs text-green-400 font-bold">${formatCurrency(p.price)}</p></div>
                    <p class="text-xs text-gray-500 truncate">${p.category || 'Sem categoria'}</p>
                </div>
                <button onclick="editProduct('${p.id}')" class="text-gray-400 hover:text-white p-2"><i class="fas fa-pen"></i></button>
            </div>`;
        row.onfocus = () => state.focusedProductId = p.id;
        row.onblur = () => { if (state.focusedProductId === p.id) state.focusedProductId = null; };
        setupSwipe(row.querySelector('.prod-content-swipe'));
        els.productListAdmin.appendChild(row);
    });
    updateBulkActionBar();
}

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
    if (!state.orders.length) return;
    const filteredOrders = state.orders.filter(o => {
        const orderDate = new Date(o.date);
        const dashDate = state.dashDate;
        const sameYear = orderDate.getFullYear() === dashDate.getFullYear();
        const sameMonth = orderDate.getMonth() === dashDate.getMonth();
        const sameDay = orderDate.getDate() === dashDate.getDate();
        if (state.dashViewMode === 'month') return sameYear && sameMonth;
        return sameYear && sameMonth && sameDay;
    });

    let totalItems = 0;
    let confirmedCount = 0;
    let totalValue = 0;
    filteredOrders.forEach(o => {
        if (o.status === 'Confirmado') {
            confirmedCount++;
            totalValue += o.total;
            o.items.forEach(i => totalItems += i.qty);
        }
    });
    els.dashTotalItems.innerText = totalItems;
    els.dashConfirmedCount.innerText = confirmedCount;
    els.dashTotalValue.innerText = formatCurrency(totalValue);
}

function filterAndRenderSales() {
    if (!els.filterOrderId) return;
    const idTerm = els.filterOrderId.value.trim().toLowerCase();
    const statusTerm = els.filterStatus.value;
    const dateStart = els.filterDateStart.value;
    const dateEnd = els.filterDateEnd.value;
    let filtered = state.orders;
    if (idTerm) filtered = filtered.filter(o => String(o.code).includes(idTerm));
    if (statusTerm) filtered = filtered.filter(o => o.status === statusTerm);
    if (dateStart) filtered = filtered.filter(o => new Date(o.date) >= new Date(dateStart));
    if (dateEnd) { const endDate = new Date(dateEnd); endDate.setHours(23, 59, 59); filtered = filtered.filter(o => new Date(o.date) <= endDate); }
    renderSalesList(filtered);
}

function renderSalesList(orders) {
    const listEl = document.getElementById('orders-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Ordena: Mais recentes primeiro
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (orders.length === 0) {
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-4xl mb-2 opacity-50"></i><p>Nenhum pedido encontrado.</p></div>';
        return;
    }

    orders.forEach(o => {
        // 1. Extração de Dados e Cores
        let statusBadgeColor = 'text-yellow-500 border-yellow-500';
        if (o.status === 'Aprovado' || o.status === 'Preparando pedido') statusBadgeColor = 'text-blue-400 border-blue-400';
        if (o.status === 'Saiu para entrega') statusBadgeColor = 'text-purple-400 border-purple-400';
        if (o.status === 'Entregue') statusBadgeColor = 'text-green-400 border-green-400';
        if (o.status === 'Concluído') statusBadgeColor = 'text-gray-400 border-gray-400 bg-gray-800';
        
        // ALTERAÇÃO 1: Usa includes para pegar "Cancelado" e "Cancelado pelo Cliente"
        if (o.status.includes('Cancelado')) statusBadgeColor = 'text-red-500 border-red-500';

        // 2. Extrair Troco (Se houver)
        let trocoHtml = '';
        if (o.paymentMethod && o.paymentMethod.includes('Dinheiro') && o.paymentMethod.includes('Troco para:')) {
            const match = o.paymentMethod.match(/Troco para:\s*(.+?)\)/);
            const valorTroco = match ? match[1] : '';
            if (valorTroco) {
                trocoHtml = `<div class="text-right"><span class="text-white font-bold text-sm">Troco para:</span> <span class="bg-gray-700 text-white px-2 py-1 rounded text-xs ml-1">${valorTroco}</span></div>`;
            }
        }

        // 3. HTML dos Itens
        let itemsHtml = o.items.map(i => `
            <div class="bg-gray-800/50 p-2 rounded mb-1 border border-gray-700 flex justify-between items-center">
                <span class="text-gray-300 text-sm font-medium">${i.qty}x ${i.name} <span class="text-gray-500 text-xs">(${i.size})</span></span>
                </div>
        `).join('');

        // 4. Lógica de Controles (ALTERADA AQUI)
        let controlsHtml = '';

        // CASO 1: CANCELADO (Qualquer tipo) -> NÃO TEM BOTÕES DE AÇÃO
        if (o.status.includes('Cancelado')) {
             controlsHtml = `
                <div class="flex justify-end items-center gap-2 mt-4 pt-2 border-t border-gray-700">
                    <span class="bg-red-600 text-white px-4 py-2 rounded font-bold text-xs cursor-default">CANCELADO</span>
                </div>
            `;
        } 
        // CASO 2: CONCLUÍDO -> Tem botão de Estornar
        else if (o.status === 'Concluído') {
            controlsHtml = `
                <div class="flex justify-end items-center gap-2 mt-4 pt-2 border-t border-gray-700">
                    <span class="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs cursor-default">FINALIZADO</span>
                    <button onclick="adminRevertStatus('${o.id}')" class="border border-gray-500 text-gray-400 hover:text-white px-3 py-2 rounded text-xs transition">Estornar / Reabrir</button>
                </div>
            `;
        } 
        // CASO 3: ATIVO (Em andamento) -> Select + Botões
        else {
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
                        <button onclick="adminFinalizeOrder('${o.id}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold transition">Finalizado</button>
                    </div>
                </div>
            `;
        }

        // 5. Montagem do Card
        const card = document.createElement('div');
        card.className = "bg-[#0f172a] border border-gray-700 rounded-lg overflow-hidden shadow-lg mb-4 p-4"; // Fundo bem escuro

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-yellow-500 font-bold text-lg">PEDIDO #${o.code}</h3>
                    <p class="text-gray-500 text-xs">Data: ${new Date(o.date).toLocaleDateString('pt-BR')} ${new Date(o.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                
                <div class="flex flex-col items-end gap-1">
                    <div class="${statusBadgeColor} border px-3 py-1 rounded text-xs uppercase font-bold tracking-wider">
                        ${o.status}
                    </div>
                    ${trocoHtml}
                </div>
            </div>

            <div class="mb-4">
                ${itemsHtml}
            </div>

            <div class="mb-4">
                <span class="text-gray-400 text-xs block">Valor Total:</span>
                <span class="text-white font-bold text-2xl">${formatCurrency(o.total)}</span>
            </div>

            <div class="bg-gray-900 p-3 rounded border border-gray-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                
                <div>
                    <span class="text-gray-500 font-bold block mb-1">Cliente:</span>
                    <span class="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 block text-center truncate">${o.customer?.name || '-'}</span>
                </div>
                
                <div>
                    <span class="text-gray-500 font-bold block mb-1">Telefone:</span>
                    <span class="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 block text-center">${o.customer?.phone || '-'}</span>
                </div>

                <div>
                    <span class="text-gray-500 font-bold block mb-1">Forma de pagamento:</span>
                    <span class="bg-gray-800 text-white px-2 py-1 rounded border border-gray-700 block text-center truncate" title="${o.paymentMethod}">${o.paymentMethod?.split('[')[0] || '-'}</span>
                </div>

                <div>
                    <span class="text-gray-500 font-bold block mb-1">Endereço:</span>
                    <button onclick="alert('${o.customer?.addressNum}, CEP: ${o.customer?.cep}')" class="bg-gray-800 hover:bg-gray-700 text-white px-2 py-1 rounded border border-gray-700 w-full text-center transition">
                        Clique para ver
                    </button>
                </div>
            </div>

            ${controlsHtml}
        `;

        listEl.appendChild(card);
    });
}

// =================================================================
// 8. EVENT LISTENERS
// =================================================================

function setupEventListeners() {
    setupAccordion('btn-acc-cat', 'content-acc-cat', 'arrow-acc-cat');
    setupAccordion('btn-acc-coupon', 'content-acc-coupon', 'arrow-acc-coupon');

    // Filtros Admin
    if (els.adminSearchProd) els.adminSearchProd.addEventListener('input', renderAdminProducts);
    if (els.adminFilterCat) els.adminFilterCat.addEventListener('change', renderAdminProducts);
    if (els.adminSortProd) els.adminSortProd.addEventListener('change', renderAdminProducts);

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
            renderAdminProducts();
            alert("Produtos movidos!");
        } catch (error) { alert("Erro ao mover: " + error.message); }
    };

    // Filtros Vitrine
    if (els.searchInput) els.searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)); renderCatalog(filtered); });
    if (els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); });

    // Filtros Vendas
    if (els.filterOrderId) els.filterOrderId.addEventListener('input', filterAndRenderSales);
    if (els.filterStatus) els.filterStatus.addEventListener('change', filterAndRenderSales);
    if (els.filterDateStart) els.filterDateStart.addEventListener('change', filterAndRenderSales);
    if (els.filterDateEnd) els.filterDateEnd.addEventListener('change', filterAndRenderSales);
    if (els.btnClearFilters) els.btnClearFilters.onclick = () => { els.filterOrderId.value = ''; els.filterStatus.value = ''; els.filterDateStart.value = ''; els.filterDateEnd.value = ''; filterAndRenderSales(); };

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
    if (els.menuLinkHome) els.menuLinkHome.onclick = () => { showView('catalog'); window.toggleSidebar(); };
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
                    data.code = Math.floor(10000 + Math.random() * 90000).toString();
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

    const btnApplyCoupon = getEl('btn-apply-coupon'); if (btnApplyCoupon) { btnApplyCoupon.onclick = () => { const input = getEl('cart-coupon-input'); const code = input.value.trim().toUpperCase(); if (!code) { state.currentCoupon = null; updateCartUI(); return; } const coupon = state.coupons.find(c => c.code === code); if (coupon) { if (coupon.expiryDate) { const expiry = new Date(coupon.expiryDate); if (expiry < new Date()) { state.currentCoupon = null; alert("Cupom expirado!"); updateCartUI(); return; } } state.currentCoupon = coupon; alert(`Cupom ${code} aplicado!`); } else { state.currentCoupon = null; alert("Cupom inválido"); } updateCartUI(); }; }
    const cartCouponInput = getEl('cart-coupon-input');
    if (cartCouponInput) {
        cartCouponInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Impede que a página recarregue
                // Simula o clique no botão de aplicar
                const btn = getEl('btn-apply-coupon');
                if (btn) btn.click();
            }
        });
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

function updateBulkActionBar() {
    if (!els.bulkActionsBar) return;
    const count = state.selectedProducts.size;
    els.selectedCount.innerText = count;
    if (count > 0) {
        els.bulkActionsBar.classList.remove('hidden');
        els.bulkActionsBar.classList.add('flex');
    } else {
        els.bulkActionsBar.classList.add('hidden');
        els.bulkActionsBar.classList.remove('flex');
    }
}

function setupSwipe(element) {
    if (!element) return;
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    element.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isSwiping = true; element.style.transition = 'none'; }, { passive: true });
    element.addEventListener('touchmove', (e) => { if (!isSwiping) return; currentX = e.touches[0].clientX; let diff = currentX - startX; if (diff < 0 && diff > -100) { element.style.transform = `translateX(${diff}px)`; } }, { passive: true });
    element.addEventListener('touchend', () => { isSwiping = false; element.style.transition = 'transform 0.2s ease-out'; const diff = currentX - startX; if (diff < -50) { element.style.transform = `translateX(-100px)`; } else { element.style.transform = `translateX(0)`; } });
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

    // Salva o ID no estado para o carrossel usar
    state.focusedProductId = productId;
    state.currentImgIndex = 0; // Reseta para a primeira foto

    const modal = getEl('product-modal');
    const backdrop = getEl('modal-backdrop');
    const card = getEl('modal-card');
    if (!modal) return;

    // PREPARAÇÃO DAS IMAGENS
    // Garante que images seja um array (mesmo se for produto antigo)
    let images = p.images || [];
    if (images.length === 0) images = ['https://placehold.co/600']; // Fallback

    // Configura botões do carrossel
    const btnPrev = getEl('btn-prev-img');
    const btnNext = getEl('btn-next-img');

    if (images.length > 1) {
        btnPrev.classList.remove('hidden');
        btnNext.classList.remove('hidden');
    } else {
        btnPrev.classList.add('hidden');
        btnNext.classList.add('hidden');
    }

    // Renderiza a primeira imagem e as miniaturas
    updateCarouselUI(images);

    // Preenche textos
    getEl('modal-title').innerText = p.name;
    getEl('modal-desc').innerText = p.description || "Sem descrição detalhada.";
    const price = p.promoPrice || p.price;
    getEl('modal-price').innerHTML = formatCurrency(price);

    // ... (O RESTO DO CÓDIGO DA FUNÇÃO MANTÉM IGUAL: Sizes, Botão Add Cart, etc.) ...

    // Parte dos tamanhos (Copie do seu código anterior ou mantenha o que estava lá)
    const sizesDiv = getEl('modal-sizes');
    const sizesWrapper = getEl('modal-sizes-wrapper');
    sizesDiv.innerHTML = '';
    let selectedSizeInModal = 'U';
    if (p.sizes && p.sizes.length > 0) {
        if (sizesWrapper) sizesWrapper.classList.remove('hidden');
        selectedSizeInModal = p.sizes[0];
        p.sizes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = "w-12 h-12 rounded-lg border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center";
            btn.innerText = s;
            if (s === selectedSizeInModal) btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
            btn.onclick = () => {
                selectedSizeInModal = s;
                document.querySelectorAll('#modal-sizes button').forEach(b => b.className = "w-12 h-12 rounded-lg border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center");
                btn.classList.remove('text-gray-300', 'border-gray-600');
                btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
            };
            sizesDiv.appendChild(btn);
        });
    } else {
        if (sizesWrapper) sizesWrapper.classList.add('hidden');
    }

    // Configura Botão Adicionar (Mantém igual)
    const btnAdd = getEl('modal-add-cart');
    const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
    const isOut = p.stock <= 0 && !allowNegative;

    if (isOut) {
        btnAdd.disabled = true;
        btnAdd.innerHTML = "ESGOTADO";
        btnAdd.className = "w-full bg-gray-700 text-gray-500 font-bold text-lg py-4 rounded-xl cursor-not-allowed";
    } else {
        btnAdd.disabled = false;
        btnAdd.innerHTML = `<i class="fas fa-shopping-bag mr-2"></i> ADICIONAR AO CARRINHO`;
        btnAdd.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-green-900/50 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center";
        btnAdd.onclick = () => { addToCart(p, selectedSizeInModal); closeProductModal(); };
    }

    // Exibe o modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        card.classList.remove('opacity-0', 'scale-95');
        card.classList.add('scale-100');
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
    if (confirm('Excluir este produto?')) { await deleteDoc(doc(db, `sites/${state.siteId}/products`, id)); }
};

window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id); if (!p) return;

    getEl('edit-prod-id').value = p.id;
    getEl('prod-name').value = p.name;

    const catSelect = getEl('prod-cat-select');
    if (catSelect && p.category) catSelect.value = p.category;

    getEl('prod-desc').value = p.description;
    getEl('prod-price').value = p.price;
    getEl('prod-promo').value = p.promoPrice || '';
    getEl('prod-stock').value = p.stock;
    getEl('prod-cost').value = p.cost || '';
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

    if (inputPixVal) inputPixVal.value = pixOptions.val;
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
window.filterByCat = (cat) => {
    // 1. Atualiza o Título da Página
    if (els.pageTitle) {
        // Se tem categoria, mostra o nome dela. Se não, volta para 'Vitrine'
        els.pageTitle.innerText = cat ? cat : 'Vitrine';
    }

    // 2. Sincroniza o Select visualmente
    if (els.catFilter) els.catFilter.value = cat;

    // 3. Se vazio, recarrega todos
    if (!cat) return renderCatalog(state.products);

    // 4. Normaliza para evitar erro de maiúsculas/minúsculas
    const term = cat.toLowerCase();

    // 5. Filtra os produtos
    const filtered = state.products.filter(p => {
        if (!p.category) return false;
        const prodCat = p.category.toLowerCase();

        // Aceita categoria EXATA ou SUBCATEGORIA (Ex: "Roupas" mostra "Roupas - Camisetas")
        return prodCat === term || prodCat.startsWith(term + ' -');
    });

    renderCatalog(filtered);

    // 6. Fecha sidebar no mobile
    if (window.innerWidth < 768) {
        if (els.sidebar && !els.sidebar.classList.contains('-translate-x-full')) {
            window.toggleSidebar();
        }
    }

    // 7. Rola para o topo
    if (els.grid) els.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.toggleSidebar = () => {
    const isOpen = !els.sidebar.classList.contains('-translate-x-full');
    if (isOpen) { els.sidebar.classList.add('-translate-x-full'); els.sidebarOverlay.classList.add('hidden'); }
    else { els.sidebar.classList.remove('-translate-x-full'); els.sidebarOverlay.classList.remove('hidden'); }
};

window.toggleProductSelection = (id) => {
    if (state.selectedProducts.has(id)) { state.selectedProducts.delete(id); }
    else { state.selectedProducts.add(id); }
    updateBulkActionBar();
};

window.shareStoreLink = () => {
    // Incrementa "Shares" no banco (Apenas se não for Admin, mas a regra do design pediu para o botão enviar funcionar para Admin)
    // Regra do Design: "botão deve funcionar para admin enviar, mas não deve contar nos compartilhamentos"
    const url = window.location.href;
    const text = `Confira nossa loja: ${url}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');

    // Incrementa contador (apenas se não for admin)
    if (!auth.currentUser) {
        // Lógica simplificada de incremento sem leitura prévia pesada (usando a que já temos carregada)
        // Para precisão, seria ideal usar increment() do Firestore, mas aqui usamos leitura simples
        const docRef = doc(db, `sites/${state.siteId}/stats`, 'general');
        const currentShares = state.siteStats.shares || 0;
        updateDoc(docRef, { shares: currentShares + 1 }).catch(e => console.log(e));
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

function updateCartUI() {
    const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
    if (els.cartCount) els.cartCount.innerText = totalQty;
    if (els.cartCountMobile) els.cartCountMobile.innerText = totalQty;
    if (els.cartItems) {
        els.cartItems.innerHTML = '';
        let subtotal = 0;
        state.cart.forEach((item, index) => {
            subtotal += item.price * item.qty;
            els.cartItems.innerHTML += `
                <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                    <div><p class="text-white font-bold text-sm">${item.name} (${item.size})</p><p class="text-green-400 text-sm">${formatCurrency(item.price)}</p></div>
                    <div class="flex items-center gap-2"><button onclick="changeQty(${index}, -1)" class="text-gray-400 hover:text-white px-2">-</button><span class="text-white text-sm">${item.qty}</span><button onclick="changeQty(${index}, 1)" class="text-gray-400 hover:text-white px-2">+</button></div>
                </div>`;
        });

        let discount = 0;
        if (state.currentCoupon) {
            if (state.currentCoupon.type === 'percent') {
                discount = subtotal * (state.currentCoupon.val / 100);
            } else {
                discount = state.currentCoupon.val;
            }
        }
        const total = Math.max(0, subtotal - discount);
        document.getElementById('cart-subtotal').innerText = formatCurrency(subtotal);
        document.getElementById('cart-discount').innerText = `- ${formatCurrency(discount)}`;
        document.getElementById('cart-total').innerText = formatCurrency(total);
    }
}
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
        const parentLabel = elReq.closest('label'); // Pega o pai do checkbox

        if (dConfig.ownDelivery === true) {
            // Se entrega está ativa, libera o código
            elReq.disabled = false;
            if (parentLabel) parentLabel.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            // Se entrega está inativa, trava o código
            elReq.disabled = true;
            if (parentLabel) parentLabel.classList.add('opacity-50', 'pointer-events-none');
        }
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

    // Referência ao documento
    const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
    let dataToUpdate = {};
    let message = '';

    if (type === 'logistics') {
        // Pega CEP e Distância
        const cep = document.getElementById('conf-store-cep').value.replace(/\D/g, '');
        const dist = parseFloat(document.getElementById('conf-max-dist').value) || 0;

        dataToUpdate = {
            cep: cep,
            maxDistance: dist
        };
        message = 'CEP/Logística salvo!';
    }
    else if (type === 'installments') {
        // Pega toda a configuração de parcelamento
        const active = document.getElementById('conf-card-active').checked;
        const max = parseInt(document.getElementById('conf-card-max').value) || 12;
        const free = parseInt(document.getElementById('conf-card-free').value) || 3;
        const rate = parseFloat(document.getElementById('conf-card-rate').value.replace(',', '.')) || 0;

        // Reconstrói o objeto installments completo para salvar
        dataToUpdate = {
            installments: {
                active: active,
                max: max,
                freeUntil: free,
                rate: rate
            }
        };
        message = active ? 'Parcelamento ATIVADO e salvo!' : 'Parcelamento DESATIVADO.';
    }

    try {
        // Usa setDoc com { merge: true } para atualizar só o que mudou sem apagar o resto (Nome, Logo, etc)
        await setDoc(docRef, dataToUpdate, { merge: true });

        // Atualiza estado local
        if (state.storeProfile) {
            state.storeProfile = { ...state.storeProfile, ...dataToUpdate };
        }

        // Atualiza a vitrine imediatamente (para mostrar/esconder parcelamento nos cards)
        renderCatalog(state.products);

        showToast(message, 'success');

    } catch (error) {
        console.error("Erro no autosave:", error);
        showToast('Erro ao salvar alteração.', 'error');
    }

    // NOVO BLOCO: Configurações de Pedidos
    if (type === 'orders') {
        const ownDelivery = document.getElementById('conf-own-delivery').checked;
        const reqCode = document.getElementById('conf-req-code').checked;
        const cancelTime = parseInt(document.getElementById('conf-cancel-time').value) || 5;

        dataToUpdate = {
            deliveryConfig: {
                ownDelivery: ownDelivery,
                reqCustomerCode: reqCode,
                cancelTimeMin: cancelTime
            }
        };
        message = 'Configurações de pedidos salvas!';
    }

    try {
        await setDoc(docRef, dataToUpdate, { merge: true });

        // Atualiza memória local
        if (state.storeProfile) {
            state.storeProfile = { ...state.storeProfile, ...dataToUpdate };
        }
        showToast(message, 'success');
    } catch (error) {
        console.error(error);
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
    // Reseta estado visual
    getEl('checkout-cep').value = '';
    getEl('checkout-number').value = '';
    getEl('checkout-comp').value = '';
    els.addressDetails.classList.add('hidden');
    els.deliveryError.classList.add('hidden');
    els.paymentSection.classList.add('hidden'); // Começa oculto até validar CEP
    els.paymentSection.classList.add('opacity-50', 'pointer-events-none');
    els.btnFinishOrder.disabled = true;

    // Reseta opção de pagamento para WhatsApp
    const radios = document.getElementsByName('payment-method');
    if (radios[0]) radios[0].checked = true;
    handlePaymentSelection('whatsapp');

    els.checkoutModal.classList.remove('hidden');
    els.checkoutModal.classList.add('flex');
};

window.closeCheckoutModal = () => {
    els.checkoutModal.classList.add('hidden');
    els.checkoutModal.classList.remove('flex');
};

// --- LÓGICA DE CEP E DISTÂNCIA ---
window.handleCheckoutCep = async () => {
    const cepInput = document.getElementById('checkout-cep');
    const cep = cepInput.value.replace(/\D/g, '');

    // Elementos de UI
    const loading = document.getElementById('cep-loading');
    const errorBox = document.getElementById('delivery-error');
    const errorMsg = document.getElementById('delivery-error-msg');
    const addrFields = document.getElementById('address-fields');
    const distDisplay = document.getElementById('distance-display');
    const btnFinish = document.getElementById('btn-finish-payment');

    if (cep.length !== 8) return;

    // Reset Visual
    loading.classList.remove('hidden');
    errorBox.classList.add('hidden');
    addrFields.classList.add('opacity-50', 'pointer-events-none'); // Trava campos
    if (distDisplay) distDisplay.classList.add('hidden');
    if (btnFinish) btnFinish.disabled = true;

    try {
        // 1. Busca Endereço (ViaCEP)
        const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await resp.json();

        if (data.erro) throw new Error("CEP não encontrado.");

        // 2. Preenche Campos Automaticamente
        document.getElementById('checkout-street').value = data.logradouro || '';
        document.getElementById('checkout-district').value = data.bairro || '';
        document.getElementById('checkout-city').value = `${data.localidade} - ${data.uf}`;

        // Destrava para digitar número
        addrFields.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('checkout-number').focus();

        // 3. Validação de Distância
        const storeCep = state.storeProfile.cep; // CEP da loja configurado no Admin
        const maxDist = parseFloat(state.storeProfile.maxDistance) || 0; // 0 = Sem limite

        // Se a loja tem configuração de limite
        if (storeCep && maxDist > 0) {
            if (distDisplay) {
                distDisplay.innerText = "Calculando frete...";
                distDisplay.classList.remove('hidden');
            }

            const dist = await calculateDistanceByCEP(storeCep, cep);

            if (distDisplay) distDisplay.innerText = `${dist.toFixed(1)} km da loja`;

            if (dist > maxDist) {
                // BLOQUEIA A VENDA
                throw new Error(`Infelizmente não entregamos neste local.<br>Distância: ${dist.toFixed(1)}km (Máximo: ${maxDist}km)`);
            }
        }

        // Se chegou aqui, libera o botão de finalizar
        if (btnFinish) {
            btnFinish.disabled = false;
            // Se for online, já recalcula totais
            if (typeof updateCheckoutTotal === 'function') updateCheckoutTotal();
        }

    } catch (err) {
        // Exibe erro e mantém bloqueado
        errorMsg.innerHTML = err.message;
        errorBox.classList.remove('hidden');
        addrFields.classList.add('opacity-50', 'pointer-events-none'); // Mantém travado
        if (distDisplay) distDisplay.classList.add('hidden');
    } finally {
        loading.classList.add('hidden');
    }
};

// API OpenStreetMap (Nominatim) para Lat/Lon (Mantenha ou adicione se não tiver)
async function calculateDistanceByCEP(cepOrigin, cepDest) {
    const getCoords = async (c) => {
        // Pequeno delay para evitar bloqueio da API gratuita
        await new Promise(r => setTimeout(r, 300));
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&country=Brazil&postalcode=${c}`);
        const d = await r.json();
        if (d && d.length > 0) return { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) };
        throw new Error("Não foi possível calcular a rota para este CEP.");
    };

    try {
        const [c1, c2] = await Promise.all([getCoords(cepOrigin), getCoords(cepDest)]);
        return getDistanceFromLatLonInKm(c1.lat, c1.lon, c2.lat, c2.lon);
    } catch (e) {
        console.error(e);
        // Em caso de erro na API de mapas, decidimos se bloqueamos ou liberamos.
        // Aqui vou liberar retornando 0, mas avisando no console.
        return 0;
    }
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

function populateInstallmentsSelect() {
    const instConfig = state.storeProfile.installments;
    const select = els.checkoutInstallments;
    select.innerHTML = '';

    // 1. Calcula Valor Base (Produtos * Qtd - Cupom Global)
    let cartTotal = 0;
    state.cart.forEach(item => { cartTotal += item.price * item.qty; });

    let discountCoupon = 0;
    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') discountCoupon = cartTotal * (state.currentCoupon.val / 100);
        else discountCoupon = state.currentCoupon.val;
    }
    const baseValue = Math.max(0, cartTotal - discountCoupon);

    // 2. Gera Opções
    for (let i = 1; i <= instConfig.max; i++) {
        let label = '';
        let finalVal = baseValue;

        // Juros Composto: M = C * (1 + i)^n
        // Taxa deve ser decimal (4% = 0.04)
        if (i >= instConfig.freeUntil) {
            const rate = instConfig.rate / 100;
            finalVal = baseValue * Math.pow((1 + rate), i);
            const parcVal = finalVal / i;
            label = `${i}x de ${formatCurrency(parcVal)} (Total: ${formatCurrency(finalVal)})`;
        } else {
            label = `${i}x de ${formatCurrency(baseValue / i)} Sem Juros`;
        }

        const option = document.createElement('option');
        option.value = i;
        option.text = label;
        option.dataset.total = finalVal; // Guarda o total calculado
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
    const cashContainer = document.getElementById('container-cash-option');
    const lblMethod = document.getElementById('lbl-payment-method');
    const optionsDiv = document.getElementById('checkout-payment-options');

    // Remove opacidade (as opções são visíveis em ambos os modos agora)
    if (optionsDiv) optionsDiv.classList.remove('opacity-50', 'pointer-events-none');

    if (mode === 'delivery') {
        // Mostra opção Dinheiro
        if (cashContainer) cashContainer.classList.remove('hidden');
        if (lblMethod) lblMethod.innerText = "Pagarei na entrega com:";
    } else {
        // Esconde opção Dinheiro
        if (cashContainer) cashContainer.classList.add('hidden');
        if (lblMethod) lblMethod.innerText = "Pagar agora com:";

        // Se estava em Dinheiro, volta para Pix
        const currentMethod = document.querySelector('input[name="payment-method-selection"]:checked')?.value;
        if (currentMethod === 'cash') {
            const pixRadio = document.querySelector('input[name="payment-method-selection"][value="pix"]');
            if (pixRadio) pixRadio.checked = true;
        }
    }

    // IMPORTANTE: Chama o toggleMethodSelection para esconder/mostrar as parcelas baseado no novo modo
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


// --- FUNÇÃO DE PARCELAMENTO (TABELA PRICE) ---
function populateInstallments() {
    const instConfig = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3, rate: 0 };
    const select = document.getElementById('checkout-installments');

    if (!select) return;

    select.innerHTML = '';

    // 1. Calcula o Total Base
    let totalBase = 0;
    state.cart.forEach(i => totalBase += i.price * i.qty);

    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') {
            totalBase -= totalBase * (state.currentCoupon.val / 100);
        } else {
            totalBase -= state.currentCoupon.val;
        }
    }
    totalBase = Math.max(0, totalBase);

    // 2. Define Máximo de Parcelas
    const maxParcelas = (instConfig.active && totalBase > 0) ? instConfig.max : 1;

    for (let i = 1; i <= maxParcelas; i++) {
        let finalVal = totalBase;
        let valorParcela = totalBase / i;
        let label = `${i}x Sem Juros`;

        // Aplica Juros (Tabela Price) se aplicável
        if (instConfig.active && i > instConfig.freeUntil && instConfig.rate > 0) {
            const taxa = instConfig.rate / 100; // Ex: 2% vira 0.02

            // Fórmula PRICE: PMT = PV * [ i * (1+i)^n ] / [ (1+i)^n - 1 ]
            // PV = Valor Presente (totalBase)
            // n = Número de parcelas (i)
            // i = taxa

            const fator = Math.pow(1 + taxa, i);
            valorParcela = totalBase * ((taxa * fator) / (fator - 1));

            finalVal = valorParcela * i; // Total final é a soma das parcelas

            label = `${i}x (c/ juros)`;
        }

        const option = document.createElement('option');
        option.value = i;

        // Armazena o valor TOTAL FINAL desta opção
        option.dataset.total = finalVal.toFixed(2);

        option.text = `${label} de ${formatCurrency(valorParcela)}`;
        select.appendChild(option);
    }
}

// --- FUNÇÃO ÚNICA: CALCULAR TOTAL DO CHECKOUT ---
window.calcCheckoutTotal = () => {
    // 1. Identifica Modo e Método
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value || 'online';
    const method = document.querySelector('input[name="payment-method-selection"]:checked')?.value || 'pix';

    let finalTotal = 0;
    let savingsMsg = '';

    // 2. Calcula Base (Soma Itens - Cupom Global)
    let itemsTotal = 0;
    state.cart.forEach(item => itemsTotal += item.price * item.qty);

    let discountCoupon = 0;
    if (state.currentCoupon) {
        discountCoupon = state.currentCoupon.type === 'percent'
            ? itemsTotal * (state.currentCoupon.val / 100)
            : state.currentCoupon.val;
    }
    let baseTotal = Math.max(0, itemsTotal - discountCoupon);

    // --- CÁLCULO ESPECÍFICO POR MÉTODO ---

    // A. PIX (Com desconto configurado no produto)
    if (method === 'pix') {
        let totalWithPixDesc = 0;
        state.cart.forEach(item => {
            const prod = state.products.find(p => p.id === item.id);
            let price = item.price;
            // Aplica desconto do produto se existir
            if (prod && prod.paymentOptions?.pix?.active) {
                const descVal = prod.paymentOptions.pix.type === 'percent'
                    ? price * (prod.paymentOptions.pix.val / 100)
                    : prod.paymentOptions.pix.val;
                price = Math.max(0, price - descVal);
            }
            totalWithPixDesc += price * item.qty;
        });

        // Reaplica cupom sobre total Pix
        let cupomPix = state.currentCoupon?.type === 'percent'
            ? totalWithPixDesc * (state.currentCoupon.val / 100)
            : discountCoupon;

        finalTotal = Math.max(0, totalWithPixDesc - cupomPix);

        const saved = (baseTotal - finalTotal);
        if (saved > 0.01) savingsMsg = `Economia de ${formatCurrency(saved)} no Pix!`;
    }

    // B. CARTÃO
    else if (method === 'card') {
        // Se for ONLINE, pega o valor do Select (pode ter juros)
        if (payMode === 'online') {
            const select = document.getElementById('checkout-installments');
            if (select && select.options.length > 0) {
                const selectedOpt = select.options[select.selectedIndex];
                if (selectedOpt && selectedOpt.dataset.total) {
                    finalTotal = parseFloat(selectedOpt.dataset.total);
                } else {
                    finalTotal = baseTotal;
                }
            } else {
                finalTotal = baseTotal;
            }
        }
        // Se for ENTREGA, usa o valor base (sem juros do site)
        else {
            finalTotal = baseTotal;
        }
    }

    // C. DINHEIRO ou Padrão
    else {
        finalTotal = baseTotal;
        savingsMsg = '';
    }

    // Atualiza Interface
    const elTotal = document.getElementById('checkout-final-total');
    if (elTotal) elTotal.innerText = formatCurrency(finalTotal);

    const msgEl = document.getElementById('checkout-pix-discount-msg');
    if (msgEl) {
        msgEl.innerText = savingsMsg;
        if (savingsMsg) msgEl.classList.remove('hidden');
        else msgEl.classList.add('hidden');
    }
};

// --- ENVIAR PEDIDO (ATUALIZADO COM TROCO) ---
// --- FUNÇÃO FINALIZAR PEDIDO (BLINDADA) ---
window.submitOrder = async () => {
    console.log("!!! CLIQUE RECEBIDO: submitOrder !!!");

    // 1. Verificação de Segurança e Coleta de Dados
    try {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || '';

        // --- DADOS DO CLIENTE ---
        const name = getVal('checkout-name');
        const phone = getVal('checkout-phone');

        // --- DADOS DO ENDEREÇO (Atualizado para o novo HTML) ---
        const cep = getVal('checkout-cep');
        const street = getVal('checkout-street');     // Rua (vinda do ViaCEP)
        const district = getVal('checkout-district'); // Bairro (vindo do ViaCEP)
        const number = getVal('checkout-number');     // Número (digitado)
        const comp = getVal('checkout-comp');         // Complemento (digitado)

        // Validação: Garante que nome, telefone, rua e número existem
        if (!name || !phone || !cep || !number || !street) {
            alert("⚠️ Por favor, preencha NOME, TELEFONE e o ENDEREÇO completo (O Número é obrigatório).");
            return;
        }

        // --- DADOS DE PAGAMENTO ---
        const payModeEl = document.querySelector('input[name="pay-mode"]:checked');
        const methodEl = document.querySelector('input[name="payment-method-selection"]:checked');

        if (!payModeEl || !methodEl) {
            alert("⚠️ Selecione uma forma de pagamento.");
            return;
        }

        const payMode = payModeEl.value;
        const method = methodEl.value;
        let paymentDetails = "";

        if (method === 'pix') {
            paymentDetails = "Pix";
        }
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

        // --- VALORES ---
        const totalEl = document.getElementById('checkout-final-total');
        let finalValue = 0;
        if (totalEl) {
            finalValue = parseFloat(totalEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        }

        // --- CONFIGURAÇÕES LOJA ---
        const deliveryConfig = state.storeProfile?.deliveryConfig || {};
        const cancelMinutes = deliveryConfig.cancelTimeMin || 5;

        // --- MONTA ENDEREÇO COMPLETO FORMATADO ---
        const fullAddress = `${street}, ${number} ${comp ? '(' + comp + ')' : ''} - ${district} - CEP: ${cep}`;

        // --- OBJETO DO PEDIDO ---
        const order = {
            code: Math.floor(10000 + Math.random() * 90000),
            date: new Date().toISOString(),
            customer: {
                name: name,
                phone: phone,
                address: fullAddress, // Endereço completo formatado
                addressNum: number,
                cep: cep,
                district: district,
                street: street
            },
            items: state.cart || [],
            total: finalValue,
            status: 'Aguardando aprovação',
            paymentMethod: paymentDetails,
            // Gera código de entrega SE configurado e SE for entrega própria
            securityCode: (deliveryConfig.reqCustomerCode && deliveryConfig.ownDelivery) ? Math.floor(1000 + Math.random() * 9000) : null,
            cancelLimit: new Date(new Date().getTime() + cancelMinutes * 60000).toISOString()
        };

        // Feedback visual
        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerText = "⏳ Processando...";
        }

        // 5. Envio ao Firebase
        const docRef = await addDoc(collection(db, `sites/${state.siteId}/sales`), order);
        console.log("Pedido salvo ID:", docRef.id);

        // --- CORREÇÃO DE PERSISTÊNCIA E LISTA ---
        const newOrderLocal = { id: docRef.id, ...order };

        // Adiciona ao Histórico
        if (!Array.isArray(state.myOrders)) state.myOrders = [];
        state.myOrders.push(newOrderLocal);

        // Salva na chave correta
        localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));
        startBackgroundListeners(); // <--- Reinicia ouvintes para incluir o pedido novo

        checkActiveOrders();

        // Limpa Carrinho
        state.cart = [];
        localStorage.setItem('cart', JSON.stringify([]));
        updateCartUI();

        const cartItemsContainer = document.getElementById('cart-items');
        if (cartItemsContainer) cartItemsContainer.innerHTML = '';

        // Redirecionamento e Feedback
        if (payMode === 'online') {
            sendOrderToWhatsapp(newOrderLocal);
        } else {
            setTimeout(() => alert("✅ Pedido Realizado com Sucesso!"), 300);
        }

        // Abre a LISTA de pedidos (Acompanhamento)
        openTrackModal();

    } catch (e) {
        console.error("ERRO GRAVE NO SUBMIT:", e);
        alert("❌ Erro ao enviar pedido: " + e.message);
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

// Função auxiliar para atualizar no Firebase
async function updateOrderStatusDB(orderId, status) {
    try {
        const updateData = { status: status };
        // Se finalizou, salva data
        if (status === 'Concluído') {
            updateData.completedAt = new Date().toISOString();
        }

        await updateDoc(doc(db, `sites/${state.siteId}/sales`, orderId), updateData);
        showToast(`Status atualizado para: ${status}`);
        // A lista atualiza sozinha via onSnapshot
    } catch (error) {
        console.error(error);
        alert("Erro ao atualizar status.");
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
        let statusLabel = 'Aguardando aprovação';

        // Mapeamento
        switch (order.status) {
            case 'Aguardando aprovação':
                statusColor = 'bg-gray-400';
                statusLabel = 'Aguardando aprovação';
                break;
            case 'Aprovado':
            case 'Preparando pedido':
                statusColor = 'bg-yellow-400';
                statusLabel = 'Preparando Pedido';
                break;
            case 'Saiu para entrega':
                statusColor = 'bg-orange-500';
                statusLabel = 'Entrega';
                break;
            case 'Entregue':
            case 'Concluído':
                statusColor = 'bg-green-500';
                statusLabel = 'Concluído';
                break;
            case 'Cancelado':
            case 'Cancelado pelo Cliente': // <--- ADICIONADO AQUI
                statusColor = 'bg-red-600';
                statusLabel = 'Cancelado / Recusado';
                break;
            default:
                statusLabel = order.status; // Fallback
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
    // Limpa timer anterior se houver troca de visualização
    if (window.cancelTimerInterval) clearInterval(window.cancelTimerInterval);

    // --- RENDERIZAÇÃO DA TIMELINE (Mantida a lógica anterior, ajustada visualmente) ---
    // Mapa de Progresso
    const steps = {
        'Aguardando aprovação': 1,
        'Aprovado': 1,
        'Preparando pedido': 2,
        'Saiu para entrega': 3,
        'Entregue': 4,
        'Concluído': 4
    };
    
    let currentStep = steps[order.status] || 1;
    
    // Se for QUALQUER tipo de cancelamento, o passo é 0 (falha)
    if (order.status.includes('Cancelado')) currentStep = 0;

    // Atualiza Barra e Ícones (usando a lógica que já existia, mas simplificada para focar no design)
    let barWidth = 0;
    if (currentStep > 1) barWidth = ((currentStep - 1) / 3) * 100;
    const timelineLine = document.getElementById('status-timeline-line');
    if(timelineLine) timelineLine.style.width = `${barWidth}%`;

    for (let i = 1; i <= 4; i++) {
        const iconBox = document.getElementById(`icon-step-${i}`);
        if(!iconBox) continue; 
        const icon = iconBox.querySelector('i');
        
        iconBox.className = "w-10 h-10 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300 bg-[#0f111a]"; 
        
        // Verifica se é cancelado
        if (order.status.includes('Cancelado')) {
             iconBox.classList.add('border-red-600', 'text-red-600');
             icon.className = "fas fa-times";
        } 
        else if (i <= currentStep) {
             // ... verde ...
             iconBox.classList.add('bg-green-500', 'border-green-500', 'text-white');
             icon.className = "fas fa-check";
        } else {
             // ... cinza ...
             iconBox.classList.add('border-gray-700', 'text-gray-700');
        }
    }

    // --- CONTEÚDO DOS DETALHES (Estilo image_a2255a.png) ---
    // Precisamos de um container específico no HTML para injetar esses detalhes.
    // Sugiro que no seu HTML, dentro de 'view-order-status', você tenha uma div com id="order-details-body"
    
    const detailsContainer = document.getElementById('order-details-body'); // <--- CRIE ESSE ID NO HTML se não existir
    if (detailsContainer) {
        let itemsHtml = order.items.map(i => `
            <div class="flex justify-between text-sm text-gray-300 mb-1">
                <span>${i.qty}x ${i.name} ${i.size !== 'U' ? `(${i.size})` : ''}</span>
            </div>
        `).join('');

        // Formatação do Cupom
        const cupomHtml = order.cupom ? `<div class="text-sm text-gray-400 mt-2">Cupom: <span class="text-white">${order.cupom}</span></div>` : '';

        // Situação Atual (Texto Grande no Centro)
        const statusDisplay = order.status === 'Concluído' ? 'CONCLUÍDO' : order.status.toUpperCase();

        detailsContainer.innerHTML = `
            <div class="bg-[#1a1d2d] rounded-xl p-4 mb-6 text-center border border-gray-700">
                <span class="text-xs text-gray-500 uppercase tracking-widest block mb-1">Situação Atual</span>
                <h2 class="text-2xl font-bold text-white">${statusDisplay}</h2>
            </div>

            <div class="mb-6">
                <h3 class="text-white font-bold text-lg mb-2">Itens:</h3>
                ${itemsHtml}
                ${cupomHtml}
                <div class="mt-3 pt-3 border-t border-gray-800 flex justify-between items-center">
                    <span class="text-white font-bold text-lg">Total:</span>
                    <span class="text-green-400 font-bold text-lg">${formatCurrency(order.total)}</span>
                </div>
            </div>

            <div class="mb-6">
                <h3 class="text-white font-bold text-lg mb-2">Endereço</h3>
                <p class="text-gray-400 text-sm leading-relaxed">
                    ${order.customer.street}, ${order.customer.addressNum}<br>
                    ${order.customer.district} - ${order.customer.cep}
                </p>
            </div>
            
            <div id="cancel-btn-area" class="mt-auto"></div>
        `;
    }

    // --- LÓGICA DO BOTÃO CANCELAR COM TIMER ---
    const btnArea = document.getElementById('cancel-btn-area');
    if (!btnArea) return;

    // Só mostra botão se o status for inicial
    if (order.status === 'Aguardando aprovação' || order.status === 'Pendente') {
        
        // Calcula tempo restante
        const checkTimer = () => {
            const now = new Date().getTime();
            const limit = new Date(order.cancelLimit).getTime(); // cancelLimit foi salvo na criação do pedido
            const distance = limit - now;

            if (distance < 0) {
                // Tempo acabou
                btnArea.innerHTML = `
                    <button disabled class="w-full bg-gray-800 text-gray-500 font-bold py-3 rounded-xl cursor-not-allowed">
                        Cancelamento indisponível
                    </button>
                `;
                clearInterval(window.cancelTimerInterval);
            } else {
                // Tempo rodando
                const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                const fmtSec = seconds < 10 ? `0${seconds}` : seconds;

                btnArea.innerHTML = `
                    <button onclick="clientCancelOrder('${order.id}')" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex justify-between px-6 transition">
                        <span>Cancelar</span>
                        <span>${minutes}:${fmtSec}s</span>
                    </button>
                `;
            }
        };

        checkTimer(); // Roda imediatamente
        window.cancelTimerInterval = setInterval(checkTimer, 1000); // Atualiza a cada segundo

    } else {
        // Se já foi aprovado ou saiu para entrega, não pode cancelar
        btnArea.innerHTML = '';
    }
};

// Nova função helper para o cliente cancelar
window.clientCancelOrder = async (orderId) => {
    if(!confirm("Tem certeza que deseja cancelar seu pedido?")) return;
    
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

// Digite isso no Console do navegador para limpar o estado travado:
// localStorage.removeItem('activeOrder');
// location.reload();