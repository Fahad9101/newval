import { initializeApp } from "firebase/app"
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyBz00_ifpMM2tbRBILZVU-cEvfiBqTCRMI",
  authDomain: "crft-c9f31.firebaseapp.com",
  projectId: "crft-c9f31",
  storageBucket: "crft-c9f31.firebasestorage.app",
  messagingSenderId: "337127729938",
  appId: "1:337127729938:web:4e44fa6a5050c3d5ace1cb"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export async function signInResident() {
  return signInAnonymously(auth)
}

export async function signInEvaluator(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function logOut() {
  return signOut(auth)
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function createEvaluation(data) {
  return addDoc(collection(db, "evaluations"), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateEvaluation(id, updates) {
  return updateDoc(doc(db, "evaluations", id), {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function removeEvaluation(id) {
  return deleteDoc(doc(db, "evaluations", id))
}

export function subscribeEvaluations(callback) {
  const q = query(collection(db, "evaluations"), orderBy("createdAt", "desc"))
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    callback(data)
  })
}
