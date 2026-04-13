import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
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
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export async function signInResident() {
  await signInAnonymously(auth)
}

export async function signInEvaluator(email, password) {
  await signInWithEmailAndPassword(auth, email, password)
}

export async function logOut() {
  await signOut(auth)
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function createEvaluation(record) {
  return addDoc(collection(db, 'evaluations'), {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateEvaluation(id, updates) {
  const ref = doc(db, 'evaluations', id)
  return updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  })
}

export async function removeEvaluation(id) {
  const ref = doc(db, 'evaluations', id)
  return deleteDoc(ref)
}

export function subscribeEvaluations(callback) {
  const q = query(collection(db, 'evaluations'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const rows = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }))
    callback(rows)
  })
}
