import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, setDoc, getDoc, runTransaction, limit, getAggregateFromServer, sum, count, writeBatch, getDocFromServer } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_pZ7lWPQA1OniOJrjTinG2HN5UhjMzbI",
  authDomain: "vestemanto-app.firebaseapp.com",
  projectId: "vestemanto-app",
  storageBucket: "vestemanto-app.appspot.com",
  messagingSenderId: "340174016008",
  appId: "1:340174016008:web:301a01750404af8b5a8bbd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Helper para compatibilidade
const getDocsCheck = getDocs;

export { 
    db, auth, storage, 
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, setDoc, getDoc, 
    signInWithEmailAndPassword, onAuthStateChanged, signOut, 
    ref, uploadBytes, getDownloadURL, 
    getDocsCheck, runTransaction, limit, getAggregateFromServer, sum, count, writeBatch, getDocFromServer
};