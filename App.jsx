import React, { useState } from "react"

/* ================================
   SAFE FALLBACK QR (NO LIB)
================================ */
function QRPlaceholder({ url }) {
  return (
    <div style={{
      padding: 20,
      border: "1px dashed #999",
      borderRadius: 10,
      textAlign: "center"
    }}>
      <div style={{ fontWeight: "bold" }}>QR (disabled)</div>
      <div style={{ fontSize: 12 }}>{url}</div>
    </div>
  )
}

/* ================================
   SIMPLE SAFE FUNCTIONS
================================ */
function safeNormalize(text = "") {
  return text.toLowerCase()
}

function detectWrongQuestion(answer) {
  const a = safeNormalize(answer)

  if (/acs|pneumonia|pe/.test(a) && !/because|why|cause/.test(a)) {
    return "⚠️ Jumped to diagnosis without defining the question"
  }
  return null
}

function getFeedback(answer) {
  const a = safeNormalize(answer)
  const out = []

  if (!a.includes("because")) out.push("Add reasoning (because)")
  if (!a.includes("next")) out.push("Add anticipation")
  if (!a.includes("likely")) out.push("Add prioritization")

  if (out.length === 0) out.push("✅ Good structure")

  return out
}

/* ================================
   CASES (SAFE)
================================ */
const cases = [
  {
    title: "Breathless Night",
    difficulty: 2,
    isTrap: true,
    trap: "Troponin ≠ ACS automatically"
  },
  {
    title: "Electrolyte Collapse",
    difficulty: 4,
    isTrap: false
  }
]

/* ================================
   MAIN APP
================================ */
export default function App() {
  const [resident, setResident] = useState("")
  const [selectedCase, setSelectedCase] = useState(null)
  const [answer, setAnswer] = useState("")
  const [result, setResult] = useState(null)

  function runBenchmark() {
    if (!answer) return

    setResult({
      score: Math.floor(Math.random() * 40) + 60,
      feedback: getFeedback(answer),
      wrong: detectWrongQuestion(answer)
    })
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      
      <h1>CRFT Engine (Stable)</h1>

      {/* HEADER */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Resident Name"
          value={resident}
          onChange={(e) => setResident(e.target.value)}
        />

        <select onChange={(e) => setSelectedCase(cases[e.target.value])}>
          <option>Select Case</option>
          {cases.map((c, i) => (
            <option key={i} value={i}>{c.title}</option>
          ))}
        </select>

        <button onClick={runBenchmark}>Run Benchmark</button>
      </div>

      {/* CASE */}
      {selectedCase && (
        <div style={{
          padding: 10,
          border: "1px solid #ccc",
          marginBottom: 20
        }}>
          <strong>{selectedCase.title}</strong>
          <div>Difficulty: {selectedCase.difficulty}</div>

          {selectedCase.isTrap && (
            <div style={{ color: "orange" }}>
              ⚠️ Trap: {selectedCase.trap}
            </div>
          )}
        </div>
      )}

      {/* ANSWER */}
      <textarea
        rows={5}
        style={{ width: "100%" }}
        placeholder="Enter reasoning..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />

      {/* RESULT */}
      {result && (
        <div style={{
          marginTop: 20,
          padding: 10,
          border: "1px solid #ccc"
        }}>
          <strong>Score: {result.score}</strong>

          {result.wrong && (
            <div style={{ color: "red" }}>{result.wrong}</div>
          )}

          <div>
            {result.feedback.map((f, i) => (
              <div key={i}>• {f}</div>
            ))}
          </div>
        </div>
      )}

      {/* QR */}
      <div style={{ marginTop: 30 }}>
        <QRPlaceholder url="https://your-app-url" />
      </div>
    </div>
  )
}
