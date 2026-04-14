import React, { useState } from "react"

/* ================================
   SAFE QR (NO DEPENDENCY)
================================ */
function QRPlaceholder({ url }) {
  return (
    <div style={{
      padding: 20,
      border: "1px dashed #999",
      borderRadius: 10,
      textAlign: "center",
      marginTop: 30
    }}>
      <strong>QR (disabled)</strong>
      <div style={{ fontSize: 12 }}>{url}</div>
    </div>
  )
}

/* ================================
   CORE LOGIC
================================ */
function normalize(text = "") {
  return text.toLowerCase()
}

function detectWrongQuestion(answer) {
  const a = normalize(answer)

  if (/acs|pneumonia|pe/.test(a) && !/because|cause|why/.test(a)) {
    return "⚠️ Jumped to diagnosis without defining the clinical question"
  }

  return null
}

function getFeedback(answer) {
  const a = normalize(answer)
  const f = []

  if (!a.includes("because")) f.push("Add reasoning (because)")
  if (!a.includes("next")) f.push("Add anticipation")
  if (!a.includes("likely")) f.push("Add prioritization")

  if (f.length === 0) f.push("✅ Good structure")

  return f
}

/* ================================
   CASES
================================ */
const cases = [
  {
    title: "Breathless Night",
    difficulty: 2,
    isTrap: true,
    trap: "Troponin ≠ ACS automatically",
    must: ["heart failure", "pulmonary edema"]
  },
  {
    title: "Metabolic Alkalosis",
    difficulty: 4,
    isTrap: false,
    must: ["vomiting", "chloride", "volume"]
  },
  {
    title: "Delirium Overnight",
    difficulty: 3,
    isTrap: true,
    trap: "Agitation ≠ diagnosis",
    must: ["delirium", "cause", "reversible"]
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
    if (!answer || !selectedCase) return

    let score = 0

    selectedCase.must?.forEach((keyword) => {
      if (answer.toLowerCase().includes(keyword)) score += 20
    })

    if (score > 100) score = 100

    setResult({
      score,
      feedback: getFeedback(answer),
      wrong: detectWrongQuestion(answer)
    })
  }

  function randomCase() {
    const r = cases[Math.floor(Math.random() * cases.length)]
    setSelectedCase(r)
    setResult(null)
    setAnswer("")
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>

      <h1>CRFT Engine (Stable Tier 3)</h1>

      {/* HEADER */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          placeholder="Resident Name"
          value={resident}
          onChange={(e) => setResident(e.target.value)}
        />

        <select
          onChange={(e) => setSelectedCase(cases[e.target.value])}
        >
          <option>Select Case</option>
          {cases.map((c, i) => (
            <option key={i} value={i}>
              {c.title} (L{c.difficulty})
            </option>
          ))}
        </select>

        <button onClick={runBenchmark}>Run Benchmark</button>

        <button onClick={randomCase}>Random Case</button>
      </div>

      {/* CASE DISPLAY */}
      {selectedCase && (
        <div style={{
          padding: 15,
          border: "1px solid #ccc",
          borderRadius: 10,
          marginBottom: 20
        }}>
          <strong>{selectedCase.title}</strong>
          <div>Difficulty: {selectedCase.difficulty}</div>

          {selectedCase.isTrap && (
            <div style={{ color: "orange", marginTop: 5 }}>
              ⚠️ Trap: {selectedCase.trap}
            </div>
          )}
        </div>
      )}

      {/* ANSWER */}
      <textarea
        rows={6}
        style={{ width: "100%", padding: 10 }}
        placeholder="Enter reasoning..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
      />

      {/* RESULT */}
      {result && (
        <div style={{
          marginTop: 20,
          padding: 15,
          borderRadius: 10,
          background: "#f8fafc",
          border: "1px solid #ccc"
        }}>

          <h3>Score: {result.score}</h3>

          {/* BAR */}
          <div style={{
            height: 10,
            background: "#ddd",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 10
          }}>
            <div style={{
              width: `${result.score}%`,
              background:
                result.score > 75 ? "green" :
                result.score > 50 ? "orange" : "red",
              height: "100%"
            }} />
          </div>

          {/* WRONG QUESTION */}
          {result.wrong && (
            <div style={{ color: "red", fontWeight: "bold" }}>
              {result.wrong}
            </div>
          )}

          {/* FEEDBACK */}
          {result.feedback.map((f, i) => (
            <div key={i}>• {f}</div>
          ))}
        </div>
      )}

      {/* QR */}
      <QRPlaceholder url="https://your-app-url" />

    </div>
  )
}
