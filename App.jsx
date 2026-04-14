import React, { useEffect, useMemo, useRef, useState } from "react"
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

const universalCases = [
  {
    key: "breathless-night",
    title: "The Breathless Night",
    domainFocus: "Problem Representation + Early Framing",
    vignette:
      "68M with HTN, CAD presents with acute dyspnea at night, orthopnea, and mild chest tightness. No fever.",
    progressiveData: [
      "Vitals: HR 105, BP 160/90, RR 26, SpO₂ 90% on room air",
      "Exam: Crackles bilaterally, mild JVP elevation",
      "Labs: BNP elevated, troponin mildly elevated",
      "CXR: Bilateral interstitial opacities",
    ],
    reasoningMap: [
      "Acute dyspnea requires cardiopulmonary prioritization",
      "No fever makes infection less likely, but not excluded",
      "Orthopnea plus crackles favors cardiac origin",
      "Mild troponin rise may reflect demand ischemia vs ACS",
    ],
    mustHit: [
      "Frame as acute decompensated heart failure with possible ischemic trigger",
      "Recognize troponin does not automatically mean ACS",
      "Start oxygen, diuretics, and consider nitrates",
    ],
    redFlags: [
      "Treating as pneumonia without reasoning",
      "Ignoring troponin context",
      "Missing hypertensive pulmonary edema",
    ],
    evaluatorGuide: [
      "Does the resident give a correct one-line summary?",
      "Do they prematurely anchor on infection?",
      "Do they contextualize troponin appropriately?",
    ],
  },
  {
    key: "silent-drop",
    title: "The Silent Drop",
    domainFocus: "Data Interpretation (Electrolytes & Acid-Base)",
    vignette:
      "55F admitted for vomiting. She is now weak and confused.",
    progressiveData: [
      "K = 2.7",
      "HCO₃ = 36",
      "Chloride low",
      "ABG: metabolic alkalosis",
      "Urine chloride low",
    ],
    reasoningMap: [
      "Identify metabolic alkalosis first",
      "Low urine chloride suggests chloride-responsive alkalosis",
      "Vomiting plus volume contraction explains physiology",
    ],
    mustHit: [
      "Recognize contraction alkalosis",
      "Treat with normal saline plus KCl, not potassium alone",
      "Explain RAAS activation and distal hydrogen loss",
    ],
    redFlags: [
      "Giving potassium only",
      "Missing volume depletion",
      "Ignoring urine chloride",
    ],
    evaluatorGuide: [
      "Does the resident use urine chloride correctly?",
      "Do they explain mechanism rather than memorize?",
    ],
  },
  {
    key: "fever-wont-break",
    title: "The Fever That Won’t Break",
    domainFocus: "Hypothesis Generation",
    vignette:
      "72M with diabetes has persistent fever for 10 days despite antibiotics for presumed pneumonia.",
    progressiveData: [
      "Blood cultures negative",
      "CT chest shows improving infiltrate",
      "CRP remains high",
      "New murmur now heard",
    ],
    reasoningMap: [
      "Reframe to persistent fever despite treatment",
      "Expand differential beyond antibiotic failure",
      "Consider endocarditis, abscess, drug fever, malignancy",
    ],
    mustHit: [
      "Change the clinical question",
      "Order echocardiography for possible endocarditis",
      "Recognize persistent fever needs reframing",
    ],
    redFlags: [
      "Blind antibiotic escalation",
      "Failure to reframe diagnosis",
      "Missing the murmur clue",
    ],
    evaluatorGuide: [
      "Does the resident step back and reframe?",
      "Or do they continue linear thinking?",
    ],
  },
  {
    key: "quiet-creatinine-rise",
    title: "The Quiet Creatinine Rise",
    domainFocus: "Trend Interpretation + Anticipation",
    vignette:
      "65F is post-op day 2 and her creatinine is rising.",
    progressiveData: [
      "Cr: 90 → 130 → 180",
      "Urine output decreasing",
      "FeNa 0.8%",
      "On ACE inhibitor and NSAIDs",
    ],
    reasoningMap: [
      "Classify AKI and interpret trend",
      "Integrate ACEi + NSAID + volume status",
      "Prevent progression before severe AKI develops",
    ],
    mustHit: [
      "Stop nephrotoxins",
      "Assess volume status",
      "Anticipate worsening kidney injury and complications",
    ],
    redFlags: [
      "Ignoring trend",
      "Over-relying on FeNa",
      "Continuing offending medications",
    ],
    evaluatorGuide: [
      "Does the resident act early?",
      "Do they integrate medications with physiology?",
    ],
  },
  {
    key: "chest-pain-trap",
    title: "The Chest Pain Trap",
    domainFocus: "Diagnostic Precision",
    vignette:
      "45M has chest pain after stress. It is sharp and worse with inspiration.",
    progressiveData: [
      "ECG normal",
      "Troponin normal",
      "D-dimer mildly elevated",
      "CT negative for PE",
    ],
    reasoningMap: [
      "Avoid premature closure on ACS",
      "Consider pericarditis, musculoskeletal pain, anxiety",
      "Use pre-test probability before D-dimer",
    ],
    mustHit: [
      "Recognize non-cardiac chest pain safely",
      "Avoid over-testing cascade",
      "De-escalate with reasoning, not reflex reassurance",
    ],
    redFlags: [
      "Defensive over-testing spiral",
      "Calling atypical automatically safe",
      "Missing pericarditis clues",
    ],
    evaluatorGuide: [
      "Can the resident safely de-escalate?",
      "Do they avoid the testing cascade?",
    ],
  },
  {
    key: "hidden-clot",
    title: "The Hidden Clot",
    domainFocus: "Risk Stratification + Systems Thinking",
    vignette:
      "60F after orthopedic surgery is now tachycardic and mildly hypoxic.",
    progressiveData: [
      "HR 110, SpO₂ 92%",
      "Wells score moderate",
      "D-dimer elevated",
      "CT shows segmental PE",
    ],
    reasoningMap: [
      "Identify provoked VTE",
      "Risk stratify by hemodynamics and RV strain",
      "Move from diagnosis to level of treatment intensity",
    ],
    mustHit: [
      "Start anticoagulation promptly",
      "Decide inpatient vs outpatient management",
      "Plan finite duration for provoked VTE",
    ],
    redFlags: [
      "Delaying anticoagulation",
      "Over-escalating to thrombolysis",
      "Ignoring postoperative context",
    ],
    evaluatorGuide: [
      "Does the resident integrate risk, context, and management?",
      "Or just react to the image result?",
    ],
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
  if (improving.length) comments.push(`Improving in ${improving.slice(0, 3).join(", ")}.`)
  if (declining.length) comments.push(`Decline noted in ${declining.slice(0, 3).join(", ")}.`)
  if (stable.length && comments.length === 0) comments.push(`Scores are currently stable across ${stable.slice(0, 3).join(", ")}.`)
  return comments
}

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function keywordHit(answer, target) {
  const a = normalizeText(answer)
  const t = normalizeText(target)

  if (!a || !t) return false
  if (a.includes(t)) return true

  const words = t.split(" ").filter((w) => w.length > 3)
  if (!words.length) return false

  const matched = words.filter((w) => a.includes(w)).length
  return matched / words.length >= 0.6
}

function benchmarkCaseAnswer(answer, selectedCase) {
  if (!selectedCase || !answer.trim()) return null

  const mustHit = selectedCase.mustHit || []
  const reasoning = selectedCase.reasoningMap || []
  const redFlags = selectedCase.redFlags || []

  const mustHitMatched = mustHit.filter((point) => keywordHit(answer, point))
  const reasoningMatched = reasoning.filter((point) => keywordHit(answer, point))
  const redFlagsPotentiallyMissed = redFlags.filter((flag) => !keywordHit(answer, flag))

  const mustHitScore = mustHit.length ? (mustHitMatched.length / mustHit.length) * 100 : 0
  const reasoningScore = reasoning.length ? (reasoningMatched.length / reasoning.length) * 100 : 0
  const totalScore = Math.round(mustHitScore * 0.7 + reasoningScore * 0.3)

  let level = "Needs Work"
  if (totalScore >= 85) level = "Excellent"
  else if (totalScore >= 70) level = "Competent"
  else if (totalScore >= 50) level = "Developing"

  return {
    totalScore,
    level,
    mustHitMatched,
    reasoningMatched,
    redFlagsPotentiallyMissed,
    mustHitTotal: mustHit.length,
    reasoningTotal: reasoning.length,
  }
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

function HorizontalBarChart({ title, data, maxValue, color = "#0c4a6e", suffix = "" }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 14 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {data.map((item) => {
          const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0
          return (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
                <span>{item.label}</span>
                <strong>{item.value}{suffix}</strong>
              </div>
              <div style={{ width: "100%", height: 12, background: "#e5e7eb", borderRadius: 999 }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: color,
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
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
  const [selectedCaseKey, setSelectedCaseKey] = useState("")

  const [facultyMode, setFacultyMode] = useState(false)
  const [traineeAnswer, setTraineeAnswer] = useState("")
  const [benchmarkResult, setBenchmarkResult] = useState(null)

  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState("")
  const recognitionRef = useRef(null)

  const [form, setForm] = useState(initialForm)

  const selectedCase = useMemo(
    () => universalCases.find((c) => c.key === selectedCaseKey) || null,
    [selectedCaseKey]
  )

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
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(Boolean(SpeechRecognition))
  }, [])

  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      @media print {
        button, input, select, textarea {
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

  useEffect(() => {
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
      } catch {
      }
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
        ratingCounts: { Junior: 0, Intermediate: 0, Senior: 0, "Near Consultant": 0 },
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
    const weakestDomain = domains.find((d) => d.key === weakestDomainKey)?.title || ""

    const ratingCounts = { Junior: 0, Intermediate: 0, Senior: 0, "Near Consultant": 0 }
    evaluations.forEach((e) => {
      if (e.globalRating && ratingCounts[e.globalRating] !== undefined) {
        ratingCounts[e.globalRating] += 1
      }
    })

    return {
      totalEvaluations: evaluations.length,
      avgTotal,
      avgByDomain,
      weakestDomain,
      ratingCounts,
    }
  }, [evaluations])

  const stopVoiceTyping = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    } catch {
    }
  }

  const startVoiceTyping = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setSpeechError("Voice typing is not supported in this browser.")
      return
    }

    if (!selectedCase) {
      setSpeechError("Select a case first before voice typing.")
      return
    }

    setSpeechError("")

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    } catch {
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.lang = "en-US"
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    let finalTranscript = ""
    let lastRendered = traineeAnswer.trim()

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " "
        } else {
          interimTranscript += transcript
        }
      }

      const basePrefix = lastRendered ? `${lastRendered} ` : ""
      const nextText = `${basePrefix}${finalTranscript}${interimTranscript}`.trim()
      setTraineeAnswer(nextText)
    }

    recognition.onerror = (event) => {
      const err = event?.error || "Voice typing failed."
      if (err !== "aborted") {
        setSpeechError(err)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
      const finalText = finalTranscript.trim()
      if (finalText) {
        setTraineeAnswer((prev) => {
          const existing = lastRendered || prev.trim()
          return existing ? `${existing} ${finalText}`.trim() : finalText
        })
      }
    }

    recognition.start()
  }

  const assignRandomCase = () => {
    if (!universalCases.length) return
    const randomIndex = Math.floor(Math.random() * universalCases.length)
    const picked = universalCases[randomIndex]

    stopVoiceTyping()
    setSelectedCaseKey(picked.key)
    setForm((prev) => ({
      ...prev,
      caseName: picked.title,
    }))
    setFacultyMode(false)
    setTraineeAnswer("")
    setBenchmarkResult(null)
    setSpeechError("")
    setStatusMessage(`Random case assigned: ${picked.title}`)
  }

  const useSelectedCase = () => {
    if (!selectedCase) return
    stopVoiceTyping()
    setForm((prev) => ({
      ...prev,
      caseName: selectedCase.title,
    }))
    setBenchmarkResult(null)
    setTraineeAnswer("")
    setSpeechError("")
    setStatusMessage(`Loaded case: ${selectedCase.title}`)
  }

  const runBenchmark = () => {
    if (!selectedCase) {
      alert("Select a case first.")
      return
    }
    if (!traineeAnswer.trim()) {
      alert("Enter trainee reasoning first.")
      return
    }

    const result = benchmarkCaseAnswer(traineeAnswer, selectedCase)
    setBenchmarkResult(result)
  }

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
    stopVoiceTyping()
    setForm({
      resident: "",
      evaluator: "",
      rotation: "",
      caseName: "",
      scores: { ...initialScores },
    })
    setSelectedCaseKey("")
    setEditingId(null)
    setFacultyMode(false)
    setTraineeAnswer("")
    setBenchmarkResult(null)
    setSpeechError("")
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
      universalCaseKey: selectedCaseKey || null,
      universalCaseTitle: selectedCase?.title || null,
      traineeAnswer: traineeAnswer || null,
      benchmarkResult: benchmarkResult || null,
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
    stopVoiceTyping()
    setForm({
      resident: record.resident || "",
      evaluator: record.evaluator || "",
      rotation: record.rotation || "",
      caseName: record.caseName || "",
      scores: record.scores || { ...initialScores },
    })
    setSelectedCaseKey(record.universalCaseKey || "")
    setEditingId(record.id)
    setTraineeAnswer(record.traineeAnswer || "")
    setBenchmarkResult(record.benchmarkResult || null)
    setFacultyMode(false)
    setSpeechError("")
    setStatusMessage("Loaded into form.")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleDeleteEvaluation = async (id) => {
    const ok = window.confirm("Delete this evaluation?")
    if (!ok) return

    try {
      await removeEvaluation(id)
      if (editingId === id) resetForm()
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
            <h2 style={{ margin: 0, fontSize: 20 }}>Universal Internal Medicine Case Library</h2>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={selectedCaseKey}
                onChange={(e) => {
                  stopVoiceTyping()
                  setSelectedCaseKey(e.target.value)
                  setBenchmarkResult(null)
                  setTraineeAnswer("")
                  setFacultyMode(false)
                  setSpeechError("")
                }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  minWidth: 260,
                }}
              >
                <option value="">Select a universal case</option>
                {universalCases.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.title}
                  </option>
                ))}
              </select>

              <button
                onClick={assignRandomCase}
                style={{ ...buttonBase, background: "#7c3aed" }}
              >
                Random Case
              </button>

              <button
                onClick={useSelectedCase}
                disabled={!selectedCase}
                style={{
                  ...buttonBase,
                  background: selectedCase ? "#0f766e" : "#94a3b8",
                }}
              >
                Use This Case
              </button>

              <button
                onClick={() => setFacultyMode((prev) => !prev)}
                disabled={!selectedCase}
                style={{
                  ...buttonBase,
                  background: facultyMode ? "#b45309" : "#334155",
                }}
              >
                {facultyMode ? "Hide Faculty Answers" : "Show Faculty Answers"}
              </button>
            </div>
          </div>

          {!selectedCase ? (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "white",
                border: "1px solid #e2e8f0",
                color: "#475569",
              }}
            >
              Choose a case to display its vignette. Faculty answers stay hidden until you turn them on.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "white",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>{selectedCase.title}</h3>
                <div style={{ marginBottom: 8, color: "#0f766e", fontWeight: 700 }}>
                  Domain focus: {selectedCase.domainFocus}
                </div>
                <div>{selectedCase.vignette}</div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                }}
              >
                <h4 style={{ marginTop: 0 }}>Progressive Data</h4>
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedCase.progressiveData.map((item, idx) => (
                    <div key={idx}>• {item}</div>
                  ))}
                </div>
              </div>

              {facultyMode ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div style={{ padding: 14, borderRadius: 12, background: "white", border: "1px solid #e2e8f0" }}>
                      <h4 style={{ marginTop: 0 }}>Expected Reasoning Map</h4>
                      <div style={{ display: "grid", gap: 8 }}>
                        {selectedCase.reasoningMap.map((item, idx) => (
                          <div key={idx}>• {item}</div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: 14, borderRadius: 12, background: "white", border: "1px solid #e2e8f0" }}>
                      <h4 style={{ marginTop: 0 }}>Must-Hit Points</h4>
                      <div style={{ display: "grid", gap: 8 }}>
                        {selectedCase.mustHit.map((item, idx) => (
                          <div key={idx}>• {item}</div>
                        ))}
                      </div>
                    </div>

                    <div style={{ padding: 14, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca" }}>
                      <h4 style={{ marginTop: 0 }}>Red-Flag Misses</h4>
                      <div style={{ display: "grid", gap: 8 }}>
                        {selectedCase.redFlags.map((item, idx) => (
                          <div key={idx}>• {item}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: "#eff6ff",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    <h4 style={{ marginTop: 0 }}>Evaluator Guide</h4>
                    <div style={{ display: "grid", gap: 8 }}>
                      {selectedCase.evaluatorGuide.map((item, idx) => (
                        <div key={idx}>• {item}</div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#7c2d12",
                  }}
                >
                  Faculty answer mode is hidden. Trainees can reason through the case first before revealing the expected map.
                </div>
              )}

              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                }}
              >
                <h4 style={{ marginTop: 0 }}>Case Benchmarking</h4>
                <div style={{ color: "#475569", marginBottom: 10 }}>
                  Enter the trainee’s reasoning or assessment, then compare it against the case benchmark.
                </div>

                <textarea
                  rows={7}
                  value={traineeAnswer}
                  onChange={(e) => setTraineeAnswer(e.target.value)}
                  placeholder="Paste, type, or dictate the trainee reasoning here..."
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #cbd5e1",
                    background: "white",
                    boxSizing: "border-box",
                    marginBottom: 10,
                  }}
                />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {speechSupported && (
                    <button
                      onClick={isListening ? stopVoiceTyping : startVoiceTyping}
                      style={{
                        ...buttonBase,
                        background: isListening ? "#b91c1c" : "#7c3aed",
                      }}
                    >
                      {isListening ? "Stop Listening" : "🎤 Voice Type"}
                    </button>
                  )}

                  <button onClick={runBenchmark} style={{ ...buttonBase, background: "#1d4ed8" }}>
                    Run Benchmark
                  </button>

                  <button
                    onClick={() => {
                      stopVoiceTyping()
                      setTraineeAnswer("")
                      setBenchmarkResult(null)
                      setSpeechError("")
                    }}
                    style={{ ...buttonBase, background: "#64748b" }}
                  >
                    Clear Benchmark
                  </button>
                </div>

                {!speechSupported && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      color: "#7c2d12",
                    }}
                  >
                    Voice typing is not supported in this browser. Manual typing still works.
                  </div>
                )}

                {speechError && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#991b1b",
                    }}
                  >
                    {speechError}
                  </div>
                )}

                {benchmarkResult && (
                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "white",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <strong>Benchmark Score:</strong> {benchmarkResult.totalScore}/100
                      <br />
                      <strong>Level:</strong> {benchmarkResult.level}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <div style={{ padding: 12, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                        <strong>Matched Must-Hit Points</strong>
                        <div style={{ marginTop: 8 }}>
                          {benchmarkResult.mustHitMatched.length} / {benchmarkResult.mustHitTotal}
                        </div>
                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {benchmarkResult.mustHitMatched.length ? (
                            benchmarkResult.mustHitMatched.map((item, idx) => <div key={idx}>• {item}</div>)
                          ) : (
                            <div>None matched yet.</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: 12, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                        <strong>Matched Reasoning Steps</strong>
                        <div style={{ marginTop: 8 }}>
                          {benchmarkResult.reasoningMatched.length} / {benchmarkResult.reasoningTotal}
                        </div>
                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {benchmarkResult.reasoningMatched.length ? (
                            benchmarkResult.reasoningMatched.map((item, idx) => <div key={idx}>• {item}</div>)
                          ) : (
                            <div>No reasoning steps matched yet.</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <strong>Potential Miss Areas</strong>
                        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                          {benchmarkResult.redFlagsPotentiallyMissed.length ? (
                            benchmarkResult.redFlagsPotentiallyMissed.map((item, idx) => <div key={idx}>• {item}</div>)
                          ) : (
                            <div>No obvious miss areas detected.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
                  marginBottom: 14,
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

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: 16,
                }}
              >
                <HorizontalBarChart
                  title="Average by Domain"
                  data={domains.map((d) => ({
                    label: d.title,
                    value: cohortAnalytics.avgByDomain[d.key] ?? 0,
                  }))}
                  maxValue={4}
                  color="#0c4a6e"
                  suffix="/4"
                />
                <HorizontalBarChart
                  title="Global Rating Distribution"
                  data={Object.entries(cohortAnalytics.ratingCounts || {}).map(([label, value]) => ({
                    label,
                    value,
                  }))}
                  maxValue={Math.max(...Object.values(cohortAnalytics.ratingCounts || { a: 1 }), 1)}
                  color="#0f766e"
                />
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
                          {e.universalCaseTitle && <div><strong>Universal case:</strong> {e.universalCaseTitle}</div>}
                          {e.benchmarkResult?.totalScore !== undefined && (
                            <div><strong>Benchmark:</strong> {e.benchmarkResult.totalScore}/100 · {e.benchmarkResult.level}</div>
                          )}
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
