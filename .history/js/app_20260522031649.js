console.log("!!! ARQUIVO NOVO CARREGADO COM SUCESSO !!!");

import { db, auth, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, signInWithEmailAndPassword, signOut, onAuthStateChanged, getDocsCheck, setDoc, getDocs, getDoc, runTransaction, getDocFromServer } from './firebase-config.js';
import { initStatsModule, updateStatsData } from './stats.js';
import { checkAndActivateSupport, initSupportModule } from './support.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// =================================================================
// 🛡️ BLINDAGEM DE COR DO PAINEL ADMIN E SUPORTE
// =================================================================
if (!document.getElementById('admin-fixed-bg-style')) {
    const styleAdminBg = document.createElement('style');
    styleAdminBg.id = 'admin-fixed-bg-style';
    styleAdminBg.innerHTML = `
        /* Trava a cor de fundo do Admin e do Suporte para um tom escuro premium */
        #view-admin, #view-support {
            background-color: #0B0E14 !important; 
            min-height: 100vh !important;
            width: 100% !important;
        }
        
        /* Garante que, se o Admin estiver aberto, o body não vaze cor nas bordas */
        body:has(#view-admin:not(.hidden)), 
        body:has(#view-support:not(.hidden)) {
            background-color: #0B0E14 !important;
        }
    `;
    document.head.appendChild(styleAdminBg);
}

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
// =================================================================
// 📸 RENDERIZADOR DE IMAGENS COM DRAG & DROP (DESKTOP E MOBILE)
// =================================================================
window.renderImagePreviews = () => {
    const container = document.getElementById('prod-imgs-preview');
    if (!container) return;

    container.innerHTML = '';

    if (!state.tempImages || state.tempImages.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-xs italic w-full text-center py-4">Nenhuma imagem selecionada. Clique em "Adicionar Foto".</p>';
        return;
    }

    let draggedIndex = null; // Memória de quem está sendo arrastado

    state.tempImages.forEach((imgSrc, index) => {
        const div = document.createElement('div');
        // Classes atualizadas para cursor de movimento e animações
        div.className = "relative w-20 h-20 group border border-gray-600 rounded-lg overflow-hidden cursor-move transition-transform shadow-sm drag-item select-none";

        // Permite o drag nativo no PC
        div.draggable = true;
        div.dataset.index = index;

        // O HTML da caixinha (Note o pointer-events-none nas imagens para não bugar o toque do celular)
        div.innerHTML = `
            <img src="${imgSrc}" class="w-full h-full object-cover pointer-events-none select-none">
            
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center pointer-events-none">
                <i class="fas fa-arrows-alt text-white text-sm"></i>
            </div>
            
            <button type="button" onclick="event.stopPropagation(); removeTempImage(${index})" 
                class="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10 shadow-md">
                <i class="fas fa-trash text-[10px]"></i>
            </button>
            
            ${index === 0 ? '<span class="absolute bottom-0 left-0 right-0 bg-yellow-500 text-black text-[9px] font-bold text-center uppercase py-0.5 pointer-events-none shadow-[0_-2px_4px_rgba(0,0,0,0.3)]">Capa</span>' : ''}
        `;

        // ---------------------------------------------------
        // 🖱️ EVENTOS PARA PC (MOUSE / HTML5 DRAG & DROP)
        // ---------------------------------------------------
        div.addEventListener('dragstart', (e) => {
            draggedIndex = index;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => div.classList.add('opacity-30'), 0);
        });

        div.addEventListener('dragend', () => {
            div.classList.remove('opacity-30');
            renderImagePreviews(); // Limpa as bordas amarelas
        });

        div.addEventListener('dragover', (e) => {
            e.preventDefault(); // OBRIGATÓRIO para permitir soltar
            div.classList.add('border-yellow-500', 'border-2', 'scale-105');
        });

        div.addEventListener('dragleave', () => {
            div.classList.remove('border-yellow-500', 'border-2', 'scale-105');
        });

        div.addEventListener('drop', (e) => {
            e.preventDefault();
            const targetIndex = index;
            if (draggedIndex !== null && draggedIndex !== targetIndex) {
                reorderImages(draggedIndex, targetIndex);
            }
        });

        // ---------------------------------------------------
        // 📱 EVENTOS PARA CELULAR (TOUCH API)
        // ---------------------------------------------------
        div.addEventListener('touchstart', (e) => {
            // Ignora o toque se o usuário clicou na lixeirinha
            if (e.target.closest('button')) return;

            draggedIndex = index;
            div.classList.add('opacity-50', 'scale-110', 'z-50', 'ring-2', 'ring-yellow-500');
        }, { passive: true });

        div.addEventListener('touchmove', (e) => {
            if (draggedIndex === null) return;
            e.preventDefault(); // 🛑 Trava a tela para não rolar o site enquanto arrasta a foto

            const touch = e.touches[0];
            // O Segredo: Acha qual elemento está embaixo do dedo em tempo real
            const element = document.elementFromPoint(touch.clientX, touch.clientY);

            // Limpa as bordas de todos
            document.querySelectorAll('.drag-item').forEach(el => el.classList.remove('border-yellow-500', 'border-2', 'scale-105'));

            // Acende a borda de quem o dedo está sobrevoando
            if (element && element.closest('.drag-item')) {
                const targetEl = element.closest('.drag-item');
                if (targetEl !== div) targetEl.classList.add('border-yellow-500', 'border-2', 'scale-105');
            }
        }, { passive: false }); // passive false é necessário para o e.preventDefault funcionar no mobile

        div.addEventListener('touchend', (e) => {
            if (draggedIndex === null) return;

            const touch = e.changedTouches[0];
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetEl = element ? element.closest('.drag-item') : null;

            if (targetEl) {
                const targetIndex = parseInt(targetEl.dataset.index);
                if (draggedIndex !== targetIndex) {
                    reorderImages(draggedIndex, targetIndex);
                } else {
                    renderImagePreviews();
                }
            } else {
                renderImagePreviews(); // Soltou fora, só reseta
            }
            draggedIndex = null;
        });

        container.appendChild(div);
    });
};

// --- Função que executa a troca na memória ---
window.reorderImages = (fromIndex, toIndex) => {
    // Tira a imagem da posição antiga
    const imgToMove = state.tempImages.splice(fromIndex, 1)[0];
    // Insere na nova posição
    state.tempImages.splice(toIndex, 0, imgToMove);
    // Renderiza a tela de novo
    renderImagePreviews();
};

// --- Remove imagem da lista temporária ---
window.removeTempImage = (index) => {
    state.tempImages.splice(index, 1);
    renderImagePreviews();
};

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
        // z-index altíssimo para ficar acima de modais
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded shadow-2xl z-[999999] transition-all duration-300 opacity-0 translate-y-[-20px] border border-gray-700 font-bold flex items-center gap-2 pointer-events-none';
        document.body.appendChild(toast);
    }

    // ✨ CORREÇÃO: Usando 'let' em vez de 'const' para permitir a troca do ícone de erro
    let icon = type === 'success' ? '<i class="fas fa-check-circle text-green-500"></i>' : '<i class="fas fa-info-circle text-yellow-500"></i>';

    if (type === 'error') {
        toast.classList.remove('border-gray-700');
        toast.classList.add('border-red-500/50');
        icon = '<i class="fas fa-exclamation-circle text-red-500"></i>';
    } else {
        toast.classList.add('border-gray-700');
        toast.classList.remove('border-red-500/50');
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;

    // Animação de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', 'translate-y-[-20px]');
    });

    // Remove depois de 2 segundos
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-[-20px]');
    }, 2000);
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
// 1. CHAVE MESTRA DA MEMÓRIA (Impede vazamento de loja e fantasmas) -ESTADO GLOBAL E DOM
// =================================================================
const getSiteMemoryKey = () => {
    return window.SITE_ID || new URLSearchParams(window.location.search).get('site') || 'demo';
};

// =================================================================
// 2. ESTADO GLOBAL E DOM (BLINDADO POR LOJA)
// =================================================================
const state = {
    siteId: getSiteMemoryKey(), // Usa a chave mestra (mantém a lógica da URL intacta)
    products: [],
    categories: [],
    coupons: [],
    orders: [], // Vendas do admin

    // Carrinho e Usuário (Leitura Blindada - Sem o duplicado antigo)
    cart: JSON.parse(localStorage.getItem(`cart_${getSiteMemoryKey()}`)) || [],
    user: null,

    // Histórico de Pedidos do Cliente (Isolado por loja)
    myOrders: JSON.parse(localStorage.getItem(`orders_${getSiteMemoryKey()}`)) || [],
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
    globalSettings: { allowNoStock: false },
    cardSelections: {},

    // Configurações da aba PRODUTOS
    isSelectionMode: false, // Controla se checkboxes aparecem

    // Configuração padrão de ordenação
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

// Função global para limpar e fechar o modal corretamente
window.fecharModalLogin = () => {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = ''; // Limpa a força bruta do CSS
        modal.style.visibility = '';
        modal.style.opacity = '';
        modal.style.zIndex = '';
        try { modal.close(); } catch (e) { }
        modal.removeAttribute('open');
    }
};
// =================================================================
// 3. INICIALIZAÇÃO CORRIGIDA
// =================================================================
// =================================================================
// =================================================================
// 🛡️ SISTEMA DE BLINDAGEM DOM (ANTI-VAZAMENTO DE HTML) - DEFINITIVO
// =================================================================
const domVault = {};

// ✨ A MÁGICA: Interceptador de Busca!
// Como nós arrancamos o HTML da tela, o JS normal ficaria "cego".
// Esse código ensina o navegador a procurar os itens DENTRO do cofre também!
const originalGetElementById = document.getElementById.bind(document);
document.getElementById = function (id) {
    let el = originalGetElementById(id);
    if (el) return el; // Se achou na tela, perfeito.

    // Se não achou na tela, vasculha o cofre:
    for (let key in domVault) {
        const vaultEl = domVault[key];
        if (vaultEl && typeof vaultEl.querySelector === 'function') {
            if (vaultEl.id === id) return vaultEl;
            const found = vaultEl.querySelector(`#${id}`);
            if (found) return found;
        }
    }
    return null;
};

window.lockAdminVault = () => {
    // Áreas sensíveis que devem SUMIR fisicamente do código fonte
    const secureAreas = ['view-admin', 'view-support', 'product-form-modal', 'modal-admin-order'];

    secureAreas.forEach(id => {
        const el = originalGetElementById(id);
        if (el && !domVault[id]) {
            // Cria uma âncora invisível para saber onde devolver o HTML depois
            const placeholder = document.createElement('div');
            placeholder.id = `vault-placeholder-${id}`;
            placeholder.style.display = 'none';

            el.parentNode.insertBefore(placeholder, el);
            domVault[id] = el; // Guarda a área inteira na memória RAM
            el.remove(); // ✨ EXCLUI o HTML da página, impossibilitando leitura sem senha!
        }
    });

    // Oculta atalhos do admin
    ['menu-btn-admin', 'btn-admin-login'].forEach(id => {
        const btn = originalGetElementById(id);
        if (btn) btn.style.setProperty('display', 'none', 'important');
    });
};

window.unlockAdminVault = () => {
    const secureAreas = ['view-admin', 'view-support', 'product-form-modal', 'modal-admin-order'];

    secureAreas.forEach(id => {
        const placeholder = originalGetElementById(`vault-placeholder-${id}`);
        if (placeholder && domVault[id]) {
            // Pega o HTML do cofre e devolve pra página exatamente no lugar original
            placeholder.parentNode.insertBefore(domVault[id], placeholder);
            placeholder.remove();
            delete domVault[id]; // Limpa a memória
        }
    });

    ['menu-btn-admin', 'btn-admin-login'].forEach(id => {
        const btn = originalGetElementById(id);
        if (btn) btn.style.display = '';
    });

    // ✨ FORÇA A ATUALIZAÇÃO DA TELA
    // Como o HTML acabou de "nascer" de novo na página, as tabelas estariam vazias.
    // Isso injeta os dados do banco imediatamente!
    if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
    if (typeof renderAdminCoupons === 'function') renderAdminCoupons();
    if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
    if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
    if (typeof fillProfileForm === 'function') fillProfileForm();
};

const startApplication = async () => {
    console.log("🚀 Iniciando App V4...");

    // ✨ 0. TRANCA O COFRE ANTES DE QUALQUER COISA (Evita o vazamento do HTML)
    if (typeof lockAdminVault === 'function') lockAdminVault();

    // ✨ 1. SALVA NA MEMÓRIA E LIMPA A URL SEM PERDER O ID ✨
    const currentUrl = window.location.href;
    if (currentUrl.includes('admin=true')) {
        sessionStorage.setItem('wantsAdmin', 'true');

        // Pega a URL atual e corta apenas a chave secreta, mantendo o resto intacto!
        const cleanUrl = currentUrl.replace('&admin=true', '').replace('?admin=true', '');
        window.history.replaceState(null, '', cleanUrl);
    }

    const acessoPermitido = await initApp();

    if (acessoPermitido) {
        console.log("✅ Acesso Liberado. Carregando interface...");
        setupEventListeners();
        setupKeyboardListeners();
        document.body.classList.add('loaded');
    } else {
        console.log("⛔ Acesso Negado.");
    }
};

// Auto-execução
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

// =================================================================
// INIT APP ATUALIZADA COM O MODO PAUSA E O LOGIN CORRIGIDO
// =================================================================
async function initApp() {
    // --- 1. SEGURANÇA E BLOQUEIO (NOVO) ---
    // Pega o ID que o index.html já validou, em vez de ler a URL!
    let siteId = window.SITE_ID;

    // Fallback de emergência caso perca a memória
    if (!siteId) {
        const params = new URLSearchParams(window.location.search);
        siteId = params.get('site');
    }

    if (!siteId) {
        exibirTelaMorte("Loja não identificada", "Link inválido.");
        return false;
    }

    state.siteId = siteId;

    try {
        console.log(`🔒 Verificando segurança para: ${siteId}`);
        const docRef = doc(db, "sites", siteId);

        // Vai no servidor checar se existe ou foi banido
        const snap = await getDocFromServer(docRef);

        // A. SITE NÃO EXISTE (EXCLUÍDO)
        if (!snap.exists()) {
            localStorage.removeItem('vestemanto_cart');
            exibirTelaMorte("404", "Esta loja não existe mais.");
            return false;
        }

        const data = snap.data();

        // B. SITE PAUSADO (NOVO)
        if (data.status === 'pausado') {
            exibirTelaMorte(
                "Site Indisponível Temporariamente",
                "Estamos realizando manutenções ou atualizações na loja. Volte em breve!",
                "pausado"
            );
            return false; // Bloqueia o carregamento do resto do site
        }

        // C. SITE BLOQUEADO
        if (data.status === 'bloqueado' || data.active === false || data.status === 'excluido') {
            exibirTelaMorte("Suspenso", "Loja indisponível.");
            return false;
        }

        // === SUCESSO: SALVA O PERFIL NO ESTADO ===
        state.storeProfile = data;
        console.log("✅ Acesso permitido. Carregando sistema...");

        // --- 2. CARREGAMENTOS DO SEU CÓDIGO ANTIGO ---
        loadSiteStats();
        incrementVisitsCounter();
        loadSettings();
        loadCategories();
        loadProducts();

        // Aqui substituímos o loadStoreProfile() antigo, pois já carregamos os dados acima na segurança
        loadStoreProfile();

        loadCoupons();
        updateCartUI();
        startBackgroundListeners();
        try {
            if (typeof initStatsModule === 'function') initStatsModule();
        } catch (errStats) {
            console.warn("Aviso: Módulo de estatísticas falhou, mas o sistema continuará carregando.", errStats);
        }
        loadTheme();


        // Monitoramento de segurança em tempo real (15s)
        setInterval(async () => {
            try {
                const check = await getDocFromServer(docRef);
                // Atualizado para recarregar se for pausado também
                if (!check.exists() || check.data().status === 'bloqueado' || check.data().status === 'pausado') {
                    window.location.reload();
                }
            } catch (e) { }
        }, 60000);

        // --- 3. TEMA E UI (DO SEU CÓDIGO ANTIGO) ---
        if (localStorage.getItem('theme') === 'light') toggleTheme(false);

        // --- 4. AUTH LISTENER (LOGICA DE PROTEÇÃO DE VIEW) ---123
        onAuthStateChanged(auth, (user) => {
            // ✨ FIM DO CRACHÁ FALSO: Agora só existe o 'user' real do Firebase!
            state.user = user;

            // ✨ SE FOR ADMIN AUTENTICADO, ABRE O COFRE E DEVOLVE O HTML
            if (user) {
                if (typeof unlockAdminVault === 'function') unlockAdminVault();
            } else {
                // ✨ SE DESLOGAR, TRANCA O HTML NA MEMÓRIA NOVAMENTE
                if (typeof lockAdminVault === 'function') lockAdminVault();
            }

            // ✨ PASSO 2: Controle de visibilidade do botão na Sidebar
            if (els.menuBtnAdmin) {
                if (state.user) {
                    els.menuBtnAdmin.classList.remove('hidden');
                    els.menuBtnAdmin.innerHTML = `
                        <i class="fas fa-user-shield text-white group-hover:text-white transition"></i>
                        <span class="font-bold uppercase text-sm tracking-wide">Painel Admin</span>
                    `;
                } else {
                    els.menuBtnAdmin.classList.add('hidden');
                }
            }

            // Controle do botão de login na Navbar (se existir)
            const btnLoginNav = getEl('btn-admin-login');
            if (btnLoginNav) {
                if (state.user) {
                    btnLoginNav.classList.remove('hidden');
                    btnLoginNav.innerText = 'Painel Admin';
                } else {
                    btnLoginNav.classList.add('hidden');
                }
            }

            // --- DECISÃO DE TELA E RADAR ---
            if (state.user) {
                // Já logou, limpa a URL e fecha o modal
                sessionStorage.removeItem('wantsAdmin');
                if (typeof fecharModalLogin === 'function') fecharModalLogin();

                if (typeof showView === 'function') showView('admin');
                if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
            } else {
                // É um cliente deslogado
                if (typeof showView === 'function') showView('catalog');

                // Abertura do Modal de Senha (Gatilho da URL)
                if (sessionStorage.getItem('wantsAdmin') === 'true') {
                    sessionStorage.removeItem('wantsAdmin');

                    setTimeout(() => {
                        const loginModal = document.getElementById('login-modal');
                        if (loginModal) {
                            loginModal.classList.remove('hidden');
                            loginModal.style.display = '';
                            loginModal.style.zIndex = '999999';
                            try {
                                if (!loginModal.open) loginModal.showModal();
                            } catch (e) {
                                loginModal.setAttribute('open', 'true');
                            }
                        }
                    }, 500);
                }
            }
            setTimeout(() => { if (window.checkFooter) window.checkFooter(); }, 100);
        });

        // --- 5. TIMERS E EXTRAS (DO SEU CÓDIGO ANTIGO) ---
        setInterval(() => {
            if (state.coupons.length > 0 && !getEl('view-admin').classList.contains('hidden')) {
                renderAdminCoupons();
            }
        }, 10000);

        // Verifica Pedidos Ativos (Motoquinha) - Isolado por loja!
        const savedHistory = localStorage.getItem(`orders_${state.siteId}`);
        if (savedHistory) {
            state.myOrders = JSON.parse(savedHistory);
        }
        checkActiveOrders();

        return true; // Libera o startApplication

    } catch (error) {
        console.error("Erro fatal:", error);
        exibirTelaMorte("Erro", "Falha no carregamento.");
        return false;
    }
}

/// ============================================================
// FUNÇÃO AUXILIAR ÚNICA: TELA DE MORTE / PAUSA
// ============================================================
function exibirTelaMorte(titulo, msg, tipo = 'erro') {
    console.error(`[KILL SCREEN] ${titulo}: ${msg}`);

    // 1. Limpa e Prepara o Body
    document.body.innerHTML = '';

    // Reseta margens e fundo do body para o layout preencher tudo
    document.body.style.cssText = `display: block !important; background-color: #0B0E14; min-height: 100vh; margin: 0; padding: 0;`;

    // 2. Define o Design com base no Tipo
    let iconHtml = '<i class="fas fa-ban"></i>';
    let mainColor = '#ef4444'; // Vermelho Agressivo (Bloqueio)
    let bgStyle = 'background: radial-gradient(circle at top, #2a0808 0%, #0B0E14 100%);';

    if (tipo === 'pausado') {
        iconHtml = '<i class="fas fa-cog fa-spin"></i>'; // Ícone Manutenção
        mainColor = '#facc15'; // Amarelo Suave
        bgStyle = 'background: radial-gradient(circle at top, #2a2208 0%, #0B0E14 100%);';
    }

    // 3. Define o HTML Dinâmico (Com o novo design premium e cards)
    document.body.innerHTML = `
        <style>
            .lock-wrapper { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: 'Segoe UI', system-ui, sans-serif; padding: 20px; box-sizing: border-box; ${bgStyle} }
            .lock-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 24px; padding: 40px 30px; text-align: center; width: 100%; max-width: 450px; backdrop-filter: blur(10px); box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); margin-bottom: 25px; }
            .promo-card { background: linear-gradient(145deg, rgba(37, 99, 235, 0.1), rgba(147, 51, 234, 0.05)); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 24px; padding: 25px; text-align: center; width: 100%; max-width: 450px; box-shadow: 0 0 30px rgba(37, 99, 235, 0.1); position: relative; overflow: hidden; }
            .promo-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899); }
            .promo-img { width: 100%; height: 160px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); background-color: #161821; }
            .btn-reload { padding: 12px 35px; border: none; border-radius: 10px; font-weight: 800; cursor: pointer; font-size: 1rem; transition: transform 0.2s, opacity 0.2s; text-transform: uppercase; letter-spacing: 1px; margin-top: 10px; }
            .btn-reload:hover { transform: scale(1.05); opacity: 0.9; }
            .social-links { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 20px; }
            .social-btn { flex: 1; min-width: 140px; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 12px; text-decoration: none; font-weight: bold; font-size: 0.85rem; transition: all 0.2s; text-transform: uppercase; }
            .btn-site { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
            .btn-site:hover { background: rgba(59, 130, 246, 0.4); color: #fff; transform: translateY(-2px); }
            .btn-insta { background: rgba(236, 72, 153, 0.2); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); }
            .btn-insta:hover { background: rgba(236, 72, 153, 0.4); color: #fff; transform: translateY(-2px); }
        </style>

        <div class="lock-wrapper">
            
            <!-- ⛔ CARTÃO DE AVISO (BLOQUEIO/PAUSA) -->
            <div class="lock-card">
                <div style="font-size: 4rem; margin-bottom: 15px; color: ${mainColor}; text-shadow: 0 0 30px ${mainColor}60;">${iconHtml}</div>
                <h1 style="font-size: 1.8rem; color: white; margin: 0 0 10px 0; font-weight: 900; letter-spacing: -0.5px;">${titulo}</h1>
                <p style="color: #94a3b8; margin: 0 0 25px 0; font-size: 1rem; line-height: 1.5;">${msg}</p>
                <button class="btn-reload" onclick="window.location.reload()" style="background: ${mainColor}; color: ${tipo === 'pausado' ? '#000' : '#fff'};">
                    Atualizar Página
                </button>
            </div>

            <!-- 🚀 CARTÃO DE PROPAGANDA (CAPTAÇÃO DE LEADS) -->
            <div class="promo-card">
                <!-- 🖼️ INSIRA O LINK DA SUA IMAGEM DE PROPAGANDA AQUI 👇 -->
                <img src="tudoCentral.png" alt="Crie sua Loja Virtual" class="promo-img">
                
                <h2 style="color: #fff; font-size: 1.3rem; margin: 0 0 8px 0; font-weight: 800;">Tenha o SEU E-Commerce, sua loja automática e profissional</h2>
                <p style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5; margin: 0;">
                    Tenha um catálogo online completo como este. Venda pelo WhatsApp, gerencie seus pedidos e escale o seu negócio com a Projetista Oficial.
                </p>
                
                <div class="social-links">
                    <!-- 🌐 INSIRA O LINK DA SUA LANDING PAGE AQUI 👇 -->
                    <a href="https://projetistaoficial.com" target="_blank" class="social-btn btn-site">
                        <i class="fas fa-rocket text-lg"></i> Criar Minha Loja em 5 minutos
                    </a>
                    
                    <!-- 📸 LINK DO INSTAGRAM -->
                    <a href="https://instagram.com/projetista_oficial" target="_blank" class="social-btn btn-insta">
                        <i class="fab fa-instagram text-lg"></i> Instagram
                    </a>
                </div>
            </div>

        </div>
    `;

    // 4. Força a visibilidade
    document.body.style.opacity = "1";
    document.body.style.pointerEvents = "auto";
    // Essa classe "loaded" desativa as blindagens de CSS que escondiam o site!
    document.body.classList.add('acesso-liberado', 'loaded');

    // 5. Garante Fonte de Ícones (Para o Insta funcionar mesmo sem carregar o resto)
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(link);
    }
}
window.renderKillScreen = exibirTelaMorte;



// =================================================================
// 4. LÓGICA DE DADOS (CARREGAMENTO)
// =================================================================
function setupAuthListener() {
    // Monitora se o usuário é Admin ou Visitante
    onAuthStateChanged(auth, (user) => {
        state.user = user; // Salva no estado global

        // Atualiza o botão do Menu (Login vs Painel)
        const btnLogin = document.getElementById('menu-btn-admin');
        const btnLoginModal = document.getElementById('btn-admin-login');

        const texto = user ? 'Painel Admin' : 'Área Admin';

        if (btnLogin) {
            btnLogin.innerHTML = `<i class="fas fa-user-shield"></i> <span class="ml-2">${texto}</span>`;
        }
        if (btnLoginModal) {
            btnLoginModal.innerText = texto;
        }

        // Se for admin, libera funcionalidades extras
        if (user) {
            console.log("👑 Usuário Admin detectado.");
            if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
            if (typeof loadAdminSales === 'function') loadAdminSales();
        } else {
            // Se não for admin, garante que está na vitrine
            if (typeof showView === 'function') showView('catalog');
        }
    })
}

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

// Variável global para evitar que o ouvinte seja duplicado sem querer
let unsubscribeProducts = null;

async function loadProducts() {
    const cacheKey = `prods_${state.siteId}`;

    // 1. CARGA IMEDIATA (Zero delay visual)
    const cached = getCachedData(cacheKey, 60); // Mantemos no cache por 60 min
    if (cached && state.products.length === 0) {
        state.products = cached;
        renderCatalog(state.products);
        if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
    }

    // 2. OUVINTE INTELIGENTE (Real-time Econômico)
    if (unsubscribeProducts) unsubscribeProducts(); // Previne duplicidade

    const q = query(collection(db, `sites/${state.siteId}/products`));

    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        let hasChanges = false;

        snapshot.docChanges().forEach((change) => {
            hasChanges = true;
            const prodData = { id: change.doc.id, ...change.doc.data() };

            if (change.type === 'added') {
                const idx = state.products.findIndex(p => p.id === prodData.id);
                if (idx === -1) state.products.push(prodData);
                else state.products[idx] = prodData;
            }
            if (change.type === 'modified') {
                const idx = state.products.findIndex(p => p.id === prodData.id);
                if (idx !== -1) state.products[idx] = prodData;
            }
            if (change.type === 'removed') {
                state.products = state.products.filter(p => p.id !== prodData.id);
            }
        });

        if (hasChanges) {
            setCachedData(cacheKey, state.products, 60);
            renderCatalog(state.products);

            if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();

            if (document.getElementById('admin-product-list')) {
                if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
            }

            // ✨ A SOLUÇÃO: Toda vez que um produto for salvo, adicionado ou vendido,
            // forçamos o cálculo do Capital de Giro para atualizar a tela na mesma hora!
            if (typeof calculateStatsMetrics === 'function') calculateStatsMetrics();
        }
    });
}


// --- FUNÇÃO AUXILIAR DE CACHE ---
const getCachedData = (key, minutes = 30) => {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const data = JSON.parse(cached);
    const now = new Date().getTime();
    // Se o tempo atual for menor que o tempo de expiração, retorna o dado
    if (now < data.expiry) return data.value;
    return null;
};

const setCachedData = (key, value, minutes = 30) => {
    const now = new Date().getTime();
    const item = {
        value: value,
        expiry: now + (minutes * 60 * 1000)
    };

    try {
        // Tenta salvar no cache do navegador
        localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
        // Se o cache encher (geralmente por causa do peso das imagens Base64), 
        // ele ignora o erro pacificamente para não travar o site do cliente.
        console.warn(`⚠️ Cache ignorado para '${key}': Limite de 5MB do navegador atingido.`);

        // Remove a chave para não deixar lixo corrompido na memória
        try { localStorage.removeItem(key); } catch (e) { }
    }
};

// --- CARREGAMENTO DE CATEGORIAS COM ECONOMIA ---
async function loadCategories() {
    const cacheKey = `cats_${state.siteId}`;
    const cached = getCachedData(cacheKey);

    if (cached) {
        console.log("📦 Categorias carregadas do Cache");
        state.categories = cached;
        renderCategories();
        return;
    }

    // Se não tem cache, faz a leitura ÚNICA (getDocs em vez de onSnapshot)
    console.log("🔥 Lendo Categorias do Firebase (Gasto: 1 leitura por cat)");
    const q = query(collection(db, `sites/${state.siteId}/categories`));
    const snap = await getDocs(q);
    const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    state.categories = cats;
    setCachedData(cacheKey, cats);
    renderCategories();
}

// ✨ NOVA FUNÇÃO: Move a categoria para cima ou para baixo
window.moveCategory = async (id, fullPath, direction) => {
    // 1. Descobre quem é o "Pai" desta categoria para mexer apenas nas irmãs dela
    const parts = fullPath.split(' - ');
    parts.pop();
    const parentPath = parts.length > 0 ? parts.join(' - ') : null;

    // 2. Filtra as categorias que estão no mesmo nível (mesmo pai)
    const siblings = state.categories.filter(c => {
        const cParts = c.name.split(' - ');
        cParts.pop();
        const cParentPath = cParts.length > 0 ? cParts.join(' - ') : null;
        return cParentPath === parentPath;
    });

    // 🔥 A CORREÇÃO RIGOROSA: Ordena o array antes de descobrir o índice!
    // Isto sincroniza o código de forma milimétrica com o que está a ver no ecrã.
    siblings.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
    });

    // 3. Agora sim, acha a posição atual correta com base na ordem visual
    const currentIndex = siblings.findIndex(s => s.id === id);
    if (currentIndex === -1) return;

    // 4. Calcula a nova posição de destino
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= siblings.length) return; // Trava se bater no teto ou no chão

    // 5. Troca as duas de lugar no array ordenado
    const temp = siblings[currentIndex];
    siblings[currentIndex] = siblings[targetIndex];
    siblings[targetIndex] = temp;

    // 6. Salva a nova sequência no Firebase redistribuindo os pesos de 10 em 10
    try {
        const promises = siblings.map((sib, index) => {
            return updateDoc(doc(db, `sites/${state.siteId}/categories`, sib.id), { order: index * 10 });
        });
        await Promise.all(promises);

        // Limpa o cache e recarrega a tela instantaneamente com os dados novos
        localStorage.removeItem(`cats_${state.siteId}`);
        await loadCategories();
        renderAdminCategoryList();
        showToast("Ordem atualizada!");

    } catch (e) {
        console.error("Erro ao reordenar:", e);
        showToast("Erro ao reordenar categoria.", "error");
    }
};

