import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck } from './firebase-config.js';

// --- ESTADO GLOBAL ---
const state = {
    siteId: new URLSearchParams(window.location.search).get('site') || 'demo',
    products: [],
    categories: [],
    coupons: [],
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: null,
    currentCoupon: null,
    isDarkMode: true
};

// --- DOM ELEMENTS ---
const els = {
    grid: document.getElementById('product-grid'),
    cartCount: document.getElementById('cart-count'),
    cartCountMobile: document.getElementById('cart-count-mobile'),
    cartModal: document.getElementById('cart-modal'),
    cartItems: document.getElementById('cart-items'),
    modalProduct: document.getElementById('product-modal'),
    searchInput: document.getElementById('search-input'),
    catFilter: document.getElementById('category-filter'),
    // Sidebar Elements
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarCategories: document.getElementById('sidebar-categories'),
    themeToggle: document.getElementById('theme-toggle'),
    menuBtnAdmin: document.getElementById('menu-btn-admin'),
    menuLinkHome: document.getElementById('menu-link-home'),
    // Admin
    viewCatalog: document.getElementById('view-catalog'),
    viewAdmin: document.getElementById('view-admin'),
    ordersList: document.getElementById('orders-list'),
    productListAdmin: document.getElementById('admin-product-list'),
    couponListAdmin: document.getElementById('admin-coupon-list')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    loadCategories();
    loadProducts();
    loadCoupons();
    updateCartUI();

    if(localStorage.getItem('theme') === 'light') {
        toggleTheme(false);
    }

    onAuthStateChanged(auth, (user) => {
        state.user = user;
        const btnText = user ? 'Painel' : 'Área Admin';
        document.getElementById('btn-admin-login').innerText = btnText;
        
        if(els.menuBtnAdmin) {
            els.menuBtnAdmin.innerHTML = `
                <i class="fas fa-user-shield w-6 text-yellow-500 group-hover:text-white transition"></i>
                <span class="font-medium">${btnText}</span>
            `;
        }

        if (user) {
            // Se logou, renderiza a lista de produtos do admin IMEDIATAMENTE
            renderAdminProducts();
        } else {
            showView('catalog');
        }
    });
}

// --- LOGICA DO TEMA ---
function toggleTheme(save = true) {
    state.isDarkMode = !state.isDarkMode;
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    const text = document.getElementById('theme-text');
    const nav = document.querySelector('nav');
    const catalogTitle = document.querySelector('#view-catalog h2');
    
    if (!state.isDarkMode) {
        body.classList.replace('bg-black', 'bg-gray-100');
        body.classList.replace('text-white', 'text-gray-900');
        nav.classList.replace('bg-black', 'bg-white');
        nav.classList.remove('border-gray-800');
        nav.classList.add('border-gray-200', 'shadow-sm');
        if(catalogTitle) catalogTitle.classList.replace('text-gray-200', 'text-gray-800');
        updateCardStyles(true);
        if(icon) {
            icon.classList.replace('fa-sun', 'fa-moon');
            text.innerText = "Modo Escuro";
        }
        if(save) localStorage.setItem('theme', 'light');
    } else {
        body.classList.replace('bg-gray-100', 'bg-black');
        body.classList.replace('text-gray-900', 'text-white');
        nav.classList.replace('bg-white', 'bg-black');
        nav.classList.remove('border-gray-200', 'shadow-sm');
        nav.classList.add('border-gray-800');
        if(catalogTitle) catalogTitle.classList.replace('text-gray-800', 'text-gray-200');
        updateCardStyles(false);
        if(icon) {
            icon.classList.replace('fa-moon', 'fa-sun');
            text.innerText = "Modo Claro";
        }
        if(save) localStorage.setItem('theme', 'dark');
    }
}

function updateCardStyles(isLight) {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        if(isLight) {
            card.classList.remove('bg-gray-800');
            card.classList.add('bg-white', 'text-gray-900', 'shadow-md', 'border', 'border-gray-200');
            const title = card.querySelector('h3');
            if(title) title.classList.replace('text-white', 'text-gray-900');
        } else {
            card.classList.add('bg-gray-800');
            card.classList.remove('bg-white', 'text-gray-900', 'shadow-md', 'border', 'border-gray-200');
            const title = card.querySelector('h3');
            if(title) title.classList.replace('text-gray-900', 'text-white');
        }
    });
}

