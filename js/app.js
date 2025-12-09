import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck } from './firebase-config.js';

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
    focusedProductId: null
};

// --- DOM ELEMENTS (Função Segura) ---
const getEl = (id) => document.getElementById(id);

const els = {
    // Vitrine
    grid: getEl('product-grid'),
    cartCount: getEl('cart-count'),
    cartCountMobile: getEl('cart-count-mobile'),
    cartModal: getEl('cart-modal'),
    cartItems: getEl('cart-items'),
    modalProduct: getEl('product-modal'),
    searchInput: getEl('search-input'),
    catFilter: getEl('category-filter'),
    
    // Sidebar
    sidebar: getEl('sidebar'),
    sidebarOverlay: getEl('sidebar-overlay'),
    sidebarCategories: getEl('sidebar-categories'),
    themeToggle: getEl('theme-toggle'),
    menuBtnAdmin: getEl('menu-btn-admin'),
    menuLinkHome: getEl('menu-link-home'),

    // Telas Admin
    viewCatalog: getEl('view-catalog'),
    viewAdmin: getEl('view-admin'),
    
    // Listas Admin
    ordersList: getEl('orders-list'),
    ordersCount: getEl('orders-count'),
    productListAdmin: getEl('admin-product-list'),
    couponListAdmin: getEl('admin-coupon-list'),

    // Filtros Vendas
    filterOrderId: getEl('filter-order-id'),
    filterStatus: getEl('filter-order-status'),
    filterDateStart: getEl('filter-date-start'),
    filterDateEnd: getEl('filter-date-end'),
    btnClearFilters: getEl('btn-clear-filters'),

    // Admin Produtos (Avançado)
    adminSearchProd: getEl('admin-search-prod'),
    adminFilterCat: getEl('admin-filter-cat'),
    adminSortProd: getEl('admin-sort-prod'),
    bulkActionsBar: getEl('bulk-actions-bar'),
    selectedCount: getEl('selected-count'),
    bulkCategorySelect: getEl('bulk-category-select'),
    productFormModal: getEl('product-form-modal')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    setupKeyboardListeners();
});

function initApp() {
    loadCategories();
    loadProducts();
    loadCoupons();
    // updateCartUI();

    if (localStorage.getItem('theme') === 'light') {
        toggleTheme(false);
    }

    // Monitora Estado do Login
    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';
        
        // Atualiza botão no Navbar
        const btnLoginNav = getEl('btn-admin-login');
        if(btnLoginNav) btnLoginNav.innerText = btnText;

        // Atualiza botão no Sidebar
        if (els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `
                <i class="fas fa-user-shield w-6 text-yellow-500 group-hover:text-white transition"></i>
                <span class="font-medium">${btnText}</span>
            `;
        }

        if (user) {
            renderAdminProducts(); // Carrega lista se logado
            if(!els.viewAdmin.classList.contains('hidden')) {
               // Se já estiver na tela de admin, mantem
            }
        } else {
            showView('catalog'); // Se deslogou, volta pra vitrine
        }
    });
}

// --- TEMA ---
function toggleTheme(save = true) {
    state.isDarkMode = !state.isDarkMode;
    const body = document.body;
    const nav = document.querySelector('nav');
    const icon = getEl('theme-icon');
    const text = getEl('theme-text');

    if (!state.isDarkMode) {
        body.classList.replace('bg-black', 'bg-gray-100');
        body.classList.replace('text-white', 'text-gray-900');
        if(nav) {
            nav.classList.replace('bg-black', 'bg-white');
            nav.classList.remove('border-gray-800');
            nav.classList.add('border-gray-200', 'shadow-sm');
        }
        if (icon) { icon.classList.replace('fa-sun', 'fa-moon'); text.innerText = "Modo Escuro"; }
        if (save) localStorage.setItem('theme', 'light');
    } else {
        body.classList.replace('bg-gray-100', 'bg-black');
        body.classList.replace('text-gray-900', 'text-white');
        if(nav) {
            nav.classList.replace('bg-white', 'bg-black');
            nav.classList.remove('border-gray-200', 'shadow-sm');
            nav.classList.add('border-gray-800');
        }
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

// --- FIREBASE READ ---
function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatalog(state.products);
        if (state.user) renderAdminProducts();
    });
}
function loadCategories() {
    const q = query(collection(db, `sites/${state.siteId}/categories`));
    onSnapshot(q, (snapshot) => {
        state.categories = snapshot.docs.map(d => d.data().name);
        renderCategories();
    });
}
function loadCoupons() {
    const q = query(collection(db, `sites/${state.siteId}/coupons`));
    onSnapshot(q, (snapshot) => {
        state.coupons = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminCoupons();
    });
}