function loadCoupons() {
    const q = query(collection(db, `sites/${state.siteId}/coupons`));
    onSnapshot(q, (snapshot) => {
        state.coupons = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Renderiza a lista no Admin
        const viewAdmin = document.getElementById('view-admin');
        if (viewAdmin && !viewAdmin.classList.contains('hidden')) {
            renderAdminCoupons();
        }

        // ✨ O GATILHO DO ADMIN: Fiscaliza e rotaciona se o oferecido expirou
        if (state.user && typeof checkAndRotateExpiredOfferedCoupon === 'function') {
            checkAndRotateExpiredOfferedCoupon();
        }

        // Exibe o cupom na vitrine para o cliente (se ele não for admin)
        if (!state.user && typeof showOfferedCoupon === 'function') {
            showOfferedCoupon();
        }
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

        if (typeof updateStatsData === 'function') {
            updateStatsData(state.orders, state.products, state.dailyStats);
        }
    }, (error) => {
        // Trata o bloqueio silenciosamente
        console.log("🔒 Coleção de Vendas trancada aguardando senha.");
    }); // Fim do onSnapshot das vendas // Fim do onSnapshot das vendas

    // ✨ GATILHO RESTRITO: Só liga o radar se houver um usuário admin confirmado ✨
    if (state.user && typeof loadAvisos === 'function') {
        loadAvisos();
    }
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
    const q = query(collection(db, `sites/${state.siteId}/dailyStats`));

    onSnapshot(q, (snapshot) => {
        const dailyData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        state.dailyStats = dailyData; // Salva no estado global

        // Atualiza o módulo de estatísticas externo (se existir)
        if (typeof updateStatsData === 'function') {
            updateStatsData(state.orders, state.products, state.dailyStats);
        }

        // ✨ CORREÇÃO: Força a atualização da tela imediatamente quando o Firebase responde!
        if (typeof calculateStatsMetrics === 'function') {
            calculateStatsMetrics();
        }
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

// =================================================================
// 6. RENDERIZADORES DE CATÁLOGO E ADMIN (MANTIDOS)
// =================================================================

function renderCatalog(productsToRender) {
    if (!els.grid) return;
    els.grid.innerHTML = '';

    let filtered = [...productsToRender].filter(p => p.active !== false);
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

    const sortMode = (document.getElementById('sort-filter')?.value || 'vitrine').toLowerCase();

    // ✨ ARMADURA: Garante que o valor do estoque e do preço sempre sejam números válidos
    const getSafeStock = (val) => isNaN(parseInt(val)) ? 0 : parseInt(val);
    const getSafePrice = (p) => {
        let promo = parseFloat(p.promoPrice);
        let normal = parseFloat(p.price);
        if (!isNaN(promo) && promo > 0) return promo; // Se tem promoção válida, usa ela
        if (!isNaN(normal) && normal > 0) return normal; // Senão, usa o normal
        return 0; // Se tudo falhar, é 0
    };

    filtered.sort((a, b) => {
        const stockA = getSafeStock(a.stock);
        const stockB = getSafeStock(b.stock);

        const isSoldOutA = stockA <= 0 && (!state.globalSettings.allowNoStock && !a.allowNoStock);
        const isSoldOutB = stockB <= 0 && (!state.globalSettings.allowNoStock && !b.allowNoStock);

        // Itens esgotados sempre vão pro final
        if (isSoldOutA && !isSoldOutB) return 1;
        if (!isSoldOutA && isSoldOutB) return -1;

        const priceA = getSafePrice(a);
        const priceB = getSafePrice(b);
        const nameA = (a.name || '').trim().toLowerCase();
        const nameB = (b.name || '').trim().toLowerCase();

        // 🔍 LÓGICA UNIVERSAL: Busca por "pedaços" do value do seu HTML
        if (sortMode.includes('menor') || sortMode.includes('asc') && sortMode.includes('price')) {
            return priceA - priceB;
        }
        
        if (sortMode.includes('maior') || sortMode.includes('desc') && sortMode.includes('price')) {
            return priceB - priceA;
        }
        
        if (sortMode.includes('nome') || sortMode.includes('name') || sortMode.includes('alfabetica')) {
            return nameA.localeCompare(nameB);
        }
        
        if (sortMode.includes('lancamento') || sortMode.includes('new') || sortMode.includes('date')) {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : parseInt(a.code) || 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : parseInt(b.code) || 0;
            return dateB - dateA;
        }

        // Padrão: Vitrine
        const orderA = a.order !== undefined && a.order !== null ? parseFloat(a.order) : 999999;
        const orderB = b.order !== undefined && b.order !== null ? parseFloat(b.order) : 999999;
        if (orderA !== orderB) return orderA - orderB;

        const isHighlightA = a.highlight === true ? 1 : 0;
        const isHighlightB = b.highlight === true ? 1 : 0;
        if (isHighlightA !== isHighlightB) return isHighlightB - isHighlightA;

        const hasPromoA = (parseFloat(a.promoPrice) > 0) ? 1 : 0;
        const hasPromoB = (parseFloat(b.promoPrice) > 0) ? 1 : 0;
        if (hasPromoA !== hasPromoB) return hasPromoB - hasPromoA;

        return (parseInt(b.code) || 0) - (parseInt(a.code) || 0);
    });

    if (filtered.length === 0) {
        els.grid.innerHTML = `<div class="col-span-2 md:col-span-4 text-center py-10 opacity-50"><i class="fas fa-search text-4xl mb-2"></i><p>Nenhum produto encontrado.</p></div>`;
        return;
    }

    const pixGlobal = state.storeProfile.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };
    const globalInst = state.storeProfile.installments || { active: false, max: 12, freeUntil: 3 };

    filtered.forEach(p => {
        const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
        const currentStock = getSafeStock(p.stock);
        const isOut = currentStock <= 0 && !allowNegative;
        const currentPrice = parseFloat(p.promoPrice || p.price);

        let pixHtml = '';
        if (!pixGlobal.disableAll) {
            if (pixGlobal.active && pixGlobal.value > 0) {
                const isFixed = (pixGlobal.type === 'fixed');
                const labelOff = isFixed ? `R$ ${formatCurrency(pixGlobal.value)} OFF` : `${pixGlobal.value}% OFF`;

                if (pixGlobal.mode === 'total') {
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-tag mr-1"></i>${labelOff} no Pix (Total)</p>`;
                } else {
                    let valDesconto = isFixed ? pixGlobal.value : currentPrice * (pixGlobal.value / 100);
                    const finalPix = Math.max(0, currentPrice - valDesconto);
                    pixHtml = `<p class="text-green-500 text-[10px] font-bold mt-1"><i class="fas fa-bolt mr-1"></i>${formatCurrency(finalPix)} no Pix</p>`;
                }
            } else if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
                const pix = p.paymentOptions.pix;
                let finalPix = currentPrice;
                if (pix.type === 'percent') finalPix = currentPrice * (1 - (pix.val / 100));
                else finalPix = Math.max(0, currentPrice - pix.val);
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
            `<div class="flex flex-col">
                <span class="text-gray-500 line-through text-[10px]">${formatCurrency(p.price)}</span>
                <span class="text-[var(--txt-price)] font-bold text-base">${formatCurrency(p.promoPrice)}</span>
             </div>` :
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


// =======================================================================================================================//=======================================================================================================================


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

    const openDetailsIds = new Set();
    els.catListAdmin.querySelectorAll('details[open]').forEach(el => {
        if (el.dataset.catId) openDetailsIds.add(el.dataset.catId);
    });

    els.catListAdmin.innerHTML = '';
    const catMap = {};
    state.categories.forEach(c => catMap[c.name] = c.id);

    const getProductCount = (catName) => {
        if (!state.products) return 0;
        return state.products.filter(p => {
            if (!p.category) return false;
            return p.category === catName || p.category.startsWith(catName + ' - ');
        }).length;
    };

    const tree = {};
    // Pega a lista do state que já está ordenada por 'order'
    state.categories.forEach(c => {
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

    const getOrder = (path) => {
        const cat = state.categories.find(c => c.name === path);
        return cat && cat.order !== undefined ? cat.order : 999;
    };

    const buildHtml = (node, level = 0) => {
        let html = '';
        // ✨ Ordena também na renderização do Admin
        const keys = Object.keys(node).sort((a, b) => {
            const orderA = getOrder(node[a]._path);
            const orderB = getOrder(node[b]._path);
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b);
        });

        keys.forEach((key, index) => {
            const item = node[key];
            const childrenKeys = Object.keys(item._children);
            const hasChildren = childrenKeys.length > 0;
            const fullPath = item._path;
            const id = catMap[fullPath];

            const prodCount = getProductCount(fullPath);
            const subCatCount = childrenKeys.length;

            let statsText = `${prodCount} produto(s)`;
            if (subCatCount > 0) statsText += ` • ${subCatCount} subcategoria(s)`;

            const isMain = level === 0;
            const isSelected = state.selectedCategoryParent === fullPath;
            const selectBorder = isSelected ? 'border-yellow-500' : 'border-gray-700';
            const isOpenAttr = openDetailsIds.has(id) ? 'open' : '';
            const bgClass = isMain ? 'bg-[#1f2937] mb-2' : 'bg-black/30 mt-1 ml-4 border-l-2 border-gray-700';

            // Verifica se é o primeiro ou último para ocultar as setas desnecessárias
            const isFirst = index === 0;
            const isLast = index === keys.length - 1;

            const rowContent = `
                <div class="flex items-center justify-between p-3 rounded hover:bg-white/5 transition cursor-pointer group min-h-[60px]">
                    <div class="flex flex-col justify-center flex-1" onclick="selectParentCategory('${id}', '${fullPath}', event)">
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
                             </div>` : ''}

                        <div class="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pl-2 border-l border-gray-700">
                            
                            <button type="button" onclick="event.stopPropagation(); moveCategory('${id}', '${fullPath}', -1)" 
                                    class="w-6 h-8 rounded bg-gray-800 text-gray-400 hover:bg-gray-600 hover:text-white flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed" 
                                    title="Mover para Cima" ${isFirst ? 'disabled' : ''}>
                                <i class="fas fa-arrow-up text-[10px]"></i>
                            </button>
                            <button type="button" onclick="event.stopPropagation(); moveCategory('${id}', '${fullPath}', 1)" 
                                    class="w-6 h-8 rounded bg-gray-800 text-gray-400 hover:bg-gray-600 hover:text-white flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed mr-1" 
                                    title="Mover para Baixo" ${isLast ? 'disabled' : ''}>
                                <i class="fas fa-arrow-down text-[10px]"></i>
                            </button>

                            <button type="button" onclick="event.stopPropagation(); renameCategory('${id}', '${fullPath}')" 
                                    class="w-8 h-8 rounded-full bg-blue-900/30 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition" title="Editar Nome">
                                <i class="fas fa-pen text-xs"></i>
                            </button>

                            <button type="button" onclick="event.stopPropagation(); deleteCategory('${id}', '${fullPath}')" 
                                    class="w-8 h-8 rounded-full bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white flex items-center justify-center transition" title="Excluir Categoria">
                                <i class="fas fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (hasChildren) {
                html += `
                    <details class="rounded border ${selectBorder} ${bgClass} overflow-hidden group transition-all duration-300" ${isOpenAttr} data-cat-id="${id}">
                        <summary class="list-none select-none outline-none">${rowContent}</summary>
                        <div class="pb-2 pr-2 border-t border-gray-700/50 animate-fade-in">${buildHtml(item._children, level + 1)}</div>
                    </details>
                `;
            } else {
                html += `<div class="rounded border ${selectBorder} ${bgClass}">${rowContent}</div>`;
            }
        });
        return html;
    };

    els.catListAdmin.innerHTML = buildHtml(tree);
}

window.renameCategory = async (id, oldFullName) => {
    const newNameShort = prompt("Novo nome para a categoria:", oldFullName.split(' - ').pop());

    if (!newNameShort || newNameShort.trim() === "") return;

    const parts = oldFullName.split(' - ');
    parts.pop();
    parts.push(newNameShort.trim());
    const newFullName = parts.join(' - ');

    if (newFullName === oldFullName) return;

    if (!confirm(`Renomear "${oldFullName}" para "${newFullName}"?\nIsso atualizará produtos e subcategorias vinculados.`)) return;

    try {
        await updateDoc(doc(db, `sites/${state.siteId}/categories`, id), { name: newFullName });

        const productsToUpdate = state.products.filter(p => p.category === oldFullName || p.category.startsWith(oldFullName + ' - '));
        const catsToUpdate = state.categories.filter(c => c.id !== id && c.name.startsWith(oldFullName + ' - '));

        const batchPromises = [];

        productsToUpdate.forEach(p => {
            const newCatName = p.category.replace(oldFullName, newFullName);
            batchPromises.push(updateDoc(doc(db, `sites/${state.siteId}/products`, p.id), { category: newCatName }));
        });

        catsToUpdate.forEach(c => {
            const newCatName = c.name.replace(oldFullName, newFullName);
            batchPromises.push(updateDoc(doc(db, `sites/${state.siteId}/categories`, c.id), { name: newCatName }));
        });

        await Promise.all(batchPromises);

        if (state.selectedCategoryParent === oldFullName) {
            state.selectedCategoryParent = null;
        }

        // ✨ CORREÇÃO: Limpa o cache e recarrega a tela instantaneamente
        localStorage.removeItem(`cats_${state.siteId}`);
        await loadCategories();
        renderAdminCategoryList();

        showToast(`Categoria renomeada! (${batchPromises.length} vínculos atualizados)`);

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
    updateProductCountsUI();
    let filtered = getCurrentFilteredProducts();

    const metricsMap = {};
    const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];

    if (state.orders) {
        state.orders.forEach(order => {
            if (validStatuses.includes(order.status)) {
                const orderDate = new Date(order.date);
                order.items.forEach(item => {
                    if (!metricsMap[item.id]) metricsMap[item.id] = { qtd: 0, lastDate: 0 };
                    metricsMap[item.id].qtd += (parseInt(item.qty) || 0);
                    if (orderDate.getTime() > metricsMap[item.id].lastDate) {
                        metricsMap[item.id].lastDate = orderDate.getTime();
                    }
                });
            }
        });
    }

    if (state.isReorderMode) {
        // MODO REORGANIZAR: Ordem manual é a lei suprema!
        filtered.sort((a, b) => {
            const orderA = a.order !== undefined && a.order !== null ? parseFloat(a.order) : 999999;
            const orderB = b.order !== undefined && b.order !== null ? parseFloat(b.order) : 999999;

            if (orderA !== orderB) return orderA - orderB;

            const isHighlightA = a.highlight === true ? 1 : 0;
            const isHighlightB = b.highlight === true ? 1 : 0;
            if (isHighlightA !== isHighlightB) return isHighlightB - isHighlightA;

            const hasPromoA = (parseFloat(a.promoPrice) > 0) ? 1 : 0;
            const hasPromoB = (parseFloat(b.promoPrice) > 0) ? 1 : 0;
            if (hasPromoA !== hasPromoB) return hasPromoB - hasPromoA;

            return (parseInt(b.code) || 0) - (parseInt(a.code) || 0);
        });
    } else {
        // MODO NORMAL (Ordena pelo clique nas colunas: Cód, Produto, Valor...)
        const { key, direction } = state.sortConfig;

        filtered.sort((a, b) => {
            let valA, valB;

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
                case 'sales':
                    valA = metricsMap[a.id]?.qtd || 0;
                    valB = metricsMap[b.id]?.qtd || 0;
                    break;
                case 'lastmov':
                    valA = metricsMap[a.id]?.lastDate || 0;
                    valB = metricsMap[b.id]?.lastDate || 0;
                    break;
                default: return 0;
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    renderProductsList(filtered, metricsMap);
}

// --- LÓGICA DE ORDENAÇÃO E FILTRAGEM ---
function getCurrentFilteredProducts() {
    const searchInput = els.adminSearchProd || getEl('admin-search-prod');
    const categoryInput = els.adminFilterCat || getEl('admin-filter-cat');
    const statusInput = getEl('admin-filter-status'); // <--- NOVO FILTRO

    const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const catFilter = categoryInput ? categoryInput.value : '';
    const statusFilter = statusInput ? statusInput.value : ''; // <--- NOVO VALOR

    return state.products.filter(p => {
        const codeStr = p.code ? String(p.code) : '';
        const matchText = p.name.toLowerCase().includes(term) || codeStr.includes(term);
        const matchCat = catFilter ? p.category === catFilter : true;

        // NOVO: Lógica do filtro de Status
        let matchStatus = true;
        if (statusFilter === 'true') matchStatus = p.active !== false; // Ativos
        if (statusFilter === 'false') matchStatus = p.active === false; // Inativos

        return matchText && matchCat && matchStatus;
    });
}

function updateProductCountsUI() {
    const total = state.products.length;

    // Conta quantos têm a tag de inativo
    const inativos = state.products.filter(p => p.active === false).length;
    const ativos = total - inativos;

    // Atualiza o Topo
    const elTotal = document.getElementById('total-produtos-count');
    if (elTotal) elTotal.innerText = total;

    // Atualiza os textos de dentro do Dropdown de Status
    const optTodos = document.getElementById('opt-status-todos');
    if (optTodos) optTodos.innerText = `Todos (${total})`;

    const optAtivos = document.getElementById('opt-status-ativos');
    if (optAtivos) optAtivos.innerText = `Ativos (${ativos})`;

    const optInativos = document.getElementById('opt-status-inativos');
    if (optInativos) optInativos.innerText = `Inativos (${inativos})`;
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

    const oldBar = document.getElementById('bulk-actions-bar');
    if (oldBar) {
        oldBar.classList.add('hidden');
        oldBar.style.display = 'none';
    }

    listEl.innerHTML = '';

    // --- 1. BARRA DE CONTROLES NOVA ---
    const controlsBar = document.createElement('div');
    controlsBar.className = "flex flex-wrap justify-between items-center mb-2 px-1 gap-2 min-h-[40px] w-full";

    const selectBtnText = state.isSelectionMode ? '<i class="fas fa-times mr-2"></i> Cancelar' : '<i class="fas fa-check-square mr-2"></i> Selecionar';
    const selectBtnClass = state.isSelectionMode ? "text-red-400 hover:text-red-300 text-xs font-bold uppercase cursor-pointer py-2 px-2 bg-red-900/20 rounded border border-red-900/50" : "text-yellow-500 hover:text-yellow-400 text-xs font-bold uppercase cursor-pointer py-2 px-2 hover:bg-yellow-900/20 rounded transition";

    let bulkActionsHTML = '';
    if (state.isSelectionMode && state.selectedProducts.size > 0) {
        bulkActionsHTML = `
            <div class="flex items-center gap-2 animate-fade-in bg-[#151720] border border-gray-700 rounded p-1 shadow-lg flex-1 justify-end overflow-x-auto custom-scrollbar">
                <span class="text-white text-[10px] font-bold bg-blue-600 px-2 py-1 rounded ml-1 whitespace-nowrap shrink-0">${state.selectedProducts.size} <span class="hidden sm:inline">item(s)</span></span>
                
                <button onclick="bulkChangeProductStatus(true)" class="bg-green-600 hover:bg-green-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition flex items-center gap-1 shrink-0" title="Ativar">
                    <i class="fas fa-eye"></i> <span class="hidden sm:inline">Ativar</span>
                </button>
                <button onclick="bulkChangeProductStatus(false)" class="bg-orange-600 hover:bg-orange-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition flex items-center gap-1 shrink-0" title="Inativar">
                    <i class="fas fa-eye-slash"></i> <span class="hidden sm:inline">Inativar</span>
                </button>
                
                <div class="w-px bg-gray-600 h-4 mx-1 shrink-0"></div>

                <select id="bulk-category-select-dynamic" class="bg-black text-white text-[10px] border border-gray-600 rounded px-1 h-7 outline-none w-24 sm:w-auto shrink-0">
                    <option value="">Mover...</option>${state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
                
                <button onclick="bulkMoveDynamic()" class="bg-blue-600 hover:bg-blue-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition flex items-center gap-1 shrink-0">
                    <i class="fas fa-exchange-alt sm:hidden"></i> <span class="hidden sm:inline">Mover</span>
                </button>
                
                <div class="w-px bg-gray-600 h-4 mx-1 shrink-0"></div>
                
                <button onclick="document.getElementById('btn-bulk-delete').click()" class="bg-red-600 hover:bg-red-500 text-white px-2 sm:px-3 h-7 rounded text-[10px] uppercase font-bold transition flex items-center gap-1 shrink-0">
                    <i class="fas fa-trash-alt sm:hidden"></i> <span class="hidden sm:inline">Excluir</span>
                </button>
            </div>
        `;
    }

    if (state.isReorderMode) {
        controlsBar.innerHTML = `
            <div class="flex w-full justify-between items-center bg-blue-900/20 border border-blue-500/50 p-2 rounded-lg animate-fade-in shadow-sm">
                <span class="text-blue-400 font-bold text-xs uppercase tracking-wider"><i class="fas fa-arrows-alt-v mr-1"></i> Arraste para Reordenar</span>
                <div class="flex gap-2">
                    <button onclick="resetReorderToDefault()" class="bg-gray-800 hover:bg-gray-700 text-white px-3 h-8 rounded text-xs font-bold transition flex items-center gap-2"><i class="fas fa-magic"></i> Padrão</button>
                    <button onclick="cancelReorder()" class="bg-red-900/50 hover:bg-red-600 text-red-400 hover:text-white px-3 h-8 rounded text-xs font-bold transition">Cancelar</button>
                    <button onclick="saveReorder()" class="bg-green-600 hover:bg-green-500 text-white px-4 h-8 rounded text-xs font-bold transition flex items-center gap-2 shadow-lg"><i class="fas fa-save"></i> Salvar</button>
                </div>
            </div>
        `;
    } else {
        controlsBar.innerHTML = `
            <div class="flex gap-2 shrink-0">
                <button onclick="toggleSelectionMode()" class="${selectBtnClass}">${selectBtnText}</button>
                <button onclick="startReorderMode()" class="text-yellow-500 px-3 py-2 rounded text-xs font-bold uppercase transition flex items-center gap-2"><i class="fas fa-sort-amount-down"></i> Reorganizar</button>
            </div>
            ${bulkActionsHTML}
        `;
    }

    listEl.appendChild(controlsBar);

    if (products.length === 0) {
        listEl.innerHTML += '<p class="text-center text-gray-500 py-12 italic border border-gray-800 rounded-xl bg-[#0f111a]">Nenhum produto encontrado.</p>';
        return;
    }

    // --- 2. HEADER ---
    const allSelected = products.length > 0 && products.every(p => state.selectedProducts.has(p.id));
    const masterCheckAttr = allSelected ? 'checked' : '';
    const getSortIcon = (key) => state.sortConfig.key !== key ? '<i class="fas fa-sort text-gray-700 ml-1 opacity-30"></i>' : (state.sortConfig.direction === 'asc' ? '<i class="fas fa-sort-up text-yellow-500 ml-1 mt-1"></i>' : '<i class="fas fa-sort-down text-yellow-500 ml-1 -mt-1"></i>');

    const checkColContent = state.isSelectionMode ? `<input type="checkbox" onchange="toggleSelectAll(this)" ${masterCheckAttr} class="cursor-pointer rounded border-gray-600 bg-gray-800 text-yellow-500 focus:ring-0 w-4 h-4" title="Selecionar Todos">` : ``;

    const headerHTML = `
        <div class="hidden md:grid grid-cols-12 gap-2 bg-[#1f1f1f] text-gray-400 font-bold p-3 rounded-t-xl text-[10px] uppercase tracking-wider border-b border-gray-800 sticky top-0 z-20 select-none items-center shadow-lg">
            ${state.isReorderMode ? `
                <div class="col-span-2 text-center border-r border-gray-700 text-yellow-500">Mover / Nº</div>
            ` : `
                <div class="${state.isSelectionMode ? 'col-span-1 block' : 'hidden'} text-center flex items-center justify-center">${checkColContent}</div>
                <div class="${state.isSelectionMode ? 'col-span-1' : 'col-span-1'} text-center border-r border-gray-700 cursor-pointer hover:text-white flex items-center justify-left h-full" onclick="sortProducts('code')">Cód ${getSortIcon('code')}</div>
            `}
            <div class="col-span-5 pl-2 cursor-pointer hover:text-white flex items-center" onclick="sortProducts('product')">Produto ${getSortIcon('product')}</div>
            <div class="col-span-2 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('lastmov')">Última Mov. ${getSortIcon('lastmov')}</div>
            <div class="col-span-1 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('sales')">Qtd Vendidas ${getSortIcon('sales')}</div>
            <div class="col-span-1 text-center cursor-pointer hover:text-white flex items-center justify-center" onclick="sortProducts('stock')">Estoque ${getSortIcon('stock')}</div>
            <div class="col-span-1 text-right pr-4 cursor-pointer hover:text-white flex items-center justify-end" onclick="sortProducts('price')">Valor ${getSortIcon('price')}</div>
            <div class="col-span-1"></div>
        </div>
        <div class="md:hidden flex items-center justify-between px-4 py-2 text-gray-400 text-xs uppercase font-bold bg-[#1f1f1f] rounded-t-lg border-b border-gray-800">
            <div class="flex items-center gap-2">${state.isSelectionMode ? checkColContent : ''}<span>Produto</span></div>
            <span>Estoque / Valor</span>
        </div>
    `;

    const scrollContainer = document.createElement('div');
    scrollContainer.id = 'admin-product-scroll-container'; // ID Adicionado para o arrastar
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
    products.forEach((p, index) => {
        const metrics = metricsMap[p.id] || { qtd: 0, lastDate: 0 };

        let lastMovStr = "-";
        if (metrics.lastDate > 0) {
            lastMovStr = new Date(metrics.lastDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        let priceHtml = p.promoPrice && p.promoPrice > 0
            ? `<div class="flex flex-col items-end"><span class="text-green-400 font-bold text-xs">${formatCurrency(p.promoPrice)}</span><span class="text-gray-600 text-[10px] line-through">${formatCurrency(p.price)}</span></div>`
            : `<span class="text-gray-200 font-bold text-xs">${formatCurrency(p.price)}</span>`;

        const isInactive = p.active === false;
        const isChecked = state.selectedProducts.has(p.id) ? 'checked' : '';

        let bgClass = isChecked ? 'bg-[#1a233a] border-blue-500/30' : 'bg-[#151720] border-gray-800 hover:bg-[#1c1f2b]';
        let imgOpacityClass = '';

        if (isInactive && !isChecked) {
            bgClass = 'bg-[#2a1313] border-red-900/50 hover:bg-[#351818]';
            imgOpacityClass = 'opacity-30 grayscale';
        }

        const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/100?text=Sem+Foto';
        const codeStr = p.code ? p.code : '-';
        const safeStockDisplay = isNaN(parseInt(p.stock)) ? 0 : parseInt(p.stock);

        const deleteBgClass = state.isSelectionMode || state.isReorderMode ? 'hidden' : 'absolute inset-y-0 right-0 w-24 bg-red-600 flex items-center justify-center cursor-pointer z-0';

        // MUDANÇA: Verifica se é modo reorganizar para exibir as barras de arrasto
        let selectionOrReorderHTML = '';
        if (state.isReorderMode) {
            selectionOrReorderHTML = `
                <div class="md:col-span-1 flex items-center justify-center shrink-0 border-r border-gray-800 h-full drag-handle cursor-grab text-gray-500 hover:text-yellow-500 transition px-3">
                    <i class="fas fa-grip-lines text-xl pointer-events-none"></i>
                </div>
                <div class="hidden md:flex flex-col md:col-span-1 items-center justify-center border-r border-gray-800 h-full shrink-0">
                    <span class="text-[11px] font-bold text-yellow-500 mb-0.5">Nº ${index + 1}</span>
                    <span class="text-[9px] font-bold text-white opacity-50">#${codeStr}</span>
                </div>
            `;
        } else {
            selectionOrReorderHTML = `
                <div class="${state.isSelectionMode ? 'flex' : 'hidden'} md:col-span-1 items-center justify-center shrink-0">
                     <input type="checkbox" class="w-5 h-5 rounded border-gray-600 bg-gray-900 text-yellow-500 cursor-pointer" onclick="event.stopPropagation(); toggleProductSelection('${p.id}')" ${isChecked}>
                </div>
                <div class="hidden md:flex flex-col ${state.isSelectionMode ? 'md:col-span-1' : 'md:col-span-2'} items-center justify-center border-r border-gray-800 h-full shrink-0">
                    <span class="text-base font-bold text-white font-mono opacity-80">#${codeStr}</span>
                    ${isInactive ? '<span class="text-[9px] bg-red-600 text-white px-1 mt-1 rounded uppercase font-bold tracking-widest">Inativo</span>' : ''}
                </div>
            `;
        }

        const row = document.createElement('div');
        row.className = `relative overflow-hidden border-b border-gray-800 last:border-0 select-none group`;
        if (state.isReorderMode) row.dataset.id = p.id; // Permite identificar quem está sendo arrastado
        row.ondblclick = () => editProduct(p.id);

        row.innerHTML = `
            <div class="${deleteBgClass}" onclick="confirmDeleteProduct('${p.id}')">
                <i class="fas fa-trash-alt text-white text-lg"></i>
            </div>
            <div class="relative z-10 p-3 transition-transform duration-200 ease-out prod-swipe-content ${bgClass} h-full flex flex-col md:grid md:grid-cols-12 gap-2 md:items-center">
                <div class="flex items-center justify-between w-full md:contents">
                    <div class="flex items-center gap-3 md:col-span-6 w-full flex-1 min-w-0">
                        
                        ${selectionOrReorderHTML}

                        <div class="flex items-center gap-3 flex-1 min-w-0">
                            <img src="${imgUrl}" class="w-10 h-10 rounded object-cover border border-gray-700 bg-black shrink-0 ${imgOpacityClass}">
                            <div class="flex flex-col flex-1 min-w-0 pr-2">
                                <div class="flex items-center gap-2">
                                    <span class="md:hidden shrink-0 text-[10px] bg-gray-700 text-white px-1.5 py-0.5 rounded font-bold">#${codeStr}</span>
                                    ${isInactive ? '<span class="md:hidden shrink-0 text-[9px] bg-red-600 text-white px-1 rounded uppercase font-bold tracking-widest">Inativo</span>' : ''}
                                    <span class="text-gray-200 font-bold text-sm truncate group-hover:text-yellow-500 transition">${p.name}</span>
                                </div>
                                <span class="text-gray-500 text-[10px] truncate w-full block mt-0.5">${p.category || 'Geral'}</span>
                            </div>
                        </div>
                    </div>
                    <div class="md:hidden flex flex-col justify-center items-end shrink-0 pl-2 ml-auto h-10">
                        ${priceHtml}
                        ${safeStockDisplay <= 0 ? '<span class="text-red-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">Esgotado</span>' : `<span class="text-gray-500 text-[10px] mt-0.5 whitespace-nowrap">Est.: <span class="font-bold text-gray-300">${safeStockDisplay}</span></span>`}
                    </div>
                </div>
                <div class="hidden md:block col-span-2 text-center text-gray-500 text-xs font-mono truncate">${lastMovStr}</div>
                <div class="hidden md:block col-span-1 text-center text-gray-400 text-xs">${metrics.qtd > 0 ? `<span class="bg-gray-800 px-2 py-0.5 rounded text-gray-300 font-bold">${metrics.qtd}</span>` : '-'}</div>
                <div class="hidden md:block col-span-1 text-center">${safeStockDisplay <= 0 ? '<span class="text-red-500 text-xs font-bold">0</span>' : `<span class="text-gray-400 text-xs font-bold">${safeStockDisplay}</span>`}</div>
                <div class="hidden md:block col-span-1 text-right pr-4">${priceHtml}</div>
                <div class="hidden ${state.isSelectionMode || state.isReorderMode ? 'hidden' : 'md:flex'} col-span-1 justify-center items-center">
                     <button onclick="event.stopPropagation(); confirmDeleteProduct('${p.id}')" class="text-gray-600 hover:text-red-500 transition p-2 rounded-full hover:bg-red-500/10" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;

        // Desativa a funcionalidade de escorregar para a lixeira enquanto arrasta (para não bugar o dedo no celular)
        if (!state.isReorderMode) {
            setupSwipe(row.querySelector('.prod-swipe-content'));
        }
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
            case 'Parcialmente Reembolsado':
                statusColorClass = 'text-purple-500'; 
                break;
        }
        if (o.status.includes('Cancelado')) statusColorClass = 'text-red-500';

        let itemsHtml = o.items.map(i => {
            // Procura se tem devolução para este item exato
            const refundedData = (o.refundedItems || []).find(r => r.id === i.id && r.size === i.size);
            const refundedBadge = refundedData 
                ? `<span class="text-[9px] bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-widest font-bold ml-2">-${refundedData.qty} Devolvido</span>` 
                : '';

            return `
            <div class="bg-gray-800/50 p-2 rounded mb-1 border border-gray-700 flex justify-between items-center">
                <span class="text-gray-300 text-sm font-medium flex items-center flex-wrap gap-1">
                    ${i.qty}x ${i.name} ${i.size !== 'U' ? `<span class="text-gray-500 text-xs">(${i.size})</span>` : ''} 
                    ${refundedBadge}
                </span>
                <span class="text-white text-xs font-bold">${formatCurrency(i.price)}</span>
            </div>
            `;
        }).join('');

        // --- LÓGICA FINANCEIRA (CUPONS E DESCONTOS) ---
        const subTotalItens = o.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
        const valFrete = o.shippingFee || 0;
        const valTotalPago = o.total || 0;

        const valDescontoTotal = Math.max(0, (subTotalItens + valFrete) - valTotalPago);

        let discountHtml = '';
        let valDescontoCupom = 0;
        let nomeCupom = null;

        if (o.couponData && o.couponData.value) {
            valDescontoCupom = o.couponData.value;
            nomeCupom = o.couponData.code;
        } else if (o.cupom && o.cupom.trim().length > 0) {
            nomeCupom = o.cupom;
            const isPix = (o.paymentMethod || '').toLowerCase().includes('pix');
            if (!isPix && valDescontoTotal > 0) valDescontoCupom = valDescontoTotal;
        }

        if (valDescontoTotal > 0.05 || nomeCupom) {
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

        const rawMethod = o.paymentMethod || '';
        const isOnline = rawMethod.includes('Online');
        const isDelivery = rawMethod.includes('Entrega');
        const cleanMethodName = rawMethod.split('[')[0].trim();

        let typeBadge = '';
        if (isOnline) typeBadge = `<span class="text-[10px] bg-green-900/40 text-green-400 border border-green-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Online</span>`;
        else if (isDelivery) typeBadge = `<span class="text-[10px] bg-orange-900/40 text-orange-400 border border-orange-600/50 px-2 py-0.5 rounded uppercase font-bold tracking-wide mt-1 inline-block">Na Entrega</span>`;

        // =========================================================
        // ✨ BOTÕES DE AÇÃO LADO A LADO
        // =========================================================
        const btnPrint = `<button type="button" onclick="event.stopPropagation(); printOrder('${o.id}')" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-2 rounded text-xs font-bold transition flex items-center justify-center gap-2"><i class="fas fa-print"></i> Imprimir</button>`;
        const btnFinance = `<button type="button" onclick="event.stopPropagation(); document.getElementById('admin-finance-panel-${o.id}').classList.toggle('hidden');" class="bg-blue-900/20 hover:bg-blue-900/40 border border-blue-900/50 text-blue-400 px-3 py-2 rounded text-xs font-bold transition flex items-center justify-center gap-2"><i class="fas fa-hand-holding-usd"></i> Lucro</button>`;

        const actionButtonsLeft = `<div class="flex items-center gap-2 w-full md:w-auto">${btnPrint}${btnFinance}</div>`;

        let controlsHtml = '';
        
        // ✨ CORREÇÃO: Usando 'o.status' em vez de 'order.status'
        if (o.status.includes('Cancelado')) {
            controlsHtml = `
                <div class="flex justify-between items-center mt-4 pt-2 border-t border-gray-700 w-full">
                    ${actionButtonsLeft}
                    <span class="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">PEDIDO CANCELADO</span>
                </div>`;
        } else if (o.status === 'Reembolsado') {
            controlsHtml = `
                <div class="flex justify-between items-center mt-4 pt-2 border-t border-gray-700 w-full">
                    ${actionButtonsLeft}
                    <span class="bg-purple-600 text-white px-3 py-1 rounded text-xs font-bold uppercase">Reembolso Total</span>
                </div>`;
        } else if (o.status === 'Concluído' || o.status === 'Parcialmente Reembolsado') {
            const badgeLabel = o.status === 'Concluído' ? 'FINALIZADO' : 'REEMBOLSO PARCIAL';
            const badgeColor = o.status === 'Concluído' ? 'bg-green-600' : 'bg-purple-600';
            
            controlsHtml = `
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 mt-4 pt-4 border-t border-gray-700 w-full">
                    ${actionButtonsLeft}
                    <div class="flex items-center gap-2">
                        <span class="${badgeColor} text-white px-4 py-2 rounded font-bold text-xs uppercase tracking-wide">${badgeLabel}</span>
                        <button onclick="adminRefundOrder('${o.id}')" class="border border-purple-500 text-purple-400 hover:bg-purple-600 hover:text-white px-3 py-2 rounded text-xs transition font-bold flex items-center gap-1 shadow-sm">
                            <i class="fas fa-undo"></i> Reembolsar
                        </button>
                    </div>
                </div>`;
        } else {
            controlsHtml = `
                <div class="flex flex-col md:flex-row gap-4 justify-between items-center mt-4 border-t border-gray-700 pt-4">
                    ${actionButtonsLeft}
                    <div class="flex items-center justify-end gap-2 w-full md:w-auto">
                        <label class="text-gray-500 text-xs uppercase font-bold hidden md:inline">Status:</label>
                        <select onchange="handleStatusChange(this, '${o.id}')" class="bg-gray-900 text-white text-xs border border-gray-600 rounded p-2 focus:border-yellow-500 outline-none flex-1 md:flex-none">
                            <option value="Aguardando aprovação" ${o.status === 'Aguardando aprovação' ? 'selected' : ''}>Aguardando aprovação</option>
                            <option value="Aprovado" ${o.status === 'Aprovado' ? 'selected' : ''}>Aprovado</option>
                            <option value="Preparando pedido" ${o.status === 'Preparando pedido' ? 'selected' : ''}>Preparando</option>
                            <option value="Saiu para entrega" ${o.status === 'Saiu para entrega' ? 'selected' : ''}>Saiu para entrega</option>
                            <option value="Entregue" ${o.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
                        </select>
                        <button onclick="adminCancelOrder('${o.id}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-xs font-bold transition hidden sm:block">Cancelar</button>
                        <button onclick="adminFinalizeOrder('${o.id}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-xs font-bold transition">Finalizar</button>
                    </div>
                </div>
            `;
        }

        // =========================================================
        // ✨ LÓGICA DO RESUMO FINANCEIRO (PAINEL ESCONDIDO)
        // =========================================================
        let totalCost = 0;
        const financeDetailsHtml = (o.items || []).map(i => {
            const c = parseFloat(i.cost) || 0;
            const rev = parseFloat(i.price) * parseInt(i.qty);
            const prof = rev - (c * parseInt(i.qty));
            totalCost += c * parseInt(i.qty);

            return `
                <div class="flex justify-between items-center text-[11px] border-b border-gray-800/50 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <span class="font-bold text-gray-300 truncate pr-2 flex-1">${i.qty}x ${i.name}</span>
                    <div class="flex flex-col items-end text-right">
                        <span class="text-gray-400">Venda: <span class="text-green-400 font-bold">${formatCurrency(rev)}</span></span>
                        <span class="text-gray-400 mt-0.5">Custo: <span class="text-red-400 font-bold">- ${formatCurrency(c * i.qty)}</span></span>
                        <span class="text-blue-400 font-bold border-t border-gray-800 w-full text-right mt-0.5 pt-0.5">Lucro: ${formatCurrency(prof)}</span>
                    </div>
                </div>
             `;
        }).join('');

        const liquidProfit = o.total - totalCost;
        const profitMargin = o.total > 0 ? ((liquidProfit / o.total) * 100).toFixed(1) : 0;

        const financePanelHTML = `
            <div id="admin-finance-panel-${o.id}" onclick="event.stopPropagation()" class="hidden mt-4 mb-2 bg-[#0a0c13] p-4 rounded-xl border border-blue-900/30 shadow-inner cursor-default">
                <div class="flex justify-between items-center mb-3 border-b border-blue-900/30 pb-2">
                    <h4 class="text-blue-500 text-[10px] font-bold uppercase tracking-widest"><i class="fas fa-chart-pie mr-1"></i> Análise de Lucro</h4>
                    <div class="flex gap-2">
                        <button type="button" onclick="exportFinancePDF('${o.id}')" class="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 px-2 py-1 rounded text-[9px] font-bold uppercase transition flex items-center gap-1"><i class="fas fa-file-pdf"></i> PDF</button>
                        <button type="button" onclick="exportFinanceExcel('${o.id}')" class="bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/30 px-2 py-1 rounded text-[9px] font-bold uppercase transition flex items-center gap-1"><i class="fas fa-file-excel"></i> Excel</button>
                    </div>
                </div>
                
                ${financeDetailsHtml}
                
                <div class="mt-3 pt-3 border-t border-blue-900/30 flex flex-col gap-1.5 text-xs">
                     <div class="flex justify-between text-gray-400">
                        <span class="text-[11px] text-green-400 font-bold">Receita (Pedido):</span>
                        <span class="text-green-400 font-bold">${formatCurrency(o.total)}</span>
                     </div>
                     <div class="flex justify-between text-gray-400">
                        <span class="text-[11px] text-red-400 font-bold">Custo (Produtos):</span>
                        <span class="text-red-400 font-bold">- ${formatCurrency(totalCost)}</span>
                     </div>
                     
                     <div class="flex justify-between items-end mt-2 pt-2 border-t border-gray-800/50">
                         <span class="text-green-500 font-bold uppercase text-[13px] tracking-wider">Lucro Líquido:</span>
                         <span class="text-blue-400 font-extrabold text-lg leading-none">${formatCurrency(liquidProfit)}</span>
                     </div>
                     
                     <div class="text-right mt-1">
                         <span class="text-[9px] bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-900/30">Margem: ${profitMargin}%</span>
                     </div>
                </div>
            </div>
        `;

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

                <div class="bg-gray-900 p-3 rounded border border-gray-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-2">
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
                
                ${financePanelHTML}
                ${controlsHtml}
            </div>
        `;
        listEl.appendChild(cardWrapper);
    });
}

// =================================================================
// 📊 EXPORTAÇÃO FINANCEIRA (PDF E EXCEL)
// =================================================================

// 1. Exportar para Excel (Tabela Estilizada Nativa)
window.exportFinanceExcel = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return showToast("Pedido não encontrado.", "error");

    let totalCost = 0;
    let totalRevenue = 0;

    // Constrói as linhas dos produtos já com cores
    let rowsHtml = '';
    (order.items || []).forEach(i => {
        const cost = parseFloat(i.cost) || 0;
        const revenue = parseFloat(i.price) * parseInt(i.qty);
        const costTotal = cost * parseInt(i.qty);
        const profit = revenue - costTotal;

        totalCost += costTotal;
        totalRevenue += revenue;

        rowsHtml += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155;">${i.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: #334155;">${i.qty}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #64748b;">R$ ${cost.toFixed(2).replace('.', ',')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">R$ ${costTotal.toFixed(2).replace('.', ',')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #2563eb;">R$ ${revenue.toFixed(2).replace('.', ',')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #16a34a; font-weight: bold;">R$ ${profit.toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });

    const finalRevenue = order.total || totalRevenue;
    const liquidProfit = finalRevenue - totalCost;
    const profitMargin = finalRevenue > 0 ? ((liquidProfit / finalRevenue) * 100).toFixed(1) : 0;

    // Monta a estrutura da planilha (Excel lê HTML nativamente)
    const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <style>
                table { border-collapse: collapse; font-family: Arial, sans-serif; }
                th { background-color: #1e3a8a; color: white; padding: 12px; font-weight: bold; border: 1px solid #1e3a8a; }
                td { font-size: 14px; }
                .totais td { font-weight: bold; font-size: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; }
            </style>
        </head>
        <body>
            <table>
                <tr>
                    <td colspan="6" style="text-align: center; font-size: 22px; font-weight: bold; background-color: #f1f5f9; padding: 15px; border: 1px solid #cbd5e1; color: #0f172a;">
                        RELATÓRIO DE LUCRO - PEDIDO #${order.code || orderId}
                    </td>
                </tr>
                <tr>
                    <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px;"><strong>Cliente:</strong> ${order.customer?.name || '-'}</td>
                    <td colspan="3" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;"><strong>Data:</strong> ${new Date(order.date).toLocaleDateString('pt-BR')}</td>
                </tr>
                <tr><td colspan="6" style="height: 15px;"></td></tr>
                
                <tr>
                    <th>PRODUTO</th>
                    <th>QTD</th>
                    <th>CUSTO UN.</th>
                    <th>CUSTO TOTAL</th>
                    <th>VENDA TOTAL</th>
                    <th>LUCRO PRODUTO</th>
                </tr>
                
                ${rowsHtml}
                
                <tr><td colspan="6" style="height: 15px;"></td></tr>
                
                <tr class="totais">
                    <td colspan="5" style="text-align: right; padding: 10px;">RECEITA DO PEDIDO:</td>
                    <td style="text-align: right; padding: 10px; color: #2563eb;">R$ ${finalRevenue.toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr class="totais">
                    <td colspan="5" style="text-align: right; padding: 10px;">CUSTO DOS PRODUTOS:</td>
                    <td style="text-align: right; padding: 10px; color: #dc2626;">- R$ ${totalCost.toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr class="totais">
                    <td colspan="5" style="text-align: right; padding: 12px; font-size: 18px; background-color: #e2e8f0; color: #0f172a;">LUCRO LÍQUIDO:</td>
                    <td style="text-align: right; padding: 12px; font-size: 18px; color: #16a34a; background-color: #e2e8f0;">R$ ${liquidProfit.toFixed(2).replace('.', ',')}</td>
                </tr>
                <tr class="totais">
                    <td colspan="5" style="text-align: right; padding: 10px; font-size: 12px; color: #64748b; border-top: none;">Margem de Lucro:</td>
                    <td style="text-align: right; padding: 10px; font-size: 12px; color: #1d4ed8; border-top: none;">${profitMargin}%</td>
                </tr>
            </table>
        </body>
        </html>
    `;

    // Converte e dispara o download do arquivo .xls
    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lucro_Pedido_${order.code || orderId}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast("Planilha gerada com sucesso!", "success");
};

// 2. Exportar para PDF (Gera visualização de impressão formatada)
window.exportFinancePDF = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return showToast("Pedido não encontrado.", "error");

    let totalCost = 0;

    // Constrói as linhas da tabela
    let itemsHtml = (order.items || []).map(i => {
        const cost = parseFloat(i.cost) || 0;
        const revenue = parseFloat(i.price) * parseInt(i.qty);
        const costTotal = cost * parseInt(i.qty);
        const profit = revenue - costTotal;

        totalCost += costTotal;

        return `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${i.qty}x ${i.name}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #dc2626;">${formatCurrency(costTotal)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">${formatCurrency(revenue)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: bold;">${formatCurrency(profit)}</td>
            </tr>
        `;
    }).join('');

    const liquidProfit = order.total - totalCost;
    const profitMargin = order.total > 0 ? ((liquidProfit / order.total) * 100).toFixed(1) : 0;

    // Abre uma nova janela para o relatório
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    // Desenha o HTML do relatório
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório de Lucro - Pedido #${order.code || orderId}</title>
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
                .header { border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #1e3a8a; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #f8fafc; padding: 12px 10px; text-align: left; border-bottom: 2px solid #cbd5e1; color: #475569; font-size: 12px; text-transform: uppercase; }
                .summary { background-color: #f1f5f9; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; width: 300px; float: right; }
                .summary-line { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; color: #475569; }
                .summary-total { display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 2px solid #cbd5e1; font-size: 18px; font-weight: bold; color: #16a34a; }
                .margin-badge { display: inline-block; background: #e0e7ff; color: #1d4ed8; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-top: 10px; float: right;}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Análise Financeira de Pedido</h1>
            </div>
            
            <div class="info-grid">
                <div>
                    <strong>Pedido:</strong> #${order.code || orderId}<br>
                    <strong>Data:</strong> ${new Date(order.date).toLocaleDateString('pt-BR')}<br>
                    <strong>Cliente:</strong> ${order.customer?.name || 'Não informado'}
                </div>
                <div style="text-align: right;">
                    <strong>Pagamento:</strong> ${order.paymentMethod || 'N/A'}<br>
                    <strong>Status:</strong> ${order.status}
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Custo Total</th>
                        <th>Venda Total</th>
                        <th>Lucro</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div class="summary">
                <div class="summary-line">
                    <span>Receita (Pedido):</span>
                    <strong>${formatCurrency(order.total)}</strong>
                </div>
                <div class="summary-line">
                    <span>Custo (Produtos):</span>
                    <strong style="color: #dc2626;">- ${formatCurrency(totalCost)}</strong>
                </div>
                <div class="summary-total">
                    <span>Lucro Líquido:</span>
                    <span>${formatCurrency(liquidProfit)}</span>
                </div>
                <div style="text-align: right; width: 100%;">
                    <span class="margin-badge">Margem: ${profitMargin}%</span>
                </div>
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    // Aguarda o HTML carregar e abre a tela de impressão do Windows/Mac
    setTimeout(() => {
        printWindow.print();
        // Fecha a guia de impressão automaticamente depois que o usuário salvar/cancelar
        printWindow.close();
    }, 500);
};


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
// 8. EVENT LISTENERS (LIMPO - SEM CÓDIGO FANTASMA)
// =================================================================
function setupEventListeners() {
    setupAccordion('btn-acc-cat', 'content-acc-cat', 'arrow-acc-cat');
    setupAccordion('btn-acc-coupon', 'content-acc-coupon', 'arrow-acc-coupon');

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.onclick = () => {
            sessionStorage.removeItem('isStoreAdmin');
            sessionStorage.removeItem('wantsAdmin');
            const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
            const urlLimpa = isLocal ? window.location.pathname + '?site=' + state.siteId : window.location.pathname;

            if (typeof signOut === 'function' && typeof auth !== 'undefined') {
                signOut(auth).then(() => { window.location.href = urlLimpa; });
            } else { window.location.href = urlLimpa; }
        };
    }

    const btnLoginCancel = getEl('btn-login-cancel');
    if (btnLoginCancel) btnLoginCancel.onclick = () => { if (typeof fecharModalLogin === 'function') fecharModalLogin(); };

    const btnLoginSubmit = document.getElementById('btn-login-submit');
    const passInput = document.getElementById('admin-pass');

    if (passInput) {
        passInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (btnLoginSubmit) btnLoginSubmit.click(); }
        });
    }

    if (btnLoginSubmit) {
        btnLoginSubmit.onclick = async () => {
            const pass = passInput ? passInput.value.trim() : '';
            const btnOriginalText = btnLoginSubmit.innerText;
            btnLoginSubmit.innerText = "Verificando...";
            btnLoginSubmit.disabled = true;
            try {
                if (checkAndActivateSupport(pass)) {
                    if (typeof fecharModalLogin === 'function') fecharModalLogin();
                    if (passInput) passInput.value = '';
                    showView('admin'); showView('support'); return;
                }

                let loggedIn = false;
                const emailDaLoja = `${state.siteId}@app.projetistaoficial.com`.toLowerCase();

                try {
                    await signInWithEmailAndPassword(auth, emailDaLoja, pass);
                    loggedIn = true;
                } catch (e1) {
                    try {
                        await signInWithEmailAndPassword(auth, "admin@admin.com", pass);
                        loggedIn = true;
                    } catch (e2) {
                        const docRef = doc(db, "sites", state.siteId);
                        const snap = await getDocFromServer(docRef);
                        if (snap.exists() && snap.data().access?.admin === pass) {
                            if (pass.length >= 6) {
                                try {
                                    await createUserWithEmailAndPassword(auth, emailDaLoja, pass);
                                    loggedIn = true;
                                } catch (migErr) {
                                    alert("Erro de segurança ao migrar conta."); return;
                                }
                            } else {
                                alert("Sua senha tem menos de 6 caracteres. Peça ao Administrador para aumentar."); return;
                            }
                        }
                    }
                }

                if (loggedIn) {
                    sessionStorage.removeItem('support_mode');
                    if (typeof fecharModalLogin === 'function') fecharModalLogin();
                    if (passInput) passInput.value = '';
                    if (els.menuBtnAdmin) {
                        els.menuBtnAdmin.classList.remove('hidden');
                        els.menuBtnAdmin.innerHTML = `<i class="fas fa-user-shield text-white group-hover:text-white transition"></i><span class="font-bold uppercase text-sm tracking-wide ml-2">Painel Admin</span>`;
                    }
                    const btnLoginNav = getEl('btn-admin-login');
                    if (btnLoginNav) {
                        btnLoginNav.classList.remove('hidden'); btnLoginNav.innerText = 'Painel Admin';
                    }
                    showView('admin');
                    if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
                    if (typeof loadAdminSales === 'function') loadAdminSales();
                } else { alert("Senha incorreta."); }

            } catch (error) { alert("Erro inesperado. Tente novamente."); }
            finally { btnLoginSubmit.innerText = btnOriginalText; btnLoginSubmit.disabled = false; }
        };
    }

    setupAccordion('btn-acc-theme', 'content-acc-theme', 'arrow-acc-theme');

    if (els.checkoutCep) els.checkoutCep.addEventListener('blur', (e) => handleCheckoutCep(e));

    const checkHours = document.getElementById('conf-hours-active');
    const divHours = document.getElementById('hours-settings');
    if (checkHours && divHours) {
        checkHours.addEventListener('change', (e) => {
            if (e.target.checked) divHours.classList.remove('opacity-50', 'pointer-events-none');
            else divHours.classList.add('opacity-50', 'pointer-events-none');
        });
    }

    if (els.adminSearchProd) els.adminSearchProd.addEventListener('input', filterAndRenderProducts);
    if (els.adminFilterCat) els.adminFilterCat.addEventListener('change', filterAndRenderProducts);
    if (els.adminSortProd) els.adminSortProd.addEventListener('change', filterAndRenderProducts);

    const adminFilterStatus = getEl('admin-filter-status');
    if (adminFilterStatus) adminFilterStatus.addEventListener('change', filterAndRenderProducts);

    if (els.confCardActive) {
        els.confCardActive.addEventListener('change', (e) => {
            if (e.target.checked) els.confCardDetails.classList.remove('opacity-50', 'pointer-events-none');
            else els.confCardDetails.classList.add('opacity-50', 'pointer-events-none');
        });
    }
    setupAccordion('btn-acc-installments', 'content-acc-installments', 'arrow-acc-installments');

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

    if (els.searchInput) {
        els.searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const clearSearchBtn = document.getElementById('clear-search-btn');

            // Mostra ou esconde o X
            if (term.length > 0 && clearSearchBtn) {
                clearSearchBtn.classList.remove('hidden');
            } else if (clearSearchBtn) {
                clearSearchBtn.classList.add('hidden');
            }

            const filtered = state.products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term)) ||
                (p.code && String(p.code).includes(term))
            );
            renderCatalog(filtered);
        });
    }
    if (els.catFilter) els.catFilter.addEventListener('change', (e) => { const cat = e.target.value; if (!cat) return renderCatalog(state.products); const filtered = state.products.filter(p => p.category === cat || p.category.startsWith(cat + ' -')); renderCatalog(filtered); });

    setupAccordion('btn-acc-sales-filters', 'content-acc-sales-filters', 'arrow-acc-sales-filters');

    const idsFiltros = ['filter-search-general', 'filter-search-product-value', 'filter-status', 'filter-payment', 'filter-sort-order', 'filter-date-start', 'filter-date-end', 'filter-search-code'];
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
            // Limpa todos os inputs da lista
            idsFiltros.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

            // Reseta a ordenação
            const sort = document.getElementById('filter-sort-order');
            if (sort) sort.value = 'date_desc';

            // 👉 A MÁGICA: Limpa a nossa caixa visual de produtos
            clearProductFilter(null);

            // Recarrega a tabela
            filterAndRenderSales();
        };
    }

    if (els.dashPrevDate) els.dashPrevDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() - 1); else state.dashDate.setMonth(state.dashDate.getMonth() - 1); updateDashboardUI(); };
    if (els.dashNextDate) els.dashNextDate.onclick = () => { if (state.dashViewMode === 'day') state.dashDate.setDate(state.dashDate.getDate() + 1); else state.dashDate.setMonth(state.dashDate.getMonth() + 1); updateDashboardUI(); };
    if (els.btnViewDay) els.btnViewDay.onclick = () => { state.dashViewMode = 'day'; updateDashboardUI(); };
    if (els.btnViewMonth) els.btnViewMonth.onclick = () => { state.dashViewMode = 'month'; updateDashboardUI(); };

    if (els.statsFilterAll) els.statsFilterAll.onclick = () => { state.statsFilterType = 'all'; updateStatsUI(); };
    if (els.statsFilterPeriod) els.statsFilterPeriod.onclick = () => { state.statsFilterType = 'period'; updateStatsUI(); };
    if (els.statsPrevDate) els.statsPrevDate.onclick = () => { if (state.statsViewMode === 'day') state.statsDate.setDate(state.statsDate.getDate() - 1); else state.statsDate.setMonth(state.statsDate.getMonth() - 1); updateStatsUI(); };
    if (els.statsNextDate) els.statsNextDate.onclick = () => { if (state.statsViewMode === 'day') state.statsDate.setDate(state.statsDate.getDate() + 1); else state.statsDate.setMonth(state.statsDate.getMonth() + 1); updateStatsUI(); };
    if (els.statsViewDay) els.statsViewDay.onclick = () => { state.statsViewMode = 'day'; updateStatsUI(); };
    if (els.statsViewMonth) els.statsViewMonth.onclick = () => { state.statsViewMode = 'month'; updateStatsUI(); };

    const btnCart = document.getElementById('cart-btn'); if (btnCart) btnCart.onclick = () => openCart();
    const btnCartMob = document.getElementById('cart-btn-mobile'); if (btnCartMob) btnCartMob.onclick = () => openCart();

    if (els.btnCheckout) {
        els.btnCheckout.onclick = () => {
            if (state.cart.length === 0) return alert('Carrinho vazio');
            els.cartModal.classList.add('hidden');
            openCheckoutModal();
        };
    }

    const btnAdminLogin = getEl('btn-admin-login');
    if (btnAdminLogin) { btnAdminLogin.onclick = () => { if (state.user) { showView('admin'); } else { getEl('login-modal').showModal(); } }; }

    const btnMob = getEl('mobile-menu-btn'); if (btnMob) btnMob.onclick = toggleSidebar;
    const btnCloseSide = getEl('close-sidebar'); if (btnCloseSide) btnCloseSide.onclick = toggleSidebar;
    if (els.sidebarOverlay) els.sidebarOverlay.onclick = toggleSidebar;

    if (els.themeToggle) els.themeToggle.onclick = () => toggleTheme(true);

    if (els.menuLinkHome) {
        els.menuLinkHome.onclick = (e) => {
            if (e) e.preventDefault(); showView('catalog'); filterByCat('');
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

    const btnCloseModal = getEl('close-modal-btn'); if (btnCloseModal) btnCloseModal.onclick = closeProductModal;
    const backdrop = getEl('modal-backdrop'); if (backdrop) backdrop.onclick = closeProductModal;
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !getEl('product-modal').classList.contains('hidden')) closeProductModal(); });

    if (els.btnAddCat) {
        els.btnAddCat.onclick = async () => {
            const nameInput = els.newCatName.value.trim();
            if (!nameInput) return alert("Digite o nome");
            let finalName = nameInput;
            if (state.selectedCategoryParent) { finalName = `${state.selectedCategoryParent} - ${nameInput}`; }
            try {
                await addDoc(collection(db, `sites/${state.siteId}/categories`), { name: finalName, order: Date.now() });
                els.newCatName.value = ''; state.selectedCategoryParent = null;

                // ✨ CORREÇÃO: Limpa o cache e recarrega a tela instantaneamente
                localStorage.removeItem(`cats_${state.siteId}`);
                await loadCategories();
                renderAdminCategoryList();
                showToast("Categoria criada com sucesso!", "success");

            } catch (error) { alert("Erro: " + error.message); }
        };

        setupAccordion('btn-acc-profile', 'content-acc-profile', 'arrow-acc-profile');
        const btnProfile = getEl('btn-acc-profile');
        if (btnProfile) { btnProfile.addEventListener('click', () => { setTimeout(() => { if (typeof window.checkFooter === 'function') window.checkFooter(); }, 50); }); }
        if (els.btnSaveProfile) els.btnSaveProfile.onclick = saveStoreProfile;
    }

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
            if (e.target.checked) { settingsCard.classList.remove('opacity-50', 'pointer-events-none'); getEl('prod-card-installments')?.focus(); }
            else { settingsCard.classList.add('opacity-50', 'pointer-events-none'); }
        });
    }

    const btnAddCoupon = document.getElementById('btn-add-coupon');
