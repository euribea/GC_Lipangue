// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, onSnapshot
} from "firebase/firestore";

// 🔧 Copia tu config de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCTuI-skrBl3Dkd5MAiFg6R4FnseULr_No",
  authDomain: "gc-lipangue.firebaseapp.com",
  projectId: "gc-lipangue",
  storageBucket: "gc-lipangue.firebasestorage.app",
  messagingSenderId: "74361960006",
  appId: "1:74361960006:web:0fbe13a6d5bfd54b8a7c47",
  measurementId: "G-Y9XM0B1XE6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const onUser = (cb) => onAuthStateChanged(auth, cb);
export const login = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);

export const db = getFirestore(app);

/* ========== API mínima ========== */
// Ingresos
export const ingresosCol = collection(db, "ingresos");
export async function addIngreso(data) {
  const payload = { ...data, createdAt: serverTimestamp() };
  await addDoc(ingresosCol, payload);
}
export async function listIngresosOnce() {
  const q = query(ingresosCol, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function watchIngresos(cb) {
  const q = query(ingresosCol, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function updateIngreso(id, patch) {
  await updateDoc(doc(db, "ingresos", id), patch);
}
export async function deleteIngreso(id) {
  await deleteDoc(doc(db, "ingresos", id));
}

// Egresos
export const egresosCol = collection(db, "egresos");
export async function addEgreso(data) {
  const payload = { ...data, createdAt: serverTimestamp() };
  await addDoc(egresosCol, payload);
}
export async function listEgresosOnce() {
  const q = query(egresosCol, orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function watchEgresos(cb) {
  const q = query(egresosCol, orderBy("fecha", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function updateEgreso(id, patch) {
  await updateDoc(doc(db, "egresos", id), patch);
}
export async function deleteEgreso(id) {
  await deleteDoc(doc(db, "egresos", id));
}
