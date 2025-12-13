import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs } from './firebase-config.js';

// --- ESTADO GLOBAL ---
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
    selectedProducts: new Set(),
    focusedProductId: null,
    globalSettings: { allowNoStock: false },
    selectedCategoryParent: null,
    dashDate: new Date(),
    dashViewMode: 'month'
};

// --- DOM ELEMENTS ---
const getEl = (id) => document.getElementById(id);
const els = {
    grid: getEl('product-grid'),
    cartCount: getEl('cart-count'),
    cartCountMobile: getEl('cart-count-mobile'),
    cartModal: getEl('cart-modal'),
    cartItems: getEl('cart-items'),
    modalProduct: getEl('product-modal'),
    searchInput: getEl('search-input'),
    catFilter: getEl('category-filter'),
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
    ordersSummaryBar: getEl('orders-summary-bar')
};

// --- HELPER DE FORMATAÇÃO ---
const formatCurrency = (value) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- INIT ---
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

    if (localStorage.getItem('theme') === 'light') toggleTheme(false);

    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';
        const btnLoginNav = getEl('btn-admin-login');
        if (btnLoginNav) btnLoginNav.innerText = btnText;

        if (els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `<i class="fas fa-user-shield w-6 text-yellow-500 group-hover:text-white transition"></i><span class="font-medium">${btnText}</span>`;
        }
        if (user) { renderAdminProducts(); } else { showView('catalog'); }
    });
}

