import { db } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

async function carregarClientes() {
    const querySnapshot = await getDocs(collection(db, "sites"));
    const container = document.getElementById('lista-clientes-body');
    let total = 0;
    let ativas = 0;

    container.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
        const loja = docSnap.data();
        const id = docSnap.id;
        total++;
        if(loja.status === 'ativo') ativas++;

        container.innerHTML += `
            <tr class="border-b border-gray-800 hover:bg-gray-800/50">
                <td class="p-4">
                    <div class="font-bold">${loja.nome || 'Sem Nome'}</div>
                    <div class="text-xs text-gray-500">${id}</div>
                </td>
                <td class="p-4 text-sm">${loja.emailAdmin || '---'}</td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded text-xs font-bold ${loja.status === 'ativo' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}">
                        ${loja.status?.toUpperCase() || 'INATIVO'}
                    </span>
                </td>
       a         <td class="p-4">
                    <button onclick="alternarStatus('${id}', '${loja.status}')" class="text-blue-400 hover:underline text-sm">
                        ${loja.status === 'ativo' ? 'Suspender' : 'Ativar'}
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('total-clientes').innerText = total;
    document.getElementById('lojas-ativas').innerText = ativas;
}

window.alternarStatus = async (id, statusAtual) => {
    const novoStatus = statusAtual === 'ativo' ? 'inativo' : 'ativo';
    await updateDoc(doc(db, "sites", id), { status: novoStatus });
    carregarClientes(); // Recarrega a lista
};

carregarClientes();