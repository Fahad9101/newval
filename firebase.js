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
  appId: "1:337127729938:web:4e44fa6a5050c3d5ace1cb",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

function sanitizeText(value, max = 5000) {
  if (value === null || value === undefined) return ""
  return String(value).trim().slice(0, max)
}

function sanitizeScores(scores = {}) {
  const safe = {
    problemFraming: 0,
    syndromeIdentification: 0,
    differentialDiagnosis: 0,
    dataInterpretation: 0,
    anticipation: 0,
    reassessment: 0,
  }

  for (const key of Object.keys(safe)) {
    const n = Number(scores?.[key] ?? 0)
    safe[key] = Number.isFinite(n) ? Math.min(4, Math.max(0, n)) : 0
  }

  return safe
}

function sanitizeWhatChanged(whatChanged = {}) {
  return {
    clinicalStatus: sanitizeText(whatChanged?.clinicalStatus, 2000),
    overnightEvents: sanitizeText(whatChanged?.overnightEvents, 2000),
    vitalsTrend: sanitizeText(whatChanged?.vitalsTrend, 2000),
    labsTrend: sanitizeText(whatChanged?.labsTrend, 2000),
    imagingProcedures: sanitizeText(whatChanged?.imagingProcedures, 2000),
    consultantChanges: sanitizeText(whatChanged?.consultantChanges, 2000),
    dischargeBarriers: sanitizeText(whatChanged?.dischargeBarriers, 2000),
    stillOnEDD: ["yes", "no", "unknown"].includes(whatChanged?.stillOnEDD)
      ? whatChanged.stillOnEDD
      : "unknown",
  }
}

function buildSafePayload(data = {}) {
  const scores = sanitizeScores(data.scores)
  const total =
    typeof data.total === "number"
      ? data.total
      : Object.values(scores).reduce((sum, value) => sum + value, 0)

  const user = auth.currentUser

  return {
    resident: sanitizeText(data.resident, 200),
    evaluator: sanitizeText(data.evaluator, 200),
    rotation: sanitizeText(data.rotation, 200),
    caseName: sanitizeText(data.caseName, 300),

    scores,
    total: Math.min(24, Math.max(0, Number(total) || 0)),

    globalRating: sanitizeText(data.globalRating, 100),
    oneLineSummary: sanitizeText(data.oneLineSummary, 2000),
    consultantReport: sanitizeText(data.consultantReport, 12000),

    residentEmail: sanitizeText(data.residentEmail, 300),
    submittedBy: sanitizeText(data.submittedBy || user?.email || "anonymous", 300),
    submittedByRole: sanitizeText(
      data.submittedByRole || (user?.isAnonymous ? "resident" : "evaluator"),
      50
    ),
    submittedByUid: user?.uid || "",

    universalCaseKey: sanitizeText(data.universalCaseKey, 120),
    universalCaseTitle: sanitizeText(data.universalCaseTitle, 300),
    universalCaseSetting: sanitizeText(data.universalCaseSetting, 100),

    traineeAnswer: sanitizeText(data.traineeAnswer, 12000),
    structuredReasoning: sanitizeText(data.structuredReasoning, 12000),

    benchmarkResult: data.benchmarkResult ?? null,
    overrideReflection: sanitizeText(data.overrideReflection, 4000),
    overrideCompleted: Boolean(data.overrideCompleted),

    whatChanged: sanitizeWhatChanged(data.whatChanged),
    whatChangedSummary: sanitizeText(data.whatChangedSummary, 4000),

    deleted: Boolean(data.deleted),
  }
}

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
  const payload = buildSafePayload(data)

  return addDoc(collection(db, "evaluations"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateEvaluation(id, updates) {
  if (!id) throw new Error("Missing evaluation id")

  const payload = buildSafePayload(updates)

  return updateDoc(doc(db, "evaluations", id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function removeEvaluation(id) {
  if (!id) throw new Error("Missing evaluation id")
  return deleteDoc(doc(db, "evaluations", id))
}

export function subscribeEvaluations(callback) {
  const q = query(collection(db, "evaluations"), orderBy("createdAt", "desc"))

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      callback(data)
    },
    (error) => {
      console.error("subscribeEvaluations error:", error)
      callback([])
    }
  )
}