// --- FIREBASE READ ---
function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderCatalog(state.products);
        // Tenta renderizar admin se usuario ja estiver carregado
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

// --- RENDERIZACAO ---
function renderCatalog(products) {
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
                <div class="flex justify-between items-start">
                    <h3 class="text-white font-bold truncate transition-colors">${p.name}</h3>
                </div>
                <p class="text-gray-500 text-xs truncate mb-2">${p.description}</p>
                <div class="flex justify-between items-center">
                    ${priceDisplay}
                    <span class="text-xs bg-gray-700 text-gray-200 px-2 py-1 rounded">${p.sizes ? p.sizes[0] : 'U'}</span>
                </div>
            </div>
        `;
        card.onclick = () => openProductModal(p);
        card.setAttribute('tabindex', '0');
        card.onkeydown = (e) => {
            if (e.key === 'Enter') openProductModal(p);
            if (state.user && e.key === 'Delete') confirmDeleteProduct(p.id);
        };
        els.grid.appendChild(card);
    });
    if(!state.isDarkMode) updateCardStyles(true);
}

function renderCategories() {
    els.catFilter.innerHTML = '<option value="">Todas</option>';
    state.categories.forEach(c => {
        els.catFilter.innerHTML += `<option value="${c}">${c}</option>`;
    });

    const adminSelect = document.getElementById('prod-cat-select');
    if(adminSelect) {
        adminSelect.innerHTML = '<option value="">Selecione...</option>';
        state.categories.forEach(c => adminSelect.innerHTML += `<option value="${c}">${c}</option>`);
    }

    const adminList = document.getElementById('admin-cat-list');
    if(adminList) {
        adminList.innerHTML = state.categories.map(c => `
            <li class="flex justify-between py-1 border-b border-gray-800 text-gray-300">
                ${c} <button onclick="deleteCategory('${c}')" class="text-red-500 font-bold px-2">X</button>
            </li>
        `).join('');
    }

    if(els.sidebarCategories) {
        els.sidebarCategories.innerHTML = `
            <button class="w-full text-left py-2 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition text-sm flex justify-between items-center" onclick="filterByCat('')">
                Todos os Produtos
            </button>
        `;
        state.categories.forEach(c => {
            els.sidebarCategories.innerHTML += `
                <button class="w-full text-left py-2 px-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition text-sm flex justify-between items-center" onclick="filterByCat('${c}')">
                    ${c}
                    <i class="fas fa-chevron-right text-xs"></i>
                </button>
            `;
        });
    }
}

function renderAdminCoupons() {
    if(!els.couponListAdmin) return;
    els.couponListAdmin.innerHTML = state.coupons.map(c => `
        <li class="flex justify-between py-2 border-b border-gray-800 text-gray-300 text-sm">
            <span><b>${c.code}</b> (-R$ ${c.val})</span>
            <button onclick="deleteCoupon('${c.id}')" class="text-red-500 hover:text-red-400">Excluir</button>
        </li>
    `).join('');
}

// --- ESTA É A FUNÇÃO QUE FALTAVA ---
function renderAdminProducts() {
    if(!els.productListAdmin) return;
    els.productListAdmin.innerHTML = '';
    state.products.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-gray-800 p-3 rounded flex justify-between items-center mb-2 border border-gray-700";
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <img src="${p.images[0]}" class="w-10 h-10 object-cover rounded">
                <div>
                    <p class="font-bold text-white text-sm">${p.name}</p>
                    <p class="text-xs text-gray-400">Estoque: ${p.stock}</p>
                </div>
            </div>
            <div>
                <button onclick="editProduct('${p.id}')" class="text-yellow-500 mr-2 hover:text-yellow-400"><i class="fas fa-edit"></i></button>
                <button onclick="confirmDeleteProduct('${p.id}')" class="text-red-500 hover:text-red-400"><i class="fas fa-trash"></i></button>
            </div>
        `;
        els.productListAdmin.appendChild(div);
    });
}

