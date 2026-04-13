import { useEffect, useState } from "react"
import QRCode from "qrcode.react"

import {
  auth,
  signInResident,
  signInEvaluator,
  logOut,
  watchAuth,
  createEvaluation,
  subscribeEvaluations,
} from "./firebase"

export default function App() {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [evaluations, setEvaluations] = useState([])

  const [form, setForm] = useState({
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
  })

  useEffect(() => {
    const unsub = watchAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (role === "evaluator") {
      const unsub = subscribeEvaluations(setEvaluations)
      return () => unsub()
    }
  }, [role])

  const totalScore = Object.values(form.scores).reduce((a, b) => a + b, 0)

  const handleChange = (field, value) => {
    setForm({ ...form, [field]: value })
  }

  const handleScore = (field, value) => {
    setForm({
      ...form,
      scores: { ...form.scores, [field]: Number(value) },
    })
  }

  const submit = async () => {
    await createEvaluation(form)
    alert("Saved!")
  }

  const reset = () => {
    setForm({
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
    })
  }

  if (!user) {
    return (
      <div style={{ padding: 40 }}>
        <h1>CRFT</h1>
        <h3>Clinical Reasoning Feedback Tool</h3>

        <button onClick={async () => {
          await signInResident()
          setRole("resident")
        }}>
          Enter as Resident
        </button>

        <br /><br />

        <button onClick={async () => {
          const email = prompt("Evaluator email")
          const pass = prompt("Password")
          await signInEvaluator(email, pass)
          setRole("evaluator")
        }}>
          Evaluator Login
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>CRFT</h1>

      <button onClick={reset}>Reset</button>
      <button onClick={() => window.print()}>Print</button>
      <button onClick={logOut}>Logout</button>

      <hr />

      <input placeholder="Resident" value={form.resident}
        onChange={(e) => handleChange("resident", e.target.value)} />

      <input placeholder="Evaluator" value={form.evaluator}
        onChange={(e) => handleChange("evaluator", e.target.value)} />

      <input placeholder="Rotation" value={form.rotation}
        onChange={(e) => handleChange("rotation", e.target.value)} />

      <input placeholder="Case" value={form.caseName}
        onChange={(e) => handleChange("caseName", e.target.value)} />

      <h3>Total: {totalScore} / 24</h3>

      {["problem","syndrome","differential","data","anticipation","reassessment"].map((k) => (
        <div key={k}>
          <h4>{k}</h4>
          <select value={form.scores[k]} onChange={(e) => handleScore(k, e.target.value)}>
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </div>
      ))}

      <br />

      <button onClick={submit}>Save Current Assessment</button>

      <hr />

      <h3>QR</h3>
      <QRCode value={window.location.href} />

      {role === "evaluator" && (
        <>
          <hr />
          <h2>All Evaluations</h2>

          {evaluations.map((e) => (
            <div key={e.id} style={{ border: "1px solid #ccc", margin: 10, padding: 10 }}>
              <b>{e.resident}</b> — {e.caseName}
            </div>
          ))}
        </>
      )}

      <div style={{ textAlign: "right", marginTop: 50, color: "green" }}>
        Developed for KFSHRC-J IM residents
      </div>
    </div>
  )
}
