import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs, getDoc, runTransaction, limit } from './firebase-config.js';
import { initStatsModule, updateStatsData } from './stats.js';
import { checkAndActivateSupport, initSupportModule } from './support.js';

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

    const rua = customer.street || "Rua não informada";
    const numero = customer.addressNum || "S/N";
    const bairro = customer.district || "";
    const cep = customer.cep || "";
    const complemento = customer.comp ? ` - ${customer.comp}` : "";

    const fullAddress = `${rua}, ${numero}${complemento} - ${bairro} - CEP: ${cep}`;
    const AddressMaps = `${rua}, ${numero} - ${bairro} - CEP: ${cep}`;
    const safeAddress = fullAddress.replace(/'/g, "\\'");
    const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(AddressMaps)}`;

    return `
        <div class="flex flex-col gap-2">
            <div class="flex flex-col text-left">
                <span class="text-gray-200 font-bold text-xs leading-tight">
                    ${rua}, ${numero}${complemento}
                </span>
                <span class="text-gray-400 text-[10px] mt-0.5">
                    ${bairro} - ${cep}
                </span>
            </div>
            <div class="flex gap-2 mt-1">
                <button type="button" onclick="event.stopPropagation(); navigator.clipboard.writeText('${safeAddress}').then(() => showToast('Endereço copiado!')).catch(() => alert('Copiado!'))" 
                    class="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-[10px] px-2 py-1 rounded border border-gray-600 transition flex items-center gap-1" 
                    title="Copiar Endereço">
                    <i class="fas fa-copy"></i> Copiar
                </button>
                <a href="${mapLink}" target="_blank" onclick="event.stopPropagation();"
                    class="bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 hover:text-blue-300 text-[10px] px-2 py-1 rounded border border-blue-900/50 transition flex items-center gap-1" 
                    title="Abrir no Google Maps">
                    <i class="fas fa-map-marker-alt"></i> Maps
                </a>
            </div>
        </div>
    `;
}

// --- FUNÇÕES DE IMAGEM ---
async function processImageFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = 800 / Math.max(img.width, img.height, 800);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}

// --- CARROSSEL DE IMAGENS ---
window.changeViewerImage = (delta) => {
    changeModalImage(delta);
    const p = state.products.find(x => x.id === state.focusedProductId);
    if (p && p.images) {
        const img = getEl('image-viewer-src');
        img.style.opacity = '0.5';
        setTimeout(() => {
            img.src = p.images[state.currentImgIndex];
            img.style.opacity = '1';
            if (isZoomed) {
                isZoomed = false;
                img.style.transform = "scale(1)";
                img.style.cursor = "zoom-in";
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
    imgEl.style.opacity = '0.5';
    setTimeout(() => {
        imgEl.src = images[state.currentImgIndex];
        imgEl.style.opacity = '1';
    }, 150);

    if (images.length > 1) {
        thumbnailsEl.innerHTML = images.map((src, idx) => {
            const isActive = idx === state.currentImgIndex;
            const border = isActive ? 'border-yellow-500 scale-110' : 'border-gray-600 opacity-60 hover:opacity-100';
            return `<img src="${src}" onclick="event.stopPropagation(); setModalImage(${idx})" class="w-12 h-12 object-cover rounded border-2 ${border} cursor-pointer transition-all duration-200 shadow-lg bg-black">`;
        }).join('');
    } else {
        thumbnailsEl.innerHTML = '';
    }
}

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
        div.innerHTML = `<img src="${imgSrc}" class="w-full h-full object-cover"><button type="button" onclick="removeTempImage(${index})" class="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"><i class="fas fa-trash text-red-500"></i></button>`;
        container.appendChild(div);
    });
}

window.removeTempImage = (index) => {
    state.tempImages.splice(index, 1);
    renderImagePreviews();
};

function showToast(message, type = 'success') {
    let toast = document.getElementById('toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-notification';
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded shadow-2xl z-[100] transition-all duration-300 opacity-0 translate-y-[-20px] border border-gray-700 font-bold flex items-center gap-2';
        document.body.appendChild(toast);
    }
    const icon = type === 'success' ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-info-circle text-yellow-500"></i>';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    requestAnimationFrame(() => { toast.classList.remove('opacity-0', 'translate-y-[-20px]'); });
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-y-[-20px]'); }, 1500);
}

window.toggleOrderAccordion = (id) => {
    const content = document.getElementById(`order-content-${id}`);
    const arrow = document.getElementById(`order-arrow-${id}`);
    const headerInfo = document.getElementById(`order-header-info-${id}`); 
    const headerContainer = document.getElementById(`order-header-${id}`); 

    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        arrow.style.transform = 'rotate(180deg)';
        if (headerInfo) headerInfo.classList.add('hidden');
        headerContainer.classList.remove('rounded-xl');
        headerContainer.classList.add('rounded-t-xl');
    } else {
        content.classList.add('hidden');
        arrow.style.transform = 'rotate(0deg)';
        if (headerInfo) headerInfo.classList.remove('hidden');
        headerContainer.classList.add('rounded-xl');
        headerContainer.classList.remove('rounded-t-xl');
    }
};

async function getNextProductCode(siteId) {
    const counterRef = doc(db, `sites/${siteId}/settings`, 'productCounter');
    try {
        const counterSnap = await getDoc(counterRef);
        let newCount = 1;
        if (counterSnap.exists()) {
            newCount = (counterSnap.data().current || 0) + 1;
        }
        await setDoc(counterRef, { current: newCount }, { merge: true });
        return newCount;
    } catch (error) {
        console.error("Erro ao gerar código (Quota ou Permissão):", error);
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
    orders: [], 
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: null,
    myOrders: JSON.parse(localStorage.getItem('site_orders_history')) || [],
    activeOrder: null, 
    currentCoupon: null,
    isDarkMode: true,
    tempImages: [],
    selectedProducts: new Set(),
    storeProfile: {
        name: 'Veste Manto',
        logo: '',
        whatsapp: '',
        description: '',
        installments: { active: false },
        deliveryConfig: { ownDelivery: false, cancelTimeMin: 5 },
        tempLogo: null,
    },
    dashDate: new Date(),
    dashViewMode: 'month',
    statsDate: new Date(),
    statsViewMode: 'month',
    statsFilterType: 'all',
    dailyStats: [],
    siteStats: { visits: 0, shares: 0 },
    editingCouponId: null,
    focusedCouponIndex: -1,
    focusedProductId: null,
    selectedCategoryParent: null,
    globalSettings: { allowNoStock: false },
    cardSelections: {},
    isSelectionMode: false, 
    sortConfig: { key: 'code', direction: 'desc' },
    salesLimit: 100,        
    salesUnsubscribe: null 
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
    sidebarStoreLogo: getEl('sidebar-store-logo'),
    sidebarStoreName: getEl('sidebar-store-name'),
    sidebarStoreDesc: getEl('sidebar-store-desc'),
    linkWhatsapp: getEl('link-whatsapp'),
    linkInstagram: getEl('link-instagram'),
    linkFacebook: getEl('link-facebook'),
    btnShowAddress: getEl('btn-show-address'),
    confStoreName: getEl('conf-store-name'),
    confStoreLogo: getEl('conf-store-logo'),
    confStoreWpp: getEl('conf-store-wpp'),
    confStoreInsta: getEl('conf-store-insta'),
    confStoreFace: getEl('conf-store-face'),
    confStoreAddress: getEl('conf-store-address'),
    confStoreDesc: getEl('conf-store-desc'),
    btnSaveProfile: getEl('btn-save-profile'),
    confStoreCep: getEl('conf-store-cep'),
    confMaxDist: getEl('conf-max-dist'),
    btnAccInstallments: getEl('btn-acc-installments'),
    contentAccInstallments: getEl('content-acc-installments'),
    arrowAccInstallments: getEl('arrow-acc-installments'),
    confCardActive: getEl('conf-card-active'),
    confCardDetails: getEl('conf-card-details'),
    confCardMax: getEl('conf-card-max'),
    confCardFree: getEl('conf-card-free'),
    confCardRate: getEl('conf-card-rate'),
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
    btnCheckout: getEl('btn-checkout'), 
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
    loadSiteStats();
    incrementVisitsCounter();
    loadSettings();
    loadCategories();
    loadProducts();
    loadStoreProfile(); 
    loadCoupons();      
    updateCartUI();
    startBackgroundListeners(); 
    initStatsModule();
    loadTheme();

    setInterval(() => {
        if (state.storeProfile) window.updateStoreStatusUI();
    }, 60000);

    if (localStorage.getItem('theme') === 'light') toggleTheme(false);

    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';
        if (els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `<i class="fas fa-user-shield text-white group-hover:text-white transition"></i><span class="font-bold uppercase text-sm tracking-wide">${btnText}</span>`;
        }
        const btnLoginNav = getEl('btn-admin-login');
        if (btnLoginNav) btnLoginNav.innerText = btnText;

        if (user) {
            filterAndRenderProducts();
            loadAdminSales(); 
            setTimeout(() => { if (window.checkFooter) window.checkFooter(); }, 100);
        } else {
            showView('catalog');
            setTimeout(() => { if (window.checkFooter) window.checkFooter(); }, 100);
        }
    });

    setInterval(() => {
        if (state.coupons.length > 0 && !getEl('view-admin').classList.contains('hidden')) {
            renderAdminCoupons();
        }
    }, 10000);

    const savedHistory = localStorage.getItem('site_orders_history');
    if (savedHistory) state.myOrders = JSON.parse(savedHistory);
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
        setupDeliveryDependency()
        renderCatalog(state.products);
    });
}

function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatalog(state.products);
        if (state.user) filterAndRenderProducts();
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

// OTIMIZADO: Adicionado limit(100) para economizar leituras e chamado fetchGlobalStats
function loadAdminSales() {
    if (state.salesUnsubscribe) state.salesUnsubscribe();

    // 1. Carrega LISTA (Limitada para performance)
    const qList = query(
        collection(db, `sites/${state.siteId}/sales`), 
        orderBy('date', 'desc'), 
        limit(state.salesLimit)
    );

    state.salesUnsubscribe = onSnapshot(qList, (snapshot) => {
        // Salva na memória apenas os 100 últimos
        state.orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Notificações
        const newOrdersCount = state.orders.filter(o => !o.viewed).length;
        const salesBtn = document.getElementById('admin-menu-sales');
        if (salesBtn) {
            salesBtn.innerHTML = newOrdersCount > 0 
                ? `Vendas <span class="ml-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">${newOrdersCount}</span>`
                : 'Vendas';
        }
        document.title = newOrdersCount > 0 ? `(${newOrdersCount}) Painel Admin` : 'Painel Admin';

        // Renderiza a tabela visual
        if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
        
        // Botão Carregar Mais
        renderLoadMoreButton(snapshot.size);

        // --- CHAMADA DO CÁLCULO GLOBAL (ESTATÍSTICAS) ---
        // Chama direto para garantir que os dados apareçam
        fetchGlobalStats(); 
    });
}

// NOVA FUNÇÃO: Calcula estatísticas baixando os dados (Contorna erro de Cota de Agregação e Índice)
async function fetchGlobalStats() {
    console.log(">>> Iniciando cálculo global de estatísticas...");
    
    const elCount = document.getElementById('stat-sales-count');
    const elTotal = document.getElementById('stat-sales-total');
    const elCost = document.getElementById('stat-cost-total');
    const elProfit = document.getElementById('stat-profit-total');
    const headerCount = document.getElementById('orders-count');
    const headerTotal = document.getElementById('orders-filtered-total');

    try {
        const querySnapshot = await getDocs(collection(db, `sites/${state.siteId}/sales`));

        let totalPedidos = 0;
        let faturamentoTotal = 0;
        let custoTotal = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            totalPedidos++;
            
            const valVenda = parseFloat(data.total);
            if (!isNaN(valVenda)) faturamentoTotal += valVenda;

            const valCusto = parseFloat(data.totalCost);
            if (!isNaN(valCusto)) custoTotal += valCusto;
        });

        const lucroLiquido = faturamentoTotal - custoTotal;

        // --- ATUALIZAÇÃO FORÇADA DA TELA ---
        if (elCount) elCount.innerText = totalPedidos;
        if (elTotal) elTotal.innerText = formatCurrency(faturamentoTotal);
        if (elCost) elCost.innerText = formatCurrency(custoTotal);
        
        if (elProfit) {
            elProfit.innerText = formatCurrency(lucroLiquido);
            elProfit.className = lucroLiquido >= 0 
                ? "text-3xl font-bold text-green-500" 
                : "text-3xl font-bold text-red-500";
        }

        // Header da Lista (Apenas se não houver busca digitada)
        const searchInput = document.getElementById('filter-search-general');
        if (!searchInput || searchInput.value === '') {
            if (headerCount) headerCount.innerText = totalPedidos;
            if (headerTotal) {
                headerTotal.innerText = formatCurrency(faturamentoTotal);
                const label = headerTotal.previousElementSibling;
                if (label) label.innerText = 'TOTAL GLOBAL';
            }
        }
        console.log("✅ Estatísticas Globais Atualizadas:", { totalPedidos, faturamentoTotal, custoTotal });

    } catch (error) {
        console.error("❌ Erro estatísticas:", error);
    }
}

function renderLoadMoreButton(currentCount) {
    const container = document.getElementById('orders-list'); 
    if (!container) return;

    const oldBtn = document.getElementById('btn-load-more-sales');
    if (oldBtn) oldBtn.remove();

    if (currentCount < state.salesLimit) return;

    const btn = document.createElement('button');
    btn.id = 'btn-load-more-sales';
    btn.className = "w-full py-3 mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-xl border border-gray-700 transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide";
    btn.innerHTML = `<i class="fas fa-plus-circle"></i> Carregar mais vendas`;
    
    btn.onclick = () => {
        btn.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> Carregando...`;
        state.salesLimit += 100; 
        loadAdminSales();        
    };

    container.appendChild(btn);
}

