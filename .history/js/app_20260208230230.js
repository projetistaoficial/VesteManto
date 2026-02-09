console.log("!!! ARQUIVO NOVO CARREGADO COM SUCESSO !!!");

import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs, getDoc, runTransaction, getDocFromServer } from './firebase-config.js';
import { initStatsModule, updateStatsData } from './stats.js';
import { checkAndActivateSupport, initSupportModule } from './support.js';
// =================================================================
// 1. HELPERS (FUNÇÕES AUXILIARES)
// =================================================================
// --- CORREÇÃO: FUNÇÃO DE VALIDAÇÃO DE CHECKBOXES ---
function validateSubOptions(className) {
    const checkboxes = document.querySelectorAll(`.${className}`);
    checkboxes.forEach(chk => {
        chk.addEventListener('change', (e) => {
            const checkedCount = document.querySelectorAll(`.${className}:checked`).length;
            if (checkedCount === 0) {
                if (typeof showSystemModal === 'function') {
                    showSystemModal("⚠️ Selecione pelo menos uma opção neste grupo.");
                } else {
                    alert("⚠️ Selecione pelo menos uma opção neste grupo.");
                }
                e.target.checked = true;
                return;
            }
            if (typeof autoSaveSettings === 'function') autoSaveSettings('installments');
        });
    });
}

// --- MÁSCARA DE TAXA (Efeito 0,00 -> 0,01 -> 1,00) ---
function setupRateMask() {
    const input = document.getElementById('conf-card-rate');
    if (!input) return;

    input.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é dígito

        // Se estiver vazio, zera
        if (value === "") {
            e.target.value = "";
            return;
        }

        // Converte para decimal (divide por 100) e fixa 2 casas
        // Ex: digita 3 -> 0.03 -> "0,03"
        // Ex: digita 300 -> 3.00 -> "3,00"
        value = (parseInt(value) / 100).toFixed(2);

        // Troca ponto por vírgula
        value = value.replace('.', ',');

        e.target.value = value;
    });

    // Garante que salve ao sair do campo
    input.addEventListener('blur', () => {
        if (typeof autoSaveSettings === 'function') autoSaveSettings('installments');
    });
}

// --- CORREÇÃO FINAL: FUNÇÃO VISUAL DE PAGAMENTO ---
function updatePaymentVisuals() {
    const groupOnline = document.getElementById('group-online-methods');
    const groupDelivery = document.getElementById('group-delivery-methods');

    // Checkboxes principais
    const chkOnline = document.getElementById('conf-pay-online-active');
    const chkDelivery = document.getElementById('conf-pay-delivery-active');

    // Atualiza Online
    if (groupOnline && chkOnline) {
        if (chkOnline.checked) {
            groupOnline.className = "space-y-3 opacity-100";
        } else {
            groupOnline.className = "space-y-3 opacity-30 pointer-events-none";
        }
    }

    // Atualiza Entrega
    if (groupDelivery && chkDelivery) {
        if (chkDelivery.checked) {
            groupDelivery.className = "space-y-3 opacity-100";
        } else {
            groupDelivery.className = "space-y-3 opacity-30 pointer-events-none";
        }
    }
}

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

    // 1. Prepara os dados
    const rua = customer.street || "Rua não informada";
    const numero = customer.addressNum || "S/N";
    const bairro = customer.district || "";
    const cep = customer.cep || "";
    const complemento = customer.comp ? ` - ${customer.comp}` : "";

    // 2. Cria a string completa para Copiar e para o Link do Maps
    const fullAddress = `${rua}, ${numero}${complemento} - ${bairro} - CEP: ${cep}`;
    const AddressMaps = `${rua}, ${numero} - ${bairro} - CEP: ${cep}`;

    // Escapa aspas para não quebrar o HTML do botão
    const safeAddress = fullAddress.replace(/'/g, "\\'");

    // Gera link do Google Maps
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
    siteId: window.SITE_ID || new URLSearchParams(window.location.search).get('site') || 'demo',
    products: [],
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
        deliveryConfig: { ownDelivery: false, cancelTimeMin: 5 },
        tempLogo: null,
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
    globalSettings: { allowNoStock: false }, // <--- Mude para TRUE
    cardSelections: {},

    //Configurações da aba PRODUTOS
    isSelectionMode: false, // : Controla se checkboxes aparecem
    selectedProducts: new Set(),
    //Configuração padrão de ordenação
    sortConfig: { key: 'code', direction: 'desc' },
};
let originalTheme = null;

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
// 3. INICIALIZAÇÃO CORRIGIDA
// =================================================================

const startApplication = async () => {
    console.log("🚀 Iniciando App V4...");
    
    // 1. Tenta Validar o Acesso (O await segura o código aqui)
    const acessoPermitido = await initApp();

    // 2. Só carrega o resto se o initApp retornar TRUE
    if (acessoPermitido) {
        console.log("✅ Acesso Liberado. Carregando interface...");
        setupEventListeners();
        setupKeyboardListeners();
        
        // Remove a "Cortina" (Mostra o site)
        document.body.classList.add('loaded');
    } else {
        console.log("⛔ Acesso Negado. Site permanece oculto/bloqueado.");
        // Não faz nada, a função initApp já exibiu a tela de morte
    }
};

// Auto-execução
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

async function initApp() {
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('site');

    console.log(`🔍 [CHECK] Verificando ID na URL: "${siteId}"`);

    if (!siteId) {
        console.error("❌ [ERRO] Sem ID na URL.");
        exibirTelaMorte("Loja não identificada", "Link inválido.");
        return false; // Bloqueia
    }

    state.siteId = siteId;

    try {
        console.log(`📡 [REDE] Contactando servidor para: sites/${siteId}`);
        const docRef = doc(db, "sites", siteId);
        
        // FORÇA A IDA AO SERVIDOR (IGNORA CACHE)
        const snap = await getDocFromServer(docRef);

        console.log(`📡 [REDE] Resposta recebida.`);
        console.log(`❓ [DIAGNÓSTICO] O documento existe? -> ${snap.exists()}`);

        // A. CENÁRIO: SITE EXCLUÍDO
        if (!snap.exists()) {
            console.error("❌ [FATAL] O SITE FOI DELETADO. (snap.exists = false)");
            localStorage.removeItem('vestemanto_cart'); 
            exibirTelaMorte("404", "Esta loja não existe mais.");
            return false; // RETORNA FALSE PARA BLOQUEAR O RESTANTE
        }

        const data = snap.data();
        console.log("ℹ️ [DADOS] Status da loja:", data.status, "| Active:", data.active);

        // B. CENÁRIO: SITE BLOQUEADO
        if (data.status === 'bloqueado' || data.active === false || data.status === 'excluido') {
            console.error("⛔ [BLOQUEIO] Site marcado como bloqueado/inativo.");
            exibirTelaMorte("Suspenso", "Loja indisponível.");
            return false; // RETORNA FALSE
        }

        // === SUCESSO ===
        console.log("🔓 [SUCESSO] Loja válida. Carregando dados...");
        state.storeProfile = data;

        // Carregamentos do sistema (Seguros pois já sabemos que o site existe)
        loadSiteStats();
        incrementVisitsCounter();
        loadSettings();
        loadCategories();
        loadProducts();
        
        if(typeof renderStoreProfile === 'function') renderStoreProfile();

        loadCoupons();
        updateCartUI();
        startBackgroundListeners();
        initStatsModule();
        loadTheme();

        // Monitoramento em tempo real (mata a sessão se deletar durante o uso)
        setInterval(async () => {
            try {
                const check = await getDocFromServer(docRef);
                if (!check.exists()) {
                    console.warn("⚠️ [MONITOR] Site deletado em tempo real. Recarregando...");
                    window.location.reload(); 
                }
            } catch(e) {}
        }, 15000);

        if (localStorage.getItem('theme') === 'light') toggleTheme(false);
        setupAuthListener();
        checkActiveOrders();

        return true; // LIBERA O STARTAPPLICATION

    } catch (error) {
        console.error("🔥 [EXCEPTION] Erro crítico na verificação:", error);
        
        // Garante que o corpo apareça para mostrar o erro
        document.body.style.display = 'block';

        let titulo = "Erro";
        let msg = "Não foi possível carregar.";

        // Se der erro de permissão, é porque foi deletado e a regra de segurança bloqueou (O QUE É BOM)
        if (error.code === 'permission-denied') {
            console.log("🛡️ [SEGURANÇA] Permissão negada (Provavelmente site deletado).");
            titulo = "404";
            msg = "Esta loja foi encerrada.";
        } 
        else if (error.message === "SITE_DELETED") {
             titulo = "404"; msg = "Loja não encontrada.";
        }

        exibirTelaMorte(titulo, msg);
        return false; // BLOQUEIA
    }
}

/// ============================================================
// FUNÇÃO AUXILIAR ÚNICA: TELA DE MORTE (KILL SCREEN)
// ============================================================
function exibirTelaMorte(titulo, msg) {
    console.error(`[KILL SCREEN] ${titulo}: ${msg}`);

    // 1. Limpa e Prepara o Body
    document.body.innerHTML = '';
    document.body.style.backgroundColor = '#000';
    document.body.style.display = 'block'; // Garante que o container apareça
    
    // 2. Define o HTML do Erro
    document.body.innerHTML = `
        <div style="
            position: fixed; inset: 0; background: #000; color: #fff; 
            display: flex; flex-direction: column; align-items: center; justify-content: center; 
            z-index: 999999; font-family: sans-serif; text-align: center; padding: 20px;
        ">
            <div style="font-size: 4rem; color: #ef4444; margin-bottom: 20px;">
                <i class="fas fa-ban"></i>
            </div>
            <h1 style="font-size: 2.5rem; font-weight: bold; margin: 0; text-transform: uppercase;">${titulo}</h1>
            <p style="color: #9ca3af; margin-top: 15px; font-size: 1.2rem;">${msg}</p>
            
            <button onclick="window.location.reload()" style="
                margin-top: 40px; padding: 15px 30px; background: #ef4444; color: white; 
                border: none; border-radius: 8px; font-weight: bold; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;
            ">
                Tentar Novamente
            </button>
        </div>
    `;

    // 3. Força a visibilidade (CSS Override)
    document.body.style.opacity = "1";
    document.body.style.pointerEvents = "auto";
    document.body.classList.add('acesso-liberado'); // Caso use a classe CSS
    document.body.classList.add('loaded');          // Caso use a outra classe

    // 4. Garante que o ícone apareça (Injeta FontAwesome se sumiu)
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(link);
    }
}

// Pequeno alias para garantir compatibilidade se algum lugar chamar o nome antigo
window.renderKillScreen = exibirTelaMorte;

// =================================================================
// 4. LÓGICA DE DADOS (CARREGAMENTO)
// =================================================================

// Substitua a função loadSettings atual por esta:
function loadSettings() {
    // 1. Verifica se temos um ID antes de tentar falar com o banco
    if (!state.siteId || state.siteId === 'demo') {
        console.warn("⚠️ Settings ignorados: modo demo ou ID ausente.");
        return;
    }

    const docRef = doc(db, `sites/${state.siteId}/settings`, 'general');

    // 2. O 'unsubscribe' permite que o Firebase pare de tentar conectar se der erro
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            state.globalSettings = docSnap.data();
            if (els.toggleStockGlobal) els.toggleStockGlobal.checked = !!state.globalSettings.allowNoStock;
            console.log("✅ Configurações carregadas.");
        } else {
            // Isso resolve o aviso amarelo da sua imagem
            console.warn("⚠️ Documento de settings não existe no Firestore.");
            state.globalSettings = { allowNoStock: true }; // Padrão seguro
            
            // IMPORTANTE: Se o documento de configuração sumiu, 
            // talvez o site todo tenha sido deletado.
            // Opcional: unsubscribe(); 
        }

        if (typeof renderCatalog === 'function') renderCatalog(state.products);

    }, (error) => {
        // Isso resolve o erro 400 e os erros de RPC 'Listen' da sua imagem
        console.error("❌ Erro de conexão em Settings (RPC Listen):", error);
        
        // Se o erro for de permissão ou "not-found", paramos de tentar ouvir
        if (error.code === 'permission-denied' || error.code === 'not-found') {
            console.warn("🛑 Encerrando escuta de configurações devido a erro fatal.");
            unsubscribe(); 
        }
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
    // 1. Query no Banco de Dados
    const q = query(collection(db, `sites/${state.siteId}/sales`), orderBy('date', 'desc'));

    onSnapshot(q, (snapshot) => {
        // 2. Salva os dados no State
        state.orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // --- PARTE 1: NOTIFICAÇÕES (O que estava faltando) ---
        // Conta quantos pedidos não foram vistos (!o.viewed)
        const newOrdersCount = state.orders.filter(o => !o.viewed).length;

        // Atualiza o Botão "Vendas" no Menu
        const salesBtn = document.getElementById('admin-menu-sales');
        if (salesBtn) {
            if (newOrdersCount > 0) {
                salesBtn.innerHTML = `
                    Vendas 
                    <span class="ml-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg animate-pulse">
                        ${newOrdersCount}
                    </span>`;
            } else {
                salesBtn.innerText = 'Vendas';
            }
        }

        // Atualiza o Título da Aba do Navegador
        document.title = newOrdersCount > 0 ? `(${newOrdersCount}) Painel Admin` : 'Painel Admin';
        // -----------------------------------------------------

        // --- PARTE 2: ATUALIZAÇÃO DE DADOS (O que você pediu para manter) ---

        // Atualiza Dashboard e Tabela de Vendas
        if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
        if (typeof updateDashboardMetrics === 'function') updateDashboardMetrics();

        // Atualiza a tabela de produtos (para preencher colunas "Vendas" e "Data")
        // Só roda se a tabela de produtos estiver na tela
        if (document.getElementById('admin-product-list')) {
            filterAndRenderProducts();
        }

        // Atualiza Estatísticas Gerais (Financeiro, Gráficos)
        if (typeof updateStatsData === 'function') {
            updateStatsData(state.orders, state.products, state.dailyStats);
        }
    });
}


window.openAdminOrderDetail = async (order) => {
    // 1. Marca como visualizado no banco (Remove o "NOVO")
    if (!order.viewed) {
        try {
            const orderRef = doc(db, `sites/${state.siteId}/sales`, order.id);
            updateDoc(orderRef, { viewed: true });
        } catch (e) { console.error("Erro ao marcar visto:", e); }
    }

    // 2. Preenche o Modal de Detalhes
    // IDs baseados no padrão comum. Verifique se o seu HTML usa estes IDs.
    const idEl = document.getElementById('admin-order-id-display');
    const nameEl = document.getElementById('admin-client-name');
    const phoneEl = document.getElementById('admin-client-phone');
    const addrEl = document.getElementById('admin-client-address');
    const itemsEl = document.getElementById('admin-order-items');
    const totalEl = document.getElementById('admin-order-total');
    const statusSelect = document.getElementById('admin-order-status-select');

    // Preenche textos
    if (idEl) idEl.innerText = `#${order.code || order.id.slice(0, 6)}`;
    if (nameEl) nameEl.innerText = order.customer?.name || 'Cliente Sem Nome';
    if (phoneEl) phoneEl.innerText = order.customer?.phone || '-';

    // Preenche Endereço
    if (addrEl) {
        if (typeof formatarEnderecoAdmin === 'function') {
            addrEl.innerHTML = formatarEnderecoAdmin(order.customer);
        } else {
            addrEl.innerText = order.customer?.address || 'Endereço não informado';
        }
    }

    // Preenche Itens
    if (itemsEl) {
        itemsEl.innerHTML = (order.items || []).map(i => `
            <div class="flex justify-between py-2 border-b border-gray-700 text-sm">
                <div><span class="text-yellow-500 font-bold">${i.qty}x</span> ${i.name}</div>
                <div class="text-white">${formatCurrency(i.price * i.qty)}</div>
            </div>
        `).join('');

        // Adiciona Frete se houver
        if (order.shippingFee > 0) {
            itemsEl.innerHTML += `
                <div class="flex justify-between py-2 border-b border-gray-700 text-sm text-gray-400">
                    <div>Frete</div>
                    <div>+ ${formatCurrency(order.shippingFee)}</div>
                </div>`;
        }
    }

    // Preenche Total
    if (totalEl) totalEl.innerText = formatCurrency(order.total);

    // Configura o Select de Status
    if (statusSelect) {
        statusSelect.value = order.status;
        statusSelect.setAttribute('onchange', `handleStatusChange(this, '${order.id}')`);
    }

    // Configura Botões de Ação do Modal
    const btnCancel = document.getElementById('btn-admin-cancel-order');
    const btnFinish = document.getElementById('btn-admin-finish-order');
    if (btnCancel) btnCancel.onclick = () => adminCancelOrder(order.id);
    if (btnFinish) btnFinish.onclick = () => adminFinalizeOrder(order.id);

    // 3. Exibe o Modal
    const modal = document.getElementById('modal-admin-order');
    if (modal) modal.classList.remove('hidden');
};

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
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const currentVal = docSnap.data()[type] || 0;
            await updateDoc(docRef, { [type]: currentVal + 1 });
        } else {
            // Se não existe o dia, cria com o valor inicial
            await setDoc(docRef, {
                visits: type === 'visits' ? 1 : 0,
                shares: type === 'shares' ? 1 : 0
            });
        }
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

function renderCatalog(productsToRender) {
    if (!els.grid) return;
    els.grid.innerHTML = '';

    // 1. FILTRAGEM
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

    // 2. ORDENAÇÃO
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

    // Configurações
    const pixGlobal = state.storeProfile.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };
    const globalInst = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3 };

    filtered.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const isOut = p.stock <= 0 && !allowNegative;
        const currentPrice = parseFloat(p.promoPrice || p.price);

        // --- LÓGICA DE EXIBIÇÃO DO PIX (CORRIGIDA) ---
        let pixHtml = '';

        if (!pixGlobal.disableAll) {

            // A) Regra Global Ativa
            if (pixGlobal.active && pixGlobal.value > 0) {

                // Determina o texto correto da etiqueta (R$ ou %)
                const isFixed = (pixGlobal.type === 'fixed');
                const labelOff = isFixed
                    ? `${formatCurrency(pixGlobal.value)} OFF`
                    : `${pixGlobal.value}% OFF`;

                if (pixGlobal.mode === 'total') {
                    // MODO TOTAL: Exibe apenas a etiqueta informativa (sem calcular preço unitário)
                    // CORREÇÃO: Usa labelOff para mostrar "R$ 10,00 OFF" em vez de "10% OFF" se for fixo
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-tag mr-1"></i>${labelOff} no Pix (Total)</p>`;
                } else {
                    // MODO PRODUTO: Calcula o preço unitário
                    let valDesconto = 0;
                    if (isFixed) {
                        valDesconto = pixGlobal.value;
                    } else {
                        valDesconto = currentPrice * (pixGlobal.value / 100);
                    }

                    const finalPix = Math.max(0, currentPrice - valDesconto);

                    // Exibe o preço calculado
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-bolt mr-1"></i>${formatCurrency(finalPix)} no Pix</p>`;
                }

            }

            // B) Regra Individual (Fallback)
            else if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
                const pix = p.paymentOptions.pix;
                let finalPix = currentPrice;

                if (pix.type === 'percent') {
                    finalPix = currentPrice * (1 - (pix.val / 100));
                } else {
                    finalPix = Math.max(0, currentPrice - pix.val);
                }

                pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-bolt mr-1"></i>${formatCurrency(finalPix)} no Pix</p>`;
            }
        }

        // Parcelamento
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
            `<div class="flex flex-col">
                <span class="text-gray-500 line-through text-[10px]">${formatCurrency(p.price)}</span>
                <span class="text-[var(--txt-price)] font-bold text-base">${formatCurrency(p.promoPrice)}</span>
             </div>` :
            `<span class="text-[var(--txt-price)] font-bold text-base">${formatCurrency(p.price)}</span>`;

        const imgOpacity = isOut ? 'opacity-50 grayscale' : '';

        // Badges
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


