import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDocs, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAdWryN3X9Q_iYqQTQO4o8JXyzVwJ5TcOE",
    authDomain: "text-chunker.firebaseapp.com",
    projectId: "text-chunker",
    storageBucket: "text-chunker.firebasestorage.app",
    messagingSenderId: "101081926353",
    appId: "1:101081926353:web:8f1144390fa8859d4413f0"
};

// Initialize
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, collection, doc, setDoc, getDocs, query, where, deleteDoc };