if (btnAddCoupon) {
    btnAddCoupon.onclick = async () => {
        const code = document.getElementById('coupon-code').value.trim().toUpperCase();
        const val = parseFloat(document.getElementById('coupon-val').value);
        const isPercent = document.getElementById('coupon-is-percent').checked;
        const expiry = document.getElementById('coupon-expiry').value;

        if (!code || isNaN(val)) return showToast("Preencha Código e Valor.", 'error');

        const data = { 
            code: code, 
            val: val, 
            type: isPercent ? 'percent' : 'fixed', 
            expiryDate: expiry || null
        };

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
            if (error.code === 'not-found' || error.message.includes('No document to update')) {
                alert("Atenção: O cupom não existe mais. Tente criar novo."); 
                state.editingCouponId = null;
            } else { 
                alert("Erro ao salvar: " + error.message); 
            }
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
                    const base64 = await processImageFile(file); state.tempImages.push(base64);
                } catch (err) { console.error("Erro imagem", err); }
            }
            renderImagePreviews(); fileInput.value = '';
        });
    }

    const btnAddProd = getEl('btn-add-product');
    if (btnAddProd) {
        btnAddProd.onclick = () => {
            if (typeof openNewProductModal === 'function') openNewProductModal();
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

    const btnGoCheckout = document.getElementById('btn-go-checkout');
    const btnFinishPayment = document.getElementById('btn-finish-payment');
    const btnCloseCart = document.getElementById('close-cart');

    if (btnGoCheckout) { btnGoCheckout.onclick = () => { if (typeof goToCheckoutView === 'function') goToCheckoutView(); }; }
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

    // =================================================================
    // 🖼️ SISTEMA PROFISSIONAL DE RECORTE DE IMAGEM (CROPPER.JS) - CARREGAS AS IMAGENS E ABRE O MODAL DE CORTE (INICIO))
    // =================================================================
    // Variáveis globais para o Cropper
    window.cropper = null;
    window.currentCropType = ''; // Vai guardar se estamos cortando 'logo' ou 'banner'

    // 1. Escuta quando o usuário escolhe um arquivo
    const setupImageUploads = () => {
        const logoInput = document.getElementById('conf-logo-upload');
        const bannerInput = document.getElementById('conf-banner-upload');

        if (logoInput) {
            // Remove listeners antigos (prevenção de bugs)
            const newLogoInput = logoInput.cloneNode(true);
            logoInput.parentNode.replaceChild(newLogoInput, logoInput);
            newLogoInput.addEventListener('change', (e) => handleImageSelectForCrop(e, 'logo'));
        }

        if (bannerInput) {
            // Remove listeners antigos
            const newBannerInput = bannerInput.cloneNode(true);
            bannerInput.parentNode.replaceChild(newBannerInput, bannerInput);
            newBannerInput.addEventListener('change', (e) => handleImageSelectForCrop(e, 'banner'));
        }
    };

    // Ativa os ouvintes assim que carregar a página
    document.addEventListener('DOMContentLoaded', setupImageUploads);

    // 2. Pega a foto do celular/PC e joga pro Modal
    window.handleImageSelectForCrop = (event, type) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast("Por favor, selecione uma imagem válida (JPG, PNG).", "error");
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            openCropModal(e.target.result, type);
        };
        reader.readAsDataURL(file);

        // Reseta o input para o usuário poder selecionar a mesma foto se cancelar sem querer
        event.target.value = '';
    };

    // 3. Abre o modal e liga o Cropper.js
    window.openCropModal = (imageSrc, type) => {
        window.currentCropType = type;
        const modal = document.getElementById('crop-modal');
        const imageEl = document.getElementById('crop-image');
        const title = document.getElementById('crop-title');

        if (!modal || !imageEl) {
            console.error("ERRO: HTML do modal de crop não encontrado.");
            return;
        }

        // ✨ A MÁGICA VISUAL: Se for logo, aplica a classe que deixa o corte redondo no CSS
        if (type === 'logo') {
            modal.classList.add('crop-modo-logo');
            title.innerHTML = '<i class="fas fa-store mr-2"></i> Recortar Logo (Círculo)';
        } else {
            modal.classList.remove('crop-modo-logo');
            title.innerHTML = '<i class="fas fa-image mr-2"></i> Recortar Banner (Retângulo)';
        }

        imageEl.src = imageSrc;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => modal.classList.remove('opacity-0'), 10);

        if (window.cropper) {
            window.cropper.destroy();
        }

        setTimeout(() => {
            if (typeof Cropper === 'undefined') {
                alert("ERRO: O Cropper.js não carregou! Verifique o link no index.html");
                return;
            }

            const ratio = type === 'logo' ? 1 / 1 : 21 / 9;

            window.cropper = new Cropper(imageEl, {
                aspectRatio: ratio,
                viewMode: 2,
                dragMode: 'move',
                autoCropArea: 1, // <-- AJUSTE: Agora começa com o tamanho MÁXIMO da imagem (1 = 100%)
                restore: false,
                guides: type !== 'logo', // <-- AJUSTE: Mostra linhas de grade só no banner
                center: type !== 'logo', // <-- AJUSTE: Mostra cruz central só no banner
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: true,
            });
        }, 150);
    };

    // 4. Fechar Modal
    window.closeCropModal = () => {
        const modal = document.getElementById('crop-modal');
        modal.classList.add('opacity-0');

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            if (window.cropper) {
                window.cropper.destroy();
                window.cropper = null;
            }
            document.getElementById('crop-image').src = ''; // Limpa memória
        }, 300);
    };

    // 5. MÁGICA: Confirma e comprime a imagem final
    window.confirmCrop = () => {
        if (!window.cropper) return;

        // O Cropper faz a compressão e define o tamanho máximo aqui!
        const canvas = window.cropper.getCroppedCanvas({
            // Se for logo, 500px tá ótimo. Banner pode ser maior (1200px)
            maxWidth: window.currentCropType === 'logo' ? 500 : 1200,
            maxHeight: window.currentCropType === 'logo' ? 500 : 1200,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        // Converte pra Base64 JPEG (Qualidade de 80% = Leve e bonito)
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);

        // Joga a imagem comprimida de volta pra tela e pra memória do seu Painel
        if (window.currentCropType === 'logo') {
            state.tempLogo = base64Image;
            const preview = document.getElementById('conf-logo-preview');
            const placeholder = document.getElementById('conf-logo-placeholder');

            if (preview) {
                preview.src = base64Image;
                preview.classList.remove('hidden');
            }
            if (placeholder) placeholder.classList.add('hidden');

        } else if (window.currentCropType === 'banner') {
            state.tempBanner = base64Image;
            const preview = document.getElementById('conf-banner-preview');

            if (preview) {
                preview.src = base64Image;
                preview.classList.remove('hidden');
            }
        }

        closeCropModal();
        // Você não precisa salvar ainda, o botão verde "Salvar Perfil" que você já tem fará isso!
    };
    // =================================================================
    // 🖼️ SISTEMA PROFISSIONAL DE RECORTE DE IMAGEM (CROPPER.JS) - CARREGAS AS IMAGENS E ABRE O MODAL DE CORTE (FIM))
    // =================================================================

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

    if (typeof initSupportModule === 'function') {
        initSupportModule({
            state: state,
            auth: auth,
            showToast: showToast,
            loadAdminSales: loadAdminSales,
            checkActiveOrders: checkActiveOrders,
            loadProducts: loadProducts,
            windowRef: window
        });
    }

    const cardActive = document.getElementById('conf-card-active');
    if (cardActive) {
        cardActive.addEventListener('change', (e) => {
            const details = document.getElementById('conf-card-details');
            if (details) {
                if (e.target.checked) details.classList.remove('opacity-50', 'pointer-events-none');
                else details.classList.add('opacity-50', 'pointer-events-none');
            }
            autoSaveSettings('installments');
        });
    }

    const cardInputs = ['conf-card-max', 'conf-card-rate'];
    cardInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.addEventListener('blur', () => { autoSaveSettings('installments'); }); }
    });

    const cardFree = document.getElementById('conf-card-free');
    if (cardFree) { cardFree.addEventListener('change', () => autoSaveSettings('installments')); }

    setupRateMask();

    const logisticsInputs = ['conf-store-cep', 'conf-max-dist'];
    logisticsInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('blur', () => { autoSaveSettings('logistics'); });
            el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { el.blur(); } });
        }
    });

    const payCheckboxes = [
        'conf-pay-online-active', 'conf-pay-online-pix', 'conf-pay-online-credit', 'conf-pay-online-debit',
        'conf-pay-delivery-active', 'conf-pay-delivery-pix', 'conf-pay-delivery-credit', 'conf-pay-delivery-debit', 'conf-pay-delivery-cash'
    ];

    payCheckboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);

            newEl.addEventListener('change', (e) => {
                const isMasterOnline = id === 'conf-pay-online-active';
                const isMasterDelivery = id === 'conf-pay-delivery-active';
                const isChecked = e.target.checked;

                if ((isMasterOnline || isMasterDelivery) && !isChecked) {
                    const onlineActive = document.getElementById('conf-pay-online-active').checked;
                    const deliveryActive = document.getElementById('conf-pay-delivery-active').checked;
                    if (!onlineActive && !deliveryActive) {
                        alert("⚠️ Você não pode desativar todas as formas de pagamento.\nPelo menos uma (Online ou Entrega) deve ficar ativa.");
                        e.target.checked = true; return;
                    }
                }

                if (!isMasterOnline && !isMasterDelivery && !isChecked) {
                    const group = id.includes('online') ? 'online' : 'delivery';
                    const masterId = `conf-pay-${group}-active`;
                    const masterChecked = document.getElementById(masterId).checked;

                    if (masterChecked) {
                        const inputs = document.querySelectorAll(`input[id^="conf-pay-${group}-"]:not([id$="-active"]):checked`);
                        if (inputs.length === 0) {
                            alert(`⚠️ O grupo ${group === 'online' ? 'Online' : 'Entrega'} precisa de pelo menos uma opção ativa.`);
                            e.target.checked = true; return;
                        }
                    }
                }
                if (typeof updatePaymentVisuals === 'function') updatePaymentVisuals();
                autoSaveSettings('payments');
            });
        }
    });

    const elReqCode = document.getElementById('conf-req-code');
    if (elReqCode) { elReqCode.addEventListener('change', () => autoSaveSettings('orders')); }

    const elCancelTime = document.getElementById('conf-cancel-time');
    if (elCancelTime) {
        elCancelTime.addEventListener('blur', () => autoSaveSettings('orders'));
        elCancelTime.addEventListener('keydown', (e) => { if (e.key === 'Enter') elCancelTime.blur(); });
    }

    const elShipRule = document.getElementById('conf-shipping-rule');
    if (elShipRule) {
        elShipRule.addEventListener('change', (e) => {
            const container = document.getElementById('shipping-value-container');
            if (container) {
                if (e.target.value !== 'none') container.classList.remove('opacity-50', 'pointer-events-none');
                else container.classList.add('opacity-50', 'pointer-events-none');
            }
            autoSaveSettings('orders');
        });
    }

    const elShipValue = document.getElementById('conf-shipping-value');
    if (elShipValue) {
        elShipValue.addEventListener('blur', () => {
            if (typeof formatMoneyForInput === 'function' && elShipValue.value) {
                let val = parseFloat(elShipValue.value.replace(/[^\d,.]/g, '').replace(',', '.')) || 0;
                if (val > 0) elShipValue.value = formatMoneyForInput(val);
            }
            autoSaveSettings('orders');
        });
    }

    const productPriceInputs = ['prod-price', 'prod-promo', 'prod-cost', 'prod-pix-val'];
    productPriceInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, "");
                if (value === "") { e.target.value = ""; return; }
                value = (parseFloat(value) / 100).toFixed(2) + '';
                value = value.replace(".", ",");
                value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
                e.target.value = value;
            });
        }
    });

    // --- VALIDAÇÃO EM TEMPO REAL: WHATSAPP DA LOJA ---
    const inputWpp = document.getElementById('conf-store-wpp');
    const erroWpp = document.getElementById('erro-conf-wpp');

    if (inputWpp && erroWpp) {
        inputWpp.addEventListener('input', (e) => {
            // 1. Remove qualquer letra ou símbolo na hora que o cara digita
            let valor = e.target.value.replace(/\D/g, '');
            e.target.value = valor;

            if (valor.length > 0) {
                // 2. Se tiver menos de 10 ou mais de 13 números, está errado
                if (valor.length < 11 || valor.length > 13) {
                    inputWpp.classList.remove('border-gray-700', 'focus:border-yellow-500', 'border-green-500');
                    inputWpp.classList.add('border-red-500', 'focus:border-red-500'); // Borda vermelha
                    erroWpp.classList.remove('hidden'); // Mostra o aviso
                } else {
                    // 3. Se estiver no tamanho certo, fica VERDE de sucesso
                    inputWpp.classList.remove('border-red-500', 'focus:border-red-500', 'border-gray-700', 'focus:border-yellow-500');
                    inputWpp.classList.add('border-green-500'); // Borda verde
                    erroWpp.classList.add('hidden'); // Esconde o aviso
                }
            } else {
                // 4. Se ele apagar tudo e o campo ficar vazio, volta pra cor original (cinza/amarelo)
                inputWpp.classList.remove('border-red-500', 'focus:border-red-500', 'border-green-500');
                inputWpp.classList.add('border-gray-700', 'focus:border-yellow-500');
                erroWpp.classList.add('hidden');
            }
        });
    }

    // =======================================================
    // GATILHOS DO GERENCIADOR DE TÓPICOS (CORRIGIDO)
    // =======================================================
    const chkMasterTopicos = document.getElementById('ativar-topicos-geral');
    if (chkMasterTopicos) {
        // Remove ouvintes antigos clonando
        const newChk = chkMasterTopicos.cloneNode(true);
        chkMasterTopicos.parentNode.replaceChild(newChk, chkMasterTopicos);

        newChk.addEventListener('change', async (e) => {
            const isActive = e.target.checked;
            state.storeProfile.enableCustomTopics = isActive;

            const formArea = document.getElementById('box-form-topico');
            if (formArea) {
                if (isActive) formArea.classList.remove('opacity-50', 'pointer-events-none');
                else formArea.classList.add('opacity-50', 'pointer-events-none');
            }

            try {
                await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { enableCustomTopics: isActive }, { merge: true });
                if (typeof renderSidebarTopics === 'function') renderSidebarTopics();
                showToast(isActive ? "Tópicos ativados na loja!" : "Tópicos ocultos da loja.");
            } catch (err) { console.error(err); }
        });
    }

    // 1. OUVINTES DO TÍTULO E DESCRIÇÃO (Fazem o botão "Novo" virar "Salvar" ao digitar)
    const titleInput = document.getElementById('topico-titulo');
    if (titleInput) {
        const newTitle = titleInput.cloneNode(true);
        titleInput.parentNode.replaceChild(newTitle, titleInput);
        newTitle.addEventListener('input', () => {
            if (typeof checkTopicChanges === 'function') checkTopicChanges();
        });
    }

    const richDesc = document.getElementById('topico-descricao-rich');
    if (richDesc) {
        const newDesc = richDesc.cloneNode(true);
        richDesc.parentNode.replaceChild(newDesc, richDesc);
        newDesc.addEventListener('input', () => {
            if (typeof checkTopicChanges === 'function') checkTopicChanges();
        });
    }

    // 3. INICIA O ESTADO ORIGINAL
    if (typeof renderIconSelector === 'function') renderIconSelector();
    state.originalTopicState = "||fa-file-alt";

} // <-- FECHA A FUNÇÃO setupEventListeners()