// =======================================================================================================================//=======================================================================================================================
//LÓGICA DE CATEGORIAS, EXIBIÇÃO, ORDEM, EDIÇÃO E EXCLUSÃO - FIM
// =================================================================
function renderCategories() {
    // 1. Definição da Função de Preenchimento (Interna e Segura)
    const populateSelect = (elementId) => {
        const selectEl = document.getElementById(elementId); // Pega direto do HTML para garantir
        if (!selectEl) return;

        const currentVal = selectEl.value;

        // LÓGICA DE TEXTO:
        // Aumentei para 768px para pegar tablets e celulares grandes também
        const isMobile = window.innerWidth < 768;

        // Texto bem curto para mobile
        const defaultLabel = isMobile ? "Todas categorias" : "Todas as Categorias";

        // Aplica o HTML
        // A classe text-xs ou text-[8px] do HTML vai controlar o tamanho da fonte.
        // Aqui controlamos apenas o QUE está escrito.
        selectEl.innerHTML = `<option value="" class="text-gray-500">${defaultLabel}</option>`;

        // Adiciona as categorias
        state.categories.forEach(c => {
            selectEl.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        });

        // Restaura a seleção
        if (currentVal) selectEl.value = currentVal;
    };

    // 2. Chama a função para todos os selects de categoria do site
    populateSelect('category-filter');       // Filtro da Vitrine
    populateSelect('admin-filter-cat');      // Filtro do Admin
    populateSelect('bulk-category-select');  // Ações em massa
    populateSelect('prod-cat-select');       // Formulário de produto
    populateSelect('bulk-category-select-dynamic'); // Barra dinâmica

    // 3. Renderiza a Sidebar (Menu Lateral)
    const sidebarContainer = document.getElementById('sidebar-categories');
    if (sidebarContainer) {
        const catNames = state.categories.map(c => c.name);

        // Monta a Árvore de Categorias
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

        // Função Recursiva HTML para Sidebar
        const buildHtml = (node, level = 0) => {
            let html = '';
            const keys = Object.keys(node).sort();

            keys.forEach(key => {
                const item = node[key];
                const hasChildren = Object.keys(item._children).length > 0;
                const safePath = item._path.replace(/'/g, "\\'");
                const paddingLeft = level === 0 ? 12 : (level * 20) + 12;
                const textStyle = level === 0
                    ? "text-[var(--txt-body)] font-bold uppercase tracking-wide text-sm"
                    : "text-gray-300 font-medium text-sm hover:text-white";

                if (hasChildren) {
                    html += `
                        <details class="group mb-1">
                            <summary class="list-none flex items-center justify-between cursor-pointer rounded hover:bg-gray-800 transition pr-2 py-2">
                                <span class="${textStyle} flex-1" style="padding-left:${paddingLeft}px" onclick="event.preventDefault(); filterByCat('${safePath}')">${key}</span>
                                <span class="text-gray-500 text-sm transform transition-transform duration-200 group-open:rotate-180 p-2">▲</span>
                            </summary>
                            <div class="border-l border-gray-800 ml-4">${buildHtml(item._children, level + 1)}</div>
                        </details>`;
                } else {
                    html += `
                        <div class="block w-full text-left py-2 mb-1 rounded hover:bg-gray-800 cursor-pointer transition flex items-center" onclick="filterByCat('${safePath}')">
                            <span class="${textStyle}" style="padding-left:${paddingLeft}px">${key}</span>
                        </div>`;
                }
            });
            return html;
        };

        sidebarContainer.innerHTML = `<div class="space-y-1 mt-2">${buildHtml(tree)}</div>`;
    }
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
                                <span class="text-gray-300 text-sm group-open:text-yellow-500">▲</span>
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
                Qtd Vendidas ${getSortIcon('sales')}
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

        // Formatação do valor (R$ ou %)
        const typeDisplay = c.type === 'percent'
            ? `<span class="text-green-400 font-bold bg-green-900/20 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">${c.val}% OFF</span>`
            : `<span class="text-green-400 font-bold bg-green-900/20 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">${formatCurrency(c.val)} OFF</span>`;

        let isExpired = false;
        let expiryDisplay = `<span class="text-[10px] text-green-500 font-bold flex items-center gap-1 whitespace-nowrap"><i class="fas fa-infinity text-[8px]"></i> Permanente</span>`;

        if (c.expiryDate) {
            const expiryDate = new Date(c.expiryDate);
            const now = new Date();
            // Formatação de data curta para mobile
            const dateStr = expiryDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            if (now > expiryDate) {
                isExpired = true;
                // 'w-fit' e 'block' ajudam a não quebrar o layout lateralmente
                expiryDisplay = `<span class="text-[9px] text-red-400 font-bold bg-red-900/20 px-2 py-0.5 rounded border border-red-900/50 block mt-1 w-fit">EXPIRADO: ${dateStr}</span>`;
            } else {
                expiryDisplay = `<span class="text-[10px] text-gray-400 whitespace-nowrap">Expira: <span class="text-white font-bold">${dateStr}</span></span>`;
            }
        }

        const borderClass = isExpired ? 'border-red-600 opacity-75' : 'border-green-500';
        const isFocused = index === state.focusedCouponIndex;
        // Adicionado 'w-full' aqui no container
        const bgClass = isFocused ? 'bg-gray-700 ring-1 ring-yellow-500 z-10' : 'bg-[#151720] border-gray-800';

        return `
            <div id="coupon-item-${index}" 
                 onclick="selectCoupon(${index})" 
                 ondblclick="editCoupon('${c.id}')" 
                 class="${bgClass} w-full border-l-4 ${borderClass} p-3 rounded-lg flex justify-between items-center shadow-sm mb-2 cursor-pointer transition select-none group relative overflow-hidden">
                
                ${isFocused ? '<div class="absolute -left-2 top-1/2 -translate-y-1/2 text-yellow-500 text-xs"><i class="fas fa-caret-right"></i></div>' : ''}

                <div class="flex flex-col flex-1 min-w-0 pr-3 pointer-events-none">
                    <span class="text-yellow-500 font-bold text-base tracking-wider truncate group-hover:text-white transition w-full block">${c.code}</span>
                    
                    <div class="flex flex-wrap items-center gap-2 mt-1">
                        ${typeDisplay}
                        ${!isExpired ? expiryDisplay : ''}
                    </div>
                    ${isExpired ? expiryDisplay : ''}
                </div>
                
                <button onclick="event.stopPropagation(); deleteCoupon('${c.id}')" 
                        class="w-9 h-9 shrink-0 flex items-center justify-center bg-red-600/10 text-red-500 border border-red-600/30 hover:bg-red-600 hover:text-white rounded transition z-20 active:scale-95">
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

        // E. Pagamento (LÓGICA BLINDADA PARA CRÉDITO E DÉBITO)
        let matchPayment = true;

        if (payment) {
            // Normaliza para minúsculo para facilitar a busca
            const method = (o.paymentMethod || '').toLowerCase();

            if (payment === 'pix') {
                matchPayment = method.includes('pix');
            }
            else if (payment === 'credit') {
                // 1. Tem que ter a palavra crédito
                const hasCredit = method.includes('crédito') || method.includes('credito') || method.includes('credit');

                // 2. NÃO pode ser misturado (não pode ter barra '/' nem a palavra 'débito')
                const isMixed = method.includes('/') || method.includes('débito') || method.includes('debito');

                matchPayment = hasCredit && !isMixed;
            }
            else if (payment === 'debit') {
                // 1. Tem que ter a palavra débito
                const hasDebit = method.includes('débito') || method.includes('debito') || method.includes('debit');

                // 2. NÃO pode ser misturado (não pode ter barra '/' nem a palavra 'crédito')
                const isMixed = method.includes('/') || method.includes('crédito') || method.includes('credito');

                matchPayment = hasDebit && !isMixed;
            }
            else if (payment === 'cash') {
                matchPayment = method.includes('dinheiro') || method.includes('espécie');
            }
        }

        // F. Data (CORREÇÃO DE FUSO HORÁRIO)
        let matchDate = true;
        if (dateStart || dateEnd) {
            const oDate = new Date(o.date); // Data do pedido (Objeto JS)

            if (dateStart) {
                // Quebra a string "2026-01-28" para garantir que o navegador use o fuso LOCAL
                const [ano, mes, dia] = dateStart.split('-').map(Number);
                // Cria data local: 00:00:00 do dia escolhido
                const s = new Date(ano, mes - 1, dia, 0, 0, 0, 0);

                if (oDate < s) matchDate = false;
            }
            if (dateEnd) {
                const [ano, mes, dia] = dateEnd.split('-').map(Number);
                // Cria data local: 23:59:59 do dia escolhido
                const e = new Date(ano, mes - 1, dia, 23, 59, 59, 999);

                if (oDate > e) matchDate = false;
            }
        }

        return matchCode && matchGeneral && matchProduct && matchStatus && matchPayment && matchDate;
    });

    // 3. ORDENAÇÃO ATUALIZADA (Select + Proximidade Numérica)
    const sortVal = document.getElementById('filter-sort-order') ? document.getElementById('filter-sort-order').value : 'date_desc';

    filtered.sort((a, b) => {
        // A. Se usuário digitou número, prioriza a proximidade (Lógica anterior mantida)
        if (termCode) {
            const target = parseInt(termCode);
            const codeA = parseInt(a.code) || 0;
            const codeB = parseInt(b.code) || 0;
            const distA = Math.abs(codeA - target);
            const distB = Math.abs(codeB - target);
            if (distA !== distB) return distA - distB;
        }

        // B. Ordenação pelo Select (Data ou Valor)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        const valA = parseFloat(a.total) || 0;
        const valB = parseFloat(b.total) || 0;

        switch (sortVal) {
            case 'val_desc': // Maior Valor
                return valB - valA;
            case 'val_asc':  // Menor Valor
                return valA - valB;
            case 'date_asc': // Mais Antigo
                return dateA - dateB;
            case 'date_desc': // Mais Recente (Padrão)
            default:
                return dateB - dateA;
        }
    });

    // 4. CÁLCULO DO TOTAL FILTRADO (NOVO)
    const totalValueFiltered = filtered.reduce((acc, order) => acc + (parseFloat(order.total) || 0), 0);
    const totalDisplay = document.getElementById('orders-filtered-total');
    if (totalDisplay) totalDisplay.innerText = formatCurrency(totalValueFiltered);

    // 5. Renderiza e Atualiza Contadores
    renderSalesList(filtered);
    if (typeof renderOrdersSummary === 'function') renderOrdersSummary(filtered, status);

    const countEl = document.getElementById('orders-count');
    if (countEl) countEl.innerText = filtered.length;
}

function renderSalesList(orders) {
    const listEl = document.getElementById('orders-list');
    if (!listEl) return;

    // Memória de acordeão
    const openOrderIds = new Set();
    listEl.querySelectorAll('[id^="order-content-"]:not(.hidden)').forEach(el => {
        const id = el.id.replace('order-content-', '');
        openOrderIds.add(id);
    });

    listEl.innerHTML = '';

    if (orders.length === 0) {
        listEl.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-inbox text-4xl mb-2 opacity-50"></i><p>Nenhum pedido encontrado.</p></div>';
        return;
    }

    orders.forEach(o => {
        const isNew = !o.viewed;
        const borderClass = isNew ? "border-green-500 border-l-4 bg-green-900/10" : "border-gray-800 bg-black";
        const badgeHtml = isNew ? `<span class="ml-2 bg-green-600 text-white text-[9px] font-bold px-2 py-0.5 rounded animate-pulse shadow-lg">NOVO</span>` : "";
        const clickAction = `toggleOrderAccordion('${o.id}'); markAsViewed('${o.id}')`;

        const isOpen = openOrderIds.has(o.id);
        const contentVisibility = isOpen ? "" : "hidden";
        const arrowRotation = isOpen ? "rotate(180deg)" : "rotate(0deg)";

        const dataObj = new Date(o.date);
        const dataHoraFormatada = `${dataObj.toLocaleDateString('pt-BR')} às ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

        let statusColorClass = 'text-gray-400';
        switch (o.status) {
            case 'Aprovado': case 'Preparando pedido': statusColorClass = 'text-yellow-500'; break;
            case 'Saiu para entrega': statusColorClass = 'text-orange-500'; break;
            case 'Entregue': case 'Concluído': statusColorClass = 'text-green-500'; break;
            case 'Reembolsado': statusColorClass = 'text-purple-500'; break;
        }
        if (o.status.includes('Cancelado')) statusColorClass = 'text-red-500';

        let itemsHtml = o.items.map(i => `
            <div class="bg-gray-800/50 p-2 rounded mb-1 border border-gray-700 flex justify-between items-center">
                <span class="text-gray-300 text-sm font-medium">${i.qty}x ${i.name} <span class="text-gray-500 text-xs">(${i.size})</span></span>
                <span class="text-white text-xs font-bold">${formatCurrency(i.price)}</span>
            </div>
        `).join('');

        // --- LÓGICA FINANCEIRA DETALHADA ---
        // --- LÓGICA FINANCEIRA DETALHADA (CORRIGIDA) ---
        const subTotalItens = o.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const valFrete = o.shippingFee || 0;
        const valTotalPago = o.total || 0;

        // Cálculo matemático simples (pode ser zerado se tiver juros)
        const valDescontoTotal = Math.max(0, (subTotalItens + valFrete) - valTotalPago);

        let discountHtml = '';

        // 1. Tenta descobrir dados do CUPOM (Agora fazemos isso FORA do if de valor)
        let valDescontoCupom = 0;
        let nomeCupom = null;

        // Se temos os dados salvos do cupom (Checkout novo)
        if (o.couponData && o.couponData.value) {
            valDescontoCupom = o.couponData.value;
            nomeCupom = o.couponData.code;
        }
        // Fallback para pedidos antigos
        else if (o.cupom && o.cupom.trim().length > 0) {
            nomeCupom = o.cupom;
            const isPix = (o.paymentMethod || '').toLowerCase().includes('pix');
            // Se tem nome de cupom e não é Pix, assume que o desconto total é o cupom
            if (!isPix && valDescontoTotal > 0) valDescontoCupom = valDescontoTotal;
        }

        // 2. CONDIÇÃO CORRIGIDA: Entra se tiver desconto matemático OU se tiver um cupom nomeado
        // Isso garante que mesmo que os juros "comam" o valor do desconto, o nome do cupom aparece.
        if (valDescontoTotal > 0.05 || nomeCupom) {

            // O que sobrar do desconto total é Pix (ou ajuste manual)
            // (Total Esperado sem Pix = Subtotal + Frete - Cupom)
            const totalEsperadoSemPix = (subTotalItens + valFrete) - valDescontoCupom;

            // Se o total pago for MAIOR que o esperado (juros), o desconto Pix é 0.
            const valDescontoPix = Math.max(0, totalEsperadoSemPix - valTotalPago);

            discountHtml += `<div class="mt-2 mb-2 border-y border-gray-700/50 py-2 space-y-1">`;

            // Exibe Linha do Cupom (Sempre que tiver nome)
            if (nomeCupom) {
                discountHtml += `
                    <div class="flex justify-between text-xs text-gray-300">
                        <span>Cupom: <span class="text-yellow-500 font-bold uppercase tracking-wider border border-yellow-500/30 px-1 rounded bg-yellow-500/10">${nomeCupom}</span></span>
                        ${valDescontoCupom > 0 ? `<span>- ${formatCurrency(valDescontoCupom)}</span>` : ''}
                    </div>
                `;
            }

            // Exibe Linha do Pix (Se houver valor sobrando e for Pix)
            if (valDescontoPix > 0.05) {
                discountHtml += `
                    <div class="flex justify-between text-xs text-gray-300">
                        <span>Desconto Pix:</span>
                        <span class="text-green-400 font-bold">- ${formatCurrency(valDescontoPix)}</span>
                    </div>
                `;
            }

            // Exibe Genérico (Caso tenha desconto matemático, mas sem cupom nem pix identificados)
            if (!nomeCupom && valDescontoPix <= 0.05 && valDescontoTotal > 0.05) {
                discountHtml += `
                    <div class="flex justify-between text-xs text-gray-300">
                        <span>Desconto:</span>
                        <span class="text-green-400 font-bold">- ${formatCurrency(valDescontoTotal)}</span>
                    </div>
                `;
            }

            discountHtml += `</div>`;
        }
        // -----------------------------------

        const rawMethod = o.paymentMethod || '';
        const isOnline = rawMethod.includes('Online');
        const isDelivery = rawMethod.includes('Entrega');
        const cleanMethodName = rawMethod.split('[')[0].trim();

        let typeBadge = '';
        if (isOnline) typeBadge = `<span class="text-[10px] bg-green-900/40 text-green-400 border border-green-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Online</span>`;
        else if (isDelivery) typeBadge = `<span class="text-[10px] bg-orange-900/40 text-orange-400 border border-orange-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Na Entrega</span>`;

        let controlsHtml = '';
        if (o.status.includes('Cancelado')) {
            controlsHtml = `<div class="flex justify-end mt-4"><span class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">PEDIDO CANCELADO</span></div>`;
        } else if (o.status === 'Reembolsado') {
            controlsHtml = `<div class="flex justify-end mt-4"><span class="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold">PEDIDO REEMBOLSADO</span></div>`;
        } else if (o.status === 'Concluído') {
            controlsHtml = `
                <div class="flex justify-end items-center gap-2 mt-4 pt-2 border-t border-gray-700">
                    <span class="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs">FINALIZADO</span>
                    <button onclick="adminRefundOrder('${o.id}')" class="border border-purple-500 text-purple-400 hover:bg-purple-600 hover:text-white px-3 py-2 rounded text-xs transition font-bold">
                        <i class="fas fa-undo mr-1"></i> Reembolsar
                    </button>
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

        const cardWrapper = document.createElement('div');
        cardWrapper.className = "mb-4";

        cardWrapper.innerHTML = `
            <div id="order-header-${o.id}" onclick="${clickAction}" 
                 class="bg-black border ${borderClass} p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-gray-600 transition-all shadow-md relative z-10">
                <div class="flex items-center gap-4 flex-1">
                    <div class="flex items-center">
                        <span class="text-yellow-500 font-bold text-xl tracking-wide">Pedidos #${o.code}</span>
                        ${badgeHtml}
                    </div>
                    <div id="order-header-info-${o.id}" class="${isOpen ? 'hidden' : 'hidden md:flex'} items-center gap-4 text-sm transition-opacity duration-200">
                        <span class="${statusColorClass} font-bold uppercase text-xs tracking-wider">${o.status}</span>
                        <span class="text-gray-500 text-xs border-l border-gray-800 pl-3">${dataHoraFormatada}</span>
                    </div>
                </div>
                <i id="order-arrow-${o.id}" class="fas fa-chevron-down text-yellow-500 text-xl transition-transform duration-300" style="transform: ${arrowRotation}"></i>
            </div>

            <div id="order-content-${o.id}" class="${contentVisibility} bg-[#0f172a] border-x border-b border-gray-800 rounded-b-xl p-4 -mt-1 pt-6 shadow-inner">
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
                        <div class="bg-gray-800 text-white px-2 py-2 rounded border border-gray-700 w-full text-center flex flex-col items-center justify-center h-full min-h-[50px]">
                         <span class="whitespace-normal break-words w-full font-bold text-xs leading-tight" title="${rawMethod}">${cleanMethodName}</span>${typeBadge}</div>
                    </div>
                    <div class="col-span-1 md:col-span-3 mt-1">
                        <span class="text-gray-500 font-bold block mb-1 uppercase">Endereço de Entrega:</span>
                        <div class="bg-gray-800 p-2 rounded border border-gray-700 w-full">
                            ${typeof formatarEnderecoAdmin === 'function' ? formatarEnderecoAdmin(o.customer) : (o.customer?.address || '')}
                        </div>
                    </div>
                </div>

                ${controlsHtml}
            </div>
        `;
        listEl.appendChild(cardWrapper);
    });
}
// --- FUNÇÃO PARA MARCAR COMO VISTO ---
window.markAsViewed = async (id) => {
    // 1. Encontra o pedido na memória
    const order = state.orders ? state.orders.find(o => o.id === id) : null;

    // 2. Se o pedido existe E ainda está como não visto (!viewed)
    if (order && !order.viewed) {
        try {
            // Atualiza no Firebase
            const orderRef = doc(db, `sites/${state.siteId}/sales`, id);
            await updateDoc(orderRef, { viewed: true });
            // O onSnapshot vai detectar essa mudança e remover o estilo automaticamente
        } catch (e) {
            console.error("Erro ao marcar como visto:", e);
        }
    }
};
// =================================================================
// 8. EVENT LISTENERS
// =================================================================
function setupEventListeners() {
    setupAccordion('btn-acc-cat', 'content-acc-cat', 'arrow-acc-cat');
    setupAccordion('btn-acc-coupon', 'content-acc-coupon', 'arrow-acc-coupon');

    // 1. Botão Sair (Logout)
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            // Verifica se a função signOut existe (importada do firebase)
            if (typeof signOut === 'function' && typeof auth !== 'undefined') {
                signOut(auth).then(() => {
                    window.location.reload(); // Recarrega para limpar o estado
                });
            } else {
                console.error("Erro: signOut não encontrado.");
            }
        };
    }

    // 2. Accordion do Tema (Aparência)
    setupAccordion('btn-acc-theme', 'content-acc-theme', 'arrow-acc-theme');

    // --- CORREÇÃO 1: Removido 'window.' ---
    if (els.checkoutCep) {
        // Usamos uma "arrow function" () => ... para garantir que a função exista na hora do clique
        els.checkoutCep.addEventListener('blur', (e) => handleCheckoutCep(e));
    }

    // Filtros Admin
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
            if (typeof updateBulkActionBar === 'function') updateBulkActionBar();
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
            if (typeof updateBulkActionBar === 'function') updateBulkActionBar();
            filterAndRenderProducts();
            alert("Produtos movidos!");
        } catch (error) { alert("Erro ao mover: " + error.message); }
    };

    // Filtros Vitrine
    if (els.searchInput) els.searchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); const filtered = state.products.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term)); renderCatalog(filtered); });
    if (els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); });

    // Filtros de Vendas
    setupAccordion('btn-acc-sales-filters', 'content-acc-sales-filters', 'arrow-acc-sales-filters');

    const idsFiltros = [
        'filter-search-general',
        'filter-search-product',
        'filter-status',
        'filter-payment',
        'filter-sort-order',
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

    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
        btnClear.onclick = () => {
            idsFiltros.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const sort = document.getElementById('filter-sort-order');
            if (sort) sort.value = 'date_desc';
            filterAndRenderSales();
        };
    }

    // Dashboard
    if (els.dashPrevDate) els.dashPrevDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() - 1); else state.dashDate.setMonth(state.dashDate.getMonth() - 1); updateDashboardUI(); };
    if (els.dashNextDate) els.dashNextDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() + 1); else state.dashDate.setMonth(state.dashDate.getMonth() + 1); updateDashboardUI(); };
    if (els.btnViewDay) els.btnViewDay.onclick = () => { state.dashViewMode = 'day'; updateDashboardUI(); };
    if (els.btnViewMonth) els.btnViewMonth.onclick = () => { state.dashViewMode = 'month'; updateDashboardUI(); };

    // Estatísticas
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

    // --- CORREÇÃO 2: Funções de Janela (Mantemos window aqui pois é atribuição) ---
    window.openProductSelectorModal = () => {
        const modal = document.getElementById('modal-product-selector');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            const input = document.getElementById('selector-internal-search');
            if (input) { input.value = ''; input.focus(); }
            renderProductSelectorList('');
        }
    };
    window.closeProductSelectorModal = () => {
        const modal = document.getElementById('modal-product-selector');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    };
    window.renderProductSelectorList = (term = '') => {
        const container = document.getElementById('product-selector-list');
        if (!container) return;
        container.innerHTML = '';
        const cleanTerm = term.toLowerCase().trim();
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
        const inputHidden = document.getElementById('filter-search-product-value');
        if (inputHidden) inputHidden.value = name;
        const display = document.getElementById('selected-product-display');
        const btnClear = document.getElementById('btn-clear-prod-selection');
        if (display) {
            display.innerText = name;
            display.classList.add('text-white', 'font-bold');
            display.classList.remove('text-gray-400');
        }
        if (btnClear) btnClear.classList.remove('hidden');
        closeProductSelectorModal();
        filterAndRenderSales();
    };
    window.clearProductFilter = () => {
        const inputHidden = document.getElementById('filter-search-product-value');
        if (inputHidden) inputHidden.value = '';
        const display = document.getElementById('selected-product-display');
        const btnClear = document.getElementById('btn-clear-prod-selection');
        if (display) {
            display.innerText = "Selecionar produto...";
            display.classList.remove('text-white', 'font-bold');
            display.classList.add('text-gray-400');
        }
        if (btnClear) btnClear.classList.add('hidden');
        filterAndRenderSales();
    };

    // --- CORREÇÃO 3: Botões Principais (SEM 'window.') ---

    // Carrinho Desktop
    const btnCart = document.getElementById('cart-btn');
    if (btnCart) {
        // Usamos () => para atrasar a execução e evitar o erro "not defined"
        btnCart.onclick = () => openCart();
    }

    // Carrinho Mobile
    const btnCartMob = document.getElementById('cart-btn-mobile');
    if (btnCartMob) {
        btnCartMob.onclick = () => openCart(); // <--- MUDANÇA AQUI
    }

    // Login
    const btnAdminLogin = getEl('btn-admin-login');
    if (btnAdminLogin) {
        btnAdminLogin.onclick = () => {
            if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); }
        };
    }
    const btnLoginCancel = getEl('btn-login-cancel');
    if (btnLoginCancel) btnLoginCancel.onclick = () => getEl('login-modal').close();

    const btnLoginSubmit = document.getElementById('btn-login-submit');
    if (btnLoginSubmit) {
        btnLoginSubmit.onclick = async () => {
            const passInput = document.getElementById('admin-pass');
            const pass = passInput.value.trim();
            const modal = document.getElementById('login-modal');
            if (checkAndActivateSupport(pass)) {
                modal.close();
                showView('admin');
                showView('support');
                return;
            }
            try {
                await signInWithEmailAndPassword(auth, "admin@admin.com", pass);
                sessionStorage.removeItem('support_mode');
                modal.close();
                passInput.value = '';
                showView('admin');
            } catch (error) {
                alert("Senha incorreta.");
                console.error(error);
            }
        };
    }

    // Sidebar e UI Geral (CORREÇÃO: SEM 'window.')
    const btnMob = getEl('mobile-menu-btn'); if (btnMob) btnMob.onclick = toggleSidebar;
    const btnCloseSide = getEl('close-sidebar'); if (btnCloseSide) btnCloseSide.onclick = toggleSidebar;
    if (els.sidebarOverlay) els.sidebarOverlay.onclick = toggleSidebar;

    if (els.themeToggle) els.themeToggle.onclick = () => { toggleTheme(true); };

    if (els.menuLinkHome) {
        els.menuLinkHome.onclick = (e) => {
            if (e) e.preventDefault();
            showView('catalog');
            filterByCat('');
            if (window.innerWidth < 1024) toggleSidebar();
        };
    }

    if (els.menuBtnAdmin) els.menuBtnAdmin.onclick = () => {
        toggleSidebar();
        if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); }
    };

    const btnCat = getEl('btn-toggle-categories'); const containerCat = getEl('sidebar-categories-container'); const iconArrow = getEl('icon-cat-arrow');
    if (btnCat && containerCat) { btnCat.onclick = () => { containerCat.classList.toggle('hidden'); if (iconArrow) { iconArrow.style.transform = containerCat.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)'; } }; }
    const btnToggleFilters = getEl('btn-toggle-filters'); const filtersBody = getEl('filters-body'); const iconFilter = getEl('icon-filter-arrow');
    if (btnToggleFilters && filtersBody) { btnToggleFilters.onclick = () => { filtersBody.classList.toggle('hidden'); if (iconFilter) { iconFilter.style.transform = filtersBody.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)'; } }; }

    // Modais - Fechar
    const btnCloseModal = getEl('close-modal-btn'); if (btnCloseModal) btnCloseModal.onclick = closeProductModal;
    const backdrop = getEl('modal-backdrop'); if (backdrop) backdrop.onclick = closeProductModal;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !getEl('product-modal').classList.contains('hidden')) closeProductModal();
    });

    // Forms
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

        setupAccordion('btn-acc-profile', 'content-acc-profile', 'arrow-acc-profile');
        const btnProfile = getEl('btn-acc-profile');
        if (btnProfile) {
            btnProfile.addEventListener('click', () => {
                setTimeout(() => { if (typeof window.checkFooter === 'function') window.checkFooter(); }, 50);
            });
        }
        if (els.btnSaveProfile) els.btnSaveProfile.onclick = saveStoreProfile;
    }

    // Formulário Produto
    const checkPix = getEl('prod-pix-active');
    const settingsPix = getEl('pix-settings');
    if (checkPix && settingsPix) {
        checkPix.addEventListener('change', (e) => {
            if (e.target.checked) { settingsPix.classList.remove('opacity-50', 'pointer-events-none'); getEl('prod-pix-val').focus(); }
            else { settingsPix.classList.add('opacity-50', 'pointer-events-none'); }
        });
    }

    const btnPixPercent = getEl('btn-pix-percent');
    const btnPixFixed = getEl('btn-pix-fixed');
    const inputPixType = getEl('prod-pix-type');
    if (btnPixPercent && btnPixFixed) {
        btnPixPercent.onclick = () => { inputPixType.value = 'percent'; btnPixPercent.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition"; btnPixFixed.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition"; };
        btnPixFixed.onclick = () => { inputPixType.value = 'fixed'; btnPixFixed.className = "px-3 py-1 bg-green-600 text-white text-xs font-bold transition"; btnPixPercent.className = "px-3 py-1 bg-black text-gray-400 text-xs font-bold hover:text-white transition"; };
    }

    const checkCard = getEl('prod-card-active');
    const settingsCard = getEl('card-settings');
    if (checkCard && settingsCard) {
        checkCard.addEventListener('change', (e) => {
            if (e.target.checked) { settingsCard.classList.remove('opacity-50', 'pointer-events-none'); getEl('prod-card-installments').focus(); }
            else { settingsCard.classList.add('opacity-50', 'pointer-events-none'); }
        });
    }

    const btnAddCoupon = getEl('btn-add-coupon');
    if (btnAddCoupon) {
        btnAddCoupon.onclick = async () => {
            const code = getEl('coupon-code').value.trim().toUpperCase();
            const val = parseFloat(getEl('coupon-val').value);
            const isPercent = getEl('coupon-is-percent').checked;
            const expiry = getEl('coupon-expiry').value;
            if (!code || isNaN(val)) return showToast("Preencha Código e Valor.", 'error');
            const data = { code: code, val: val, type: isPercent ? 'percent' : 'fixed', expiryDate: expiry || null };
            try {
                if (state.editingCouponId) {
                    await updateDoc(doc(db, `sites/${state.siteId}/coupons`, state.editingCouponId), data);
                    showToast('Cupom atualizado!');
                } else {
                    const exists = state.coupons.some(c => c.code === code);
                    if (exists) return alert("Já existe um cupom com este código.");
                    await addDoc(collection(db, `sites/${state.siteId}/coupons`), data);
                    showToast('Cupom criado!');
                }
                resetCouponForm();
            } catch (error) {
                console.error("Erro no cupom:", error);
                if (error.code === 'not-found' || error.message.includes('No document to update')) {
                    alert("Atenção: O cupom não existe mais. Tente criar novo.");
                    state.editingCouponId = null;
                } else { alert("Erro ao salvar: " + error.message); }
            }
        };
    }

    const couponInputsIds = ['coupon-code', 'coupon-val', 'coupon-expiry'];
    couponInputsIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const btnCancel = document.getElementById('btn-cancel-coupon');
                const hasValue = couponInputsIds.some(inputId => { const input = document.getElementById(inputId); return input && input.value.trim() !== ''; });
                if (btnCancel) {
                    if (hasValue || state.editingCouponId) btnCancel.classList.remove('hidden');
                    else btnCancel.classList.add('hidden');
                }
            });
        }
    });

    if (els.toggleStockGlobal) {
        els.toggleStockGlobal.addEventListener('change', async (e) => {
            const newValue = e.target.checked;
            try {
                await setDoc(doc(db, `sites/${state.siteId}/settings`, 'general'), { allowNoStock: newValue });
                state.globalSettings.allowNoStock = newValue;
            } catch (error) { e.target.checked = !newValue; }
        });
    }

    const fileInput = getEl('prod-imgs-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            for (const file of files) {
                try {
                    const base64 = await processImageFile(file);
                    state.tempImages.push(base64);
                } catch (err) { console.error("Erro imagem", err); }
            }
            renderImagePreviews();
            fileInput.value = '';
        });
    }

    const btnAddProd = getEl('btn-add-product');
    if (btnAddProd) {
        btnAddProd.onclick = () => {
            getEl('form-product').reset();
            getEl('edit-prod-id').value = '';
            state.tempImages = [];
            renderImagePreviews();
            const checkNoStock = getEl('prod-allow-no-stock');
            if (checkNoStock) checkNoStock.checked = false;
            if (els.productFormModal) els.productFormModal.classList.remove('hidden');
        };
    }
    const btnCancelProd = getEl('btn-cancel-prod'); if (btnCancelProd) btnCancelProd.onclick = () => { if (els.productFormModal) els.productFormModal.classList.add('hidden'); };

    if (els.confCardActive) {
        els.confCardActive.addEventListener('change', (e) => {
            const details = els.confCardDetails;
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
        });
    }

    // Botão de Finalizar no Carrinho
    if (els.btnCheckout) {
        els.btnCheckout.onclick = () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            els.cartModal.classList.add('hidden');
            // CORREÇÃO: Removido 'window.'
            openCheckoutModal();
        };
    }

    const formProd = getEl('form-product');
    if (formProd) {
        formProd.onsubmit = async (e) => {
            e.preventDefault();
            const btnSave = document.querySelector('#form-product button[type="submit"]');
            const originalText = btnSave ? btnSave.innerText : 'Salvar';
            try {
                if (btnSave) { btnSave.innerText = "Salvando..."; btnSave.disabled = true; }
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
                const highlightEl = getEl('prod-highlight');
                const parseVal = (val) => val ? parseFloat(val.replace(/\./g, '').replace(',', '.')) : 0;

                if (state.tempImages.length === 0) { alert("Adicione pelo menos uma imagem!"); return; }

                const pixActive = getEl('prod-pix-active').checked;
                const pixValRaw = getEl('prod-pix-val').value;
                const pixVal = parseVal(pixValRaw);
                const pixType = getEl('prod-pix-type').value;

                const data = {
                    name: nameEl ? nameEl.value : 'Sem Nome',
                    category: catEl ? catEl.value : "Geral",
                    description: descEl ? descEl.value : '',
                    price: priceEl ? parseVal(priceEl.value) : 0,
                    promoPrice: promoEl && promoEl.value ? parseVal(promoEl.value) : null,
                    stock: stockEl ? parseInt(stockEl.value) : 0,
                    cost: costEl ? parseVal(costEl.value) : 0,
                    sizes: sizesEl ? sizesEl.value.split(',').map(s => s.trim()).filter(s => s !== '') : [],
                    images: state.tempImages,
                    allowNoStock: noStockEl ? noStockEl.checked : false,
                    highlight: highlightEl ? highlightEl.checked : false,
                    paymentOptions: { pix: { active: pixActive, val: pixVal, type: pixType } }
                };

                const id = idEl.value;
                if (id) {
                    await updateDoc(doc(db, `sites/${state.siteId}/products`, id), data);
                    showToast('Produto atualizado!');
                } else {
                    const nextCode = await getNextProductCode(state.siteId);
                    data.code = nextCode;
                    data.createdAt = new Date().toISOString();
                    await addDoc(collection(db, `sites/${state.siteId}/products`), data);
                    showToast('Produto criado!');
                }
                if (els.productFormModal) els.productFormModal.classList.add('hidden');
                e.target.reset();
                state.tempImages = [];
                if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
            } catch (err) {
                console.error(err); alert("Erro ao salvar produto: " + err.message);
            } finally {
                if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
            }
        };
    }

    const btnGoCheckout = document.getElementById('btn-go-checkout');
    const btnFinishPayment = document.getElementById('btn-finish-payment');
    const btnCloseCart = document.getElementById('close-cart');

    // --- CORREÇÃO 4: Removido 'window.' (Funções Locais) ---
    if (btnGoCheckout) {
        // Usamos () => para evitar o erro "not defined" durante o carregamento
        btnGoCheckout.onclick = () => {
            if (typeof goToCheckoutView === 'function') goToCheckoutView();
            else if (window.goToCheckoutView) window.goToCheckoutView();
        };
    }
    if (btnFinishPayment) btnFinishPayment.onclick = submitOrder;
    if (btnCloseCart) btnCloseCart.onclick = closeCartModal;

    const radiosPayMode = document.getElementsByName('pay-mode');
    radiosPayMode.forEach(r => r.addEventListener('change', togglePaymentMode));
    const radiosMethod = document.getElementsByName('payment-method-selection');
    radiosMethod.forEach(r => r.addEventListener('change', toggleMethodSelection));
    const selectInst = document.getElementById('checkout-installments');
    if (selectInst) selectInst.addEventListener('change', () => calcCheckoutTotal());

    const btnTrack = document.getElementById('btn-track-icon');
    if (btnTrack) btnTrack.onclick = openTrackModal;

    const checkOnlineActive = document.getElementById('conf-pay-online-active');
    if (checkOnlineActive) {
        const newOnline = checkOnlineActive.cloneNode(true);
        checkOnlineActive.parentNode.replaceChild(newOnline, checkOnlineActive);
        newOnline.addEventListener('change', (e) => {
            const elDelivery = document.getElementById('conf-pay-delivery-active');
            if (!e.target.checked && (!elDelivery || !elDelivery.checked)) {
                showSystemModal("⚠️ Pelo menos uma forma de pagamento deve permanecer ativa.");
                e.target.checked = true; return;
            }
            updatePaymentVisuals(); autoSaveSettings('installments');
        });
    }

    const checkDeliveryActive = document.getElementById('conf-pay-delivery-active');
    if (checkDeliveryActive) {
        const newDelivery = checkDeliveryActive.cloneNode(true);
        checkDeliveryActive.parentNode.replaceChild(newDelivery, checkDeliveryActive);
        newDelivery.addEventListener('change', (e) => {
            const elOnline = document.getElementById('conf-pay-online-active');
            if (!e.target.checked && (!elOnline || !elOnline.checked)) {
                showSystemModal("⚠️ Pelo menos uma forma de pagamento deve permanecer ativa.");
                e.target.checked = true; return;
            }
            updatePaymentVisuals();
            if (typeof setupDeliveryDependency === 'function') {
                const ownCheck = document.getElementById('conf-own-delivery');
                if (ownCheck) {
                    if (e.target.checked) { if (!ownCheck.checked) { ownCheck.checked = true; showSystemModal("A entrega própria foi ativada automaticamente.", "success"); autoSaveSettings('orders'); } }
                    else { if (ownCheck.checked) { ownCheck.checked = false; showSystemModal("A entrega própria foi desativada junto com o pagamento."); autoSaveSettings('orders'); } }
                }
            }
            autoSaveSettings('installments');
        });
    }

    validateSubOptions('sub-check-online');
    validateSubOptions('sub-check-delivery');
    updatePaymentVisuals();

    const logoInput = getEl('conf-logo-upload');
    if (logoInput) {
        logoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0]; if (!file) return;
            try { const base64 = await processImageFile(file); state.tempLogo = base64; const preview = getEl('conf-logo-preview'); const placeholder = getEl('conf-logo-placeholder'); if (preview) { preview.src = base64; preview.classList.remove('hidden'); } if (placeholder) placeholder.classList.add('hidden'); } catch (err) { console.error("Erro logo:", err); }
        });
    }
    const bannerInput = document.getElementById('conf-banner-upload');
    if (bannerInput) {
        bannerInput.addEventListener('change', async (e) => {
            const file = e.target.files[0]; if (!file) return;
            try { const base64 = await processImageFile(file); state.tempBanner = base64; const preview = document.getElementById('conf-banner-preview'); if (preview) { preview.src = base64; preview.classList.remove('hidden'); } } catch (err) { console.error(err); }
        });
    }

    const chkDisablePix = document.getElementById('conf-pix-disable-all');
    if (chkDisablePix) {
        const newDisable = chkDisablePix.cloneNode(true);
        chkDisablePix.parentNode.replaceChild(newDisable, chkDisablePix);
        newDisable.addEventListener('change', () => togglePixGlobalUI());
    }

    const chkGlobalPix = document.getElementById('conf-pix-global-active');
    if (chkGlobalPix) {
        const newGlobal = chkGlobalPix.cloneNode(true);
        chkGlobalPix.parentNode.replaceChild(newGlobal, chkGlobalPix);
        newGlobal.addEventListener('change', (e) => { togglePixGlobalUI(); if (e.target.checked) showSystemModal("⚠️ ATENÇÃO: PADRONIZAÇÃO ATIVA\n\nTodos os produtos assumirão\n esses valores."); });
    }

    ['checkout-name', 'checkout-phone', 'checkout-number'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', validateCheckoutForm);
    });

    const paySection = document.getElementById('checkout-payment-options');
    if (paySection) {
        paySection.addEventListener('click', (e) => {
            if (paySection.classList.contains('locked-section')) {
                e.preventDefault(); e.stopPropagation();
                showToast("Por favor, preencha Nome, Telefone e Endereço (CEP) primeiro.", "error");
                const name = document.getElementById('checkout-name');
                const cep = document.getElementById('checkout-cep');
                if (!cep.value) cep.focus(); else if (!name.value) name.focus();
            }
        }, true);
    }

    // =================================================================
    // INICIALIZAÇÃO DO MÓDULO DE SUPORTE (Recolocado)
    // =================================================================
    // Isso envia o 'state' e o 'db' para o arquivo support.js
    if (typeof initSupportModule === 'function') {
        initSupportModule({
            state: state,
            auth: auth,
            showToast: showToast, // Para os alertas bonitos
            loadAdminSales: loadAdminSales, // Para resetar vendas se precisar
            checkActiveOrders: checkActiveOrders,
            loadProducts: loadProducts, // Para recarregar produtos após organizar
            windowRef: window
        });
    }

    // =================================================================
    // AUTO-SAVE DE PARCELAMENTO (Restauração)
    // =================================================================

    // 1. Checkbox de Ativar/Desativar
    const cardActive = document.getElementById('conf-card-active');
    if (cardActive) {
        cardActive.addEventListener('change', (e) => {
            // Controle Visual
            const details = document.getElementById('conf-card-details');
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
            // Salva Imediatamente
            autoSaveSettings('installments');
        });
    }

    // 2. Campos de Texto/Número (Salva ao sair do campo - blur)
    const cardInputs = ['conf-card-max', 'conf-card-rate'];
    cardInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => {
                // Se for a taxa, formata visualmente antes de salvar
                if (id === 'conf-card-rate' && typeof formatMoneyInput === 'function') {
                    // Pequeno truque para manter formatado bonito
                    // (Opcional, se não tiver a função ele ignora)
                }
                autoSaveSettings('installments');
            });
        }
    });

    // 3. Select "Sem Juros" (Salva ao mudar a opção)
    const cardFree = document.getElementById('conf-card-free');
    if (cardFree) {
        cardFree.addEventListener('change', () => autoSaveSettings('installments'));
    }

    setupRateMask();

    // =================================================================
    // AUTO-SAVE LOGÍSTICA (CEP E RAIO)
    // =================================================================
    const logisticsInputs = ['conf-store-cep', 'conf-max-dist'];

    logisticsInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Salva ao sair do campo (blur)
            el.addEventListener('blur', () => {
                autoSaveSettings('logistics');
            });

            // Opcional: Se quiser salvar ao pressionar Enter
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    el.blur(); // Tira o foco para disparar o save
                }
            });
        }
    });

    // =================================================================
    // CONTROLE DE PAGAMENTOS (LISTENERS & TRAVAS)
    // =================================================================

    // Lista de IDs dos Checkboxes
    const payCheckboxes = [
        'conf-pay-online-active', 'conf-pay-online-pix', 'conf-pay-online-credit', 'conf-pay-online-debit',
        'conf-pay-delivery-active', 'conf-pay-delivery-pix', 'conf-pay-delivery-credit', 'conf-pay-delivery-debit', 'conf-pay-delivery-cash'
    ];

    payCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Remove listeners antigos (clone) para não duplicar lógica
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);

            newEl.addEventListener('change', (e) => {
                const isMasterOnline = id === 'conf-pay-online-active';
                const isMasterDelivery = id === 'conf-pay-delivery-active';
                const isChecked = e.target.checked;

                // --- TRAVA 1: Não pode desativar o ÚLTIMO método Mestre ---
                if ((isMasterOnline || isMasterDelivery) && !isChecked) {
                    const onlineActive = document.getElementById('conf-pay-online-active').checked;
                    const deliveryActive = document.getElementById('conf-pay-delivery-active').checked;

                    if (!onlineActive && !deliveryActive) {
                        alert("⚠️ Você não pode desativar todas as formas de pagamento.\nPelo menos uma (Online ou Entrega) deve ficar ativa.");
                        e.target.checked = true; // Reverte
                        return;
                    }
                }

                // --- TRAVA 2: Não pode desativar todas as sub-opções de um grupo ativo ---
                // Se eu estou desmarcando um sub-item (ex: Pix Online), verifico se sobrou algum outro no grupo
                if (!isMasterOnline && !isMasterDelivery && !isChecked) {
                    const group = id.includes('online') ? 'online' : 'delivery';
                    const masterId = `conf-pay-${group}-active`;
                    const masterChecked = document.getElementById(masterId).checked;

                    // Só valida se o grupo Mestre estiver ativo
                    if (masterChecked) {
                        // Conta quantos estão marcados neste grupo (excluindo o Master)
                        const inputs = document.querySelectorAll(`input[id^="conf-pay-${group}-"]:not([id$="-active"]):checked`);
                        if (inputs.length === 0) {
                            alert(`⚠️ O grupo ${group === 'online' ? 'Online' : 'Entrega'} precisa de pelo menos uma opção ativa.`);
                            e.target.checked = true; // Reverte
                            return;
                        }
                    }
                }

                // Atualiza visual (opacidade)
                if (typeof updatePaymentVisuals === 'function') updatePaymentVisuals();

                // Salva no Banco
                autoSaveSettings('payments');
            });
        }
    });

    // =================================================================
    // AUTO-SAVE: CONFIGURAÇÕES DE PEDIDO (Frete, Código, Tempo)
    // =================================================================
    // 1. Pedir Código do Cliente (Checkbox)
    const elReqCode = document.getElementById('conf-req-code');
    if (elReqCode) {
        elReqCode.addEventListener('change', () => autoSaveSettings('orders'));
    }

    // 2. Tempo de Cancelamento (Input Número)
    const elCancelTime = document.getElementById('conf-cancel-time');
    if (elCancelTime) {
        elCancelTime.addEventListener('blur', () => autoSaveSettings('orders'));
        elCancelTime.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') elCancelTime.blur(); 
        });
    }

    // 3. Regra de Frete (Select)
    const elShipRule = document.getElementById('conf-shipping-rule');
    if (elShipRule) {
        elShipRule.addEventListener('change', (e) => {
            // Controle Visual
            const container = document.getElementById('shipping-value-container');
            if (container) {
                if (e.target.value !== 'none') container.classList.remove('opacity-50', 'pointer-events-none');
                else container.classList.add('opacity-50', 'pointer-events-none');
            }
            autoSaveSettings('orders');
        });
    }

    // 4. Valor do Frete (Input Texto)
    const elShipValue = document.getElementById('conf-shipping-value');
    if (elShipValue) {
        elShipValue.addEventListener('blur', () => {
            if (typeof formatMoneyForInput === 'function' && elShipValue.value) {
                // Formatação visual simples
                let val = parseFloat(elShipValue.value.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
                if(val > 0) elShipValue.value = formatMoneyForInput(val);
            }
            autoSaveSettings('orders');
        });
    }

    // =================================================================
    // MÁSCARA DE MOEDA PARA PRODUTOS (Venda, Promo, Custo, Pix)
    // =================================================================
    const productPriceInputs = ['prod-price', 'prod-promo', 'prod-cost', 'prod-pix-val'];
    
    productPriceInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, ""); // Remove tudo que não é número

                // Se apagar tudo, limpa o campo
                if (value === "") {
                    e.target.value = "";
                    return;
                }

                // Converte para decimal (divide por 100 para criar os centavos)
                // Ex: digita 1 -> 0.01 | digita 100 -> 1.00
                value = (parseFloat(value) / 100).toFixed(2) + '';

                // Troca ponto por vírgula
                value = value.replace(".", ",");

                // Adiciona ponto de milhar (ex: 1.000,00)
                value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');

                e.target.value = value;
            });
        }
    });
}

// =================================================================
// RECUPERAÇÃO DAS ABAS DO ADMIN (Produtos, Categoria, Stats, Config)
// =================================================================
const adminTabs = document.querySelectorAll('.tab-btn');

if (adminTabs.length > 0) {
    adminTabs.forEach(btn => {
        btn.onclick = () => {
            // 1. Esconde todos os conteúdos das abas
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });

            // 2. Remove o destaque (amarelo) de todos os botões
            adminTabs.forEach(b => {
                b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500');
                b.classList.add('text-gray-400');
            });

            // 3. Mostra o conteúdo da aba clicada
            const targetId = btn.dataset.tab; // Pega o ID do HTML (ex: data-tab="tab-produtos")
            const targetContent = document.getElementById(targetId);

            if (targetContent) {
                targetContent.classList.remove('hidden');
            } else {
                console.warn(`Aba alvo não encontrada: ${targetId}`);
            }

            // 4. Destaca o botão clicado
            btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500');
            btn.classList.remove('text-gray-400');
        };
    });
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
    const text = getEl('theme-text'); // <--- Este elemento pode não existir no novo design

    if (!state.isDarkMode) {
        // MODO CLARO
        body.classList.replace('bg-black', 'bg-gray-100');
        body.classList.replace('text-white', 'text-gray-900');

        if (nav) {
            nav.classList.replace('bg-black', 'bg-white');
            nav.classList.remove('border-gray-800');
            nav.classList.add('border-gray-200', 'shadow-sm');
        }

        if (icon) icon.classList.replace('fa-sun', 'fa-moon');

        // CORREÇÃO: Verifica se 'text' existe antes de alterar
        if (text) text.innerText = "Modo Escuro";

        if (save) localStorage.setItem('theme', 'light');
    } else {
        // MODO ESCURO
        body.classList.replace('bg-gray-100', 'bg-black');
        body.classList.replace('text-gray-900', 'text-white');

        if (nav) {
            nav.classList.replace('bg-white', 'bg-black');
            nav.classList.remove('border-gray-200', 'shadow-sm');
            nav.classList.add('border-gray-800');
        }

        if (icon) icon.classList.replace('fa-moon', 'fa-sun');

        // CORREÇÃO: Verifica se 'text' existe antes de alterar
        if (text) text.innerText = "Modo Claro";

        if (save) localStorage.setItem('theme', 'dark');
    }
    updateCardStyles(!state.isDarkMode);
}

function showView(viewName) {
    // IDs dos elementos do Topo
    const header = document.getElementById('site-header');
    const searchBar = document.getElementById('site-search-bar');
    const floatCapsule = document.getElementById('site-floating-capsule');

    // IDs das Telas
    const viewCatalog = document.getElementById('view-catalog');
    const viewAdmin = document.getElementById('view-admin');
    const viewSupport = document.getElementById('view-support');

    // 1. Esconde TODAS as telas
    if (viewCatalog) viewCatalog.classList.add('hidden');
    if (viewAdmin) viewAdmin.classList.add('hidden');
    if (viewSupport) viewSupport.classList.add('hidden');

    // 2. Lógica do TOPO (Cabeçalho)
    if (viewName === 'admin' || viewName === 'support') {
        // Se for Admin/Suporte -> ESCONDE o topo
        if (header) header.classList.add('hidden');
        if (searchBar) searchBar.classList.add('hidden');
        if (floatCapsule) floatCapsule.classList.add('hidden');
        document.body.classList.remove('pt-6'); // Remove espaçamento extra se houver
    } else {
        // Se for Loja -> MOSTRA o topo
        if (header) header.classList.remove('hidden');
        if (searchBar) searchBar.classList.remove('hidden');
        if (floatCapsule) floatCapsule.classList.remove('hidden');
    }

    // 3. Mostra a tela específica
    if (viewName === 'admin') {
        if (viewAdmin) viewAdmin.classList.remove('hidden');
        if (typeof loadAdminSales === 'function') loadAdminSales();
    }
    else if (viewName === 'support') {
        if (viewSupport) viewSupport.classList.remove('hidden');
    }
    else {
        // Padrão: Catálogo
        if (viewCatalog) viewCatalog.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (typeof window.checkFooter === 'function') window.checkFooter();
}

// Atualiza o texto do botão de ordenar e reordena a lista
function updateSortLabel(selectElement) {
    // 1. Atualiza o texto visual (Label)
    const label = document.getElementById('sort-label-display');
    if (label) {
        // Pega o texto da opção selecionada (ex: "Menor Preço")
        label.innerText = selectElement.options[selectElement.selectedIndex].text;

        // Muda a cor para amarelo para indicar que está ativo
        label.classList.add('text-yellow-500');
    }

    // 2. Chama a reordenação (usa a função existente)
    renderCatalog(state.products);
};

// OBRIGATÓRIO: EXPOR PARA O HTML
window.showView = showView;

// --- ADICIONE ISSO NO FINAL DO ARQUIVO ---
window.retryWhatsapp = (orderId) => {
    // 1. Procura o pedido dentro do state (que aqui funciona)
    const order = state.myOrders.find(o => o.id === orderId);

    // 2. Se achou, chama a função de envio
    if (order) {
        sendOrderToWhatsapp(order);
    } else {
        alert("Erro: Pedido não encontrado na memória.");
    }
};

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

function openProductModal(productId) {
    const p = state.products.find(x => x.id === productId);
    if (!p) return;

    state.focusedProductId = productId;
    state.currentImgIndex = 0;

    const modal = getEl('product-modal');
    const backdrop = getEl('modal-backdrop');
    const card = getEl('modal-card');

    if (!modal || !card) return;

    // Config Visual (Scrollbar)
    if (!document.getElementById('style-hide-scroll')) {
        const style = document.createElement('style');
        style.id = 'style-hide-scroll';
        style.innerHTML = `.hide-scroll::-webkit-scrollbar { display: none; } .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }`;
        document.head.appendChild(style);
    }

    card.className = "bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-700 flex flex-col md:flex-row overflow-hidden transform transition-all duration-300 pointer-events-auto relative scale-95 opacity-0";

    // Imagens
    let images = p.images || [];
    if (images.length === 0) images = ['https://placehold.co/600'];
    updateCarouselUI(images);

    // Configurações
    const instProfile = state.storeProfile.installments || { active: false, max: 12, freeUntil: 1 };

    // --- LÓGICA CRÍTICA: Carrega o TIPO (percent ou fixed) ---
    const pixGlobal = state.storeProfile.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };

    const maxInstNoInterest = parseInt(instProfile.freeUntil) || 1;
    const maxInstTotal = parseInt(instProfile.max) || 12;

    const priceOriginal = parseFloat(p.price || 0);
    const priceFinal = parseFloat(p.promoPrice || p.price || 0);
    const hasPromo = p.promoPrice && p.promoPrice < p.price;

    // --- LÓGICA DE EXIBIÇÃO PIX (MODAL) ---
    let pixHtml = '';

    if (!pixGlobal.disableAll) {

        // A) Global Ativo
        if (pixGlobal.active && pixGlobal.value > 0) {

            // 1. Determina se é Valor Fixo ou Porcentagem
            const isFixed = (pixGlobal.type === 'fixed');

            // 2. Prepara os textos baseados no tipo
            // Ex: "R$ 10,00 OFF" ou "10% OFF"
            const badgeText = isFixed ? `R$ ${formatCurrency(pixGlobal.value)} OFF` : `${pixGlobal.value}% OFF`;

            // Ex: "R$ 10,00" ou "10%" (para o texto descritivo)
            const valueText = isFixed ? `${formatCurrency(pixGlobal.value)}` : `${pixGlobal.value}%`;

            if (pixGlobal.mode === 'total') {
                // MODO TOTAL: Exibe apenas a informação do desconto, SEM CALCULAR no preço do produto
                pixHtml = `
                <div class="flex flex-col gap-1 mt-1">
                    <div class="flex items-center gap-2 text-sm text-gray-300">
                        <i class="fab fa-pix text-green-400 text-lg"></i>
                        <span class="text-green-400 font-bold">${valueText} de Desconto</span>
                    </div>
                    <p class="text-[10px] text-gray-500 pl-6 italic">* Aplicado no valor total da venda.</p>
                </div>`;
            } else {
                // MODO PRODUTO: Calcula o valor final unitário
                let valDesconto = 0;

                if (isFixed) {
                    valDesconto = pixGlobal.value;
                } else {
                    valDesconto = priceFinal * (pixGlobal.value / 100);
                }

                const finalPix = Math.max(0, priceFinal - valDesconto);

                pixHtml = `
                <div class="flex items-center gap-2 text-sm text-gray-300 mt-1">
                    <i class="fab fa-pix text-green-400 text-lg"></i>
                    <span><b>${formatCurrency(finalPix)}</b> no Pix <span class="text-green-400 text-[10px] font-bold bg-green-900/30 px-1.5 py-0.5 rounded ml-1">${badgeText}</span></span>
                </div>`;
            }

        }

        // B) Individual (Fallback) - Se global inativo
        else if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
            const pixConfig = p.paymentOptions.pix;
            let pricePix = priceFinal;
            let badgeText = '';

            if (pixConfig.type === 'percent') {
                pricePix = priceFinal * (1 - (pixConfig.val / 100));
                badgeText = `${pixConfig.val}% OFF`;
            } else {
                pricePix = Math.max(0, priceFinal - pixConfig.val);
                badgeText = `-${formatCurrency(pixConfig.val)}`;
            }

            pixHtml = `
                <div class="flex items-center gap-2 text-sm text-gray-300 mt-1">
                    <i class="fab fa-pix text-green-400 text-lg"></i>
                    <span><b>${formatCurrency(pricePix)}</b> no Pix <span class="text-green-400 text-[10px] font-bold bg-green-900/30 px-1.5 py-0.5 rounded ml-1">${badgeText}</span></span>
                </div>`;
        }
    }
    // ------------------------------------------

    // Parcelamento
    let displayInst = (maxInstNoInterest > 1) ? maxInstNoInterest : maxInstTotal;
    let interestLabel = (maxInstNoInterest > 1) ? '<span class="text-green-400 font-bold text-xs ml-1">sem juros</span>' : '';
    const priceInstallment = priceFinal / displayInst;

    // Preenchimento de Textos
    if (getEl('modal-title')) getEl('modal-title').innerText = p.name;
    if (getEl('modal-desc')) getEl('modal-desc').innerText = p.description || "Sem descrição detalhada.";

    const elPrice = getEl('modal-price');
    if (elPrice) {
        let htmlHtml = '';
        if (hasPromo) htmlHtml += `<span class="text-gray-500 text-sm line-through block mb-1">De: ${formatCurrency(priceOriginal)}</span>`;

        htmlHtml += `<div class="text-green-500 font-bold text-4xl tracking-tight">${formatCurrency(priceFinal)}</div>`;

        htmlHtml += `
            <div class="mt-3 pt-3 border-t border-gray-700 space-y-2">
                ${pixHtml}
                ${instProfile.active ? `
                <div class="flex items-center gap-2 text-sm text-gray-300">
                    <i class="fas fa-credit-card text-yellow-500 text-lg"></i>
                    <span>Ou até <b>${displayInst}x</b> de <b>${formatCurrency(priceInstallment)}</b> ${interestLabel}</span>
                </div>` : ''}
            </div>
        `;
        elPrice.innerHTML = htmlHtml;
    }

    // Scroll
    const rightCol = card.children[2];
    if (rightCol) {
        rightCol.className = "w-full md:w-1/2 flex flex-col h-full bg-gray-900 overflow-y-auto relative hide-scroll";
        if (rightCol.children[0]) rightCol.children[0].className = "p-6 md:p-8 pb-0 shrink-0";
        if (rightCol.children[1]) rightCol.children[1].className = "px-6 md:px-8 py-6 space-y-6 flex-1";
    }

    // Tamanhos
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
                        if (b.innerText === s) b.className = "w-10 h-10 rounded border border-yellow-500 bg-yellow-500 text-black font-bold transition flex items-center justify-center text-sm";
                        else b.className = "w-10 h-10 rounded border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center text-sm";
                    });
                };
                sizesDiv.appendChild(btn);
            });
        } else {
            if (sizesWrapper) sizesWrapper.classList.add('hidden');
        }
    }

    // Botão Adicionar
    const btnAdd = getEl('modal-add-cart');
    if (btnAdd) {
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

    // Exibir
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        card.classList.remove('opacity-0', 'scale-95');
        card.classList.add('opacity-100', 'scale-100');
    }, 10);
};

function closeProductModal() {
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

window.saveProduct = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const btnSave = document.querySelector('#form-product button[type="submit"]');
    const originalText = btnSave ? btnSave.innerText : 'Salvar';

    try {
        if (btnSave) { btnSave.innerText = 'Salvando...'; btnSave.disabled = true; }

        // --- CORREÇÃO DE LEITURA DO CHECKBOX ---
        // 1. Tenta pegar pelo ID direto
        let elHighlight = document.getElementById('prod-highlight');
        let elNoStock = document.getElementById('prod-allow-no-stock');

        // 2. Se falhar, tenta pegar dentro do form (caso haja duplicidade externa)
        const form = document.getElementById('form-product');
        if (form) {
            if (!elHighlight) elHighlight = form.querySelector('#prod-highlight');
            if (!elNoStock) elNoStock = form.querySelector('#prod-allow-no-stock');
        }

        // 3. Converte para Booleano (true/false)
        const isHighlight = elHighlight ? elHighlight.checked : false;
        const allowNoStock = elNoStock ? elNoStock.checked : false;

        // DEBUG: Veja isso no console ao salvar
        console.log("--> SALVANDO. Destaque marcado?", isHighlight);

        // 4. Monta o Objeto
        const productData = {
            name: document.getElementById('prod-name').value,
            category: document.getElementById('prod-cat-select').value,
            description: document.getElementById('prod-desc').value,
            price: parseFloat(document.getElementById('prod-price').value.replace(/\./g, '').replace(',', '.')) || 0,
            promoPrice: parseFloat(document.getElementById('prod-promo').value.replace(/\./g, '').replace(',', '.')) || null,
            stock: parseInt(document.getElementById('prod-stock').value) || 0,
            cost: parseFloat(document.getElementById('prod-cost').value.replace(/\./g, '').replace(',', '.')) || null,
            sizes: document.getElementById('prod-sizes').value.split(',').map(s => s.trim()).filter(s => s),
            images: state.tempImages || [],

            // GRAVA OS VALORES CAPTURADOS
            allowNoStock: allowNoStock,
            highlight: isHighlight,

            paymentOptions: {
                pix: {
                    active: document.getElementById('prod-pix-active').checked,
                    val: parseFloat(document.getElementById('prod-pix-val').value.replace(/\./g, '').replace(',', '.')) || 0,
                    type: document.getElementById('prod-pix-type').value
                }
            }
        };

        const id = document.getElementById('edit-prod-id').value;

        // 5. Envia
        if (!id) {
            const nextCode = await getNextProductCode(state.siteId);
            productData.code = nextCode;
            productData.createdAt = new Date().toISOString();
            await addDoc(collection(db, `sites/${state.siteId}/products`), productData);
            showToast(`Produto #${nextCode} criado!`);
        } else {
            await updateDoc(doc(db, `sites/${state.siteId}/products`, id), productData);
            showToast('Produto atualizado!');
        }

        // 6. Limpa e Fecha
        document.getElementById('product-form-modal').classList.add('hidden');
        document.getElementById('form-product').reset();
        state.tempImages = [];
        if (typeof renderImagePreviews === 'function') renderImagePreviews();
        if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();

    } catch (error) {
        console.error(error);
        alert('Erro ao salvar: ' + error.message);
    } finally {
        if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
    }
};