// --- RENDER VITRINE ---
function renderCatalog(products) {
    if(!els.grid) return;
    els.grid.innerHTML = '';
    products.forEach(p => {
        const isOut = p.stock <= 0;
        const priceDisplay = p.promoPrice ?
            `<span class="text-gray-500 line-through text-xs">R$ ${p.price}</span> <span class="text-green-600 font-bold">R$ ${p.promoPrice}</span>` :
            `<span class="text-green-500 font-bold">R$ ${p.price}</span>`;

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

function renderCategories() {
    // Vitrine
    if(els.catFilter) {
        els.catFilter.innerHTML = '<option value="">Todas</option>';
        state.categories.forEach(c => els.catFilter.innerHTML += `<option value="${c}">${c}</option>`);
    }
    // Admin Modal
    const adminSelect = getEl('prod-cat-select');
    if (adminSelect) {
        adminSelect.innerHTML = '<option value="">Selecione...</option>';
        state.categories.forEach(c => adminSelect.innerHTML += `<option value="${c}">${c}</option>`);
    }
    // Admin Filtro
    if (els.adminFilterCat) {
        els.adminFilterCat.innerHTML = '<option value="">Todas</option>';
        state.categories.forEach(c => els.adminFilterCat.innerHTML += `<option value="${c}">${c}</option>`);
    }
    // Admin Bulk
    if (els.bulkCategorySelect) {
        els.bulkCategorySelect.innerHTML = '<option value="">Mover para...</option>';
        state.categories.forEach(c => els.bulkCategorySelect.innerHTML += `<option value="${c}">${c}</option>`);
    }
    // Sidebar Lista Admin
    const adminList = getEl('admin-cat-list');
    if (adminList) {
        adminList.innerHTML = state.categories.map(c => `
            <li class="flex justify-between py-1 border-b border-gray-800 text-gray-300">
                ${c} <button onclick="deleteCategory('${c}')" class="text-red-500 font-bold px-2">X</button>
            </li>
        `).join('');
    }
    // Sidebar Vitrine
    if (els.sidebarCategories) {
        els.sidebarCategories.innerHTML = `<button class="w-full text-left py-2 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition text-sm" onclick="filterByCat('')">Todos os Produtos</button>`;
        state.categories.forEach(c => {
            els.sidebarCategories.innerHTML += `<button class="w-full text-left py-2 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition text-sm" onclick="filterByCat('${c}')">${c}</button>`;
        });
    }
}

// --- RENDER ADMIN (IMPORTANTE: AQUI ESTÁ A FUNÇÃO QUE FALTAVA) ---
function renderAdminProducts() {
    if (!els.productListAdmin) return;
    els.productListAdmin.innerHTML = '';

    const searchTerm = els.adminSearchProd ? els.adminSearchProd.value.toLowerCase().trim() : '';
    const catFilter = els.adminFilterCat ? els.adminFilterCat.value : '';
    const sortType = els.adminSortProd ? els.adminSortProd.value : 'newest';

    let filtered = [...state.products];

    // Pesquisa
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.description && p.description.toLowerCase().includes(searchTerm)) || 
            (p.code && String(p.code).includes(searchTerm))
        );
    }
    // Filtro
    if (catFilter) {
        filtered = filtered.filter(p => p.category === catFilter);
    }
    // Ordenação
    if(sortType === 'price_asc') filtered.sort((a,b) => a.price - b.price);
    if(sortType === 'price_desc') filtered.sort((a,b) => b.price - a.price);
    if(sortType === 'stock_asc') filtered.sort((a,b) => a.stock - b.stock);
    if(sortType === 'stock_desc') filtered.sort((a,b) => b.stock - a.stock);

    filtered.forEach(p => {
        const isSelected = state.selectedProducts.has(p.id);
        const row = document.createElement('div');
        row.className = "relative overflow-hidden rounded bg-gray-800 border border-gray-700 group touch-pan-y outline-none focus:ring-2 focus:ring-yellow-500 mb-2";
        row.tabIndex = 0;

        row.innerHTML = `
            <div class="absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center text-white font-bold z-0 cursor-pointer" onclick="confirmDeleteProduct('${p.id}')">
                <i class="fas fa-trash"></i>
            </div>
            
            <div class="relative z-10 bg-gray-800 p-3 flex items-center gap-3 transition-transform duration-200 ease-out prod-content-swipe" data-id="${p.id}">
                <input type="checkbox" class="form-checkbox h-5 w-5 text-yellow-500 rounded border-gray-600 bg-gray-900 focus:ring-yellow-500 cursor-pointer" 
                    ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleProductSelection('${p.id}')">
                
                <img src="${p.images[0]}" class="w-12 h-12 object-cover rounded border border-gray-600">
                
                <div class="flex-1 min-w-0 cursor-pointer select-none" ondblclick="editProduct('${p.id}')">
                    <div class="flex justify-between"><p class="font-bold text-white text-sm truncate">${p.name}</p><span class="text-xs text-gray-500 font-mono">#${p.code || '---'}</span></div>
                    <div class="flex justify-between items-center mt-1"><p class="text-xs text-yellow-500">Estoque: ${p.stock}</p><p class="text-xs text-green-400 font-bold">R$ ${p.price}</p></div>
                    <p class="text-xs text-gray-500 truncate">${p.category || 'Sem categoria'}</p>
                </div>
                
                <button onclick="editProduct('${p.id}')" class="text-gray-400 hover:text-white p-2"><i class="fas fa-pen"></i></button>
            </div>
        `;

        row.onfocus = () => state.focusedProductId = p.id;
        row.onblur = () => { if(state.focusedProductId === p.id) state.focusedProductId = null; };
        
        setupSwipe(row.querySelector('.prod-content-swipe'));
        els.productListAdmin.appendChild(row);
    });
    updateBulkActionBar();
}