// =====================================================================
// 🌟 SISTEMA DE CATEGORIAS PREMIUM (VIDRO, CORES DO PAINEL E CARROSSEL)
// =====================================================================
window.aplicarCoresCategorias = (catName) => {
    const todosBotoes = document.querySelectorAll('.categoria-btn');

    // Arrays isolados com as classes exatas
    // INATIVA: Fundo de vidro branco 10% (transparente e limpo)
    const classesInativas = ['bg-white/10', 'text-[var(--txt-body)]', 'border-transparent'];

    // ATIVA: Fundo preto 60% (bg-black/60) para dar o destaque escuro que você pediu!
    const classesAtivas = ['bg-black/60', 'text-[var(--clr-accent)]', 'border-[var(--clr-accent)]'];

    todosBotoes.forEach(btn => {
        // Limpa qualquer estilo inline que as tentativas anteriores tenham deixado preso
        btn.removeAttribute('style');

        // Remove todas as classes para evitar acúmulo e sujeira
        btn.classList.remove(...classesInativas, ...classesAtivas, 'bg-white/5', 'bg-white/20', 'bg-[#151720]', 'bg-black', 'text-white', 'text-gray-300');

        const isAtivo = btn.dataset.cat === catName || (catName !== '' && catName.startsWith(btn.dataset.cat + ' -'));

        if (isAtivo) {
            btn.classList.add(...classesAtivas);
        } else {
            btn.classList.add(...classesInativas);
        }
    });
};

// 2. FUNÇÃO DO CLIQUE (Filtra e muda cor)
window.filterByCat = (catName) => {
    window.isCategorySelected = (catName !== ''); // Avisa o carrossel se deve pausar

    if (els.pageTitle) els.pageTitle.innerText = catName ? catName.split(' - ').pop() : 'Vitrine';
    if (els.catFilter) els.catFilter.value = catName;

    if (!catName) renderCatalog(state.products);
    else {
        const term = catName.toLowerCase();
        const filtered = state.products.filter(p => {
            if (!p.category) return false;
            const prodCat = p.category.toLowerCase();
            return prodCat === term || prodCat.startsWith(term + ' -');
        });
        renderCatalog(filtered);
    }

    if (els.grid) els.grid.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.innerWidth < 1024) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
    }

    // ✨ AQUI: Fecha qualquer opção/dropdown da BARRA SUPERIOR que esteja aberto
    if (typeof fecharCatDropdown === 'function') fecharCatDropdown();

    window.aplicarCoresCategorias(catName);
};