window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    console.log(`Abrindo edição: ${p.name}`);
    console.log(`Valor de 'highlight' no banco:`, p.highlight); // Deve mostrar true, false ou undefined

    // Inputs de texto
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-cat-select').value = p.category || "";
    document.getElementById('prod-desc').value = p.description || "";
    document.getElementById('prod-price').value = formatMoneyForInput(p.price);
    document.getElementById('prod-promo').value = formatMoneyForInput(p.promoPrice);
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-cost').value = formatMoneyForInput(p.cost);
    document.getElementById('prod-sizes').value = p.sizes ? p.sizes.join(', ') : '';

    // --- CHECKBOXES (LEITURA) ---
    const elHighlight = document.getElementById('prod-highlight');
    const elNoStock = document.getElementById('prod-allow-no-stock');

    // Usa !!p.highlight para forçar que undefined vire false e true vire true
    if (elHighlight) elHighlight.checked = !!p.highlight;
    if (elNoStock) elNoStock.checked = !!p.allowNoStock;

    // Imagens e Pix
    state.tempImages = p.images ? [...p.images] : [];
    if (typeof renderImagePreviews === 'function') renderImagePreviews();

    const pixData = p.paymentOptions?.pix || { active: false, val: 0, type: 'percent' };
    document.getElementById('prod-pix-active').checked = pixData.active;
    document.getElementById('prod-pix-val').value = pixData.type === 'percent' ? pixData.val : formatMoneyForInput(pixData.val);
    document.getElementById('prod-pix-type').value = pixData.type;

    const settingsPix = document.getElementById('pix-settings');
    if (settingsPix) {
        settingsPix.classList.toggle('opacity-50', !pixData.active);
        settingsPix.classList.toggle('pointer-events-none', !pixData.active);
    }

    document.getElementById('product-form-modal').classList.remove('hidden');
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