window.openAdminOrderDetail = async (order) => {
    if (!order.viewed) {
        try {
            const orderRef = doc(db, `sites/${state.siteId}/sales`, order.id);
            updateDoc(orderRef, { viewed: true });
        } catch (e) { console.error("Erro ao marcar visto:", e); }
    }
    const idEl = document.getElementById('admin-order-id-display');
    const nameEl = document.getElementById('admin-client-name');
    const phoneEl = document.getElementById('admin-client-phone');
    const addrEl = document.getElementById('admin-client-address');
    const itemsEl = document.getElementById('admin-order-items');
    const totalEl = document.getElementById('admin-order-total');
    const statusSelect = document.getElementById('admin-order-status-select');

    if (idEl) idEl.innerText = `#${order.code || order.id.slice(0, 6)}`;
    if (nameEl) nameEl.innerText = order.customer?.name || 'Cliente Sem Nome';
    if (phoneEl) phoneEl.innerText = order.customer?.phone || '-';

    if (addrEl) {
        if (typeof formatarEnderecoAdmin === 'function') {
            addrEl.innerHTML = formatarEnderecoAdmin(order.customer);
        } else {
            addrEl.innerText = order.customer?.address || 'Endereço não informado';
        }
    }

    if (itemsEl) {
        itemsEl.innerHTML = (order.items || []).map(i => `
            <div class="flex justify-between py-2 border-b border-gray-700 text-sm">
                <div><span class="text-yellow-500 font-bold">${i.qty}x</span> ${i.name}</div>
                <div class="text-white">${formatCurrency(i.price * i.qty)}</div>
            </div>
        `).join('');

        if (order.shippingFee > 0) {
            itemsEl.innerHTML += `
                <div class="flex justify-between py-2 border-b border-gray-700 text-sm text-gray-400">
                    <div>Frete</div>
                    <div>+ ${formatCurrency(order.shippingFee)}</div>
                </div>`;
        }
    }
    if (totalEl) totalEl.innerText = formatCurrency(order.total);
    if (statusSelect) {
        statusSelect.value = order.status;
        statusSelect.setAttribute('onchange', `handleStatusChange(this, '${order.id}')`);
    }
    const btnCancel = document.getElementById('btn-admin-cancel-order');
    const btnFinish = document.getElementById('btn-admin-finish-order');
    if (btnCancel) btnCancel.onclick = () => adminCancelOrder(order.id);
    if (btnFinish) btnFinish.onclick = () => adminFinalizeOrder(order.id);

    const modal = document.getElementById('modal-admin-order');
    if (modal) modal.classList.remove('hidden');
};

