// js/stats.js

const statsState = {
    viewMode: 'all', // 'all' ou 'period'
    dateStart: '',
    dateEnd: '',
    cachedOrders: [],
    cachedProducts: [],
    cachedDailyStats: [] // <--- MUDOU: Agora é uma lista de dias, não um objeto único
};

const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ============================================================
// 1. INICIALIZAÇÃO
// ============================================================
export function initStatsModule() {
    console.log("Módulo Dashboard Iniciado.");

    const btnAll = document.getElementById('stats-toggle-all');
    const btnPeriod = document.getElementById('stats-toggle-period');
    const inputStart = document.getElementById('stats-date-start');
    const inputEnd = document.getElementById('stats-date-end');

    // Configura datas iniciais (Hoje)
    if (inputStart && inputEnd) {
        const today = new Date().toISOString().split('T')[0];
        inputStart.value = today;
        inputEnd.value = today;
        statsState.dateStart = today;
        statsState.dateEnd = today;
    }

    if (btnAll) {
        btnAll.onclick = () => {
            statsState.viewMode = 'all';
            updateToggleVisuals();
            recalc();
        };
    }

    if (btnPeriod) {
        btnPeriod.onclick = () => {
            statsState.viewMode = 'period';
            updateToggleVisuals();
            recalc();
        };
    }

    const handleDateChange = () => {
        statsState.dateStart = inputStart.value;
        statsState.dateEnd = inputEnd.value;
        if (statsState.viewMode === 'period') recalc();
    };

    if (inputStart) inputStart.addEventListener('change', handleDateChange);
    if (inputEnd) inputEnd.addEventListener('change', handleDateChange);

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
// 2. MOTOR DE CÁLCULO
// ============================================================

export function updateStatsData(orders, products, dailyStats) {
    statsState.cachedOrders = orders || [];
    statsState.cachedProducts = products || [];
    // Garante que dailyStats seja um array
    statsState.cachedDailyStats = Array.isArray(dailyStats) ? dailyStats : [];
    recalc();
}

function recalc() {
    if (!document.getElementById('tab-stats')) return;

    let filteredOrders = statsState.cachedOrders;
    let filteredStats = statsState.cachedDailyStats; // Cópia para filtrar

    // --- FILTRAGEM POR DATA ---
    if (statsState.viewMode === 'period' && statsState.dateStart && statsState.dateEnd) {
        // Cria datas ajustadas para o fuso local (00:00 até 23:59)
        const start = new Date(statsState.dateStart + 'T00:00:00');
        const end = new Date(statsState.dateEnd + 'T23:59:59');

        // Filtra Pedidos
        filteredOrders = filteredOrders.filter(o => {
            const d = new Date(o.date);
            return d >= start && d <= end;
        });

        // Filtra Estatísticas Diárias (Visitas/Shares)
        filteredStats = filteredStats.filter(s => {
            // s.id é a data no formato YYYY-MM-DD
            const d = new Date(s.id + 'T12:00:00'); // Meio dia para evitar timezone issues
            return d >= start && d <= end;
        });
    }

    calculateKPIs(filteredOrders, filteredStats);
    calculateRankings(filteredOrders);
}

// No arquivo js/stats.js, substitua a função calculateKPIs por esta:

function calculateKPIs(orders, dailyStats) {
    // 1. Site Stats (Visitas e Compartilhamentos) - Sempre atualiza
    let totalVisits = 0;
    let totalShares = 0;
    dailyStats.forEach(day => {
        totalVisits += (day.visits || 0);
        totalShares += (day.shares || 0);
    });
    const elVisits = document.getElementById('st-visits');
    const elShares = document.getElementById('st-shares');
    if (elVisits) elVisits.innerText = `${totalVisits} Usuários`;
    if (elShares) elShares.innerText = totalShares;

    // 2. Capital de Giro (Sempre atualiza, pois depende de Produtos)
    let capital = 0;
    if (statsState.cachedProducts) {
        statsState.cachedProducts.forEach(p => {
            if (p.stock > 0) {
                const cost = p.cost ? parseFloat(p.cost) : parseFloat(p.promoPrice || p.price || 0);
                capital += p.stock * cost;
            }
        });
    }
    const elCapital = document.getElementById('st-capital');
    if (elCapital) elCapital.innerText = formatBRL(capital);

    // 3. Cálculos Financeiros (Baseados na lista filtrada)
    let salesCount = 0;
    let salesTotal = 0;
    let costTotal = 0;
    let refundedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    let totalAllOrders = orders.length;

    orders.forEach(o => {
        const status = o.status || '';
        if (status === 'Reembolsado') refundedCount++;
        if (status.includes('Cancelado')) cancelledCount++;
        if (status === 'Pendente' || status === 'Aguardando aprovação') pendingCount++;

        const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];

        if (validStatuses.includes(status) || status === 'Confirmado') {
            salesCount++;
            salesTotal += (parseFloat(o.total) || 0);

            if (o.items) {
                o.items.forEach(item => {
                    let c = 0;
                    if (item.cost !== undefined) c = parseFloat(item.cost);
                    else {
                        const p = statsState.cachedProducts.find(x => x.id === item.id);
                        if (p && p.cost) c = parseFloat(p.cost);
                    }
                    costTotal += c * (parseInt(item.qty) || 0);
                });
            }
        }
    });

    const profit = salesTotal - costTotal;

    // =========================================================================
    // 🔴 A CORREÇÃO ESTÁ AQUI 🔴
    // Só atualiza os Cartões Principais se estivermos FILTRANDO por data.
    // Se estiver em "Visão Geral", NÃO MEXE (deixa o app.js mostrar o total global).
    // =========================================================================
    
    if (statsState.viewMode !== 'all') {
        // Pedidos e Vendas
        const elTotalOrders = document.getElementById('st-total-orders');
        if (elTotalOrders) elTotalOrders.innerText = totalAllOrders;

        const elSalesCount = document.getElementById('st-sales-count');
        if (elSalesCount) elSalesCount.innerText = salesCount;

        // Valor Total (Linha inteira)
        const elSalesVal = document.getElementById('st-sales-val');
        if (elSalesVal) elSalesVal.innerText = formatBRL(salesTotal);

        // Custo Total
        const elCost = document.getElementById('st-cost');
        if (elCost) elCost.innerText = formatBRL(costTotal);

        // Lucro Total
        const elProfit = document.getElementById('st-profit');
        if (elProfit) elProfit.innerText = formatBRL(profit);
    } 
    // =========================================================================

    // Gráficos menores e Taxas (Esses dependem da lista atual, pode atualizar sempre)
    const elRefunded = document.getElementById('st-refunded');
    const elCancelled = document.getElementById('st-cancelled');
    const elPending = document.getElementById('st-pending');

    if (elRefunded) elRefunded.innerText = refundedCount;
    if (elCancelled) elCancelled.innerText = cancelledCount;
    if (elPending) elPending.innerText = pendingCount;

    const rateApproval = totalAllOrders > 0 ? (salesCount / totalAllOrders) * 100 : 0;
    const rateRefund = totalAllOrders > 0 ? (refundedCount / totalAllOrders) * 100 : 0;
    const rateCancel = totalAllOrders > 0 ? (cancelledCount / totalAllOrders) * 100 : 0;

    const elRateApp = document.getElementById('st-rate-approval');
    const elRateRef = document.getElementById('st-rate-refund');
    const elRateCan = document.getElementById('st-rate-cancel');

    if (elRateApp) elRateApp.innerText = Math.round(rateApproval) + '%';
    if (elRateRef) elRateRef.innerText = Math.round(rateRefund) + '%';
    if (elRateCan) elRateCan.innerText = Math.round(rateCancel) + '%';
}

