// js/stats.js

const statsState = {
    viewMode: 'all', // 'all' ou 'period'
    dateStart: '',
    dateEnd: '',
    cachedOrders: [],
    cachedProducts: [],
    cachedSiteStats: {}
};

// Formata Moeda
const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
export function initStatsModule() {
    console.log("Módulo Dashboard Iniciado.");

    // Elementos de Controle
    const btnAll = document.getElementById('stats-toggle-all');
    const btnPeriod = document.getElementById('stats-toggle-period');
    const inputStart = document.getElementById('stats-date-start');
    const inputEnd = document.getElementById('stats-date-end');
    const dateContainer = document.getElementById('stats-date-inputs');

    // Toggle "Tudo"
    if (btnAll) {
        btnAll.onclick = () => {
            statsState.viewMode = 'all';
            updateToggleVisuals();
            recalc();
        };
    }

    // Toggle "Períodos"
    if (btnPeriod) {
        btnPeriod.onclick = () => {
            statsState.viewMode = 'period';
            updateToggleVisuals();
            recalc();
        };
    }

    // Inputs de Data
    const handleDateChange = () => {
        statsState.dateStart = inputStart.value;
        statsState.dateEnd = inputEnd.value;
        if (statsState.viewMode === 'period') recalc();
    };

    if (inputStart) inputStart.addEventListener('change', handleDateChange);
    if (inputEnd) inputEnd.addEventListener('change', handleDateChange);

    // Accordions dos Rankings
    setupAccordion('btn-rank-prod', 'content-rank-prod', 'arrow-rank-prod');
    setupAccordion('btn-rank-coupon', 'content-rank-coupon', 'arrow-rank-coupon');
    setupAccordion('btn-rank-pay', 'content-rank-pay', 'arrow-rank-pay');

    updateToggleVisuals();
}

function updateToggleVisuals() {
    const btnAll = document.getElementById('stats-toggle-all');
    const btnPeriod = document.getElementById('stats-toggle-period');
    const dateContainer = document.getElementById('stats-date-inputs');

    if (statsState.viewMode === 'all') {
        btnAll.className = "bg-white text-black font-bold px-4 py-1 rounded transition";
        btnPeriod.className = "text-gray-400 font-bold px-4 py-1 rounded hover:text-white transition";
        dateContainer.classList.add('opacity-30', 'pointer-events-none');
    } else {
        btnAll.className = "text-gray-400 font-bold px-4 py-1 rounded hover:text-white transition";
        btnPeriod.className = "bg-green-500 text-white font-bold px-4 py-1 rounded transition";
        dateContainer.classList.remove('opacity-30', 'pointer-events-none');
    }
}

function setupAccordion(btnId, contentId, arrowId) {
    const btn = document.getElementById(btnId);
    const content = document.getElementById(contentId);
    const arrow = document.getElementById(arrowId);
    if (btn && content && arrow) {
        btn.onclick = () => {
            content.classList.toggle('hidden');
            arrow.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        };
    }
}

// ============================================================
// 2. MOTOR DE DADOS
// ============================================================

export function updateStatsData(orders, products, siteStats) {
    statsState.cachedOrders = orders || [];
    statsState.cachedProducts = products || [];
    statsState.cachedSiteStats = siteStats || { visits: 0, shares: 0 };
    recalc();
}

function recalc() {
    // Se a aba não existir, para
    if (!document.getElementById('tab-stats')) return;

    // 1. Filtra Pedidos
    let filteredOrders = statsState.cachedOrders;

    if (statsState.viewMode === 'period' && statsState.dateStart && statsState.dateEnd) {
        const start = new Date(statsState.dateStart + 'T00:00:00');
        const end = new Date(statsState.dateEnd + 'T23:59:59');

        filteredOrders = filteredOrders.filter(o => {
            const d = new Date(o.date);
            return d >= start && d <= end;
        });
    }

    // 2. Calcula Métricas
    calculateKPIs(filteredOrders);
    calculateRankings(filteredOrders);
}

