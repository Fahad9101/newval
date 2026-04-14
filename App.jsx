import React, { useState, useRef } from "react"

/* ================================
   SAFE HELPERS
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

  if (f.length === 0) f.push("✅ Strong reasoning structure")

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
   APP
================================ */
export default function App() {
  const [resident, setResident] = useState("")
  const [selectedCase, setSelectedCase] = useState(cases[0])
  const [answer, setAnswer] = useState("")
  const [result, setResult] = useState(null)
  const [isListening, setIsListening] = useState(false)

  const recognitionRef = useRef(null)

  /* ================================
     BENCHMARK
  ================================= */
  function runBenchmark() {
    if (!answer || !selectedCase) return

    let score = 0
    selectedCase.must?.forEach((k) => {
      if (answer.toLowerCase().includes(k)) score += 25
    })

    if (score > 100) score = 100

    setResult({
      score,
      feedback: getFeedback(answer),
      wrong: detectWrongQuestion(answer)
    })
  }

  /* ================================
     RANDOM CASE
  ================================= */
  function randomCase() {
    const r = cases[Math.floor(Math.random() * cases.length)]
    setSelectedCase(r)
    setAnswer("")
    setResult(null)
  }

  /* ================================
     VOICE INPUT
  ================================= */
  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Voice not supported")
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let text = ""
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setAnswer(text)
    }

    recognition.onend = () => setIsListening(false)

    recognition.start()
  }

  function stopVoice() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  /* ================================
     UI
  ================================= */
  return (
    <div style={{ padding: 20, fontFamily: "Arial", background: "#f5f7fb", minHeight: "100vh" }}>

      <h1>CRFT Engine (Tier 4)</h1>

      {/* HEADER */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input
          placeholder="Resident Name"
          value={resident}
          onChange={(e) => setResident(e.target.value)}
        />

        <select onChange={(e) => setSelectedCase(cases[e.target.value])}>
          {cases.map((c, i) => (
            <option key={i} value={i}>
              {c.title} (L{c.difficulty})
            </option>
          ))}
        </select>

        <button onClick={runBenchmark}>Run Benchmark</button>
        <button onClick={randomCase}>Random Case</button>

        {!isListening ? (
          <button onClick={startVoice}>🎤 Voice</button>
        ) : (
          <button onClick={stopVoice}>⏹ Stop</button>
        )}
      </div>

      {/* LAYOUT */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 20
      }}>

        {/* LEFT: CASE */}
        <div style={{
          background: "white",
          padding: 15,
          borderRadius: 10,
          border: "1px solid #ddd"
        }}>
          <h3>Case</h3>

          <strong>{selectedCase.title}</strong>
          <div>Difficulty: {selectedCase.difficulty}</div>

          {selectedCase.isTrap && (
            <div style={{ color: "orange", marginTop: 10 }}>
              ⚠️ Trap: {selectedCase.trap}
            </div>
          )}

          <textarea
            rows={8}
            style={{ width: "100%", marginTop: 15 }}
            placeholder="Enter reasoning..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>

        {/* RIGHT: RESULTS */}
        <div style={{
          background: "white",
          padding: 15,
          borderRadius: 10,
          border: "1px solid #ddd"
        }}>
          <h3>Benchmark</h3>

          {!result && <div>Run benchmark to see results</div>}

          {result && (
            <>
              <h2>{result.score}/100</h2>

              {/* BAR */}
              <div style={{
                height: 12,
                background: "#ddd",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 10
              }}>
                <div style={{
                  width: `${result.score}%`,
                  height: "100%",
                  background:
                    result.score > 75 ? "green" :
                    result.score > 50 ? "orange" : "red"
                }} />
              </div>

              {/* WRONG */}
              {result.wrong && (
                <div style={{
                  color: "red",
                  fontWeight: "bold",
                  marginBottom: 10
                }}>
                  {result.wrong}
                </div>
              )}

              {/* FEEDBACK */}
              <div>
                {result.feedback.map((f, i) => (
                  <div key={i}>• {f}</div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{
        marginTop: 30,
        padding: 15,
        border: "1px dashed #aaa",
        borderRadius: 10,
        textAlign: "center"
      }}>
        QR (disabled) <br />
        https://your-app-url
      </div>

    </div>
  )
}
