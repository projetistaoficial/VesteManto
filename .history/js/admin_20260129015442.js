import { auth, db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Proteger a página: Só entra se estiver logado
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'acesso.html'; // Se não logou, volta pro login
        return;
    }

    // 2. Descobrir qual é a loja deste admin
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
        const siteId = userDoc.data().siteId;
        document.getElementById('store-name').innerText = `| Loja: ${siteId}`;
        
        // 3. Iniciar a escuta de pedidos em tempo real
        listenToOrders(siteId);
    }
});

// Função para ouvir pedidos no Firestore (específicos deste siteId)
function listenToOrders(siteId) {
    const q = query(collection(db, "orders"), where("siteId", "==", siteId));
    
    onSnapshot(q, (snapshot) => {
        const orders = [];
        snapshot.forEach(doc => orders.push({id: doc.id, ...doc.data()}));
        
        // Aqui você usaria aquela função filterAndRenderSales que corrigimos antes!
        // Ela vai desenhar os pedidos na tela.
        renderOrders(orders); 
    });
}

function renderOrders(orders) {
    const container = document.getElementById('orders-list');
    container.innerHTML = orders.length === 0 ? '<p class="text-gray-500">Nenhum pedido ainda.</p>' : '';
    
    orders.forEach(order => {
        // Usa a lógica de "createOrderCard" que fizemos na primeira conversa
        container.innerHTML += `
            <li class="bg-gray-900 p-4 rounded-lg border border-gray-800 flex justify-between items-center">
                <div>
                    <p class="font-bold text-yellow-500">#${order.id.slice(0,5)}</p>
                    <p class="text-xs text-gray-400">${order.customerName || 'Cliente'}</p>
                </div>
                <div class="text-right">
                    <p class="font-bold">R$ ${order.total}</p>
                    <p class="text-[10px] uppercase text-green-500">${order.status}</p>
                </div>
            </li>
        `;
    });
}