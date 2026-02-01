import { db, auth } from './firebase-config.js';
import { doc, setDoc, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

async function criarNovaLoja(email, senha, nomeLoja, subdominio) {
    try {
        // 1. Cria o usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const uid = userCredential.user.uid;

        // 2. Cria o ID único da loja (siteId)
        // Usamos o subdominio escolhido (ex: 'pizzaria-do-joao')
        const siteId = subdominio.toLowerCase().replace(/\s+/g, '-');

        // 3. Documento de Configuração da Loja
        await setDoc(doc(db, "sites", siteId), {
            ownerUid: uid,
            storeName: nomeLoja,
            createdAt: new Date(),
            active: true,
            plan: 'premium',
            settings: {
                theme: 'dark',
                currency: 'BRL',
                deliveryTax: 0
            }
        });

        // 4. Vínculo do Usuário com a Loja
        // Isso permite que quando o usuário logar, o sistema saiba qual loja ele administra
        await setDoc(doc(db, "users", uid), {
            email: email,
            siteId: siteId,
            role: 'admin'
        });

        console.log(`Sucesso! Loja ${nomeLoja} criada com ID: ${siteId}`);
        alert("Loja criada com sucesso!");

    } catch (error) {
        console.error("Erro ao criar loja:", error);
        alert("Erro: " + error.message);
    }
}