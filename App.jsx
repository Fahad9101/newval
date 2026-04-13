import React, { useEffect, useMemo, useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  signInResident,
  signInEvaluator,
  logOut,
  watchAuth,
  createEvaluation,
  subscribeEvaluations,
  updateEvaluation,
  removeEvaluation,
} from "./firebase"

const appUrl = "https://fahad9101.github.io/CRFT/"

const domains = [
  {
    key: "problemFraming",
    title: "Problem Framing",
    levels: {
      0: "Not assessed",
      1: "Incorrect or vague question",
      2: "Symptom description only",
      3: "Correct clinical question",
      4: "Reframes independently when stuck",
    },
    clue: "define the actual clinical question first. Move from symptoms to the real decision problem that must be solved.",
  },
  {
    key: "syndromeIdentification",
    title: "Syndrome Identification",
    levels: {
      0: "Not assessed",
      1: "Jumps to diagnosis",
      2: "Partial physiology",
      3: "Correct syndrome identified",
      4: "Integrates multi-system physiology",
    },
    clue: "name the syndrome or physiology before naming the disease. Clarify what pattern the patient fits.",
  },
  {
    key: "differentialDiagnosis",
    title: "Differential Diagnosis",
    levels: {
      0: "Not assessed",
      1: "Narrow or premature",
      2: "Broad but unfocused",
      3: "Structured and prioritized",
      4: "Includes dangerous and subtle causes",
    },
    clue: "organize the differential into common, dangerous, and treatable causes, then prioritize rather than listing randomly.",
  },
  {
    key: "dataInterpretation",
    title: "Data Interpretation",
    levels: {
      0: "Not assessed",
      1: "Reads numbers only",
      2: "Basic interpretation",
      3: "Uses trends appropriately",
      4: "Tests hypotheses with data",
    },
    clue: "use trends, context, and timing. Data should confirm or challenge the working diagnosis, not just be repeated.",
  },
  {
    key: "anticipation",
    title: "Anticipation",
    levels: {
      0: "Not assessed",
      1: "Reactive only",
      2: "Limited prediction",
      3: "Predicts next steps",
      4: "Prevents complications proactively",
    },
    clue: "state what is likely to happen next and what risks should be prevented over the next 12–24 hours.",
  },
  {
    key: "reassessment",
    title: "Reassessment",
    levels: {
      0: "Not assessed",
      1: "Static thinking",
      2: "Adjusts only when told",
      3: "Self-corrects",
      4: "Continuously updates model",
    },
    clue: "revisit the diagnosis and plan as new information arrives. Show active updating rather than fixed thinking.",
  },
]

const initialScores = {
  problemFraming: 0,
  syndromeIdentification: 0,
  differentialDiagnosis: 0,
  dataInterpretation: 0,
  anticipation: 0,
  reassessment: 0,
}

const initialForm = {
  resident: "",
  evaluator: "",
  rotation: "",
  caseName: "",
  scores: initialScores,
}

function getGlobalRating(total) {
  if (total === 0) return ""
  if (total <= 9) return "Junior"
  if (total <= 15) return "Intermediate"
  if (total <= 20) return "Senior"
  return "Near Consultant"
}

function getAutoStrengths(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []

  const strengths = []
  if (scores.problemFraming >= 3) strengths.push("The clinical question is being framed with useful structure and direction.")
  if (scores.syndromeIdentification >= 3) strengths.push("The resident identifies the syndrome or physiology appropriately before anchoring too early.")
  if (scores.differentialDiagnosis >= 3) strengths.push("The differential is reasonably organized and prioritized.")
  if (scores.dataInterpretation >= 3) strengths.push("Clinical data is interpreted with attention to pattern and trend rather than isolated values only.")
  if (scores.anticipation >= 3) strengths.push("The resident shows forward thinking by anticipating clinical trajectory and next steps.")
  if (scores.reassessment >= 3) strengths.push("The resident demonstrates willingness to revise the working model as new data emerges.")
  return strengths
}

