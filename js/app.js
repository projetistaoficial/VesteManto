import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase-config.js';

// --- ESTADO GLOBAL ---
const state = {
    siteId: new URLSearchParams(window.location.search).get('site') || 'demo',
    products: [],
    categories: [],
    cart: JSON.parse(localStorage.getItem('cart')) || [],
    user: null,
    currentCoupon: null
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
    // Admin
    viewCatalog: document.getElementById('view-catalog'),
    viewAdmin: document.getElementById('view-admin'),
    ordersList: document.getElementById('orders-list'),
    productListAdmin: document.getElementById('admin-product-list')
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

function initApp() {
    loadCategories();
    loadProducts();
    updateCartUI();
    
    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        state.user = user;
        if(user) {
            document.getElementById('btn-admin-login').innerText = 'Painel';
        } else {
            document.getElementById('btn-admin-login').innerText = 'Admin';
            showView('catalog');
        }
    });
}

// --- FIREBASE READ ---
function loadProducts() {
    const q = query(collection(db, `sites/${state.siteId}/products`));
    onSnapshot(q, (snapshot) => {
        state.products = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        renderCatalog(state.products);
        if(state.user) renderAdminProducts();
    });
}

function loadCategories() {
    const q = query(collection(db, `sites/${state.siteId}/categories`));
    onSnapshot(q, (snapshot) => {
        state.categories = snapshot.docs.map(d => d.data().name);
        renderCategories();
    });
}

// --- RENDERIZACAO ---
function renderCatalog(products) {
    els.grid.innerHTML = '';
    products.forEach(p => {
        // Se estoque <= 0 e não permite venda sem estoque, não mostra ou mostra esgotado
        const isOut = p.stock <= 0;
        const priceDisplay = p.promoPrice ? 
            `<span class="text-gray-500 line-through text-xs">R$ ${p.price}</span> <span class="text-green-400 font-bold">R$ ${p.promoPrice}</span>` : 
            `<span class="text-green-400 font-bold">R$ ${p.price}</span>`;

        const card = document.createElement('div');
        card.className = "bg-gray-800 rounded-lg overflow-hidden shadow-lg card-hover cursor-pointer relative group";
        card.innerHTML = `
            <div class="relative pb-[100%] bg-white">
                <img src="${p.images ? p.images[0] : 'https://placehold.co/400x400/111/FFF?text=Sem+Foto'}" class="absolute h-full w-full object-cover">
                ${isOut ? '<div class="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center text-white font-bold">ESGOTADO</div>' : ''}
            </div>
            <div class="p-3">
                <div class="flex justify-between items-start">
                    <h3 class="text-white font-bold truncate">${p.name}</h3>
                </div>
                <p class="text-gray-400 text-xs truncate mb-2">${p.description}</p>
                <div class="flex justify-between items-center">
                    ${priceDisplay}
                    <span class="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">${p.sizes ? p.sizes[0] : 'U'}</span>
                </div>
            </div>
        `;
        card.onclick = () => openProductModal(p);
        
        // Foco de teclado
        card.setAttribute('tabindex', '0');
        card.onkeydown = (e) => {
            if(e.key === 'Enter') openProductModal(p);
            if(state.user && e.key === 'Delete') confirmDeleteProduct(p.id);
        };

        els.grid.appendChild(card);
    });
}

