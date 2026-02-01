// Arquivo: master/js/painel.js

// Note o caminho voltando pastas para achar o config na raiz
import { db, collection, doc, setDoc, getDocs, updateDoc, deleteDoc } from '../../js/firebase-config.js';

// 1. Função para criar loja
window.criarNovaLoja = async () => {
    const nome = document.getElementById('nome-loja').value;
    // Força letras minúsculas e remove espaços para o ID
    const id = document.getElementById('id-url').value.toLowerCase().replace(/\s+/g, '-'); 
    const dias = parseInt(document.getElementById('plano').value);

    if(!nome || !id) return alert("Preencha o nome e o ID da URL!");

    // Calcula a data de expiração
    const dataVencimento = new Date();
    dataVencimento.setDate(dataVencimento.getDate() + dias);

    try {
        // Cria o documento na coleção "tenants" (Inquilinos)
        await setDoc(doc(db, "tenants", id), {
            nome: nome,
            status: 'ativo',
            vencimento: dataVencimento,
            criadoEm: new Date()
        });

        alert(`Loja criada com sucesso!\nLink: ${window.location.origin}/index.html?site=${id}`);
        document.getElementById('nome-loja').value = '';
        document.getElementById('id-url').value = '';
        carregarLojas(); // Atualiza a tabela
    } catch (error) {
        console.error("Erro ao criar:", error);
        alert("Erro ao criar loja (Verifique o Console ou Permissões)");
    }
};

// 2. Função para listar as lojas na tabela
async function carregarLojas() {
    const tbody = document.getElementById('lista-corpo');
    tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "tenants"));
        tbody.innerHTML = ''; // Limpa tabela

        querySnapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            const id = docSnap.id;
            
            // Formata a data
            const dataVenc = dados.vencimento ? dados.vencimento.toDate().toLocaleDateString('pt-BR') : 'Sem data';
            
            // Gera o link
            // Nota: ../ volta para a raiz para pegar o index.html correto
            const linkReal = `${window.location.origin}/index.html?site=${id}`;

            const classeStatus = dados.status === 'ativo' ? 'status-ativo' : 'status-bloqueado';
            const textoBotao = dados.status === 'ativo' ? 'Bloquear' : 'Ativar';
            const corBotao = dados.status === 'ativo' ? '#f59e0b' : '#22c55e'; // Amarelo ou Verde

            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong style="font-size:1.1em">${dados.nome}</strong><br>
                        <a href="${linkReal}" target="_blank" style="color:#60a5fa; font-size:0.9em; text-decoration:none;">${linkReal}</a>
                    </td>
                    <td class="${classeStatus}" style="font-weight:bold;">${dados.status.toUpperCase()}</td>
                    <td>${dataVenc}</td>
                    <td>
                        <button onclick="mudarStatus('${id}', '${dados.status}')" class="btn-sm" style="background:${corBotao}">${textoBotao}</button>
                        <button onclick="deletarLoja('${id}')" class="btn-sm" style="background:#ef4444">Excluir</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4">Erro ao carregar (Verifique as Regras do Firebase)</td></tr>';
    }
}

// 3. Função para Bloquear/Ativar
window.mudarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ativo' ? 'bloqueado' : 'ativo';
    await updateDoc(doc(db, "tenants", id), { status: novoStatus });
    carregarLojas();
};

// 4. Função para Excluir
window.deletarLoja = async (id) => {
    if(confirm(`Tem certeza que deseja apagar a loja "${id}"? Isso não pode ser desfeito.`)) {
        await deleteDoc(doc(db, "tenants", id));
        carregarLojas();
    }
};

// Inicia carregando a lista
carregarLojas();