function getPriorityRecommendations(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []

  const candidates = [
    {
      score: scores.problemFraming,
      text: "Before discussing causes, first state the exact clinical question being answered in this case.",
    },
    {
      score: scores.syndromeIdentification,
      text: "Pause before naming a disease and identify the syndrome or physiology first.",
    },
    {
      score: scores.differentialDiagnosis,
      text: "Restructure the differential into common, dangerous, and treatable causes, then rank them.",
    },
    {
      score: scores.dataInterpretation,
      text: "Interpret data using trends, timing, and clinical context rather than repeating individual values.",
    },
    {
      score: scores.anticipation,
      text: "Add a prediction step: what may happen next, and what complication must be prevented?",
    },
    {
      score: scores.reassessment,
      text: "Reassess the diagnosis and plan explicitly when new information appears.",
    },
  ]

  return candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((item) => item.text)
}

function getOneLineSummary(scores, total, globalRating) {
  if (total === 0) return ""

  const strong = Object.entries(scores)
    .filter(([, value]) => value >= 3)
    .map(([key]) => domains.find((d) => d.key === key)?.title)
    .filter(Boolean)

  const weak = Object.entries(scores)
    .filter(([, value]) => value > 0 && value <= 2)
    .map(([key]) => domains.find((d) => d.key === key)?.title)
    .filter(Boolean)

  const strongText = strong.length ? strong.slice(0, 2).join(" and ").toLowerCase() : "selected domains"
  const weakText = weak.length ? weak.slice(0, 2).join(" and ").toLowerCase() : "higher-order reasoning"

  return `This represents a ${globalRating.toLowerCase()} pattern with strength in ${strongText} and need for improvement in ${weakText}.`
}

function getConsultantReport({ resident, evaluator, rotation, caseName, scores, total, globalRating, priorities }) {
  if (total === 0) return ""

  const strongDomains = Object.entries(scores)
    .filter(([, value]) => value >= 3)
    .map(([key]) => domains.find((d) => d.key === key)?.title.toLowerCase())
    .filter(Boolean)

  const weakDomains = Object.entries(scores)
    .filter(([, value]) => value > 0 && value <= 2)
    .map(([key]) => domains.find((d) => d.key === key)?.title.toLowerCase())
    .filter(Boolean)

  const contextBits = [
    resident ? `Resident: ${resident}` : null,
    evaluator ? `Evaluator: ${evaluator}` : null,
    rotation ? `Rotation: ${rotation}` : null,
    caseName ? `Case: ${caseName}` : null,
  ].filter(Boolean)

  const intro = contextBits.length ? `${contextBits.join(" · ")}.` : ""

  const para1 = `This CRFT assessment places the learner in the ${globalRating} range with a total score of ${total}/24. ${
    strongDomains.length
      ? `Relative strengths were observed in ${strongDomains.slice(0, 3).join(", ")}.`
      : "No clear strength domains were established in this assessment."
  }`

  const para2 = `${
    weakDomains.length
      ? `The main areas for improvement were ${weakDomains.slice(0, 3).join(", ")}.`
      : "No major deficit domains were identified among the assessed categories."
  } ${priorities.length ? `The most useful next steps are: ${priorities.join(" ")}` : ""}`

  const para3 =
    "In practical terms, feedback should focus on strengthening structure, prioritization, anticipation, and consistency of clinical reasoning."

  return [intro, para1, para2, para3].filter(Boolean).join("\n\n")
}