function renderCategories() {
    els.catFilter.innerHTML = '<option value="">Todas Categorias</option>';
    state.categories.forEach(c => {
        els.catFilter.innerHTML += `<option value="${c}">${c}</option>`;
    });
    // Admin list
    const adminList = document.getElementById('admin-cat-list');
    if(adminList) {
        adminList.innerHTML = state.categories.map(c => `<li class="flex justify-between py-1 border-b border-gray-800">${c} <button onclick="deleteCategory('${c}')" class="text-red-500">x</button></li>`).join('');
    }
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
    if(p.sizes) {
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
    if(existing) {
        existing.qty++;
    } else {
        state.cart.push({
            id: product.id,
            name: product.name,
            price: parseFloat(product.promoPrice || product.price),
            size: size,
            qty: 1,
            code: product.code || '00000'
        });
    }
    saveCart();
    // Feedback visual simples
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
                <div>
                    <p class="text-white font-bold text-sm">${item.name} (${item.size})</p>
                    <p class="text-green-400 text-sm">R$ ${item.price}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changeQty(${index}, -1)" class="text-gray-400 hover:text-white px-2">-</button>
                    <span class="text-white text-sm">${item.qty}</span>
                    <button onclick="changeQty(${index}, 1)" class="text-gray-400 hover:text-white px-2">+</button>
                </div>
            </div>
        `;
    });

    // Cálculos
    let discount = 0;
    if(state.currentCoupon) {
        if(state.currentCoupon.type === 'percent') {
            discount = subtotal * (state.currentCoupon.val / 100);
        } else {
            discount = state.currentCoupon.val;
        }
    }

    const total = Math.max(0, subtotal - discount);
    
    document.getElementById('cart-subtotal').innerText = `R$ ${subtotal.toFixed(2)}`;
    document.getElementById('cart-discount').innerText = `- R$ ${discount.toFixed(2)}`;
    document.getElementById('cart-total').innerText = `R$ ${total.toFixed(2)}`;
}

window.changeQty = (index, delta) => {
    state.cart[index].qty += delta;
    if(state.cart[index].qty <= 0) state.cart.splice(index, 1);
    saveCart();
};

function saveCart() {
    localStorage.setItem('cart', JSON.stringify(state.cart));
    updateCartUI();
}

// Checkout WhatsApp
document.getElementById('btn-checkout').onclick = async () => {
    if(state.cart.length === 0) return alert('Carrinho vazio');
    
    // Gerar Pedido Pendente no Firebase (Opcional, mas recomendado para admin ver)
    const orderData = {
        items: state.cart,
        total: parseFloat(document.getElementById('cart-total').innerText.replace('R$ ','').replace(',','.')),
        date: new Date().toISOString(),
        status: 'Pendente',
        code: Math.floor(10000 + Math.random() * 90000)
    };
    
    // Tenta salvar se a config permitir escrita pública em 'orders' (ver regras) ou salvar só no localStorage
    // Para simplificar demo pública sem Auth, vamos só gerar o link, mas o ideal é salvar via Cloud Function ou regra frouxa (cuidado)
    // Vamos salvar se houver siteId configurado
    try {
        await addDoc(collection(db, `sites/${state.siteId}/sales`), orderData);
    } catch(e) { console.log("Erro ao salvar pedido (provavelmente permissão):", e); }

    let msg = `*NOVO PEDIDO - ${orderData.code}*\n\n`;
    state.cart.forEach(i => {
        msg += `▪ ${i.qty}x ${i.name} (${i.size}) - R$ ${i.price}\n`;
    });
    msg += `\nSubtotal: ${document.getElementById('cart-subtotal').innerText}`;
    if(state.currentCoupon) msg += `\nCupom: ${state.currentCoupon.code}`;
    msg += `\n*TOTAL: ${document.getElementById('cart-total').innerText}*`;
    msg += `\n\nAguardo link de pagamento!`;

    const sellerPhone = "5511999999999"; // Substituir no admin
    window.open(`https://wa.me/${sellerPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    
    // Limpar
    state.cart = [];
    saveCart();
    document.getElementById('cart-modal').classList.add('hidden');
};

// --- ADMIN LOGIC ---
document.getElementById('btn-login-submit').onclick = () => {
    const pass = document.getElementById('admin-pass').value;
    // Autenticação Real com Firebase
    // Para o demo funcionar com admin123, vamos simular ou usar login real se vc criar o user no console
    // AQUI: Usaremos signInWithEmailAndPassword. Você deve criar o user 'admin@loja.com' com senha 'admin123' no console.
    
    signInWithEmailAndPassword(auth, "admin@admin.com", pass)
    .then(() => {
        document.getElementById('login-modal').close();
        showView('admin');
    })
    .catch((error) => {
        alert("Erro login: " + error.message);
    });
};

document.getElementById('btn-logout').onclick = () => signOut(auth);

function showView(viewName) {
    if(viewName === 'admin') {
        els.viewCatalog.classList.add('hidden');
        els.viewAdmin.classList.remove('hidden');
        loadAdminSales();
    } else {
        els.viewCatalog.classList.remove('hidden');
        els.viewAdmin.classList.add('hidden');
    }
}

// Navegação Tabs Admin
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById(btn.dataset.tab).classList.remove('hidden');
        // Update estilos
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500');
            b.classList.add('text-gray-400');
        });
        btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500');
        btn.classList.remove('text-gray-400');
    };
});

// Admin: Produtos CRUD (Resumo)
document.getElementById('form-product').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-prod-id').value;
    const data = {
        name: document.getElementById('prod-name').value,
        description: document.getElementById('prod-desc').value,
        price: parseFloat(document.getElementById('prod-price').value),
        promoPrice: parseFloat(document.getElementById('prod-promo').value) || null,
        stock: parseInt(document.getElementById('prod-stock').value) || 0,
        cost: parseFloat(document.getElementById('prod-cost').value) || 0,
        sizes: document.getElementById('prod-sizes').value.split(',').map(s=>s.trim()),
        images: [document.getElementById('prod-img').value], // Simplificado para URL
        code: id ? undefined : Math.floor(10000 + Math.random() * 90000).toString()
    };
    if(data.code === undefined) delete data.code; // Não sobrescrever código se editar

    try {
        if(id) {
            await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data);
        } else {
            await addDoc(collection(db, `sites/${state.siteId}/products`), data);
        }
        document.getElementById('product-form-modal').classList.add('hidden');
        e.target.reset();
    } catch(err) {
        alert("Erro ao salvar: " + err.message);
    }
};