function calculateKPIs(orders) {
    // A. Site Stats (Fixo)
    document.getElementById('st-visits').innerText = `${statsState.cachedSiteStats.visits || 0} Usuários`;
    document.getElementById('st-shares').innerText = statsState.cachedSiteStats.shares || 0;

    // B. Capital de Giro (Baseado em PRODUTOS, não pedidos)
    let capital = 0;
    statsState.cachedProducts.forEach(p => {
        if (p.stock > 0) {
            const cost = p.cost ? parseFloat(p.cost) : (p.price * 0.5); // Fallback se não tiver custo
            capital += p.stock * cost;
        }
    });
    document.getElementById('st-capital').innerText = formatBRL(capital);

    // C. Financeiro (Baseado em PEDIDOS filtrados)
    let salesCount = 0;
    let salesTotal = 0;
    let costTotal = 0;
    let refundedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;
    let totalCreated = 0; // Total geral para porcentagem

    orders.forEach(o => {
        totalCreated++;
        const status = o.status;
        
        // Contadores de Status
        if (status === 'Reembolsado') refundedCount++;
        if (status.includes('Cancelado')) cancelledCount++;
        if (status === 'Pendente' || status === 'Aguardando aprovação') pendingCount++;

        // Vendas Confirmadas (Financeiro Real)
        const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];
        
        if (validStatuses.includes(status)) {
            salesCount++;
            salesTotal += (parseFloat(o.total) || 0);

            // Custo dos itens vendidos (CMV)
            if (o.items) {
                o.items.forEach(item => {
                    let c = 0;
                    if (item.cost) c = parseFloat(item.cost); // Do histórico
                    else {
                        // Do cadastro atual
                        const p = statsState.cachedProducts.find(x => x.id === item.id);
                        if (p && p.cost) c = parseFloat(p.cost);
                    }
                    costTotal += c * (parseInt(item.qty) || 0);
                });
            }
        }
    });

    const profit = salesTotal - costTotal;

    // Renderiza Financeiro
    document.getElementById('st-cost').innerText = formatBRL(costTotal);
    document.getElementById('st-sales-count').innerText = salesCount;
    document.getElementById('st-sales-val').innerText = formatBRL(salesTotal);
    document.getElementById('st-profit').innerText = formatBRL(profit);

    // Renderiza Vendas
    document.getElementById('st-refunded').innerText = refundedCount;
    document.getElementById('st-cancelled').innerText = cancelledCount;
    document.getElementById('st-pending').innerText = pendingCount;

    // Taxas
    const rateApproval = totalCreated > 0 ? (salesCount / totalCreated) * 100 : 0;
    const rateRefund = salesCount > 0 ? (refundedCount / salesCount) * 100 : 0; // Sobre vendas
    const rateCancel = totalCreated > 0 ? (cancelledCount / totalCreated) * 100 : 0;

    document.getElementById('st-rate-approval').innerText = Math.round(rateApproval) + '%';
    document.getElementById('st-rate-refund').innerText = Math.round(rateRefund) + '%';
    document.getElementById('st-rate-cancel').innerText = Math.round(rateCancel) + '%';
}

function calculateRankings(orders) {
    // Só considera pedidos válidos para ranking
    const validOrders = orders.filter(o => 
        ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'].includes(o.status)
    );

    // 1. Produtos
    const prodMap = {};
    validOrders.forEach(o => {
        o.items.forEach(i => {
            if (!prodMap[i.name]) prodMap[i.name] = 0;
            prodMap[i.name] += parseInt(i.qty);
        });
    });
    // Converte para array e ordena
    const rankedProds = Object.entries(prodMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10); // Top 10

    renderList('list-rank-prod', rankedProds, (item, idx) => `
        <div class="flex items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-gray-800">
            <div class="bg-gray-200 text-black font-bold w-6 h-6 flex items-center justify-center rounded text-xs">${idx + 1}</div>
            <div class="flex-1 text-gray-300 text-sm font-bold truncate">${item.name}</div>
            <div class="text-gray-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded">${item.qty} Unidades</div>
        </div>
    `);

    // 2. Cupons
    const couponMap = {};
    validOrders.forEach(o => {
        if (o.cupom) {
            const code = o.cupom.toUpperCase();
            if (!couponMap[code]) couponMap[code] = 0;
            couponMap[code]++;
        }
    });
    const rankedCoupons = Object.entries(couponMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty);

    renderList('list-rank-coupon', rankedCoupons, (item, idx) => `
        <div class="flex items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-gray-800">
            <div class="bg-gray-200 text-black font-bold w-6 h-6 flex items-center justify-center rounded text-xs">${idx + 1}</div>
            <div class="flex-1 text-gray-300 text-sm font-bold truncate">${item.name}</div>
            <div class="text-gray-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded">${item.qty} Usos</div>
        </div>
    `);

    // 3. Formas de Pagamento
    const payMap = {};
    validOrders.forEach(o => {
        // Tenta limpar o nome (ex: "Pix [Online]" vira "Pix")
        let method = o.paymentMethod ? o.paymentMethod.split('[')[0].trim() : 'Outros';
        // Remove parênteses extras (ex: "Cartão (3x)")
        method = method.split('(')[0].trim();

        if (!payMap[method]) payMap[method] = { qty: 0, val: 0 };
        payMap[method].qty++;
        payMap[method].val += (parseFloat(o.total) || 0);
    });
    const rankedPay = Object.entries(payMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty);

    renderList('list-rank-pay', rankedPay, (item, idx) => `
        <div class="flex items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-gray-800">
            <div class="bg-gray-200 text-black font-bold w-6 h-6 flex items-center justify-center rounded text-xs">${idx + 1}</div>
            <div class="flex-1 text-gray-300 text-sm font-bold truncate">${item.name}</div>
            <div class="flex gap-2">
                <div class="text-gray-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded">${item.qty} vezes</div>
                <div class="text-gray-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded min-w-[80px] text-center">${formatBRL(item.val)}</div>
            </div>
        </div>
    `);
}

function renderList(containerId, data, templateFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (data.length === 0) {
        container.innerHTML = '<p class="text-gray-600 text-xs p-2">Sem dados.</p>';
        return;
    }

    data.forEach((item, idx) => {
        container.innerHTML += templateFn(item, idx);
    });
}