// 3. RENDERIZADOR (Cria os botões na tela)
function renderCategories() {
    const populateSelect = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const val = el.value;
        el.innerHTML = `<option value="">Todas</option>`;
        state.categories.forEach(c => el.innerHTML += `<option value="${c.name}">${c.name}</option>`);
        if (val) el.value = val;
    };
    ['category-filter', 'admin-filter-cat', 'bulk-category-select', 'prod-cat-select', 'bulk-category-select-dynamic'].forEach(populateSelect);

    const scrollContainer = document.getElementById('categorias-scroll');
    if (scrollContainer) {
        let activeCat = document.getElementById('category-filter')?.value || '';

        if (activeCat !== '') {
            const catExists = state.categories.some(c => c.name === activeCat || activeCat.startsWith(c.name + ' -'));
            if (!catExists) { activeCat = ''; renderCatalog(state.products); }
        }

        let pillsHtml = '';
        const principais = state.categories.filter(c => !c.name.includes(' - '));
        const categoriasParaMostrar = principais.length > 0 ? principais : state.categories;
        categoriasParaMostrar.sort((a, b) => (a.order || 0) - (b.order || 0));

        categoriasParaMostrar.forEach(c => {
            const safeName = c.name.replace(/'/g, "\\'");
            const hasSubs = state.categories.some(sub => sub.name.startsWith(c.name + ' - '));

            // 👉 ESTRUTURA BASE: Só estrutura e desfoque. As cores (bg-white/10) entram via JS.
            const classesEstrutura = "categoria-btn flex items-center h-full rounded-full transition-all shrink-0 border backdrop-blur-md font-['Nunito'] font-black tracking-wide text-xs outline-none";

            if (hasSubs) {
                pillsHtml += `
                    <div class="${classesEstrutura}" data-cat="${safeName}">
                        <button onclick="filterByCat('${safeName}')" class="px-4 h-full rounded-l-full outline-none">
                            ${c.name}
                        </button>
                        <button onclick="toggleCatDropdown('${safeName}', event)" class="px-3 h-full border-l border-white/20 flex items-center justify-center rounded-r-full hover:bg-black/30 outline-none transition-colors">
                            <i class="fas fa-chevron-down text-[10px]"></i>
                        </button>
                    </div>
                `;
            } else {
                pillsHtml += `
                    <button onclick="filterByCat('${safeName}')" data-cat="${safeName}" class="${classesEstrutura} px-5 outline-none">
                        ${c.name}
                    </button>
                `;
            }
        });

        scrollContainer.innerHTML = pillsHtml;

        // Ao terminar de desenhar, o JS pinta quem é quem
        setTimeout(() => { window.aplicarCoresCategorias(activeCat); }, 10);

        if (typeof initCategoryCarousel === 'function') initCategoryCarousel();
    }

    // --- SIDEBAR (MANTENHA A SUA CÓPIA AQUI) ---
    const sidebarContainer = document.getElementById('sidebar-categories');
    if (sidebarContainer) {
        const tree = {};
        state.categories.forEach(c => {
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

        const getOrder = (path) => {
            const cat = state.categories.find(c => c.name === path);
            return cat && cat.order !== undefined ? cat.order : 999;
        };

        const buildHtml = (node, level = 0) => {
            let html = '';
            const keys = Object.keys(node).sort((a, b) => {
                const orderA = getOrder(node[a]._path);
                const orderB = getOrder(node[b]._path);
                if (orderA !== orderB) return orderA - orderB;
                return a.localeCompare(b);
            });

            keys.forEach(key => {
                const item = node[key];
                const hasChildren = Object.keys(item._children).length > 0;
                const safePath = item._path.replace(/'/g, "\\'");
                const paddingLeft = level === 0 ? 12 : (level * 20) + 12;
                const textStyle = level === 0 ? "text-[var(--txt-body)] font-bold uppercase tracking-wide text-sm" : "text-gray-300 font-medium text-sm hover:text-white";

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

// 4. DROPDOWN DE SUBCATEGORIAS
window.toggleCatDropdown = (parentName, event) => {
    event.stopPropagation();
    const dropdown = document.getElementById('global-cat-dropdown');
    if (!dropdown.classList.contains('hidden') && dropdown.dataset.current === parentName) {
        fecharCatDropdown();
        return;
    }
    const subs = state.categories.filter(c => c.name.startsWith(parentName + ' - ') && c.name.split(' - ').length === parentName.split(' - ').length + 1);
    dropdown.innerHTML = subs.map(sub => {
        const safeSubName = sub.name.replace(/'/g, "\\'");
        const shortName = sub.name.replace(parentName + ' - ', '');
        return `
            <button onclick="filterByCat('${safeSubName}'); fecharCatDropdown()" class="block w-full text-left px-5 py-2.5 text-xs font-bold text-[var(--txt-body)] hover:bg-white/10 hover:text-white transition-colors outline-none">
                ${shortName}
            </button>
        `;
    }).join('');
    const btnRect = event.currentTarget.getBoundingClientRect();
    dropdown.style.top = `${btnRect.bottom + 8}px`;
    const spaceRight = window.innerWidth - btnRect.right;
    if (spaceRight < 150) {
        dropdown.style.right = `${window.innerWidth - btnRect.right}px`;
        dropdown.style.left = 'auto';
    } else {
        dropdown.style.left = `${btnRect.left - 50}px`;
        dropdown.style.right = 'auto';
    }
    dropdown.dataset.current = parentName;
    dropdown.classList.remove('hidden');
    setTimeout(() => {
        dropdown.classList.remove('opacity-0', 'scale-95');
        dropdown.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.fecharCatDropdown = () => {
    const dropdown = document.getElementById('global-cat-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        dropdown.classList.remove('opacity-100', 'scale-100');
        dropdown.classList.add('opacity-0', 'scale-95');
        setTimeout(() => dropdown.classList.add('hidden'), 200);
        dropdown.dataset.current = "";
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-cat-dropdown') && !e.target.closest('.categoria-btn')) {
        fecharCatDropdown();
    }
});

// ===============================================
// 5. CARROSSEL COM PING-PONG BLINDADO E PAUSA
// ===============================================
window.isCategorySelected = false;
window.initCategoryCarousel = () => {
    const slider = document.getElementById('categorias-scroll');
    if (!slider) return;

    // 🔥 A VACINA DO CELULAR: Remove o 'scroll-smooth' que causa o cabo de guerra
    slider.classList.remove('scroll-smooth');
    slider.style.scrollBehavior = 'auto';

    // Mata animações velhas se atualizar a tela
    if (window.carouselAnimationId) {
        cancelAnimationFrame(window.carouselAnimationId);
    }

    let isDown = false;
    let startX;
    let scrollLeft;
    let isAutoScrolling = true;
    let scrollDirection = 1;

    const playAutoScroll = () => {
        window.carouselAnimationId = requestAnimationFrame(playAutoScroll);

        const selectEscondido = document.getElementById('category-filter');
        const temCategoriaAtiva = selectEscondido && selectEscondido.value !== '';

        // Pausa se clicou em algo ou se o dedo estiver na tela
        if (!isAutoScrolling || temCategoriaAtiva) return;

        const maxScroll = slider.scrollWidth - slider.clientWidth;
        if (maxScroll <= 0) return;

        if (slider.scrollLeft >= maxScroll - 2) scrollDirection = -1;
        else if (slider.scrollLeft <= 0) scrollDirection = 1;

        // Roda fluido
        slider.scrollLeft += scrollDirection;
    };

    playAutoScroll();

    // 📱 EVENTOS BLINDADOS (Usando on... para não duplicar lixo na memória)

    // --- CONTROLES PC (MOUSE) ---
    slider.onmousedown = (e) => {
        isDown = true; isAutoScrolling = false; slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
    };
    slider.onmouseleave = () => {
        isDown = false; slider.style.cursor = 'grab'; isAutoScrolling = true;
    };
    slider.onmouseup = () => {
        isDown = false; slider.style.cursor = 'grab';
        setTimeout(() => { isAutoScrolling = true; }, 2000);
    };
    slider.onmousemove = (e) => {
        if (!isDown) return; e.preventDefault();
        const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    };

    // --- CONTROLES CELULAR (DEDO) ---
    slider.ontouchstart = () => {
        // Pausa a animação assim que o dedo encosta
        isAutoScrolling = false;
    };
    slider.ontouchend = () => {
        // Quando tira o dedo, espera 2 segundos e volta a andar sozinho
        setTimeout(() => { isAutoScrolling = true; }, 2000);
    };
};;

// =================================================================
// RECUPERAÇÃO DAS ABAS DO ADMIN (Produtos, Categoria, Stats, Config)
// =================================================================
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    // 1. Esconde todos os conteúdos das abas com Blindagem Dupla
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.setAttribute('hidden', 'true'); // Trava HTML
        content.style.setProperty('display', 'none', 'important'); // Trava inline
    });

    // 2. Remove o destaque de todos os botões
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-yellow-500', 'border-b-2', 'border-yellow-500');
        b.classList.add('text-gray-400');
    });

    // 3. Mostra o conteúdo da aba clicada
    const targetId = btn.dataset.tab;
    const targetContent = document.getElementById(targetId);

    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.removeAttribute('hidden'); // Destrava HTML
        targetContent.style.display = '';
    } else {
        console.warn(`Aba alvo não encontrada: ${targetId}`);
    }

    // 4. Destaca o botão clicado
    btn.classList.add('text-yellow-500', 'border-b-2', 'border-yellow-500');
    btn.classList.remove('text-gray-400');
});

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
    const viewTopic = document.getElementById('view-topic')

    // IDs das Telas
    const viewCatalog = document.getElementById('view-catalog');
    const viewAdmin = document.getElementById('view-admin');
    const viewSupport = document.getElementById('view-support');

    // ✨ 1. BLINDAGEM NATIVA ABSOLUTA: Esconde usando Tailwind, CSS inline e o atributo HTML
    const hideSecure = (el) => {
        if (!el) return;
        el.classList.add('hidden');
        el.setAttribute('hidden', 'true'); // Oculta mesmo se desativarem o CSS
        el.style.setProperty('display', 'none', 'important');
    };

    const showSecure = (el) => {
        if (!el) return;
        el.classList.remove('hidden');
        el.removeAttribute('hidden');
        el.style.display = '';
    };

    // Esconde todas por segurança antes de revelar a certa
    hideSecure(viewCatalog);
    hideSecure(viewAdmin);
    hideSecure(viewSupport);
    hideSecure(viewTopic);

    // 2. Lógica do TOPO (Cabeçalho)
    if (viewName === 'admin' || viewName === 'support') {
        hideSecure(header);
        hideSecure(searchBar);
        hideSecure(floatCapsule);
        document.body.classList.remove('pt-6');
    } else {
        showSecure(header);
        showSecure(searchBar);
        showSecure(floatCapsule);
    }

    // =========================================================
    // 3. MOSTRA A TELA ESPECÍFICA E MUDA O TÍTULO DA ABA
    // =========================================================
    const storeName = state.storeProfile?.name || 'Loja';

    if (viewName === 'admin') {
        showSecure(viewAdmin);
        if (typeof loadAdminSales === 'function') loadAdminSales();

        document.title = `${storeName} - Painel Admin`;

        if (typeof window.loadAvisos === 'function') window.loadAvisos();
    }
    else if (viewName === 'support') {
        showSecure(viewSupport);
        document.title = `Suporte - ${storeName}`;
    }
    else if (viewName === 'topic') {
        showSecure(viewTopic);
        document.title = `${storeName} - Informações`;
    }
    else {
        // Padrão: Catálogo (Vitrine)
        showSecure(viewCatalog);
        hideSecure(viewAdmin); // Reafirma a trava do admin!

        window.scrollTo({ top: 0, behavior: 'smooth' });
        document.title = `${storeName} - Catálogo`;

        if (window.activeAvisosListener) {
            window.activeAvisosListener();
            window.activeAvisosListener = null;
        }

        try {
            const alertIcon = document.getElementById('icone-avisos');
            if (alertIcon) alertIcon.classList.add('hidden');
        } catch (e) { }
    }

    if (typeof window.checkFooter === 'function') window.checkFooter();
}

// Atualiza o texto do botão de ordenar e reordena a lista
window.updateSortLabel = function (selectElement) {
    // 1. Atualiza o texto visual (Label)
    const label = document.getElementById('sort-label-display');
    if (label) {
        // Pega o texto da opção selecionada (ex: "Menor Preço")
        label.innerText = selectElement.options[selectElement.selectedIndex].text;

        // Remove qualquer cor fixa do Tailwind e aplica a cor de Destaque da Loja
        label.classList.remove('text-yellow-500', 'text-orange-500', 'text-gray-400');
        label.style.color = 'var(--txt-body)';
    }

    // 2. Chama a reordenação (usa a função existente)
    if (typeof renderCatalog === 'function') {
        renderCatalog(state.products);
    }
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

    // Se aprovou, dá baixa no estoque
    if (newStatus === 'Confirmado' && oldStatus !== 'Confirmado') {
        await processStockUpdate(order.items, 'remove');
    }
    // Se cancelou/reembolsou, devolve pro estoque
    if ((newStatus === 'Cancelado' || newStatus === 'Reembolsado') && oldStatus === 'Confirmado') {
        await processStockUpdate(order.items, 'add');
    }
};

window.openProductModal = (productId) => {
    const p = state.products.find(x => x.id === productId);
    if (!p) return;

    state.focusedProductId = productId;
    state.currentImgIndex = 0;

    const modal = document.getElementById('product-modal');
    const backdrop = document.getElementById('modal-backdrop');
    const card = document.getElementById('modal-card');

    if (!modal || !card) return;

    if (!document.getElementById('style-product-modal-image')) {
        const style = document.createElement('style');
        style.id = 'style-product-modal-image';
        style.innerHTML = `
            .hide-scroll::-webkit-scrollbar { display: none; } 
            .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            .thin-scroll::-webkit-scrollbar { width: 4px; }
            .thin-scroll::-webkit-scrollbar-track { background: transparent; }
            .thin-scroll::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; }
            
            #modal-img {
                position: absolute !important;
                inset: 0 !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                object-position: top center !important;
                z-index: 1 !important;
            }
            
            #modal-thumbnails {
                position: absolute !important;
                bottom: 20px !important;
                left: 0 !important;
                width: 100% !important;
                display: flex !important;
                justify-content: center !important;
                z-index: 10 !important;
            }
        `;
        document.head.appendChild(style);
    }

    card.className = "bg-gray-900 w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl border border-gray-700 flex flex-col md:flex-row overflow-hidden transform transition-all duration-300 pointer-events-auto relative scale-95 opacity-0 hide-scroll";

    const imgCol = card.children[1];
    const rightCol = card.children[2];

    if (imgCol) {
        imgCol.className = "w-full md:w-1/2 h-[40vh] md:h-auto relative shrink-0 overflow-hidden bg-black";
    }

    if (rightCol) {
        rightCol.className = "w-full md:w-1/2 flex flex-col bg-gray-900 overflow-y-auto relative hide-scroll md:max-h-[90vh]";
        if (rightCol.children[0]) rightCol.children[0].className = "p-6 md:p-8 pb-0 shrink-0";
        if (rightCol.children[1]) rightCol.children[1].className = "px-6 md:px-8 py-6 space-y-6 shrink-0 pb-10";
    }

    let images = p.images || [];
    if (images.length === 0) images = ['https://placehold.co/600'];
    if (typeof updateCarouselUI === 'function') updateCarouselUI(images);

    const instProfile = state.storeProfile.installments || { active: false, max: 12, freeUntil: 1 };
    const pixGlobal = state.storeProfile.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };

    const maxInstNoInterest = parseInt(instProfile.freeUntil) || 1;
    const maxInstTotal = parseInt(instProfile.max) || 12;

    const priceOriginal = parseFloat(p.price || 0);
    const priceFinal = parseFloat(p.promoPrice || p.price || 0);
    const hasPromo = p.promoPrice && p.promoPrice < p.price;

    let pixHtml = '';

    if (!pixGlobal.disableAll) {
        if (pixGlobal.active && pixGlobal.value > 0) {
            const isFixed = (pixGlobal.type === 'fixed');
            const badgeText = isFixed ? `R$ ${formatCurrency(pixGlobal.value)} OFF` : `${pixGlobal.value}% OFF`;
            const valueText = isFixed ? `${formatCurrency(pixGlobal.value)}` : `${pixGlobal.value}%`;

            if (pixGlobal.mode === 'total') {
                pixHtml = `
                <div class="flex flex-col gap-1 mt-1">
                    <div class="flex items-center gap-2 text-sm text-gray-300">
                        <i class="fab fa-pix text-green-400 text-lg"></i>
                        <span class="text-green-400 font-bold">${valueText} de Desconto</span>
                    </div>
                    <p class="text-[10px] text-gray-500 pl-6 italic">* Aplicado no valor total da venda.</p>
                </div>`;
            } else {
                let valDesconto = isFixed ? pixGlobal.value : priceFinal * (pixGlobal.value / 100);
                const finalPix = Math.max(0, priceFinal - valDesconto);

                pixHtml = `
                <div class="flex items-center gap-2 text-sm text-gray-300 mt-1">
                    <i class="fab fa-pix text-green-400 text-lg"></i>
                    <span><b>${formatCurrency(finalPix)}</b> no Pix <span class="text-green-400 text-[10px] font-bold bg-green-900/30 px-1.5 py-0.5 rounded ml-1">${badgeText}</span></span>
                </div>`;
            }
        } else if (p.paymentOptions && p.paymentOptions.pix && p.paymentOptions.pix.active) {
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

    let displayInst = (maxInstNoInterest > 1) ? maxInstNoInterest : maxInstTotal;
    let interestLabel = (maxInstNoInterest > 1) ? '<span class="text-green-400 font-bold text-xs ml-1">sem juros</span>' : '';
    const priceInstallment = priceFinal / displayInst;

    const elTitle = document.getElementById('modal-title');
    if (elTitle) elTitle.innerText = p.name;

    const elDesc = document.getElementById('modal-desc');
    if (elDesc) {
        const fullText = p.description || "Sem descrição detalhada.";
        elDesc.innerText = fullText;

        const oldBtn = document.getElementById('btn-read-more');
        if (oldBtn) oldBtn.remove();

        elDesc.style.maxHeight = 'unset';
        elDesc.style.overflowY = 'hidden';
        elDesc.classList.remove('thin-scroll');

        if (fullText.length > 150 || (fullText.match(/\n/g) || []).length > 2) {
            elDesc.style.display = '-webkit-box';
            elDesc.style.webkitLineClamp = '3';
            elDesc.style.webkitBoxOrient = 'vertical';
            elDesc.style.overflow = 'hidden';
            elDesc.style.whiteSpace = 'normal';

            const btnMore = document.createElement('button');
            btnMore.id = 'btn-read-more';
            btnMore.className = 'text-yellow-500 font-bold text-xs mt-2 hover:underline focus:outline-none transition';
            btnMore.innerText = 'Ver mais';

            btnMore.onclick = () => {
                if (elDesc.style.webkitLineClamp === '3') {
                    elDesc.style.webkitLineClamp = 'unset';
                    elDesc.style.whiteSpace = 'pre-line';
                    btnMore.innerText = 'Ver menos';
                } else {
                    elDesc.style.webkitLineClamp = '3';
                    elDesc.style.whiteSpace = 'normal';
                    btnMore.innerText = 'Ver mais';
                }
            };
            elDesc.parentNode.insertBefore(btnMore, elDesc.nextSibling);
        } else {
            elDesc.style.webkitLineClamp = 'unset';
            elDesc.style.whiteSpace = 'pre-line';
        }
    }

    const elPrice = document.getElementById('modal-price');
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

    const sizesWrapper = document.getElementById('modal-sizes-wrapper');
    const sizesDiv = document.getElementById('modal-sizes');
    const btnAdd = document.getElementById('modal-add-cart');

    if (sizesWrapper && btnAdd && sizesWrapper.parentElement === btnAdd.parentElement) {
        const parent = btnAdd.parentElement;
        parent.classList.remove('flex', 'flex-col');
        sizesWrapper.style.order = '';
        btnAdd.style.order = '';

        parent.appendChild(sizesWrapper);
        parent.appendChild(btnAdd);

        btnAdd.style.marginTop = '16px';
    }

    let selectedSizeInModal = null;

    const allowNegative = state.globalSettings.allowNoStock || p.allowNoStock;
    const isSizeOutOfStock = (sizeStock) => sizeStock <= 0 && !allowNegative;

    if (sizesDiv) {
        sizesDiv.innerHTML = '';

        if (p.hasVariations && p.sizes && p.sizes.length > 0) {
            // ✨ ESTOQUE GRADEADO
            if (sizesWrapper) sizesWrapper.classList.remove('hidden');

            const formattedSizes = p.sizes.map(s => {
                if (typeof s === 'object') return s;
                return { name: s, stock: p.stock };
            });

            selectedSizeInModal = formattedSizes.find(s => !isSizeOutOfStock(s.stock)) || formattedSizes[0];

            formattedSizes.forEach(s => {
                const btn = document.createElement('button');
                const outOfStock = isSizeOutOfStock(s.stock);

                if (outOfStock) {
                    btn.className = `w-10 h-10 rounded border border-gray-700 bg-gray-800/50 text-gray-500 font-bold flex items-center justify-center text-sm cursor-not-allowed relative overflow-hidden`;
                    btn.innerHTML = `<span class="opacity-50">${s.name}</span><div class="absolute inset-0 w-[140%] h-[1px] bg-red-500/70 transform origin-top-left rotate-45"></div>`;
                } else if (s.name === selectedSizeInModal.name) {
                    btn.className = `w-10 h-10 rounded border border-yellow-500 bg-yellow-500 text-black font-bold transition flex items-center justify-center text-sm`;
                    btn.innerHTML = `<span>${s.name}</span>`;
                } else {
                    btn.className = `w-10 h-10 rounded border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center text-sm`;
                    btn.innerHTML = `<span>${s.name}</span>`;
                }

                btn.onclick = () => {
                    if (outOfStock) return;
                    selectedSizeInModal = s;

                    Array.from(sizesDiv.children).forEach((b, idx) => {
                        const curS = formattedSizes[idx];
                        if (isSizeOutOfStock(curS.stock)) return;

                        if (curS.name === s.name) {
                            b.className = "w-10 h-10 rounded border border-yellow-500 bg-yellow-500 text-black font-bold transition flex items-center justify-center text-sm";
                        } else {
                            b.className = "w-10 h-10 rounded border border-gray-600 text-gray-300 font-bold hover:border-yellow-500 hover:text-yellow-500 transition flex items-center justify-center text-sm";
                        }
                    });
                    updateAddToCartBtn();
                };
                sizesDiv.appendChild(btn);
            });
        } else {
            // ✨ ESTOQUE GERAL: Exibe "Tamanho Único" em vez de esconder tudo
            if (sizesWrapper) sizesWrapper.classList.remove('hidden');

            const currentStock = isNaN(parseInt(p.stock, 10)) ? 0 : parseInt(p.stock, 10);
            const isOut = currentStock <= 0 && !allowNegative;

            const btnSingle = document.createElement('div');

            if (isOut) {
                btnSingle.className = `px-4 h-10 rounded border border-gray-700 bg-gray-800/50 text-gray-500 font-bold flex items-center justify-center text-sm cursor-not-allowed relative overflow-hidden`;
                btnSingle.innerHTML = `<span class="opacity-50">Único</span><div class="absolute inset-0 w-[140%] h-[1px] bg-red-500/70 transform origin-top-left rotate-6"></div>`;
            } else {
                btnSingle.className = `px-4 h-10 rounded border border-yellow-500 bg-yellow-500 text-black font-bold flex items-center justify-center text-sm select-none`;
                btnSingle.innerHTML = `<span>Único</span>`;
            }
            sizesDiv.appendChild(btnSingle);
        }
    }

    const updateAddToCartBtn = () => {
        const btnAdd = document.getElementById('modal-add-cart');
        if (!btnAdd) return;

        let currentStock = 0;

        if (p.hasVariations && selectedSizeInModal) {
            currentStock = selectedSizeInModal.stock;
        } else {
            currentStock = isNaN(parseInt(p.stock, 10)) ? 0 : parseInt(p.stock, 10);
        }

        const isOut = currentStock <= 0 && !allowNegative;

        if (isOut) {
            btnAdd.disabled = true;
            btnAdd.innerHTML = "<span>ESGOTADO</span>";
            btnAdd.className = "w-full bg-gray-700 text-gray-500 font-bold text-sm py-4 rounded-xl cursor-not-allowed uppercase tracking-wide flex items-center justify-center";
        } else {
            btnAdd.disabled = false;
            btnAdd.innerHTML = `<i class="fas fa-shopping-bag mr-2"></i><span>ADICIONAR</span>`;
            btnAdd.className = "w-full bg-green-600 hover:bg-green-500 text-white font-bold text-sm py-4 rounded-xl shadow-lg shadow-green-900/50 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide";

            // Manda o código "U" pro carrinho para o carrinho não desenhar caixa nenhuma!
            const sizeNamePass = (p.hasVariations && selectedSizeInModal) ? selectedSizeInModal.name : 'U';
            btnAdd.onclick = () => { addToCart(p, sizeNamePass); closeProductModal(); };
        }
    };

    updateAddToCartBtn();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        backdrop.classList.remove('opacity-0');
        card.classList.remove('opacity-0', 'scale-95');
        card.classList.add('opacity-100', 'scale-100');
    }, 10);
};

// 2. Desenha a caixinha igual à imagem
window.renderVariationBadges = () => {
    const container = document.getElementById('variations-container');
    if (!container) return;

    let html = `
        <div class="flex flex-col items-center shrink-0 mr-4">
            <span class="text-gray-400 text-[9px] font-bold mb-1 w-12 text-center leading-tight">Adicionar<br>Tamanho</span>
            <button type="button" onclick="openVariationModal()" class="w-12 h-12 rounded border border-gray-500 hover:border-yellow-500 hover:text-yellow-500 flex items-center justify-center text-white text-xl transition bg-black">
                <i class="fas fa-plus"></i>
            </button>
        </div>
    `;

    let totalStock = 0;

    (state.tempVariations || []).forEach((v, index) => {
        totalStock += parseInt(v.stock) || 0;
        html += `
            <div class="flex items-end gap-2 shrink-0 group cursor-pointer" ondblclick="openVariationModal(${index})">
                ${index === 0 ? `<span class="text-gray-400 text-[10px] font-bold mb-3 mr-1">Estoque:</span>` : ''}
                <div class="border border-gray-600 rounded overflow-hidden flex flex-col w-12 text-center transition group-hover:border-yellow-500 select-none">
                    <div class="bg-gray-500 text-white font-bold py-1 border-b border-gray-600 text-sm truncate px-1" title="${v.name}">${v.name}</div>
                    <div class="bg-black text-white font-bold py-2 text-sm">${v.stock}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    document.getElementById('var-total-count').innerText = (state.tempVariations || []).length;
    document.getElementById('var-total-stock').innerText = totalStock;
};

// 3. Modais de Variação
window.openVariationModal = (index = null) => {
    const modal = document.getElementById('variation-modal');
    const title = document.getElementById('variation-modal-title');
    const inputName = document.getElementById('var-name');
    const inputStock = document.getElementById('var-stock');
    const inputIndex = document.getElementById('var-edit-index');
    const btnDelete = document.getElementById('btn-delete-var');

    if (index !== null) {
        title.innerText = 'Editar Tamanho';
        const v = state.tempVariations[index];
        inputName.value = v.name;
        inputStock.value = v.stock;
        inputIndex.value = index;
        btnDelete.classList.remove('hidden');
    } else {
        title.innerText = 'Novo Tamanho';
        inputName.value = '';
        inputStock.value = '';
        inputIndex.value = '';
        btnDelete.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('variation-card').classList.remove('scale-95');
    }, 10);

    inputName.focus();
};

window.closeVariationModal = () => {
    const modal = document.getElementById('variation-modal');
    modal.classList.add('opacity-0');
    document.getElementById('variation-card').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.saveVariation = () => {
    const name = document.getElementById('var-name').value.trim().toUpperCase();
    const stock = parseInt(document.getElementById('var-stock').value) || 0;
    const index = document.getElementById('var-edit-index').value;

    if (!name) return showToast("Informe o nome do tamanho.", "error");
    if (!state.tempVariations) state.tempVariations = [];

    // Checa se o tamanho já existe
    const existingIndex = state.tempVariations.findIndex(v => v.name === name);
    if (existingIndex !== -1 && existingIndex.toString() !== index) {
        return showToast("Este tamanho já existe!", "error");
    }

    if (index === '') {
        state.tempVariations.push({ name, stock }); // Adiciona novo
    } else {
        state.tempVariations[index] = { name, stock }; // Edita existente
    }

    renderVariationBadges();
    closeVariationModal();
};

// 4. Bloqueia Exclusão se Tiver Pedido Pendente
window.deleteVariation = () => {
    const index = document.getElementById('var-edit-index').value;
    if (index === '') return;

    const prodId = document.getElementById('edit-prod-id').value;
    const sizeName = state.tempVariations[index].name;

    // Se o produto já existir no banco, verifica os pedidos pendentes
    if (prodId) {
        const hasPendingOrder = state.orders.some(order =>
            order.status === 'Pendente' &&
            order.items.some(item => item.id === prodId && item.size === sizeName)
        );

        if (hasPendingOrder) {
            alert(`❌ EXCLUSÃO BLOQUEADA\n\nVocê não pode excluir o tamanho "${sizeName}" pois existem pedidos 'Pendentes' aguardando por este item.\nCancele ou confirme o pedido antes de excluir a variação.`);
            return;
        }
    }

    if (confirm(`Tem certeza que deseja excluir o tamanho ${sizeName}?`)) {
        state.tempVariations.splice(index, 1);
        renderVariationBadges();
        closeVariationModal();
    }
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

    if (delta > 0) {
        const allowNegative = state.globalSettings.allowNoStock || product.allowNoStock;

        // ✨ CORREÇÃO DA GRADE: Filtra apenas por ID e Tamanho idênticos
        const currentSizeQty = state.cart.reduce((total, item) => {
            return (item.id === prodId && item.size === size) ? total + item.qty : total;
        }, 0);

        // ✨ CORREÇÃO DA GRADE: Pega o limite do tamanho específico
        let limEstoque = isNaN(parseInt(product.stock, 10)) ? 0 : parseInt(product.stock, 10);
        if (product.hasVariations && product.sizes) {
            const sizeObj = product.sizes.find(s => s.name === size);
            limEstoque = sizeObj ? (parseInt(sizeObj.stock) || 0) : 0;
        }

        if (!allowNegative && (currentSizeQty + 1 > limEstoque)) {
            alert(`Estoque máximo atingido para o tamanho ${size}.`);
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

        // ✨ CORREÇÃO DA GRADE: Conta apenas as unidades do mesmo tamanho no carrinho
        const currentSizeQty = state.cart.reduce((total, cartItem) => {
            return (cartItem.id === item.id && cartItem.size === item.size) ? total + cartItem.qty : total;
        }, 0);

        // ✨ CORREÇÃO DA GRADE: Pega o estoque real apenas deste tamanho
        let limEstoque = isNaN(parseInt(product.stock, 10)) ? 0 : parseInt(product.stock, 10);
        if (product.hasVariations && product.sizes) {
            const sizeObj = product.sizes.find(s => s.name === item.size);
            limEstoque = sizeObj ? (parseInt(sizeObj.stock) || 0) : 0;
        }

        if (!allowNegative && (currentSizeQty + 1 > limEstoque)) {
            alert(`Limite de estoque atingido para o tamanho ${item.size}. Disponível: ${limEstoque} unid.`);
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

// =================================================================
// 📦 SALVAR E EDITAR PRODUTOS (ESTOQUE HÍBRIDO DEFINITIVO)
// =================================================================
// =================================================================
// 📦 ALTERNA ENTRE GERAL E GRADEADO (TOTALMENTE INDEPENDENTES)
// =================================================================
window.toggleStockMode = () => {
    const isGraded = document.getElementById('prod-has-variations').checked;
    const divGen = document.getElementById('div-general-stock');
    const divVar = document.getElementById('div-variations-stock');

    if (isGraded) {
        // Esconde o Estoque Geral e mostra a Grade
        divGen.classList.add('hidden');
        divVar.classList.remove('hidden');
        divVar.classList.add('flex');
        if (typeof renderVariationBadges === 'function') renderVariationBadges();
    } else {
        // Esconde a Grade e volta o Estoque Geral.
        // Nenhuma matemática é feita aqui! O valor fica intacto.
        divGen.classList.remove('hidden');
        divVar.classList.add('hidden');
        divVar.classList.remove('flex');
    }
};

// =================================================================
// 📦 SALVAR PRODUTO NO BANCO (COM SEPARAÇÃO DE ESTOQUES)
// =================================================================
window.saveProduct = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const btnSave = document.querySelector('#form-product button[type="submit"]');
    const originalText = btnSave ? btnSave.innerText : 'Salvar';

    try {
        if (btnSave) { btnSave.innerText = 'Salvando...'; btnSave.disabled = true; }

        const id = document.getElementById('edit-prod-id').value;
        const prodName = document.getElementById('prod-name').value.trim();

        // =================================================================
        // 🛡️ TRAVA CONTRA NOME DUPLICADO
        // =================================================================
        const nameExists = state.products.some(p => {
            if (id && p.id === id) return false;
            return p.name.toLowerCase().trim() === prodName.toLowerCase();
        });

        if (nameExists) {
            showToast("Já existe um produto com este nome!", "error");
            if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
            return;
        }
        // =================================================================

        const isGraded = document.getElementById('prod-has-variations').checked;

        // Blindagem de Segurança
        const statusActive = document.getElementById('prod-status-active');
        const isActive = statusActive ? statusActive.checked : true;

        const inputGeneralStock = parseInt(document.getElementById('prod-stock').value) || 0;
        let finalStock = 0;
        let finalSizes = state.tempVariations ? [...state.tempVariations] : [];

        if (isGraded) {
            if (finalSizes.length === 0) {
                showToast("Adicione pelo menos um tamanho no estoque gradeado.", "error");
                if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
                return;
            }
            finalStock = finalSizes.reduce((acc, val) => acc + parseInt(val.stock || 0), 0);
        } else {
            finalStock = inputGeneralStock;
        }

        if (!state.tempImages || state.tempImages.length === 0) {
            showToast("Adicione pelo menos uma imagem!", "error");
            if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
            return;
        }

        const productData = {
            name: document.getElementById('prod-name').value,
            category: document.getElementById('prod-cat-select').value,
            description: document.getElementById('prod-desc').value,
            price: parseFloat(document.getElementById('prod-price').value.replace(/\./g, '').replace(',', '.')) || 0,
            promoPrice: parseFloat(document.getElementById('prod-promo').value.replace(/\./g, '').replace(',', '.')) || null,
            cost: parseFloat(document.getElementById('prod-cost').value.replace(/\./g, '').replace(',', '.')) || null,
            hasVariations: isGraded,
            stock: finalStock,
            generalStock: inputGeneralStock,
            sizes: finalSizes,
            images: state.tempImages || [],
            allowNoStock: document.getElementById('prod-allow-no-stock').checked,
            active: isActive,
            highlight: document.getElementById('prod-highlight').checked,
            paymentOptions: {
                pix: {
                    active: document.getElementById('prod-pix-active').checked,
                    val: parseFloat(document.getElementById('prod-pix-val').value.replace(/\./g, '').replace(',', '.')) || 0,
                    type: document.getElementById('prod-pix-type').value
                }
            }
        };

        if (!id) {
            const nextCode = await getNextProductCode(state.siteId);
            productData.code = nextCode;
            productData.createdAt = new Date().toISOString();

            const docRef = await addDoc(collection(db, `sites/${state.siteId}/products`), productData);
            productData.id = docRef.id;

            const index = state.products.findIndex(p => p.id === docRef.id);
            if (index === -1) {
                state.products.push(productData);
            } else {
                state.products[index] = productData;
            }

            showToast(`Produto #${nextCode} criado com sucesso!`, 'success');
        } else {
            await updateDoc(doc(db, `sites/${state.siteId}/products`, id), productData);
            const idx = state.products.findIndex(p => p.id === id);
            if (idx !== -1) state.products[idx] = { ...state.products[idx], ...productData };

            showToast('Produto atualizado com sucesso!', 'success');
        }

        document.getElementById('product-form-modal').classList.add('hidden');
        document.getElementById('form-product').reset();
        state.tempImages = [];
        state.tempVariations = [];

        const formEl = document.getElementById('form-product');
        if (formEl) formEl.onsubmit = window.saveProduct;

        setCachedData(`prods_${state.siteId}`, state.products, 5);
        renderCatalog(state.products);
        if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();

        // ✨ CORREÇÃO AQUI: Força as estatísticas (Capital de Giro) a se atualizarem imediatamente
        if (typeof calculateStatsMetrics === 'function') calculateStatsMetrics();

    } catch (error) {
        alert('Erro ao salvar: ' + error.message);
    } finally {
        if (btnSave) { btnSave.innerText = originalText; btnSave.disabled = false; }
    }
};

// =================================================================
// 📦 ABRIR PRODUTO PARA EDITAR (LENDO OS ESTOQUES SEPARADOS)
// =================================================================
window.editProduct = (id) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return;

    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('prod-name').value = p.name;
    document.getElementById('prod-cat-select').value = p.category || "";
    document.getElementById('prod-desc').value = p.description || "";
    document.getElementById('prod-price').value = formatMoneyForInput(p.price);
    document.getElementById('prod-promo').value = formatMoneyForInput(p.promoPrice);
    document.getElementById('prod-cost').value = formatMoneyForInput(p.cost);

    document.getElementById('prod-allow-no-stock').checked = p.allowNoStock || false;
    document.getElementById('prod-highlight').checked = p.highlight || false;

    if (p.generalStock !== undefined) {
        document.getElementById('prod-stock').value = p.generalStock;
    } else {
        document.getElementById('prod-stock').value = p.hasVariations ? 0 : (p.stock || 0);
    }

    state.tempVariations = [];
    if (Array.isArray(p.sizes) && p.sizes.length > 0) {
        state.tempVariations = p.sizes.map(s => {
            if (typeof s === 'object') return s;
            return { name: s, stock: p.stock || 0 };
        });
    }

    const chkVar = document.getElementById('prod-has-variations');
    if (p.hasVariations) chkVar.checked = true;
    else chkVar.checked = false;

    // Blindagem de Segurança
    const statusInactive = document.getElementById('prod-status-inactive');
    const statusActive = document.getElementById('prod-status-active');

    if (statusInactive && statusActive) {
        if (p.active === false) statusInactive.checked = true;
        else statusActive.checked = true;
    }

    toggleStockMode();

    state.tempImages = p.images ? [...p.images] : [];
    if (typeof renderImagePreviews === 'function') renderImagePreviews();

    const pixData = p.paymentOptions?.pix || { active: false, val: 0, type: 'percent' };
    document.getElementById('prod-pix-active').checked = pixData.active;
    document.getElementById('prod-pix-val').value = pixData.type === 'percent' ? pixData.val : formatMoneyForInput(pixData.val);
    document.getElementById('prod-pix-type').value = pixData.type;

    document.getElementById('product-form-modal').classList.remove('hidden');
};

// ✨ IMPORTANTE: Zera o formulário caso o usuário vá criar um NOVO produto
window.openNewProductModal = () => {
    // Blindagem de Segurança
    const statusActive = document.getElementById('prod-status-active');
    if (statusActive) statusActive.checked = true;

    const form = document.getElementById('form-product');
    if (form) form.reset();

    document.getElementById('edit-prod-id').value = '';
    state.tempImages = [];
    state.tempVariations = [];

    document.getElementById('prod-has-variations').checked = false;
    toggleStockMode();

    if (typeof renderImagePreviews === 'function') renderImagePreviews();
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



// ===============================================
// LÓGICA DO CAMPO DE BUSCA E BOTÃO "X"
// ===============================================
window.limparBusca = function () {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    if (searchInput) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
        searchInput.focus();
        // Reseta o catálogo
        filterByCat(document.getElementById('category-filter')?.value || '');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const clearSearchBtn = document.getElementById('clear-search-btn');
            const currentCat = document.getElementById('category-filter')?.value || '';

            // Aparece o botão de (X)
            if (term.length > 0 && clearSearchBtn) {
                clearSearchBtn.classList.remove('hidden');
            } else if (clearSearchBtn) {
                clearSearchBtn.classList.add('hidden');
            }

            // Filtra os produtos
            let filtered = state.products;
            if (currentCat) {
                filtered = filtered.filter(p => p.category === currentCat || p.category.startsWith(currentCat + ' -'));
            }

            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.description && p.description.toLowerCase().includes(term)) ||
                (p.code && String(p.code).includes(term))
            );
            renderCatalog(filtered);
        });
    }
});

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

async function addToCart(product, size) {
    // ✨ VALIDAÇÃO DE SEGURANÇA NO SERVIDOR (Leitura única, só no clique)
    const prodRef = doc(db, `sites/${state.siteId}/products`, product.id);
    const snap = await getDocFromServer(prodRef); // Lê do servidor na hora do clique
    const pAtualizado = snap.data();

    const allowNegative = state.globalSettings.allowNoStock || pAtualizado.allowNoStock;

    // ✨ CORREÇÃO DA GRADE: Descobre o limite real de estoque para este tamanho específico NO SERVIDOR
    let limEstoque = isNaN(parseInt(pAtualizado.stock, 10)) ? 0 : parseInt(pAtualizado.stock, 10);
    if (pAtualizado.hasVariations && pAtualizado.sizes) {
        const sizeObj = pAtualizado.sizes.find(s => s.name === size);
        limEstoque = sizeObj ? (parseInt(sizeObj.stock) || 0) : 0;
    }

    if (!allowNegative && limEstoque <= 0) {
        alert(pAtualizado.hasVariations ? `Desculpe, o tamanho ${size} esgotou!` : 'Desculpe, este produto acabou de esgotar!');
        loadProducts(true); // Atualiza a vitrine forçado
        return;
    }

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

    // ✨ CORREÇÃO DA GRADE: Calcula a quantidade DESTE TAMANHO específico já no carrinho
    const currentSizeQty = state.cart.reduce((total, item) => {
        return (item.id === product.id && item.size === size) ? total + item.qty : total;
    }, 0);

    // 4. Valida se adicionar +1 vai estourar o estoque do tamanho selecionado
    if (!allowNegative && (currentSizeQty + 1 > limEstoque)) {
        alert(`Limite de estoque atingido! Você já tem ${currentSizeQty} unidade(s) do tamanho ${size} no carrinho e o estoque disponível é ${limEstoque}.`);
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
    // Agora ele salva numa gaveta exclusiva, ex: "cart_loja-do-joao"
    localStorage.setItem(`cart_${state.siteId}`, JSON.stringify(state.cart));
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
    const linkedProducts = state.products.filter(p =>
        p.category === name || (p.category && p.category.startsWith(name + ' - '))
    );

    if (linkedProducts.length > 0) {
        alert(`❌ AÇÃO BLOQUEADA\n\nNão é possível excluir a categoria "${name}".\n\nExistem ${linkedProducts.length} produto(s) vinculados a ela ou às suas subcategorias.\nPor favor, mova ou exclua esses produtos antes de apagar a categoria.`);
        return;
    }

    const linkedSubCats = state.categories.filter(c =>
        c.id !== id && c.name.startsWith(name + ' - ')
    );

    let msgConfirmacao = `Tem certeza que deseja excluir a categoria "${name}"?`;

    if (linkedSubCats.length > 0) {
        msgConfirmacao = `⚠️ ATENÇÃO!\n\nA categoria "${name}" possui ${linkedSubCats.length} subcategoria(s) dentro dela.\n\nSe você prosseguir, a categoria principal e TODAS AS SUBCATEGORIAS serão apagadas juntas!\n\nDeseja excluir tudo?`;
    }

    if (!confirm(msgConfirmacao)) return;

    try {
        await deleteDoc(doc(db, `sites/${state.siteId}/categories`, id));

        if (linkedSubCats.length > 0) {
            const batchPromises = linkedSubCats.map(sub =>
                deleteDoc(doc(db, `sites/${state.siteId}/categories`, sub.id))
            );
            await Promise.all(batchPromises);
        }

        if (state.selectedCategoryParent === name || (state.selectedCategoryParent && state.selectedCategoryParent.startsWith(name + ' - '))) {
            state.selectedCategoryParent = null;
            const newCatNameEl = document.getElementById('new-cat-name');
            if (newCatNameEl) newCatNameEl.placeholder = "Nome da Categoria Principal...";
        }

        // ✨ CORREÇÃO: Limpa o cache e recarrega a tela instantaneamente
        localStorage.removeItem(`cats_${state.siteId}`);
        await loadCategories();
        renderAdminCategoryList();

        showToast('Categoria excluída com sucesso!', 'success');
    } catch (error) {
        console.error(error);
        alert('Erro ao excluir: ' + error.message);
    }
};

window.editCoupon = (id) => {
    const c = state.coupons.find(x => x.id === id);
    if (!c) return;

    document.getElementById('coupon-code').value = c.code;
    document.getElementById('coupon-val').value = c.val;
    document.getElementById('coupon-is-percent').checked = (c.type === 'percent');

    if (c.expiryDate) {
        const d = new Date(c.expiryDate);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        document.getElementById('coupon-expiry').value = d.toISOString().slice(0, 16);
    } else {
        document.getElementById('coupon-expiry').value = '';
    }

    state.editingCouponId = id;

    const btnAdd = document.getElementById('btn-add-coupon');
    if (btnAdd) {
        btnAdd.innerHTML = '<i class="fas fa-save"></i> <span>Salvar Alteração</span>';
        btnAdd.classList.replace('bg-green-600', 'bg-blue-600');
        btnAdd.classList.replace('hover:bg-green-500', 'hover:bg-blue-500');
    }

    const btnCancel = document.getElementById('btn-cancel-coupon');
    if (btnCancel) btnCancel.classList.remove('hidden');

    document.getElementById('coupon-code').focus();
    showToast(`Editando: ${c.code}`, 'info');
};

window.resetCouponForm = () => {
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-val').value = '';
    document.getElementById('coupon-expiry').value = '';
    document.getElementById('coupon-is-percent').checked = false;

    state.editingCouponId = null;

    const btnAdd = document.getElementById('btn-add-coupon');
    if (btnAdd) {
        btnAdd.innerHTML = '<i class="fas fa-plus"></i> <span>Criar Cupom</span>';
        btnAdd.classList.remove('bg-blue-600', 'hover:bg-blue-500');
        btnAdd.classList.add('bg-green-600', 'hover:bg-green-500');
    }

    const btnCancel = document.getElementById('btn-cancel-coupon');
    if (btnCancel) btnCancel.classList.add('hidden');
};

window.resetCouponForm = () => {
    document.getElementById('coupon-code').value = '';
    document.getElementById('coupon-val').value = '';
    document.getElementById('coupon-expiry').value = '';
    document.getElementById('coupon-is-percent').checked = false;

    // Limpa a caixinha
    const chkOffered = document.getElementById('coupon-is-offered');
    if (chkOffered) chkOffered.checked = false;

    state.editingCouponId = null;

    const btnAdd = document.getElementById('btn-add-coupon');
    if (btnAdd) {
        btnAdd.innerHTML = '<i class="fas fa-plus"></i> <span>Criar Cupom</span>';
        btnAdd.classList.remove('bg-blue-600', 'hover:bg-blue-500');
        btnAdd.classList.add('bg-green-600', 'hover:bg-green-500');
    }

    const btnCancel = document.getElementById('btn-cancel-coupon');
    if (btnCancel) btnCancel.classList.add('hidden');
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

            if (!state.user && typeof showOfferedCoupon === 'function') {
                showOfferedCoupon();
            }
        });

    } catch (error) {
        // Se o erro foi o nosso bloqueio proposital, não faz nada (já limpamos a tela)
        if (error.message === "STOP_EXECUTION") return;

        console.error("Erro ao inicializar loja:", error);
    }
}

function renderStoreProfile() {
    const p = state.storeProfile;

    if (p.name) {
        document.title = `${p.name} - Catálogo`;
    }

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

        // ✨ CORREÇÃO DO CLIQUE NA LOGO ✨
        // Procura o link <a> que envolve a logo e o texto
        const logoLink = navLogo.closest('a') || navText.closest('a');
        if (logoLink) {
            // Remove o href="index.html" que estava quebrando o site
            logoLink.removeAttribute('href');
            logoLink.style.cursor = 'pointer';

            // Faz o clique apenas voltar para a vitrine inicial da loja atual
            logoLink.onclick = (e) => {
                e.preventDefault(); // Impede o navegador de tentar mudar a URL
                if (typeof showView === 'function') showView('catalog');
                if (typeof filterByCat === 'function') filterByCat(''); // Limpa qualquer filtro
            };
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

    const elCardDetails = document.getElementById('conf-card-details');
    if (elCardDetails) {
        if (inst.active) elCardDetails.classList.remove('opacity-50', 'pointer-events-none');
        else elCardDetails.classList.add('opacity-50', 'pointer-events-none');
    }

    // 3. Configurações de Pedido
    const dConfig = p.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5, shippingRule: 'none', shippingValue: 0 };
    const settings = p.settings || {};

    setCheck('conf-own-delivery', dConfig.ownDelivery);

    const reqCode = dConfig.reqCustomerCode !== undefined ? dConfig.reqCustomerCode : (settings.reqClientCode || false);
    const cancelTime = dConfig.cancelTimeMin !== undefined ? dConfig.cancelTimeMin : (settings.cancellationTime || 5);

    setCheck('conf-req-code', reqCode);
    setVal('conf-cancel-time', cancelTime);
    setVal('conf-shipping-rule', dConfig.shippingRule || 'none');
    setVal('conf-shipping-value', typeof formatMoneyForInput === 'function' ? formatMoneyForInput(dConfig.shippingValue) : dConfig.shippingValue);

    const elShipCont = document.getElementById('shipping-value-container');
    if (elShipCont) {
        if (dConfig.shippingRule && dConfig.shippingRule !== 'none') elShipCont.classList.remove('opacity-50', 'pointer-events-none');
        else elShipCont.classList.add('opacity-50', 'pointer-events-none');
    }

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
        if (hours.active) hoursDiv.classList.remove('opacity-50', 'pointer-events-none');
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

    // ✨ 7. PIX GLOBAL (CORREÇÃO: AGORA ELE CARREGA QUANDO VOCÊ ABRE O ADMIN)
    const pg = p.pixGlobal || { disableAll: false, active: false, value: 0, mode: 'product', type: 'percent' };
    setCheck('conf-pix-disable-all', pg.disableAll);
    setCheck('conf-pix-global-active', pg.active);
    setVal('conf-pix-global-value', pg.value);

    const rMode = document.querySelector(`input[name="conf-pix-mode"][value="${pg.mode}"]`);
    if (rMode) rMode.checked = true;

    const rType = document.querySelector(`input[name="conf-pix-type"][value="${pg.type || 'percent'}"]`);
    if (rType) rType.checked = true;

    // Atualiza Visual
    if (typeof updatePaymentVisuals === 'function') updatePaymentVisuals();
    if (typeof togglePixGlobalUI === 'function') togglePixGlobalUI();

    // Atualiza painel e vitrine de tópicos
    if (typeof renderAdminTopics === 'function') renderAdminTopics();
    if (typeof renderSidebarTopics === 'function') renderSidebarTopics();
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
            active: getCheck(els.confCardActive),
            max: parseInt(getVal(els.confCardMax)) || 12,
            freeUntil: parseInt(getVal(els.confCardFree)) || 3,
            rate: parseFloat(getVal(els.confCardRate).replace(',', '.')) || 0
        }
    };

    try {
        // ✨ O TRUQUE MÁGICO AQUI: { merge: true }
        // Isso avisa o banco de dados para NÃO apagar o que não foi enviado (como o frete e a entrega)
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), data, { merge: true });

        // ✨ CORREÇÃO NA MEMÓRIA DA TELA: 
        // Mesclamos os dados antigos com os novos, assim o frete não some da tela antes de atualizar a página
        state.storeProfile = { ...state.storeProfile, ...data };

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

    const elDistDisplay = document.getElementById('distance-display');
    const elErrorMsg = document.getElementById('delivery-error-msg');
    const elErrorDiv = document.getElementById('delivery-error');
    const elAddrFields = document.getElementById('address-fields');
    const elLoading = document.getElementById('cep-loading');
    const btnFinish = document.getElementById('btn-finish-payment');

    // 1. Bloqueia o botão de finalizar IMEDIATAMENTE ao iniciar
    if (btnFinish) {
        btnFinish.disabled = true;
        btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
    }

    // 2. Reseta estado de segurança global
    if (typeof checkoutState !== 'undefined') {
        checkoutState.isValidDelivery = false;
        checkoutState.distance = 0;
    }

    if (cep.length !== 8) return;

    // 3. Feedback Visual Inicial
    if (elLoading) elLoading.classList.remove('hidden');
    if (elErrorDiv) elErrorDiv.classList.add('hidden');
    if (elDistDisplay) {
        elDistDisplay.innerText = "Calculando frete...";
        elDistDisplay.className = "text-yellow-500 font-bold text-xs mt-1 block";
    }

    try {
        // A. Preenche endereço via ViaCEP
        const viaCepRes = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await viaCepRes.json();

        if (data.erro) throw new Error("CEP não encontrado.");

        if (document.getElementById('checkout-street')) document.getElementById('checkout-street').value = data.logradouro || '';
        if (document.getElementById('checkout-district')) document.getElementById('checkout-district').value = data.bairro || '';
        if (document.getElementById('checkout-city')) document.getElementById('checkout-city').value = `${data.localidade} - ${data.uf}`;

        if (elAddrFields) elAddrFields.classList.remove('opacity-50', 'pointer-events-none');
        document.getElementById('checkout-number')?.focus();

        // B. Cálculo de Distância (AGORA TOTALMENTE INDEPENDENTE)
        const storeCep = state.storeProfile.cep ? state.storeProfile.cep.replace(/\D/g, '') : '';
        const maxDist = parseFloat(state.storeProfile.maxDistance) || 0;

        if (!storeCep) {
            // Se a loja não configurou o próprio CEP no painel, não tem como calcular a distância
            if (elDistDisplay) {
                elDistDisplay.innerText = "⚠️ CEP da loja não configurado.";
                elDistDisplay.className = "text-orange-500 font-bold text-xs mt-1 block";
            }
            if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true; // Libera a venda
        } else {
            // Calcula distância real
            const dist = await calculateDist_FinalV3(storeCep, cep);

            if (dist === null || isNaN(dist)) {
                // Se a API de mapa falhar e tivermos um limite rigoroso, bloqueia.
                if (maxDist > 0) {
                    if (elDistDisplay) {
                        elDistDisplay.innerText = "⛔ Rota indisponível no mapa.";
                        elDistDisplay.className = "text-red-500 font-bold text-xs mt-1 block";
                    }
                    if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = false;
                    throw new Error("Não foi possível traçar a rota até este CEP.");
                } else {
                    // Sem limite configurado, deixa passar com aviso
                    if (elDistDisplay) {
                        elDistDisplay.innerText = "⚠️ Rota não calculada (Sem limite)";
                        elDistDisplay.className = "text-orange-500 font-bold text-xs mt-1 block";
                    }
                    if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true;
                }
            } else {
                if (typeof checkoutState !== 'undefined') checkoutState.distance = dist;
                const distText = dist.toFixed(1).replace('.', ',');

                // VALIDAÇÃO PRINCIPAL: Passou do limite?
                if (maxDist > 0 && dist > maxDist) {
                    if (elDistDisplay) {
                        elDistDisplay.innerText = `⛔ Indisponível: ${distText}km (Máx: ${maxDist}km)`;
                        elDistDisplay.className = "text-red-500 font-bold text-xs mt-1 block";
                    }
                    if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = false;
                    throw new Error(`Endereço muito distante (${distText}km). O limite da loja é de ${maxDist}km.`);
                } else {
                    // Libera e mostra a distância
                    if (elDistDisplay) {
                        elDistDisplay.innerText = `✅ Atendido (${distText}km)`;
                        elDistDisplay.className = "text-green-500 font-bold text-xs mt-1 block";
                    }
                    if (typeof checkoutState !== 'undefined') checkoutState.isValidDelivery = true;
                }
            }
        }

        // Libera botão de finalizar se passar nos testes do CEP
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
        if (elDistDisplay && elDistDisplay.innerText === "Calculando frete...") {
            elDistDisplay.innerText = ""; // Limpa texto se travou no erro
        }
    } finally {
        if (elLoading) elLoading.classList.add('hidden');
        if (typeof window.populateInstallments === 'function') window.populateInstallments();
        if (typeof window.calcCheckoutTotal === 'function') window.calcCheckoutTotal();

        // VALIDA A TELA INTEIRA AGORA (Destrava as formas de pagamento)
        if (typeof validateCheckoutForm === 'function') validateCheckoutForm();
    }
};