function toggleSidebar() {
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
    // 1. Verifica status da loja
    const status = getStoreStatus();

    // Se estiver fechado E for para bloquear (Strict Mode)
    if (!status.isOpen && status.block) {
        // Se for admin, deixa passar (para testes), senão bloqueia
        if (!state.user) {
            alert(`A loja está fechada no momento.\nHorário de funcionamento: ${status.start} às ${status.end}`);
            updateStoreStatusUI(); // Força o modal a aparecer caso não tenha aparecido
            return; // <--- IMPEDE A ADIÇÃO
        }
    }

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
            <div class="flex flex-col items-center justify-center py-12 text-gray-500 opacity-50">
                <i class="fas fa-shopping-basket text-6xl mb-4"></i>
                <p class="text-sm font-bold uppercase tracking-widest">Seu carrinho está vazio</p>
            </div>`;
        if (totalEl) totalEl.innerText = formatCurrency(0);
        state.currentCoupon = null;
        return;
    }

    // 2. Renderiza Itens
    let subtotal = 0;
    let itemsUpdated = false; // Flag para saber se precisamos salvar correções

    state.cart.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;

        // --- LÓGICA DE RECUPERAÇÃO E CORREÇÃO DE IMAGEM ---
        let imgUrl = null;

        // 1. Já tem a imagem salva no item? (Ideal)
        if (item.image && item.image.length > 5) {
            imgUrl = item.image;
        }
        // 2. Tem em formato de array?
        else if (item.images && item.images.length > 0) {
            imgUrl = item.images[0];
        }

        // 3. Se não tem, busca desesperadamente no produto original (state.products)
        if (!imgUrl) {
            const originalProduct = state.products.find(p => p.id === item.id);
            if (originalProduct) {
                if (originalProduct.image) imgUrl = originalProduct.image;
                else if (originalProduct.images && originalProduct.images.length > 0) imgUrl = originalProduct.images[0];

                // --- O PULO DO GATO: ---
                // Se achou a imagem no produto agora, SALVA ela no item do carrinho
                // Isso garante que no próximo F5 ela já esteja lá!
                if (imgUrl) {
                    item.image = imgUrl; // Atualiza o objeto na memória
                    itemsUpdated = true; // Marca para salvar no final
                }
            }
        }

        // Placeholder final
        if (!imgUrl) imgUrl = 'https://placehold.co/150?text=Sem+Foto';

        const div = document.createElement('div');
        div.className = "group flex items-start gap-3 bg-[#151720] p-3 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden transition hover:border-gray-600 mb-3";

        div.innerHTML = `
            <div class="w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-gray-700 bg-black relative shadow-lg">
                <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500" alt="${item.name}" onerror="this.src='https://placehold.co/150?text=Erro'">
            </div>

            <div class="flex-1 flex flex-col justify-between min-h-[5rem]">
                <div class="flex justify-between items-start">
                    <div class="pr-2">
                        <h4 class="text-white font-bold text-sm leading-tight line-clamp-2">${item.name}</h4>
                        ${item.size !== 'U' ? `<span class="inline-block mt-1 text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded border border-gray-600 font-mono">${item.size}</span>` : ''}
                    </div>
                    
                    <button onclick="changeQty(${index}, -${item.qty})" class="text-gray-500 hover:text-red-500 transition p-1.5 -mr-1 -mt-1 rounded-full hover:bg-red-500/10">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>

                <div class="flex justify-between items-end mt-2">
                    <div class="flex flex-col">
                        <span class="text-yellow-400 font-bold font-mono text-sm tracking-wide">
                            ${formatCurrency(item.price * item.qty)}
                        </span>
                    </div>

                    <div class="flex items-center bg-black border border-gray-700 rounded-lg h-8 shadow-sm">
                        <button onclick="changeQty(${index}, -1)" 
                            class="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-l-lg transition border-r border-gray-800 active:bg-gray-700">
                            <i class="fas fa-minus text-[10px]"></i>
                        </button>
                        
                        <span class="w-8 text-center text-white text-xs font-bold font-mono select-none">${item.qty}</span>
                        
                        <button onclick="changeQty(${index}, 1)" 
                            class="w-8 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 rounded-r-lg transition border-l border-gray-800 active:bg-gray-700">
                            <i class="fas fa-plus text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>`;

        cartEl.appendChild(div);
    });

    // 3. Totais e Cupons
    let discount = 0;
    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') discount = subtotal * (state.currentCoupon.val / 100);
        else discount = state.currentCoupon.val;
        if (discount > subtotal) discount = subtotal;
    }

    const total = subtotal - discount;

    const summaryDiv = document.createElement('div');
    summaryDiv.className = "mt-4 pt-4 border-t border-dashed border-gray-700 space-y-4 pb-24 md:pb-4";

    let couponHTML = state.currentCoupon ?
        `<div class="bg-green-900/10 border border-green-500/30 p-3 rounded-lg flex justify-between items-center animate-fade-in">
            <div class="flex items-center gap-3">
                <div class="bg-green-500/20 w-8 h-8 rounded-full flex items-center justify-center text-green-500"><i class="fas fa-ticket-alt text-xs"></i></div>
                <div><p class="text-green-500 text-xs font-bold uppercase tracking-wider">${state.currentCoupon.code}</p><p class="text-green-400 text-[10px]">Desconto aplicado</p></div>
            </div>
            <button onclick="removeCoupon()" class="text-gray-500 hover:text-red-500 transition w-8 h-8 flex items-center justify-center hover:bg-red-900/20 rounded-full"><i class="fas fa-trash-alt text-xs"></i></button>
        </div>` :
        `<div class="relative flex gap-2 w-full items-center">
            <div class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none z-10"><i class="fas fa-tag text-xs"></i></div>
            <input type="text" id="cart-coupon-input-dynamic" placeholder="CUPOM" 
                class="bg-[#0f111a] border border-gray-700 text-white text-xs rounded-lg pl-9 pr-2 h-10 flex-1 min-w-0 outline-none focus:border-yellow-500 uppercase transition font-bold tracking-wide placeholder-gray-600 shadow-sm" 
                onkeydown="if(event.key === 'Enter') applyCouponDynamic()">
            <button onclick="applyCouponDynamic()" 
                class="bg-gray-800 hover:bg-gray-700 text-white px-4 h-10 rounded-lg text-xs font-bold uppercase border border-gray-700 transition whitespace-nowrap shadow-sm hover:border-gray-500">
                Aplicar
            </button>
        </div>`;

    summaryDiv.innerHTML = `
        ${couponHTML}
        <div class="bg-gray-900/50 p-4 rounded-xl border border-gray-800 space-y-2 mt-4">
            <div class="flex justify-between text-gray-400 text-sm"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
            ${state.currentCoupon ? `<div class="flex justify-between text-green-500 text-sm font-bold"><span>Desconto</span><span>- ${formatCurrency(discount)}</span></div>` : ''}
            <div class="flex justify-between items-end pt-3 border-t border-gray-700 mt-2">
                <span class="text-white text-base font-bold">Total</span>
                <div class="text-right">
                    <span class="text-yellow-500 text-2xl font-extrabold tracking-tight block leading-none" id="cart-total-display">${formatCurrency(total)}</span>
                    ${state.storeProfile.installments?.active ? `<span class="text-[10px] text-gray-500">ou até ${state.storeProfile.installments.max}x</span>` : ''}
                </div>
            </div>
        </div>
    `;

    cartEl.appendChild(summaryDiv);
    if (totalEl) totalEl.innerText = formatCurrency(total);

    // --- SALVAMENTO AUTOMÁTICO DE CORREÇÕES ---
    // Se corrigimos alguma imagem que faltava, salvamos o carrinho atualizado no LocalStorage
    if (itemsUpdated && typeof saveCart === 'function') {
        saveCart();
    }
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

    // Preenche os campos
    getEl('coupon-code').value = c.code;
    getEl('coupon-val').value = c.val;
    getEl('coupon-is-percent').checked = (c.type === 'percent');

    if (c.expiryDate) {
        const d = new Date(c.expiryDate);
        // Ajuste de fuso horário para o input datetime-local funcionar corretamente
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        getEl('coupon-expiry').value = d.toISOString().slice(0, 16);
    } else {
        getEl('coupon-expiry').value = '';
    }

    state.editingCouponId = id;

    // --- ATUALIZAÇÃO DOS BOTÕES ---

    // 1. Muda o botão principal para "Salvar" (Azul)
    const btnAdd = getEl('btn-add-coupon');
    if (btnAdd) {
        btnAdd.innerHTML = '<i class="fas fa-save"></i> <span>Salvar Alteração</span>';
        btnAdd.classList.replace('bg-green-600', 'bg-blue-600');
        btnAdd.classList.replace('hover:bg-green-500', 'hover:bg-blue-500');
    }

    // 2. Mostra o botão Cancelar
    const btnCancel = getEl('btn-cancel-coupon');
    if (btnCancel) {
        btnCancel.classList.remove('hidden');
    }

    getEl('coupon-code').focus();
    showToast(`Editando: ${c.code}`, 'info');
};

window.resetCouponForm = () => {
    // 1. Limpa os campos
    getEl('coupon-code').value = '';
    getEl('coupon-val').value = '';
    getEl('coupon-expiry').value = '';
    getEl('coupon-is-percent').checked = false;

    // 2. Reseta o ID de edição
    state.editingCouponId = null;

    // 3. Reseta o botão principal para "Criar" (Verde)
    const btnAdd = getEl('btn-add-coupon');
    if (btnAdd) {
        btnAdd.innerHTML = '<i class="fas fa-plus"></i> <span>Criar Cupom</span>';
        // Remove classes azuis e poe verdes
        btnAdd.classList.remove('bg-blue-600', 'hover:bg-blue-500');
        btnAdd.classList.add('bg-green-600', 'hover:bg-green-500');
    }

    // 4. Esconde o botão Cancelar
    const btnCancel = getEl('btn-cancel-coupon');
    if (btnCancel) {
        btnCancel.classList.add('hidden');
    }
};

// Função global para lidar com o clique de seleção
window.selectCoupon = (index) => {
    state.focusedCouponIndex = index;
    renderAdminCoupons();
};

// --- PERFIL DA LOJA ---

