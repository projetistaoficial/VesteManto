// js/stats.js

// Estado Local do Módulo de Estatísticas
const statsState = {
    date: new Date(),
    viewMode: 'month', // 'day' ou 'month'
    filterType: 'all', // 'all' ou 'period'
    cachedOrders: [],
    cachedProducts: [],
    cachedSiteStats: {}
};

// Formata Moeda
const formatBRL = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ============================================================
// 1. INICIALIZAÇÃO E EVENTOS (Botões de Data/Filtro)
// ============================================================
export function initStatsModule() {
    console.log("Módulo de Estatísticas Iniciado.");

    // Referências aos botões
    const btnAll = document.getElementById('stats-filter-all');
    const btnPeriod = document.getElementById('stats-filter-period');
    const controls = document.getElementById('stats-date-controls');
    
    const btnDay = document.getElementById('stats-view-day'); // Texto clicável "Dia"
    const btnMonth = document.getElementById('stats-view-month'); // Texto clicável "Mês"
    
    const btnPrev = document.getElementById('stats-prev-date');
    const btnNext = document.getElementById('stats-next-date');

    // Listener: Alternar entre "Tudo" e "Período"
    if (btnAll && btnPeriod) {
        btnAll.onclick = () => {
            statsState.filterType = 'all';
            updateControlsUI();
            recalc();
        };
        btnPeriod.onclick = () => {
            statsState.filterType = 'period';
            updateControlsUI();
            recalc();
        };
    }

    // Listener: Mudar visualização (Dia / Mês)
    // Nota: No seu HTML, o clique pode estar no container ou no texto. Ajuste conforme necessidade.
    if (btnDay) btnDay.parentElement.onclick = () => { statsState.viewMode = 'day'; updateControlsUI(); recalc(); };
    if (btnMonth) btnMonth.parentElement.onclick = () => { statsState.viewMode = 'month'; updateControlsUI(); recalc(); };

    // Listener: Navegar Datas
    if (btnPrev) btnPrev.onclick = () => changeDate(-1);
    if (btnNext) btnNext.onclick = () => changeDate(1);

    updateControlsUI();
}

function changeDate(delta) {
    if (statsState.viewMode === 'day') {
        statsState.date.setDate(statsState.date.getDate() + delta);
    } else {
        statsState.date.setMonth(statsState.date.getMonth() + delta);
    }
    updateControlsUI();
    recalc();
}

function updateControlsUI() {
    // 1. Botões de Filtro (Estilo)
    const btnAll = document.getElementById('stats-filter-all');
    const btnPeriod = document.getElementById('stats-filter-period');
    const controls = document.getElementById('stats-date-controls');

    if (statsState.filterType === 'all') {
        btnAll.className = "px-4 py-1 rounded-md text-sm font-bold bg-white text-black transition";
        btnPeriod.className = "px-4 py-1 rounded-md text-sm font-bold text-gray-400 hover:text-white transition";
        controls.classList.add('hidden');
    } else {
        btnPeriod.className = "px-4 py-1 rounded-md text-sm font-bold bg-white text-black transition";
        btnAll.className = "px-4 py-1 rounded-md text-sm font-bold text-gray-400 hover:text-white transition";
        controls.classList.remove('hidden');
        controls.classList.remove('opacity-0');
        controls.classList.add('flex'); // Garante display flex
    }

    // 2. Display da Data e Seletores
    const dateDisplay = document.getElementById('stats-date-display');
    const checkDay = document.getElementById('stats-check-day');
    const checkMonth = document.getElementById('stats-check-month');

    if (dateDisplay) {
        if (statsState.viewMode === 'day') {
            dateDisplay.innerText = statsState.date.toLocaleDateString('pt-BR');
            if (checkDay) checkDay.className = "w-4 h-4 rounded-full bg-green-500 border-none cursor-pointer";
            if (checkMonth) checkMonth.className = "w-4 h-4 rounded-full border border-white cursor-pointer";
        } else {
            // Formata mês com primeira letra maiúscula (ex: dezembro de 2023)
            const dateStr = statsState.date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            dateDisplay.innerText = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
            
            if (checkMonth) checkMonth.className = "w-4 h-4 rounded-full bg-green-500 border-none cursor-pointer";
            if (checkDay) checkDay.className = "w-4 h-4 rounded-full border border-white cursor-pointer";
        }
    }
}

// ============================================================
// 2. MOTOR DE CÁLCULO (Chamado pelo App.js)
// ============================================================

// Função principal exportada que o App.js vai chamar sempre que houver dados novos
export function updateStatsData(orders, products, siteStats) {
    statsState.cachedOrders = orders || [];
    statsState.cachedProducts = products || [];
    statsState.cachedSiteStats = siteStats || { visits: 0, shares: 0 };
    recalc();
}