function loadSettings() {
    const docRef = doc(db, `sites/${state.siteId}/settings`, 'general');
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            state.globalSettings = docSnap.data();
            if (els.toggleStockGlobal) els.toggleStockGlobal.checked = state.globalSettings.allowNoStock;
        } else {
            setDoc(docRef, { allowNoStock: false });
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

// --- LOAD DATA ---
function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatalog(state.products);
        if (state.user) renderAdminProducts();
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

// --- RENDERIZADORES ---

function renderCatalog(products) {
    if (!els.grid) return;
    els.grid.innerHTML = '';
    products.forEach(p => {
        const isOut = p.stock <= 0;
        const priceDisplay = p.promoPrice ?
            `<span class="text-gray-500 line-through text-xs">${formatCurrency(p.price)}</span> <span class="text-green-600 font-bold">${formatCurrency(p.promoPrice)}</span>` :
            `<span class="text-green-500 font-bold">${formatCurrency(p.price)}</span>`;
        const card = document.createElement('div');
        card.className = "product-card bg-gray-800 rounded-lg overflow-hidden shadow-lg card-hover cursor-pointer relative group transition-colors duration-300";
        card.innerHTML = `
            <div class="relative pb-[100%] bg-gray-200">
                <img src="${p.images ? p.images[0] : 'https://placehold.co/400x400/111/FFF?text=Sem+Foto'}" class="absolute h-full w-full object-cover">
                ${isOut ? '<div class="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white font-bold">ESGOTADO</div>' : ''}
            </div>
            <div class="p-3">
                <h3 class="text-white font-bold truncate transition-colors">${p.name}</h3>
                <p class="text-gray-500 text-xs truncate mb-2">${p.description}</p>
                <div class="flex justify-between items-center">
                    ${priceDisplay}
                    <span class="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded">${p.sizes ? p.sizes[0] : 'U'}</span>
                </div>
            </div>`;
        card.onclick = () => openProductModal(p);
        els.grid.appendChild(card);
    });
    if (!state.isDarkMode) updateCardStyles(true);
}

// Lógica de Categorias (Sidebar Recursiva + Selects)
function renderCategories() {
    const catNames = state.categories.map(c => c.name);

    // 1. Preenche Selects (Filtros e Formulário de Produto)
    const populateSelect = (selectEl) => {
        if (!selectEl) return;
        // Salva seleção atual se houver
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
    populateSelect(getEl('prod-cat-select')); // Preenche o select do Modal de Produto

    // 2. Sidebar Hierárquica (Recursiva)
    if (els.sidebarCategories) {
        // Converte lista plana em árvore
        const tree = {};
        catNames.forEach(name => {
            const parts = name.split(' - ');
            let currentLevel = tree;
            parts.forEach((part, index) => {
                // Cria o nó se não existir
                if (!currentLevel[part]) {
                    // Reconstrói o caminho completo para usar no filtro
                    const fullPath = parts.slice(0, index + 1).join(' - ');
                    currentLevel[part] = { _path: fullPath, _children: {} };
                }
                currentLevel = currentLevel[part]._children;
            });
        });

        // Função recursiva para gerar HTML com <details>
        const buildHtml = (node, level = 0) => {
            let html = '';
            const keys = Object.keys(node).sort();

            keys.forEach(key => {
                const item = node[key];
                const hasChildren = Object.keys(item._children).length > 0;
                const indent = level * 10;

                // Estilo
                const textStyle = level === 0
                    ? 'font-bold text-yellow-500 text-sm uppercase'
                    : 'text-gray-400 text-sm hover:text-white';

                if (hasChildren) {
                    html += `
                        <details class="group mb-1">
                            <summary class="list-none flex items-center cursor-pointer p-1 rounded hover:bg-gray-800 transition" style="margin-left:${indent}px">
                                <span class="transition-transform duration-300 group-open:rotate-90 text-gray-500 mr-2 text-xs">▶</span>
                                <span class="${textStyle}" onclick="filterByCat('${item._path}'); event.preventDefault();">${key}</span>
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
                                onclick="filterByCat('${item._path}')">
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

// Lista Admin de Categorias
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

// --- DASHBOARD E VENDAS ---
function loadAdminSales() {
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));
    onSnapshot(q, (snapshot) => {
        state.orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        filterAndRenderSales();
        updateDashboardMetrics();
    });
}

function updateDashboardUI() {
    const date = state.dashDate;
    if (state.dashViewMode === 'day') {
        els.dashDateDisplay.innerText = date.toLocaleDateString('pt-BR');
        els.checkDay.classList.add('bg-green-500', 'border-none');
        els.checkMonth.classList.remove('bg-green-500', 'border-none');
    } else {
        // CORREÇÃO: Formato Numérico MM/YYYY
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

if (els.dashPrevDate) els.dashPrevDate.onclick = () => {
    if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() - 1);
    else state.dashDate.setMonth(state.dashDate.getMonth() - 1);
    updateDashboardUI();
};
if (els.dashNextDate) els.dashNextDate.onclick = () => {
    if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() + 1);
    else state.dashDate.setMonth(state.dashDate.getMonth() + 1);
    updateDashboardUI();
};
if (els.btnViewDay) els.btnViewDay.onclick = () => { state.dashViewMode = 'day'; updateDashboardUI(); };
if (els.btnViewMonth) els.btnViewMonth.onclick = () => { state.dashViewMode = 'month'; updateDashboardUI(); };

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

// --- CONTROLE DE ESTOQUE ---
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
                const newStock = Math.max(0, prodInState.stock - item.qty);
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

// --- DEMAIS FUNÇÕES ---
function renderAdminCoupons() {
    if (!els.couponListAdmin) return;
    els.couponListAdmin.innerHTML = state.coupons.map(c => {
        const typeDisplay = c.type === 'percent' ? `<span class="text-green-400 font-bold">${c.val}%</span>` : `<span class="text-green-400 font-bold">${formatCurrency(c.val)}</span>`;
        const expiryDisplay = c.expiryDate ?
            `<span class="text-xs text-white">Expira em: <span class="font-bold">${new Date(c.expiryDate).toLocaleString()}</span></span>` :
            `<span class="text-xs text-green-500 font-bold">∞ Permanente</span>`;
        return `
            <div class="bg-gray-800 border-l-4 border-green-500 p-3 rounded flex justify-between items-center shadow-sm">
                <div class="flex flex-col">
                    <span class="text-yellow-500 font-bold text-lg tracking-wider">${c.code}</span>
                    <div class="flex gap-2 items-center">
                        ${typeDisplay}
                        ${expiryDisplay}
                    </div>
                </div>
                <button onclick="deleteCoupon('${c.id}')" class="w-8 h-8 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded text-white transition">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;
    }).join('');
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
                    <div class="flex justify-between items-center mt-1"><p class="text-xs text-yellow-500">Estoque: ${p.stock}</p><p class="text-xs text-green-400 font-bold">${formatCurrency(p.price)}</p></div>
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

window.updateCartUI = () => {
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
};

window.openProductModal = (p) => {
    if (!els.modalProduct) return;
    els.modalProduct.classList.remove('hidden');
    document.getElementById('modal-img').src = p.images ? p.images[0] : 'https://placehold.co/600';
    document.getElementById('modal-title').innerText = p.name;
    document.getElementById('modal-desc').innerText = p.description;
    const price = p.promoPrice || p.price;
    document.getElementById('modal-price').innerText = formatCurrency(price);
    const sizesDiv = document.getElementById('modal-sizes');
    sizesDiv.innerHTML = '';
    if (p.sizes) {
        p.sizes.forEach(s => {
            const btn = document.createElement('button');
            btn.className = "border border-gray-600 px-3 py-1 text-white hover:bg-yellow-500 hover:text-black transition";
            btn.innerText = s;
            btn.onclick = () => { document.querySelectorAll('#modal-sizes button').forEach(b => b.classList.remove('bg-yellow-500', 'text-black')); btn.classList.add('bg-yellow-500', 'text-black'); btn.dataset.selected = true; };
            sizesDiv.appendChild(btn);
        });
    }
    document.getElementById('modal-add-cart').onclick = () => {
        const selectedSizeBtn = sizesDiv.querySelector('[data-selected]');
        const size = selectedSizeBtn ? selectedSizeBtn.innerText : (p.sizes ? p.sizes[0] : 'U');
        addToCart(p, size);
        els.modalProduct.classList.add('hidden');
    };
};

function addToCart(product, size) {
    if (!state.globalSettings.allowNoStock && product.stock <= 0) {
        alert('Este produto está esgotado no momento.');
        return;
    }
    const existing = state.cart.find(i => i.id === product.id && i.size === size);
    if (existing) { existing.qty++; }
    else { state.cart.push({ id: product.id, name: product.name, price: parseFloat(product.promoPrice || product.price), size: size, qty: 1, code: product.code || '00000' }); }
    saveCart();
    const btn = getEl('cart-btn'); if (btn) { btn.classList.add('text-yellow-500'); setTimeout(() => btn.classList.remove('text-yellow-500'), 200); }
}

if (els.btnAddCat) {
    els.btnAddCat.onclick = async () => {
        const nameInput = els.newCatName.value.trim();
        if (!nameInput) return alert("Digite o nome");
        let finalName = nameInput;
        if (state.selectedCategoryParent) {
            finalName = `${state.selectedCategoryParent} - ${nameInput}`;
        }
        try {
            await addDoc(collection(db, `sites/${state.siteId}/categories`), { name: finalName });
            els.newCatName.value = '';
            state.selectedCategoryParent = null;
            renderAdminCategoryList();
        } catch (error) { alert("Erro: " + error.message); }
    };
}

window.deleteCategory = async (id, name) => {
    const q = query(collection(db, `sites/${state.siteId}/products`), where("category", "==", name));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return alert(`Não é possível excluir a categoria "${name}" pois existem ${snapshot.size} produtos vinculados a ela.`);
    if (!confirm(`Excluir categoria "${name}"?`)) return;
    await deleteDoc(doc(db, `sites/${state.siteId}/categories`, id));
};

const btnAddCoupon = getEl('btn-add-coupon');
if (btnAddCoupon) {
    btnAddCoupon.onclick = async () => {
        const code = getEl('coupon-code').value.trim().toUpperCase();
        const val = parseFloat(getEl('coupon-val').value);
        const isPercent = getEl('coupon-is-percent').checked;
        const expiry = getEl('coupon-expiry').value;
        if (!code || isNaN(val)) return alert("Preencha Código e Valor");
        try {
            await addDoc(collection(db, `sites/${state.siteId}/coupons`), { code: code, val: val, type: isPercent ? 'percent' : 'fixed', expiryDate: expiry || null });
            getEl('coupon-code').value = ''; getEl('coupon-val').value = ''; getEl('coupon-expiry').value = '';
        } catch (error) { alert("Erro: " + error.message); }
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

const setupAccordion = (btnId, contentId, arrowId) => {
    const btn = getEl(btnId); const content = getEl(contentId); const arrow = getEl(arrowId);
    if (btn && content && arrow) {
        btn.onclick = () => { content.classList.toggle('hidden'); arrow.style.transform = content.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)'; };
    }
};

window.toggleProductSelection = (id) => { if (state.selectedProducts.has(id)) { state.selectedProducts.delete(id); } else { state.selectedProducts.add(id); } updateBulkActionBar(); };
function updateBulkActionBar() { if (!els.bulkActionsBar) return; const count = state.selectedProducts.size; els.selectedCount.innerText = count; if (count > 0) { els.bulkActionsBar.classList.remove('hidden'); els.bulkActionsBar.classList.add('flex'); } else { els.bulkActionsBar.classList.add('hidden'); els.bulkActionsBar.classList.remove('flex'); } }
function setupSwipe(element) { if (!element) return; let startX = 0; let currentX = 0; let isSwiping = false; element.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isSwiping = true; element.style.transition = 'none'; }, { passive: true }); element.addEventListener('touchmove', (e) => { if (!isSwiping) return; currentX = e.touches[0].clientX; let diff = currentX - startX; if (diff < 0 && diff > -100) { element.style.transform = `translateX(${diff}px)`; } }, { passive: true }); element.addEventListener('touchend', () => { isSwiping = false; element.style.transition = 'transform 0.2s ease-out'; const diff = currentX - startX; if (diff < -50) { element.style.transform = `translateX(-100px)`; } else { element.style.transform = `translateX(0)`; } }); }
function setupKeyboardListeners() { document.addEventListener('keydown', (e) => { if (e.key === 'Delete' && state.focusedProductId) { e.preventDefault(); confirmDeleteProduct(state.focusedProductId); } }); }
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
window.confirmDeleteProduct = async (id) => { if (confirm('Excluir este produto?')) { await deleteDoc(doc(db, `sites/${state.siteId}/products`, id)); } };
window.deleteCoupon = async (id) => { if (!confirm('Excluir cupom?')) return; await deleteDoc(doc(db, `sites/${state.siteId}/coupons`, id)); };
window.filterByCat = (cat) => { els.catFilter.value = cat; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); };
window.toggleSidebar = () => { const isOpen = !els.sidebar.classList.contains('-translate-x-full'); if (isOpen) { els.sidebar.classList.add('-translate-x-full'); els.sidebarOverlay.classList.add('hidden'); } else { els.sidebar.classList.remove('-translate-x-full'); els.sidebarOverlay.classList.remove('hidden'); } };
window.changeQty = (index, delta) => { state.cart[index].qty += delta; if (state.cart[index].qty <= 0) state.cart.splice(index, 1); saveCart(); };
function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); updateCartUI(); }

function setupEventListeners() {
    // UI - Acordeões
    setupAccordion('btn-acc-cat', 'content-acc-cat', 'arrow-acc-cat');
    setupAccordion('btn-acc-coupon', 'content-acc-coupon', 'arrow-acc-coupon');

    // Filtros e Pesquisa Admin
    if (els.adminSearchProd) els.adminSearchProd.addEventListener('input', renderAdminProducts);
    if (els.adminFilterCat) els.adminFilterCat.addEventListener('change', renderAdminProducts);
    if (els.adminSortProd) els.adminSortProd.addEventListener('change', renderAdminProducts);

    // Ações em Massa
    const btnBulkDel = getEl('btn-bulk-delete');
    if (btnBulkDel) btnBulkDel.onclick = async () => { if (!confirm(`Excluir ${state.selectedProducts.size} produtos?`)) return; const promises = Array.from(state.selectedProducts).map(id => deleteDoc(doc(db, `sites/${state.siteId}/products`, id))); await Promise.all(promises); state.selectedProducts.clear(); updateBulkActionBar(); };

    const btnBulkMove = getEl('btn-bulk-move');
    if (btnBulkMove) btnBulkMove.onclick = async () => { const targetCat = els.bulkCategorySelect.value; if (!targetCat) return alert("Selecione uma categoria"); const promises = Array.from(state.selectedProducts).map(id => updateDoc(doc(db, `sites/${state.siteId}/products`, id), { category: targetCat })); await Promise.all(promises); state.selectedProducts.clear(); updateBulkActionBar(); alert("Produtos movidos!"); };

    // Filtros Vitrine
    if (els.searchInput) els.searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)); renderCatalog(filtered); });
    if (els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); });

    // Filtros Vendas
    if (els.filterOrderId) els.filterOrderId.addEventListener('input', filterAndRenderSales);
    if (els.filterStatus) els.filterStatus.addEventListener('change', filterAndRenderSales);
    if (els.filterDateStart) els.filterDateStart.addEventListener('change', filterAndRenderSales);
    if (els.filterDateEnd) els.filterDateEnd.addEventListener('change', filterAndRenderSales);
    if (els.btnClearFilters) els.btnClearFilters.onclick = () => { els.filterOrderId.value = ''; els.filterStatus.value = ''; els.filterDateStart.value = ''; els.filterDateEnd.value = ''; filterAndRenderSales(); };

    // Carrinho e UI Geral
    const toggleCart = () => els.cartModal.classList.toggle('hidden');
    const btnCart = getEl('cart-btn'); if (btnCart) btnCart.onclick = toggleCart;
    const btnCartMob = getEl('cart-btn-mobile'); if (btnCartMob) btnCartMob.onclick = toggleCart;
    const btnCloseCart = getEl('close-cart'); if (btnCloseCart) btnCloseCart.onclick = toggleCart;

    // Login
    const btnAdminLogin = getEl('btn-admin-login'); if (btnAdminLogin) { btnAdminLogin.onclick = () => { if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } }; }
    const btnLoginCancel = getEl('btn-login-cancel'); if (btnLoginCancel) btnLoginCancel.onclick = () => getEl('login-modal').close();
    const btnLoginSubmit = getEl('btn-login-submit'); if (btnLoginSubmit) { btnLoginSubmit.onclick = () => { const pass = getEl('admin-pass').value; signInWithEmailAndPassword(auth, "admin@admin.com", pass).then(() => { getEl('login-modal').close(); showView('admin'); }).catch((error) => { alert("Erro login: " + error.message); }); }; }

    // Sidebar e Navegação
    const btnMob = getEl('mobile-menu-btn'); if (btnMob) btnMob.onclick = window.toggleSidebar;
    const btnCloseSide = getEl('close-sidebar'); if (btnCloseSide) btnCloseSide.onclick = window.toggleSidebar;
    if (els.sidebarOverlay) els.sidebarOverlay.onclick = window.toggleSidebar;
    if (els.themeToggle) els.themeToggle.onclick = () => { toggleTheme(true); };
    if (els.menuLinkHome) els.menuLinkHome.onclick = () => { showView('catalog'); window.toggleSidebar(); };
    if (els.menuBtnAdmin) els.menuBtnAdmin.onclick = () => { window.toggleSidebar(); if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } };

    // Toggle Filtros e Categorias Sidebar
    const btnCat = getEl('btn-toggle-categories'); const containerCat = getEl('sidebar-categories-container'); const iconArrow = getEl('icon-cat-arrow');
    if (btnCat && containerCat) { btnCat.onclick = () => { containerCat.classList.toggle('hidden'); if (iconArrow) { iconArrow.style.transform = containerCat.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; } }; }
    const btnToggleFilters = getEl('btn-toggle-filters'); const filtersBody = getEl('filters-body'); const iconFilter = getEl('icon-filter-arrow');
    if (btnToggleFilters && filtersBody) { btnToggleFilters.onclick = () => { filtersBody.classList.toggle('hidden'); if (iconFilter) { iconFilter.style.transform = filtersBody.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)'; } }; }

    // Modais Produto
    const btnCloseModal = getEl('close-modal'); if (btnCloseModal) btnCloseModal.onclick = () => els.modalProduct.classList.add('hidden');
    if (els.modalProduct) els.modalProduct.onclick = (e) => { if (e.target === els.modalProduct) els.modalProduct.classList.add('hidden'); };

    // --- FORMULÁRIO DE PRODUTO (CORRIGIDO) ---
    const btnAddProd = getEl('btn-add-product');
    if (btnAddProd) {
        btnAddProd.onclick = () => {
            getEl('form-product').reset();
            getEl('edit-prod-id').value = '';
            // Reseta o checkbox se ele existir
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
                // Captura SEGURA dos elementos (Evita erro se o HTML não tiver o campo)
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

                // Tratamento de valores (Substitui vírgula por ponto para não dar erro de cálculo)
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
                    // PROTEÇÃO: Só lê checked se o elemento existir
                    allowNoStock: noStockEl ? noStockEl.checked : false,
                    code: idEl && idEl.value ? undefined : Math.floor(10000 + Math.random() * 90000).toString()
                };

                if (data.code === undefined) delete data.code;

                const id = idEl ? idEl.value : '';

                if (id) {
                    await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data);
                } else {
                    await addDoc(collection(db, `sites/${state.siteId}/products`), data);
                }

                if (els.productFormModal) els.productFormModal.classList.add('hidden');
                e.target.reset();

            } catch (err) {
                console.error(err);
                alert("Erro ao salvar produto: " + err.message);
            }
        };
    }

    // Cupons
    const btnApplyCoupon = getEl('btn-apply-coupon'); if (btnApplyCoupon) { btnApplyCoupon.onclick = () => { const input = getEl('cart-coupon-input'); const code = input.value.trim().toUpperCase(); if (!code) { state.currentCoupon = null; updateCartUI(); return; } const coupon = state.coupons.find(c => c.code === code); if (coupon) { if (coupon.expiryDate) { const expiry = new Date(coupon.expiryDate); if (expiry < new Date()) { state.currentCoupon = null; alert("Cupom expirado!"); updateCartUI(); return; } } state.currentCoupon = coupon; alert(`Cupom ${code} aplicado!`); } else { state.currentCoupon = null; alert("Cupom inválido"); } updateCartUI(); }; }

    // Logout
    const btnLogout = getEl('btn-logout'); if (btnLogout) btnLogout.onclick = () => signOut(auth);

    // Abas
    document.querySelectorAll('.tab-btn').forEach(btn => { btn.onclick = () => { document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden')); const target = getEl(btn.dataset.tab); if (target) target.classList.remove('hidden'); document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500'); b.classList.add('text-gray-400'); }); btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500'); btn.classList.remove('text-gray-400'); }; });

    // Checkout
    const btnCheckout = getEl('btn-checkout');
    if (btnCheckout) {
        btnCheckout.onclick = async () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            // Corrige leitura do total formatado (Remove R$, pontos de milhar e troca virgula por ponto)
            const totalText = document.getElementById('cart-total').innerText.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const orderData = { items: state.cart, total: parseFloat(totalText), cupom: state.currentCoupon ? state.currentCoupon.code : null, date: new Date().toISOString(), status: 'Pendente', code: Math.floor(10000 + Math.random() * 90000) };
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

function showView(viewName) {
    if (viewName === 'admin') {
        if (els.viewCatalog) els.viewCatalog.classList.add('hidden');
        if (els.viewAdmin) els.viewAdmin.classList.remove('hidden');
        loadAdminSales();
    } else {
        if (els.viewCatalog) els.viewCatalog.classList.remove('hidden');
        if (els.viewAdmin) els.viewAdmin.classList.add('hidden');
    }
}