function exportToCSV(data) {
  if (!data.length) return

  const headers = [
    "Resident",
    "Evaluator",
    "Rotation",
    "Case",
    "Total",
    "Global Rating",
    "Submitted By",
    "Role",
    "Date",
  ]

  const rows = data.map((e) => [
    `"${e.resident || ""}"`,
    `"${e.evaluator || ""}"`,
    `"${e.rotation || ""}"`,
    `"${e.caseName || ""}"`,
    `"${e.total || e.totalScore || 0}"`,
    `"${e.globalRating || ""}"`,
    `"${e.submittedBy || ""}"`,
    `"${e.submittedByRole || ""}"`,
    `"${formatFirebaseDate(e.createdAt)}"`,
  ])

  const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = "crft_evaluations.csv"
  link.click()
  URL.revokeObjectURL(url)
}

function formatFirebaseDate(ts) {
  if (!ts) return ""
  if (typeof ts?.seconds === "number") {
    return new Date(ts.seconds * 1000).toLocaleString()
  }
  return ""
}

function getComparison(firstEval, latestEval) {
  if (!firstEval || !latestEval) return []
  return domains.map((d) => {
    const first = Number(firstEval.scores?.[d.key] || 0)
    const latest = Number(latestEval.scores?.[d.key] || 0)
    const diff = latest - first
    return {
      key: d.key,
      title: d.title,
      first,
      latest,
      diff,
    }
  })
}

function getTrendComments(comparison) {
  if (!comparison.length) return []

  const improving = comparison.filter((x) => x.diff > 0).map((x) => x.title)
  const declining = comparison.filter((x) => x.diff < 0).map((x) => x.title)
  const stable = comparison.filter((x) => x.diff === 0).map((x) => x.title)

  const comments = []

  if (improving.length) {
    comments.push(`Improving in ${improving.slice(0, 3).join(", ")}.`)
  }
  if (declining.length) {
    comments.push(`Decline noted in ${declining.slice(0, 3).join(", ")}.`)
  }
  if (stable.length && comments.length === 0) {
    comments.push(`Scores are currently stable across ${stable.slice(0, 3).join(", ")}.`)
  }

  return comments
}

function RadarChart({ scores }) {
  const size = 320
  const center = size / 2
  const radius = 108
  const levels = 4
  const keys = domains.map((d) => d.key)

  const pointsForLevel = (level) =>
    keys
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
        const r = (radius * level) / levels
        const x = center + Math.cos(angle) * r
        const y = center + Math.sin(angle) * r
        return `${x},${y}`
      })
      .join(" ")

  const dataPoints = keys
    .map((key, i) => {
      const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
      const r = (radius * scores[key]) / levels
      const x = center + Math.cos(angle) * r
      const y = center + Math.sin(angle) * r
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[1, 2, 3, 4].map((level) => (
          <polygon key={level} points={pointsForLevel(level)} fill="none" stroke="#d1d5db" strokeWidth="1" />
        ))}
        {keys.map((key, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
          const x = center + Math.cos(angle) * radius
          const y = center + Math.sin(angle) * radius
          return <line key={key} x1={center} y1={center} x2={x} y2={y} stroke="#d1d5db" strokeWidth="1" />
        })}
        <polygon points={dataPoints} fill="rgba(12, 74, 110, 0.18)" stroke="#0c4a6e" strokeWidth="2" />
        {keys.map((key, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
          const r = (radius * scores[key]) / levels
          const x = center + Math.cos(angle) * r
          const y = center + Math.sin(angle) * r
          return <circle key={key} cx={x} cy={y} r="4" fill="#0c4a6e" />
        })}
      </svg>
    </div>
  )
}

const pageWrap = {
  minHeight: "100vh",
  background: "#f6f7fb",
  padding: "24px 16px 32px",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
}

const container = {
  maxWidth: 1180,
  margin: "0 auto",
}

const hero = {
  background: "linear-gradient(135deg, #0c4a6e, #0f766e)",
  color: "white",
  borderRadius: 18,
  padding: 20,
  marginBottom: 18,
  boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
}

const sectionCard = {
  border: "1px solid #dbe4ee",
  borderRadius: 16,
  padding: 18,
  background: "#ffffff",
}

