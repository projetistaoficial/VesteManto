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

    // Troca o título baseado no que ele tá editando
    title.innerHTML = type === 'logo' 
        ? '<i class="fas fa-store mr-2"></i> Recortar Logo (1:1)' 
        : '<i class="fas fa-image mr-2"></i> Recortar Banner (Largo)';

    imageEl.src = imageSrc;

    // Mostra o Modal com animação
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);

    // Destrói o cropper antigo se existir
    if (window.cropper) {
        window.cropper.destroy();
    }

    // Cria o Cropper novo com as regras exatas (Tempo para a imagem carregar no HTML)
    setTimeout(() => {
        // Logo é quadrado (1/1). Banner é um retângulo largo (ex: 21/9 ou 16/9)
        const ratio = type === 'logo' ? 1 / 1 : 21 / 9;

        window.cropper = new Cropper(imageEl, {
            aspectRatio: ratio,
            viewMode: 2, // Impede que o corte saia para fora da imagem preta
            dragMode: 'move', // Padrão: move a imagem ao arrastar (melhor pro celular)
            autoCropArea: 0.9, // Começa pegando 90% da imagem
            restore: false,
            guides: true, // Mostra as linhas de grade de regra dos terços
            center: true,
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
// 🖼️ SISTEMA PROFISSIONAL DE RECORTE DE IMAGEM (CROPPER.JS) - CARREGAS AS IMAGENS E ABRE O MODAL DE CORTE (INICIO))
// =================================================================