function recalc() {
    if (!document.getElementById('tab-stats')) return; // Só calcula se a aba existir

    const { cachedOrders, cachedProducts, cachedSiteStats } = statsState;

    // 1. Atualiza Cards de Visitas/Shares
    const elVisits = document.getElementById('stat-visits');
    const elShares = document.getElementById('stat-shares');
    if (elVisits) elVisits.innerText = `${cachedSiteStats.visits || 0} Usuários`;
    if (elShares) elShares.innerText = cachedSiteStats.shares || 0;

    // 2. Capital de Giro (Inventário)
    // Soma: Estoque * Custo (ou Preço se não tiver custo)
    let capital = 0;
    cachedProducts.forEach(p => {
        if (p.stock > 0) {
            // Tenta usar custo, senão usa promo, senão usa preço cheio
            const value = p.cost ? parseFloat(p.cost) : (p.promoPrice || p.price);
            capital += p.stock * value;
        }
    });
    const elCapital = document.getElementById('stat-capital-giro');
    if (elCapital) elCapital.innerText = formatBRL(capital);

    // 3. Filtragem de Pedidos por Data
    let filteredOrders = cachedOrders;
    
    if (statsState.filterType === 'period') {
        filteredOrders = cachedOrders.filter(o => {
            const oDate = new Date(o.date);
            const sDate = statsState.date;
            
            const sameYear = oDate.getFullYear() === sDate.getFullYear();
            const sameMonth = oDate.getMonth() === sDate.getMonth();
            const sameDay = oDate.getDate() === sDate.getDate();

            if (statsState.viewMode === 'day') return sameYear && sameMonth && sameDay;
            return sameYear && sameMonth;
        });
    }

    // 4. Métricas Financeiras
    let salesCount = 0;
    let salesTotal = 0;
    let costTotal = 0;
    let refundedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;
    
    // Contadores para KPIs
    let totalPaidOrders = 0; // Confirmado + Reembolsado

    filteredOrders.forEach(o => {
        // Contagem de Status
        if (o.status === 'Reembolsado') { refundedCount++; totalPaidOrders++; }
        if (o.status.includes('Cancelado')) cancelledCount++;
        if (o.status === 'Pendente' || o.status === 'Aguardando aprovação') pendingCount++;

        // Vendas Válidas (Confirmado, Entregue, Concluído, Saiu para entrega...)
        // Basicamente tudo que não é Cancelado, Pendente ou Reembolsado conta como "Venda Bruta" para métrica,
        // mas financeiramente geralmente somamos apenas o que foi aprovado.
        const validFinancialStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];
        
        if (validFinancialStatuses.includes(o.status)) {
            salesCount++;
            totalPaidOrders++;
            
            // Total Vendido
            salesTotal += (parseFloat(o.total) || 0);

            // Custo dos Produtos Vendidos (CMV)
            if (o.items) {
                o.items.forEach(item => {
                    // Tenta pegar custo histórico salvo no item, senão busca no produto atual
                    let itemCost = 0;
                    if (item.cost !== undefined) {
                        itemCost = parseFloat(item.cost);
                    } else {
                        const product = cachedProducts.find(p => p.id === item.id);
                        if (product) itemCost = parseFloat(product.cost || 0);
                    }
                    costTotal += itemCost * (parseInt(item.qty) || 0);
                });
            }
        }
    });

    const profitTotal = salesTotal - costTotal;

    // Renderização dos Valores
    setTxt('stat-sales-count', salesCount);
    setTxt('stat-sales-total', formatBRL(salesTotal));
    setTxt('stat-cost-total', formatBRL(costTotal));
    setTxt('stat-profit-total', formatBRL(profitTotal));
    
    setTxt('stat-refunded', refundedCount);
    setTxt('stat-cancelled', cancelledCount);
    setTxt('stat-pending', pendingCount);

    // 5. KPIs (Taxas)
    const totalOrders = filteredOrders.length;
    const approvalRate = totalOrders > 0 ? (salesCount / totalOrders) * 100 : 0;
    const refundRate = totalPaidOrders > 0 ? (refundedCount / totalPaidOrders) * 100 : 0;

    setTxt('stat-rate-approval', Math.round(approvalRate) + '%');
    setTxt('stat-rate-refund', Math.round(refundRate) + '%');

    // 6. Tendência (Últimos 30 dias fixos vs 30 dias anteriores)
    calculateTrend(cachedOrders);
}

function calculateTrend(allOrders) {
    const elTrend = document.getElementById('stat-trend-30');
    if (!elTrend) return;

    const now = new Date();
    // Zera hora para comparação justa
    now.setHours(23, 59, 59, 999);

    const last30Start = new Date(now); 
    last30Start.setDate(now.getDate() - 30);

    const prior30Start = new Date(last30Start);
    prior30Start.setDate(last30Start.getDate() - 30);

    let salesLast30 = 0;
    let salesPrior30 = 0;

    const validStatuses = ['Aprovado', 'Preparando pedido', 'Saiu para entrega', 'Entregue', 'Concluído'];

    allOrders.forEach(o => {
        if (!validStatuses.includes(o.status)) return;
        
        const d = new Date(o.date);
        const val = parseFloat(o.total) || 0;

        if (d > last30Start && d <= now) {
            salesLast30 += val;
        } else if (d > prior30Start && d <= last30Start) {
            salesPrior30 += val;
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

    elTrend.innerText = `${symbol}${Math.round(trend)}%`;
    elTrend.className = `text-3xl font-bold ${colorClass}`;
}

function setTxt(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}