const mutedCard = {
  ...sectionCard,
  background: "#f8fafc",
}

const buttonBase = {
  padding: "10px 14px",
  color: "white",
  border: "none",
  borderRadius: 10,
  fontWeight: 600,
  cursor: "pointer",
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginTop: 6,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
  boxSizing: "border-box",
}

const chipStyle = (bg) => ({
  background: bg,
  color: "white",
  padding: "4px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
})

export default function App() {
  const [user, setUser] = useState(null)
  const [isEvaluator, setIsEvaluator] = useState(false)
  const [evaluations, setEvaluations] = useState([])
  const [residentEmail, setResidentEmail] = useState("")
  const [evaluatorLoginEmail, setEvaluatorLoginEmail] = useState("")
  const [evaluatorLoginPassword, setEvaluatorLoginPassword] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [dashboardSearch, setDashboardSearch] = useState("")
  const [ratingFilter, setRatingFilter] = useState("All")
  const [selectedResident, setSelectedResident] = useState("")

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

  useEffect(() => {
    if (!statusMessage) return
    const t = setTimeout(() => setStatusMessage(""), 2500)
    return () => clearTimeout(t)
  }, [statusMessage])

  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      @media print {
        button, input, select {
          display: none !important;
        }
        .hide-print {
          display: none !important;
        }
        .print-card {
          border: none !important;
          box-shadow: none !important;
        }
      }
    `
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  const total = useMemo(
    () => Object.values(form.scores).reduce((sum, value) => sum + Number(value), 0),
    [form.scores]
  )

  const globalRating = getGlobalRating(total)
  const autoStrengths = useMemo(() => getAutoStrengths(form.scores), [form.scores])
  const priorityRecommendations = useMemo(() => getPriorityRecommendations(form.scores), [form.scores])
  const oneLineSummary = useMemo(
    () => getOneLineSummary(form.scores, total, globalRating),
    [form.scores, total, globalRating]
  )

  const consultantReport = useMemo(
    () =>
      getConsultantReport({
        resident: form.resident,
        evaluator: form.evaluator,
        rotation: form.rotation,
        caseName: form.caseName,
        scores: form.scores,
        total,
        globalRating,
        priorities: priorityRecommendations,
      }),
    [form, total, globalRating, priorityRecommendations]
  )

  const nonZeroScores = Object.values(form.scores).filter((v) => v > 0)
  const highestScore = nonZeroScores.length ? Math.max(...nonZeroScores) : null
  const lowestScore = nonZeroScores.length ? Math.min(...nonZeroScores) : null

  const filteredEvaluations = useMemo(() => {
    const q = dashboardSearch.trim().toLowerCase()

    return evaluations.filter((e) => {
      const textMatch =
        !q ||
        (e.resident || "").toLowerCase().includes(q) ||
        (e.caseName || "").toLowerCase().includes(q) ||
        (e.evaluator || "").toLowerCase().includes(q) ||
        (e.rotation || "").toLowerCase().includes(q)

      const ratingMatch = ratingFilter === "All" || (e.globalRating || "") === ratingFilter

      return textMatch && ratingMatch
    })
  }, [evaluations, dashboardSearch, ratingFilter])

  const residentData = useMemo(() => {
    if (!selectedResident.trim()) return []
    return evaluations
      .filter((e) => (e.resident || "").toLowerCase() === selectedResident.trim().toLowerCase())
      .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
  }, [evaluations, selectedResident])

  const residentAverage =
    residentData.length > 0
      ? Math.round(
          residentData.reduce((sum, e) => sum + Number(e.total || e.totalScore || 0), 0) /
            residentData.length
        )
      : 0

  const firstResidentEval = residentData.length ? residentData[0] : null
  const latestResidentEval = residentData.length ? residentData[residentData.length - 1] : null
  const comparison = useMemo(
    () => getComparison(firstResidentEval, latestResidentEval),
    [firstResidentEval, latestResidentEval]
  )
  const trendComments = useMemo(() => getTrendComments(comparison), [comparison])

  const cohortAnalytics = useMemo(() => {
    if (!evaluations.length) {
      return {
        totalEvaluations: 0,
        avgTotal: 0,
        avgByDomain: {},
        weakestDomain: "",
      }
    }

    const totals = evaluations.map((e) => Number(e.total || e.totalScore || 0))
    const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)

    const avgByDomain = {}
    domains.forEach((d) => {
      const values = evaluations.map((e) => Number(e.scores?.[d.key] || 0))
      avgByDomain[d.key] = values.length
        ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
        : 0
    })

    const weakestDomainKey = Object.entries(avgByDomain).sort((a, b) => a[1] - b[1])[0]?.[0] || ""
    const weakestDomain =
      domains.find((d) => d.key === weakestDomainKey)?.title || ""

    return {
      totalEvaluations: evaluations.length,
      avgTotal,
      avgByDomain,
      weakestDomain,
    }
  }, [evaluations])

  const handleField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleScore = (field, value) => {
    setForm((prev) => ({
      ...prev,
      scores: { ...prev.scores, [field]: Number(value) },
    }))
  }

  const resetForm = () => {
    setForm({
      resident: "",
      evaluator: "",
      rotation: "",
      caseName: "",
      scores: initialScores,
    })
    setEditingId(null)
  }

  const submit = async () => {
    if (!form.resident && !form.caseName && total === 0) {
      alert("Enter at least a resident name, case, or some assessment.")
      return
    }

    const payload = {
      ...form,
      total,
      globalRating,
      oneLineSummary,
      consultantReport,
      residentEmail: residentEmail || null,
      submittedBy: user?.email || "resident-anonymous",
      submittedByRole: isEvaluator ? "evaluator" : "resident",
    }

    try {
      if (editingId && isEvaluator) {
        await updateEvaluation(editingId, payload)
        setStatusMessage("Evaluation updated.")
      } else {
        await createEvaluation(payload)
        setStatusMessage("Evaluation saved.")
      }
      resetForm()
    } catch (e) {
      console.error(e)
      alert("Save failed.")
    }
  }

  const loadEvaluation = (record) => {
    setForm({
      resident: record.resident || "",
      evaluator: record.evaluator || "",
      rotation: record.rotation || "",
      caseName: record.caseName || "",
      scores: record.scores || initialScores,
    })
    setEditingId(record.id)
    setStatusMessage("Loaded into form.")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDeleteEvaluation = async (id) => {
    const ok = window.confirm("Delete this evaluation?")
    if (!ok) return

    try {
      await removeEvaluation(id)
      if (editingId === id) {
        resetForm()
      }
      setStatusMessage("Evaluation deleted.")
    } catch (e) {
      console.error(e)
      alert("Delete failed.")
    }
  }

  const copyConsultantReport = async () => {
    if (!consultantReport) return
    try {
      await navigator.clipboard.writeText(consultantReport)
      setStatusMessage("Consultant report copied.")
    } catch {
      alert("Copy failed.")
    }
  }

  if (!user) {
    return (
      <div style={pageWrap}>
        <div style={container}>
          <div style={hero}>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)" }}>CRFT</h1>
            <div style={{ marginTop: 6, opacity: 0.95, fontSize: 15 }}>Clinical Reasoning Feedback Tool</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            <div style={sectionCard}>
              <h2 style={{ marginTop: 0 }}>Resident Access</h2>
              <p style={{ color: "#475569" }}>Anonymous entry for residents.</p>
              <input
                placeholder="Optional email for follow-up"
                value={residentEmail}
                onChange={(e) => setResidentEmail(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={async () => {
                  try {
                    await signInResident()
                  } catch (e) {
                    console.error(e)
                    alert("Resident login failed.")
                  }
                }}
                style={{ ...buttonBase, background: "#0f766e", marginTop: 12, width: "100%" }}
              >
                Enter as Resident
              </button>
            </div>

            <div style={sectionCard}>
              <h2 style={{ marginTop: 0 }}>Evaluator Access</h2>
              <p style={{ color: "#475569" }}>Shared evaluator login.</p>
              <input
                placeholder="Evaluator email"
                value={evaluatorLoginEmail}
                onChange={(e) => setEvaluatorLoginEmail(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Password"
                type="password"
                value={evaluatorLoginPassword}
                onChange={(e) => setEvaluatorLoginPassword(e.target.value)}
                style={inputStyle}
              />
              <button
                onClick={async () => {
                  try {
                    await signInEvaluator(evaluatorLoginEmail, evaluatorLoginPassword)
                  } catch (e) {
                    console.error(e)
                    alert("Evaluator login failed.")
                  }
                }}
                style={{ ...buttonBase, background: "#1d4ed8", marginTop: 12, width: "100%" }}
              >
                Login as Evaluator
              </button>
            </div>

            <div style={mutedCard}>
              <h2 style={{ marginTop: 0 }}>Scan to Open CRFT</h2>
              <div style={{ color: "#475569", marginBottom: 8 }}>
                Residents can scan this QR code to open the tool directly on their phones.
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", wordBreak: "break-all", marginBottom: 12 }}>{appUrl}</div>
              <div
                style={{
                  background: "white",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  display: "inline-block",
                }}
              >
                <QRCodeSVG value={appUrl} size={150} bgColor="#ffffff" fgColor="#0f172a" level="M" />
              </div>
            </div>
          </div>

          <div style={{ textAlign: "right", color: "green", fontSize: 12, marginTop: 18 }}>
            Developed for KFSHRC-J IM residents
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={hero}>
          <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)" }}>CRFT</h1>
          <div style={{ marginTop: 6, opacity: 0.95, fontSize: 15 }}>Clinical Reasoning Feedback Tool</div>
        </div>

        <div className="hide-print" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={resetForm} style={{ ...buttonBase, background: "#e11d48" }}>
            Reset
          </button>
          <button onClick={() => window.print()} style={{ ...buttonBase, background: "#2563eb" }}>
            Print / Save PDF
          </button>
          <button onClick={submit} style={{ ...buttonBase, background: "#0f766e" }}>
            {editingId ? "Update Evaluation" : "Save Current Assessment"}
          </button>
          <button onClick={logOut} style={{ ...buttonBase, background: "#475569" }}>
            Logout
          </button>
        </div>

        {statusMessage && (
          <div
            className="hide-print"
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 10,
              background: "#ecfeff",
              border: "1px solid #a5f3fc",
              color: "#0f172a",
            }}
          >
            {statusMessage}
          </div>
        )}

        <div
          className="hide-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <label><strong>Resident</strong></label>
            <input value={form.resident} onChange={(e) => handleField("resident", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label><strong>Evaluator</strong></label>
            <input value={form.evaluator} onChange={(e) => handleField("evaluator", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label><strong>Rotation</strong></label>
            <input value={form.rotation} onChange={(e) => handleField("rotation", e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label><strong>Case</strong></label>
            <input value={form.caseName} onChange={(e) => handleField("caseName", e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div className="print-card" style={mutedCard}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Summary</h2>
            <p style={{ margin: "8px 0" }}><strong>Total Score:</strong> {total} / 24</p>
            {globalRating && <p style={{ margin: "8px 0" }}><strong>Global Rating:</strong> {globalRating}</p>}
            {oneLineSummary && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "white",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong>1-line summary:</strong> {oneLineSummary}
              </div>
            )}
          </div>

          <div className="print-card" style={sectionCard}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Performance Radar</h2>
            <RadarChart scores={form.scores} />
          </div>
        </div>

        <div className="hide-print" style={mutedCard}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 220, flex: 1 }}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Scan to Open CRFT</h2>
              <div style={{ color: "#475569", marginBottom: 8 }}>
                Residents can scan this QR code to open the tool directly on their phones.
              </div>
              <div style={{ fontSize: 13, color: "#0f172a", wordBreak: "break-all" }}>{appUrl}</div>
            </div>

            <div
              style={{
                background: "white",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            >
              <QRCodeSVG value={appUrl} size={150} bgColor="#ffffff" fgColor="#0f172a" level="M" />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14, marginTop: 18, marginBottom: 18 }}>
          {domains.map((domain) => {
            const score = form.scores[domain.key]
            const isHighest = highestScore !== null && score === highestScore && score > 0
            const isLowest = lowestScore !== null && score === lowestScore && score > 0

            return (
              <div
                key={domain.key}
                className="print-card"
                style={{
                  border: isHighest ? "2px solid #16a34a" : isLowest ? "2px solid #dc2626" : "1px solid #dbe4ee",
                  borderRadius: 16,
                  padding: 16,
                  background: isHighest ? "#f0fdf4" : isLowest ? "#fef2f2" : "#ffffff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={{ marginTop: 0, marginBottom: 10 }}>{domain.title}</h3>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isHighest && <span style={chipStyle("#16a34a")}>Highest</span>}
                    {isLowest && <span style={chipStyle("#dc2626")}>Lowest</span>}
                  </div>
                </div>

                <select
                  className="hide-print"
                  value={form.scores[domain.key]}
                  onChange={(e) => handleScore(domain.key, e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                  }}
                >
                  {[0, 1, 2, 3, 4].map((level) => (
                    <option key={level} value={level}>
                      {level} - {domain.levels[level]}
                    </option>
                  ))}
                </select>

                <p style={{ marginTop: 10, marginBottom: 6, color: "#475569" }}>
                  Current level: {domain.levels[form.scores[domain.key]]}
                </p>

                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#334155",
                    fontSize: 14,
                  }}
                >
                  <strong>Try to:</strong> {domain.clue}
                </div>
              </div>
            )
          })}
        </div>

        {autoStrengths.length > 0 && (
          <div className="print-card" style={{ ...mutedCard, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Auto-Generated Strengths</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {autoStrengths.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "white",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {priorityRecommendations.length > 0 && (
          <div className="print-card" style={{ ...mutedCard, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Top 2 Priorities</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {priorityRecommendations.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "white",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {consultantReport && (
          <div
            className="print-card"
            style={{
              border: "1px solid #dbe4ee",
              borderRadius: 16,
              padding: 18,
              background: "#eff6ff",
              marginBottom: 18,
            }}
          >
            <div className="hide-print" style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <h2 style={{ marginTop: 0, fontSize: 20, marginBottom: 0 }}>Consultant Report Generator</h2>
              <button onClick={copyConsultantReport} style={{ ...buttonBase, background: "#1d4ed8" }}>
                Copy Report
              </button>
            </div>
            <textarea
              value={consultantReport}
              readOnly
              rows={12}
              style={{
                width: "100%",
                padding: 12,
                marginTop: 12,
                borderRadius: 10,
                border: "1px solid #bfdbfe",
                background: "white",
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {isEvaluator && (
          <>
            <div className="hide-print" style={{ ...mutedCard, marginBottom: 18 }}>
              <h2 style={{ marginTop: 0, fontSize: 20 }}>Cohort Analytics</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <strong>Total evaluations:</strong> {cohortAnalytics.totalEvaluations}
                </div>
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <strong>Average total score:</strong> {cohortAnalytics.avgTotal}/24
                </div>
                <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
                  <strong>Weakest domain overall:</strong> {cohortAnalytics.weakestDomain || "—"}
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {domains.map((d) => (
                  <div
                    key={d.key}
                    style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: 12,
                    }}
                  >
                    <strong>{d.title}:</strong> {cohortAnalytics.avgByDomain[d.key] ?? 0} / 4
                  </div>
                ))}
              </div>
            </div>

            <div className="hide-print" style={{ ...mutedCard, marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0, fontSize: 20 }}>Evaluator Dashboard</h2>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={() => exportToCSV(evaluations)}
                    style={{ ...buttonBase, background: "#0ea5e9" }}
                  >
                    Export CSV
                  </button>

                  <input
                    placeholder="Search resident / case / evaluator / rotation"
                    value={dashboardSearch}
                    onChange={(e) => setDashboardSearch(e.target.value)}
                    style={{ ...inputStyle, marginTop: 0, minWidth: 280 }}
                  />

                  <select
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "white",
                    }}
                  >
                    <option>All</option>
                    <option>Junior</option>
                    <option>Intermediate</option>
                    <option>Senior</option>
                    <option>Near Consultant</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <input
                  placeholder="Enter resident name for timeline / comparison"
                  value={selectedResident}
                  onChange={(e) => setSelectedResident(e.target.value)}
                  style={inputStyle}
                />

                {selectedResident && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 10,
                      background: "white",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <strong>Evaluations:</strong> {residentData.length} <br />
                    <strong>Average Score:</strong> {residentAverage}/24
                  </div>
                )}
              </div>

              {residentData.length >= 2 && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: 14,
                    borderRadius: 12,
                    background: "white",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>Resident Comparison Over Time</h3>
                  <div style={{ marginBottom: 10 }}>
                    <strong>First:</strong> {formatFirebaseDate(firstResidentEval?.createdAt)} · {firstResidentEval?.total || firstResidentEval?.totalScore || 0}/24
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <strong>Latest:</strong> {formatFirebaseDate(latestResidentEval?.createdAt)} · {latestResidentEval?.total || latestResidentEval?.totalScore || 0}/24
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    {comparison.map((c) => (
                      <div
                        key={c.key}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                          background: "#f8fafc",
                        }}
                      >
                        <strong>{c.title}:</strong> {c.first} → {c.latest}{" "}
                        <span
                          style={{
                            color: c.diff > 0 ? "#16a34a" : c.diff < 0 ? "#dc2626" : "#475569",
                            fontWeight: 700,
                          }}
                        >
                          ({c.diff > 0 ? `+${c.diff}` : c.diff})
                        </span>
                      </div>
                    ))}
                  </div>

                  {trendComments.length > 0 && (
                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {trendComments.map((comment, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                            background: "#eff6ff",
                          }}
                        >
                          {comment}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {filteredEvaluations.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "white",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  No matching evaluations.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredEvaluations.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        background: "white",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div><strong>Resident:</strong> {e.resident || "—"}</div>
                          <div><strong>Case:</strong> {e.caseName || "—"}</div>
                          <div><strong>Rotation:</strong> {e.rotation || "—"}</div>
                          <div><strong>Evaluator:</strong> {e.evaluator || "—"}</div>
                          <div><strong>Score:</strong> {e.total || e.totalScore || 0}/24 {e.globalRating ? `· ${e.globalRating}` : ""}</div>
                          <div><strong>Date:</strong> {formatFirebaseDate(e.createdAt)}</div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                          <button
                            onClick={() => loadEvaluation(e)}
                            style={{ ...buttonBase, background: "#0f766e" }}
                          >
                            Load into Form
                          </button>
                          <button
                            onClick={() => handleDeleteEvaluation(e.id)}
                            style={{ ...buttonBase, background: "#dc2626" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {e.oneLineSummary && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: 10,
                            borderRadius: 8,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <strong>Summary:</strong> {e.oneLineSummary}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div style={{ textAlign: "right", color: "green", fontSize: 12, marginTop: 18 }}>
          Developed for KFSHRC-J IM residents
        </div>
      </div>
    </div>
  )
}
