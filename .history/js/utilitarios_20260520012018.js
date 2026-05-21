// =================================================================
// 📊 EXPORTAÇÃO FINANCEIRA (PDF E EXCEL)
// =================================================================

// 1. Exportar para Excel (Gera um arquivo CSV compatível com acentos)
window.exportFinanceExcel = (orderId) => {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return showToast("Pedido não encontrado.", "error");

    // Prepara o cabeçalho do arquivo (o \uFEFF garante que o Excel leia os acentos/cedilha)
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Item,Quantidade,Custo Unitario,Custo Total,Venda Total,Lucro\r\n";

    let totalCost = 0;
    let totalRevenue = 0;
    let totalProfit = 0;

    // Processa os itens
    (order.items || []).forEach(i => {
        const cost = parseFloat(i.cost) || 0;
        const revenue = parseFloat(i.price) * parseInt(i.qty);
        const costTotal = cost * parseInt(i.qty);
        const profit = revenue - costTotal;

        totalCost += costTotal;
        totalRevenue += revenue;
        totalProfit += profit;

        // Limpa nomes que possam ter vírgulas para não quebrar a planilha
        const safeName = `"${i.name.replace(/"/g, '""')}"`;
        
        // Formata os números para o padrão brasileiro de Excel (vírgula no decimal)
        const fmtCost = cost.toFixed(2).replace('.', ',');
        const fmtCostTotal = costTotal.toFixed(2).replace('.', ',');
        const fmtRev = revenue.toFixed(2).replace('.', ',');
        const fmtProf = profit.toFixed(2).replace('.', ',');

        csvContent += `${safeName},${i.qty},R$ ${fmtCost},R$ ${fmtCostTotal},R$ ${fmtRev},R$ ${fmtProf}\r\n`;
    });

    // Adiciona a linha de totais no final
    const finalRevenue = order.total || totalRevenue;
    const finalProfit = finalRevenue - totalCost;
    
    csvContent += `\r\nTOTAL GERAL,,,,R$ ${finalRevenue.toFixed(2).replace('.', ',')},R$ ${finalProfit.toFixed(2).replace('.', ',')}\r\n`;

    // Cria o link invisível e força o download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Analise_Lucro_Pedido_${order.code || orderId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
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

// ==========================================
// CONTROLE DA NOVA BARRA DE BUSCA E PÍLULAS
// ==========================================

// Limpa a busca e esconde o botão "X"
window.limparBusca = function() {
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    
    if (searchInput) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
        searchInput.focus(); 
        
        // Recarrega o catálogo geral (como se tivesse apagado o texto)
        renderCatalog(state.products);
    }
};

// // Faz a troca de cores do botão arredondado e aciona o filtro
// window.selecionarCategoria = function(botaoClicado, valorCategoria) {
//     // A função filterByCat já altera o valor do select escondido e chama o renderCatalog!
//     if (typeof filterByCat === 'function') {
//         filterByCat(valorCategoria);
//     }

//     // A mágica de mudar a cor agora é feita automaticamente 
//     // toda vez que a função renderCategories() é chamada pelo Firebase,
//     // mas para dar feedback instantâneo ao usuário:
//     const todosBotoes = document.querySelectorAll('.categoria-btn');
//     todosBotoes.forEach(btn => {
//         btn.classList.remove('bg-brand-pink', 'text-white', 'border-brand-pink');
//         btn.classList.add('bg-white/5', 'text-gray-400', 'border-gray-800');
//     });

//     botaoClicado.classList.remove('bg-white/5', 'text-gray-400', 'border-gray-800');
//     botaoClicado.classList.add('bg-brand-pink', 'text-white', 'border-brand-pink');
    
//     botaoClicado.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
// };


// =================================================================
// 🖨️ MÓDULO DE EXPORTAÇÃO DINÂMICA (PDF & EXCEL)
// =================================================================

