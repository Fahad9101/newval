import React from "react"
import { useEffect, useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"

import {
  signInResident,
  signInEvaluator,
  logOut,
  watchAuth,
  createEvaluation,
  subscribeEvaluations,
} from "./firebase"

const domains = [
  { key: "problem", title: "Problem Framing", clue: "define the clinical question first." },
  { key: "syndrome", title: "Syndrome Identification", clue: "identify the syndrome or physiology before naming the disease." },
  { key: "differential", title: "Differential Diagnosis", clue: "structure the differential into common, dangerous, and treatable causes." },
  { key: "data", title: "Data Interpretation", clue: "use trends and context, not isolated values." },
  { key: "anticipation", title: "Anticipation", clue: "predict what will happen next and what to prevent." },
  { key: "reassessment", title: "Reassessment", clue: "re-evaluate the diagnosis and plan as new data appears." },
]

const initialForm = {
  resident: "",
  evaluator: "",
  rotation: "",
  caseName: "",
  scores: {
    problem: 0,
    syndrome: 0,
    differential: 0,
    data: 0,
    anticipation: 0,
    reassessment: 0,
  },
}

export default function App() {
  const [user, setUser] = useState(null)
  const [isEvaluator, setIsEvaluator] = useState(false)
  const [evaluations, setEvaluations] = useState([])
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    const unsub = watchAuth((u) => {
      setUser(u)
      setIsEvaluator(Boolean(u?.email))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!isEvaluator) return
    const unsub = subscribeEvaluations(setEvaluations)
    return () => unsub()
  }, [isEvaluator])

  const totalScore = useMemo(
    () => Object.values(form.scores).reduce((a, b) => a + b, 0),
    [form.scores]
  )

  const handleField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleScore = (field, value) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [field]: Number(value) },
    }))
  }

  const submit = async () => {
    if (!form.resident && !form.caseName && totalScore === 0) {
      alert("Enter at least a resident name, case, or some assessment.")
      return
    }
    try {
      await createEvaluation({
        ...form,
        totalScore,
        submittedBy: user?.email || "resident-anonymous",
      })
      alert("Saved.")
      setForm(initialForm)
    } catch (e) {
      console.error(e)
      alert("Save failed.")
    }
  }

  const reset = () => setForm(initialForm)

  if (!user) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>CRFT</h1>
        <p>Clinical Reasoning Feedback Tool</p>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
            <h3>Resident Access</h3>
            <p>Anonymous entry for residents.</p>
            <button onClick={async () => {
              try {
                await signInResident()
              } catch (e) {
                console.error(e)
                alert("Resident login failed.")
              }
            }}>
              Enter as Resident
            </button>
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
            <h3>Evaluator Access</h3>
            <p>Shared evaluator login.</p>
            <button onClick={async () => {
              const email = prompt("Evaluator email")
              const pass = prompt("Password")
              if (!email || !pass) return
              try {
                await signInEvaluator(email, pass)
              } catch (e) {
                console.error(e)
                alert("Evaluator login failed.")
              }
            }}>
              Login as Evaluator
            </button>
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: 12, padding: 16 }}>
            <h3>Scan to Open CRFT</h3>
            <p style={{ wordBreak: "break-all" }}>{window.location.href}</p>
            <QRCodeSVG value={window.location.href} size={140} />
          </div>
        </div>

        <div style={{ textAlign: "right", marginTop: 24, color: "green", fontSize: 12 }}>
          Developed for KFSHRC-J IM residents
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "Arial, sans-serif" }}>
      <h1>CRFT</h1>
      <p>Clinical Reasoning Feedback Tool</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={() => window.print()}>Print</button>
        <button onClick={submit}>Save Current Assessment</button>
        <button onClick={async () => await logOut()}>Logout</button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <input placeholder="Resident" value={form.resident} onChange={(e) => handleField("resident", e.target.value)} />
        <input placeholder="Evaluator" value={form.evaluator} onChange={(e) => handleField("evaluator", e.target.value)} />
        <input placeholder="Rotation" value={form.rotation} onChange={(e) => handleField("rotation", e.target.value)} />
        <input placeholder="Case" value={form.caseName} onChange={(e) => handleField("caseName", e.target.value)} />
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ccc", borderRadius: 10 }}>
        <strong>Total Score:</strong> {totalScore} / 24
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {domains.map((d) => (
          <div key={d.key} style={{ border: "1px solid #ccc", borderRadius: 12, padding: 12 }}>
            <h3>{d.title}</h3>
            <select value={form.scores[d.key]} onChange={(e) => handleScore(d.key, e.target.value)}>
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <div style={{ marginTop: 8, fontSize: 14 }}>
              <strong>Try to:</strong> {d.clue}
            </div>
          </div>
        ))}
      </div>

      {isEvaluator && (
        <div style={{ marginTop: 24 }}>
          <h2>Evaluator Dashboard</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {evaluations.map((e) => (
              <div key={e.id} style={{ border: "1px solid #ccc", borderRadius: 10, padding: 12 }}>
                <strong>{e.resident || "—"}</strong> — {e.caseName || "—"} — {e.totalScore || 0}/24
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ textAlign: "right", marginTop: 24, color: "green", fontSize: 12 }}>
        Developed for KFSHRC-J IM residents
      </div>
    </div>
  )
}