function loadSiteStats() {
    const q = query(collection(db, `sites/${state.siteId}/dailyStats`));
    onSnapshot(q, (snapshot) => {
        const dailyData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.dailyStats = dailyData; 
        updateStatsData(state.orders, state.products, state.dailyStats);
    });
}

async function logDailyStat(type) {
    const today = new Date().toISOString().split('T')[0]; 
    const docRef = doc(db, `sites/${state.siteId}/dailyStats`, today);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const currentVal = docSnap.data()[type] || 0;
            await updateDoc(docRef, { [type]: currentVal + 1 });
        } else {
            await setDoc(docRef, {
                visits: type === 'visits' ? 1 : 0,
                shares: type === 'shares' ? 1 : 0
            });
        }
    } catch (e) {
        console.error("Erro ao logar stat:", e);
    }
}

async function incrementVisitsCounter() {
    if (auth.currentUser) return;
    if (sessionStorage.getItem('visit_logged')) return;
    sessionStorage.setItem('visit_logged', 'true');
    logDailyStat('visits');
}

// =================================================================
// 5. CÁLCULO E RENDERIZAÇÃO DE ESTATÍSTICAS
// =================================================================

function updateStatsUI() {
    if (state.statsFilterType === 'all') {
        if (els.statsFilterAll) {
            els.statsFilterAll.classList.replace('text-black', 'text-black'); 
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
    // 1. Capital de Giro
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

    // 2. Filtragem Local
    if (!state.orders) return;
    
    let filteredOrders = state.orders;
    if (state.statsFilterType === 'period') {
        filteredOrders = state.orders.filter(o => {
            const orderDate = new Date(o.date);
            const statsDate = state.statsDate;
            const sameYear = orderDate.getFullYear() === statsDate.getFullYear();
            const sameMonth = orderDate.getMonth() === statsDate.getMonth();
            const sameDay = orderDate.getDate() === statsDate.getDate();
            if (state.statsViewMode === 'month') return sameYear && sameMonth;
            return sameYear && sameMonth && sameDay;
        });
    }

    // 3. Cálculos Locais
    let countRefunded = 0, countCancelled = 0, countPending = 0;
    let totalSalesValue = 0, totalSalesCount = 0, totalCost = 0;

    filteredOrders.forEach(o => {
        const status = o.status || '';
        if (status === 'Reembolsado') countRefunded++;
        if (status.includes('Cancelado')) countCancelled++;
        if (status === 'Aguardando aprovação' || status === 'Pendente') countPending++;
        
        if (status === 'Confirmado' || status === 'Entregue' || status === 'Concluído') {
            totalSalesCount++;
            totalSalesValue += parseFloat(o.total || 0);
            totalCost += parseFloat(o.totalCost || 0);
        }
    });

    const totalProfit = totalSalesValue - totalCost;

    // --- CORREÇÃO: SÓ ATUALIZA OS TOTAIS SE NÃO FOR 'ALL' ---
    if (state.statsFilterType !== 'all') {
        if (els.statSalesCount) els.statSalesCount.innerText = totalSalesCount;
        if (els.statSalesTotal) els.statSalesTotal.innerText = formatCurrency(totalSalesValue);
        if (els.statCostTotal) els.statCostTotal.innerText = formatCurrency(totalCost);
        if (els.statProfitTotal) {
            els.statProfitTotal.innerText = formatCurrency(totalProfit);
            els.statProfitTotal.className = totalProfit >= 0 ? "text-3xl font-bold text-green-500" : "text-3xl font-bold text-red-500";
        }
    } else {
        setTimeout(fetchGlobalStats, 50);
    }

    if (els.statRefunded) els.statRefunded.innerText = countRefunded;
    if (els.statCancelled) els.statCancelled.innerText = countCancelled;
    if (els.statPending) els.statPending.innerText = countPending;

    const totalLoaded = filteredOrders.length;
    const approvalRate = totalLoaded > 0 ? (totalSalesCount / totalLoaded) * 100 : 0;
    if (els.statRateApproval) els.statRateApproval.innerText = Math.round(approvalRate) + '%';
    
    if (typeof calculateTrend30 === 'function') calculateTrend30();
}

function calculateTrend30() {
    const now = new Date();
    const last30 = new Date(); last30.setDate(now.getDate() - 30);
    const prior30 = new Date(); prior30.setDate(last30.getDate() - 30);

    let salesLast30 = 0;
    let salesPrior30 = 0;

    state.orders.forEach(o => {
        if (o.status !== 'Confirmado') return;
        const d = new Date(o.date);
        if (d >= last30 && d <= now) {
            salesLast30 += o.total;
        }
        else if (d >= prior30 && d < last30) {
            salesPrior30 += o.total;
        }
    });

    let trend = 0;
    if (salesPrior30 === 0) {
        trend = salesLast30 > 0 ? 100 : 0; 
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

function renderCatalog(productsToRender) {
    if (!els.grid) return;
    els.grid.innerHTML = '';
    let filtered = [...productsToRender];
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase();
    const catTerm = document.getElementById('category-filter')?.value;

    if (productsToRender === state.products) {
        if (searchTerm) {
            filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.code && String(p.code).includes(searchTerm)));
        }
        if (catTerm) {
            filtered = filtered.filter(p => p.category === catTerm || (p.category && p.category.startsWith(catTerm + ' -')));
        }
    }

    const sortMode = document.getElementById('sort-filter')?.value || 'vitrine';
    filtered.sort((a, b) => {
        const priceA = parseFloat(a.promoPrice || a.price) || 0;
        const priceB = parseFloat(b.promoPrice || b.price) || 0;
        const codeA = parseInt(a.code) || 0;
        const codeB = parseInt(b.code) || 0;
        const isSoldOutA = a.stock <= 0 && (!state.globalSettings.allowNoStock && !a.allowNoStock);
        const isSoldOutB = b.stock <= 0 && (!state.globalSettings.allowNoStock && !b.allowNoStock);
        if (isSoldOutA && !isSoldOutB) return 1;
        if (!isSoldOutA && isSoldOutB) return -1;

        switch (sortMode) {
            case 'vitrine':
                if (a.highlight === true && b.highlight !== true) return -1;
                if (a.highlight !== true && b.highlight === true) return 1;
                const hasOfferA = (a.promoPrice && parseFloat(a.promoPrice) > 0);
                const hasOfferB = (b.promoPrice && parseFloat(b.promoPrice) > 0);
                if (hasOfferA && !hasOfferB) return -1;
                if (!hasOfferA && hasOfferB) return 1;
                return codeB - codeA;
            case 'price-asc': return priceA - priceB;
            case 'price-desc': return priceB - priceA;
            case 'name-asc': return (a.name || '').localeCompare(b.name || '');
            default: return codeB - codeA;
        }
    });

    if (filtered.length === 0) {
        els.grid.innerHTML = `<div class="col-span-2 md:col-span-4 text-center py-10 opacity-50"><i class="fas fa-search text-4xl mb-2"></i><p>Nenhum produto encontrado.</p></div>`;
        return;
    }

    const pixGlobal = state.storeProfile.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };
    const globalInst = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3 };

    filtered.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;
        const currentPrice = parseFloat(p.promoPrice || p.price);
        let pixHtml = '';

        if (!pixGlobal.disableAll) {
            if (pixGlobal.active && pixGlobal.value > 0) {
                const isFixed = (pixGlobal.type === 'fixed');
                const labelOff = isFixed ? `R$ ${formatCurrency(pixGlobal.value)} OFF` : `${pixGlobal.value}% OFF`;
                if (pixGlobal.mode === 'total') {
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-tag mr-1"></i>${labelOff} no Pix (Total)</p>`;
                } else {
                    let valDesconto = 0;
                    if (isFixed) { valDesconto = pixGlobal.value; } else { valDesconto = currentPrice * (pixGlobal.value / 100); }
                    const finalPix = Math.max(0, currentPrice - valDesconto);
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-bolt mr-1"></i>${formatCurrency(finalPix)} no Pix</p>`;
                }
            } else if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
                const pix = p.paymentOptions.pix;
                let finalPix = currentPrice;
                if (pix.type === 'percent') { finalPix = currentPrice * (1 - (pix.val / 100)); } else { finalPix = Math.max(0, currentPrice - pix.val); }
                pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-bolt mr-1"></i>${formatCurrency(finalPix)} no Pix</p>`;
            }
        }

        let installmentHtml = '';
        if (globalInst.active) {
            if (globalInst.freeUntil > 1) {
                const parcVal = currentPrice / globalInst.freeUntil;
                installmentHtml = `<p class="text-gray-400 text-[10px] mt-0.5">${globalInst.freeUntil}x de ${formatCurrency(parcVal)} sem juros</p>`;
            } else {
                installmentHtml = `<p class="text-gray-400 text-[10px] mt-0.5">Em até ${globalInst.max}x no cartão</p>`;
            }
        }

        const imgUrl = p.images && p.images.length > 0 ? p.images[0] : 'https://placehold.co/400?text=Sem+Foto';
        const priceDisplay = p.promoPrice ?
            `<div class="flex flex-col"><span class="text-gray-500 line-through text-[10px]">${formatCurrency(p.price)}</span><span class="text-[var(--txt-price)] font-bold text-base">${formatCurrency(p.promoPrice)}</span></div>` :
            `<span class="text-[var(--txt-price)] font-bold text-base">${formatCurrency(p.price)}</span>`;

        const imgOpacity = isOut ? 'opacity-50 grayscale' : '';
        let badgesHtml = '';
        if (p.highlight || p.promoPrice) {
            badgesHtml = `<div class="absolute top-2 left-2 flex flex-col gap-1 z-20 pointer-events-none">`;
            if (!!p.highlight) badgesHtml += `<span class="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 animate-pulse"><i class="fas fa-star text-[8px]"></i> DESTAQUE</span>`;
            if (p.promoPrice) badgesHtml += `<span class="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg">OFERTA</span>`;
            badgesHtml += `</div>`;
        }

        const card = document.createElement('div');
        card.className = "product-card bg-[var(--bg-card)] border border-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 flex flex-col h-full group relative cursor-pointer active:scale-95";
        card.onclick = () => openProductModal(p.id);

        card.innerHTML = `
            <div class="relative w-full aspect-[4/5] bg-gray-900 overflow-hidden">
                <img src="${imgUrl}" class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${imgOpacity}">
                ${isOut ? `<div class="absolute inset-0 flex items-center justify-center z-10"><span class="bg-red-600 text-white font-bold px-4 py-1 rounded shadow-lg transform -rotate-6 text-xs uppercase tracking-wide">Esgotado</span></div>` : ''}
                ${badgesHtml}
            </div>
            <div class="p-3 flex flex-col flex-1">
                <h3 class="text-white font-bold text-xs leading-tight line-clamp-2 mb-1 group-hover:text-yellow-500 transition">${p.name}</h3>
                <div class="mt-auto pt-2 border-t border-gray-800/50">
                    ${priceDisplay}
                    ${pixHtml}
                    ${installmentHtml}
                </div>
            </div>
        `;
        els.grid.appendChild(card);
    });
}
//