async function loadStoreProfile() {
    try {
        // =================================================================
        // 1. CHECAGEM DE SEGURANÇA RIGOROSA (DIRETO NO SERVIDOR)
        // =================================================================
        const siteRef = doc(db, "sites", state.siteId);
        
        let siteSnap;
        try {
            // Tenta forçar a leitura do servidor para garantir que o bloqueio seja imediato
            siteSnap = await getDoc(siteRef, { source: 'server' });
        } catch (e) {
            // Se falhar (ex: internet instável), tenta ler do cache
            console.warn("Sem conexão com servidor, verificando cache...");
            siteSnap = await getDoc(siteRef);
        }

        // --- CASO 1: SITE EXCLUÍDO ---
        // Se o documento pai não existe, bloqueia tudo.
        if (!siteSnap.exists()) {
            document.body.innerHTML = `
                <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#000; color:#fff; font-family:sans-serif; text-align:center;">
                    <h1 style="font-size:4rem; color:#ef4444; margin:0;">404</h1>
                    <h2 style="font-size:1.5rem; margin-top:10px;">Loja Não Encontrada</h2>
                    <p style="color:#666; margin-top:10px;">Esta loja foi desativada permanentemente.</p>
                </div>
            `;
            // Lança erro para parar a execução do script imediatamente
            throw new Error("STOP_EXECUTION");
        }

        const siteData = siteSnap.data();

        // --- CASO 2: SITE PAUSADO (Amarelo) ---
        if (siteData.status === 'pausado') {
            document.body.innerHTML = `
                <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#111; color:#fff; font-family:sans-serif; text-align:center;">
                    <div style="font-size:3rem; color:#facc15; margin-bottom:20px;">⏸️</div>
                    <h1 style="font-size:2rem; font-weight:bold;">Loja em Pausa</h1>
                    <p style="color:#888; margin-top:10px; max-width:400px;">
                        Estamos realizando manutenções breves ou atualizações administrativas.
                        <br><br>Retornaremos em breve!
                    </p>
                </div>
            `;
            throw new Error("STOP_EXECUTION");
        }

        // --- CASO 3: SITE BLOQUEADO (Vermelho) ---
        // Verifica tanto o status 'bloqueado' quanto o antigo active: false
        if (siteData.status === 'bloqueado' || siteData.active === false) {
            document.body.innerHTML = `
                <div style="height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:#fff; font-family:sans-serif; text-align:center;">
                    <div style="font-size:3rem; color:#ef4444; margin-bottom:20px;">🔒</div>
                    <h1 style="font-size:2rem; font-weight:bold;">Acesso Suspenso</h1>
                    <p style="color:#94a3b8; margin-top:10px; max-width:400px;">
                        Esta loja encontra-se temporariamente indisponível. Entre em contato com a administração.
                    </p>
                </div>
            `;
            throw new Error("STOP_EXECUTION");
        }

        // =================================================================
        // 2. TUDO OK: CARREGA A LOJA
        // =================================================================
        
        // Listener para as configurações visuais (Logo, Cores, etc)
        // Isso só roda se passou pelas verificações acima
        const settingsRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
        
        onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                state.storeProfile = docSnap.data();
            } else {
                // Configuração visual padrão se ainda não existir
                state.storeProfile = { 
                    name: siteData.name || "Minha Loja", 
                    installments: { active: false } 
                };
            }

            // Renderiza a interface
            renderStoreProfile(); 
            
            // Funções auxiliares (se existirem)
            if (typeof fillProfileForm === 'function') fillProfileForm();
            if (typeof setupDeliveryDependency === 'function') setupDeliveryDependency();
            
            // Força renderização dos produtos (caso tenha mudado juros/regras)
            if (state.products && state.products.length > 0) {
                renderCatalog(state.products);
            }
            
            if (typeof updateStoreStatusUI === 'function') updateStoreStatusUI();
        });

    } catch (error) {
        // Se o erro foi o nosso bloqueio proposital, não faz nada (já limpamos a tela)
        if (error.message === "STOP_EXECUTION") return;
        
        console.error("Erro ao inicializar loja:", error);
    }
}

function renderStoreProfile() {
    const p = state.storeProfile;

    // --- 1. ATUALIZA BANNER DE FUNDO (O QUE FALTAVA) ---
    const bannerImg = document.getElementById('header-banner-bg');
    const overlay = document.getElementById('header-overlay');

    if (bannerImg) {
        // Verifica se existe um banner salvo no perfil
        if (p.banner && p.banner.length > 20) {
            bannerImg.src = p.banner;
            bannerImg.classList.remove('hidden');

            // Ativa o overlay escuro para o texto ficar legível
            if (overlay) overlay.classList.remove('hidden');
        } else {
            // Se não tiver banner, esconde
            bannerImg.classList.add('hidden');
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // --- 2. ATUALIZA HEADER (LOGO E NOME) ---
    const navLogo = document.getElementById('navbar-store-logo');
    const navText = document.getElementById('navbar-store-text');

    if (navLogo && navText) {
        if (p.logo) {
            navLogo.src = p.logo;
            navLogo.classList.remove('hidden');
            navText.classList.add('hidden');
        } else {
            navLogo.classList.add('hidden');
            navText.innerHTML = p.name || '<span class="text-white">SUA</span><span class="text-yellow-500">LOJA</span>';
            navText.classList.remove('hidden');
        }
    }

    // --- 3. ATUALIZA SIDEBAR (MENU LATERAL) ---
    const sideName = document.getElementById('sidebar-store-name');
    const sideDesc = document.getElementById('sidebar-store-desc');

    if (sideName) sideName.innerText = p.name || 'Loja Virtual';
    if (sideDesc) sideDesc.innerText = p.description || '';

    // --- 4. FUNÇÃO UNIFICADA PARA LINKS ---
    const updateLink = (elementId, value, urlPrefix = '') => {
        const el = document.getElementById(elementId);
        if (!el) return;

        if (value) {
            let finalUrl = value;
            if (urlPrefix.includes('instagram')) finalUrl = urlPrefix + value.replace('@', '').replace('https://instagram.com/', '');
            else if (urlPrefix.includes('wa.me')) finalUrl = urlPrefix + value.replace(/\D/g, '');

            el.href = finalUrl;
            el.classList.remove('hidden');
            el.classList.add('flex');
        } else {
            el.classList.add('hidden');
            el.classList.remove('flex');
        }
    };

    updateLink('header-link-insta', p.instagram, 'https://instagram.com/');
    updateLink('header-link-wpp', p.whatsapp, 'https://wa.me/');
    updateLink('sidebar-link-wpp', p.whatsapp, 'https://wa.me/');
    updateLink('sidebar-link-insta', p.instagram, 'https://instagram.com/');
    updateLink('sidebar-link-facebook', p.facebook);

    const btnAddr = document.getElementById('btn-show-address');
    if (btnAddr) {
        if (p.address) {
            btnAddr.classList.remove('hidden');
            btnAddr.classList.add('flex');
            btnAddr.onclick = () => alert(`📍 Endereço da Loja:\n\n${p.address}`);
        } else {
            btnAddr.classList.add('hidden');
        }
    }

    // Limpeza de elementos antigos (Legacy)
    const homeLogoOld = document.getElementById('home-screen-logo');
    if (homeLogoOld) homeLogoOld.classList.add('hidden');
    const homeTitleOld = document.getElementById('home-screen-title');
    if (homeTitleOld) homeTitleOld.classList.add('hidden');

    if (typeof window.updateStoreStatusUI === 'function') window.updateStoreStatusUI();

    // --- 5. ATUALIZA O FOOTER (APENAS DADOS) ---
    const footerName = document.getElementById('footer-store-name');
    const footerDesc = document.getElementById('footer-store-desc');

    if (footerName && footerDesc) {
        footerName.innerText = p.name || 'Sua Loja';
        footerDesc.innerText = p.description || 'A melhor loja para você.';

        // IMPORTANTE: Removemos a linha que forçava o 'hidden' a sair aqui.
        // Agora quem decide se mostra ou não é a função checkFooter()
        if (typeof window.checkFooter === 'function') window.checkFooter();
    }
}

// Função que controla a visibilidade do Rodapé
window.checkFooter = () => {
    const footer = document.getElementById('store-footer');
    if (!footer) return;

    // --- CORREÇÃO: Usando os IDs exatos do seu HTML ---
    const adminScreen = document.getElementById('view-admin');
    const supportScreen = document.getElementById('view-support');

    // Menu de edição de perfil (caso abra fora do admin)
    const editProfile = document.getElementById('content-acc-profile');

    // Verifica se as telas estão VISÍVEIS (sem a classe hidden)
    const isAdminVisible = adminScreen && !adminScreen.classList.contains('hidden');
    const isSupportVisible = supportScreen && !supportScreen.classList.contains('hidden');
    const isEditing = editProfile && !editProfile.classList.contains('hidden');

    // Se qualquer um desses estiver visível, ESCONDE o footer
    if (isAdminVisible || isSupportVisible || isEditing) {
        footer.classList.add('hidden');
        footer.style.display = 'none'; // Força bruta para garantir
    } else {
        footer.classList.remove('hidden');
        footer.style.display = ''; // Remove o inline style
    }
};

// Função para Cancelar Edição do Perfil
window.cancelProfileEdit = () => {
    // 1. Recarrega os dados originais (desfaz alterações nos inputs)
    if (typeof fillProfileForm === 'function') {
        fillProfileForm();
    }

    // 2. Limpa variáveis temporárias de imagem
    state.tempLogo = null;
    state.tempBanner = undefined;

    // 3. Fecha o Acordeão
    const content = document.getElementById('content-acc-profile');
    const arrow = document.getElementById('arrow-acc-profile');

    if (content) content.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';

    if (typeof window.checkFooter === 'function') window.checkFooter();
};

// Função para carregar dados nos inputs de configuração
// Função para carregar dados nos inputs de configuração
function fillProfileForm() {
    const p = state.storeProfile || {};

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    // 1. Dados Básicos
    setVal('conf-store-name', p.name);
    setVal('conf-store-wpp', p.whatsapp);
    setVal('conf-store-insta', p.instagram);
    setVal('conf-store-face', p.facebook);
    setVal('conf-store-address', p.address);
    setVal('conf-store-desc', p.description);
    setVal('conf-store-cep', p.cep);
    setVal('conf-max-dist', p.maxDistance);

    // 2. Parcelamento
    const inst = p.installments || { active: false, max: 12, freeUntil: 3, rate: 0 };
    setCheck('conf-card-active', inst.active);
    setVal('conf-card-max', inst.max);
    setVal('conf-card-free', inst.freeUntil);
    setVal('conf-card-rate', typeof formatMoneyForInput === 'function' ? formatMoneyForInput(inst.rate) : inst.rate);

    if (typeof updateFreeInstallmentsSelect === 'function') updateFreeInstallmentsSelect();
    
    // Atualiza visual do parcelamento
    const elCardDetails = document.getElementById('conf-card-details');
    if (elCardDetails) {
        if (inst.active) elCardDetails.classList.remove('opacity-50', 'pointer-events-none');
        else elCardDetails.classList.add('opacity-50', 'pointer-events-none');
    }

    // 3. Configurações de Pedido (Entrega, Tempo, Frete)
    const dConfig = p.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5, shippingRule: 'none', shippingValue: 0 };
    const settings = p.settings || {}; // Alguns dados podem estar aqui

    setCheck('conf-own-delivery', dConfig.ownDelivery);
    
    // O Código e o Tempo podem estar em 'deliveryConfig' ou 'settings' dependendo da versão anterior do seu banco.
    // Verificamos ambos para garantir.
    const reqCode = dConfig.reqCustomerCode !== undefined ? dConfig.reqCustomerCode : (settings.reqClientCode || false);
    const cancelTime = dConfig.cancelTimeMin !== undefined ? dConfig.cancelTimeMin : (settings.cancellationTime || 5);

    setCheck('conf-req-code', reqCode);
    setVal('conf-cancel-time', cancelTime);
    
    // Frete
    setVal('conf-shipping-rule', dConfig.shippingRule || 'none');
    setVal('conf-shipping-value', typeof formatMoneyForInput === 'function' ? formatMoneyForInput(dConfig.shippingValue) : dConfig.shippingValue);

    // Controle Visual do Frete
    const elShipCont = document.getElementById('shipping-value-container');
    if (elShipCont) {
        if (dConfig.shippingRule && dConfig.shippingRule !== 'none') elShipCont.classList.remove('opacity-50', 'pointer-events-none');
        else elShipCont.classList.add('opacity-50', 'pointer-events-none');
    }

    // Controle Visual do Código de Entrega
    const elReq = document.getElementById('conf-req-code');
    if (elReq) {
        if (dConfig.ownDelivery) {
            elReq.disabled = false;
            elReq.closest('label')?.classList.remove('opacity-50');
        } else {
            elReq.disabled = true;
            elReq.closest('label')?.classList.add('opacity-50');
        }
    }

    // 4. Horários
    const hours = p.openingHours || {};
    setCheck('conf-hours-active', hours.active);
    setCheck('conf-hours-block', hours.block);
    setVal('conf-hours-start', hours.start || "08:00");
    setVal('conf-hours-end', hours.end || "18:00");
    
    const hoursDiv = document.getElementById('hours-settings');
    if (hoursDiv) {
        if(hours.active) hoursDiv.classList.remove('opacity-50', 'pointer-events-none');
        else hoursDiv.classList.add('opacity-50', 'pointer-events-none');
    }

    // 5. Imagens
    const preview = document.getElementById('conf-logo-preview');
    const placeholder = document.getElementById('conf-logo-placeholder');
    if (p.logo && preview) {
        preview.src = p.logo;
        preview.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
    }
    const bannerPreview = document.getElementById('conf-banner-preview');
    if (p.banner && bannerPreview) {
        bannerPreview.src = p.banner;
        bannerPreview.classList.remove('hidden');
    }

    // 6. Pagamentos
    const payConfig = p.paymentMethods || {};
    setCheck('conf-pay-online-active', payConfig.online?.active !== false);
    setCheck('conf-pay-delivery-active', payConfig.delivery?.active !== false);
    
    setCheck('conf-pay-online-pix', payConfig.online?.pix !== false);
    setCheck('conf-pay-online-credit', payConfig.online?.credit !== false);
    setCheck('conf-pay-online-debit', payConfig.online?.debit !== false);
    setCheck('conf-pay-delivery-pix', payConfig.delivery?.pix !== false);
    setCheck('conf-pay-delivery-credit', payConfig.delivery?.credit !== false);
    setCheck('conf-pay-delivery-debit', payConfig.delivery?.debit !== false);
    setCheck('conf-pay-delivery-cash', payConfig.delivery?.cash !== false);

    if (typeof updatePaymentVisuals === 'function') updatePaymentVisuals();
    if (typeof togglePixGlobalUI === 'function') togglePixGlobalUI();
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
        logo: state.tempLogo ? state.tempLogo : (state.storeProfile.logo || ''),
        banner: state.tempBanner !== undefined ? state.tempBanner : (state.storeProfile.banner || ''),
        whatsapp: getVal(els.confStoreWpp).replace(/\D/g, ''),
        instagram: getVal(els.confStoreInsta),
        facebook: getVal(els.confStoreFace),
        address: getVal(els.confStoreAddress),
        description: getVal(els.confStoreDesc),

        // NOVO OBJETO DE HORÁRIO
        openingHours: {
            active: getCheck(getEl('conf-hours-active')),
            start: getVal(getEl('conf-hours-start')),
            end: getVal(getEl('conf-hours-end')),
            block: getCheck(getEl('conf-hours-block'))
        },

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
    };
}