window.toggleProductSelection = (id) => {
    if(state.selectedProducts.has(id)) { state.selectedProducts.delete(id); } else { state.selectedProducts.add(id); }
    updateBulkActionBar();
};

function updateBulkActionBar() {
    if(!els.bulkActionsBar) return;
    const count = state.selectedProducts.size;
    els.selectedCount.innerText = count;
    if (count > 0) { els.bulkActionsBar.classList.remove('hidden'); els.bulkActionsBar.classList.add('flex'); }
    else { els.bulkActionsBar.classList.add('hidden'); els.bulkActionsBar.classList.remove('flex'); }
}

function setupSwipe(element) {
    if(!element) return;
    let startX = 0; let currentX = 0; let isSwiping = false;
    element.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; isSwiping = true; element.style.transition = 'none'; }, {passive: true});
    element.addEventListener('touchmove', (e) => { if(!isSwiping) return; currentX = e.touches[0].clientX; let diff = currentX - startX; if(diff < 0 && diff > -100) { element.style.transform = `translateX(${diff}px)`; } }, {passive: true});
    element.addEventListener('touchend', () => { isSwiping = false; element.style.transition = 'transform 0.2s ease-out'; const diff = currentX - startX; if(diff < -50) { element.style.transform = `translateX(-100px)`; } else { element.style.transform = `translateX(0)`; } });
}

