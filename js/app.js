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

// Adicione junto com os outros helpers (getEl, formatCurrency...)
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
    orders: [],
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: null,
    currentCoupon: null,
    isDarkMode: true,
    editingCouponId: null,
    focusedCouponIndex: -1, // -1 significa nenhum selecionado
    selectedProducts: new Set(),
    focusedProductId: null,
    globalSettings: { allowNoStock: false },
    selectedCategoryParent: null,
    dashDate: new Date(),
    dashViewMode: 'month',
    cardSelections: {},
    // --- ESTADO DAS ESTATÍSTICAS ---
    statsDate: new Date(),
    statsViewMode: 'month', // 'day' ou 'month'
    statsFilterType: 'all', // 'all' ou 'period'
    siteStats: { visits: 0, shares: 0 },

    storeProfile: {
        name: 'Veste Manto',
        logo: '',
        whatsapp: '',
        instagram: '',
        facebook: '',
        address: '',
        description: 'Sua loja de camisas.'
    }
};

const els = {
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
    productFormModal: getEl('product-form-modal'),
    toggleStockGlobal: getEl('toggle-stock-global'),
    catListAdmin: getEl('admin-cat-list'),
    newCatName: getEl('new-cat-name'),
    btnAddCat: getEl('btn-add-cat'),
    // Dashboard Simples
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
    // --- ELEMENTOS ESTATÍSTICAS AVANÇADAS ---
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

    // Configurações Inputs
    confStoreName: getEl('conf-store-name'),
    confStoreLogo: getEl('conf-store-logo'),
    confStoreWpp: getEl('conf-store-wpp'),
    confStoreInsta: getEl('conf-store-insta'),
    confStoreFace: getEl('conf-store-face'),
    confStoreAddress: getEl('conf-store-address'),
    confStoreDesc: getEl('conf-store-desc'),
    btnSaveProfile: getEl('btn-save-profile')
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
    loadSettings();
    loadCategories();
    loadProducts();
    loadCoupons();

    updateCartUI();
    updateDashboardUI();

    // Inicia Carregamento de Estatísticas
    loadSiteStats();
    incrementVisitsCounter();

    loadSettings();
    loadCategories();
    // ...
    loadStoreProfile(); // <--- ADICIONE ISSO

    if (localStorage.getItem('theme') === 'light') toggleTheme(false);

    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';

        // --- BLOCO ALTERADO ---
        // Atualiza o botão do rodapé mantendo o novo estilo (Negrito/Maiúsculo)
        if (els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `
                <i class="fas fa-user-shield text-yellow-500 group-hover:text-white transition"></i>
                <span class="font-bold uppercase text-sm tracking-wide">${btnText}</span>
            `;
        }
        // ----------------------

        // Mantém compatibilidade caso o botão antigo do topo ainda exista no cache
        const btnLoginNav = getEl('btn-admin-login');
        if (btnLoginNav) btnLoginNav.innerText = btnText;

        if (user) {
            renderAdminProducts();
            loadAdminSales();
        } else {
            showView('catalog');
        }
    });

    // Atualiza a lista a cada 10 segundos para checar validade "ao vivo"
    setInterval(() => {
        // Só renderiza se estiver na aba de admin, para economizar recursos
        if (state.coupons.length > 0 && !getEl('view-admin').classList.contains('hidden')) {
            renderAdminCoupons();
        }
    }, 10000);
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

    products.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;

        const firstSize = p.sizes && p.sizes.length > 0 ? p.sizes[0] : 'U';
        const selectedSize = state.cardSelections[p.id] || firstSize;
        const cartItem = state.cart.find(i => i.id === p.id && i.size === selectedSize);
        const qtyInCart = cartItem ? cartItem.qty : 0;

        const priceDisplay = p.promoPrice ?
            `<div class="flex flex-col">
                <span class="text-green-500 font-bold text-xl">${formatCurrency(p.promoPrice)}</span>
                <span class="text-gray-400 line-through text-xs font-normal">${formatCurrency(p.price)}</span>
             </div>` :
            `<span class="text-green-500 font-bold text-xl">${formatCurrency(p.price)}</span>`;

        let sizesHtml = '';
        if (p.sizes && p.sizes.length > 0) {
            sizesHtml = `<div class="flex gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar" onclick="event.stopPropagation()">`;
            p.sizes.forEach(s => {
                const isSel = s === selectedSize;
                const sizeClass = isSel
                    ? "bg-gray-300 text-black font-bold ring-2 ring-white"
                    : "bg-gray-600 text-gray-300 hover:bg-gray-500";

                sizesHtml += `<button onclick="selectSizeCard('${p.id}', '${s}')" class="${sizeClass} w-5 h-5 rounded flex items-center justify-center text-xs transition shadow-sm shrink-0">${s}</button>`;
            });
            sizesHtml += `</div>`;
        }

        let actionButtonHtml = '';
        if (isOut) {
            actionButtonHtml = `<div class="bg-gray-800 text-red-500 font-bold px-4 py-2 rounded text-sm uppercase w-full text-center border border-gray-700">Esgotado</div>`;
        } else if (qtyInCart > 0) {
            actionButtonHtml = `
                <div class="flex items-center bg-gray-700 rounded overflow-hidden h-10 shadow-lg border border-gray-600" onclick="event.stopPropagation()">
                    <button onclick="updateCartQtyCard('${p.id}', '${selectedSize}', -1)" class="w-10 h-full text-white hover:bg-red-600 transition flex items-center justify-center text-lg font-bold">-</button>
                    <span class="w-8 text-center text-white font-bold text-sm">${qtyInCart}</span>
                    <button onclick="updateCartQtyCard('${p.id}', '${selectedSize}', 1)" class="w-10 h-full text-white hover:bg-green-600 transition flex items-center justify-center text-lg font-bold">+</button>
                </div>`;
        } else {
            actionButtonHtml = `
                <button onclick="event.stopPropagation(); addToCartCard('${p.id}', '${selectedSize}')" class="bg-green-500 hover:bg-green-600 text-white w-10 h-10 rounded flex items-center justify-center transition shadow-lg shadow-green-900/50 group">
                    <i class="fas fa-plus group-hover:scale-125 transition-transform"></i>
                </button>`;
        }

        const card = document.createElement('div');
        card.className = "bg-black border border-gray-800 rounded-xl overflow-hidden shadow-xl hover:shadow-2xl hover:border-gray-600 transition duration-300 flex flex-col cursor-pointer";
        card.setAttribute('onclick', `openProductModal('${p.id}')`);

        card.innerHTML = `
            <div class="relative w-full pt-[100%] bg-gray-900 group overflow-hidden" onclick="event.stopPropagation(); openImageViewer('${p.images ? p.images[0] : ''}')">
                <img src="${p.images ? p.images[0] : 'https://placehold.co/400'}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                ${isOut ? '<div class="absolute inset-0 bg-black/80 flex items-center justify-center text-white font-bold tracking-widest border-2 border-red-600 m-4 rounded">ESGOTADO</div>' : ''}
                <div class="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition duration-300">
                    <i class="fas fa-expand-alt"></i>
                </div>
            </div>

            <div class="p-4 flex flex-col flex-1">
                <h3 class="text-white font-bold text-lg leading-tight mb-1 truncate">${p.name}</h3>
                <p class="text-gray-400 text-xs mb-3 line-clamp-2 min-h-[2.5em]">${p.description}</p>
                ${sizesHtml}
                <div class="mt-auto flex justify-between items-end border-t border-gray-800 pt-3">
                    ${priceDisplay}
                    ${actionButtonHtml}
                </div>
            </div>
        `;
        els.grid.appendChild(card);
    });
    if (!state.isDarkMode) updateCardStyles(true);
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
    if (!els.ordersList) return;
    els.ordersList.innerHTML = '';
    els.ordersCount.innerText = orders.length;
    const summary = orders.reduce((acc, o) => {
        if (!acc[o.status]) acc[o.status] = { count: 0, total: 0 };
        acc[o.status].count++;
        acc[o.status].total += o.total;
        return acc;
    }, {});
    if (els.ordersSummaryBar) {
        els.ordersSummaryBar.innerHTML = '';
        Object.keys(summary).forEach(status => {
            let color = 'bg-gray-200 text-gray-800';
            if (status === 'Confirmado') color = 'bg-green-200 text-green-900';
            if (status === 'Cancelado') color = 'bg-red-200 text-red-900';
            if (status === 'Pendente') color = 'bg-yellow-200 text-yellow-900';
            els.ordersSummaryBar.innerHTML += `
                <div class="${color} px-2 py-1 rounded shadow-sm border border-gray-300">
                    ${summary[status].count} ${status} (${formatCurrency(summary[status].total)})
                </div>
            `;
        });
    }
    if (orders.length === 0) { els.ordersList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum pedido encontrado.</p>'; return; }
    orders.forEach(o => {
        let statusColor = 'text-yellow-500'; if (o.status === 'Confirmado') statusColor = 'text-green-500'; if (o.status === 'Cancelado' || o.status === 'Reembolsado') statusColor = 'text-red-600';
        let itemsHtml = o.items.map(i => `${i.qty}x ${i.name} (${i.size})`).join(', ');
        const card = document.createElement('div');
        card.className = "bg-gray-800 border border-gray-700 rounded p-4 shadow-sm";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2"><div><span class="text-yellow-500 font-bold text-lg">PEDIDO #${o.code}</span><p class="text-gray-500 text-xs">Data: ${new Date(o.date).toLocaleString()}</p></div><div class="text-right"><span class="${statusColor} font-bold text-sm uppercase tracking-wide">${o.status}</span></div></div>
            <div class="bg-gray-900 p-2 rounded text-gray-300 text-sm mb-2 border border-gray-700">${itemsHtml}</div>
            <div class="flex justify-between items-end"><div><span class="text-gray-400 text-xs block">Valor Total:</span><span class="text-white font-bold text-xl">${formatCurrency(o.total)}</span>${o.cupom ? `<span class="block text-green-500 text-xs">Cupom: ${o.cupom}</span>` : ''}</div>
            <div class="flex gap-2">
                ${o.status === 'Pendente' ? `
                    <button onclick="updateStatus('${o.id}', 'Confirmado', 'Pendente')" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded">Aprovar</button>
                    <button onclick="updateStatus('${o.id}', 'Cancelado', 'Pendente')" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded">Cancelar</button>
                ` : ''}
                ${o.status === 'Confirmado' ? `
                    <button onclick="updateStatus('${o.id}', 'Reembolsado', 'Confirmado')" class="border border-red-500 text-red-500 hover:bg-red-900 text-xs px-3 py-1 rounded">Estornar</button>
                ` : ''}
            </div></div>`;
        els.ordersList.appendChild(card);
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
    const toggleCart = () => els.cartModal.classList.toggle('hidden');
    const btnCart = getEl('cart-btn'); if (btnCart) btnCart.onclick = toggleCart;
    const btnCartMob = getEl('cart-btn-mobile'); if (btnCartMob) btnCartMob.onclick = toggleCart;
    const btnCloseCart = getEl('close-cart'); if (btnCloseCart) btnCloseCart.onclick = toggleCart;

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

    // Dentro de setupEventListeners...

    // Dentro de setupEventListeners...
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

    const btnAddProd = getEl('btn-add-product');
    if (btnAddProd) {
        btnAddProd.onclick = () => {
            getEl('form-product').reset();
            getEl('edit-prod-id').value = '';
            const checkNoStock = getEl('prod-allow-no-stock');
            if (checkNoStock) checkNoStock.checked = false;
            if (els.productFormModal) els.productFormModal.classList.remove('hidden');
        };
    }
    const btnCancelProd = getEl('btn-cancel-prod'); if (btnCancelProd) btnCancelProd.onclick = () => { if (els.productFormModal) els.productFormModal.classList.add('hidden'); };

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
                const imgEl = getEl('prod-img');
                const noStockEl = getEl('prod-allow-no-stock');
                const parseVal = (val) => val ? parseFloat(val.replace(/\./g, '').replace(',', '.')) : 0;

                const data = {
                    name: nameEl ? nameEl.value : 'Sem Nome',
                    category: catEl ? catEl.value : "Geral",
                    description: descEl ? descEl.value : '',
                    price: priceEl ? parseVal(priceEl.value) : 0,
                    promoPrice: promoEl && promoEl.value ? parseVal(promoEl.value) : null,
                    stock: stockEl ? parseInt(stockEl.value) : 0,
                    cost: costEl ? parseVal(costEl.value) : 0,
                    sizes: sizesEl ? sizesEl.value.split(',').map(s => s.trim()) : [],
                    images: imgEl ? [imgEl.value] : [],
                    allowNoStock: noStockEl ? noStockEl.checked : false,
                    code: idEl && idEl.value ? undefined : Math.floor(10000 + Math.random() * 90000).toString()
                };

                if (data.code === undefined) delete data.code;
                const id = idEl ? idEl.value : '';

                if (id) { await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data); }
                else { await addDoc(collection(db, `sites/${state.siteId}/products`), data); }
                if (els.productFormModal) els.productFormModal.classList.add('hidden');
                e.target.reset();
            } catch (err) { alert("Erro ao salvar produto: " + err.message); }
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

    const modal = getEl('product-modal');
    const backdrop = getEl('modal-backdrop');
    const card = getEl('modal-card');
    if (!modal) return;

    getEl('modal-img').src = p.images ? p.images[0] : 'https://placehold.co/600';
    getEl('modal-title').innerText = p.name;
    getEl('modal-desc').innerText = p.description || "Sem descrição detalhada.";

    const price = p.promoPrice || p.price;
    getEl('modal-price').innerHTML = formatCurrency(price);

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
            if (s === selectedSizeInModal) {
                btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
                btn.classList.remove('text-gray-300', 'border-gray-600');
            }
            btn.onclick = () => {
                selectedSizeInModal = s;
                document.querySelectorAll('#modal-sizes button').forEach(b => {
                    b.className = "w-12 h-12 rounded-lg border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center";
                });
                btn.classList.remove('text-gray-300', 'border-gray-600');
                btn.classList.add('bg-yellow-500', 'text-black', 'border-yellow-500');
            };
            sizesDiv.appendChild(btn);
        });
    } else {
        if (sizesWrapper) sizesWrapper.classList.add('hidden');
    }

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

        btnAdd.onclick = () => {
            addToCart(p, selectedSizeInModal);
            closeProductModal();
        };
    }

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

window.openImageViewer = (src) => {
    const viewer = getEl('image-viewer');
    const img = getEl('image-viewer-src');
    img.src = src;
    viewer.classList.remove('hidden');
    viewer.classList.add('flex');
    viewer.onclick = (e) => { if (e.target === viewer) closeImageViewer(); };
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
    getEl('edit-prod-id').value = p.id; getEl('prod-name').value = p.name;
    const catSelect = getEl('prod-cat-select'); if (catSelect && p.category) catSelect.value = p.category;
    getEl('prod-desc').value = p.description; getEl('prod-price').value = p.price;
    getEl('prod-promo').value = p.promoPrice || ''; getEl('prod-stock').value = p.stock;
    getEl('prod-cost').value = p.cost || ''; getEl('prod-sizes').value = p.sizes ? p.sizes.join(',') : '';
    getEl('prod-img').value = p.images ? p.images[0] : '';
    const checkNoStock = getEl('prod-allow-no-stock'); if (checkNoStock) checkNoStock.checked = p.allowNoStock || false;
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
        }
        renderStoreProfile(); // Atualiza a Sidebar
        fillProfileForm();    // Preenche o form do Admin se estiver aberto
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

function fillProfileForm() {
    const p = state.storeProfile;
    if (els.confStoreName) els.confStoreName.value = p.name || '';
    if (els.confStoreLogo) els.confStoreLogo.value = p.logo || '';
    if (els.confStoreWpp) els.confStoreWpp.value = p.whatsapp || '';
    if (els.confStoreInsta) els.confStoreInsta.value = p.instagram || '';
    if (els.confStoreFace) els.confStoreFace.value = p.facebook || '';
    if (els.confStoreAddress) els.confStoreAddress.value = p.address || '';
    if (els.confStoreDesc) els.confStoreDesc.value = p.description || '';
}

async function saveStoreProfile() {
    const data = {
        name: els.confStoreName.value.trim(),
        logo: els.confStoreLogo.value.trim(),
        whatsapp: els.confStoreWpp.value.trim().replace(/\D/g, ''), // Salva só números
        instagram: els.confStoreInsta.value.trim(),
        facebook: els.confStoreFace.value.trim(),
        address: els.confStoreAddress.value.trim(),
        description: els.confStoreDesc.value.trim()
    };

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), data);
        showToast('Perfil da loja atualizado!', 'success');
    } catch (error) {
        console.error(error);
        showToast('Erro ao salvar perfil.', 'error');
    }
}