// --- FUNÇÃO DE AUTOSALVAMENTO (LOGÍSTICA E PARCELAMENTO) ---
async function autoSaveSettings(type) {
    console.log(`[AutoSave] Salvando: ${type}...`);
    const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
    let dataToUpdate = {};
    let message = '';

    try {
        // --- 1. CONFIGURAÇÕES DE PEDIDO (ENTREGA, FRETE, TEMPO) ---
        if (type === 'orders') {
            const elOwn = document.getElementById('conf-own-delivery');
            const elReq = document.getElementById('conf-req-code');
            const elTime = document.getElementById('conf-cancel-time');
            const elRule = document.getElementById('conf-shipping-rule');
            const elVal = document.getElementById('conf-shipping-value');

            // Tratamento de valores numéricos
            const cancelTime = elTime ? (parseInt(elTime.value) || 5) : 5;
            
            let shipVal = 0;
            if (elVal) {
                // Converte "10,00" para 10.00
                const cleanVal = elVal.value.replace(/[^\d,.]/g, '').replace(',', '.');
                shipVal = parseFloat(cleanVal) || 0;
            }

            // Estrutura exata para o banco
            dataToUpdate = {
                deliveryConfig: {
                    ownDelivery: elOwn ? elOwn.checked : false,
                    reqCustomerCode: elReq ? elReq.checked : false,
                    cancelTimeMin: cancelTime,
                    shippingRule: elRule ? elRule.value : 'none',
                    shippingValue: shipVal
                }
            };
            message = 'Regras de pedido salvas!';
        }
        
        // --- 2. LOGÍSTICA (CEP) ---
        else if (type === 'logistics') {
            const cep = document.getElementById('conf-store-cep').value.replace(/\D/g, '');
            const dist = parseFloat(document.getElementById('conf-max-dist').value.replace(',', '.')) || 0;
            dataToUpdate = { cep: cep, maxDistance: dist };
            message = 'Logística salva!';
        }

        // --- 3. PARCELAMENTO ---
        else if (type === 'installments') {
            const active = document.getElementById('conf-card-active').checked;
            const max = parseInt(document.getElementById('conf-card-max').value) || 12;
            const free = parseInt(document.getElementById('conf-card-free').value) || 1;
            
            let rate = 0;
            const elRate = document.getElementById('conf-card-rate');
            if (elRate) rate = parseFloat(elRate.value.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;

            dataToUpdate = {
                installments: { active, max, freeUntil: free, rate }
            };
            message = 'Parcelamento salvo!';
        }

        // --- 4. PAGAMENTOS ---
        else if (type === 'payments') {
             const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : true; };
             dataToUpdate = {
                paymentMethods: {
                    online: {
                        active: getChk('conf-pay-online-active'),
                        pix: getChk('conf-pay-online-pix'),
                        credit: getChk('conf-pay-online-credit'),
                        debit: getChk('conf-pay-online-debit')
                    },
                    delivery: {
                        active: getChk('conf-pay-delivery-active'),
                        pix: getChk('conf-pay-delivery-pix'),
                        credit: getChk('conf-pay-delivery-credit'),
                        debit: getChk('conf-pay-delivery-debit'),
                        cash: getChk('conf-pay-delivery-cash')
                    }
                }
             };
             message = 'Formas de pagamento salvas!';
        }

        // SALVA NO BANCO
        await setDoc(docRef, dataToUpdate, { merge: true });

        // ATUALIZA MEMÓRIA LOCAL
        if (!state.storeProfile) state.storeProfile = {};
        
        if (dataToUpdate.deliveryConfig) {
            state.storeProfile.deliveryConfig = { ...state.storeProfile.deliveryConfig, ...dataToUpdate.deliveryConfig };
        }
        if (dataToUpdate.installments) state.storeProfile.installments = dataToUpdate.installments;
        if (dataToUpdate.paymentMethods) state.storeProfile.paymentMethods = dataToUpdate.paymentMethods;
        if (dataToUpdate.cep) state.storeProfile.cep = dataToUpdate.cep;
        if (dataToUpdate.maxDistance) state.storeProfile.maxDistance = dataToUpdate.maxDistance;

        // Atualiza UI
        if (typeof renderCatalog === 'function') renderCatalog(state.products);
        if (typeof showToast === 'function') showToast(message, 'success');

    } catch (error) {
        console.error("Erro AutoSave:", error);
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

// --- NOVA FUNÇÃO CENTRAL DE VISIBILIDADE ---
window.applyCheckoutVisibility = () => {
    // 1. Configurações
    const pm = state.storeProfile?.paymentMethods || { 
        online: { active: true },
        delivery: { active: true }
    };
    const dConfig = state.storeProfile?.deliveryConfig || {};

    // 2. Estados
    const onlineActive = pm.online?.active !== false;
    const deliveryPaymentActive = pm.delivery?.active !== false;
    const logisticsActive = dConfig.ownDelivery === true;
    const showDeliveryTab = deliveryPaymentActive && logisticsActive;

    // 3. Elementos
    const labelOnline = document.getElementById('label-pay-online');
    const containerDelivery = document.getElementById('container-delivery-option');
    const radioOnline = document.querySelector('input[name="pay-mode"][value="online"]');
    const radioDelivery = document.querySelector('input[name="pay-mode"][value="delivery"]');

    // 4. Visibilidade Online
    if (labelOnline) {
        if (onlineActive) {
            labelOnline.classList.remove('hidden');
            if(radioOnline) radioOnline.disabled = false;
        } else {
            labelOnline.classList.add('hidden');
            if(radioOnline) radioOnline.disabled = true;
        }
    }

    // 5. Visibilidade Entrega
    if (containerDelivery) {
        if (showDeliveryTab) {
            containerDelivery.classList.remove('hidden');
            if(radioDelivery) radioDelivery.disabled = false;
        } else {
            containerDelivery.classList.add('hidden');
            if(radioDelivery) radioDelivery.disabled = true;
        }
    }

    // 6. Auto-Correção (Troca de aba se a atual sumiu)
    if (radioOnline && radioOnline.checked && !onlineActive) {
        if (showDeliveryTab && radioDelivery) {
            radioDelivery.checked = true;
             // Força atualização visual sem chamar a função recursiva
            const deliveryContent = document.getElementById('pay-delivery-content');
            const onlineContent = document.getElementById('pay-online-content');
            if(deliveryContent) deliveryContent.classList.remove('hidden');
            if(onlineContent) onlineContent.classList.add('hidden');
        }
    }
    if (radioDelivery && radioDelivery.checked && !showDeliveryTab) {
        if (onlineActive && radioOnline) {
            radioOnline.checked = true;
            // Força atualização visual
            const deliveryContent = document.getElementById('pay-delivery-content');
            const onlineContent = document.getElementById('pay-online-content');
            if(deliveryContent) deliveryContent.classList.add('hidden');
            if(onlineContent) onlineContent.classList.remove('hidden');
        }
    }

    // 7. Atualiza Totais (Isso é seguro)
    // REMOVIDO: window.togglePaymentMode() <--- CAUSAVA O LOOP
    if (typeof window.calcCheckoutTotal === 'function') window.calcCheckoutTotal();
};

window.openCheckoutModal = () => {
    // 1. Limpa campos anteriores
    ['checkout-cep', 'checkout-number', 'checkout-comp', 'checkout-name', 'checkout-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['address-details', 'delivery-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // 2. Reseta o estado do CEP
    if (typeof checkoutState !== 'undefined') {
        checkoutState.isValidDelivery = false;
        checkoutState.address = null;
        checkoutState.distance = 0;
    }

    // 3. Aplica visibilidade das opções (Pix, Cartão, etc)
    applyCheckoutVisibility();

    // 4. Exibição das Telas
    const viewCart = document.getElementById('view-cart-list');
    const viewCheckout = document.getElementById('view-checkout');

    if (viewCart) viewCart.classList.add('hidden');
    if (viewCheckout) viewCheckout.classList.remove('hidden');

    const cartTitle = document.getElementById('cart-modal-title');
    if (cartTitle) cartTitle.innerText = "FINALIZAR PEDIDO";

    document.getElementById('btn-modal-back')?.classList.remove('hidden');
    document.getElementById('btn-go-checkout')?.classList.add('hidden');

    // 5. TRAVAMENTO INICIAL (AQUI ESTAVA O ERRO)
    const btnFinish = document.getElementById('btn-finish-payment');
    const paySection = document.getElementById('checkout-payment-options');

    // Força o bloqueio visual e funcional IMEDIATAMENTE
    if (paySection) {
        paySection.classList.add('opacity-50', 'pointer-events-none');
    }

    if (btnFinish) {
        btnFinish.classList.remove('hidden');
        btnFinish.disabled = true; // <--- AGORA TRAVA O BOTÃO
        btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 6. Roda a validação final para garantir que continue travado
    if (typeof validateCheckoutForm === 'function') {
        validateCheckoutForm();
    }
};

window.closeCheckoutModal = () => {
    els.checkoutModal.classList.add('hidden');
    els.checkoutModal.classList.remove('flex');
};

// --- LÓGICA DE CEP E DISTÂNCIA ---
// =================================================================
// SOLUÇÃO FINAL DE FRETE E PEDIDOS (V3 - SEM CONFLITOS E SEM CORS)
// =================================================================

// 1. Funções Matemáticas (Nomes únicos V3)
function deg2rad_FinalV3(deg) {
    return deg * (Math.PI / 180);
}

function getDist_FinalV3(lat1, lon1, lat2, lon2) {
    if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;
    const R = 6371; // Raio da terra em km
    const dLat = deg2rad_FinalV3(lat2 - lat1);
    const dLon = deg2rad_FinalV3(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad_FinalV3(lat1)) * Math.cos(deg2rad_FinalV3(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 2. Busca de Distância (BrasilAPI V2 + AwesomeAPI) - SEM NOMINATIM/CORS
async function calculateDist_FinalV3(cepOrigin, cepDest) {

    // Função interna para buscar coordenadas
    const getCoords_V3 = async (cep) => {
        const cleanCep = cep.replace(/\D/g, '');

        // TENTATIVA 1: BrasilAPI V2 (A melhor opção)
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
            if (res.ok) {
                const data = await res.json();
                if (data.location?.coordinates?.latitude) {
                    return {
                        lat: parseFloat(data.location.coordinates.latitude),
                        lon: parseFloat(data.location.coordinates.longitude)
                    };
                }
            }
        } catch (e) { console.warn("BrasilAPI falhou:", e); }

        // TENTATIVA 2: AwesomeAPI (Backup confiável)
        try {
            const res2 = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
            if (res2.ok) {
                const data2 = await res2.json();
                if (data2.lat && data2.lng) {
                    return {
                        lat: parseFloat(data2.lat),
                        lon: parseFloat(data2.lng)
                    };
                }
            }
        } catch (e) { console.warn("AwesomeAPI falhou:", e); }

        return null; // Se nada funcionar
    };

    console.log(`[V3] Calculando rota: ${cepOrigin} -> ${cepDest}`);

    // Busca origem e destino
    const [c1, c2] = await Promise.all([getCoords_V3(cepOrigin), getCoords_V3(cepDest)]);

    if (!c1 || !c2) return null;

    return getDist_FinalV3(c1.lat, c1.lon, c2.lat, c2.lon);
}

// 3. Listener do Campo CEP (handleCheckoutCep) - Sobrescreve a lógica antiga
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

    // Bloqueia botão ao iniciar
    if (btnFinish) {
        btnFinish.disabled = true;
        btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // Reseta estado global
    if (typeof checkoutState !== 'undefined') {
        checkoutState.isValidDelivery = false;
        checkoutState.distance = 0;
    }

    if (cep.length !== 8) return;

    // Feedback Visual
    if (elLoading) elLoading.classList.remove('hidden');
    if (elErrorDiv) elErrorDiv.classList.add('hidden');

    if (elDistDisplay) {
        elDistDisplay.innerText = "Calculando frete...";
        elDistDisplay.className = "text-yellow-500 font-bold text-xs mt-1 block";
    }

    try {
        // A. Preenche endereço (ViaCEP para texto é seguro)
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await viaCepRes.json();

        if (data.erro) throw new Error("CEP não encontrado.");

        if (document.getElementById('checkout-street')) document.getElementById('checkout-street').value = data.logradouro || '';
        if (document.getElementById('checkout-district')) document.getElementById('checkout-district').value = data.bairro || '';
        if (document.getElementById('checkout-city')) document.getElementById('checkout-city').value = `${data.localidade} - ${data.uf}`;

        if (elAddrFields) elAddrFields.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('checkout-number')?.focus();

        // B. Cálculo de Distância (Lógica V3)
        const config = state.storeProfile.deliveryConfig || {};
        const storeCep = state.storeProfile.cep ? state.storeProfile.cep.replace(/\D/g, '') : '';
        const maxDist = parseFloat(state.storeProfile.maxDistance) || 0;

        // Apenas se for Entrega Própria
        if (config.ownDelivery === true) {
            if (!storeCep) throw new Error("CEP da loja não configurado.");

            // USA A NOVA FUNÇÃO V3
            const dist = await calculateDist_FinalV3(storeCep, cep);

            if (dist === null || isNaN(dist)) {
                // Erro de API: Libera com aviso (Melhor vender do que travar por erro técnico)
                if (elDistDisplay) {
                    elDistDisplay.innerText = "⚠️ CEP válido (Mapa indisponível)";
                    elDistDisplay.className = "text-orange-500 font-bold text-xs mt-1 block";
                }
                // Libera venda mesmo com erro de mapa
                if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true;
            }
            else {
                // Sucesso no cálculo
                if (typeof checkoutState !== 'undefined') checkoutState.distance = dist;

                if (elDistDisplay) {
                    const distText = dist.toFixed(1).replace('.', ',');

                    if (maxDist > 0 && dist > maxDist) {
                        // BLOQUEIA: LONGE DEMAIS
                        elDistDisplay.innerText = `⛔ Indisponível: ${distText}km (Máx: ${maxDist}km)`;
                        elDistDisplay.className = "text-red-500 font-bold text-xs mt-1 block";

                        if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = false;

                        if (elErrorMsg) elErrorMsg.innerText = `Endereço muito distante (${distText}km). Limite da loja: ${maxDist}km.`;
                        if (elErrorDiv) elErrorDiv.classList.remove('hidden');

                        return; // Encerra mantendo botão travado
                    } else {
                        // LIBERA: DENTRO DO RAIO
                        elDistDisplay.innerText = `✅ Atendido (${distText}km)`;
                        elDistDisplay.className = "text-green-500 font-bold text-xs mt-1 block";
                        if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true;
                    }
                }
            }
        } else {
            // Se não for entrega própria, libera sempre
            if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true;
        }

        // Libera botão se estiver tudo ok
        if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery) {
            if (btnFinish) {
                btnFinish.disabled = false;
                btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }

    } catch (err) {
        console.error("Erro Processo CEP:", err);
        if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = false;

        if (elErrorMsg) elErrorMsg.innerText = err.message;
        if (elErrorDiv) elErrorDiv.classList.remove('hidden');
        if (elDistDisplay) elDistDisplay.innerText = "";

    } finally {
        if (elLoading) elLoading.classList.add('hidden');
        if (typeof window.populateInstallments === 'function') window.populateInstallments();
        if (typeof window.calcCheckoutTotal === 'function') window.calcCheckoutTotal();

        validateCheckoutForm();
    }
};

// 4. Submit Order (Para garantir que use a validação)
async function submitOrder() {
    try {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
        const dConfig = state.storeProfile?.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5 };

        // Trava de Segurança
        const payModeEl = document.querySelector('input[name="pay-mode"]:checked');
        const payMode = payModeEl ? payModeEl.value : null;

        if (dConfig.ownDelivery === true && payMode === 'delivery') {
            if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery === false) {
                return alert("⛔ ENDEREÇO INVÁLIDO OU DISTANTE\n\nO sistema bloqueou a entrega para este CEP.");
            }
        }

        const name = getVal('checkout-name');
        const phone = getVal('checkout-phone');
        const cep = getVal('checkout-cep');
        const street = getVal('checkout-street');
        const number = getVal('checkout-number');
        const district = getVal('checkout-district');
        const comp = getVal('checkout-comp');

        if (!name || !phone || !cep || !number || !street) return alert("⚠️ Preencha todos os campos obrigatórios.");

        const methodEl = document.querySelector('input[name="payment-method-selection"]:checked');
        if (!payMode || !methodEl) return alert("⚠️ Selecione a forma de pagamento.");

        const method = methodEl.value;
        let paymentDetails = "", paymentMsgShort = "";

        if (method === 'pix') { paymentDetails = "Pix"; paymentMsgShort = "Pix"; }
        else if (method === 'credit') {
            const select = document.getElementById('checkout-installments');
            let parcelas = "1x (À vista)";
            if (payMode === 'online' && select && select.selectedIndex >= 0) parcelas = select.options[select.selectedIndex].text;
            else if (payMode === 'delivery') parcelas = "Na Maquininha";
            paymentDetails = `Cartão de Crédito (${parcelas})`;
            paymentMsgShort = `Crédito (${parcelas})`;
        }
        else if (method === 'debit') {
            let info = payMode === 'delivery' ? "Na Maquininha" : "À vista";
            paymentDetails = `Cartão de Débito (${info})`;
            paymentMsgShort = `Débito (${info})`;
        }
        else if (method === 'cash') {
            const trocoVal = getVal('checkout-change-for');
            paymentDetails = `Dinheiro (Troco para: ${trocoVal || 'Não precisa'})`;
            paymentMsgShort = `Dinheiro ${trocoVal ? `(Troco p/ ${trocoVal})` : '(Sem troco)'}`;
        }
        paymentDetails += (payMode === 'online') ? " [Pago Online]" : " [Pagar na Entrega]";

        const totalEl = document.getElementById('checkout-final-total');
        let finalValue = 0;
        let totalString = "R$ 0,00";
        if (totalEl) {
            totalString = totalEl.innerText;
            finalValue = parseFloat(totalEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
        }

        let couponData = null;
        if (state.currentCoupon) {
            let subtotal = state.cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
            let discountVal = state.currentCoupon.type === 'percent' ? subtotal * (state.currentCoupon.val / 100) : state.currentCoupon.val;
            if (discountVal > subtotal) discountVal = subtotal;
            couponData = { code: state.currentCoupon.code, value: discountVal };
        }

        const cancelMinutes = parseInt(dConfig.cancelTimeMin) || 5;
        let securityCode = null;
        if (payMode === 'delivery' && dConfig.reqCustomerCode === true) securityCode = Math.floor(1000 + Math.random() * 9000);

        const fullAddress = `${street}, ${number} ${comp ? '(' + comp + ')' : ''} - ${district} - CEP: ${cep}`;
        const nextCode = await getNextOrderNumber(state.siteId);

        const shipRule = dConfig.shippingRule || 'none';
        const shipValue = parseFloat(dConfig.shippingValue) || 0;
        let valueToSave = 0;
        if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
            if (shipRule === 'both' || (shipRule === 'online' && payMode === 'online') || (shipRule === 'delivery' && payMode === 'delivery')) {
                valueToSave = shipValue;
            }
        }

        const order = {
            code: nextCode, date: new Date().toISOString(),
            customer: { name, phone, address: fullAddress, addressNum: number, cep, district, street, comp },
            items: state.cart || [], total: finalValue, status: 'Aguardando aprovação',
            paymentMethod: paymentDetails, securityCode, shippingFee: valueToSave,
            couponData, cupom: couponData ? couponData.code : null,
            cancelLimit: new Date(new Date().getTime() + cancelMinutes * 60000).toISOString()
        };

        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "⏳ Enviando..."; }

        const docRef = await addDoc(collection(db, `sites/${state.siteId}/sales`), order);
        const newOrderLocal = { id: docRef.id, ...order };
        if (!Array.isArray(state.myOrders)) state.myOrders = [];
        state.myOrders.push(newOrderLocal);
        localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));

        startBackgroundListeners(); checkActiveOrders(); state.cart = []; state.currentCoupon = null;
        localStorage.setItem('cart', JSON.stringify([])); updateCartUI();

        if (payMode === 'online') {
            let msg = `*NOVO PEDIDO #${order.code}*\n--------------------------------\n`;
            msg += `*Cliente:* ${name}\n *Tel:* ${phone}\n\n*ITENS:*\n`;
            order.items.forEach(item => { msg += `▪ ${item.qty}x ${item.name} ${item.size !== 'U' ? `(${item.size})` : ''}\n`; });
            msg += `\n *TOTAL: ${totalString}*\n *Tipo:* ${payMode === 'online' ? "Pagar Agora (Online)" : "Pagar na Entrega"}\n *Pagamento:* ${paymentMsgShort}\n`;
            msg += `\n📍 *Endereço:*\n${fullAddress}`;

            let storePhone = state.storeProfile.whatsapp || "";
            let targetNumber = storePhone.replace(/\D/g, '');
            if (targetNumber.length >= 10) {
                if (targetNumber.length <= 11) targetNumber = "55" + targetNumber;
                const url = `https://api.whatsapp.com/send?phone=${targetNumber}&text=${encodeURIComponent(msg)}`;
                const newWindow = window.open(url, '_blank');
                if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') window.location.href = url;
            }
        }
        openTrackModal();

    } catch (e) {
        console.error("Erro Submit:", e);
        alert("Erro ao enviar pedido: " + e.message);
    } finally {
        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Confirmar Pedido"; }
    }
};



function enablePaymentSection() {
    els.paymentSection.classList.remove('hidden');
    setTimeout(() => {
        els.paymentSection.classList.remove('opacity-50', 'pointer-events-none');
        updateCheckoutTotal();
        els.btnFinishOrder.disabled = false;
    }, 100);
}

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

    // 1. Calcula o Valor dos Produtos com Desconto do Cupom
    let valorBaseProdutos = 0;
    state.cart.forEach(i => valorBaseProdutos += i.price * i.qty);

    if (state.currentCoupon) {
        if (state.currentCoupon.type === 'percent') {
            valorBaseProdutos -= valorBaseProdutos * (state.currentCoupon.val / 100);
        } else {
            valorBaseProdutos -= state.currentCoupon.val;
        }
    }

    // 2. Calcula o Valor do Frete
    let valorFrete = 0;
    const dConfig = state.storeProfile.deliveryConfig || {};
    const shipRule = dConfig.shippingRule || 'none';
    const shipValue = parseFloat(dConfig.shippingValue) || 0;
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value || 'online';

    if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
        let shouldAddShip = false;
        if (shipRule === 'both') shouldAddShip = true;
        else if (shipRule === 'online' && payMode === 'online') shouldAddShip = true;
        else if (shipRule === 'delivery' && payMode === 'delivery') shouldAddShip = true;

        if (shouldAddShip) {
            valorFrete = shipValue;
        }
    }

    // 3. Define o Valor Presente (PV) Total para financiamento
    // Na Tabela Price Padrão, o frete entra no montante financiado
    const valorPresenteTotal = Math.max(0, valorBaseProdutos + valorFrete);

    // 4. Gera Opções
    const maxParcelas = (instConfig.active && valorPresenteTotal > 0) ? instConfig.max : 1;

    for (let i = 1; i <= maxParcelas; i++) {

        let montanteFinal = valorPresenteTotal;
        let label = `${i}x Sem Juros`;

        // --- CÁLCULO TABELA PRICE ---
        // Aplica juros sobre o TOTAL (Produto + Frete)
        if (instConfig.active && i > instConfig.freeUntil && instConfig.rate > 0) {
            const taxa = instConfig.rate / 100;
            const fator = Math.pow(1 + taxa, i);

            // Fórmula PMT (Prestação) = PV * [ i(1+i)^n / ((1+i)^n - 1) ]
            const valorPrestacao = valorPresenteTotal * ((taxa * fator) / (fator - 1));

            montanteFinal = valorPrestacao * i;
            label = `${i}x (c/ juros)`;
        }

        // Valor da parcela para exibição
        const valorParcelaDisplay = montanteFinal / i;

        const option = document.createElement('option');
        option.value = i;

        // Salva o total calculado no dataset
        option.dataset.total = montanteFinal.toFixed(2);

        option.text = `${label} de ${formatCurrency(valorParcelaDisplay)}`;
        select.appendChild(option);
    }

    // Atualiza o total verde
    if (typeof calcCheckoutTotal === 'function') calcCheckoutTotal();
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