// 4. Submit Order (Para garantir que use a validação)
async function submitOrder() {
    try {
        const getVal = (id) => document.getElementById(id)?.value?.trim() || '';
        const dConfig = state.storeProfile?.deliveryConfig || { ownDelivery: false, reqCustomerCode: false, cancelTimeMin: 5 };

        // Trava de Segurança da Tela
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

        // Muda o botão para mostrar que está pensando
        const btnSubmit = document.getElementById('btn-finish-payment');
        if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "⏳ Validando estoque..."; }

        // =================================================================
        // 🛡️ BLINDAGEM CONTRA ESTOQUE FANTASMA (Validação em Tempo Real)
        // =================================================================
        let outOfStockItems = [];

        for (const item of state.cart) {
            const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
            const snap = await getDocFromServer(prodRef);

            if (!snap.exists()) {
                outOfStockItems.push(`<b>${item.name}</b><br><span class="text-xs text-red-400">Produto indisponível ou excluído.</span>`);
                continue;
            }

            const pAtualizado = snap.data();
            const allowNegative = state.globalSettings.allowNoStock || pAtualizado.allowNoStock;

            if (!allowNegative) {
                let estoqueReal = 0;

                if (pAtualizado.hasVariations && pAtualizado.sizes) {
                    const sizeObj = pAtualizado.sizes.find(s => s.name === item.size);
                    estoqueReal = sizeObj ? (parseInt(sizeObj.stock) || 0) : 0;
                } else {
                    estoqueReal = parseInt(pAtualizado.stock) || 0;
                }

                if (estoqueReal < item.qty) {
                    // Formata o texto com HTML para ficar bonito no novo modal
                    let msg = `<span class="font-bold text-white">${item.name}</span>`;
                    if (item.size !== 'U') msg += ` <span class="text-xs text-gray-400">Tamanho: ${item.size}</span>`;
                    msg += `<br><span class="text-xs font-bold text-red-400 block mt-1">Disponível: ${estoqueReal} unidade(s)</span>`;

                    outOfStockItems.push(msg);
                }
            }
        }

        // Se encontrou algum produto esgotado, BARRA A VENDA E ABRE O MODAL NOVO!
        if (outOfStockItems.length > 0) {
            if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Confirmar Pedido"; }

            // Chama o novo modal estilisado!
            if (typeof showOutOfStockModal === 'function') {
                showOutOfStockModal(outOfStockItems);
            } else {
                alert("Erro de estoque. Verifique os itens.");
            }
            return;
        }
        // =================================================================

        // Se passou pela blindagem, muda o botão para enviando de fato
        if (btnSubmit) { btnSubmit.innerText = "⏳ Enviando Pedido..."; }

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

        // CORREÇÃO DE FRETE BLINDADA
        const shipRule = dConfig.shippingRule || 'none';
        const shipValue = parseFloat(dConfig.shippingValue) || 0;
        let valueToSave = 0;
        if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
            let applyFrete = false;
            if (shipRule === 'both' || shipRule === 'todos' || shipRule === 'sempre') applyFrete = true;
            else if ((shipRule === 'online' || shipRule === 'pagamento_online') && payMode === 'online') applyFrete = true;
            else if ((shipRule === 'delivery' || shipRule === 'pagamento_entrega' || shipRule === 'entrega') && payMode === 'delivery') applyFrete = true;

            if (applyFrete) valueToSave = shipValue;
        }

        const order = {
            code: nextCode, date: new Date().toISOString(),
            customer: { name, phone, address: fullAddress, addressNum: number, cep, district, street, comp },
            items: state.cart || [], total: finalValue, status: 'Aguardando aprovação',
            paymentMethod: paymentDetails, securityCode, shippingFee: valueToSave,
            couponData, cupom: couponData ? couponData.code : null,
            cancelLimit: new Date(new Date().getTime() + cancelMinutes * 60000).toISOString()
        };

        const docRef = await addDoc(collection(db, `sites/${state.siteId}/sales`), order);
        const newOrderLocal = { id: docRef.id, ...order };
        if (!Array.isArray(state.myOrders)) state.myOrders = [];
        state.myOrders.push(newOrderLocal);

        // Salva o histórico isolado
        localStorage.setItem(`orders_${state.siteId}`, JSON.stringify(state.myOrders));

        startBackgroundListeners(); checkActiveOrders(); state.cart = []; state.currentCoupon = null;

        // Esvazia o carrinho isolado
        localStorage.setItem(`cart_${state.siteId}`, JSON.stringify([]));
        updateCartUI();

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

    // ✨ CORREÇÃO DE FRETE BLINDADA
    if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
        let shouldAddShip = false;
        if (shipRule === 'both' || shipRule === 'todos' || shipRule === 'sempre') shouldAddShip = true;
        else if ((shipRule === 'online' || shipRule === 'pagamento_online') && payMode === 'online') shouldAddShip = true;
        else if ((shipRule === 'delivery' || shipRule === 'pagamento_entrega' || shipRule === 'entrega') && payMode === 'delivery') shouldAddShip = true;

        if (shouldAddShip) {
            valorFrete = shipValue;
        }
    }

    // 3. Define o Valor Presente (PV) Total para financiamento
    const valorPresenteTotal = Math.max(0, valorBaseProdutos + valorFrete);

    // 4. Gera Opções
    const maxParcelas = (instConfig.active && valorPresenteTotal > 0) ? instConfig.max : 1;

    for (let i = 1; i <= maxParcelas; i++) {

        let montanteFinal = valorPresenteTotal;
        let label = `${i}x Sem Juros`;

        if (instConfig.active && i > instConfig.freeUntil && instConfig.rate > 0) {
            const taxa = instConfig.rate / 100;
            const fator = Math.pow(1 + taxa, i);
            const valorPrestacao = valorPresenteTotal * ((taxa * fator) / (fator - 1));

            montanteFinal = valorPrestacao * i;
            label = `${i}x (c/ juros)`;
        }

        const valorParcelaDisplay = montanteFinal / i;
        const option = document.createElement('option');
        option.value = i;
        option.dataset.total = montanteFinal.toFixed(2);
        option.text = `${label} de ${formatCurrency(valorParcelaDisplay)}`;
        select.appendChild(option);
    }

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

// =================================================================
// 🛒 1. RENDERIZADOR CENTRAL DO CHECKOUT (BLINDADO)
// =================================================================
window.renderCheckoutPaymentsUI = () => {
    const pm = state.storeProfile?.paymentMethods || {};
    const dConfig = state.storeProfile?.deliveryConfig || {};

    const onlineActive = pm.online?.active !== false;
    const deliveryPaymentActive = pm.delivery?.active !== false;
    const logisticsActive = dConfig.ownDelivery === true;
    const showDeliveryTab = deliveryPaymentActive && logisticsActive;

    const radioOnline = document.querySelector('input[name="pay-mode"][value="online"]');
    const radioDelivery = document.querySelector('input[name="pay-mode"][value="delivery"]');

    const labelOnline = document.getElementById('label-pay-online') || (radioOnline ? radioOnline.closest('label') : null);
    const containerDelivery = document.getElementById('container-delivery-option') || (radioDelivery ? radioDelivery.closest('label') : null);

    // 2. ABAS PRINCIPAIS (Online vs Entrega)
    if (labelOnline) {
        if (onlineActive) {
            labelOnline.classList.remove('hidden');
            if (radioOnline) radioOnline.disabled = false;
        } else {
            labelOnline.classList.add('hidden');
            if (radioOnline) { radioOnline.disabled = true; radioOnline.checked = false; }
        }
    }

    if (containerDelivery) {
        if (showDeliveryTab) {
            containerDelivery.classList.remove('hidden');
            if (radioDelivery) radioDelivery.disabled = false;
        } else {
            containerDelivery.classList.add('hidden');
            if (radioDelivery) { radioDelivery.disabled = true; radioDelivery.checked = false; }
        }
    }

    // 3. GARANTE SELEÇÃO DE ABA: Se nada estiver marcado, marca a primeira visível sozinha
    let currentModeEl = document.querySelector('input[name="pay-mode"]:checked');
    if (!currentModeEl || currentModeEl.disabled || (currentModeEl.closest('label') && currentModeEl.closest('label').classList.contains('hidden'))) {
        if (onlineActive && radioOnline) {
            radioOnline.checked = true;
            currentModeEl = radioOnline;
        } else if (showDeliveryTab && radioDelivery) {
            radioDelivery.checked = true;
            currentModeEl = radioDelivery;
        }
    }

    const mode = currentModeEl ? currentModeEl.value : null;

    // Alterna os painéis internos baseado na aba
    const deliveryContent = document.getElementById('pay-delivery-content');
    const onlineContent = document.getElementById('pay-online-content');
    if (mode === 'delivery') {
        if (deliveryContent) deliveryContent.classList.remove('hidden');
        if (onlineContent) onlineContent.classList.add('hidden');
    } else if (mode === 'online') {
        if (deliveryContent) deliveryContent.classList.add('hidden');
        if (onlineContent) onlineContent.classList.remove('hidden');
    }

    // 4. FORMAS DE PAGAMENTO SECUNDÁRIAS (Pix, Cartão, Dinheiro)
    const lblMethod = document.getElementById('lbl-payment-method');
    if (mode === 'delivery' && lblMethod) lblMethod.innerText = "Pagarei na entrega com:";
    if (mode === 'online' && lblMethod) lblMethod.innerText = "Pagar agora com:";

    const getWrapper = (val) => {
        const radio = document.querySelector(`input[name="payment-method-selection"][value="${val}"]`) ||
            document.querySelector(`input[name="payment-method"][value="${val}"]`);
        if (!radio) return null;

        // ✨ CORREÇÃO CRÍTICA: Pega apenas a label em volta do input, ou o ID exato. 
        // Não sobe para o parentElement para não pegar a caixa toda.
        let wrapper = document.getElementById(`container-${val}-option`);
        if (!wrapper) {
            wrapper = radio.closest('label');
        }
        return { radio, wrapper };
    };

    const pix = getWrapper('pix');
    const credit = getWrapper('credit');
    const debit = getWrapper('debit');
    const cash = getWrapper('cash');

    const pConfig = mode === 'delivery' ? (pm.delivery || {}) : (pm.online || {});

    // ✨ CORREÇÃO CRÍTICA: Usa APENAS as classes do Tailwind para não quebrar o layout!
    const forceUpdateVis = (obj, shouldShow) => {
        if (!obj) return;
        if (shouldShow) {
            if (obj.wrapper) obj.wrapper.classList.remove('hidden');
            if (obj.radio) {
                obj.radio.disabled = false;
                const lbl = obj.radio.closest('label');
                if (lbl) lbl.classList.remove('hidden');
            }
        } else {
            if (obj.wrapper) obj.wrapper.classList.add('hidden');
            if (obj.radio) {
                obj.radio.disabled = true;
                obj.radio.checked = false; // Desmarca para não bugar
                const lbl = obj.radio.closest('label');
                if (lbl) lbl.classList.add('hidden');
            }
        }
    };

    forceUpdateVis(pix, pConfig.pix !== false);
    forceUpdateVis(credit, pConfig.credit !== false);
    forceUpdateVis(debit, pConfig.debit !== false);
    forceUpdateVis(cash, mode === 'delivery' ? (pConfig.cash !== false) : false);

    // 5. GARANTE SELEÇÃO DE MÉTODO: Pega o primeiro válido e marca sozinho
    let currentMethodEl = document.querySelector('input[name="payment-method-selection"]:checked') ||
        document.querySelector('input[name="payment-method"]:checked');

    let invalidMethod = false;
    if (!currentMethodEl || currentMethodEl.disabled) {
        invalidMethod = true;
    } else {
        const wrap = currentMethodEl.closest('label') || document.getElementById(`container-${currentMethodEl.value}-option`);
        if (wrap && wrap.classList.contains('hidden')) {
            invalidMethod = true;
        }
    }

    if (invalidMethod) {
        const validRadios = document.querySelectorAll('input[name="payment-method-selection"]:not(:disabled), input[name="payment-method"]:not(:disabled)');
        for (let r of validRadios) {
            const w = r.closest('label') || document.getElementById(`container-${r.value}-option`);
            if (w && !w.classList.contains('hidden')) {
                r.checked = true;
                break;
            }
        }
    }

    // Aciona as lógicas secundárias
    if (typeof toggleMethodSelection === 'function') toggleMethodSelection();
    if (typeof validateCheckoutForm === 'function') validateCheckoutForm();
};

// Mantém os atalhos antigos funcionando sem erro
window.applyCheckoutVisibility = () => renderCheckoutPaymentsUI();
window.togglePaymentMode = () => renderCheckoutPaymentsUI();

// =================================================================
// ✨ 2. ABERTURA DO CHECKOUT 
// =================================================================
window.openCheckoutModal = () => {
    ['checkout-cep', 'checkout-number', 'checkout-comp', 'checkout-name', 'checkout-phone'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    ['address-details', 'delivery-error'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (typeof checkoutState !== 'undefined') {
        checkoutState.isValidDelivery = false;
        checkoutState.address = null;
        checkoutState.distance = 0;
    }

    const viewCart = document.getElementById('view-cart-list');
    const viewCheckout = document.getElementById('view-checkout');

    if (viewCart) viewCart.classList.add('hidden');
    if (viewCheckout) viewCheckout.classList.remove('hidden');

    const cartTitle = document.getElementById('cart-modal-title');
    if (cartTitle) cartTitle.innerText = "FINALIZAR PEDIDO";

    document.getElementById('btn-modal-back')?.classList.remove('hidden');
    document.getElementById('btn-go-checkout')?.classList.add('hidden');

    // ✨ Roda a faxina AGORA, com a tela aberta
    renderCheckoutPaymentsUI();

    const btnFinish = document.getElementById('btn-finish-payment');
    const paySection = document.getElementById('checkout-payment-options');

    if (paySection) {
        paySection.classList.add('opacity-50', 'locked-section');
        paySection.classList.remove('pointer-events-none');
    }

    if (btnFinish) {
        btnFinish.classList.remove('hidden');
        btnFinish.disabled = true;
        btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
    }

    if (typeof validateCheckoutForm === 'function') {
        validateCheckoutForm();
    }
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

    // 3. ✨ CORREÇÃO DE FRETE BLINDADA
    if (typeof checkoutState !== 'undefined' && checkoutState.isValidDelivery && shipValue > 0) {
        let applyFrete = false;
        if (shipRule === 'both' || shipRule === 'todos' || shipRule === 'sempre') applyFrete = true;
        else if ((shipRule === 'online' || shipRule === 'pagamento_online') && payMode === 'online') applyFrete = true;
        else if ((shipRule === 'delivery' || shipRule === 'pagamento_entrega' || shipRule === 'entrega') && payMode === 'delivery') applyFrete = true;

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
                let totalDesc = isFixed ? val : subtotalDisplay * (val / 100);
                totalWithPixPrices = Math.max(0, subtotalDisplay - totalDesc);
            }
        } else {
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

        if (state.currentCoupon) {
            const baseCupom = totalWithPixPrices;
            if (state.currentCoupon.type === 'percent') discountCouponDisplay = baseCupom * (state.currentCoupon.val / 100);
            else discountCouponDisplay = state.currentCoupon.val;
        }

        finalTotal = (subtotalDisplay - discountPixDisplay - discountCouponDisplay) + shippingDisplay;
    }
    // B. CRÉDITO
    else if (method === 'credit' && payMode === 'online') {
        if (state.currentCoupon) {
            if (state.currentCoupon.type === 'percent') discountCouponDisplay = subtotalDisplay * (state.currentCoupon.val / 100);
            else discountCouponDisplay = state.currentCoupon.val;
        }

        const select = document.getElementById('checkout-installments');
        if (select && select.options.length > 0 && select.selectedIndex >= 0) {
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt.dataset.total) {
                finalTotal = parseFloat(selectedOpt.dataset.total);
            } else {
                finalTotal = (subtotalDisplay - discountCouponDisplay) + shippingDisplay;
            }
        } else {
            finalTotal = (subtotalDisplay - discountCouponDisplay) + shippingDisplay;
        }

        const instConfig = state.storeProfile?.installments;
        const parcelas = select ? parseInt(select.value) : 1;
        if (instConfig && instConfig.active && instConfig.rate > 0 && parcelas > instConfig.freeUntil) {
            obsJuros = `* Inclui juros de ${instConfig.rate}% a.m.`;
        }
    }
    // C. OUTROS
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

        const somaSimples = (subtotalDisplay - discountPixDisplay - discountCouponDisplay) + shippingDisplay;
        if (finalTotal > somaSimples + 0.05) {
            const valorJuros = finalTotal - somaSimples;
            html += `<div class="flex justify-between text-gray-400 font-medium"><span>Juros</span><span>+ ${formatCurrency(valorJuros)}</span></div>`;
        }

        if (obsJuros) html += `<div class="text-[10px] text-gray-500 text-right italic mt-1">${obsJuros}</div>`;

        detailsContainer.innerHTML = html;
    }

    const elTotal = document.getElementById('checkout-final-total');
    if (elTotal) elTotal.innerText = formatCurrency(finalTotal);

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

// =================================================================
// 💰 SISTEMA DE REEMBOLSO PARCIAL E TOTAL (COM BLINDAGEM)
// =================================================================

window.adminRefundOrder = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    let modal = document.getElementById('refund-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'refund-modal';
        modal.className = "fixed inset-0 bg-black/90 z-[99999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 backdrop-blur-sm hidden";
        document.body.appendChild(modal);
    }

    // Pega o que já foi reembolsado anteriormente (se houver)
    const previouslyRefunded = order.refundedItems || [];

    let itemsHtml = order.items.map((item, index) => {
        const prevRef = previouslyRefunded.find(r => r.id === item.id && r.size === item.size);
        const prevRefQty = prevRef ? prevRef.qty : 0;
        const availableToRefund = item.qty - prevRefQty;

        // Se já devolveu tudo deste item
        if (availableToRefund <= 0) {
            return `
                <div class="flex justify-between items-center text-gray-600 text-sm mb-3 opacity-50 bg-[#0a0c13] p-3 rounded-xl border border-gray-800/50">
                    <span class="line-through flex-1 truncate pr-2">${item.qty}x ${item.name} ${item.size !== 'U' ? `(${item.size})` : ''}</span>
                    <span class="text-[10px] uppercase font-bold text-purple-500/50 border border-purple-500/20 px-2 py-1 rounded tracking-wide shrink-0">Devolvido</span>
                </div>`;
        }

        // Item disponível para devolução (Com botões de mais/menos e trava visual)
        return `
            <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-[#151720] p-3 rounded-xl mb-3 border border-gray-700/80 hover:border-purple-500/50 transition-colors gap-3">
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-white text-sm font-bold truncate">${item.name} ${item.size !== 'U' ? `<span class="text-yellow-500 text-xs ml-1">(${item.size})</span>` : ''}</span>
                    <span class="text-gray-400 text-[10px] uppercase tracking-wider mt-1">Comprado: ${item.qty} | Restante: <span class="text-green-400 font-bold">${availableToRefund}</span></span>
                </div>
                
                <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0 bg-black/50 p-1.5 rounded-lg border border-gray-800 w-full sm:w-auto">
                    <label class="text-[10px] text-gray-400 uppercase font-bold ml-2">Devolver:</label>
                    <div class="flex items-center gap-1">
                        <button onclick="document.getElementById('refund-qty-${index}').stepDown(); document.getElementById('refund-qty-${index}').dispatchEvent(new Event('input'))" class="w-7 h-7 bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center justify-center transition active:scale-95"><i class="fas fa-minus text-[10px]"></i></button>
                        
                        <input type="number" min="0" max="${availableToRefund}" value="${availableToRefund}" 
                               id="refund-qty-${index}"
                               class="w-10 h-7 bg-transparent text-white border-none focus:ring-0 text-center text-sm font-bold refund-input p-0 outline-none"
                               data-id="${item.id}" data-size="${item.size}" data-max="${availableToRefund}"
                               oninput="if(this.value > ${availableToRefund}) this.value = ${availableToRefund}; if(this.value < 0) this.value = 0;">
                               
                        <button onclick="document.getElementById('refund-qty-${index}').stepUp(); document.getElementById('refund-qty-${index}').dispatchEvent(new Event('input'))" class="w-7 h-7 bg-gray-800 hover:bg-gray-700 text-white rounded flex items-center justify-center transition active:scale-95"><i class="fas fa-plus text-[10px]"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ESTRUTURA PREMIUM DO MODAL
    modal.innerHTML = `
        <div class="bg-[#0b0e14] border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col max-h-[90vh]" id="refund-card">
            
            <div class="p-5 border-b border-gray-800 bg-[#0f111a] flex items-center justify-between shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/20">
                        <i class="fas fa-undo-alt"></i>
                    </div>
                    <div>
                        <h3 class="text-white font-extrabold text-lg leading-none">Reembolsar Pedido</h3>
                        <p class="text-gray-400 text-[10px] uppercase tracking-widest mt-1 font-bold">Ref: #${order.code}</p>
                    </div>
                </div>
                <button onclick="closeRefundModal()" class="w-8 h-8 rounded-full bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white flex items-center justify-center transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="p-5 overflow-y-auto custom-scrollbar flex-1 bg-[#0b0e14]">
                <div class="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 mb-5 flex gap-3 items-start">
                    <i class="fas fa-info-circle text-blue-400 mt-0.5"></i>
                    <p class="text-blue-200/70 text-xs leading-relaxed">
                        Selecione a quantidade de itens que retornarão ao estoque. Os botões já respeitam o limite vendido.
                    </p>
                </div>

                <div class="space-y-1">
                    ${itemsHtml}
                </div>
            </div>

            <div class="p-5 border-t border-gray-800 bg-[#0f111a] flex gap-3 shrink-0">
                <button onclick="closeRefundModal()" class="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-bold py-3.5 rounded-xl transition text-xs uppercase tracking-wide">
                    Cancelar
                </button>
                <button onclick="processRefund('${order.id}')" class="flex-[2] bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl transition shadow-[0_0_15px_rgba(147,51,234,0.2)] hover:shadow-[0_0_25px_rgba(147,51,234,0.4)] text-xs uppercase tracking-wide flex items-center justify-center gap-2">
                    <i class="fas fa-check-circle"></i> Confirmar Devolução
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('refund-card').classList.remove('scale-95');
    }, 10);
};