function calculateRankings(orders) {
    const validOrders = orders.filter(o =>
        ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'].includes(o.status)
    );

    // 1. Produtos
    const prodMap = {};
    validOrders.forEach(o => {
        if (o.items) {
            o.items.forEach(i => {
                if (!prodMap[i.name]) prodMap[i.name] = 0;
                prodMap[i.name] += parseInt(i.qty);
            });
        }
    });
    const rankedProds = Object.entries(prodMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 10);

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
        let cod = null;
        if (o.couponData) cod = o.couponData.code;
        else if (o.cupom) cod = o.cupom;

        if (cod) {
            cod = cod.toUpperCase();
            if (!couponMap[cod]) couponMap[cod] = 0;
            couponMap[cod]++;
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

    // =========================================================
    // 3. PAGAMENTO (NORMALIZADO E LIMPO)
    // =========================================================
    const payMap = {
        'Pix': { qty: 0, val: 0 },
        'Cartão de Crédito': { qty: 0, val: 0 },
        'Cartão de Débito': { qty: 0, val: 0 },
        'Dinheiro': { qty: 0, val: 0 }
    };

    validOrders.forEach(o => {
        // Normaliza o nome (ex: "card" vira "Cartão de Crédito")
        const name = normalizePaymentMethod(o.paymentMethod || '');
        
        // Só contabiliza se for uma das 4 categorias válidas
        if (name && payMap[name]) {
            payMap[name].qty++;
            payMap[name].val += (parseFloat(o.total) || 0);
        }
    });

    // Transforma o objeto em array e remove categorias zeradas (opcional, se quiser mostrar zeros remova o filter)
    const rankedPay = Object.entries(payMap)
        .map(([name, data]) => ({ name, ...data }))
        .filter(item => item.qty > 0) // <--- Remove pagamentos que nunca ocorreram
        .sort((a, b) => b.val - a.val); // Ordena por VALOR financeiro (R$)

    renderList('list-rank-pay', rankedPay, (item, idx) => `
        <div class="flex items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-gray-800">
            <div class="bg-gray-200 text-black font-bold w-6 h-6 flex items-center justify-center rounded text-xs">${idx + 1}</div>
            <div class="flex-1 text-gray-300 text-sm font-bold truncate">${item.name}</div>
            <div class="flex gap-2">
                <div class="text-gray-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded">${item.qty} un</div>
                <div class="text-green-400 text-xs font-bold border border-gray-700 px-2 py-1 rounded min-w-[80px] text-center">${formatBRL(item.val)}</div>
            </div>
        </div>
    `);
}

function renderList(containerId, data, templateFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = '<p class="text-gray-600 text-xs p-2">Sem dados neste período.</p>';
        return;
    }

    data.forEach((item, idx) => {
        container.innerHTML += templateFn(item, idx);
    });
}

// Helper para normalizar nomes de pagamento
function normalizePaymentMethod(rawMethod) {
    if (!rawMethod) return null;
    const m = rawMethod.toLowerCase();

    // 1. PIX
    if (m.includes('pix')) return 'Pix';

    // 2. DINHEIRO
    if (m.includes('dinheiro') || m.includes('cash') || m.includes('espécie')) return 'Dinheiro';

    // 3. DÉBITO (Verifica antes de crédito/cartão genérico)
    if (m.includes('débito') || m.includes('debit')) return 'Cartão de Débito';

    // 4. CRÉDITO (Pega crédito explícito OU 'cartão'/'card' genérico antigo)
    if (m.includes('crédito') || m.includes('credit') || m.includes('parcelado') || m.includes('card') || m.includes('cartão')) return 'Cartão de Crédito';

    return null; // Ignora o que não for um desses 4 (ex: whatsapp, testes)
}