// --- MODAL PRODUTO ---
function openProductModal(p) {
    const modal = els.modalProduct;
    modal.classList.remove('hidden');
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
            btn.onclick = () => {
                document.querySelectorAll('#modal-sizes button').forEach(b => b.classList.remove('bg-yellow-500', 'text-black'));
                btn.classList.add('bg-yellow-500', 'text-black');
                btn.dataset.selected = true;
            };
            sizesDiv.appendChild(btn);
        });
    }

    document.getElementById('modal-add-cart').onclick = () => {
        const selectedSizeBtn = sizesDiv.querySelector('[data-selected]');
        const size = selectedSizeBtn ? selectedSizeBtn.innerText : (p.sizes ? p.sizes[0] : 'U');
        addToCart(p, size);
        modal.classList.add('hidden');
    };
}

// --- CARRINHO & CHECKOUT ---
function addToCart(product, size) {
    const existing = state.cart.find(i => i.id === product.id && i.size === size);
    if (existing) { existing.qty++; } else {
        state.cart.push({
            id: product.id, name: product.name, price: parseFloat(product.promoPrice || product.price),
            size: size, qty: 1, code: product.code || '00000'
        });
    }
    saveCart();
    const btn = document.getElementById('cart-btn');
    btn.classList.add('text-yellow-500');
    setTimeout(() => btn.classList.remove('text-yellow-500'), 200);
}

