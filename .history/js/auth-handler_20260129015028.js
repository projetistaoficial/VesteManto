import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Alternar entre telas
window.toggleAuth = () => {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const title = document.getElementById('auth-title');

    if (loginForm.style.display === 'none') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        title.innerText = "Entrar no Painel";
    } else {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        title.innerText = "Cadastrar Nova Loja";
    }
};

// Lógica de CADASTRO
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nomeLoja = document.getElementById('reg-nome-loja').value;
    const siteId = document.getElementById('reg-id-loja').value.toLowerCase().trim();
    const email = document.getElementById('reg-email').value;
    const senha = document.getElementById('reg-senha').value;

    try {
        // 1. Criar usuário no Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        const uid = userCredential.user.uid;

        // 2. Criar o documento da Loja
        await setDoc(doc(db, "sites", siteId), {
            nome: nomeLoja,
            owner: uid,
            criadoEm: new Date()
        });

        // 3. Vincular usuário ao siteId (Para o login saber onde ir)
        await setDoc(doc(db, "users", uid), {
            email: email,
            siteId: siteId,
            isAdmin: true
        });

        alert("Loja criada com sucesso! Redirecionando...");
        window.location.href = "admin.html";

    } catch (error) {
        alert("Erro ao cadastrar: " + error.message);
    }
});

// Lógica de LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;

    try {
        await signInWithEmailAndPassword(auth, email, senha);
        window.location.href = "admin.html"; // O admin.js que fizemos antes cuidará do resto
    } catch (error) {
        alert("Erro ao acessar: " + error.message);
    }
});