function renderAdminProducts() {
    els.productListAdmin.innerHTML = '';
    state.products.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-gray-800 p-3 rounded flex justify-between items-center";
        div.innerHTML = `
            <div class="flex items-center gap-2">
                <img src="${p.images[0]}" class="w-10 h-10 object-cover rounded">
                <div>
                    <p class="font-bold text-white text-sm">${p.name}</p>
                    <p class="text-xs text-gray-400">Estoque: ${p.stock}</p>
                </div>
            </div>
            <div>
                <button onclick="editProduct('${p.id}')" class="text-yellow-500 mr-2"><i class="fas fa-edit"></i></button>
                <button onclick="confirmDeleteProduct('${p.id}')" class="text-red-500"><i class="fas fa-trash"></i></button>
            </div>
        `;
        els.productListAdmin.appendChild(div);
    });
}

// Disponibilizar func global
window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id);
    if(!p) return;
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
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
    if(confirm('Tem certeza que deseja excluir?')) {
        await deleteDoc(doc(db, `sites/${state.siteId}/products`, id));
    }
};

// Admin: Vendas
function loadAdminSales() {
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));
    onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
        let html = '';
        let totalSales = 0;
        
        orders.forEach(o => {
            if(o.status !== 'Cancelado') totalSales += o.total;
            
            const color = o.status === 'Confirmado' ? 'text-green-500' : (o.status === 'Cancelado' ? 'text-red-500' : 'text-yellow-500');
            
            html += `
                <tr class="border-b border-gray-800 hover:bg-gray-800">
                    <td class="py-2 text-white font-mono">${o.code}</td>
                    <td class="text-gray-400">${new Date(o.date).toLocaleDateString()}</td>
                    <td class="text-white">R$ ${o.total.toFixed(2)}</td>
                    <td class="${color}">${o.status}</td>
                    <td>
                        <button onclick="updateStatus('${o.id}', 'Confirmado')" class="text-green-500 hover:underline text-xs mr-2">Confirmar</button>
                        <button onclick="updateStatus('${o.id}', 'Cancelado')" class="text-red-500 hover:underline text-xs">Cancelar</button>
                    </td>
                </tr>
            `;
        });
        els.ordersList.innerHTML = html;
        document.getElementById('stat-total-sales').innerText = `R$ ${totalSales.toFixed(2)}`;
    });
}

window.updateStatus = async (id, status) => {
    await updateDoc(doc(db, `sites/${state.siteId}/sales`, id), { status: status });
    // TODO: Lógica de baixar estoque aqui (ler pedido, iterar itens, subtrair stock)
};

// --- EVENT LISTENERS GERAIS ---
function setupEventListeners() {
    // Busca
    els.searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
        renderCatalog(filtered);
    });

    // Filtro Categoria
    els.catFilter.addEventListener('change', (e) => {
        const cat = e.target.value;
        if(!cat) return renderCatalog(state.products);
        // Assumindo que produto tenha campo category
        // renderCatalog(state.products.filter(p => p.category === cat));
        // Para o demo simplificado, não implementei category no form, mas a lógica seria essa.
    });

    // Cart Modal Toggle
    const toggleCart = () => els.cartModal.classList.toggle('hidden');
    document.getElementById('cart-btn').onclick = toggleCart;
    document.getElementById('cart-btn-mobile').onclick = toggleCart;
    document.getElementById('close-cart').onclick = toggleCart;

    // Login Modal
    document.getElementById('btn-admin-login').onclick = () => {
        if(state.user) {
            showView('admin');
        } else {
            document.getElementById('login-modal').showModal();
        }
    };
    document.getElementById('btn-login-cancel').onclick = () => document.getElementById('login-modal').close();

    // Product Modal
    document.getElementById('close-modal').onclick = () => els.modalProduct.classList.add('hidden');
    els.modalProduct.onclick = (e) => { if(e.target === els.modalProduct) els.modalProduct.classList.add('hidden'); };

    // Admin UI
    document.getElementById('btn-add-product').onclick = () => {
        document.getElementById('form-product').reset();
        document.getElementById('edit-prod-id').value = '';
        document.getElementById('product-form-modal').classList.remove('hidden');
    };
    document.getElementById('btn-cancel-prod').onclick = () => document.getElementById('product-form-modal').classList.add('hidden');
}