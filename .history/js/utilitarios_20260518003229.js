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
// 🖨️ EXPORTAÇÃO DE PRODUTOS (EXCEL & PDF) BASEADO NOS FILTROS
// =================================================================

window.exportProductsExcel = () => {
    // Pega exatamente a lista que está passando pelos filtros da tela
    const products = typeof getCurrentFilteredProducts === 'function' ? getCurrentFilteredProducts() : state.products;
    
    if (products.length === 0) return showToast("Nenhum produto para exportar.", "error");

    let rowsHtml = '';
    let totalStock = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;

    products.forEach(p => {
        const isInactive = p.active === false;
        const statusStr = isInactive ? 'Inativo' : 'Ativo';
        const code = p.code || '-';
        const cat = p.category || 'Geral';
        const price = parseFloat(p.promoPrice || p.price || 0);
        const cost = parseFloat(p.cost || 0);
        
        // Pega o estoque real independentemente se é gradeado ou geral
        let stock = 0;
        if (p.hasVariations && p.sizes) {
            stock = p.sizes.reduce((acc, s) => acc + (parseInt(s.stock) || 0), 0);
        } else {
            stock = parseInt(p.stock) || parseInt(p.generalStock) || 0;
        }

        totalStock += stock;
        totalCostValue += (cost * stock);
        totalSaleValue += (price * stock);

        rowsHtml += `
            <tr>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center;">${code}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${p.name}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px;">${cat}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; color: ${isInactive ? '#dc2626' : '#16a34a'}; font-weight: bold;">${statusStr}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; font-weight: bold;">${stock}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #64748b;">R$ ${cost.toFixed(2).replace('.', ',')}</td>
                <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #2563eb;">R$ ${price.toFixed(2).replace('.', ',')}</td>
            </tr>
        `;
    });

    const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"></head>
        <body>
            <table>
                <tr><td colspan="7" style="text-align: center; font-size: 20px; font-weight: bold; background-color: #f1f5f9; padding: 10px;">RELATÓRIO DE ESTOQUE - PRODUTOS</td></tr>
                <tr><td colspan="7" style="text-align: right; font-size: 12px; font-style: italic;">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</td></tr>
                <tr><td colspan="7"></td></tr>
                <tr>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">CÓDIGO</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">PRODUTO</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">CATEGORIA</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">STATUS</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">ESTOQUE (QTD)</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">CUSTO UN.</th>
                    <th style="background-color: #1e3a8a; color: white; padding: 10px; border: 1px solid #1e3a8a;">VENDA UN.</th>
                </tr>
                ${rowsHtml}
                <tr><td colspan="7"></td></tr>
                <tr style="background-color: #f8fafc;">
                    <td colspan="4" style="text-align: right; padding: 10px; font-weight: bold; border: 1px solid #cbd5e1;">TOTAIS FILTRADOS:</td>
                    <td style="text-align: center; padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; font-size: 16px;">${totalStock} un.</td>
                    <td style="text-align: right; padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; color: #dc2626;">R$ ${totalCostValue.toFixed(2).replace('.', ',')}</td>
                    <td style="text-align: right; padding: 10px; font-weight: bold; border: 1px solid #cbd5e1; color: #16a34a;">R$ ${totalSaleValue.toFixed(2).replace('.', ',')}</td>
                </tr>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Relatorio_Estoque_${new Date().getTime()}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Planilha gerada com sucesso!", "success");
};

window.exportProductsPDF = () => {
    const products = typeof getCurrentFilteredProducts === 'function' ? getCurrentFilteredProducts() : state.products;
    if (products.length === 0) return showToast("Nenhum produto para exportar.", "error");

    let rowsHtml = '';
    let totalStock = 0;

    products.forEach(p => {
        const isInactive = p.active === false;
        const statusStr = isInactive ? '<span style="color: #dc2626; font-weight:bold;">Inativo</span>' : '<span style="color: #16a34a; font-weight:bold;">Ativo</span>';
        const code = p.code || '-';
        const price = parseFloat(p.promoPrice || p.price || 0);
        
        let stock = 0;
        if (p.hasVariations && p.sizes) {
            stock = p.sizes.reduce((acc, s) => acc + (parseInt(s.stock) || 0), 0);
        } else {
            stock = parseInt(p.stock) || parseInt(p.generalStock) || 0;
        }
        totalStock += stock;

        rowsHtml += `
            <tr>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${code}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${p.name} <br> <span style="font-size: 10px; color: #64748b;">${p.category || 'Geral'}</span></td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">${statusStr}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${stock}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${formatCurrency(price)}</td>
            </tr>
        `;
    });

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
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                th { background-color: #f8fafc; padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; color: #475569; }
                th.center { text-align: center; }
                th.right { text-align: right; }
                .totais { background-color: #f1f5f9; font-size: 14px; }
                .totais td { padding: 15px; border-top: 2px solid #cbd5e1; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Relatório de Estoque / Produtos</h2>
                <div class="meta-info">
                    <span><strong>Filtro aplicado:</strong> Lista Atual (${products.length} itens)</span>
                    <span><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</span>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="center" style="width: 10%;">Cód</th>
                        <th style="width: 45%;">Produto e Categoria</th>
                        <th class="center" style="width: 15%;">Status</th>
                        <th class="center" style="width: 15%;">Estoque Total</th>
                        <th class="right" style="width: 15%;">Venda Un.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr class="totais">
                        <td colspan="3" style="text-align: right;">TOTAIS NA LISTA:</td>
                        <td style="text-align: center; color: #1e3a8a;">${totalStock} peças</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Aguarda o render e abre o pop-up de impressão nativo
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
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