window.closeRefundModal = () => {
    const modal = document.getElementById('refund-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    document.getElementById('refund-card').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.processRefund = async (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    const inputs = document.querySelectorAll('.refund-input');
    let itemsToRefundNow = [];
    let totalQtyToRefundNow = 0;

    // Coleta o que foi digitado com BLINDAGEM DUPLA (Lógica)
    inputs.forEach(input => {
        let qty = parseInt(input.value) || 0;
        const maxAllowed = parseInt(input.dataset.max) || 0;
        
        // ✨ A TRAVA INVIOLÁVEL: Corta o valor se for maior que o permitido 
        // (Isso previne que a pessoa burle o HTML editando o código da página)
        if (qty > maxAllowed) qty = maxAllowed;
        if (qty < 0) qty = 0;

        if (qty > 0) {
            itemsToRefundNow.push({
                id: input.dataset.id,
                size: input.dataset.size,
                qty: qty
            });
            totalQtyToRefundNow += qty;
        }
    });

    if (totalQtyToRefundNow === 0) return showToast("Você precisa devolver pelo menos 1 unidade.", "error");

    if (!confirm(`Confirma a devolução de ${totalQtyToRefundNow} item(ns) ao estoque?`)) return;

    try {
        closeRefundModal();

        // 1. Devolve APENAS as quantidades filtradas e permitidas
        await processStockUpdate(itemsToRefundNow, 'add');

        // 2. Combina os itens de hoje com os de reembolsos passados
        const previouslyRefunded = order.refundedItems || [];
        let newRefundedItems = [...previouslyRefunded];
        
        itemsToRefundNow.forEach(item => {
            const existing = newRefundedItems.find(r => r.id === item.id && r.size === item.size);
            if (existing) existing.qty += item.qty;
            else newRefundedItems.push({...item});
        });

        // 3. Verifica se devolveu tudo ou apenas uma parte
        const totalItemsInOrder = order.items.reduce((sum, item) => sum + item.qty, 0);
        const totalItemsRefunded = newRefundedItems.reduce((sum, item) => sum + item.qty, 0);

        const newStatus = (totalItemsRefunded >= totalItemsInOrder) ? 'Reembolsado' : 'Parcialmente Reembolsado';

        // 4. Salva no banco de dados
        await updateDoc(doc(db, `sites/${state.siteId}/sales`, orderId), {
            status: newStatus,
            refundedItems: newRefundedItems
        });

        showToast(`Sucesso! Status atualizado para: ${newStatus}`, "success");

    } catch (error) {
        console.error("Erro no reembolso:", error);
        alert("Erro ao processar reembolso: " + error.message);
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
        const docSnap = await getDoc(orderRef);
        if (!docSnap.exists()) return alert("Pedido não encontrado.");

        const currentOrder = docSnap.data();
        const oldStatus = currentOrder.status || 'Aguardando aprovação';

        // Adicionamos o Parcialmente Reembolsado na lista dos que seguram estoque
        const stockConsumingStatuses = [
            'Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído', 'Parcialmente Reembolsado'
        ];

        const wasConsuming = stockConsumingStatuses.includes(oldStatus);
        const isConsuming = stockConsumingStatuses.includes(newStatus);
        const items = currentOrder.items || [];

        // --- CENÁRIO A: BAIXA DE ESTOQUE (Entrou em status válido) ---
        if (!wasConsuming && isConsuming) {
            await processStockUpdate(items, 'remove');
            showToast(`Estoque baixado com sucesso!`, 'success');
        }
        // --- CENÁRIO B: DEVOLUÇÃO DE ESTOQUE (Foi Cancelado) ---
        else if (wasConsuming && !isConsuming) {
            
            // ✨ BLINDAGEM: Descobre o que já foi devolvido para não duplicar estoque!
            const previouslyRefunded = currentOrder.refundedItems || [];
            const itemsToReturn = [];
            
            items.forEach(item => {
                const prevRef = previouslyRefunded.find(r => r.id === item.id && r.size === item.size);
                const prevRefQty = prevRef ? prevRef.qty : 0;
                const qtyToReturn = item.qty - prevRefQty; // Pega só a diferença que falta
                
                if (qtyToReturn > 0) {
                    itemsToReturn.push({...item, qty: qtyToReturn});
                }
            });

            if (itemsToReturn.length > 0) {
                await processStockUpdate(itemsToReturn, 'add');
                showToast(`Estoque devolvido.`, 'info');
            }
        }

        // 3. Atualiza o pedido
        const updateData = { status: newStatus };
        if (newStatus === 'Concluído' && oldStatus !== 'Concluído') {
            updateData.completedAt = new Date().toISOString();
        }

        await updateDoc(orderRef, updateData);

    } catch (error) {
        alert("Erro ao atualizar: " + error.message);
    }
}

async function processStockUpdate(items, operation) {
    let stockChanged = false; // Flag para saber se houve alguma alteração real

    for (const item of items) {
        if (!item.id) continue;

        const prodRef = doc(db, `sites/${state.siteId}/products`, item.id);
        const pSnap = await getDoc(prodRef);

        if (pSnap.exists()) {
            let pData = pSnap.data();
            let qty = parseInt(item.qty) || 0;
            let updates = {};

            if (pData.hasVariations && Array.isArray(pData.sizes)) {
                // ESTOQUE GRADEADO
                let newSizes = [...pData.sizes];
                let sizeObj = newSizes.find(s => s.name === item.size);

                if (sizeObj) {
                    let currentSizeStock = parseInt(sizeObj.stock) || 0;
                    if (operation === 'remove') {
                        sizeObj.stock = Math.max(0, currentSizeStock - qty);
                    } else {
                        sizeObj.stock = currentSizeStock + qty;
                    }
                }

                let newTotalStock = newSizes.reduce((acc, val) => acc + parseInt(val.stock || 0), 0);
                updates.sizes = newSizes;
                updates.stock = newTotalStock;

            } else {
                // ESTOQUE GERAL
                let currentStock = parseInt(pData.stock) || 0;
                let currentGenStock = parseInt(pData.generalStock) || 0;

                if (operation === 'remove') {
                    updates.stock = Math.max(0, currentStock - qty);
                    updates.generalStock = Math.max(0, currentGenStock - qty);
                } else {
                    updates.stock = currentStock + qty;
                    updates.generalStock = currentGenStock + qty;
                }
            }

            // Atualiza no banco de dados
            await updateDoc(prodRef, updates);

            // 🔥 MÁGICA 4: Altera o estoque na memória RAM local instantaneamente
            const localProdIndex = state.products.findIndex(p => p.id === item.id);
            if (localProdIndex !== -1) {
                state.products[localProdIndex] = { ...state.products[localProdIndex], ...updates };
            }

            stockChanged = true;
        }
    }

    // Se o estoque foi alterado, redesenha as telas usando os novos dados da memória
    if (stockChanged) {
        setCachedData(`prods_${state.siteId}`, state.products, 5);
        renderCatalog(state.products);
        if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
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
            case 'Pendente':
                statusColor = 'bg-gray-400';
                break;
            case 'Aprovado':
                statusColor = 'bg-yellow-500';
                statusLabel = 'Aprovado';
                break;
            case 'Preparando pedido':
                statusColor = 'bg-yellow-600';
                statusLabel = 'Preparando Pedido';
                break;
            case 'Saiu para entrega':
                statusColor = 'bg-orange-500';
                statusLabel = 'Saiu para Entrega';
                break;
            case 'Entregue':
                statusColor = 'bg-green-500';
                statusLabel = 'Entregue';
                break;
            case 'Concluído':
                statusColor = 'bg-green-600';
                statusLabel = 'Concluído';
                break;
            // ✨ CORREÇÃO: ADICIONANDO OS REEMBOLSOS
            case 'Reembolsado':
            case 'Parcialmente Reembolsado':
                statusColor = 'bg-purple-600';
                statusLabel = order.status; 
                break;
            case 'Cancelado':
            case 'Cancelado pelo Cliente':
                statusColor = 'bg-red-600';
                statusLabel = 'Cancelado';
                break;
        }

        // --- Legenda Superior ---
        let metaLabel = "Em andamento";
        // ✨ CORREÇÃO: Informando ao sistema que reembolsos também encerram/finalizam o processo
        if (['Concluído', 'Entregue', 'Cancelado', 'Cancelado pelo Cliente', 'Reembolsado', 'Parcialmente Reembolsado'].includes(order.status)) {
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
    const isPartial = s === 'Parcialmente Reembolsado';

    // 1. LÓGICA DA TIMELINE
    let currentStep = 0;
    
    // Define a etapa atual de entrega
    if (s === 'Aguardando aprovação' || s === 'Pendente') currentStep = 0;
    else if (s === 'Aprovado' || s === 'Preparando pedido') currentStep = 1;
    else if (s === 'Saiu para entrega') currentStep = 2;
    else if (s === 'Entregue' || s === 'Concluído') currentStep = 3;
    
    // ✨ CORREÇÃO: Se for reembolso parcial, força o progresso para 2 (Saiu para Entrega) 
    // ou mantém o estado anterior. O importante é NÃO deixar chegar no 3 (verde).
    if (isPartial) {
        currentStep = 2; 
    }

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
    
    if (!isCancelled && !isPartial) {
        timelineHTML += `<div class="absolute top-[18px] left-7 h-0.5 bg-green-500 -z-0 transition-all duration-1000" style="width: calc(${progressWidth}% - 3.5rem)"></div>`;
    } else if (isPartial) {
        // Feedback visual diferente para reembolso parcial (ex: barra laranja ou cinza)
        timelineHTML += `<div class="absolute top-[18px] left-7 h-0.5 bg-orange-500 -z-0 transition-all duration-1000" style="width: calc(${progressWidth}% - 3.5rem)"></div>`;
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
        } else if (isPartial) {
             // Estilo para reembolso parcial: Amarelo/Laranja (alerta)
             if (index < currentStep) {
                circleClass = "bg-purple-500 border-2 border-orange-500 text-black";
                labelClass = "text-orange-500 font-bold";
            } else if (index === currentStep) {
                circleClass = "bg-orange-500 border-2 border-orange-500 text-white";
                glowEffect = "shadow-[0_0_15px_rgba(249,115,22,0.8)] scale-110";
                labelClass = "text-white font-bold";
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
        
        // Verifica se este item específico já tem unidades reembolsadas
        const refundedData = (order.refundedItems || []).find(r => r.id === i.id && r.size === i.size);
        const refundedBadge = refundedData 
            ? `<span class="text-[9px] bg-purple-900/40 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 uppercase tracking-widest font-bold ml-2">-${refundedData.qty} Devolvido</span>` 
            : '';

        return `
        <div class="flex justify-between items-center text-sm text-gray-300 mb-2 border-b border-gray-800 pb-2 last:border-0">
            <div class="flex items-center gap-2 flex-1 min-w-0">
                 <span class="text-yellow-500 font-bold font-mono text-xs bg-yellow-900/20 px-1.5 rounded shrink-0">${i.qty}x</span>
                 <span class="truncate">${i.name} ${i.size !== 'U' ? `<span class="text-xs text-gray-500">(${i.size})</span>` : ''} ${refundedBadge}</span>
            </div>
            <span class="text-white font-bold text-xs shrink-0">${formatCurrency(itemTotal)}</span>
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

    // 1. Inicializa Contadores
    const counts = {
        'Aguardando aprovação': 0, 'Aprovado': 0, 'Preparando pedido': 0,
        'Saiu para entrega': 0, 'Entregue': 0, 'Concluído': 0,
        'Reembolsado': 0, 'Cancelado': 0
    };

    let totalItensVendidos = 0;

    // 2. Processa os totais
    orders.forEach(o => {
        if (o.status.includes('Cancelado')) {
            counts['Cancelado']++;
        // ✨ CORREÇÃO: Soma os parciais e totais na mesma caixa
        } else if (o.status === 'Reembolsado' || o.status === 'Parcialmente Reembolsado') {
            counts['Reembolsado']++;
        } else if (counts.hasOwnProperty(o.status)) {
            counts[o.status]++;
        }

        const isCancelado = o.status.includes('Cancelado');
        // ✨ CORREÇÃO: Informa a variável que o parcial também é um reembolso
        const isReembolsado = o.status === 'Reembolsado' || o.status === 'Parcialmente Reembolsado';
        const isAguardando = o.status === 'Aguardando aprovação';

        if (!isCancelado && !isReembolsado && !isAguardando) {
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
        { label: 'Reembolsados', key: 'Reembolsado', bg: 'bg-purple-600' },
        { label: 'Cancelados', key: 'Cancelado', bg: 'bg-red-600' }
    ];

    if (filterStatus && filterStatus !== '') {
        if (filterStatus === 'Cancelado_All') {
            cards = cards.filter(c => c.key === 'Cancelado');
        } else {
            cards = cards.filter(c => c.key === filterStatus);
        }
    }

    cards.push({ label: 'Itens Vendidos', val: totalItensVendidos, bg: 'bg-blue-600', key: 'total_items' });

    // ==========================================================
    // AQUI ESTAVA O ERRO: FALTAVA CRIAR A VARIÁVEL 'html'
    // ==========================================================
    let html = '';  // <--- ESSA LINHA RESOLVE A TELA BRANCA
    // ==========================================================

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
    // 1. Pega os valores obrigatórios
    const name = document.getElementById('checkout-name')?.value.trim();
    const phone = document.getElementById('checkout-phone')?.value.trim();
    const number = document.getElementById('checkout-number')?.value.trim();
    const street = document.getElementById('checkout-street')?.value.trim();

    // 2. Elementos da Tela
    const paymentSection = document.getElementById('checkout-payment-options');
    const btnFinish = document.getElementById('btn-finish-payment');

    // 3. Regra Blindada: Tudo deve estar preenchido E o CEP DEVE ter passado no teste de distância
    const isAddressOk = street && street !== "" && number && number !== "";
    const isUserOk = name && name !== "" && phone && phone !== "";
    const isCepValid = (typeof checkoutState !== 'undefined') ? checkoutState.isValidDelivery === true : false;

    // Se tudo estiver certo, é válido.
    const isValid = isAddressOk && isUserOk && isCepValid;

    if (isValid) {
        // --- DESTRAVA PAGAMENTO ---
        if (paymentSection) {
            paymentSection.classList.remove('opacity-50', 'locked-section');
            paymentSection.classList.remove('pointer-events-none');
        }
        if (btnFinish) {
            btnFinish.disabled = false;
            btnFinish.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    } else {
        // --- TRAVA PAGAMENTO ---
        if (paymentSection) {
            paymentSection.classList.add('opacity-50', 'locked-section');
            // Mantém os eventos de clique funcionando para exibir o alerta caso a pessoa clique
            paymentSection.classList.remove('pointer-events-none');
        }
        if (btnFinish) {
            btnFinish.disabled = true;
            btnFinish.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }
}

// =================================================================
// 🔍 SELETOR DE PRODUTOS PARA FILTRO DE VENDAS
// =================================================================

window.openProductSelectorModal = () => {
    const modal = document.getElementById('modal-product-selector');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const searchInput = document.getElementById('selector-internal-search');
        if (searchInput) {
            searchInput.value = ''; // Limpa a busca anterior
            setTimeout(() => searchInput.focus(), 100);
        }

        window.renderProductSelectorList('');
    }
};

window.closeProductSelectorModal = () => {
    const modal = document.getElementById('modal-product-selector');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.renderProductSelectorList = (searchTerm = '') => {
    const listContainer = document.getElementById('product-selector-list');
    if (!listContainer) return;

    let filteredProducts = state.products;

    if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        filteredProducts = state.products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.code && String(p.code).includes(term))
        );
    }

    if (filteredProducts.length === 0) {
        listContainer.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm italic">Nenhum produto encontrado.</div>';
        return;
    }

    listContainer.innerHTML = filteredProducts.map(p => {
        const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/100?text=Sem+Foto';
        const safeName = p.name.replace(/'/g, "\\'"); // Impede que aspas no nome quebrem o clique

        return `
            <div onclick="selectProductForFilter('${safeName}')" 
                 class="flex items-center gap-3 p-3 border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition active:scale-[0.98] rounded">
                <img src="${imgUrl}" class="w-10 h-10 rounded object-cover border border-gray-700 bg-black shrink-0">
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-white font-bold text-sm truncate">${p.name}</span>
                    <span class="text-gray-500 text-[10px] font-mono mt-0.5">Cód: #${p.code || '-'}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.selectProductForFilter = (productName) => {
    // 1. Atualiza o input oculto que a lógica de vendas usa
    const filterInput = document.getElementById('filter-search-product-value');
    if (filterInput) filterInput.value = productName;

    // 2. Atualiza o input/div visual para o Admin ver o que selecionou
    const displayInput = document.getElementById('filter-search-product');
    if (displayInput) {
        if (displayInput.tagName === 'INPUT') displayInput.value = productName;
        else displayInput.innerText = productName;
    }

    // 3. Fecha o modal
    closeProductSelectorModal();

    // 4. Roda o filtro na tabela
    if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
};

// =================================================================
// 🔍 SELETOR DE PRODUTOS PARA FILTRO DE VENDAS (RESOLVIDO)
// =================================================================

window.openProductSelectorModal = () => {
    const modal = document.getElementById('modal-product-selector');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const searchInput = document.getElementById('selector-internal-search');
        if (searchInput) {
            searchInput.value = ''; // Limpa a busca anterior
            setTimeout(() => searchInput.focus(), 100);
        }

        window.renderProductSelectorList('');
    }
};

window.closeProductSelectorModal = () => {
    const modal = document.getElementById('modal-product-selector');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

window.renderProductSelectorList = (searchTerm = '') => {
    const listContainer = document.getElementById('product-selector-list');
    if (!listContainer) return;

    let filteredProducts = state.products;

    if (searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        filteredProducts = state.products.filter(p =>
            p.name.toLowerCase().includes(term) ||
            (p.code && String(p.code).includes(term))
        );
    }

    if (filteredProducts.length === 0) {
        listContainer.innerHTML = '<div class="p-8 text-center text-gray-500 text-sm italic">Nenhum produto encontrado.</div>';
        return;
    }

    listContainer.innerHTML = filteredProducts.map(p => {
        const imgUrl = (p.images && p.images.length > 0) ? p.images[0] : 'https://placehold.co/100?text=Sem+Foto';
        const safeName = p.name.replace(/'/g, "\\'"); // Impede que aspas no nome quebrem o clique

        return `
            <div onclick="selectProductForFilter('${safeName}')" 
                 class="flex items-center gap-3 p-3 border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition active:scale-[0.98] rounded">
                <img src="${imgUrl}" class="w-10 h-10 rounded object-cover border border-gray-700 bg-black shrink-0">
                <div class="flex flex-col flex-1 min-w-0">
                    <span class="text-white font-bold text-sm truncate">${p.name}</span>
                    <span class="text-gray-500 text-[10px] font-mono mt-0.5">Cód: #${p.code || '-'}</span>
                </div>
            </div>
        `;
    }).join('');
};

window.selectProductForFilter = (productName) => {
    // 1. Atualiza o input oculto que a tabela lê
    const filterInput = document.getElementById('filter-search-product-value');
    if (filterInput) filterInput.value = productName;

    // 2. Atualiza o texto na tela (O ID exato do seu HTML)
    const displaySpan = document.getElementById('selected-product-display');
    if (displaySpan) {
        displaySpan.innerText = productName;
        displaySpan.classList.remove('text-gray-400');
        displaySpan.classList.add('text-yellow-500'); // Deixa amarelinho pra mostrar que tem filtro ativo
    }

    // 3. Mostra o botão de (X) que estava escondido no seu HTML
    const btnClearX = document.getElementById('btn-clear-prod-selection');
    if (btnClearX) {
        btnClearX.classList.remove('hidden');
        btnClearX.classList.add('flex');
    }

    // Fecha o modal e roda o filtro da tabela
    window.closeProductSelectorModal();
    if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
};

window.clearProductFilter = (e) => {
    // Impede que clicar no X acabe ativando o fundo e abrindo o modal de novo
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // 1. Zera a memória do filtro
    const filterInput = document.getElementById('filter-search-product-value');
    if (filterInput) filterInput.value = '';

    // 2. Volta o texto visual ao estado inicial
    const displaySpan = document.getElementById('selected-product-display');
    if (displaySpan) {
        displaySpan.innerText = 'Selecionar produto...';
        displaySpan.classList.remove('text-yellow-500');
        displaySpan.classList.add('text-gray-400');
    }

    // 3. Esconde o botão de (X) novamente
    const btnClearX = document.getElementById('btn-clear-prod-selection');
    if (btnClearX) {
        btnClearX.classList.add('hidden');
        btnClearX.classList.remove('flex');
    }

    // Limpa a busca interna do modal para a próxima vez
    const internalSearch = document.getElementById('selector-internal-search');
    if (internalSearch) internalSearch.value = '';

    // Roda a tabela para exibir todas as vendas de novo
    if (typeof filterAndRenderSales === 'function') filterAndRenderSales();
};

// ✨ BLINDAGEM DO BOTÃO GERAL "LIMPAR" ✨
// Ensinamos o seu botão geral a apagar a nossa caixa personalizada
setTimeout(() => {
    const btnClear = document.getElementById('btn-clear-filters');
    if (btnClear) {
        const oldOnClick = btnClear.onclick;
        btnClear.onclick = (e) => {
            if (oldOnClick) oldOnClick(e); // Limpa as datas, nome de cliente, etc
            clearProductFilter(null); // Limpa a nossa caixa "Selecionar produto..."
        };
    }
}, 1000);


// =================================================================
// 📊 GERADOR DE RELATÓRIOS PERSONALIZADOS
// =================================================================

window.openReportModal = () => {
    const modal = document.getElementById('modal-report-config');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('report-card').classList.remove('scale-95');
    }, 10);
};

window.closeReportModal = () => {
    const modal = document.getElementById('modal-report-config');
    modal.classList.add('opacity-0');
    document.getElementById('report-card').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
};

window.executeCustomReport = () => {
    // 1. CAPTURA CONFIGURAÇÕES DO MODAL
    const format = document.querySelector('input[name="rep-format"]:checked').value;
    const statusFiltro = document.querySelector('input[name="rep-status"]:checked').value;
    const sortType = document.getElementById('rep-sort').value;

    const config = {
        format: format,
        showCat: document.getElementById('rep-col-cat').checked,
        showStock: document.getElementById('rep-col-stock').checked,
        showPrice: document.getElementById('rep-col-price').checked,
        showPromo: document.getElementById('rep-col-promo').checked,
        showCost: document.getElementById('rep-col-cost').checked
    };

    // 2. FILTRAGEM DE DADOS
    let productsToExport = [...state.products];

    if (statusFiltro === 'ativos') {
        productsToExport = productsToExport.filter(p => p.active !== false);
    } else if (statusFiltro === 'inativos') {
        productsToExport = productsToExport.filter(p => p.active === false);
    }

    if (productsToExport.length === 0) {
        showToast("Nenhum produto atende a este filtro.", "error");
        return;
    }

    // 3. PREPARAÇÃO DE MÉTRICAS (Para ordenação de Vendas/Estoque)
    const metricsMap = {};
    const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];
    if (state.orders && (sortType === 'sales_desc' || sortType === 'sales_asc')) {
        state.orders.forEach(order => {
            if (validStatuses.includes(order.status)) {
                order.items.forEach(item => {
                    if (!metricsMap[item.id]) metricsMap[item.id] = 0;
                    metricsMap[item.id] += (parseInt(item.qty) || 0);
                });
            }
        });
    }

    // 4. ORDENAÇÃO DINÂMICA
    productsToExport.sort((a, b) => {
        const getStock = (p) => p.hasVariations && p.sizes ? p.sizes.reduce((acc, s) => acc + (parseInt(s.stock) || 0), 0) : (parseInt(p.stock) || parseInt(p.generalStock) || 0);

        const codeA = parseInt(a.code) || 0; const codeB = parseInt(b.code) || 0;
        const nameA = a.name.toLowerCase(); const nameB = b.name.toLowerCase();
        const priceA = parseFloat(a.price) || 0; const priceB = parseFloat(b.price) || 0;
        const stockA = getStock(a); const stockB = getStock(b);
        const salesA = metricsMap[a.id] || 0; const salesB = metricsMap[b.id] || 0;

        switch (sortType) {
            case 'code_asc': return codeA - codeB;
            case 'code_desc': return codeB - codeA;
            case 'name_asc': return nameA.localeCompare(nameB);
            case 'sales_desc': return salesB - salesA;
            case 'sales_asc': return salesA - salesB;
            case 'stock_desc': return stockB - stockA;
            case 'stock_asc': return stockA - stockB;
            case 'price_desc': return priceB - priceA;
            case 'price_asc': return priceA - priceB;
            default: return 0;
        }
    });

    // 5. ENVIA PARA O UTILITÁRIOS FINALIZAR
    if (typeof window.gerarRelatorioAvancado === 'function') {
        window.gerarRelatorioAvancado(productsToExport, config);
        closeReportModal();
    } else {
        alert("Erro: O arquivo utilitarios.js não carregou corretamente. Recarregue a página (Ctrl+F5).");
    }
};


// =================================================================
// 🚀 ATUALIZAÇÃO EM LOTE DE STATUS (ATIVO/INATIVO) COM FILTRO INTELIGENTE
// =================================================================
window.bulkChangeProductStatus = async (isActive) => {
    // 1. Filtra apenas os produtos que REALMENTE precisam ser alterados
    const productsToUpdate = [];

    state.selectedProducts.forEach(id => {
        const prod = state.products.find(p => p.id === id);
        if (prod) {
            // No sistema, se não tiver a tag "active", ele é considerado ativo por padrão
            const isCurrentlyActive = prod.active !== false;

            // Só adiciona na fila de atualização se o status atual for DIFERENTE do desejado
            if (isCurrentlyActive !== isActive) {
                productsToUpdate.push(id);
            }
        }
    });

    const countTotal = state.selectedProducts.size;
    const countToUpdate = productsToUpdate.length;
    const actionText = isActive ? 'ATIVAR' : 'INATIVAR';
    const statusText = isActive ? 'ativos' : 'inativos';

    // 2. Se nenhum produto precisar de mudança, avisa e cancela a ação
    if (countToUpdate === 0) {
        alert(`Todos os ${countTotal} itens selecionados já estão ${statusText}. Nenhuma alteração foi necessária.`);
        state.selectedProducts.clear();
        filterAndRenderProducts(); // Tira a seleção da tela
        return;
    }

    // 3. Monta a mensagem de confirmação inteligente
    let confirmMsg = `Tem certeza que deseja ${actionText} ${countToUpdate} produto(s)?`;

    if (countTotal > countToUpdate) {
        const ignorados = countTotal - countToUpdate;
        confirmMsg = `Dos ${countTotal} itens selecionados, ${ignorados} já estavam ${statusText} e serão ignorados.\n\nDeseja ${actionText} os ${countToUpdate} produto(s) restantes?`;
    }

    if (!confirm(confirmMsg)) return;

    // 4. Executa a atualização apenas nos que precisam
    try {
        document.body.style.cursor = 'wait';

        const promises = productsToUpdate.map(id => {
            return updateDoc(doc(db, `sites/${state.siteId}/products`, id), { active: isActive });
        });

        await Promise.all(promises);

        // 5. Atualiza a memória RAM local instantaneamente
        productsToUpdate.forEach(id => {
            const idx = state.products.findIndex(p => p.id === id);
            if (idx !== -1) state.products[idx].active = isActive;
        });

        // 6. Limpa a seleção e redesenha a tela
        state.selectedProducts.clear();
        setCachedData(`prods_${state.siteId}`, state.products, 60);
        filterAndRenderProducts();

        showToast(`${countToUpdate} produto(s) atualizado(s) com sucesso!`, 'success');

    } catch (error) {
        alert("Erro ao atualizar os produtos: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
};


// =================================================================
// 🧠 LÓGICA DE REORGANIZAÇÃO (COM DRAG & DROP PROFISSIONAL)
// =================================================================

function defaultProductSort(a, b) {
    const isHighlightA = a.highlight === true ? 1 : 0;
    const isHighlightB = b.highlight === true ? 1 : 0;
    if (isHighlightA !== isHighlightB) return isHighlightB - isHighlightA;

    const hasPromoA = (parseFloat(a.promoPrice) > 0) ? 1 : 0;
    const hasPromoB = (parseFloat(b.promoPrice) > 0) ? 1 : 0;
    if (hasPromoA !== hasPromoB) return hasPromoB - hasPromoA;

    const codeA = parseInt(a.code) || 0;
    const codeB = parseInt(b.code) || 0;
    return codeB - codeA;
}

function catalogProductSort(a, b) {
    const orderA = a.order !== undefined && a.order !== null ? parseFloat(a.order) : 999999;
    const orderB = b.order !== undefined && b.order !== null ? parseFloat(b.order) : 999999;
    if (orderA !== orderB) return orderA - orderB;
    return defaultProductSort(a, b);
}

window.startReorderMode = async () => {
    // 1. Limpa Filtros
    const searchInput = document.getElementById('admin-search-prod');
    const catInput = document.getElementById('admin-filter-cat');
    const statusInput = document.getElementById('admin-filter-status');
    if (searchInput) searchInput.value = '';
    if (catInput) catInput.value = '';
    if (statusInput) statusInput.value = '';

    // 2. Prepara os Dados
    state.backupProductsStr = JSON.stringify(state.products);
    state.isReorderMode = true;
    state.products.sort(catalogProductSort);
    state.products.forEach((p, index) => p.order = (index + 1) * 10);

    // Desenha a tela
    renderProductsList(state.products);
    showToast("Segure nas barrinhas para arrastar e reordenar.", "info");

    // 3. Importa a Biblioteca de Física Dinamicamente (Se já não existir)
    if (!window.Sortable) {
        await new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    // 4. CSS que faz o item arrastado flutuar e deixa o "buraco" vazio na lista original
    if (!document.getElementById('sortable-custom-styles')) {
        const style = document.createElement('style');
        style.id = 'sortable-custom-styles';
        style.innerHTML = `
            .sortable-ghost { opacity: 0 !important; } 
            .sortable-drag { 
                background-color: #1c1f2b !important; 
                box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8) !important; 
                transform: scale(1.02) !important;
                border: 1px solid #eab308 !important;
                border-radius: 8px !important;
                z-index: 99999 !important;
                opacity: 0.95 !important;
                cursor: grabbing !important;
            }
            .drag-handle { touch-action: none; }
        `;
        document.head.appendChild(style);
    }

    // 5. Inicia o Controle
    const container = document.getElementById('admin-product-scroll-container');
    if (!container) return;

    if (window.productSortable) window.productSortable.destroy();

    window.productSortable = new Sortable(container, {
        animation: 250,
        handle: '.drag-handle', // SÓ permite pegar pelo ícone das barrinhas
        forceFallback: true,
        fallbackClass: 'sortable-drag', // O card que levanta na mão
        ghostClass: 'sortable-ghost', // O espaço invisível que fica para trás
        scroll: true, // Faz a tela rolar quando encostar na borda
        scrollSensitivity: 80,
        scrollSpeed: 15,
        onEnd: function (evt) {
            if (evt.newIndex !== evt.oldIndex) {
                // Atualiza o array baseado de onde você tirou e onde soltou
                const movedItem = state.products.splice(evt.oldIndex, 1)[0];
                state.products.splice(evt.newIndex, 0, movedItem);

                // Recalcula o peso
                state.products.forEach((p, i) => p.order = (i + 1) * 10);

                // Redesenha e reinicia o observador
                renderProductsList(state.products);
                window.startReorderMode();
            }
        }
    });
};

window.reorderProductsArray = (fromIndex, toIndex) => {
    const movedItem = state.products.splice(fromIndex, 1)[0];
    state.products.splice(toIndex, 0, movedItem);

    // Atualiza os pesos locais
    state.products.forEach((p, index) => p.order = (index + 1) * 10);

    // Renderiza direto a lista sem passar pelo filtro/ordenação das colunas
    renderProductsList(state.products);
};

window.cancelReorder = () => {
    // CORREÇÃO: Destrói o Arrastar ANTES de reconstruir a tela
    if (window.productSortable) {
        try { window.productSortable.destroy(); } catch (e) { }
        window.productSortable = null;
    }

    if (state.backupProductsStr) state.products = JSON.parse(state.backupProductsStr);
    state.isReorderMode = false;

    if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
    showToast("Reorganização Cancelada.", "info");
};

window.saveReorder = async () => {
    const btn = document.querySelector('button[onclick="saveReorder()"]');
    if (btn) { btn.innerText = "⏳ Salvando..."; btn.disabled = true; }

    // ✨ CORREÇÃO CRÍTICA: Destrói a biblioteca ANTES do Firebase começar a alterar a tela
    if (window.productSortable) {
        try { window.productSortable.destroy(); } catch (e) { }
        window.productSortable = null;
    }

    try {
        const promises = state.products.map((p) => {
            if (p.order !== undefined) {
                return updateDoc(doc(db, `sites/${state.siteId}/products`, p.id), { order: p.order });
            }
        });
        await Promise.all(promises);

        state.isReorderMode = false;
        state.backupProductsStr = null;

        setCachedData(`prods_${state.siteId}`, state.products, 60);
        if (typeof renderCatalog === 'function') renderCatalog(state.products);
        if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();

        showToast("Nova ordem salva com sucesso!", "success");
    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        if (btn) { btn.innerText = "Salvar"; btn.disabled = false; }
    }
};

window.resetReorderToDefault = () => {
    state.products.sort(defaultProductSort);
    state.products.forEach((p, index) => p.order = (index + 1) * 10);
    renderProductsList(state.products);
    window.startReorderMode();
    showToast("Ordem padrão calculada! Destaque > Oferta > Novo.", "info");
};


window.moveProductInReorder = (id, direction) => {
    // Como os produtos estão listados por 'order', podemos apenas achar o index e trocar os valores
    const currentIndex = state.products.findIndex(p => p.id === id);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= state.products.length) return;

    // Troca APENAS a propriedade order entre os dois produtos afetados
    const tempOrder = state.products[currentIndex].order;
    state.products[currentIndex].order = state.products[targetIndex].order;
    state.products[targetIndex].order = tempOrder;

    filterAndRenderProducts();
};




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

window.openProductSelectorModal = openProductSelectorModal;
window.closeProductSelectorModal = closeProductSelectorModal;
window.renderProductSelectorList = renderProductSelectorList;
window.selectProductForFilter = selectProductForFilter;
window.clearProductFilter = clearProductFilter;

window.startReorderMode = startReorderMode;
window.cancelReorder = cancelReorder;
window.resetReorderToDefault = resetReorderToDefault;
window.moveProductInReorder = moveProductInReorder;
window.saveReorder = saveReorder;

// 6. DESTRAVA ESTATÍSTICAS (Se for admin logado)
if (state.user && typeof loadAdminSales === 'function') {
    loadAdminSales();
};




// =================================================================
// 📢 RADAR DE AVISOS EM TEMPO REAL (PROJETISTA -> LOJA)
// =================================================================
window.activeAvisosListener = null;

// Destruímos a função antiga caso o cache insista em usá-la
window.processarAvisos = () => { console.log("Processador antigo ignorado."); };

window.loadAvisos = () => {
    // 1. TRAVA NUCLEAR: Só roda se a tela preta do Admin estiver presente e visível
    const viewAdmin = document.getElementById('view-admin');

    if (!viewAdmin || viewAdmin.classList.contains('hidden')) {
        console.log("🛑 Radar abortado: A tela de Admin não está visível.");
        if (window.activeAvisosListener) {
            window.activeAvisosListener();
            window.activeAvisosListener = null;
        }
        return;
    }

    if (!state.siteId || state.siteId === 'demo') return;

    // Evita ouvintes duplicados
    if (window.activeAvisosListener) return;

    console.log("📡 Ligando Radar de Avisos (Modo Admin Garantido)");

    const avisosRef = collection(db, `sites/${state.siteId}/avisos`);
    const q = query(avisosRef, where("lido", "==", false));

    window.activeAvisosListener = onSnapshot(q, (snapshot) => {
        // TRAVA 2: Dentro do retorno da mensagem (Caso o usuário clique pra voltar pra vitrine enquanto a msg chega)
        const checkAdmin = document.getElementById('view-admin');
        if (!checkAdmin || checkAdmin.classList.contains('hidden')) return;

        const unreadCount = snapshot.docs.length;

        // Acende o ícone do sino apenas no painel
        try {
            const alertIcon = document.getElementById('icone-avisos');
            if (alertIcon) {
                if (unreadCount > 0) {
                    alertIcon.classList.remove('hidden');
                    alertIcon.innerHTML = `<i class="fas fa-bell"></i> <span class="ml-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">${unreadCount}</span>`;
                } else {
                    alertIcon.classList.add('hidden');
                }
            }
        } catch (e) { }

        // Dispara a mensagem
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const aviso = change.doc.data();
                const avisoId = change.doc.id;

                if (!sessionStorage.getItem(`aviso_visto_${avisoId}`)) {
                    sessionStorage.setItem(`aviso_visto_${avisoId}`, 'true');

                    if (typeof showSystemModal === 'function') {
                        showSystemModal(`🔔 COMUNICADO:\n\n${aviso.mensagem}`, 'warning');
                    } else {
                        alert(`🔔 COMUNICADO:\n\n${aviso.mensagem}`);
                    }

                    // Tenta marcar como lido
                    updateDoc(doc(db, `sites/${state.siteId}/avisos`, avisoId), { lido: true })
                        .catch(e => console.log("Erro ao marcar aviso", e));
                }
            }
        });

        if (typeof window.processarAvisos === 'function') {
            window.processarAvisos();
        }
    }, (error) => {
        console.log("🔒 Coleção de Avisos trancada aguardando senha.");
    });
};


// =================================================================
// 🖨️ MÓDULO DE IMPRESSÃO TÉRMICA - LOGO CENTRALIZADA E AVISO FISCAL
// =================================================================
window.printOrder = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return alert("Pedido não encontrado.");

    const storeProfile = state.storeProfile || {};
    const storeName = storeProfile.name || "Loja";
    const orderNumber = order.code || order.id.slice(0, 6);

    // NOME CONFIGURADO PARA A IMPRESSÃO
    const fileName = `Pedido_${orderNumber}`;

    const dataObj = new Date(order.date);
    const dataHoraFormatada = `${dataObj.toLocaleDateString('pt-BR')} às ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const subtotal = order.items.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const frete = order.shippingFee || 0;
    let descontos = (subtotal + frete) - order.total;
    if (descontos < 0) descontos = 0;

    const rawMethod = order.paymentMethod || '';
    const cleanMethodName = rawMethod.split('[')[0].trim();

    // 🔄 ALTERAÇÃO 1: Logo forçada a ficar no centro (display: block; margin: 0 auto)
    const logoHtml = storeProfile.logo
        ? `<img src="${storeProfile.logo}" style="display: block; margin: 0 auto 8px auto; max-width: 140px; max-height: 100px; object-fit: contain; filter: grayscale(100%) contrast(1.2);">`
        : '';

    let itemsHtml = order.items.map(i => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="flex: 1; padding-right: 10px;">${i.qty}x ${i.name}${i.size !== 'U' ? ' (' + i.size + ')' : ''}</span>
            <span style="white-space: nowrap;">${formatCurrency(i.price * i.qty)}</span>
        </div>
    `).join('');

    // 1. Limpa resíduos de impressões anteriores
    const oldContainer = document.getElementById('print-thermal-container');
    if (oldContainer) oldContainer.remove();

    const oldStyle = document.getElementById('print-thermal-style');
    if (oldStyle) oldStyle.remove();

    // 2. Cria o CSS que esconde o site e mostra só o cupom na hora de imprimir
    const style = document.createElement('style');
    style.id = 'print-thermal-style';
    style.innerHTML = `
        @media screen {
            #print-thermal-container { display: none !important; }
        }
        @media print {
            @page { margin: 0; size: 80mm auto; } 
            body > *:not(#print-thermal-container) { display: none !important; }
            body { background: #fff !important; margin: 0; padding: 0; }
            #print-thermal-container { 
                display: block !important; 
                font-family: 'Courier New', monospace;
                width: 280px;
                font-size: 12px;
                color: #000;
                margin: 0 auto;
                padding: 15px 10px;
                background: #fff;
            }
        }
        .p-center { text-align: center; }
        .p-bold { font-weight: bold; }
        .p-line { border-top: 1px dashed #000; margin: 8px 0; }
    `;
    document.head.appendChild(style);

    // 3. Monta o Cupom invisível na página
    const printContainer = document.createElement('div');
    printContainer.id = 'print-thermal-container';

    const addressText = order.customer.address || "Não informado (Retirada)";

    printContainer.innerHTML = `
        <div class="p-center">
            ${logoHtml}
            <h1 style="margin:0; font-size: 18px; font-weight: 900; text-transform: uppercase;">${storeName}</h1>
            <p class="p-bold" style="margin: 5px 0;">PEDIDO: #${orderNumber}</p>
            <p style="font-size: 10px; margin: 0;">${dataHoraFormatada}</p>
        </div>
        <div class="p-line"></div>
        <p class="p-bold" style="margin: 0 0 5px 0;">DADOS DO CLIENTE:</p>
        <p style="margin: 0;">${order.customer.name}</p>
        <p style="margin: 0;">Tel: ${order.customer.phone}</p>
        <p style="margin: 4px 0 0 0;">Endereço: ${addressText}</p>
        <div class="p-line"></div>
        ${itemsHtml}
        <div class="p-line"></div>
        <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        ${frete > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Frete:</span><span>+ ${formatCurrency(frete)}</span></div>` : ''}
        ${descontos > 0 ? `<div style="display: flex; justify-content: space-between;"><span>Descontos:</span><span>- ${formatCurrency(descontos)}</span></div>` : ''}
        <div class="p-line"></div>
        <div style="display: flex; justify-content: space-between; font-size: 14px;">
            <span class="p-bold">TOTAL:</span>
            <span class="p-bold">${formatCurrency(order.total)}</span>
        </div>
        <div class="p-line"></div>
        <p style="margin: 0;">PGTO: ${cleanMethodName}</p>
        ${order.securityCode ? `<div class="p-center"><p style="font-size: 10px; margin-top:10px;">SEGURANÇA:</p><h1 style="margin:0;">${order.securityCode}</h1></div>` : ''}
        <div class="p-line"></div>
        <div class="p-center" style="margin-top: 10px;">
            <p class="p-bold">*** ${order.status.toUpperCase()} ***</p>
            <p style="font-size: 10px; margin-top: 5px;">Obrigado pela preferência!</p>
            
            <p style="font-size: 11px; margin-top: 8px; font-weight: bold; border-top: 1px solid #000; padding-top: 6px;">
                *** NÃO É DOCUMENTO FISCAL ***<br>
                <span style="font-size: 9px; font-weight: normal;">Comprovante de Controle Interno</span>
            </p>
        </div>
    `;
    document.body.appendChild(printContainer);

    // 4. Salva o título do site e muda para o nome do pedido
    const originalTitle = document.title;
    document.title = fileName;

    // 5. Chama a impressão e restaura o título assim que a janela fechar
    setTimeout(() => {
        window.print();
        document.title = originalTitle;
    }, 300);
};


// Clicar em qualquer lugar da tela fecha o Dropdown
document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-cat-dropdown') && !e.target.closest('.categoria-btn')) {
        fecharCatDropdown();
    }
});


// =================================================================
// 📄 GERENCIADOR DE TÓPICOS INSTITUCIONAIS (RICH TEXT)
// =================================================================

state.editingTopicIndex = -1;
state.originalTopicState = "";

const availableIcons = [
    'fa-info-circle', 'fa-undo', 'fa-shield-alt',
    'fa-truck', 'fa-star', 'fa-question-circle', 'fa-handshake', 'fa-gem', 'fa-heart',
    'fa-money-bill-wave', 'fa-motorcycle', 'fa-shopping-cart', 'fa-box-open'
];

window.formatText = (command, value = null) => {
    const editor = document.getElementById('topico-descricao-rich');
    if (editor) {
        editor.focus(); // 🔥 CORREÇÃO: Devolve o foco ao campo primeiro para reativar a seleção do texto
    }
    document.execCommand(command, false, value);
    checkTopicChanges();
};

window.renderAdminTopics = () => {
    const listContainer = document.getElementById('lista-topicos');
    const chkMaster = document.getElementById('ativar-topicos-geral');
    const formArea = document.getElementById('box-form-topico');

    if (!listContainer || !chkMaster) return;

    if (!state.storeProfile.customTopics) state.storeProfile.customTopics = [];
    const isEnabled = !!state.storeProfile.enableCustomTopics;
    chkMaster.checked = isEnabled;

    if (formArea) {
        if (isEnabled) formArea.classList.remove('opacity-50', 'pointer-events-none');
        else formArea.classList.add('opacity-50', 'pointer-events-none');
    }

    listContainer.innerHTML = '';

    if (state.storeProfile.customTopics.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-xs text-center py-4 italic border border-gray-800 rounded">Nenhum tópico criado ainda.</p>';
        return;
    }

    state.storeProfile.customTopics.forEach((topic, index) => {
        const isActive = topic.active !== false;
        const bgClass = index === state.editingTopicIndex ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black border-gray-700 hover:border-gray-500';

        const isFirst = index === 0;
        const isLast = index === state.storeProfile.customTopics.length - 1;

        // ✨ ALTERAÇÃO: Removida a cor inline aqui. A lista do admin fica com texto branco padrão.
        listContainer.innerHTML += `
            <div class="flex items-center justify-between border rounded-md px-4 py-3 ${bgClass} transition-colors cursor-pointer group" ondblclick="editTopic(${index})">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <i class="fas ${topic.icon || 'fa-file-alt'} text-gray-500 group-hover:text-yellow-500 transition"></i>
                    <span class="text-white font-bold text-sm truncate pr-2">${topic.title}</span>
                    <span class="text-[10px] text-gray-600 italic opacity-0 group-hover:opacity-100 transition md:inline hidden">(Duplo clique p/ editar)</span>
                </div>
                
                <div class="flex items-center gap-2 shrink-0 pl-2 border-l border-gray-800">
                    <button type="button" onclick="event.stopPropagation(); moveTopic(${index}, -1)" class="w-6 h-6 rounded bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition disabled:opacity-30" title="Mover para cima" ${isFirst ? 'disabled' : ''}>
                        <i class="fas fa-arrow-up text-[10px]"></i>
                    </button>
                    <button type="button" onclick="event.stopPropagation(); moveTopic(${index}, 1)" class="w-6 h-6 rounded bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition disabled:opacity-30 mr-2" title="Mover para baixo" ${isLast ? 'disabled' : ''}>
                        <i class="fas fa-arrow-down text-[10px]"></i>
                    </button>

                    <button type="button" onclick="event.stopPropagation(); deleteTopic(${index})" class="text-gray-600 hover:text-red-500 transition-colors p-1" title="Excluir">
                        <i class="far fa-trash-alt text-base"></i>
                    </button>
                    
                    <label class="relative inline-flex items-center cursor-pointer ml-2" onclick="event.stopPropagation()">
                        <input type="checkbox" class="sr-only peer" ${isActive ? 'checked' : ''} onchange="toggleTopicStatus(${index})">
                        <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                    </label>
                </div>
            </div>
        `;
    });
};

window.renderIconSelector = (selectedIcon = 'fa-file-alt') => {
    const container = document.getElementById('icon-selector');
    if (!container) return;

    container.className = "flex flex-nowrap overflow-x-auto gap-1 bg-[#151720] p-1 rounded-md border border-gray-700 items-center hide-scroll h-9";

    container.innerHTML = availableIcons.map(icon => {
        const isSelected = icon === selectedIcon;
        const color = isSelected ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500' : 'text-gray-500 border-transparent hover:bg-gray-800';
        return `
            <button type="button" onclick="selectTopicIcon('${icon}')" class="shrink-0 w-7 h-7 rounded flex items-center justify-center transition ${color} text-[11px] outline-none">
                <i class="fas ${icon}"></i>
            </button>
        `;
    }).join('');

    document.getElementById('topico-icone').value = selectedIcon;
};

window.selectTopicIcon = (icon) => {
    renderIconSelector(icon);
    checkTopicChanges();
};

window.checkTopicChanges = () => {
    const title = document.getElementById('topico-titulo').value.trim();
    let content = document.getElementById('topico-descricao-rich').innerHTML.trim();
    const icon = document.getElementById('topico-icone').value;
    const titleColor = document.getElementById('topico-cor-titulo').value;

    const btnAcao = document.getElementById('btn-topico-acao');
    const btnCancelar = document.getElementById('btn-cancelar-topico');
    const descContainer = document.getElementById('topico-descricao-container');

    if (btnAcao) btnAcao.disabled = false;
    if (btnCancelar) btnCancelar.disabled = false;

    if (content === '<br>') content = '';

    const currentState = `${title}|${content}|${icon}|${titleColor}`;
    const isEditing = state.editingTopicIndex >= 0;
    const hasText = title !== '' || content !== '';
    const hasChanged = currentState !== state.originalTopicState;

    if (isEditing) {
        descContainer.classList.remove('hidden');
        btnCancelar.classList.remove('hidden');

        if (hasChanged && hasText) {
            btnAcao.classList.remove('hidden');
            btnAcao.innerText = "Salvar Alterações";
            btnAcao.className = "w-full md:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-md transition-colors shadow-md uppercase text-xs tracking-wide";
        } else {
            btnAcao.classList.add('hidden');
        }
    } else {
        if (hasText) {
            btnCancelar.classList.remove('hidden');
            btnAcao.classList.remove('hidden');
            btnAcao.innerText = "Criar Tópico";
            btnAcao.className = "w-full md:w-auto px-8 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-md transition-colors shadow-md uppercase text-xs tracking-wide";
            descContainer.classList.remove('hidden');
        } else {
            btnCancelar.classList.add('hidden');
            btnAcao.classList.remove('hidden');
            btnAcao.innerText = "Novo";
            btnAcao.className = "w-full md:w-auto px-8 py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-md transition-colors shadow-md uppercase text-xs tracking-wide";
            descContainer.classList.add('hidden');
        }
    }
};

window.handleTopicAction = async () => {
    const btnAcao = document.getElementById('btn-topico-acao');
    const acaoTexto = btnAcao.innerText.trim().toUpperCase();

    if (acaoTexto === "NOVO") {
        document.getElementById('topico-descricao-container').classList.remove('hidden');
        document.getElementById('topico-titulo').focus();
        document.getElementById('btn-cancelar-topico').classList.remove('hidden');
        btnAcao.innerText = "Criar Tópico";
        return;
    }

    const title = document.getElementById('topico-titulo').value.trim();
    const content = document.getElementById('topico-descricao-rich').innerHTML.trim();
    const icon = document.getElementById('topico-icone').value;
    const titleColor = document.getElementById('topico-cor-titulo').value;

    if (!title) return showToast("Digite um título.", "error");
    if (!content || content === '<br>') return showToast("A descrição não pode ficar vazia.", "error");

    if (!state.storeProfile.customTopics) state.storeProfile.customTopics = [];

    const originalText = btnAcao.innerText;

    btnAcao.innerText = "Salvando...";
    btnAcao.disabled = true;
    document.getElementById('btn-cancelar-topico').disabled = true;

    try {
        if (state.editingTopicIndex >= 0) {
            state.storeProfile.customTopics[state.editingTopicIndex] = {
                ...state.storeProfile.customTopics[state.editingTopicIndex],
                title,
                content,
                icon,
                titleColor
            };
        } else {
            state.storeProfile.customTopics.push({ title, content, icon, titleColor, active: true });
        }

        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { customTopics: state.storeProfile.customTopics }, { merge: true });

        showToast("Tópico salvo!", "success");
        resetTopicForm();
        renderAdminTopics();
        renderSidebarTopics();
    } catch (error) {
        showToast("Erro ao salvar.", "error");
        btnAcao.innerText = originalText;
    } finally {
        if (btnAcao) btnAcao.disabled = false;
        if (document.getElementById('btn-cancelar-topico')) document.getElementById('btn-cancelar-topico').disabled = false;
    }
};

window.resetTopicForm = () => {
    state.editingTopicIndex = -1;
    document.getElementById('topico-titulo').value = '';

    document.getElementById('topico-cor-titulo').value = '#ffffff';
    document.getElementById('topico-titulo').style.color = '#ffffff';

    document.getElementById('topico-descricao-rich').innerHTML = '';
    document.getElementById('topico-descricao-container').classList.add('hidden');

    const btnCancel = document.getElementById('btn-cancelar-topico');
    if (btnCancel) {
        btnCancel.classList.add('hidden');
        btnCancel.disabled = false;
    }

    const btnAcao = document.getElementById('btn-topico-acao');
    if (btnAcao) btnAcao.disabled = false;

    renderIconSelector('fa-file-alt');
    state.originalTopicState = "||fa-file-alt|#ffffff";

    checkTopicChanges();
    renderAdminTopics();
};

window.editTopic = (index) => {
    const topic = state.storeProfile.customTopics[index];
    if (!topic) return;

    state.editingTopicIndex = index;

    document.getElementById('topico-titulo').value = topic.title;
    const tColor = topic.titleColor || '#ffffff';
    document.getElementById('topico-cor-titulo').value = tColor;
    document.getElementById('topico-titulo').style.color = tColor;

    document.getElementById('topico-descricao-rich').innerHTML = topic.content;
    renderIconSelector(topic.icon || 'fa-file-alt');

    document.getElementById('topico-descricao-container').classList.remove('hidden');

    state.originalTopicState = `${topic.title}|${topic.content}|${topic.icon || 'fa-file-alt'}|${tColor}`;
    checkTopicChanges();

    renderAdminTopics();
    document.getElementById('topico-titulo').focus();
    document.getElementById('topico-titulo').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.deleteTopic = async (index) => {
    if (!confirm("Excluir este tópico definitivamente?")) return;
    state.storeProfile.customTopics.splice(index, 1);
    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { customTopics: state.storeProfile.customTopics }, { merge: true });
        if (state.editingTopicIndex === index) resetTopicForm();
        renderAdminTopics();
        renderSidebarTopics();
    } catch (e) { showToast("Erro ao excluir.", "error"); }
};

window.toggleTopicStatus = async (index) => {
    state.storeProfile.customTopics[index].active = !state.storeProfile.customTopics[index].active;
    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { customTopics: state.storeProfile.customTopics }, { merge: true });
        renderSidebarTopics();
    } catch (e) { }
};

window.moveTopic = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= state.storeProfile.customTopics.length) return;

    const temp = state.storeProfile.customTopics[index];
    state.storeProfile.customTopics[index] = state.storeProfile.customTopics[target];
    state.storeProfile.customTopics[target] = temp;

    renderAdminTopics();

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { customTopics: state.storeProfile.customTopics }, { merge: true });
        renderSidebarTopics();
    } catch (e) { showToast("Erro ao mover.", "error"); }
};

window.renderSidebarTopics = () => {
    const activeTopics = state.storeProfile.enableCustomTopics && state.storeProfile.customTopics
        ? state.storeProfile.customTopics.filter(t => t.active !== false)
        : [];

    // --- 1. RENDERIZA NO MENU LATERAL (SIDEBAR) ---
    let sidebarContainer = document.getElementById('sidebar-custom-topics');
    if (sidebarContainer) {
        sidebarContainer.innerHTML = '';
        if (activeTopics.length > 0) {
            sidebarContainer.innerHTML += `<div class="border-t border-gray-800 mx-2 pt-2 mb-2 "></div>`;
            activeTopics.forEach((topic) => {
                const originalIndex = state.storeProfile.customTopics.findIndex(t => t.title === topic.title);
                const iconClass = topic.icon || 'fa-file-alt';

                sidebarContainer.innerHTML += `
                    <button onclick="openClientTopic(${originalIndex})"text-[var(--txt-body)] class="w-full text-left py-2.5 px-4 text-sm font-bold hover:text-white hover:bg-gray-800 rounded transition flex items-center gap-3">
                        <i class="fas ${iconClass} w-5 text-center text-[var(--txt-body)] opacity-70"></i> ${topic.title}
                    </button>
                `;
            });
        }
    }

    // --- 2. RENDERIZA NO RODAPÉ (FOOTER) ---
    let footerContainer = document.getElementById('footer-custom-topics');
    if (footerContainer) {
        footerContainer.innerHTML = '';
        if (activeTopics.length > 0) {
            activeTopics.forEach((topic) => {
                const originalIndex = state.storeProfile.customTopics.findIndex(t => t.title === topic.title);

                // Design profissional: link cinza que fica branco e com underline animado ao passar o mouse
                footerContainer.innerHTML += `
                    <button onclick="openClientTopic(${originalIndex})" class="text-xs md:text-sm font-bold text-gray-400 hover:text-white transition-colors duration-200 uppercase tracking-widest relative group outline-none">
                        ${topic.title}
                        <span class="absolute -bottom-1 left-1/2 w-0 h-px bg-yellow-500 group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
                    </button>
                `;
            });
        }
    }
};

window.openClientTopic = (index) => {
    const topic = state.storeProfile.customTopics[index];
    if (!topic) return;

    const elTitle = document.getElementById('topic-display-title');
    const elContent = document.getElementById('topic-display-content');

    if (elTitle) {
        elTitle.textContent = topic.title;
        elTitle.classList.remove('text-transparent', 'bg-clip-text', 'bg-gradient-to-r', 'from-brand-pink', 'to-brand-blue');
        // A cor definida entra em ação exclusivamente na tela de exibição do tópico!
        elTitle.style.color = topic.titleColor || '#ffffff';
    }

    if (elContent) {
        elContent.innerHTML = topic.content;
        elContent.classList.add('rich-text-content');
    }

    showView('topic');

    // ✨ CORREÇÃO: Só aciona o toggleSidebar se o menu lateral estiver visível na tela
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        toggleSidebar();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// =================================================================
// 🛡️ MODAL DE ESTOQUE ESGOTADO (CHECKOUT)
// =================================================================
window.showOutOfStockModal = (outOfStockItems) => {
    let modal = document.getElementById('out-of-stock-modal');

    // Se o modal não existe no HTML, o JS cria ele na hora
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'out-of-stock-modal';
        modal.className = "fixed inset-0 bg-black/90 z-[99999] flex items-center justify-center p-4 opacity-0 transition-opacity duration-300 backdrop-blur-sm hidden";
        document.body.appendChild(modal);
    }

    // Monta a listinha vermelha bonita com os itens que deram problema
    const itemsHtml = outOfStockItems.map(itemHtml => `
        <div class="flex items-center gap-3 bg-red-900/20 border border-red-500/30 p-3 rounded-lg text-left">
            <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <i class="fas fa-box-open text-red-500"></i>
            </div>
            <div class="flex-1 text-gray-200 text-sm leading-tight">${itemHtml}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="bg-[#151720] border-t-4 border-t-red-500 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform scale-95 transition-transform duration-300" id="oos-card">
            <div class="p-6 text-center">
                <div class="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                    <i class="fas fa-exclamation-triangle text-4xl text-red-500 animate-pulse"></i>
                </div>
                <h3 class="text-white font-extrabold text-2xl mb-2 tracking-tight">Ops! Estoque alterado.</h3>
                <p class="text-gray-400 text-sm mb-6 leading-relaxed">
                    Enquanto você preenchia os dados, alguém foi mais rápido e comprou as últimas unidades. Ajuste seu carrinho para prosseguir:
                </p>

                <div class="space-y-2 mb-6 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    ${itemsHtml}
                </div>

                <button onclick="closeOutOfStockModal()" class="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/50 uppercase tracking-wide flex items-center justify-center gap-2">
                    <i class="fas fa-shopping-cart"></i> Voltar ao Carrinho
                </button>
            </div>
        </div>
    `;

    // Exibe com animação suave
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        document.getElementById('oos-card').classList.remove('scale-95');
    }, 10);
};

window.closeOutOfStockModal = () => {
    const modal = document.getElementById('out-of-stock-modal');
    if (!modal) return;

    // Oculta com animação
    modal.classList.add('opacity-0');
    document.getElementById('oos-card').classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // MÁGICA: Joga o cliente direto de volta pro carrinho!
        if (typeof window.backToOrderList === 'function') {
            window.backToOrderList();
        }
    }, 300);
};


// =================================================================
// 🎁 SISTEMA DE CUPOM OFERECIDO NA VITRINE (POPUP CLIENTE)
// =================================================================

// 1. Chave Mestra Global
window.toggleGlobalOfferCoupon = async (isActive) => {
    if (!state.storeProfile) state.storeProfile = {};
    state.storeProfile.offerCouponActive = isActive;

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { offerCouponActive: isActive }, { merge: true });
        renderAdminCoupons(); // Redesenha a lista para mostrar/esconder as bolinhas
        showToast(isActive ? "Oferta de cupom ativada!" : "Oferta de cupom desativada.");
    } catch (e) {
        showToast("Erro ao salvar configuração.", "error");
    }
};

// 2. O Banner do Cliente
window.showOfferedCoupon = () => {
    // 1. Trava: O interruptor global da loja está ligado?
    if (state.storeProfile?.offerCouponActive !== true) return;
    
    // 2. Trava: A lista de cupons já chegou do banco de dados?
    if (!state.coupons || state.coupons.length === 0) return;

    // 3. Acha o cupom que foi marcado como oferecido
    const offered = state.coupons.find(c => c.isOffered === true);
    if (!offered) return;

    // ✨ 4. TRAVA DE VENCIMENTO: Se expirou, o cliente simplesmente não vê o banner!
    if (offered.expiryDate) {
        const expiry = new Date(offered.expiryDate);
        if (new Date() > expiry) return; 
    }

    // 5. Se o cliente já fechou o banner hoje, ignora e deixa ele em paz
    if (sessionStorage.getItem(`dismissed_coupon_${offered.code}`)) return;

    // 6. Se o banner já estiver na tela, não faz nada (evita piscar na tela)
    let banner = document.getElementById('floating-coupon-banner');
    if (banner) return;

    // 7. Cria o Banner
    banner = document.createElement('div');
    banner.id = 'floating-coupon-banner';
    banner.className = 'fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-80 bg-[var(--bg-main)] border border-yellow-500/50 rounded-2xl shadow-2xl z-[9999] p-4 flex flex-col gap-2 transform translate-y-[150%] opacity-0 transition-all duration-700 ease-out';
    document.body.appendChild(banner);

    const desc = offered.type === 'percent' ? `${offered.val}% OFF` : `R$ ${formatCurrency(offered.val)} OFF`;

    banner.innerHTML = `
        <button onclick="closeOfferedCoupon('${offered.code}')" class="absolute top-2 right-2 text-gray-500 hover:text-white transition w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-red-600 rounded-full z-10">
            <i class="fas fa-times text-xs"></i>
        </button>
        
        <div class="flex items-center gap-3 relative z-0">
            <div class="w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0 border border-yellow-500/30">
                <i class="fas fa-ticket-alt text-xl animate-bounce"></i>
            </div>
            <div>
                <p class="text-[10px] text-[var(--txt-title)] font-bold uppercase tracking-widest">Presente da loja!</p>
                <p class="text-[var(--txt-body)] font-extrabold text-sm mt-0.5">Use e ganhe <span class="text-green-400">${desc}</span></p>
            </div>
        </div>
        
        <div class="flex items-center justify-between bg-black border border-gray-700 rounded-xl p-2 mt-2 relative overflow-hidden group">
            <div class="absolute inset-0 bg-yellow-500/5 group-hover:bg-yellow-500/10 transition pointer-events-none"></div>
            <span class="text-yellow-500 font-mono font-bold tracking-widest text-lg pl-3 select-all">${offered.code}</span>
            <button onclick="copyOfferedCoupon('${offered.code}')" class="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-lg font-bold text-xs uppercase transition shadow-md flex items-center gap-2 active:scale-95">
                <i class="fas fa-copy"></i> Copiar
            </button>
        </div>
    `;

    // Sobe o banner 1 segundo após ser chamado
    setTimeout(() => {
        banner.classList.remove('translate-y-[150%]', 'opacity-0');
    }, 1000);
};

window.closeOfferedCoupon = (code) => {
    sessionStorage.setItem(`dismissed_coupon_${code}`, 'true');
    const banner = document.getElementById('floating-coupon-banner');
    if (banner) {
        banner.classList.add('translate-y-[150%]', 'opacity-0');
        setTimeout(() => banner.remove(), 700);
    }
};

window.copyOfferedCoupon = (code) => {
    navigator.clipboard.writeText(code).then(() => {
        showToast("Cupom copiado! Cole no momento do pagamento.", "success");
        closeOfferedCoupon(code);
    }).catch(() => alert("Código: " + code));
};

window.setOfferedCoupon = async (couponId) => {
    try {
        const promises = state.coupons.map(c => {
            const shouldBeOffered = (c.id === couponId);
            if (c.isOffered !== shouldBeOffered) {
                return updateDoc(doc(db, `sites/${state.siteId}/coupons`, c.id), { isOffered: shouldBeOffered });
            }
        });

        await Promise.all(promises.filter(p => p !== undefined));
        showToast("Cupom Destaque alterado!", "success");
    } catch (error) {
        showToast("Erro ao definir cupom.", "error");
    }
};

// 3. Atualização Visual da Lista
function renderAdminCoupons() {
    if (!els.couponListAdmin) return;

    // Sincroniza o botão global visualmente
    const isGlobalActive = state.storeProfile?.offerCouponActive === true;
    const toggleEl = document.getElementById('global-offer-coupon');
    if (toggleEl) toggleEl.checked = isGlobalActive;

    els.couponListAdmin.innerHTML = state.coupons.map((c, index) => {
        const typeDisplay = c.type === 'percent'
            ? `<span class="text-green-400 font-bold bg-green-900/20 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">${c.val}% OFF</span>`
            : `<span class="text-green-400 font-bold bg-green-900/20 px-2 py-0.5 rounded text-[10px] whitespace-nowrap">${formatCurrency(c.val)} OFF</span>`;

        let isExpired = false;
        let expiryDisplay = `<span class="text-[10px] text-green-500 font-bold flex items-center gap-1 whitespace-nowrap"><i class="fas fa-infinity text-[8px]"></i> Permanente</span>`;

        if (c.expiryDate) {
            const expiryDate = new Date(c.expiryDate);
            const now = new Date();
            const dateStr = expiryDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

            if (now > expiryDate) {
                isExpired = true;
                expiryDisplay = `<span class="text-[9px] text-red-400 font-bold bg-red-900/20 px-2 py-0.5 rounded border border-red-900/50 block mt-1 w-fit">EXPIRADO: ${dateStr}</span>`;
            } else {
                expiryDisplay = `<span class="text-[10px] text-gray-400 whitespace-nowrap">Expira: <span class="text-white font-bold">${dateStr}</span></span>`;
            }
        }

        // Borda dourada se for o oferecido E o sistema estiver ligado!
        const isOfferedAndActive = c.isOffered && isGlobalActive;
        const borderClass = isExpired ? 'border-red-600 opacity-75' : (isOfferedAndActive ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]' : 'border-green-500');
        const isFocused = index === state.focusedCouponIndex;
        const bgClass = isFocused ? 'bg-gray-700 ring-1 ring-yellow-500 z-10' : 'bg-[#151720] border-gray-800';

        // Só desenha a bolinha (Radio Button) se a chave global estiver LIGADA
        const radioHtml = isGlobalActive ? `
            <label class="flex flex-col items-center justify-center cursor-pointer group/radio px-2 border-r border-gray-700" onclick="event.stopPropagation()">
                <input type="radio" name="offered_coupon" class="w-4 h-4 text-yellow-500 bg-gray-900 border-gray-600 focus:ring-yellow-500 cursor-pointer" 
                       ${c.isOffered ? 'checked' : ''} 
                       onchange="setOfferedCoupon('${c.id}')" title="Oferecer este cupom na vitrine">
                <span class="text-[8px] text-gray-500 group-hover/radio:text-yellow-500 mt-1 uppercase tracking-widest font-bold">Oferecer</span>
            </label>
        ` : '';

        return `
            <div id="coupon-item-${index}" 
                 onclick="selectCoupon(${index})" 
                 ondblclick="editCoupon('${c.id}')" 
                 class="${bgClass} w-full border-l-4 ${borderClass} p-3 rounded-lg flex justify-between items-center shadow-sm mb-2 cursor-pointer transition select-none group relative overflow-hidden">
                
                ${isFocused ? '<div class="absolute -left-2 top-1/2 -translate-y-1/2 text-yellow-500 text-xs"><i class="fas fa-caret-right"></i></div>' : ''}

                <div class="flex flex-col flex-1 min-w-0 pr-3 pointer-events-none">
                    <span class="${isOfferedAndActive ? 'text-yellow-500' : 'text-green-500'} font-bold text-base tracking-wider truncate group-hover:text-white transition w-full block">
                        ${c.code} ${isOfferedAndActive ? '<span class="text-[9px] bg-yellow-500 text-black px-1.5 py-0.5 rounded ml-2 align-middle shadow-md">OFERECIDO</span>' : ''}
                    </span>
                    
                    <div class="flex flex-wrap items-center gap-2 mt-1">
                        ${typeDisplay}
                        ${!isExpired ? expiryDisplay : ''}
                    </div>
                    ${isExpired ? expiryDisplay : ''}
                </div>
                
                <div class="flex items-center gap-1 shrink-0">
                    ${radioHtml}
                    <button onclick="event.stopPropagation(); deleteCoupon('${c.id}')" 
                            class="w-9 h-9 ml-1 flex items-center justify-center bg-red-600/10 text-red-500 border border-red-600/30 hover:bg-red-600 hover:text-white rounded transition z-20 active:scale-95">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.checkAndRotateExpiredOfferedCoupon = async () => {
    // Só executa a limpeza se for o admin logado (impede que clientes alterem o banco de dados)
    if (!state.user) return;

    // Procura o cupom que está marcado como oferecido atualmente
    const offered = state.coupons.find(c => c.isOffered === true);
    if (!offered) return;

    // Verifica se ele tem data de expiração e se essa data já passou
    if (offered.expiryDate) {
        const expiry = new Date(offered.expiryDate);
        const now = new Date();

        if (now > expiry) {
            const dateStr = expiry.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            
            // Procura o próximo cupom válido (que não seja o atual e não esteja expirado)
            const nextCoupon = state.coupons.find(c => {
                if (c.id === offered.id) return false; // Ignora o que acabou de expirar
                if (!c.expiryDate) return true; // Se for permanente, serve
                return new Date(c.expiryDate) > now; // Se a data for no futuro, serve
            });

            try {
                // 1. Remove o destaque do cupom expirado
                await updateDoc(doc(db, `sites/${state.siteId}/coupons`, offered.id), { isOffered: false });

                // 2. Lógica de substituição
                if (nextCoupon) {
                    // Ativa o próximo cupom válido
                    await updateDoc(doc(db, `sites/${state.siteId}/coupons`, nextCoupon.id), { isOffered: true });
                    
                    // Mostra o aviso na tela do Admin
                    if (typeof showSystemModal === 'function') {
                        showSystemModal(`⚠️ ROTAÇÃO DE CUPOM:\n\nO cupom oferecido (${offered.code}) expirou em ${dateStr}.\n\nO sistema ativou automaticamente o próximo cupom válido: ${nextCoupon.code}.`, "warning");
                    }
                } else {
                    // Se não tiver próximo, desliga a chave mestra global
                    await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { offerCouponActive: false }, { merge: true });
                    if(state.storeProfile) state.storeProfile.offerCouponActive = false;
                    
                    // Atualiza o botão visual da chave mestra se a tela estiver aberta
                    const toggleEl = document.getElementById('global-offer-coupon');
                    if (toggleEl) toggleEl.checked = false;

                    if (typeof showSystemModal === 'function') {
                        showSystemModal(`⚠️ OFERTA DESATIVADA:\n\nO cupom oferecido (${offered.code}) expirou em ${dateStr}.\n\nComo não há outros cupons válidos, a oferta automática na vitrine foi DESLIGADA.`, "warning");
                    }
                }
            } catch (e) {
                console.error("Erro ao rotacionar cupom:", e);
            }
        }
    }
};