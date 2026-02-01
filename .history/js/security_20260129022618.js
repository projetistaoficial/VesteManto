// js/security.js
import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function verificarStatusLoja(siteId) {
    if (!siteId) return false;

    const siteRef = doc(db, "sites", siteId);
    const siteSnap = await getDoc(siteRef);

    if (siteSnap.exists()) {
        const dados = siteSnap.data();
        if (dados.status !== 'ativo') {
            exibirTelaBloqueio(dados.mensagemSuspensao || "O acesso a este sistema está suspenso.");
            return false;
        }
        return true; 
    }
    return false;
}

function exibirTelaBloqueio(mensagem) {
    const overlay = document.createElement('div');
    overlay.id = "bloqueio-saas";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:black; z-index:99999; display:flex; align-items:center; justify-content:center; color:white; text-align:center; font-family:sans-serif;";
    overlay.innerHTML = `
        <div>
            <h1 style="font-size:30px; color:#facc15;">SISTEMA SUSPENSO</h1>
            <p style="margin:20px 0; color:#ccc;">${mensagem}</p>
            <a href="https://wa.me/SEU_NUMERO" style="background:#25d366; padding:10px 20px; border-radius:5px; color:white; text-decoration:none;">Falar com Financeiro</a>
        </div>
    `;
    document.body.appendChild(overlay);
    window.stop(); // Interrompe o resto do site
}