function openCart() {
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
function showCartListView() {
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

    // RESET DOS BOTÕES
    const btnGo = document.getElementById('btn-go-checkout');
    if (btnGo) btnGo.classList.remove('hidden'); // Mostra "Ir para Pagamento"

    const group = document.getElementById('checkout-buttons-group');
    if (group) {
        group.classList.add('hidden'); // Esconde o grupo de finalização
        group.classList.remove('flex');
    }

    // Esconde o antigo se ainda existir
    const btnFinishOld = document.getElementById('btn-finish-payment');
    if (btnFinishOld && !group) btnFinishOld.classList.add('hidden');
};

window.goToCheckoutView = () => {
    if (state.cart.length === 0) return alert("Carrinho vazio!");

    // VERIFICAÇÃO DE LOJA FECHADA
    const status = getStoreStatus();
    if (!status.isOpen && !status.block) {
        const confirmMsg = `A loja está FECHADA no momento (Abre às ${status.start}).\n\nSeu pedido será recebido, mas só começará a ser preparado quando a loja abrir.\n\nDeseja continuar?`;
        if (!confirm(confirmMsg)) return;
    }

    // 1. APLICA AS REGRAS DE VISIBILIDADE (AQUI ESTAVA FALTANDO)
    applyCheckoutVisibility();

    // 2. Troca as Telas
    hideAllViews();
    document.getElementById('view-checkout').classList.remove('hidden');

    // 3. Ajusta Título
    document.getElementById('cart-modal-title').innerText = "FINALIZAR PEDIDO";
    document.getElementById('cart-footer-actions').classList.remove('hidden');

    // 4. TROCA OS BOTÕES DO RODAPÉ
    document.getElementById('btn-go-checkout').classList.add('hidden');

    const group = document.getElementById('checkout-buttons-group');
    if (group) {
        group.classList.remove('hidden');
        group.classList.add('flex');
    } else {
        const oldBtn = document.getElementById('btn-finish-payment');
        if (oldBtn) oldBtn.classList.remove('hidden');
    }

    const btnBackTop = document.getElementById('btn-modal-back');
    if (btnBackTop) btnBackTop.classList.remove('hidden');
};

// --- NOVO: Função para Voltar do Checkout para o Carrinho ---
window.backToOrderList = () => {
    // 1. Troca as telas
    hideAllViews(); // Esconde checkout, status, etc
    document.getElementById('view-cart-list').classList.remove('hidden'); // Mostra lista

    // 2. Ajusta Título
    document.getElementById('cart-modal-title').innerText = "SEU CARRINHO";
    document.getElementById('cart-footer-actions').classList.remove('hidden');

    // 3. TROCA OS BOTÕES DO RODAPÉ
    // Mostra o botão "Ir para Pagamento"
    document.getElementById('btn-go-checkout').classList.remove('hidden');

    // Esconde o grupo "Voltar + Confirmar"
    const group = document.getElementById('checkout-buttons-group');
    if (group) {
        group.classList.add('hidden');
        group.classList.remove('flex');
    }

    // Esconde a setinha do topo (opcional, já que temos o botão embaixo)
    const btnBackTop = document.getElementById('btn-modal-back');
    if (btnBackTop) btnBackTop.classList.add('hidden');
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

// Função para atualizar o Select de "Sem Juros" baseado no Máximo de Parcelas
function updateFreeInstallmentsSelect() {
    const elMax = document.getElementById('conf-card-max');
    const elSelect = document.getElementById('conf-card-free');

    if (!elMax || !elSelect) return;

    // Pega o valor atual selecionado para tentar manter depois de recriar
    const currentSelected = parseInt(elSelect.value) || 1;
    const maxVal = parseInt(elMax.value) || 12;

    // Limpa o select
    elSelect.innerHTML = '';

    // Opção 1: Nunca (Sempre com juros) -> Vamos usar valor 1 para representar isso internamente
    const optNever = document.createElement('option');
    optNever.value = 1;
    optNever.text = "Nunca (Sempre c/ juros)";
    elSelect.appendChild(optNever);

    // Gera de 2 até o Máximo definido
    for (let i = 2; i <= maxVal; i++) {
        const opt = document.createElement('option');
        opt.value = i;

        if (i === maxVal) {
            opt.text = `${i}x (Tudo sem juros)`;
        } else {
            opt.text = `${i}x`;
        }

        elSelect.appendChild(opt);
    }

    // Restaura a seleção (se o valor antigo ainda for válido, senão seleciona 1)
    if (currentSelected <= maxVal) {
        elSelect.value = currentSelected;
    } else {
        elSelect.value = 1;
    }
}

// 1. Controla o Modo Principal (Online vs Entrega)
function togglePaymentMode() {
    const modeEl = document.querySelector('input[name="pay-mode"]:checked');
    if (!modeEl) return;

    const mode = modeEl.value;
    const lblMethod = document.getElementById('lbl-payment-method');

    // --- CORREÇÃO: REMOVIDAS AS LINHAS QUE DESBLOQUEAVAM AUTOMATICAMENTE ---
    // Quem decide se desbloqueia agora é APENAS a função validateCheckoutForm()
    // -----------------------------------------------------------------------

    // Recupera Configs (com fallback seguro para credit/debit)
    const pm = state.storeProfile?.paymentMethods || {};

    // --- SELETORES ---
    const radioPix = document.querySelector('input[name="payment-method-selection"][value="pix"]');
    const lblPix = radioPix ? radioPix.closest('label') : null;

    // Crédito (div container)
    const radioCredit = document.querySelector('input[name="payment-method-selection"][value="credit"]');
    const divCredit = document.getElementById('container-credit-option');

    // Débito (label)
    const radioDebit = document.querySelector('input[name="payment-method-selection"][value="debit"]');
    const lblDebit = document.getElementById('container-debit-option');

    // Dinheiro
    const radioCash = document.querySelector('input[name="payment-method-selection"][value="cash"]');
    const containerCash = document.getElementById('container-cash-option');

    const updateVis = (el, show, radio) => {
        if (!el) return;
        if (show) {
            el.classList.remove('hidden');
            el.style.display = '';
            if (radio) radio.disabled = false;
        } else {
            el.classList.add('hidden');
            el.style.setProperty('display', 'none', 'important');
            if (radio) radio.disabled = true;
        }
    };

    if (mode === 'delivery') {
        if (lblMethod) lblMethod.innerText = "Pagarei na entrega com:";

        // Verifica configurações de Entrega
        const pDel = pm.delivery || {};
        updateVis(lblPix, pDel.pix !== false, radioPix);
        updateVis(divCredit, pDel.credit !== false, radioCredit);
        updateVis(lblDebit, pDel.debit !== false, radioDebit);
        updateVis(containerCash, pDel.cash !== false, radioCash);

    } else {
        // ONLINE
        if (lblMethod) lblMethod.innerText = "Pagar agora com:";

        // Verifica configurações Online
        const pOn = pm.online || {};
        updateVis(lblPix, pOn.pix !== false, radioPix);
        updateVis(divCredit, pOn.credit !== false, radioCredit);
        updateVis(lblDebit, pOn.debit !== false, radioDebit);
        updateVis(containerCash, false, radioCash); // Dinheiro nunca no online
    }

    // Auto-Correção
    const current = document.querySelector('input[name="payment-method-selection"]:checked');
    let isInvalid = false;

    if (!current) isInvalid = true;
    else if (current.disabled) isInvalid = true;
    else if (current.closest('.hidden')) isInvalid = true;

    if (isInvalid) {
        const valid = document.querySelector('input[name="payment-method-selection"]:not(:disabled)');
        if (valid && !valid.closest('.hidden')) {
            valid.checked = true;
            if (typeof window.toggleMethodSelection === 'function') window.toggleMethodSelection();
        }
    } else {
        if (typeof window.toggleMethodSelection === 'function') window.toggleMethodSelection();
    }

    // IMPORTANTE: Após ajustar o visual, validamos se deve continuar bloqueado
    if (typeof validateCheckoutForm === 'function') validateCheckoutForm();

    applyCheckoutVisibility();
};

// 2. Controla a Seleção Específica (Pix vs Cartão vs Dinheiro)
function toggleMethodSelection() {
    // Modo Principal (Online/Entrega)
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value;
    // Método (Pix/Credit/Debit/Cash)
    const method = document.querySelector('input[name="payment-method-selection"]:checked')?.value;

    const creditInstallmentsDiv = document.getElementById('credit-installments-container');
    const cashChangeContainer = document.getElementById('cash-change-container');

    // 1. Reseta
    if (creditInstallmentsDiv) creditInstallmentsDiv.classList.add('hidden');
    if (cashChangeContainer) cashChangeContainer.classList.add('hidden');

    // 2. CRÉDITO (Mostra parcelas SÓ se for Online)
    if (method === 'credit') {
        if (payMode === 'online') {
            if (creditInstallmentsDiv) creditInstallmentsDiv.classList.remove('hidden');
            populateInstallments();
        }
    }
    // 3. DINHEIRO
    else if (method === 'cash') {
        if (cashChangeContainer) {
            cashChangeContainer.classList.remove('hidden');
            setTimeout(() => document.getElementById('checkout-change-for')?.focus(), 100);
        }
    }
    // Débito e Pix não abrem nada extra

    // Recalcula totais (para atualizar texto do botão e valores)
    calcCheckoutTotal();
};



// --- FUNÇÃO ÚNICA: CALCULAR TOTAL DO CHECKOUT ---
window.calcCheckoutTotal = () => {
    // 1. Configurações e Estado Atual
    const payMode = document.querySelector('input[name="pay-mode"]:checked')?.value || 'online';
    const methodEl = document.querySelector('input[name="payment-method-selection"]:checked');
    const method = methodEl ? methodEl.value : 'pix';

    const dConfig = state.storeProfile?.deliveryConfig || {};
    const shipRule = dConfig.shippingRule || 'none';
    const shipValue = parseFloat(dConfig.shippingValue) || 0;
    const pixGlobal = state.storeProfile?.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };

    // Variáveis de Exibição
    let subtotalDisplay = 0;
    let discountPixDisplay = 0;
    let discountCouponDisplay = 0;
    let shippingDisplay = 0;
    let finalTotal = 0;
    let obsJuros = '';

    // 2. Calcula Subtotal dos Itens
    state.cart.forEach(item => subtotalDisplay += item.price * item.qty);

    // 3. Calcula Frete (Baseado na regra e no modo de pagamento)
    if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
        let applyFrete = false;
        if (shipRule === 'both') applyFrete = true;
        else if (shipRule === 'online' && payMode === 'online') applyFrete = true;
        else if (shipRule === 'delivery' && payMode === 'delivery') applyFrete = true;

        if (applyFrete) shippingDisplay = shipValue;
    }

    // --- CÁLCULOS POR MÉTODO DE PAGAMENTO ---

    // A. PIX (Calcula descontos)
    if (method === 'pix') {
        let totalWithPixPrices = 0;

        if (pixGlobal.disableAll) {
            totalWithPixPrices = subtotalDisplay;
        } 
        else if (pixGlobal.active && pixGlobal.value > 0) {
            const isFixed = (pixGlobal.type === 'fixed');
            const val = pixGlobal.value;

            if (pixGlobal.mode === 'product') {
                state.cart.forEach(item => {
                    let price = item.price;
                    let descVal = isFixed ? val : price * (val / 100);
                    price = Math.max(0, price - descVal);
                    totalWithPixPrices += price * item.qty;
                });
            } else {
                // Modo Total
                let totalDesc = isFixed ? val : subtotalDisplay * (val / 100);
                totalWithPixPrices = Math.max(0, subtotalDisplay - totalDesc);
            }
        } else {
            // Individual por produto
            state.cart.forEach(item => {
                const prod = state.products.find(p => p.id === item.id);
                let price = item.price;
                if (prod && prod.paymentOptions?.pix?.active) {
                    const cfg = prod.paymentOptions.pix;
                    const descVal = cfg.type === 'percent' ? price * (cfg.val / 100) : cfg.val;
                    price = Math.max(0, price - descVal);
                }
                totalWithPixPrices += price * item.qty;
            });
        }

        discountPixDisplay = Math.max(0, subtotalDisplay - totalWithPixPrices);

        // Aplica Cupom sobre o preço Pix
        if (state.currentCoupon) {
            const baseCupom = totalWithPixPrices;
            if (state.currentCoupon.type === 'percent') discountCouponDisplay = baseCupom * (state.currentCoupon.val / 100);
            else discountCouponDisplay = state.currentCoupon.val;
        }

        finalTotal = (subtotalDisplay - discountPixDisplay - discountCouponDisplay) + shippingDisplay;
    }

    // B. CRÉDITO (AQUI ESTÁ A CORREÇÃO DOS JUROS)
    else if (method === 'credit' && payMode === 'online') {
        
        // 1. Aplica Cupom primeiro para saber a base
        if (state.currentCoupon) {
            if (state.currentCoupon.type === 'percent') discountCouponDisplay = subtotalDisplay * (state.currentCoupon.val / 100);
            else discountCouponDisplay = state.currentCoupon.val;
        }

        // 2. Busca o valor total já calculado COM JUROS no dropdown
        const select = document.getElementById('checkout-installments');
        
        // Verifica se tem algo selecionado
        if (select && select.options.length > 0 && select.selectedIndex >= 0) {
            const selectedOpt = select.options[select.selectedIndex];
            
            // Se a opção tem um "data-total", é esse o valor final (já inclui frete e juros)
            if (selectedOpt.dataset.total) {
                finalTotal = parseFloat(selectedOpt.dataset.total);
            } else {
                // Fallback (caso raro sem data-total)
                finalTotal = (subtotalDisplay - discountCouponDisplay) + shippingDisplay;
            }
        } else {
            // Se não carregou as parcelas ainda
            finalTotal = (subtotalDisplay - discountCouponDisplay) + shippingDisplay;
        }

        // Verifica se tem juros para exibir o aviso
        const instConfig = state.storeProfile?.installments;
        const parcelas = select ? parseInt(select.value) : 1;
        if (instConfig && instConfig.active && instConfig.rate > 0 && parcelas > instConfig.freeUntil) {
            obsJuros = `* Inclui juros de ${instConfig.rate}% a.m.`;
        }
    }

    // C. OUTROS (Débito, Dinheiro, Crédito na Entrega)
    else {
        if (state.currentCoupon) {
            if (state.currentCoupon.type === 'percent') discountCouponDisplay = subtotalDisplay * (state.currentCoupon.val / 100);
            else discountCouponDisplay = state.currentCoupon.val;
        }
        finalTotal = (subtotalDisplay - discountCouponDisplay) + shippingDisplay;
    }

    finalTotal = Math.max(0, finalTotal);

    // --- RENDERIZAÇÃO (RESUMO) ---
    const detailsContainer = document.getElementById('checkout-details-breakdown');
    if (detailsContainer) {
        let html = `<div class="flex justify-between text-gray-400"><span>Subtotal</span><span>${formatCurrency(subtotalDisplay)}</span></div>`;

        if (discountPixDisplay > 0.01) {
            html += `<div class="flex justify-between text-green-500 font-medium"><span>Desconto Pix</span><span>- ${formatCurrency(discountPixDisplay)}</span></div>`;
        }
        if (discountCouponDisplay > 0.01) {
            const code = state.currentCoupon?.code || 'Cupom';
            html += `<div class="flex justify-between text-green-500 font-medium"><span>${code}</span><span>- ${formatCurrency(discountCouponDisplay)}</span></div>`;
        }
        if (shippingDisplay > 0) {
            html += `<div class="flex justify-between text-yellow-500 font-medium"><span>Frete</span><span>+ ${formatCurrency(shippingDisplay)}</span></div>`;
        }
        
        // Se o total final for maior que a soma simples (indica juros), mostra linha de juros
        const somaSimples = (subtotalDisplay - discountPixDisplay - discountCouponDisplay) + shippingDisplay;
        if (finalTotal > somaSimples + 0.05) {
             const valorJuros = finalTotal - somaSimples;
             html += `<div class="flex justify-between text-gray-400 font-medium"><span>Juros</span><span>+ ${formatCurrency(valorJuros)}</span></div>`;
        }

        if (obsJuros) html += `<div class="text-[10px] text-gray-500 text-right italic mt-1">${obsJuros}</div>`;

        detailsContainer.innerHTML = html;
    }

    // Atualiza Total Grande
    const elTotal = document.getElementById('checkout-final-total');
    if (elTotal) elTotal.innerText = formatCurrency(finalTotal);
    
    // Atualiza Total Header (se existir)
    const elTotalHeader = document.getElementById('checkout-total-display');
    if (elTotalHeader) elTotalHeader.innerText = formatCurrency(finalTotal);
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
    msg += `\n💳 Pagamento: ${order.paymentMethod}\n`;

    msg += `\n📍 *Entrega: ${order.customer.cep}*,
    ${order.customer.district}, ${order.customer.street} - ${order.customer.addressNum}, ${order.customer.comp}\n`;
    msg += `\n👤 *Cliente: ${order.customer.name}*`;


    msg += `\n\nAguardo confirmação!`;

    // 5. Envio
    const sellerPhone = state.storeProfile.whatsapp || "";
    const cleanPhone = sellerPhone.replace(/\D/g, '');

    if (cleanPhone) {
        const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;

        // --- CORREÇÃO PARA SAFARI (iOS/Mac) ---
        // Tenta abrir em nova aba ('_blank'). 
        // O Safari geralmente retorna 'null' se bloquear o popup por causa do delay do banco de dados.
        const newWindow = window.open(url, '_blank');

        // Se newWindow for null (bloqueado) ou undefined, forçamos o redirecionamento na mesma aba.
        // Isso ativa o "Deep Link" que abre o aplicativo do WhatsApp no celular.
        if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            window.location.href = url;
        }

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


// --- FUNÇÕES DE AÇÃO DOS PEDIDOS (GLOBAL) ---

// 1. Botão Finalizar Pedido
window.adminFinalizeOrder = async (orderId) => {
    if (confirm("Confirmar finalização do pedido?\nIsso arquiva a venda como concluída.")) {
        // Chama a função central que atualiza o banco e baixa estoque se necessário
        if (typeof updateOrderStatusDB === 'function') {
            await updateOrderStatusDB(orderId, 'Concluído');
        } else {
            console.error("Função updateOrderStatusDB não encontrada.");
            // Fallback simples caso a função auxiliar não exista
            try {
                await updateDoc(doc(db, `sites/${state.siteId}/sales`, orderId), {
                    status: 'Concluído',
                    completedAt: new Date().toISOString()
                });
            } catch (e) { alert("Erro ao finalizar: " + e.message); }
        }
    }
};

// 2. Botão Cancelar
window.adminCancelOrder = async (orderId) => {
    if (confirm("Tem certeza que deseja CANCELAR este pedido?")) {
        await updateOrderStatusDB(orderId, 'Cancelado');
    }
};

// 5. Botão Reembolsar (Novo)
window.adminRefundOrder = async (orderId) => {
    if (confirm("Deseja REEMBOLSAR este pedido?\n\nIsso irá devolver os itens ao estoque e mudar o status para 'Reembolsado'.\nEsta ação é irreversível.")) {
        // A função updateOrderStatusDB já lida com a devolução de estoque automaticamente
        // porque "Reembolsado" não está na lista de status que "consomem" estoque.
        await updateOrderStatusDB(orderId, 'Reembolsado');
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
async function openTrackModal() {
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

    // 1. LÓGICA DA TIMELINE (Mantida igual)
    let currentStep = 0;
    if (s === 'Aguardando aprovação') currentStep = 0;
    else if (s === 'Aprovado' || s === 'Preparando pedido') currentStep = 1;
    else if (s === 'Saiu para entrega') currentStep = 2;
    else if (s === 'Entregue' || s === 'Concluído') currentStep = 3;

    const step0Label = (s === 'Aguardando aprovação' || isCancelled) ? 'Aguardando' : 'Aprovado';
    const step0Icon = (s === 'Aguardando aprovação' || isCancelled) ? 'fa-clock' : 'fa-thumbs-up';

    const steps = [
        { label: step0Label, icon: step0Icon },
        { label: 'Preparando', icon: 'fa-box-open' },
        { label: 'Saiu', icon: 'fa-motorcycle' },
        { label: 'Entregue', icon: 'fa-check' }
    ];

    let timelineHTML = `<div class="flex justify-between items-start mb-8 relative px-2">`;
    timelineHTML += `<div class="absolute top-[18px] left-7 right-7 h-0.5 bg-gray-700 -z-0"></div>`;

    const progressWidth = Math.min(currentStep * 33.33, 100);
    if (!isCancelled) {
        timelineHTML += `<div class="absolute top-[18px] left-7 h-0.5 bg-green-500 -z-0 transition-all duration-1000" style="width: calc(${progressWidth}% - 3.5rem)"></div>`;
    }

    steps.forEach((step, index) => {
        let circleClass = "bg-[#1f2937] border-2 border-gray-600 text-gray-500";
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
            if (index < currentStep) {
                circleClass = "bg-green-500 border-2 border-green-500 text-black";
                labelClass = "text-green-500 font-bold";
            }
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

    // 2. CONTEÚDO DOS ITENS E CÁLCULOS
    let subTotalItems = 0;

    let itemsHtml = order.items.map(i => {
        const itemTotal = i.price * i.qty;
        subTotalItems += itemTotal;
        return `
        <div class="flex justify-between items-center text-sm text-gray-300 mb-2 border-b border-gray-800 pb-2 last:border-0">
            <div class="flex items-center gap-2">
                 <span class="text-yellow-500 font-bold font-mono text-xs bg-yellow-900/20 px-1.5 rounded">${i.qty}x</span>
                 <span>${i.name} ${i.size !== 'U' ? `<span class="text-xs text-gray-500">(${i.size})</span>` : ''}</span>
            </div>
            <span class="text-white font-bold text-xs">${formatCurrency(itemTotal)}</span>
        </div>`;
    }).join('');

    // --- LÓGICA FINANCEIRA (SEPARAÇÃO DE DESCONTOS) ---
    const valFrete = order.shippingFee || 0;
    const valTotalPago = order.total || 0;
    const totalEsperado = subTotalItems + valFrete;

    // 1. Calcula o total de "dinheiro que falta" (Desconto Total)
    const valDescontoTotal = Math.max(0, totalEsperado - valTotalPago);

    // 2. Separa o valor do Cupom
    let valDescontoCupom = 0;
    let nomeCupom = null;

    if (order.couponData && order.couponData.value) {
        valDescontoCupom = order.couponData.value;
        nomeCupom = order.couponData.code;
    } else if (order.cupom) {
        // Fallback antigo
        nomeCupom = order.cupom;
    }

    // 3. O que sobrar é Pix (Desconto Total - Desconto Cupom)
    // Usamos Math.max(0, ...) para evitar negativos por arredondamento
    const valDescontoPix = Math.max(0, valDescontoTotal - valDescontoCupom);

    // --- CONSTROI O HTML FINANCEIRO ---
    let financialHtml = `
        <div class="mt-3 pt-3 border-t border-gray-700 flex flex-col gap-1">
            <div class="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span>
                <span>${formatCurrency(subTotalItems)}</span>
            </div>
    `;

    if (valFrete > 0) {
        financialHtml += `
            <div class="flex justify-between text-xs text-gray-400">
                <span>Taxa de Entrega</span>
                <span>+ ${formatCurrency(valFrete)}</span>
            </div>`;
    }

    // EXIBE CUPOM SEPARADO
    if (valDescontoCupom > 0.05) {
        financialHtml += `
            <div class="flex justify-between text-xs text-green-400 font-bold">
                <span>Cupom (${nomeCupom || 'Aplicado'})</span>
                <span>- ${formatCurrency(valDescontoCupom)}</span>
            </div>`;
    }

    // EXIBE PIX SEPARADO
    if (valDescontoPix > 0.05) {
        financialHtml += `
            <div class="flex justify-between text-xs text-green-400 font-bold">
                <span>Desconto Pix</span>
                <span>- ${formatCurrency(valDescontoPix)}</span>
            </div>`;
    }

    // Caso genérico (se tiver desconto mas não identificou a origem exata, ex: erro de arredondamento antigo)
    if (valDescontoTotal > 0.05 && valDescontoCupom < 0.01 && valDescontoPix < 0.01) {
        financialHtml += `
            <div class="flex justify-between text-xs text-green-400 font-bold">
                <span>Descontos</span>
                <span>- ${formatCurrency(valDescontoTotal)}</span>
            </div>`;
    }

    financialHtml += `
            <div class="flex justify-between items-end mt-2 pt-2 border-t border-gray-700/50">
                <span class="text-gray-300 font-bold text-sm">Total Final</span>
                <span class="text-green-400 font-extrabold text-xl">${formatCurrency(valTotalPago)}</span>
            </div>
        </div>
    `;

    // Bloco de Forma de Pagamento
    const paymentBlock = `
        <div class="mt-3 bg-black/40 p-3 rounded border border-gray-700/50">
            <p class="text-[10px] text-gray-500 uppercase font-bold mb-1"><i class="far fa-credit-card mr-1"></i> Forma de Pagamento</p>
            <p class="text-xs text-white font-medium break-words">${order.paymentMethod || 'Não informado'}</p>
        </div>
    `;

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

    // Botão Reenviar WhatsApp
    const isOnline = (order.paymentMethod || '').includes('Online');
    const allowedResendStatuses = ['Aguardando aprovação', 'Aprovado', 'Preparando pedido'];
    const canResend = isOnline && allowedResendStatuses.includes(order.status);

    const resendBtnHTML = canResend ? `
        <div class="mt-4 pt-3 border-t border-gray-700/50">
            <button onclick="retryWhatsapp('${order.id}')" 
                    class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
                <i class="fab fa-whatsapp text-lg"></i> Reenviar Pedido no Zap
            </button>
            <p class="text-[10px] text-gray-500 text-center mt-2">Caso não tenha sido redirecionado ao finalizar a compra.</p>
        </div>
    ` : '';

    // 3. RENDERIZAÇÃO FINAL
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
            
            ${financialHtml}
            ${paymentBlock}
            ${resendBtnHTML}
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
    // PROTEÇÃO: Se a lista não existe, para aqui e não trava o site
    if (!state.myOrders || !Array.isArray(state.myOrders) || state.myOrders.length === 0) {
        checkActiveOrders();
        return;
    }

    // Limpa ouvintes antigos
    if (window.activeListeners) {
        window.activeListeners.forEach(unsubscribe => unsubscribe());
    }
    window.activeListeners = [];

    // Inicia ouvintes com segurança
    state.myOrders.forEach(localOrder => {
        if (!localOrder || !localOrder.id) return;

        const unsub = onSnapshot(doc(db, `sites/${state.siteId}/sales`, localOrder.id), (docSnap) => {
            if (docSnap.exists()) {
                const freshData = docSnap.data();
                const index = state.myOrders.findIndex(o => o.id === localOrder.id);
                if (index !== -1) {
                    state.myOrders[index] = { id: localOrder.id, ...freshData };
                    localStorage.setItem('site_orders_history', JSON.stringify(state.myOrders));
                    checkActiveOrders();

                    const listModal = document.getElementById('view-order-list');
                    if (listModal && !listModal.classList.contains('hidden')) {
                        if (typeof showOrderListView === 'function') showOrderListView();
                    }
                }
            }
        }, (e) => console.warn("Rastreio silencioso:", e));

        window.activeListeners.push(unsub);
    });
}

//recebe a lista de pedidos, conta quantos tem em cada status e monta os botões coloridos.
function renderOrdersSummary(orders, filterStatus = '') {
    const container = document.getElementById('orders-summary-bar');
    if (!container) return;

    // 1. Inicializa Contadores (ADICIONADO REEMBOLSADO)
    const counts = {
        'Aguardando aprovação': 0,
        'Aprovado': 0,
        'Preparando pedido': 0,
        'Saiu para entrega': 0,
        'Entregue': 0,
        'Concluído': 0,
        'Reembolsado': 0, // <--- Novo
        'Cancelado': 0
    };

    let totalItensVendidos = 0;

    // 2. Processa os totais
    orders.forEach(o => {
        // A. Contagem de Status
        if (o.status.includes('Cancelado')) {
            counts['Cancelado']++;
        } else if (counts.hasOwnProperty(o.status)) {
            counts[o.status]++;
        }

        // B. Contagem de Itens Vendidos (Ignora Cancelados e Reembolsados)
        const isCancelado = o.status.includes('Cancelado');
        const isReembolsado = o.status === 'Reembolsado'; // <--- Não conta item vendido se foi reembolsado
        const isAguardando = o.status === 'Aguardando aprovação';

        if (!isCancelado && !isReembolsado && !isAguardando) {
            const itensDoPedido = o.items ? o.items.reduce((acc, item) => acc + (parseInt(item.qty) || 0), 0) : 0;
            totalItensVendidos += itensDoPedido;
        }
    });

    // 3. Definição dos Cards (ADICIONADO CARD ROXO PARA REEMBOLSADO)
    let cards = [
        { label: 'Aguardando', key: 'Aguardando aprovação', bg: 'bg-gray-600' },
        { label: 'Aprovados', key: 'Aprovado', bg: 'bg-yellow-600' },
        { label: 'Preparando', key: 'Preparando pedido', bg: 'bg-yellow-700' },
        { label: 'Na Entrega', key: 'Saiu para entrega', bg: 'bg-orange-600' },
        { label: 'Entregues', key: 'Entregue', bg: 'bg-green-500' },
        { label: 'Concluídos', key: 'Concluído', bg: 'bg-green-700' },
        { label: 'Reembolsados', key: 'Reembolsado', bg: 'bg-purple-600' }, // <--- Novo Card
        { label: 'Cancelados', key: 'Cancelado', bg: 'bg-red-600' }
    ];

    // 4. Filtro de Visibilidade
    if (filterStatus && filterStatus !== '') {
        if (filterStatus === 'Cancelado_All') {
            cards = cards.filter(c => c.key === 'Cancelado');
        } else {
            cards = cards.filter(c => c.key === filterStatus);
        }
    }

    cards.forEach((card, index) => { 
        const value = card.val !== undefined ? card.val : (counts[card.key] || 0);
        
        // Lógica: Se for o último card E o total de cards for ímpar, ele aplica o span total.
        // Isso resolve para mobile (2 colunas), tablet (4 colunas) e desktop (8 colunas) quando sobra 1.
        let spanClass = '';
        if (index === cards.length - 1 && cards.length % 2 !== 0) {
            spanClass = 'col-span-full'; 
        }

        html += `
            <div class="${card.bg} ${spanClass} text-white rounded p-3 flex flex-col items-center justify-center border border-white/10 min-h-[70px] animate-fade-in">
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



// Retorna objeto { isOpen: boolean, nextOpen: string }
function getStoreStatus() {
    // 1. Verifica se existe configuração
    const config = state.storeProfile.openingHours;
    if (!config || config.active !== true) return { isOpen: true };

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Parse seguro dos horários
    if (!config.start || !config.end) return { isOpen: true };

    const [startH, startM] = config.start.split(':').map(Number);
    const [endH, endM] = config.end.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let isOpen = false;

    // Cenário 1: Vira a noite (Ex: Abre 18:00, Fecha 02:00)
    // O horário de fim é MENOR que o de início
    if (endMinutes < startMinutes) {
        // Está aberto se for MAIOR que o início (ex: 20:00) OU MENOR que o fim (ex: 01:00)
        isOpen = currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    // Cenário 2: Mesmo dia (Ex: Abre 08:00, Fecha 18:00)
    else {
        isOpen = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return {
        isOpen: isOpen,
        start: config.start,
        end: config.end,
        block: config.block === true // Garante booleano
    };
};

// Atualiza a UI globalmente (Badge e Modal de Bloqueio)
function updateStoreStatusUI() {
    const status = getStoreStatus();
    const badgeBtn = document.getElementById('store-status-badge');
    const modalBlock = document.getElementById('modal-store-closed');
    const displayTime = document.getElementById('store-opens-at-display');

    // 1. ATUALIZA BADGE NA SIDEBAR
    if (badgeBtn) {
        // Se não tiver horário configurado, esconde o badge
        if (!state.storeProfile.openingHours?.active) {
            badgeBtn.classList.add('hidden');
            badgeBtn.classList.remove('flex');
        } else {
            badgeBtn.classList.remove('hidden');
            badgeBtn.classList.add('flex');

            // Reseta classes base
            badgeBtn.className = "flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mt-2 border transition hover:opacity-80 mx-auto cursor-pointer";

            let dotHtml = "";
            let labelText = "";
            let alertMsg = `🕒 Horário de Funcionamento:\n\nDas ${status.start} às ${status.end}`;

            if (status.isOpen) {
                // VERDE: Aberto
                badgeBtn.classList.add('border-green-500/30', 'bg-green-500/10', 'text-green-400');
                dotHtml = `<div class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse"></div>`;
                labelText = "Aberto";

                // Mensagem padrão
                alertMsg += `\n\n✅ Estamos abertos!`;
            }
            else if (status.block) {
                // VERMELHO: Fechado e Bloqueado
                badgeBtn.classList.add('border-red-500/30', 'bg-red-500/10', 'text-red-400');
                dotHtml = `<div class="w-2 h-2 rounded-full bg-red-500"></div>`;
                labelText = "Fechado";

                // Mensagem de fechado
                alertMsg += `\n\n⛔ Estamos fechados no momento.`;
            }
            else {
                // LARANJA: Fechado mas Aceitando (Recebendo)
                badgeBtn.classList.add('border-orange-500/30', 'bg-orange-500/10', 'text-orange-400');
                dotHtml = `<div class="w-2 h-2 rounded-full bg-orange-500"></div>`;
                labelText = "Fechado (Recebendo)";

                // --- AQUI ESTÁ A MENSAGEM QUE VOCÊ PEDIU ---
                alertMsg += `\n\n⚠️ Atenção:\nEstamos fechados, mas aceitando encomendas.\n\nOs pedidos feitos agora serão preparados e enviados assim que iniciarmos ás ${status.start}.`;
            }

            badgeBtn.innerHTML = `${dotHtml}<span>${labelText}</span>`;

            // Define o clique com a mensagem personalizada calculada acima
            badgeBtn.onclick = () => alert(alertMsg);
        }
    }

    // 2. LÓGICA DE BLOQUEIO (MODAL NA TELA)
    // Só bloqueia se: (Loja Fechada) E (Opção Bloquear Ativada) E (Usuário NÃO é Admin)
    if (!status.isOpen && status.block && modalBlock) {
        if (!state.user) {
            modalBlock.classList.remove('hidden');
            modalBlock.classList.add('flex');
            modalBlock.style.zIndex = "9999";

            if (displayTime) displayTime.innerText = `Abriremos às ${status.start}`;

            const cartModal = document.getElementById('cart-modal');
            const prodModal = document.getElementById('product-modal');
            if (cartModal) cartModal.classList.add('hidden');
            if (prodModal) prodModal.classList.add('hidden');

            return;
        }
    }

    if (modalBlock) {
        modalBlock.classList.add('hidden');
        modalBlock.classList.remove('flex');
    }
};


window.removeStoreBanner = () => {
    state.tempBanner = null; // Limpa o temporário

    // Esconde o preview e mostra que está sem banner
    const preview = document.getElementById('conf-banner-preview');
    if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
    }

    // Se quiser, pode setar state.storeProfile.banner = '' depois ao salvar
};


// =================================================================
// 12. SISTEMA DE TEMAS (PERSONALIZAÇÃO) - INTEGRADO
// =================================================================
window.applyStoreTheme = (settings) => {
    const root = document.documentElement;
    const c = settings?.colors || {}; // Atalho para evitar erros se não tiver config

    // --- 1. FUNDOS (BACKGROUNDS) ---
    // Cor do fundo geral da página (atrás de tudo)
    const bgMain = c.background || '#050505';
    // Cor do fundo dos cartões de produto (para destacar do fundo geral)
    const bgCard = c.card_bg || '#151720';
    // Cor do fundo do Cabeçalho/Topo (pode ser diferente do resto)
    const bgHeader = c.header_bg || '#000000';

    // --- 2. TEXTOS (TEXTS) ---
    // Títulos Principais (Nome da loja, "Vitrine", Nomes dos Produtos)
    const textTitle = c.text_title || '#ffffff';
    // Texto Comum (Descrições, detalhes pequenos)
    const textBody = c.text_body || '#9ca3af'; // Cinza padrão
    // Preços e Valores (Geralmente Verde ou Amarelo)
    const textPrice = c.text_price || '#22c55e'; // Verde Sucesso

    // --- 3. DETALHES (ACCENTS) ---
    // Cor de Destaque (Botões, Ícones importantes, Barras de progresso)
    const accent = c.accent || '#eab308'; // Amarelo Padrão


    // --- INJEÇÃO NO CSS ---
    root.style.setProperty('--bg-main', bgMain);
    root.style.setProperty('--bg-card', bgCard);
    root.style.setProperty('--bg-header', bgHeader);

    root.style.setProperty('--txt-title', textTitle);
    root.style.setProperty('--txt-body', textBody);
    root.style.setProperty('--txt-price', textPrice);

    root.style.setProperty('--clr-accent', accent);
};


// Tema Padrão (Caso apague tudo)
const defaultTheme = {
    bgColor: '#050505',
    headerColor: '#000000',
    cardColor: '#151720',    // Antigo sidebarColor
    accentColor: '#EAB308',  // Antigo highlightColor
    textColor: '#9ca3af',
    titleColor: '#ffffff'    // Novo para títulos
};

// 1. Aplica as cores ao CSS (Conecta com a estrutura nova)
function applyThemeToDOM(theme) {
    const root = document.documentElement;
    const t = theme || defaultTheme;

    // --- APLICA NO SITE (CSS Variables) ---
    root.style.setProperty('--bg-main', t.bgColor);
    root.style.setProperty('--bg-header', t.headerColor);
    root.style.setProperty('--bg-card', t.cardColor);
    root.style.setProperty('--clr-accent', t.accentColor);
    root.style.setProperty('--txt-body', t.textColor);
    root.style.setProperty('--txt-title', t.titleColor);

    // Variáveis derivadas (opcional, para preços)
    root.style.setProperty('--txt-price', '#22c55e'); // Mantém verde fixo ou adicione t.priceColor se quiser

    // --- ATUALIZA OS INPUTS NO ADMIN (Se estiver na tela de admin) ---
    const updateInput = (id, hexId, val) => {
        const el = document.getElementById(id);
        const hex = document.getElementById(hexId);
        if (el) el.value = val;
        if (hex) hex.innerText = val;
    };

    updateInput('theme-bg-color', 'hex-bg', t.bgColor);
    updateInput('theme-header-color', 'hex-header', t.headerColor);
    updateInput('theme-card-color', 'hex-card', t.cardColor);
    updateInput('theme-accent-color', 'hex-accent', t.accentColor);
    updateInput('theme-text-color', 'hex-text', t.textColor);
    updateInput('theme-title-color', 'hex-title', t.titleColor);
};

// 2. Preview em Tempo Real (Quando você mexe no seletor de cor)
window.previewTheme = (type, color) => {
    const root = document.documentElement;

    const map = {
        'bg': { var: '--bg-main', hex: 'hex-bg' },
        'header': { var: '--bg-header', hex: 'hex-header' },
        'card': { var: '--bg-card', hex: 'hex-card' },
        'accent': { var: '--clr-accent', hex: 'hex-accent' },
        'text': { var: '--txt-body', hex: 'hex-text' },
        'title': { var: '--txt-title', hex: 'hex-title' }
    };

    if (map[type]) {
        root.style.setProperty(map[type].var, color);
        const hexEl = document.getElementById(map[type].hex);
        if (hexEl) hexEl.innerText = color;
    }
};

// 3. Salvar no Firebase
// 3. Salvar no Firebase (Com notificação estilizada)
window.saveThemeColors = async () => {
    const newTheme = {
        bgColor: document.getElementById('theme-bg-color')?.value || defaultTheme.bgColor,
        headerColor: document.getElementById('theme-header-color')?.value || defaultTheme.headerColor,
        cardColor: document.getElementById('theme-card-color')?.value || defaultTheme.cardColor,
        accentColor: document.getElementById('theme-accent-color')?.value || defaultTheme.accentColor,
        textColor: document.getElementById('theme-text-color')?.value || defaultTheme.textColor,
        titleColor: document.getElementById('theme-title-color')?.value || defaultTheme.titleColor
    };

    try {
        // Salva na coleção da loja
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'theme'), newTheme);

        // Atualiza estado local
        state.currentTheme = newTheme;
        originalTheme = newTheme;

        // --- ALTERADO AQUI: Usa showToast em vez de alert ---
        showToast('Tema salvo com sucesso!', 'success');

    } catch (error) {
        console.error(error);
        // Exibe erro estilizado também
        showToast('Erro ao salvar tema: ' + error.message, 'error');
    }
};

// 4. Cancelar Mudanças
window.cancelThemeChanges = () => {
    applyThemeToDOM(originalTheme || defaultTheme);
};

// 5. Redefinir para Padrão
window.resetThemeToDefault = () => {
    applyThemeToDOM(defaultTheme);
};

// 6. Carregar Tema (Função que inicia tudo)
async function loadTheme() {
    try {
        // Se já temos o perfil da loja carregado no state, usamos ele para economizar leitura
        if (state.storeProfile && state.storeProfile.settings && state.storeProfile.settings.theme) {
            state.currentTheme = state.storeProfile.settings.theme;
            originalTheme = state.currentTheme;
            applyThemeToDOM(state.currentTheme);
            return;
        }

        // Caso contrário, busca no banco
        const docSnap = await getDoc(doc(db, `sites/${state.siteId}/settings`, 'theme'));
        if (docSnap.exists()) {
            state.currentTheme = docSnap.data();
            originalTheme = state.currentTheme;
            applyThemeToDOM(state.currentTheme);
        } else {
            state.currentTheme = defaultTheme;
            originalTheme = defaultTheme;
            applyThemeToDOM(defaultTheme);
        }
    } catch (e) {
        console.error("Erro ao carregar tema:", e);
        // Em caso de erro, carrega o padrão para não ficar sem cor
        applyThemeToDOM(defaultTheme);
    }
}

// EXPOR PARA O WINDOW (Importante para os onchange do HTML funcionarem)
window.loadTheme = loadTheme;



// E TAMBÉM chame ao abrir o modal de criar produto,
// caso o modal seja criado dinamicamente, para garantir que o evento pegue.

// Digite isso no Console do navegador para limpar o estado travado:
// localStorage.removeItem('activeOrder');
// location.reload();


// --- FUNÇÕES DOS BOTÕES CANCELAR/SALVAR NAS CONFIGURAÇÕES ---

window.saveSettingsManual = async (type) => {
    // 1. Salva os dados (Reaproveita sua função existente)
    await autoSaveSettings(type);

    // 2. Fecha o acordeão correspondente
    closeSettingsAccordion(type);
};

window.cancelSettings = (type) => {
    // 1. Reverte os dados (Preenche os inputs com o que está salvo na memória/banco)
    // Isso desfaz o que o usuário digitou se ele não tiver salvo ainda
    if (typeof fillProfileForm === 'function') {
        fillProfileForm();
    }

    // 2. Fecha o acordeão
    closeSettingsAccordion(type);

    // 3. Feedback visual
    showToast('Alterações descartadas.', 'info');
};

function closeSettingsAccordion(type) {
    let contentId = '';
    let arrowId = '';

    // Mapeia o tipo para os IDs do HTML
    if (type === 'installments') {
        contentId = 'content-acc-installments';
        arrowId = 'arrow-acc-installments';
    } else if (type === 'orders' || type === 'logistics') { // 'orders' costuma ser o de entrega
        contentId = 'content-acc-orders';
        arrowId = 'arrow-acc-orders';
    }

    // Fecha o elemento
    const content = document.getElementById(contentId);
    const arrow = document.getElementById(arrowId);

    if (content) content.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}


// =================================================================
// 13. NOVA LÓGICA DE DEPENDÊNCIA (ENTREGA <-> PAGAMENTO)
// =================================================================

// Função para exibir o Modal de Aviso (Cria o HTML dinamicamente)
window.showSystemModal = (message, type = 'warning') => {
    let modal = document.getElementById('sys-msg-modal');

    // Se não existe, cria na hora
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'sys-msg-modal';
        modal.className = "fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 hidden backdrop-blur-sm transition-opacity";
        modal.innerHTML = `
            <div class="bg-[#151720] border border-yellow-500/30 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl transform transition-all scale-100">
                <div id="sys-modal-icon" class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-yellow-500/10 text-yellow-500">
                    <i class="fas fa-exclamation-triangle text-2xl"></i>
                </div>
                <h3 class="text-white font-bold text-xl mb-2">Atenção</h3>
                <p id="sys-modal-msg" class="text-gray-400 text-sm mb-6 leading-relaxed"></p>
                <button onclick="document.getElementById('sys-msg-modal').classList.add('hidden')" 
                    class="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 px-6 rounded-xl w-full transition shadow-lg uppercase text-xs tracking-wide">
                    Entendido
                </button>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Configura texto e ícone
    const iconContainer = document.getElementById('sys-modal-icon');
    const msgEl = document.getElementById('sys-modal-msg');

    msgEl.innerText = message;

    if (type === 'success') {
        iconContainer.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/10 text-green-500";
        iconContainer.innerHTML = '<i class="fas fa-check text-2xl"></i>';
    } else {
        iconContainer.className = "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-yellow-500/10 text-yellow-500";
        iconContainer.innerHTML = '<i class="fas fa-exclamation-triangle text-2xl"></i>';
    }

    modal.classList.remove('hidden');
};

// Função para configurar os Listeners de Dependência (CORRIGIDA E BLINDADA)
function setupDeliveryDependency() {
    const elOwn = document.getElementById('conf-own-delivery');
    const elPayDel = document.getElementById('conf-pay-delivery-active');

    if (!elOwn || !elPayDel) return;

    // =================================================================
    // 1. MEXEU NA ENTREGA PRÓPRIA (O Chefe)
    // Regra: Desativar aqui -> Desativa Pagamento junto (Salva tudo de uma vez)
    // =================================================================
    const newOwn = elOwn.cloneNode(true);
    elOwn.parentNode.replaceChild(newOwn, elOwn);

    newOwn.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        
        // --- 1. Atualização Otimista da Memória (Entrega) ---
        if (!state.storeProfile.deliveryConfig) state.storeProfile.deliveryConfig = {};
        state.storeProfile.deliveryConfig.ownDelivery = isActive;

        // Visual do código
        const elReq = document.getElementById('conf-req-code');
        if (elReq) {
            elReq.disabled = !isActive;
            if (!isActive) { elReq.checked = false; elReq.closest('label')?.classList.add('opacity-50'); }
            else { elReq.closest('label')?.classList.remove('opacity-50'); }
        }

        // --- 2. LÓGICA DE DEPENDÊNCIA ---
        if (!isActive) {
            // Se DESLIGAR a entrega...
            const currentPayCheck = document.getElementById('conf-pay-delivery-active');
            
            if (currentPayCheck && currentPayCheck.checked) {
                // Segurança
                const onlineOn = document.getElementById('conf-pay-online-active')?.checked;
                if (!onlineOn) {
                    showSystemModal("⚠️ AÇÃO BLOQUEADA:\n\nVocê não pode desligar a Entrega Própria pois o Pagamento Online já está desativado.", "warning");
                    e.target.checked = true; // Volta visual
                    state.storeProfile.deliveryConfig.ownDelivery = true; // Volta memória
                    return; 
                }

                // Desliga Pagamento Visualmente
                currentPayCheck.checked = false;
                document.getElementById('group-delivery-methods').classList.add('opacity-30', 'pointer-events-none');
                
                // Desliga Pagamento na Memória
                if (!state.storeProfile.paymentMethods) state.storeProfile.paymentMethods = { delivery: {} };
                if (!state.storeProfile.paymentMethods.delivery) state.storeProfile.paymentMethods.delivery = {};
                state.storeProfile.paymentMethods.delivery.active = false;

                showSystemModal("ℹ️ Ao desativar a logística, o 'Pagamento na Entrega' também foi desativado.", "warning");

                // >>> SALVAMENTO ATÔMICO (O SEGREDO PARA NÃO PISCAR) <<<
                // Atualiza 'deliveryConfig' E 'paymentMethods' no mesmo comando
                try {
                    const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
                    
                    // Prepara objetos parciais para update
                    const updatePayload = {
                        "deliveryConfig.ownDelivery": false,
                        "paymentMethods.delivery.active": false
                    };
                    
                    // Se tiver código de segurança, desativa também
                    if (state.storeProfile.settings?.reqClientCode !== undefined) {
                         updatePayload["settings.reqClientCode"] = false;
                    }

                    await updateDoc(docRef, updatePayload);
                    showToast("Configurações atualizadas!", "success");
                    return; // Sai da função, não executa o autoSaveSettings lá embaixo

                } catch (err) {
                    console.error("Erro ao salvar conjunto:", err);
                }
            }
        }

        // Se não caiu no caso especial acima (ex: apenas ligou a entrega), salva normal
        await autoSaveSettings('orders');
    });

    // =================================================================
    // 2. MEXEU NO PAGAMENTO NA ENTREGA (O Independente)
    // Regra: Mexe só no pagamento. Apenas avisa se a entrega estiver off.
    // =================================================================
    const newPay = elPayDel.cloneNode(true);
    elPayDel.parentNode.replaceChild(newPay, elPayDel);

    newPay.addEventListener('change', async (e) => {
        const isActive = e.target.checked;
        
        // 1. Atualiza Memória IMEDIATAMENTE
        if (!state.storeProfile.paymentMethods) state.storeProfile.paymentMethods = { delivery: {} };
        if (!state.storeProfile.paymentMethods.delivery) state.storeProfile.paymentMethods.delivery = {};
        state.storeProfile.paymentMethods.delivery.active = isActive;

        // Segurança
        const onlineOn = document.getElementById('conf-pay-online-active')?.checked;
        if (!isActive && !onlineOn) {
            showSystemModal("⚠️ Pelo menos uma forma de pagamento deve ficar ativa.");
            e.target.checked = true;
            state.storeProfile.paymentMethods.delivery.active = true;
            return;
        }

        // Visual
        const group = document.getElementById('group-delivery-methods');
        if (group) {
            if (isActive) group.classList.remove('opacity-30', 'pointer-events-none');
            else group.classList.add('opacity-30', 'pointer-events-none');
        }

        // Aviso (Sem ação)
        const ownCheck = document.getElementById('conf-own-delivery');
        if (ownCheck && isActive && !ownCheck.checked) {
             showSystemModal("⚠️ Atenção:\n\nA 'Entrega Própria' está desativada.\n\nO pagamento foi ativado, mas não aparecerá no checkout até que a entrega seja ligada.", "warning");
        }

        await autoSaveSettings('payments');
    });
}

// Inicializa a lógica
document.addEventListener('DOMContentLoaded', () => {
    // Aguarda um pouco para garantir que o DOM foi preenchido pelo Firebase
    setTimeout(setupDeliveryDependency, 2000);
});





// --- LÓGICA UI: REGRAS PIX ---
function togglePixGlobalUI() {
    const disableAll = document.getElementById('conf-pix-disable-all').checked;
    const globalActive = document.getElementById('conf-pix-global-active').checked;

    const containerGlobal = document.getElementById('container-pix-global');
    const settingsGlobal = document.getElementById('pix-global-settings');

    // 1. Se "Remover Tudo" estiver marcado, bloqueia o Global
    if (disableAll) {
        containerGlobal.classList.add('opacity-30', 'pointer-events-none');
        document.getElementById('conf-pix-global-active').checked = false; // Desmarca visualmente
    } else {
        containerGlobal.classList.remove('opacity-30', 'pointer-events-none');

        // 2. Se Global Ativo, libera configurações
        if (globalActive) {
            settingsGlobal.classList.remove('opacity-50', 'pointer-events-none');
        } else {
            settingsGlobal.classList.add('opacity-50', 'pointer-events-none');
        }
    }
};



// --- FUNÇÕES MANUAIS PARA O PIX ---

// 1. SALVAR
window.savePixGlobal = async () => {
    const btn = document.querySelector('button[onclick="savePixGlobal()"]');
    const originalText = btn ? btn.innerText : 'Salvar';

    if (btn) {
        btn.innerText = "Salvando...";
        btn.disabled = true;
    }

    try {
        // Captura valores atuais da tela
        const pixGlobal = {
            disableAll: document.getElementById('conf-pix-disable-all').checked,
            active: document.getElementById('conf-pix-global-active').checked,
            type: document.querySelector('input[name="conf-pix-type"]:checked')?.value || 'percent',
            value: parseFloat(document.getElementById('conf-pix-global-value').value) || 0,
            mode: document.querySelector('input[name="conf-pix-mode"]:checked')?.value || 'product'
        };

        // Salva SOMENTE o objeto pixGlobal no banco (merge: true não apaga o resto)
        const docRef = doc(db, `sites/${state.siteId}/settings`, 'profile');
        await setDoc(docRef, { pixGlobal: pixGlobal }, { merge: true });

        // Atualiza memória local
        if (!state.storeProfile) state.storeProfile = {};
        state.storeProfile.pixGlobal = pixGlobal;

        // Atualiza telas
        renderCatalog(state.products);
        if (typeof updateCartUI === 'function') updateCartUI();

        showToast("Regras de Pix salvas com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao salvar Pix:", error);
        showToast("Erro ao salvar.", "error");
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
};

// 2. CANCELAR (Reverte para o que está na memória)
window.cancelPixGlobal = () => {
    // Pega o que está salvo atualmente no state (veio do banco)
    const pg = state.storeProfile.pixGlobal || {
        disableAll: false, active: false, value: 0, mode: 'product', type: 'percent'
    };

    // Re-aplica nos inputs
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    setCheck('conf-pix-disable-all', pg.disableAll);
    setCheck('conf-pix-global-active', pg.active);

    const valInput = document.getElementById('conf-pix-global-value');
    if (valInput) valInput.value = pg.value;

    // Radios
    const rMode = document.querySelector(`input[name="conf-pix-mode"][value="${pg.mode}"]`);
    if (rMode) rMode.checked = true;

    const rType = document.querySelector(`input[name="conf-pix-type"][value="${pg.type || 'percent'}"]`);
    if (rType) rType.checked = true;

    // Atualiza visual (opacidade)
    togglePixGlobalUI();

    showToast("Alterações descartadas.", "info");
};


// Função que LIBERA ou TRAVA o pagamento (Atualizada para permitir clique de aviso)
function validateCheckoutForm() {
    // 1. Pega os valores
    const name = document.getElementById('checkout-name')?.value.trim();
    const phone = document.getElementById('checkout-phone')?.value.trim();
    const number = document.getElementById('checkout-number')?.value.trim();

    // O campo Rua é preenchido pelo CEP
    const street = document.getElementById('checkout-street')?.value.trim();

    // 2. Elementos
    const paymentSection = document.getElementById('checkout-payment-options');
    const btnFinish = document.getElementById('btn-finish-payment');

    // 3. Regra: Tudo deve estar preenchido
    const isAddressOk = street && street !== "" && number && number !== "";
    const isUserOk = name && name !== "" && phone && phone !== "";
    const isCepValid = (typeof checkoutState !== 'undefined') ? checkoutState.isValidDelivery : true;

    const isValid = isAddressOk && isUserOk && isCepValid;

    if (isValid) {
        // --- LIBERA ---
        if (paymentSection) {
            paymentSection.classList.remove('opacity-50', 'locked-section');
            // Removemos pointer-events-none para permitir interação
            paymentSection.classList.remove('pointer-events-none');
        }
        if (btnFinish) {
            btnFinish.disabled = false;
            btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    } else {
        // --- BLOQUEIA (VISUALMENTE) ---
        if (paymentSection) {
            paymentSection.classList.add('opacity-50', 'locked-section');
            // IMPORTANTE: Removemos pointer-events-none para o clique funcionar e mostrar o Toast
            paymentSection.classList.remove('pointer-events-none');
        }
        if (btnFinish) {
            btnFinish.disabled = true;
            btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}


// ============================================================
// CONECTOR GLOBAL FINAL (ÚNICO E OBRIGATÓRIO)
// ============================================================

// 1. Navegação e UI
window.openCart = openCart;
window.closeCartModal = closeCartModal;
window.toggleSidebar = toggleSidebar;
window.showView = showView;
window.updateStoreStatusUI = updateStoreStatusUI;
window.loadTheme = loadTheme;
window.applyThemeToDOM = applyThemeToDOM;

// 2. Produtos e Vitrine
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.filterByCat = filterByCat;
window.updateSortLabel = updateSortLabel;

// 3. Checkout e Pedidos
window.goToCheckoutView = goToCheckoutView;
window.submitOrder = submitOrder;
window.handleCheckoutCep = handleCheckoutCep;
window.togglePaymentMode = togglePaymentMode;
window.toggleMethodSelection = toggleMethodSelection;
window.calcCheckoutTotal = calcCheckoutTotal;
window.validateCheckoutForm = validateCheckoutForm;

// 4. Admin e Configurações
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.confirmDeleteProduct = confirmDeleteProduct;
window.toggleProductSelection = toggleProductSelection;
window.deleteCoupon = deleteCoupon;
window.selectCoupon = selectCoupon;
window.editCoupon = editCoupon;
window.togglePixGlobalUI = togglePixGlobalUI;
window.savePixGlobal = savePixGlobal;
window.saveSettingsManual = saveSettingsManual;
window.cancelSettings = cancelSettings;
window.autoSaveSettings = autoSaveSettings;
window.saveThemeColors = saveThemeColors;
window.cancelThemeChanges = cancelThemeChanges;
window.resetThemeToDefault = resetThemeToDefault;
window.previewTheme = previewTheme;

// 5. Rastreio e Detalhes
window.openTrackModal = openTrackModal;
window.showOrderListView = showOrderListView;
window.showOrderDetail = showOrderDetail;
window.toggleOrderAccordion = toggleOrderAccordion;
window.markAsViewed = markAsViewed;
window.clientCancelOrder = clientCancelOrder;
window.retryWhatsapp = retryWhatsapp;

// 6. DESTRAVA ESTATÍSTICAS (Se for admin logado)
if (state.user && typeof loadAdminSales === 'function') {
    loadAdminSales();
}

