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
// 📄 GERENCIADOR DE TÓPICOS INSTITUCIONAIS (PÁGINAS)
// =================================================================

// Variável para controlar qual tópico está sendo editado (-1 = Novo)
state.editingTopicIndex = -1;

// 1. CARREGAR E RENDERIZAR NO ADMIN
window.renderAdminTopics = () => {
    const listContainer = document.getElementById('lista-topicos');
    const chkMaster = document.getElementById('ativar-topicos-geral');
    if (!listContainer || !chkMaster) return;

    // Garante que a estrutura existe no state
    if (!state.storeProfile.customTopics) state.storeProfile.customTopics = [];

    // Atualiza o checkbox mestre
    chkMaster.checked = !!state.storeProfile.enableCustomTopics;

    listContainer.innerHTML = '';

    if (state.storeProfile.customTopics.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-xs text-center py-4 italic">Nenhum tópico criado ainda.</p>';
        return;
    }

    state.storeProfile.customTopics.forEach((topic, index) => {
        const isActive = topic.active !== false; // Padrão é true
        const bgClass = index === state.editingTopicIndex ? 'bg-blue-900/20 border-blue-500/50' : 'bg-black border-gray-600';

        listContainer.innerHTML += `
            <div class="flex items-center justify-between border rounded-md px-4 py-3 ${bgClass} transition-colors">
                <span class="text-white font-bold text-sm truncate pr-4">${topic.title}</span>
                
                <div class="flex items-center gap-4 shrink-0">
                    <button onclick="deleteTopic(${index})" class="text-gray-600 hover:text-red-500 transition-colors" title="Excluir">
                        <i class="far fa-trash-alt text-base"></i>
                    </button>
                    <button onclick="editTopic(${index})" class="text-gray-400 hover:text-brand-blue transition-colors" title="Editar">
                        <i class="fas fa-pencil-alt text-base"></i>
                    </button>
                    
                    <label class="relative inline-flex items-center cursor-pointer ml-2">
                        <input type="checkbox" class="sr-only peer" ${isActive ? 'checked' : ''} onchange="toggleTopicStatus(${index})">
                        <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#10b981]"></div>
                    </label>
                </div>
            </div>
        `;
    });
};

// 2. SALVAR NOVO OU EDITADO
window.saveTopicAction = async () => {
    const titleInput = document.getElementById('topico-titulo');
    const descInput = document.getElementById('topico-descricao');
    const btnAcao = document.getElementById('btn-topico-acao');

    const title = titleInput.value.trim();
    const content = descInput.value; // Não dá trim aqui para preservar quebras de linha intencionais

    if (!title) return showToast("Digite um título para o tópico.", "error");
    if (!content) return showToast("A descrição não pode ficar vazia.", "error");

    if (!state.storeProfile.customTopics) state.storeProfile.customTopics = [];

    // Muda botão visualmente
    const originalText = btnAcao.innerText;
    btnAcao.innerText = "Salvando...";
    btnAcao.disabled = true;

    try {
        if (state.editingTopicIndex >= 0) {
            // Editando existente
            state.storeProfile.customTopics[state.editingTopicIndex].title = title;
            state.storeProfile.customTopics[state.editingTopicIndex].content = content;
        } else {
            // Criando novo
            state.storeProfile.customTopics.push({
                title: title,
                content: content,
                active: true
            });
        }

        // Salva direto no Firebase (Merge true para não apagar o resto do perfil)
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), {
            customTopics: state.storeProfile.customTopics
        }, { merge: true });

        showToast("Tópico salvo com sucesso!", "success");

        // Limpa formulário
        window.resetTopicForm();
        renderAdminTopics();
        renderSidebarTopics(); // Atualiza a loja em tempo real

    } catch (error) {
        console.error("Erro ao salvar tópico:", error);
        showToast("Erro ao salvar.", "error");
    } finally {
        btnAcao.innerText = originalText;
        btnAcao.disabled = false;
    }
};

