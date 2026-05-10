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

// Faz a troca de cores do botão arredondado e aciona o filtro
window.selecionarCategoria = function(botaoClicado, valorCategoria) {
    // A função filterByCat já altera o valor do select escondido e chama o renderCatalog!
    if (typeof filterByCat === 'function') {
        filterByCat(valorCategoria);
    }

    // A mágica de mudar a cor agora é feita automaticamente 
    // toda vez que a função renderCategories() é chamada pelo Firebase,
    // mas para dar feedback instantâneo ao usuário:
    const todosBotoes = document.querySelectorAll('.categoria-btn');
    todosBotoes.forEach(btn => {
        btn.classList.remove('bg-brand-pink', 'text-white', 'border-brand-pink');
        btn.classList.add('bg-white/5', 'text-gray-400', 'border-gray-800');
    });

    botaoClicado.classList.remove('bg-white/5', 'text-gray-400', 'border-gray-800');
    botaoClicado.classList.add('bg-brand-pink', 'text-white', 'border-brand-pink');
    
    botaoClicado.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
};

// ===============================================
// LÓGICA: DROPDOWN DE SUBCATEGORIAS
// ===============================================
window.toggleCatDropdown = (parentName, event) => {
    event.stopPropagation();
    const dropdown = document.getElementById('global-cat-dropdown');
    
    // Se clicar na mesma seta que já tá aberta, fecha
    if (!dropdown.classList.contains('hidden') && dropdown.dataset.current === parentName) {
        fecharCatDropdown();
        return;
    }

    // Acha as subcategorias desse pai
    const subs = state.categories.filter(c => c.name.startsWith(parentName + ' - ') && c.name.split(' - ').length === parentName.split(' - ').length + 1);
    
    // Constrói a lista
    dropdown.innerHTML = subs.map(sub => {
        const safeSubName = sub.name.replace(/'/g, "\\'");
        const shortName = sub.name.replace(parentName + ' - ', '');
        return `
            <button onclick="filterByCat('${safeSubName}'); fecharCatDropdown()" class="block w-full text-left px-5 py-2.5 text-xs font-bold text-gray-400 hover:bg-[#252836] hover:text-white transition-colors">
                ${shortName}
            </button>
        `;
    }).join('');

    // Posiciona flutuando embaixo da seta clicada
    const btnRect = event.currentTarget.getBoundingClientRect();
    dropdown.style.top = `${btnRect.bottom + 8}px`;
    
    // Garante que o menu não vaze pra fora da tela na direita
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
    
    // Animação de entrada
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

// Clicar em qualquer lugar da tela fecha o Dropdown
document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-cat-dropdown') && !e.target.closest('.categoria-btn')) {
        fecharCatDropdown();
    }
});

// ===============================================
// LÓGICA: MUDANÇA DE COR DA PÍLULA AO CLICAR
// ===============================================
window.filterByCat = (catName) => {
    // 1. Suas regras normais de filtro (título, lógica)
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

    // 2. Muda a cor visualmente na hora
    const todosBotoes = document.querySelectorAll('.categoria-btn');
    todosBotoes.forEach(btn => {
        // Se a categoria clicada for o pai do botão, ou a exata categoria
        if (btn.dataset.cat === catName || catName.startsWith(btn.dataset.cat + ' -')) {
            btn.classList.remove('bg-[#1a1c23]', 'text-gray-400');
            btn.classList.add('bg-brand-pink', 'text-white', 'shadow-lg');
            
            // Só dá scroll se não for o botão principal vazio
            if (btn.dataset.cat !== '') {
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        } else if (btn.dataset.cat !== '') {
            btn.classList.add('bg-[#1a1c23]', 'text-gray-400');
            btn.classList.remove('bg-brand-pink', 'text-white', 'shadow-lg');
        } else {
            // Regra do botão "Todas"
            if (catName === '') {
                btn.classList.add('bg-brand-pink', 'text-white', 'shadow-lg');
            } else {
                btn.classList.remove('bg-brand-pink', 'shadow-lg');
                btn.classList.add('bg-[#1a1c23]', 'text-gray-400');
            }
        }
    });
};

// ===============================================
// LÓGICA: CARROSSEL COM AUTOSCROLL E ARRASTE
// ===============================================
window.initCategoryCarousel = () => {
    const slider = document.getElementById('categorias-scroll');
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;
    let autoScrollInterval;
    let isAutoScrolling = true;

    // Função de mover sozinho
    const playAutoScroll = () => {
        if (!isAutoScrolling) return;
        autoScrollInterval = setInterval(() => {
            if(slider.scrollWidth - slider.clientWidth <= slider.scrollLeft + 1) {
                // Chegou no final, volta pro começo devagar
                slider.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                slider.scrollLeft += 1; // Velocidade lenta
            }
        }, 30); // 30ms para ficar fluido
    };

    const stopAutoScroll = () => { clearInterval(autoScrollInterval); };

    playAutoScroll(); // Inicia logo de cara

    // Lógica para MOUSE
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        isAutoScrolling = false;
        stopAutoScroll();
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.style.cursor = 'grab';
        isAutoScrolling = true;
        playAutoScroll();
    });
    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.style.cursor = 'grab';
        setTimeout(() => { isAutoScrolling = true; playAutoScroll(); }, 2000); // Demora 2 seg pra voltar a rolar sozinho
    });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Multiplicador de velocidade do mouse
        slider.scrollLeft = scrollLeft - walk;
    });

    // Lógica para DEDO (Touch)
    slider.addEventListener('touchstart', () => { isAutoScrolling = false; stopAutoScroll(); }, {passive: true});
    slider.addEventListener('touchend', () => { 
        setTimeout(() => { isAutoScrolling = true; playAutoScroll(); }, 2000);
    });
};