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

// =====================================================================
// 🌟 SISTEMA DE CATEGORIAS PREMIUM (VIDRO, CORES DO PAINEL E CARROSSEL)
// =====================================================================

// 1. SINCRONIZADOR VISUAL (Fundo sempre translúcido, Respeita o Painel)
window.aplicarCoresCategorias = (catName) => {
    const todosBotoes = document.querySelectorAll('.categoria-btn');
    
    todosBotoes.forEach(btn => {
        const isAtivo = btn.dataset.cat === catName || (catName !== '' && catName.startsWith(btn.dataset.cat + ' -'));
        
        if (isAtivo) {
            // ATIVO: Vidro mais denso (20%), Texto e Borda na cor de DESTAQUE da loja
            btn.classList.remove('bg-white/5', 'border-transparent', 'text-[var(--txt-body)]', 'opacity-70');
            btn.classList.add('bg-white/20', 'border-[var(--clr-accent)]', 'text-[var(--clr-accent)]', 'opacity-100');
        } else {
            // INATIVO: Vidro super transparente (5%), Sem borda, Texto na cor PADRÃO da loja
            btn.classList.remove('bg-white/20', 'border-[var(--clr-accent)]', 'text-[var(--clr-accent)]', 'opacity-100');
            btn.classList.add('bg-white/5', 'border-transparent', 'text-[var(--txt-body)]', 'opacity-70');
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

    window.aplicarCoresCategorias(catName); // Atualiza a cor visualmente na hora
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
    ['category-filter','admin-filter-cat','bulk-category-select','prod-cat-select','bulk-category-select-dynamic'].forEach(populateSelect);

    const scrollContainer = document.getElementById('categorias-scroll');
    if (scrollContainer) {
        let activeCat = document.getElementById('category-filter')?.value || '';
        
        // Segurança
        if (activeCat !== '') {
            const catExists = state.categories.some(c => c.name === activeCat || activeCat.startsWith(c.name + ' -'));
            if (!catExists) { activeCat = ''; renderCatalog(state.products); }
        }

        let pillsHtml = '';
        const principais = state.categories.filter(c => !c.name.includes(' - '));
        const categoriasParaMostrar = principais.length > 0 ? principais : state.categories;

        categoriasParaMostrar.forEach(c => {
            const safeName = c.name.replace(/'/g, "\\'");
            const hasSubs = state.categories.some(sub => sub.name.startsWith(c.name + ' - '));
            
            // ESTRUTURA: Fonte Nunito Black arredondada, vidro fosco, inativa por padrão
            const classesEstrutura = "categoria-btn flex items-center h-full rounded-full transition-all shrink-0 border backdrop-blur-md font-['Nunito'] font-black tracking-wide text-xs outline-none bg-white/5 border-transparent text-[var(--txt-body)] opacity-70";

            if (hasSubs) {
                pillsHtml += `
                    <div class="${classesEstrutura}" data-cat="${safeName}">
                        <button onclick="filterByCat('${safeName}')" class="px-4 h-full rounded-l-full outline-none">
                            ${c.name}
                        </button>
                        <button onclick="toggleCatDropdown('${safeName}', event)" class="px-3 h-full border-l border-white/10 flex items-center justify-center rounded-r-full hover:bg-white/10 outline-none transition-colors">
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

        // Pinta a cor ativa com base na variável do painel assim que renderiza
        setTimeout(() => { window.aplicarCoresCategorias(activeCat); }, 10);

        if (typeof initCategoryCarousel === 'function') initCategoryCarousel();
    }

    // --- SIDEBAR (Mantido igual ao seu) ---
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
            <button onclick="filterByCat('${safeSubName}'); fecharCatDropdown()" class="block w-full text-left px-5 py-2.5 text-xs font-bold text-gray-400 hover:bg-white/10 hover:text-white transition-colors outline-none">
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

// 5. CARROSSEL COM PING-PONG BLINDADO E PAUSA
window.isCategorySelected = false;
window.initCategoryCarousel = () => {
    const slider = document.getElementById('categorias-scroll');
    if (!slider) return;

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
        
        // Verifica o select nativo para pausa 100% segura
        const selectEscondido = document.getElementById('category-filter');
        const temCategoriaAtiva = selectEscondido && selectEscondido.value !== '';

        if (!isAutoScrolling || temCategoriaAtiva) return;

        const maxScroll = slider.scrollWidth - slider.clientWidth;
        if (maxScroll <= 0) return;

        if (slider.scrollLeft >= maxScroll - 2) scrollDirection = -1; 
        else if (slider.scrollLeft <= 0) scrollDirection = 1; 

        slider.scrollLeft += scrollDirection;
    };

    playAutoScroll();

    if (!slider.dataset.eventsSet) {
        slider.dataset.eventsSet = "true";
        slider.addEventListener('mousedown', (e) => {
            isDown = true; isAutoScrolling = false; slider.style.cursor = 'grabbing';
            startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = 'grab'; isAutoScrolling = true; });
        slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = 'grab'; setTimeout(() => { isAutoScrolling = true; }, 2000); });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return; e.preventDefault();
            const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; 
            slider.scrollLeft = scrollLeft - walk;
        });
        slider.addEventListener('touchstart', () => { isAutoScrolling = false; }, {passive: true});
        slider.addEventListener('touchend', () => { setTimeout(() => { isAutoScrolling = true; }, 2000); });
    }
};