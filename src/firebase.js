// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB_oo4HZ2Q2H56GOPj6K-jX5tBz5L7EqYA",
  authDomain: "clases-c74fb.firebaseapp.com",
  projectId: "clases-c74fb",
  storageBucket: "clases-c74fb.firebasestorage.app",
  messagingSenderId: "47453211575",
  appId: "1:47453211575:web:fb4583fd9cd9fdb3347632",
  measurementId: "G-HR5MWG3G2Q"
};

// Инициализация приложения Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Установка постоянства авторизации до каких-либо операций входа
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Persistence успешно установлена (browserLocalPersistence)");
  })
  .catch((error) => {
    console.error("Ошибка установки persistence:", error);
  });

const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider, signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword };
