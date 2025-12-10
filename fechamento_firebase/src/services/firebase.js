import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set, get, push, update, remove, onValue, query as rtdbQuery, orderByChild, equalTo } from "firebase/database";
import { getFirestore, collection, onSnapshot, query, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAa9BIS-1n0Z2dkzR4eaaOnhxHqCSvVLbM",
  authDomain: "sistema-contabil-fchemanto.firebaseapp.com",
  databaseURL: "https://sistema-contabil-fchemanto-default-rtdb.firebaseio.com",
  projectId: "sistema-contabil-fchemanto",
  storageBucket: "sistema-contabil-fchemanto.firebasestorage.app",
  messagingSenderId: "256401476370",
  appId: "1:256401476370:web:5546726ce18657673d41cb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app); // Alterado para Firestore
export const rtdb = getDatabase(app); // Mantendo o Realtime DB para outras funções se necessário

const createGoogleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
  return provider;
};

// Auth functions
export const loginWithGoogle = () => signInWithRedirect(auth, createGoogleProvider());
export const logout = () => signOut(auth);
export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

// Firestore functions
export const getEtapas = (empresaId, callback) => {
  const etapasCollectionRef = collection(db, 'empresas', empresaId, 'etapas');
  const q = query(etapasCollectionRef, orderBy('ordem')); // Supondo que você queira ordenar as etapas por um campo 'ordem'

  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const etapasData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(etapasData);
  });

  return unsubscribe; // Retorna a função para parar de ouvir as atualizações
};


// Realtime Database helper functions
export const dbRef = (path) => ref(rtdb, path);
export const dbSet = (path, data) => set(ref(rtdb, path), data);
export const dbGet = async (path) => {
  const snapshot = await get(ref(rtdb, path));
  return snapshot.exists() ? snapshot.val() : null;
};
export const dbPush = (path, data) => push(ref(rtdb, path), data);
export const dbUpdate = (path, data) => update(ref(rtdb, path), data);
export const dbRemove = (path) => remove(ref(rtdb, path));
export const dbOnValue = (path, callback) => onValue(ref(rtdb, path), (snapshot) => {
  callback(snapshot.exists() ? snapshot.val() : null);
});

export { ref, set, get, push, update, remove, onValue, rtdbQuery as query, orderByChild, equalTo };