// 3. EDITAR TÓPICO
window.editTopic = (index) => {
    const topic = state.storeProfile.customTopics[index];
    if (!topic) return;

    state.editingTopicIndex = index;

    document.getElementById('topico-titulo').value = topic.title;
    document.getElementById('topico-descricao').value = topic.content;
    document.getElementById('topico-descricao-container').classList.remove('hidden');

    const btn = document.getElementById('btn-topico-acao');
    btn.innerText = "Salvar Alteração";
    btn.classList.replace('bg-[#10b981]', 'bg-blue-600');
    btn.classList.replace('hover:bg-[#059669]', 'hover:bg-blue-500');

    renderAdminTopics(); // Re-renderiza para mostrar a borda de qual está sendo editado
    document.getElementById('topico-titulo').focus();
    document.getElementById('topico-titulo').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

// 4. CANCELAR/RESETAR FORM
window.resetTopicForm = () => {
    state.editingTopicIndex = -1;
    document.getElementById('topico-titulo').value = '';
    document.getElementById('topico-descricao').value = '';
    // Esconde a descrição novamente para ficar limpo
    document.getElementById('topico-descricao-container').classList.add('hidden');

    const btn = document.getElementById('btn-topico-acao');
    btn.innerText = "Novo";
    btn.classList.replace('bg-blue-600', 'bg-[#10b981]');
    btn.classList.replace('hover:bg-blue-500', 'hover:bg-[#059669]');

    renderAdminTopics();
};

// 5. EXCLUIR TÓPICO
window.deleteTopic = async (index) => {
    if (!confirm("Tem certeza que deseja excluir este tópico definitivamente?")) return;

    state.storeProfile.customTopics.splice(index, 1);

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), {
            customTopics: state.storeProfile.customTopics
        }, { merge: true });

        if (state.editingTopicIndex === index) resetTopicForm();
        renderAdminTopics();
        renderSidebarTopics();
        showToast("Tópico excluído!");
    } catch (e) {
        showToast("Erro ao excluir.", "error");
    }
};

// 6. ATIVAR/INATIVAR E MASTER CHECKBOX
window.toggleTopicStatus = async (index) => {
    const topic = state.storeProfile.customTopics[index];
    topic.active = !topic.active;

    try {
        await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { customTopics: state.storeProfile.customTopics }, { merge: true });
        renderSidebarTopics();
    } catch (e) { console.error(e); }
};

// Ouve a mudança no checkbox Mestre lá do HTML do Admin
document.addEventListener('DOMContentLoaded', () => {
    const chkMaster = document.getElementById('ativar-topicos-geral');
    if (chkMaster) {
        chkMaster.addEventListener('change', async (e) => {
            state.storeProfile.enableCustomTopics = e.target.checked;
            try {
                await setDoc(doc(db, `sites/${state.siteId}/settings`, 'profile'), { enableCustomTopics: e.target.checked }, { merge: true });
                renderSidebarTopics();
                showToast(e.target.checked ? "Tópicos ativados na loja!" : "Tópicos ocultos da loja.");
            } catch (err) { console.error(err); }
        });
    }

    // Configura o input do título para mostrar a caixa de descrição ao digitar
    const titleInput = document.getElementById('topico-titulo');
    if (titleInput) {
        titleInput.addEventListener('input', () => {
            if (titleInput.value.trim().length > 0) {
                document.getElementById('topico-descricao-container').classList.remove('hidden');
            } else if (state.editingTopicIndex === -1) {
                document.getElementById('topico-descricao-container').classList.add('hidden');
            }
        });
    }

    // Vincula o botão Novo/Salvar
    const btnAcao = document.getElementById('btn-topico-acao');
    if (btnAcao) btnAcao.onclick = saveTopicAction;
});

// =================================================================
// RENDERIZAÇÃO NA LOJA (CLIENTE)
// =================================================================

window.renderSidebarTopics = () => {
    // Procura uma div específica para colocar os tópicos no menu lateral
    // Recomendação: crie uma <div id="sidebar-custom-topics" class="mt-6 pt-4 border-t border-gray-800"></div> no seu menu lateral
    let container = document.getElementById('sidebar-custom-topics');

    // Se não existir, tenta anexar no final das categorias
    if (!container) {
        const catContainer = document.getElementById('sidebar-categories');
        if (catContainer) {
            container = document.createElement('div');
            container.id = 'sidebar-custom-topics';
            container.className = 'mt-6 pt-4 border-t border-gray-800 flex flex-col gap-1';
            catContainer.parentNode.appendChild(container);
        } else {
            return; // Se não achar onde colocar, para.
        }
    }

    container.innerHTML = '';

    // Se o master checkbox estiver desligado, não mostra nada
    if (!state.storeProfile.enableCustomTopics || !state.storeProfile.customTopics) return;

    const activeTopics = state.storeProfile.customTopics.filter(t => t.active !== false);

    activeTopics.forEach((topic, index) => {
        // Usa o index original do array para poder resgatar o texto exato
        const originalIndex = state.storeProfile.customTopics.findIndex(t => t.title === topic.title);

        container.innerHTML += `
            <button onclick="openClientTopic(${originalIndex})" class="w-full text-left py-2 px-3 text-sm font-bold text-gray-400 hover:text-white hover:bg-gray-800 rounded transition flex items-center gap-2">
                <i class="fas fa-file-alt text-[10px]"></i> ${topic.title}
            </button>
        `;
    });
};

window.openClientTopic = (index) => {
    const topic = state.storeProfile.customTopics[index];
    if (!topic) return;

    document.getElementById('topic-display-title').innerText = topic.title;
    document.getElementById('topic-display-content').innerText = topic.content;

    // Usa a função central de navegação para mostrar a tela
    showView('topic');
    toggleSidebar(); // Fecha o menu lateral do mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
};