const formatMoney = (val) => parseFloat(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

window.gerarRelatorioAvancado = (products, config, metricsMap = {}) => {
    let rowsHtml = '';
    let headersHtml = `
        <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; width: 10%; text-align: center;">CÓDIGO</th>
        <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: left;">PRODUTO</th>
    `;
    
    // Constrói Cabeçalhos Dinâmicos
    if (config.showCat) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: left;">CATEGORIA</th>`;
    headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: center;">STATUS</th>`;
    
    if (config.showStock) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: center;">ESTOQUE</th>`;
    if (config.showSales) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: center;">QTD VENDIDA</th>`; // <--- CABEÇALHO DINÂMICO
    if (config.showCost) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: right;">CUSTO UN.</th>`;
    if (config.showPrice) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: right;">PREÇO VENDA</th>`;
    if (config.showPromo) headersHtml += `<th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a; text-align: right;">PREÇO PROMO</th>`;

    let totalStock = 0;
    let totalSales = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    // Constrói Linhas
    products.forEach(p => {
        const isInactive = p.active === false;
        const statusStr = isInactive ? '<span style="color: #dc2626; font-weight:bold;">Inativo</span>' : '<span style="color: #16a34a; font-weight:bold;">Ativo</span>';
        
        let stock = p.hasVariations && p.sizes ? p.sizes.reduce((acc, s) => acc + (parseInt(s.stock) || 0), 0) : (parseInt(p.stock) || parseInt(p.generalStock) || 0);
        const qtySales = metricsMap[p.id] || 0; // Pega do mapa reativo passado pelo app.js
        
        const cost = parseFloat(p.cost || 0);
        const price = parseFloat(p.price || 0);
        const promo = parseFloat(p.promoPrice || 0);

        totalStock += stock;
        totalSales += qtySales;
        totalCostValue += (cost * stock);
        totalSaleValue += (promo > 0 ? promo * stock : price * stock);

        rowsHtml += `<tr>`;
        rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${p.code || '-'}</td>`;
        rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold;">${p.name}</td>`;
        if (config.showCat) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; color: #475569;">${p.category || 'Geral'}</td>`;
        
        rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${statusStr}</td>`;
        
        if (config.showStock) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${stock}</td>`;
        if (config.showSales) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold; color: #1e40af;">${qtySales || '-'}</td>`; // <--- COLUNA DINÂMICA
        if (config.showCost) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #64748b;">${formatMoney(cost)}</td>`;
        if (config.showPrice) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #1e40af;">${formatMoney(price)}</td>`;
        if (config.showPromo) rowsHtml += `<td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #16a34a;">${promo > 0 ? formatMoney(promo) : '-'}</td>`;
        rowsHtml += `</tr>`;
    });

    // Constrói Rodapé de Totais
    let colSpanTotais = 2; // Cód + Nome + Status base
    if (config.showCat) colSpanTotais += 1;
    
    let totaisHtml = `<tr style="background-color: #f8fafc;">`;
    totaisHtml += `<td colspan="${colSpanTotais}" style="text-align: right; padding: 12px; font-weight: bold; border: 1px solid #cbd5e1;">TOTAIS FILTRADOS (${products.length} itens):</td>`;
    
    if (config.showStock) totaisHtml += `<td style="text-align: center; padding: 12px; font-weight: bold; border: 1px solid #cbd5e1; font-size: 13px; color: #1e3a8a;">${totalStock} pçs</td>`;
    if (config.showSales) totaisHtml += `<td style="text-align: center; padding: 12px; font-weight: bold; border: 1px solid #cbd5e1; font-size: 13px; color: #1e40af;">${totalSales} vend.</td>`; // <--- TOTAL DE VENDAS NO RODAPÉ
    if (config.showCost) totaisHtml += `<td style="text-align: right; padding: 12px; font-weight: bold; border: 1px solid #cbd5e1; color: #dc2626;">Custo:<br>${formatMoney(totalCostValue)}</td>`;
    
    if (config.showPrice || config.showPromo) {
        let extraSpan = (config.showPrice && config.showPromo) ? 2 : 1;
        totaisHtml += `<td colspan="${extraSpan}" style="text-align: right; padding: 12px; font-weight: bold; border: 1px solid #cbd5e1; color: #16a34a;">Venda Est.:<br>${formatMoney(totalSaleValue)}</td>`;
    }
    totaisHtml += `</tr>`;

    // GERA O ARQUIVO ESCOLHIDO
    if (config.format === 'excel') {
        const tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"></head>
            <body>
                <table style="font-family: Arial, sans-serif; border-collapse: collapse;">
                    <tr><td colspan="${colSpanTotais + 5}" style="text-align: center; font-size: 20px; font-weight: bold; background-color: #f1f5f9; padding: 15px;">RELATÓRIO GERENCIAL DE ESTOQUE</td></tr>
                    <tr><td colspan="${colSpanTotais + 5}" style="text-align: right; font-size: 11px; font-style: italic;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</td></tr>
                    <tr><td colspan="${colSpanTotais + 5}"></td></tr>
                    <tr>${headersHtml}</tr>
                    ${rowsHtml}
                    <tr><td colspan="${colSpanTotais + 5}"></td></tr>
                    ${totaisHtml}
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Relatorio_Personalizado_${new Date().getTime()}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } 
    else {
        // GERA PDF
        const printWindow = window.open('', '_blank', 'width=900,height=600');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Relatório de Estoque</title>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #0f172a; }
                    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; }
                    h2 { margin: 0; color: #1e3a8a; text-transform: uppercase; font-size: 22px; }
                    .meta-info { display: flex; justify-content: space-between; font-size: 12px; color: #64748b; margin-top: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
                    th { background-color: #f8fafc; padding: 10px; text-align: left; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; color: #475569; }
                    td { border: 1px solid #e2e8f0; padding: 8px; }
                    .totais td { background-color: #f1f5f9; padding: 12px; font-size: 13px; border-top: 2px solid #94a3b8; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>Relatório Gerencial</h2>
                    <div class="meta-info">
                        <span><strong>Total de Itens:</strong> ${products.length}</span>
                        <span><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</span>
                    </div>
                </div>
                <table>
                    <thead><tr>${headersHtml}</tr></thead>
                    <tbody>${rowsHtml}${totaisHtml}</tbody>
                </table>
            </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
};

// =================================================================
// 🚀 ATUALIZAÇÃO EM LOTE DE STATUS (ATIVO/INATIVO) COM FILTRO INTELIGENTE - Restante em App.js
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
            if(idx !== -1) state.products[idx].active = isActive;
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
    if(searchInput) searchInput.value = '';
    if(catInput) catInput.value = '';
    if(statusInput) statusInput.value = '';

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
            if(evt.newIndex !== evt.oldIndex) {
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
        try { window.productSortable.destroy(); } catch(e){}
        window.productSortable = null;
    }

    if (state.backupProductsStr) state.products = JSON.parse(state.backupProductsStr);
    state.isReorderMode = false;
    
    if (typeof filterAndRenderProducts === 'function') filterAndRenderProducts();
    showToast("Reorganização Cancelada.", "info");
};

window.saveReorder = async () => {
    const btn = document.querySelector('button[onclick="saveReorder()"]');
    if(btn) { btn.innerText = "⏳ Salvando..."; btn.disabled = true; }

    // ✨ CORREÇÃO CRÍTICA: Destrói a biblioteca ANTES do Firebase começar a alterar a tela
    if (window.productSortable) {
        try { window.productSortable.destroy(); } catch(e){}
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
        if(btn) { btn.innerText = "Salvar"; btn.disabled = false; }
    }
};

window.resetReorderToDefault = () => {
    state.products.sort(defaultProductSort);
    state.products.forEach((p, index) => p.order = (index + 1) * 10);
    renderProductsList(state.products);
    window.startReorderMode(); 
    showToast("Ordem padrão calculada! Destaque > Oferta > Novo.", "info");
};
