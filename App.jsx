// ⚠️ FULL FILE — TIER 1 + 2 + 3 + 4 MERGED

import React, { useState, useMemo, useEffect } from "react"

// =============================
// 🧠 CASE LIBRARY (SAMPLE)
// =============================
const cases = [
  {
    key: "hf",
    title: "Breathless Night",
    setting: "Inpatient",
    difficulty: 2,
    isTrap: true,
    trapMessage: "Troponin ≠ ACS automatically",
    vignette: "68M with acute dyspnea and orthopnea",
    mustHit: ["heart failure", "volume overload"],
    reasoningMap: ["cardiac cause", "orthopnea significance"],
  },
]

// =============================
// 🧠 HELPERS
// =============================
const normalize = (t = "") =>
  t.toLowerCase().replace(/[^\w\s]/g, "")

function detectWrongQuestion(a) {
  const text = normalize(a)
  if (/acs|pneumonia/.test(text) && !/why|cause|problem/.test(text))
    return "⚠️ Jumped to diagnosis without framing"
  return null
}

function detectBiases(a) {
  const text = normalize(a)
  const biases = []

  if (/definitely|clearly/.test(text))
    biases.push("⚠️ Possible premature closure")

  if (/first thought/.test(text))
    biases.push("⚠️ Anchoring bias")

  return biases
}

function reasoningLevel(score) {
  if (score > 80) return "Consultant Level"
  if (score > 60) return "Senior Level"
  if (score > 40) return "Developing"
  return "Unsafe Reasoning"
}

function benchmark(answer) {
  if (!answer) return null
  const score = Math.min(100, answer.length)
  return {
    totalScore: score,
    level: reasoningLevel(score),
  }
}

// =============================
// 🎤 VOICE (SIMPLIFIED)
// =============================
function useVoice(setText) {
  const [listening, setListening] = useState(false)

  const start = () => {
    const rec =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!rec) return

    const r = new rec()
    r.continuous = true

    r.onresult = (e) => {
      let text = ""
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
      }
      setText(text)
    }

    r.start()
    setListening(true)
  }

  return { listening, start }
}

// =============================
// 📊 RADAR (SIMPLE)
// =============================
function Radar({ score }) {
  return (
    <div style={{ padding: 10 }}>
      <strong>Trend Radar:</strong> {score}
    </div>
  )
}

// =============================
// 🧠 MAIN APP
// =============================
export default function App() {
  const [resident, setResident] = useState("")
  const [selectedCase, setSelectedCase] = useState(null)
  const [answer, setAnswer] = useState("")
  const [result, setResult] = useState(null)
  const [faculty, setFaculty] = useState(false)
  const [reflection, setReflection] = useState("")
  const [teachingMode, setTeachingMode] = useState(false)
  const [timeline, setTimeline] = useState([])

  const voice = useVoice(setAnswer)

  const runBenchmark = () => {
    const r = benchmark(answer)
    setResult(r)

    // Save for trend
    setTimeline((prev) => [...prev, r.totalScore])
  }

  const wrong = detectWrongQuestion(answer)
  const biases = detectBiases(answer)

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>CRFT Engine (Tier 4)</h1>

      {/* Resident */}
      <input
        placeholder="Resident Name"
        value={resident}
        onChange={(e) => setResident(e.target.value)}
      />

      {/* Case */}
      <select
        onChange={(e) =>
          setSelectedCase(cases.find((c) => c.key === e.target.value))
        }
      >
        <option>Select Case</option>
        {cases.map((c) => (
          <option key={c.key} value={c.key}>
            {c.title}
          </option>
        ))}
      </select>

      {/* Teaching Mode */}
      <button onClick={() => setTeachingMode(!teachingMode)}>
        Teaching Mode: {teachingMode ? "ON" : "OFF"}
      </button>

      {/* Answer */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={
          teachingMode
            ? "Explain WHY + WHAT NEXT + PRIORITY"
            : "Enter reasoning"
        }
      />

      {/* Voice */}
      <button onClick={voice.start}>
        🎤 Voice Input {voice.listening && "(Listening...)"}
      </button>

      {/* Benchmark */}
      <button onClick={runBenchmark}>Run Benchmark</button>

      {/* RESULT */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>Score: {result.totalScore}</h3>
          <h3>{result.level}</h3>

          {/* WRONG QUESTION */}
          {wrong && <div style={{ color: "red" }}>{wrong}</div>}

          {/* BIASES */}
          {biases.map((b, i) => (
            <div key={i} style={{ color: "orange" }}>
              {b}
            </div>
          ))}

          {/* REFLECTION */}
          {!faculty && (
            <div>
              <textarea
                placeholder="What would you change?"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
              <button onClick={() => setFaculty(true)}>
                Reveal Faculty
              </button>
            </div>
          )}

          {/* FACULTY */}
          {faculty && (
            <div>
              <h4>Faculty Answer</h4>
              {selectedCase?.mustHit.map((m, i) => (
                <div key={i}>• {m}</div>
              ))}
            </div>
          )}

          {/* TREND RADAR */}
          <Radar score={timeline[timeline.length - 1]} />

          {/* WHAT CHANGED */}
          <div>
            <h4>What Changed Since Yesterday?</h4>
            <textarea placeholder="Resident must answer this" />
          </div>
        </div>
      )}
    </div>
  )
}
