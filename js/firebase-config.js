import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// SUBSTITUA PELAS SUAS CHAVES DO FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "AIzaSyD_pZ7lWPQA1OniOJrjTinG2HN5UhjMzbI",
  authDomain: "vestemanto-app.firebaseapp.com",
  projectId: "vestemanto-app",
  storageBucket: "vestemanto-app.appspot.com",
  messagingSenderId: "340174016008",
  appId: "1:340174016008:web:301a01750404af8b5a8bbd"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, setDoc, signInWithEmailAndPassword, onAuthStateChanged, signOut, ref, uploadBytes, getDownloadURL };