// --- ADMIN VENDAS ---
function loadAdminSales() {
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));
    onSnapshot(q, (snapshot) => {
        state.orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        filterAndRenderSales();
    });
}
function filterAndRenderSales() {
    if(!els.filterOrderId) return;
    const idTerm = els.filterOrderId.value.trim().toLowerCase();
    const statusTerm = els.filterStatus.value;
    const dateStart = els.filterDateStart.value;
    const dateEnd = els.filterDateEnd.value;
    let filtered = state.orders;
    if(idTerm) filtered = filtered.filter(o => String(o.code).includes(idTerm));
    if(statusTerm) filtered = filtered.filter(o => o.status === statusTerm);
    if(dateStart) filtered = filtered.filter(o => new Date(o.date) >= new Date(dateStart));
    if(dateEnd) { const endDate = new Date(dateEnd); endDate.setHours(23, 59, 59); filtered = filtered.filter(o => new Date(o.date) <= endDate); }
    renderSalesList(filtered);
}
function renderSalesList(orders) {
    if (!els.ordersList) return;
    els.ordersList.innerHTML = '';
    els.ordersCount.innerText = orders.length;
    if (orders.length === 0) { els.ordersList.innerHTML = '<p class="text-gray-500 text-center py-4">Nenhum pedido encontrado.</p>'; return; }
    orders.forEach(o => {
        let statusColor = 'text-yellow-500'; if(o.status === 'Confirmado') statusColor = 'text-green-500'; if(o.status === 'Cancelado' || o.status === 'Reembolsado') statusColor = 'text-red-600';
        let itemsHtml = o.items.map(i => `${i.qty}x ${i.name} (${i.size})`).join(', ');
        const card = document.createElement('div');
        card.className = "bg-gray-800 border border-gray-700 rounded p-4 shadow-sm";
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2"><div><span class="text-yellow-500 font-bold text-lg">PEDIDO #${o.code}</span><p class="text-gray-500 text-xs">Data: ${new Date(o.date).toLocaleString()}</p></div><div class="text-right"><span class="${statusColor} font-bold text-sm uppercase tracking-wide">${o.status}</span></div></div>
            <div class="bg-gray-900 p-2 rounded text-gray-300 text-sm mb-2 border border-gray-700">${itemsHtml}</div>
            <div class="flex justify-between items-end"><div><span class="text-gray-400 text-xs block">Valor Total:</span><span class="text-white font-bold text-xl">R$ ${o.total.toFixed(2)}</span>${o.cupom ? `<span class="block text-green-500 text-xs">Cupom: ${o.cupom}</span>` : ''}</div><div class="flex gap-2">${o.status === 'Pendente' ? `<button onclick="updateStatus('${o.id}', 'Confirmado')" class="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded">Aprovar</button><button onclick="updateStatus('${o.id}', 'Cancelado')" class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded">Cancelar</button>` : ''}${o.status === 'Confirmado' ? `<button onclick="updateStatus('${o.id}', 'Reembolsado')" class="border border-red-500 text-red-500 hover:bg-red-900 text-xs px-3 py-1 rounded">Estornar</button>` : ''}</div></div>`;
        els.ordersList.appendChild(card);
    });
}
function renderAdminCoupons() {
    if (!els.couponListAdmin) return;
    els.couponListAdmin.innerHTML = state.coupons.map(c => `
        <li class="flex justify-between py-2 border-b border-gray-800 text-gray-300 text-sm">
            <span><b>${c.code}</b> (-R$ ${c.val})</span>
            <button onclick="deleteCoupon('${c.id}')" class="text-red-500 hover:text-red-400">Excluir</button>
        </li>
    `).join('');
}

// --- TECLADO (DELETE) ---
function setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Delete' && state.focusedProductId) { e.preventDefault(); confirmDeleteProduct(state.focusedProductId); }
    });
}

// --- HELPERS E CRUD ---
window.updateStatus = async (id, status) => { if(!confirm(`Alterar status para ${status}?`)) return; await updateDoc(doc(db, `sites/${state.siteId}/sales`, id), { status: status }); };
window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id); if (!p) return;
    getEl('edit-prod-id').value = p.id;
    getEl('prod-name').value = p.name;
    const catSelect = getEl('prod-cat-select'); if(catSelect && p.category) catSelect.value = p.category;
    getEl('prod-desc').value = p.description;
    getEl('prod-price').value = p.price;
    getEl('prod-promo').value = p.promoPrice || '';
    getEl('prod-stock').value = p.stock;
    getEl('prod-cost').value = p.cost || '';
    getEl('prod-sizes').value = p.sizes ? p.sizes.join(',') : '';
    getEl('prod-img').value = p.images ? p.images[0] : '';
    // Usa a referencia segura
    if(els.productFormModal) els.productFormModal.classList.remove('hidden');
};
window.confirmDeleteProduct = async (id) => { if (confirm('Excluir este produto?')) { await deleteDoc(doc(db, `sites/${state.siteId}/products`, id)); } };
window.deleteCategory = async (name) => { if(!confirm(`Excluir categoria "${name}"?`)) return; const q = query(collection(db, `sites/${state.siteId}/categories`), where("name", "==", name)); const snapshot = await getDocsCheck(q); snapshot.forEach(async (docSnapshot) => { await deleteDoc(doc(db, `sites/${state.siteId}/categories`, docSnapshot.id)); }); };
window.deleteCoupon = async (id) => { if(!confirm('Excluir cupom?')) return; await deleteDoc(doc(db, `sites/${state.siteId}/coupons`, id)); };
window.filterByCat = (cat) => { els.catFilter.value = cat; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat); renderCatalog(filtered); };
window.toggleSidebar = () => { const isOpen = !els.sidebar.classList.contains('-translate-x-full'); if(isOpen) { els.sidebar.classList.add('-translate-x-full'); els.sidebarOverlay.classList.add('hidden'); } else { els.sidebar.classList.remove('-translate-x-full'); els.sidebarOverlay.classList.remove('hidden'); } };

// --- EVENT LISTENERS (Com proteções) ---
function setupEventListeners() {
    // Admin Produtos
    if(els.adminSearchProd) els.adminSearchProd.addEventListener('input', renderAdminProducts);
    if(els.adminFilterCat) els.adminFilterCat.addEventListener('change', renderAdminProducts);
    if(els.adminSortProd) els.adminSortProd.addEventListener('change', renderAdminProducts);
    
    // Bulk Actions
    const btnBulkDel = getEl('btn-bulk-delete');
    if(btnBulkDel) btnBulkDel.onclick = async () => {
        if(!confirm(`Excluir ${state.selectedProducts.size} produtos?`)) return;
        const promises = Array.from(state.selectedProducts).map(id => deleteDoc(doc(db, `sites/${state.siteId}/products`, id)));
        await Promise.all(promises); state.selectedProducts.clear(); updateBulkActionBar();
    };
    const btnBulkMove = getEl('btn-bulk-move');
    if(btnBulkMove) btnBulkMove.onclick = async () => {
        const targetCat = els.bulkCategorySelect.value;
        if(!targetCat) return alert("Selecione uma categoria");
        const promises = Array.from(state.selectedProducts).map(id => updateDoc(doc(db, `sites/${state.siteId}/products`, id), { category: targetCat }));
        await Promise.all(promises); state.selectedProducts.clear(); updateBulkActionBar(); alert("Produtos movidos!");
    };

    // Vitrine
    if(els.searchInput) els.searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)); renderCatalog(filtered); });
    if(els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat); renderCatalog(filtered); });
    
    // Vendas
    if(els.filterOrderId) els.filterOrderId.addEventListener('input', filterAndRenderSales);
    if(els.filterStatus) els.filterStatus.addEventListener('change', filterAndRenderSales);
    if(els.filterDateStart) els.filterDateStart.addEventListener('change', filterAndRenderSales);
    if(els.filterDateEnd) els.filterDateEnd.addEventListener('change', filterAndRenderSales);
    if(els.btnClearFilters) els.btnClearFilters.onclick = () => { els.filterOrderId.value = ''; els.filterStatus.value = ''; els.filterDateStart.value = ''; els.filterDateEnd.value = ''; filterAndRenderSales(); };

    // Modais e UI
    const toggleCart = () => els.cartModal.classList.toggle('hidden');
    const btnCart = getEl('cart-btn'); if(btnCart) btnCart.onclick = toggleCart;
    const btnCartMob = getEl('cart-btn-mobile'); if(btnCartMob) btnCartMob.onclick = toggleCart;
    const btnCloseCart = getEl('close-cart'); if(btnCloseCart) btnCloseCart.onclick = toggleCart;

    // LOGIN LOGIC (PROTEGIDA)
    const btnAdminLogin = getEl('btn-admin-login');
    if(btnAdminLogin) {
        btnAdminLogin.onclick = () => {
            if (state.user) {
                showView('admin');
            } else {
                getEl('login-modal').showModal();
            }
        };
    }
    const btnLoginCancel = getEl('btn-login-cancel');
    if(btnLoginCancel) btnLoginCancel.onclick = () => getEl('login-modal').close();

    const btnLoginSubmit = getEl('btn-login-submit');
    if(btnLoginSubmit) {
        btnLoginSubmit.onclick = () => {
            const pass = getEl('admin-pass').value;
            // Login hardcoded para demonstracao, ajuste conforme necessario
            signInWithEmailAndPassword(auth, "admin@admin.com", pass)
                .then(() => {
                    getEl('login-modal').close();
                    showView('admin');
                })
                .catch((error) => {
                    alert("Erro login: " + error.message);
                });
        };
    }

    // Sidebar
    const btnMob = getEl('mobile-menu-btn'); if(btnMob) btnMob.onclick = window.toggleSidebar;
    const btnCloseSide = getEl('close-sidebar'); if(btnCloseSide) btnCloseSide.onclick = window.toggleSidebar;
    if(els.sidebarOverlay) els.sidebarOverlay.onclick = window.toggleSidebar;
    if(els.themeToggle) els.themeToggle.onclick = () => { toggleTheme(true); };
    if(els.menuLinkHome) els.menuLinkHome.onclick = () => { showView('catalog'); window.toggleSidebar(); };
    if(els.menuBtnAdmin) els.menuBtnAdmin.onclick = () => { window.toggleSidebar(); if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } };
    
    // Categorias Sanfona
    const btnCat = getEl('btn-toggle-categories');
    const containerCat = getEl('sidebar-categories-container');
    const iconArrow = getEl('icon-cat-arrow');
    if(btnCat && containerCat) {
        btnCat.onclick = () => {
            containerCat.classList.toggle('hidden');
            if(iconArrow) {
                iconArrow.style.transform = containerCat.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        };
    }

    // Toggle Filtros Vendas
    const btnToggleFilters = getEl('btn-toggle-filters');
    const filtersBody = getEl('filters-body');
    const iconFilter = getEl('icon-filter-arrow');
    if(btnToggleFilters && filtersBody) {
        btnToggleFilters.onclick = () => {
            filtersBody.classList.toggle('hidden');
            if(iconFilter) {
                iconFilter.style.transform = filtersBody.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        };
    }

    // Forms CRUD
    const btnCloseModal = getEl('close-modal'); if(btnCloseModal) btnCloseModal.onclick = () => els.modalProduct.classList.add('hidden');
    if(els.modalProduct) els.modalProduct.onclick = (e) => { if (e.target === els.modalProduct) els.modalProduct.classList.add('hidden'); };

    const btnAddProd = getEl('btn-add-product');
    if(btnAddProd) {
        btnAddProd.onclick = () => {
            getEl('form-product').reset();
            getEl('edit-prod-id').value = '';
            if(els.productFormModal) els.productFormModal.classList.remove('hidden');
        };
    }

    const btnCancelProd = getEl('btn-cancel-prod');
    if(btnCancelProd) btnCancelProd.onclick = () => { if(els.productFormModal) els.productFormModal.classList.add('hidden'); };

    const formProd = getEl('form-product');
    if(formProd) {
        formProd.onsubmit = async (e) => {
            e.preventDefault();
            const id = getEl('edit-prod-id').value;
            const data = {
                name: getEl('prod-name').value, category: getEl('prod-cat-select')?.value || "Geral",
                description: getEl('prod-desc').value, price: parseFloat(getEl('prod-price').value),
                promoPrice: parseFloat(getEl('prod-promo').value) || null, stock: parseInt(getEl('prod-stock').value) || 0,
                cost: parseFloat(getEl('prod-cost').value) || 0, sizes: getEl('prod-sizes').value.split(',').map(s => s.trim()),
                images: [getEl('prod-img').value], code: id ? undefined : Math.floor(10000 + Math.random() * 90000).toString()
            };
            if (data.code === undefined) delete data.code;
            try { if (id) { await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data); } else { await addDoc(collection(db, `sites/${state.siteId}/products`), data); } if(els.productFormModal) els.productFormModal.classList.add('hidden'); e.target.reset(); } catch (err) { alert("Erro ao salvar: " + err.message); }
        };
    }

    const btnAddCat = getEl('btn-add-cat');
    if(btnAddCat) {
        btnAddCat.onclick = async () => { const nameInput = getEl('new-cat-name'); const name = nameInput.value.trim(); if (!name) return alert("Digite o nome"); try { await addDoc(collection(db, `sites/${state.siteId}/categories`), { name: name }); nameInput.value = ''; } catch (error) { alert("Erro: " + error.message); } };
    }

    const btnAddCoupon = getEl('btn-add-coupon');
    if(btnAddCoupon) {
        btnAddCoupon.onclick = async () => { const codeInput = getEl('coupon-code'); const valInput = getEl('coupon-val'); const code = codeInput.value.trim().toUpperCase(); const val = parseFloat(valInput.value); if (!code || isNaN(val)) return alert("Preencha dados"); try { await addDoc(collection(db, `sites/${state.siteId}/coupons`), { code: code, val: val, type: 'fixed' }); codeInput.value = ''; valInput.value = ''; } catch (error) { alert("Erro: " + error.message); } };
    }

    const btnApplyCoupon = getEl('btn-apply-coupon');
    if(btnApplyCoupon) {
        btnApplyCoupon.onclick = () => { const input = getEl('cart-coupon-input'); const code = input.value.trim().toUpperCase(); if(!code) { state.currentCoupon = null; updateCartUI(); return; } const coupon = state.coupons.find(c => c.code === code); if(coupon) { state.currentCoupon = coupon; alert(`Cupom ${code} aplicado!`); } else { state.currentCoupon = null; alert("Cupom inválido"); } updateCartUI(); };
    }
    
    // --- CARRINHO LOGIC (Faltava isso) ---
    window.updateCartUI = () => {
        const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
        if(els.cartCount) els.cartCount.innerText = totalQty;
        if(els.cartCountMobile) els.cartCountMobile.innerText = totalQty;
        if(els.cartItems) {
            els.cartItems.innerHTML = '';
            let subtotal = 0;
            state.cart.forEach((item, index) => {
                subtotal += item.price * item.qty;
                els.cartItems.innerHTML += `
                    <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                        <div>
                            <p class="text-white font-bold text-sm">${item.name} (${item.size})</p>
                            <p class="text-green-400 text-sm">R$ ${item.price}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button onclick="changeQty(${index}, -1)" class="text-gray-400 hover:text-white px-2">-</button>
                            <span class="text-white text-sm">${item.qty}</span>
                            <button onclick="changeQty(${index}, 1)" class="text-gray-400 hover:text-white px-2">+</button>
                        </div>
                    </div>`;
            });
            let discount = 0;
            if (state.currentCoupon) {
                if (state.currentCoupon.type === 'percent') { discount = subtotal * (state.currentCoupon.val / 100); }
                else { discount = state.currentCoupon.val; }
            }
            const total = Math.max(0, subtotal - discount);
            document.getElementById('cart-subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
            document.getElementById('cart-discount').innerText = `- R$ ${discount.toFixed(2)}`;
            document.getElementById('cart-total').innerText = `R$ ${total.toFixed(2)}`;
        }
    };

    window.openProductModal = (p) => {
        if(!els.modalProduct) return;
        els.modalProduct.classList.remove('hidden');
        document.getElementById('modal-img').src = p.images ? p.images[0] : 'https://placehold.co/600';
        document.getElementById('modal-title').innerText = p.name;
        document.getElementById('modal-desc').innerText = p.description;
        const price = p.promoPrice || p.price;
        document.getElementById('modal-price').innerText = `R$ ${price}`;
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
        document.getElementById('modal-add-cart').onclick = () => { const selectedSizeBtn = sizesDiv.querySelector('[data-selected]'); const size = selectedSizeBtn ? selectedSizeBtn.innerText : (p.sizes ? p.sizes[0] : 'U'); addToCart(p, size); els.modalProduct.classList.add('hidden'); };
    };

    function addToCart(product, size) {
        const existing = state.cart.find(i => i.id === product.id && i.size === size);
        if (existing) { existing.qty++; } else { state.cart.push({ id: product.id, name: product.name, price: parseFloat(product.promoPrice || product.price), size: size, qty: 1, code: product.code || '00000' }); }
        saveCart();
        const btn = getEl('cart-btn'); if(btn) { btn.classList.add('text-yellow-500'); setTimeout(() => btn.classList.remove('text-yellow-500'), 200); }
    }

    window.changeQty = (index, delta) => { state.cart[index].qty += delta; if (state.cart[index].qty <= 0) state.cart.splice(index, 1); saveCart(); };
    function saveCart() { localStorage.setItem('cart', JSON.stringify(state.cart)); updateCartUI(); }

    const btnCheckout = getEl('btn-checkout');
    if(btnCheckout) {
        btnCheckout.onclick = async () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            const totalText = document.getElementById('cart-total').innerText.replace('R$ ', '').replace(',', '.');
            const orderData = { items: state.cart, total: parseFloat(totalText), cupom: state.currentCoupon ? state.currentCoupon.code : null, date: new Date().toISOString(), status: 'Pendente', code: Math.floor(10000 + Math.random() * 90000) };
            try { await addDoc(collection(db, `sites/${state.siteId}/sales`), orderData); } catch (e) { console.log("Erro pedido:", e); }
            let msg = `*NOVO PEDIDO - ${orderData.code}*\n\n`;
            state.cart.forEach(i => { msg += `▪ ${i.qty}x ${i.name} (${i.size}) - R$ ${i.price}\n`; });
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

    const btnLogout = getEl('btn-logout');
    if(btnLogout) btnLogout.onclick = () => signOut(auth);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            const target = getEl(btn.dataset.tab);
            if(target) target.classList.remove('hidden');
            
            document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500'); b.classList.add('text-gray-400'); });
            btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500'); btn.classList.remove('text-gray-400');
        };
    });
}

function showView(viewName) {
    if (viewName === 'admin') {
        if(els.viewCatalog) els.viewCatalog.classList.add('hidden');
        if(els.viewAdmin) els.viewAdmin.classList.remove('hidden');
        loadAdminSales();
    } else {
        if(els.viewCatalog) els.viewCatalog.classList.remove('hidden');
        if(els.viewAdmin) els.viewAdmin.classList.add('hidden');
    }
}