function updateCartUI() {
    const totalQty = state.cart.reduce((acc, item) => acc + item.qty, 0);
    els.cartCount.innerText = totalQty;
    els.cartCountMobile.innerText = totalQty;
    els.cartItems.innerHTML = '';
    let subtotal = 0;
    state.cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        els.cartItems.innerHTML += `
            <div class="flex justify-between items-center bg-gray-800 p-2 rounded">
                <div><p class="text-white font-bold text-sm">${item.name} (${item.size})</p><p class="text-green-400 text-sm">R$ ${item.price}</p></div>
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

window.changeQty = (index, delta) => {
    state.cart[index].qty += delta;
    if (state.cart[index].qty <= 0) state.cart.splice(index, 1);
    saveCart();
};

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
}

document.getElementById('btn-checkout').onclick = async () => {
    if (state.cart.length === 0) return alert('Carrinho vazio');
    const orderData = {
        items: state.cart, total: parseFloat(document.getElementById('cart-total').innerText.replace('R$ ', '').replace(',', '.')),
        date: new Date().toISOString(), status: 'Pendente', code: Math.floor(10000 + Math.random() * 90000)
    };
    try { await addDoc(collection(db, `sites/${state.siteId}/sales`), orderData); } catch (e) { console.log("Erro ao salvar pedido:", e); }
    let msg = `*NOVO PEDIDO - ${orderData.code}*\n\n`;
    state.cart.forEach(i => { msg += `▪ ${i.qty}x ${i.name} (${i.size}) - R$ ${i.price}\n`; });
    msg += `\nSubtotal: ${document.getElementById('cart-subtotal').innerText}`;
    if (state.currentCoupon) msg += `\nCupom: ${state.currentCoupon.code}`;
    msg += `\n*TOTAL: ${document.getElementById('cart-total').innerText}*`;
    msg += `\n\nAguardo link de pagamento!`;
    const sellerPhone = "5511941936976";
    window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    state.cart = []; state.currentCoupon = null; saveCart(); document.getElementById('cart-modal').classList.add('hidden');
};

// --- LOGICA GLOBAL ---
window.filterByCat = (cat) => {
    // Fecha sidebar se estiver mobile (ou sempre que clicar)
    // Se quiser manter aberto, comente a linha abaixo
    // toggleSidebar(); 
    
    els.catFilter.value = cat;
    if (!cat) return renderCatalog(state.products);
    const filtered = state.products.filter(p => p.category === cat);
    renderCatalog(filtered);
};

window.toggleSidebar = () => {
    const isOpen = !els.sidebar.classList.contains('-translate-x-full');
    if(isOpen) { els.sidebar.classList.add('-translate-x-full'); els.sidebarOverlay.classList.add('hidden'); }
    else { els.sidebar.classList.remove('-translate-x-full'); els.sidebarOverlay.classList.remove('hidden'); }
};

window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    const catSelect = document.getElementById('prod-cat-select');
    if(catSelect && p.category) catSelect.value = p.category;
    document.getElementById('prod-desc').value = p.description;
    document.getElementById('prod-price').value = p.price;
    document.getElementById('prod-promo').value = p.promoPrice || '';
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-cost').value = p.cost || '';
    document.getElementById('prod-sizes').value = p.sizes ? p.sizes.join(',') : '';
    document.getElementById('prod-img').value = p.images ? p.images[0] : '';
    document.getElementById('product-form-modal').classList.remove('hidden');
};

window.confirmDeleteProduct = async (id) => {
    if (confirm('Tem certeza que deseja excluir?')) {
        await deleteDoc(doc(db, `sites/${state.siteId}/products`, id));
    }
};

window.deleteCategory = async (name) => {
    if(!confirm(`Excluir categoria "${name}"?`)) return;
    const q = query(collection(db, `sites/${state.siteId}/categories`), where("name", "==", name));
    const snapshot = await getDocsCheck(q);
    snapshot.forEach(async (docSnapshot) => {
        await deleteDoc(doc(db, `sites/${state.siteId}/categories`, docSnapshot.id));
    });
};

window.deleteCoupon = async (id) => {
    if(!confirm('Excluir cupom?')) return;
    await deleteDoc(doc(db, `sites/${state.siteId}/coupons`, id));
};

function setupEventListeners() {
    els.searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
        renderCatalog(filtered);
    });
    els.catFilter.addEventListener('change', (e) => {
        const cat = e.target.value;
        if (!cat) return renderCatalog(state.products);
        const filtered = state.products.filter(p => p.category === cat);
        renderCatalog(filtered);
    });
    const toggleCart = () => els.cartModal.classList.toggle('hidden');
    document.getElementById('cart-btn').onclick = toggleCart;
    document.getElementById('cart-btn-mobile').onclick = toggleCart;
    document.getElementById('close-cart').onclick = toggleCart;
    document.getElementById('btn-admin-login').onclick = () => { if (state.user) { showView('admin'); } else { document.getElementById('login-modal').showModal(); } };
    document.getElementById('btn-login-cancel').onclick = () => document.getElementById('login-modal').close();
    document.getElementById('btn-login-submit').onclick = () => {
        const pass = document.getElementById('admin-pass').value;
        signInWithEmailAndPassword(auth, "admin@admin.com", pass)
            .then(() => { document.getElementById('login-modal').close(); showView('admin'); })
            .catch((error) => { alert("Erro login: " + error.message); });
    };

    // Sidebar
    document.getElementById('mobile-menu-btn').onclick = window.toggleSidebar;
    document.getElementById('close-sidebar').onclick = window.toggleSidebar;
    els.sidebarOverlay.onclick = window.toggleSidebar;
    els.themeToggle.onclick = () => { toggleTheme(true); };
    els.menuLinkHome.onclick = () => { showView('catalog'); window.toggleSidebar(); };
    els.menuBtnAdmin.onclick = () => { window.toggleSidebar(); if (state.user) { showView('admin'); } else { document.getElementById('login-modal').showModal(); } };
    
    // Accordion Categorias
    const btnCat = document.getElementById('btn-toggle-categories');
    const containerCat = document.getElementById('sidebar-categories-container');
    const iconArrow = document.getElementById('icon-cat-arrow');
    if(btnCat) {
        btnCat.onclick = () => {
            containerCat.classList.toggle('hidden');
            if(containerCat.classList.contains('hidden')) { iconArrow.style.transform = 'rotate(0deg)'; } 
            else { iconArrow.style.transform = 'rotate(180deg)'; }
        };
    }

    // CRUD
    document.getElementById('close-modal').onclick = () => els.modalProduct.classList.add('hidden');
    els.modalProduct.onclick = (e) => { if (e.target === els.modalProduct) els.modalProduct.classList.add('hidden'); };
    document.getElementById('btn-add-product').onclick = () => { document.getElementById('form-product').reset(); document.getElementById('edit-prod-id').value = ''; document.getElementById('product-form-modal').classList.remove('hidden'); };
    document.getElementById('btn-cancel-prod').onclick = () => document.getElementById('product-form-modal').classList.add('hidden');
    document.getElementById('form-product').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-prod-id').value;
        const data = {
            name: document.getElementById('prod-name').value, category: document.getElementById('prod-cat-select')?.value || "Geral",
            description: document.getElementById('prod-desc').value, price: parseFloat(document.getElementById('prod-price').value),
            promoPrice: parseFloat(document.getElementById('prod-promo').value) || null, stock: parseInt(document.getElementById('prod-stock').value) || 0,
            cost: parseFloat(document.getElementById('prod-cost').value) || 0, sizes: document.getElementById('prod-sizes').value.split(',').map(s => s.trim()),
            images: [document.getElementById('prod-img').value], code: id ? undefined : Math.floor(10000 + Math.random() * 90000).toString()
        };
        if (data.code === undefined) delete data.code;
        try { if (id) { await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data); } else { await addDoc(collection(db, `sites/${state.siteId}/products`), data); } document.getElementById('product-form-modal').classList.add('hidden'); e.target.reset(); } catch (err) { alert("Erro ao salvar: " + err.message); }
    };
    document.getElementById('btn-add-cat').onclick = async () => { const nameInput = document.getElementById('new-cat-name'); const name = nameInput.value.trim(); if (!name) return alert("Digite o nome da categoria"); try { await addDoc(collection(db, `sites/${state.siteId}/categories`), { name: name }); nameInput.value = ''; } catch (error) { console.error("Erro ao criar categoria:", error); alert("Erro: " + error.message); } };
    document.getElementById('btn-add-coupon').onclick = async () => { const codeInput = document.getElementById('coupon-code'); const valInput = document.getElementById('coupon-val'); const code = codeInput.value.trim().toUpperCase(); const val = parseFloat(valInput.value); if (!code || isNaN(val)) return alert("Preencha código e valor corretamente"); try { await addDoc(collection(db, `sites/${state.siteId}/coupons`), { code: code, val: val, type: 'fixed' }); codeInput.value = ''; valInput.value = ''; } catch (error) { alert("Erro: " + error.message); } };
    document.getElementById('btn-apply-coupon').onclick = () => { const input = document.getElementById('cart-coupon-input'); const code = input.value.trim().toUpperCase(); if(!code) { state.currentCoupon = null; updateCartUI(); return; } const coupon = state.coupons.find(c => c.code === code); if(coupon) { state.currentCoupon = coupon; alert(`Cupom ${code} aplicado!`); } else { state.currentCoupon = null; alert("Cupom inválido ou não encontrado."); } updateCartUI(); };
    document.getElementById('btn-logout').onclick = () => signOut(auth);
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
            document.getElementById(btn.dataset.tab).classList.remove('hidden');
            document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500'); b.classList.add('text-gray-400'); });
            btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500'); btn.classList.remove('text-gray-400');
        };
    });
}

function showView(viewName) {
    if (viewName === 'admin') {
        els.viewCatalog.classList.add('hidden'); els.viewAdmin.classList.remove('hidden'); loadAdminSales();
    } else {
        els.viewCatalog.classList.remove('hidden'); els.viewAdmin.classList.add('hidden');
    }
}
function loadAdminSales() {
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));
    onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        let html = ''; let totalSales = 0;
        orders.forEach(o => {
            if (o.status !== 'Cancelado') totalSales += o.total;
            const color = o.status === 'Confirmado' ? 'text-green-500' : (o.status === 'Cancelado' ? 'text-red-500' : 'text-yellow-500');
            html += `<tr class="border-b border-gray-800 hover:bg-gray-800"><td class="py-2 text-white font-mono">${o.code}</td><td class="text-gray-400">${new Date(o.date).toLocaleDateString()}</td><td class="text-white">R$ ${o.total.toFixed(2)}</td><td class="${color}">${o.status}</td><td><button onclick="updateStatus('${o.id}', 'Confirmado')" class="text-green-500 hover:underline text-xs mr-2">Confirmar</button><button onclick="updateStatus('${o.id}', 'Cancelado')" class="text-red-500 hover:underline text-xs">Cancelar</button></td></tr>`;
        });
        els.ordersList.innerHTML = html; document.getElementById('stat-total-sales').innerText = `R$ ${totalSales.toFixed(2)}`;
    });
}
window.updateStatus = async (id, status) => { await updateDoc(doc(db, `sites/${state.siteId}/sales`, id), { status: status }); };