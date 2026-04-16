import React, { useEffect, useMemo, useState } from "react"
import {
  signInResident,
  signInEvaluator,
  logOut,
  watchAuth,
  createEvaluation,
  subscribeEvaluations,
  updateEvaluation,
  removeEvaluation,
  subscribeSessionConfig,
  saveSessionConfig,
} from "./firebase"

const appUrl = "https://fahad9101.github.io/CRFT/"

const domains = [
  { key: "problemFraming", title: "Problem Framing" },
  { key: "syndromeIdentification", title: "Syndrome Identification" },
  { key: "differentialDiagnosis", title: "Differential Diagnosis" },
  { key: "dataInterpretation", title: "Data Interpretation" },
  { key: "anticipation", title: "Anticipation" },
  { key: "reassessment", title: "Reassessment" },
]

const errorTagOptions = [
  "poor_problem_representation",
  "premature_closure",
  "weak_differential",
  "data_misinterpretation",
  "no_anticipation",
  "fragmented_thinking",
  "weak_reassessment",
  "syndrome_misidentification",
]

const initialScores = {
  problemFraming: 0,
  syndromeIdentification: 0,
  differentialDiagnosis: 0,
  dataInterpretation: 0,
  anticipation: 0,
  reassessment: 0,
}

const universalCases = [
  {
    key: "breathless-night",
    title: "The Breathless Night",
    setting: "Inpatient",
    difficulty: 2,
    isTrap: true,
    trapMessage: "Troponin elevation does not automatically equal ACS. Interpret it in the clinical context.",
    domainFocus: "Problem Representation + Early Framing",
    targetDomains: ["problemFraming", "syndromeIdentification", "anticipation"],
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
    setting: "Inpatient",
    difficulty: 4,
    isTrap: false,
    trapMessage: "",
    domainFocus: "Data Interpretation (Electrolytes & Acid-Base)",
    targetDomains: ["dataInterpretation", "syndromeIdentification"],
    vignette: "55F admitted for vomiting. She is now weak and confused.",
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
    setting: "Inpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Persistent fever after antibiotics is not automatically antibiotic failure. Reframe the question.",
    domainFocus: "Hypothesis Generation",
    targetDomains: ["problemFraming", "reassessment", "differentialDiagnosis"],
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
    setting: "Inpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Do not over-rely on FeNa alone. Trend, medications, and context matter more.",
    domainFocus: "Trend Interpretation + Anticipation",
    targetDomains: ["dataInterpretation", "anticipation", "reassessment"],
    vignette: "65F is post-op day 2 and her creatinine is rising.",
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
    key: "hidden-clot",
    title: "The Hidden Clot",
    setting: "Inpatient",
    difficulty: 3,
    isTrap: false,
    trapMessage: "",
    domainFocus: "Risk Stratification + Systems Thinking",
    targetDomains: ["differentialDiagnosis", "anticipation", "problemFraming"],
    vignette: "60F after orthopedic surgery is now tachycardic and mildly hypoxic.",
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
  {
    key: "delirium-night-shift",
    title: "The Delirium on Night Shift",
    setting: "Inpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Agitation is not the diagnosis. The task is to recognize delirium and search for reversible causes.",
    domainFocus: "Reassessment + Dangerous Cause Search",
    targetDomains: ["reassessment", "differentialDiagnosis", "problemFraming"],
    vignette:
      "79M admitted for cellulitis becomes agitated and disoriented overnight.",
    progressiveData: [
      "Nurse notes fluctuating attention",
      "Temp 37.9°C, HR 104",
      "Bladder scan 700 mL",
      "Medication list includes diphenhydramine and opioids",
    ],
    reasoningMap: [
      "Recognize delirium rather than labeling agitation alone",
      "Search for reversible precipitants",
      "Consider retention, infection, drugs, pain, hypoxia, constipation",
    ],
    mustHit: [
      "Identify delirium as an acute brain failure syndrome",
      "Look for reversible triggers systematically",
      "Prioritize non-pharmacologic management and treat causes",
    ],
    redFlags: [
      "Using sedatives before assessing cause",
      "Missing urinary retention",
      "Calling this dementia progression",
    ],
    evaluatorGuide: [
      "Does the resident recognize fluctuating attention?",
      "Do they search for common hospital precipitants?",
    ],
  },
  {
    key: "clinic-fatigue-anemia",
    title: "The Tired Clinic Patient",
    setting: "Outpatient",
    difficulty: 2,
    isTrap: false,
    trapMessage: "",
    domainFocus: "Problem Representation + Initial Workup",
    targetDomains: ["problemFraming", "dataInterpretation"],
    vignette:
      "34F presents to clinic with 3 months of fatigue, exertional dyspnea, and reduced exercise tolerance.",
    progressiveData: [
      "Hb 89 g/L",
      "MCV 72",
      "Ferritin low",
      "Periods reported as heavy",
    ],
    reasoningMap: [
      "Frame this as chronic microcytic anemia",
      "Prioritize iron deficiency and source identification",
      "Connect symptoms to degree and tempo of anemia",
    ],
    mustHit: [
      "Recognize iron deficiency anemia pattern",
      "Look for bleeding source, including gynecologic history",
      "Treat deficiency and address cause rather than iron alone",
    ],
    redFlags: [
      "Calling it nonspecific fatigue only",
      "Missing bleeding history",
      "Failing to plan follow-up response to therapy",
    ],
    evaluatorGuide: [
      "Does the resident identify the anemia pattern quickly?",
      "Do they ask why the iron is low?",
    ],
  },
  {
    key: "clinic-weight-loss-diabetes",
    title: "The Unintended Weight Loss",
    setting: "Outpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Do not reduce this to routine diabetes follow-up. The weight loss changes the question and urgency.",
    domainFocus: "Differential Diagnosis + Prioritization",
    targetDomains: ["differentialDiagnosis", "problemFraming", "anticipation"],
    vignette:
      "52M with polyuria, fatigue, and 7-kg unintentional weight loss over 4 months comes to clinic.",
    progressiveData: [
      "Random glucose 17.8 mmol/L",
      "A1c 11.2%",
      "No abdominal pain",
      "BMI 24",
    ],
    reasoningMap: [
      "Recognize symptomatic uncontrolled diabetes",
      "Assess for catabolic symptoms and severity",
      "Think beyond routine diabetes follow-up because of weight loss",
    ],
    mustHit: [
      "Identify symptomatic hyperglycemia needing prompt treatment",
      "Assess urgency and whether same-day escalation is needed",
      "Consider atypical features and whether further evaluation is required",
    ],
    redFlags: [
      "Treating as routine mild diabetes",
      "Ignoring weight loss significance",
      "No plan for close follow-up",
    ],
    evaluatorGuide: [
      "Does the resident separate stable outpatient care from urgent escalation?",
      "Do they contextualize weight loss?",
    ],
  },
  {
    key: "clinic-edema-proteinuria",
    title: "The Swollen Ankles",
    setting: "Outpatient",
    difficulty: 2,
    isTrap: false,
    trapMessage: "",
    domainFocus: "Syndrome Identification",
    targetDomains: ["syndromeIdentification", "dataInterpretation"],
    vignette:
      "48F presents with 2 months of leg swelling and frothy urine.",
    progressiveData: [
      "BP 148/92",
      "Urinalysis: 4+ protein",
      "Albumin low",
      "Creatinine near baseline",
    ],
    reasoningMap: [
      "Identify nephrotic syndrome pattern",
      "Move from symptom edema to syndrome recognition",
      "Plan confirmation and kidney-focused workup",
    ],
    mustHit: [
      "Recognize nephrotic syndrome",
      "Quantify proteinuria and assess kidney function",
      "Consider thrombosis risk and secondary causes",
    ],
    redFlags: [
      "Treating as venous insufficiency only",
      "Ignoring frothy urine",
      "Missing syndrome-level framing",
    ],
    evaluatorGuide: [
      "Does the resident name the syndrome before the etiology?",
      "Do they organize the workup logically?",
    ],
  },
  {
    key: "clinic-chest-pain-followup",
    title: "The Chest Pain Follow-up",
    setting: "Outpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Prior negative testing matters. Do not restart the whole testing cascade without a new reason.",
    domainFocus: "Diagnostic Precision + Safe De-escalation",
    targetDomains: ["differentialDiagnosis", "problemFraming", "anticipation"],
    vignette:
      "45M has intermittent chest pain after stress. It is sharp and worse with inspiration. He is seen in clinic after an unrevealing ED visit.",
    progressiveData: [
      "ECG normal",
      "Troponin normal",
      "CT negative for PE",
      "Pain reproducible on palpation",
    ],
    reasoningMap: [
      "Avoid premature closure on ACS but interpret prior negative testing appropriately",
      "Recognize likely non-cardiac chest pain",
      "De-escalate with explanation and return precautions",
    ],
    mustHit: [
      "Recognize likely musculoskeletal chest pain",
      "Avoid restarting unnecessary testing cascade",
      "Provide safety-net advice and follow-up plan",
    ],
    redFlags: [
      "Calling all chest pain anxiety",
      "Ignoring prior workup context",
      "Over-testing again without indication",
    ],
    evaluatorGuide: [
      "Can the resident safely reassure without being dismissive?",
      "Do they explain why the pain is low risk?",
    ],
  },
]]

function getGlobalRating(total) {
  if (total === 0) return "Unrated"
  if (total <= 9) return "Junior"
  if (total <= 15) return "Intermediate"
  if (total <= 20) return "Senior"
  return "Near Consultant"
}

function formatFirebaseDate(ts) {
  if (!ts) return ""
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString()
  if (ts instanceof Date) return ts.toLocaleString()
  return ""
}

function exportRowsAsCsv(filename, rows) {
  if (!rows.length) {
    window.alert("No data to export.")
    return
  }
  const headers = Object.keys(rows[0])
  const escapeCell = (value) => {
    const text = value == null ? "" : String(value)
    return '"' + text.replace(/"/g, '""') + '"'
  }
  const csv = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function flattenEvaluation(e) {
  const scores = e.scores || {}
  return {
    residentId: e.residentId || e.resident || "",
    residentLevel: e.residentLevel || "",
    caseKey: e.universalCaseKey || "",
    caseName: e.caseName || e.universalCaseTitle || "",
    sessionCode: e.sessionCode || "",
    sessionDay: e.sessionDay ?? "",
    caseIndex: e.caseIndex ?? "",
    phase: e.phase || "",
    recordType: e.recordType || "",
    startedAt: formatFirebaseDate(e.startedAt),
    submittedAt: formatFirebaseDate(e.createdAt),
    timeSeconds: e.timeSeconds ?? "",
    confidence: e.confidence ?? "",
    leadingDiagnosis: e.leadingDiagnosis || "",
    evaluator: e.evaluator || "",
    total: e.total ?? 0,
    globalRating: e.globalRating || "",
    problemFraming: scores.problemFraming ?? "",
    syndromeIdentification: scores.syndromeIdentification ?? "",
    differentialDiagnosis: scores.differentialDiagnosis ?? "",
    dataInterpretation: scores.dataInterpretation ?? "",
    anticipation: scores.anticipation ?? "",
    reassessment: scores.reassessment ?? "",
    traineeAnswer: e.traineeAnswer || "",
    errorTags: Array.isArray(e.errorTags) ? e.errorTags.join("; ") : "",
    evaluatorNotes: e.evaluatorNotes || "",
  }
}

const pageWrap = { minHeight: "100vh", background: "#f6f7fb", padding: "24px 16px 40px", fontFamily: "Arial, sans-serif", color: "#0f172a" }
const container = { maxWidth: 1320, margin: "0 auto" }
const card = { background: "#fff", border: "1px solid #dbe4ee", borderRadius: 16, padding: 18 }
const inputStyle = { width: "100%", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", boxSizing: "border-box", background: "#fff" }
const textareaStyle = { ...inputStyle, minHeight: 140, resize: "vertical" }
const buttonBase = { padding: "10px 14px", color: "white", border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer" }
const tabStyle = (active) => ({ padding: "10px 14px", borderRadius: 12, border: "none", fontWeight: 700, cursor: "pointer", background: active ? "#0f4c81" : "#dbe4ee", color: active ? "white" : "#0f172a" })

function MetricCard({ label, value, subtext }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800 }}>{value}</div>
      {subtext ? <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>{subtext}</div> : null}
    </div>
  )
}

function ResidentPortal(props) {
  const { residentId, sessionConfig, residentSessionCode, setResidentSessionCode, residentUnlocked, unlockResidentSession, releasedCase, alreadySubmitted, submitResidentAnswer, handleLogout, statusMessage } = props
  const [answer, setAnswer] = useState("")
  const [leadingDiagnosis, setLeadingDiagnosis] = useState("")
  const [confidence, setConfidence] = useState(50)

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={{ background: "linear-gradient(135deg, #0c4a6e, #0f766e)", color: "white", borderRadius: 18, padding: 22, marginBottom: 18 }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>Resident Portal · {residentId}</div>
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Resident Portal · {residentId}</div>
            <div style={{ color: "#475569", marginTop: 6 }}>Released-case access only. One-time submission. No case browsing.</div>
          </div>
          <button type="button" onClick={handleLogout} style={{ ...buttonBase, background: "#475569" }}>Logout</button>
        </div>

        {statusMessage ? <div style={{ ...card, marginBottom: 16, background: "#ecfeff" }}>{statusMessage}</div> : null}

        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Session code</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <input value={residentSessionCode} onChange={(e) => setResidentSessionCode(e.target.value)} style={inputStyle} />
            <button type="button" onClick={unlockResidentSession} style={{ ...buttonBase, background: "#0f766e" }}>Unlock</button>
          </div>
          <div style={{ marginTop: 10, color: residentUnlocked ? "#166534" : "#475569" }}>
            {residentUnlocked ? "Session unlocked." : sessionConfig?.isOpen ? "Session is open." : "Session is closed."}
          </div>
          <div style={{ marginTop: 10, color: "#64748b", fontSize: 13 }}>
            Session day: <strong>{sessionConfig?.sessionDay ?? "—"}</strong> · Phase: <strong>{sessionConfig?.phase || "—"}</strong> · Case index: <strong>{sessionConfig?.caseIndex ?? "—"}</strong>
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>Released Case</div>
          {!releasedCase ? (
            <div style={{ color: "#64748b" }}>No case has been released yet.</div>
          ) : (
            <>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{releasedCase.title} <span style={{ fontWeight: 400 }}>· {releasedCase.setting}</span></div>
              <div style={{ marginTop: 10, color: "#334155" }}>{releasedCase.domainFocus}</div>
              <div style={{ marginTop: 10 }}>{releasedCase.vignette}</div>
              <div style={{ marginTop: 12, fontWeight: 800 }}>Progressive data</div>
              <ul>{releasedCase.progressiveData.map((item) => <li key={item}>{item}</li>)}</ul>

              <div style={{ marginTop: 12, fontWeight: 800 }}>Leading diagnosis</div>
              <input value={leadingDiagnosis} onChange={(e) => setLeadingDiagnosis(e.target.value)} style={{ ...inputStyle, marginTop: 8 }} disabled={!residentUnlocked || alreadySubmitted} placeholder="Enter your leading diagnosis" />

              <div style={{ marginTop: 12, fontWeight: 800 }}>Confidence (0–100%)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: 10, alignItems: "center", marginTop: 8 }}>
                <input type="range" min="0" max="100" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))} disabled={!residentUnlocked || alreadySubmitted} />
                <div style={{ fontWeight: 800 }}>{confidence}%</div>
              </div>

              <div style={{ marginTop: 12, fontWeight: 800 }}>Your reasoning</div>
              <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Enter your framing, syndrome, prioritized differential, interpretation, and next steps." style={{ ...textareaStyle, marginTop: 8, minHeight: 180 }} disabled={!residentUnlocked || alreadySubmitted} />

              {alreadySubmitted ? <div style={{ marginTop: 12, color: "#166534", fontWeight: 700 }}>This resident already submitted this released case.</div> : null}

              <button type="button" onClick={() => submitResidentAnswer({ answer, leadingDiagnosis, confidence })} style={{ ...buttonBase, background: "#0f766e", marginTop: 16 }} disabled={!residentUnlocked || alreadySubmitted}>Submit Once</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [portal, setPortal] = useState(localStorage.getItem("crft_portal") || "")
  const [residentId, setResidentId] = useState(localStorage.getItem("crft_resident_id") || "R1")
  const [residentSessionCode, setResidentSessionCode] = useState("")
  const [residentUnlocked, setResidentUnlocked] = useState(false)
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPassword, setStaffPassword] = useState("")
  const [evaluations, setEvaluations] = useState([])
  const [sessionConfig, setSessionConfig] = useState(null)
  const [statusMessage, setStatusMessage] = useState("")
  const [activeStaffTab, setActiveStaffTab] = useState("session")
  const [activeDirectorTab, setActiveDirectorTab] = useState("leadership")
  const [sessionEditorCode, setSessionEditorCode] = useState("")
  const [sessionEditorOpen, setSessionEditorOpen] = useState(false)
  const [sessionEditorCaseKey, setSessionEditorCaseKey] = useState("")
  const [sessionEditorDay, setSessionEditorDay] = useState(1)
  const [sessionEditorPhase, setSessionEditorPhase] = useState("no_feedback")
  const [sessionEditorCaseIndex, setSessionEditorCaseIndex] = useState(1)
  const [scoringRecordId, setScoringRecordId] = useState("")
  const [scoringEvaluator, setScoringEvaluator] = useState("")
  const [scoringNotes, setScoringNotes] = useState("")
  const [scoringScores, setScoringScores] = useState({ ...initialScores })
  const [scoringErrorTags, setScoringErrorTags] = useState([])

  useEffect(() => {
    const unsub = watchAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    const unsubSession = subscribeSessionConfig((data) => {
      setSessionConfig(data || null)
      setSessionEditorCode(data?.sessionCode || "")
      setSessionEditorOpen(Boolean(data?.isOpen))
      setSessionEditorCaseKey(data?.releasedCaseKey || data?.activeCase || "")
      setSessionEditorDay(Number(data?.sessionDay || 1))
      setSessionEditorPhase(data?.phase || "no_feedback")
      setSessionEditorCaseIndex(Number(data?.caseIndex || 1))
    })
    return () => unsubSession()
  }, [user])

  useEffect(() => {
    if (!user || portal === "resident") return
    const unsub = subscribeEvaluations((rows) => setEvaluations(rows || []))
    return () => unsub()
  }, [user, portal])

  useEffect(() => {
    if (!statusMessage) return
    const t = setTimeout(() => setStatusMessage(""), 2500)
    return () => clearTimeout(t)
  }, [statusMessage])

  const releasedCaseKey = sessionConfig?.releasedCaseKey || sessionConfig?.activeCase || ""
  const releasedCase = useMemo(() => universalCases.find((c) => c.key === releasedCaseKey) || null, [releasedCaseKey])
  const currentSession = sessionConfig?.sessionCode || ""
  const residentSubmitKey = `crft_submitted_${residentId}_${currentSession}_${releasedCaseKey}`
  const residentStartKey = `crft_started_${residentId}_${currentSession}_${releasedCaseKey}`
  const alreadySubmitted = Boolean(localStorage.getItem(residentSubmitKey))

  const unratedSubmissions = useMemo(() => evaluations.filter((e) => (e.recordType || "") === "resident_submission" || (e.globalRating || "") === "Unrated").sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)), [evaluations])

  const leadershipMetrics = useMemo(() => {
    const totalAssessments = evaluations.length
    const totals = evaluations.map((e) => Number(e.total || 0)).filter((x) => !Number.isNaN(x))
    const avgScore = totals.length ? (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1) : "0.0"
    const avgByDomain = domains.map((d) => {
      const values = evaluations.map((e) => Number(e.scores?.[d.key] || 0))
      const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0
      return { key: d.key, title: d.title, avg: avg.toFixed(2) }
    })
    const weakest = [...avgByDomain].sort((a, b) => Number(a.avg) - Number(b.avg))[0]
    const residentMap = {}
    evaluations.forEach((e) => {
      const id = e.residentId || e.resident || "Unknown"
      if (!residentMap[id]) residentMap[id] = []
      residentMap[id].push(Number(e.total || 0))
    })
    const riskResidents = Object.entries(residentMap).map(([id, scores]) => {
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
      const trend = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0
      let flag = "Stable"
      if (avg < 10) flag = "High risk"
      else if (avg < 14 || trend < 0) flag = "Watch"
      return { id, avg: avg.toFixed(1), trend, flag }
    }).sort((a, b) => Number(a.avg) - Number(b.avg))
    return { totalAssessments, avgScore, weakest, riskResidents, avgByDomain }
  }, [evaluations])

  const handleResidentLogin = async () => {
    try {
      await signInResident()
      localStorage.setItem("crft_portal", "resident")
      localStorage.setItem("crft_resident_id", residentId)
      setPortal("resident")
    } catch (e) {
      console.error(e)
      alert("Resident login failed.")
    }
  }

  const handleStaffLogin = async (targetPortal) => {
    try {
      await signInEvaluator(staffEmail, staffPassword)
      localStorage.setItem("crft_portal", targetPortal)
      setPortal(targetPortal)
    } catch (e) {
      console.error(e)
      alert("Login failed.")
    }
  }

  const handleLogout = async () => {
    await logOut()
    localStorage.removeItem("crft_portal")
    setPortal("")
    setResidentUnlocked(false)
    setResidentSessionCode("")
  }

  const unlockResidentSession = () => {
    const expected = sessionConfig?.sessionCode || ""
    if (!sessionConfig?.isOpen) return alert("Session is closed.")
    if (!residentSessionCode.trim()) return alert("Enter the session code.")
    if (residentSessionCode.trim() !== expected) return alert("Wrong session code.")
    if (!localStorage.getItem(residentStartKey)) localStorage.setItem(residentStartKey, String(Date.now()))
    setResidentUnlocked(true)
  }

  const submitResidentAnswer = async ({ answer, leadingDiagnosis, confidence }) => {
    if (!releasedCase) return alert("No released case.")
    if (!residentUnlocked) return alert("Unlock the session first.")
    if (alreadySubmitted) return alert("This resident already submitted this released case.")
    if (!answer.trim()) return alert("Enter reasoning before submitting.")
    if (!leadingDiagnosis.trim()) return alert("Enter a leading diagnosis.")

    const startedAtMs = Number(localStorage.getItem(residentStartKey) || Date.now())
    const nowMs = Date.now()
    const payload = {
      recordType: "resident_submission",
      residentId,
      resident: residentId,
      residentLevel: residentId,
      caseName: releasedCase.title,
      universalCaseKey: releasedCase.key,
      universalCaseTitle: releasedCase.title,
      universalCaseSetting: releasedCase.setting,
      sessionCode: sessionConfig?.sessionCode || "",
      sessionDay: Number(sessionConfig?.sessionDay || 1),
      phase: sessionConfig?.phase || "no_feedback",
      caseIndex: Number(sessionConfig?.caseIndex || 1),
      evaluator: "",
      globalRating: "Unrated",
      total: 0,
      scores: { ...initialScores },
      traineeAnswer: answer.trim(),
      leadingDiagnosis: leadingDiagnosis.trim(),
      confidence: Number(confidence),
      timeSeconds: Math.max(1, Math.round((nowMs - startedAtMs) / 1000)),
      startedAt: new Date(startedAtMs),
      errorTags: [],
      evaluatorNotes: "",
    }
    try {
      await createEvaluation(payload)
      localStorage.setItem(residentSubmitKey, "1")
      setStatusMessage("Submission saved.")
      window.location.reload()
    } catch (e) {
      console.error(e)
      alert("Submission failed.")
    }
  }

  const saveSessionControl = async () => {
    try {
      await saveSessionConfig({
        sessionCode: sessionEditorCode.trim(),
        isOpen: sessionEditorOpen,
        releasedCaseKey: sessionEditorCaseKey || "",
        activeCase: sessionEditorCaseKey || "",
        sessionDay: Number(sessionEditorDay || 1),
        phase: sessionEditorPhase || "no_feedback",
        caseIndex: Number(sessionEditorCaseIndex || 1),
      })
      setStatusMessage("Session settings saved.")
    } catch (e) {
      console.error(e)
      alert("Failed to save session settings.")
    }
  }

  const loadIntoScoringWorkspace = (record) => {
    setScoringRecordId(record.id)
    setScoringEvaluator(record.evaluator || (user?.email || ""))
    setScoringNotes(record.evaluatorNotes || "")
    setScoringScores({
      problemFraming: Number(record.scores?.problemFraming || 0),
      syndromeIdentification: Number(record.scores?.syndromeIdentification || 0),
      differentialDiagnosis: Number(record.scores?.differentialDiagnosis || 0),
      dataInterpretation: Number(record.scores?.dataInterpretation || 0),
      anticipation: Number(record.scores?.anticipation || 0),
      reassessment: Number(record.scores?.reassessment || 0),
    })
    setScoringErrorTags(Array.isArray(record.errorTags) ? record.errorTags : [])
    setActiveStaffTab("scoring")
    setStatusMessage("Loaded into scoring workspace.")
  }

  const selectedScoringRecord = useMemo(() => evaluations.find((e) => e.id === scoringRecordId) || null, [evaluations, scoringRecordId])
  const scoringTotal = useMemo(() => Object.values(scoringScores).reduce((sum, value) => sum + Number(value || 0), 0), [scoringScores])

  const toggleErrorTag = (tag) => {
    setScoringErrorTags((prev) => prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag])
  }

  const saveScoring = async () => {
    if (!selectedScoringRecord) return alert("Load a submission first.")
    try {
      await updateEvaluation(selectedScoringRecord.id, {
        scores: { ...scoringScores },
        total: scoringTotal,
        globalRating: getGlobalRating(scoringTotal),
        evaluator: scoringEvaluator || user?.email || "",
        evaluatorNotes: scoringNotes,
        errorTags: scoringErrorTags,
        recordType: "scored_evaluation",
      })
      setStatusMessage("Scores saved.")
    } catch (e) {
      console.error(e)
      alert("Failed to save scores.")
    }
  }

  const handleDeleteEvaluation = async (id) => {
    const ok = window.confirm("Delete this evaluation?")
    if (!ok) return
    try {
      await removeEvaluation(id)
      setStatusMessage("Evaluation deleted.")
    } catch (e) {
      console.error(e)
      alert("Delete failed.")
    }
  }

  const exportAll = () => exportRowsAsCsv("crft_all_evaluations.csv", evaluations.map(flattenEvaluation))
  const exportCurrentSession = () => exportRowsAsCsv(`crft_session_${currentSession || "unknown"}.csv`, evaluations.filter((e) => (e.sessionCode || "") === currentSession).map(flattenEvaluation))
  const exportResident = (rid) => exportRowsAsCsv(`crft_${rid}.csv`, evaluations.filter((e) => (e.residentId || e.resident) === rid).map(flattenEvaluation))

  if (!user || !portal) {
    return (
      <div style={pageWrap}>
        <div style={container}>
          <div style={{ background: "linear-gradient(135deg, #0c4a6e, #0f766e)", color: "white", borderRadius: 18, padding: 22, marginBottom: 18 }}>
            <h1 style={{ margin: 0 }}>CRFT</h1>
            <div style={{ marginTop: 6 }}>Clinical Reasoning Feedback Tool</div>
            <div style={{ marginTop: 8, opacity: 0.9, fontSize: 13 }}>{appUrl}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Resident access</h2>
              <div style={{ marginBottom: 10 }}>For controlled data collection only.</div>
              <label><strong>Resident ID</strong></label>
              <select value={residentId} onChange={(e) => setResidentId(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}>
                {["R1", "R2", "R3", "R4", "R5"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" onClick={handleResidentLogin} style={{ ...buttonBase, background: "#0f766e", marginTop: 12, width: "100%" }}>Enter as Resident</button>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Evaluator access</h2>
              <label><strong>Email</strong></label>
              <input value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
              <label style={{ display: "block", marginTop: 10 }}><strong>Password</strong></label>
              <input type="password" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
              <button type="button" onClick={() => handleStaffLogin("evaluator")} style={{ ...buttonBase, background: "#2563eb", marginTop: 12, width: "100%" }}>Login as Evaluator</button>
            </div>

            <div style={card}>
              <h2 style={{ marginTop: 0 }}>Program Director access</h2>
              <div style={{ color: "#475569", marginBottom: 12 }}>Uses the same email/password authentication path with a different portal view.</div>
              <button type="button" onClick={() => handleStaffLogin("director")} style={{ ...buttonBase, background: "#7c3aed", width: "100%" }}>Login as Program Director</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (portal === "resident") {
    return <ResidentPortal residentId={residentId} sessionConfig={sessionConfig} residentSessionCode={residentSessionCode} setResidentSessionCode={setResidentSessionCode} residentUnlocked={residentUnlocked} unlockResidentSession={unlockResidentSession} releasedCase={releasedCase} alreadySubmitted={alreadySubmitted} submitResidentAnswer={submitResidentAnswer} handleLogout={handleLogout} statusMessage={statusMessage} />
  }

  const isEvaluator = portal === "evaluator"
  const isDirector = portal === "director"

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={{ background: "linear-gradient(135deg, #0c4a6e, #0f766e)", color: "white", borderRadius: 18, padding: 22, marginBottom: 18 }}>
          <div style={{ fontSize: 30, fontWeight: 800 }}>{isEvaluator ? "Evaluator Portal" : "Program Director Portal"}</div>
        </div>

        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800 }}>{isEvaluator ? "Evaluator" : "Program Director"} · {user?.email || ""}</div>
            <div style={{ marginTop: 6, color: "#64748b" }}>Session control, scoring, logs, exports, and program oversight.</div>
          </div>
          <button type="button" onClick={handleLogout} style={{ ...buttonBase, background: "#475569" }}>Logout</button>
        </div>

        {statusMessage ? <div style={{ ...card, marginBottom: 16, background: "#ecfeff" }}>{statusMessage}</div> : null}

        {isEvaluator && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button type="button" style={tabStyle(activeStaffTab === "session")} onClick={() => setActiveStaffTab("session")}>Session Control</button>
              <button type="button" style={tabStyle(activeStaffTab === "scoring")} onClick={() => setActiveStaffTab("scoring")}>Scoring Workspace</button>
              <button type="button" style={tabStyle(activeStaffTab === "log")} onClick={() => setActiveStaffTab("log")}>Assessment Log</button>
              <button type="button" style={tabStyle(activeStaffTab === "profiles")} onClick={() => setActiveStaffTab("profiles")}>Resident Profiles</button>
            </div>

            {activeStaffTab === "session" && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Session Control</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
                  <div><label><strong>Session code</strong></label><input value={sessionEditorCode} onChange={(e) => setSessionEditorCode(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} /></div>
                  <div><label><strong>Released case</strong></label><select value={sessionEditorCaseKey} onChange={(e) => setSessionEditorCaseKey(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}><option value="">Select case</option>{universalCases.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}</select></div>
                  <div><label><strong>Session status</strong></label><select value={sessionEditorOpen ? "open" : "closed"} onChange={(e) => setSessionEditorOpen(e.target.value === "open")} style={{ ...inputStyle, marginTop: 6 }}><option value="open">Open</option><option value="closed">Closed</option></select></div>
                  <div><label><strong>Session day</strong></label><input type="number" min="1" max="10" value={sessionEditorDay} onChange={(e) => setSessionEditorDay(Number(e.target.value))} style={{ ...inputStyle, marginTop: 6 }} /></div>
                  <div><label><strong>Phase</strong></label><select value={sessionEditorPhase} onChange={(e) => setSessionEditorPhase(e.target.value)} style={{ ...inputStyle, marginTop: 6 }}><option value="no_feedback">no_feedback</option><option value="feedback">feedback</option></select></div>
                  <div><label><strong>Case index</strong></label><input type="number" min="1" max="10" value={sessionEditorCaseIndex} onChange={(e) => setSessionEditorCaseIndex(Number(e.target.value))} style={{ ...inputStyle, marginTop: 6 }} /></div>
                </div>
                <div style={{ marginTop: 14, color: "#475569" }}>Live: code <strong>{sessionConfig?.sessionCode || "—"}</strong> · case <strong>{releasedCase?.title || "—"}</strong> · {sessionConfig?.isOpen ? "Open" : "Closed"} · day <strong>{sessionConfig?.sessionDay ?? "—"}</strong> · phase <strong>{sessionConfig?.phase || "—"}</strong> · case index <strong>{sessionConfig?.caseIndex ?? "—"}</strong></div>
                <button type="button" onClick={saveSessionControl} style={{ ...buttonBase, background: "#0f766e", marginTop: 16 }}>Save Session Settings</button>
              </div>
            )}

            {activeStaffTab === "scoring" && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(360px,1.1fr) minmax(340px,0.9fr)", gap: 16 }}>
                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>Scoring Workspace</h2>
                  {!selectedScoringRecord ? <div style={{ color: "#64748b" }}>Load a submission from the assessment log first.</div> : (
                    <>
                      <div style={{ marginBottom: 8 }}><strong>Resident:</strong> {selectedScoringRecord.residentId || selectedScoringRecord.resident}</div>
                      <div style={{ marginBottom: 8 }}><strong>Case:</strong> {selectedScoringRecord.caseName}</div>
                      <div style={{ marginBottom: 8 }}><strong>Session:</strong> {selectedScoringRecord.sessionCode || "—"}</div>
                      <div style={{ marginBottom: 8 }}><strong>Session day:</strong> {selectedScoringRecord.sessionDay ?? "—"} · <strong>Phase:</strong> {selectedScoringRecord.phase || "—"} · <strong>Case index:</strong> {selectedScoringRecord.caseIndex ?? "—"}</div>
                      <div style={{ marginBottom: 8 }}><strong>Started:</strong> {formatFirebaseDate(selectedScoringRecord.startedAt)}</div>
                      <div style={{ marginBottom: 8 }}><strong>Submitted:</strong> {formatFirebaseDate(selectedScoringRecord.createdAt)}</div>
                      <div style={{ marginBottom: 8 }}><strong>Time:</strong> {selectedScoringRecord.timeSeconds ?? "—"} sec</div>
                      <div style={{ marginBottom: 8 }}><strong>Leading diagnosis:</strong> {selectedScoringRecord.leadingDiagnosis || "—"}</div>
                      <div style={{ marginBottom: 8 }}><strong>Confidence:</strong> {selectedScoringRecord.confidence ?? "—"}%</div>
                      <div style={{ marginTop: 12, fontWeight: 800 }}>Resident answer</div>
                      <div style={{ marginTop: 8, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, whiteSpace: "pre-wrap" }}>{selectedScoringRecord.traineeAnswer || "—"}</div>
                      <div style={{ marginTop: 14 }}><label><strong>Evaluator</strong></label><input value={scoringEvaluator} onChange={(e) => setScoringEvaluator(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} /></div>
                      <div style={{ marginTop: 14 }}><label><strong>Evaluator notes</strong></label><textarea value={scoringNotes} onChange={(e) => setScoringNotes(e.target.value)} style={{ ...textareaStyle, marginTop: 6, minHeight: 110 }} /></div>
                    </>
                  )}
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>CRFT Domain Scoring</h2>
                  <div style={{ display: "grid", gap: 12 }}>
                    {domains.map((d) => (
                      <div key={d.key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><strong>{d.title}</strong><span>{scoringScores[d.key]}/4</span></div>
                        <select value={scoringScores[d.key]} onChange={(e) => setScoringScores((prev) => ({ ...prev, [d.key]: Number(e.target.value) }))} style={inputStyle}>{[0,1,2,3,4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Error tags</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {errorTagOptions.map((tag) => (
                        <label key={tag} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={scoringErrorTags.includes(tag)} onChange={() => toggleErrorTag(tag)} />
                          <span>{tag}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                    <div><strong>Total:</strong> {scoringTotal}/24</div>
                    <div style={{ marginTop: 6 }}><strong>Rating:</strong> {getGlobalRating(scoringTotal)}</div>
                  </div>

                  <button type="button" onClick={saveScoring} style={{ ...buttonBase, background: "#0f766e", marginTop: 16, width: "100%" }}>Save Scores</button>
                </div>
              </div>
            )}

            {activeStaffTab === "log" && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Assessment Log</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {unratedSubmissions.map((e) => (
                    <div key={e.id} style={{ border: "1px solid #dbe4ee", borderRadius: 14, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 800 }}>{e.residentId || e.resident} · {e.caseName}</div>
                          <div style={{ marginTop: 6, color: "#64748b" }}>{formatFirebaseDate(e.createdAt)} · session {e.sessionCode || "—"} · day {e.sessionDay ?? "—"} · {e.phase || "—"} · case {e.caseIndex ?? "—"}</div>
                          <div style={{ marginTop: 8 }}><strong>Leading diagnosis:</strong> {e.leadingDiagnosis || "—"} · <strong>Confidence:</strong> {e.confidence ?? "—"}% · <strong>Time:</strong> {e.timeSeconds ?? "—"} sec</div>
                          <div style={{ marginTop: 10 }}><strong>Resident answer:</strong> {e.traineeAnswer || "—"}</div>
                        </div>
                        <div style={{ background: "#991b1b", color: "white", borderRadius: 999, padding: "8px 12px", fontWeight: 800 }}>{e.total || 0}/24 · {e.globalRating || "Unrated"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                        <button type="button" onClick={() => loadIntoScoringWorkspace(e)} style={{ ...buttonBase, background: "#2563eb" }}>Load</button>
                        <button type="button" onClick={() => handleDeleteEvaluation(e.id)} style={{ ...buttonBase, background: "#dc2626" }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeStaffTab === "profiles" && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Resident Profiles</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12 }}>
                  {["R1", "R2", "R3", "R4", "R5"].map((rid) => {
                    const rows = evaluations.filter((e) => (e.residentId || e.resident) === rid)
                    const avg = rows.length ? (rows.reduce((sum, row) => sum + Number(row.total || 0), 0) / rows.length).toFixed(1) : "0.0"
                    return <div key={rid} style={{ border: "1px solid #dbe4ee", borderRadius: 14, padding: 14 }}><div style={{ fontWeight: 800 }}>{rid}</div><div style={{ marginTop: 6 }}>Assessments: {rows.length}</div><div>Average total: {avg}/24</div></div>
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {isDirector && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <button type="button" style={tabStyle(activeDirectorTab === "leadership")} onClick={() => setActiveDirectorTab("leadership")}>Leadership Dashboard</button>
              <button type="button" style={tabStyle(activeDirectorTab === "intelligence")} onClick={() => setActiveDirectorTab("intelligence")}>Program Intelligence</button>
              <button type="button" style={tabStyle(activeDirectorTab === "reports")} onClick={() => setActiveDirectorTab("reports")}>Reports / Exports</button>
            </div>

            {activeDirectorTab === "leadership" && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
                  <MetricCard label="Total assessments" value={leadershipMetrics.totalAssessments} />
                  <MetricCard label="Average CRFT score" value={`${leadershipMetrics.avgScore}/24`} />
                  <MetricCard label="Weakest domain" value={leadershipMetrics.weakest?.title || "—"} subtext={leadershipMetrics.weakest ? `Average ${leadershipMetrics.weakest.avg}/4` : ""} />
                  <MetricCard label="Residents needing attention" value={leadershipMetrics.riskResidents.filter((r) => r.flag !== "Stable").length} />
                </div>

                <div style={card}>
                  <h2 style={{ marginTop: 0 }}>Residents needing attention</h2>
                  <div style={{ display: "grid", gap: 10 }}>
                    {leadershipMetrics.riskResidents.map((r) => (
                      <div key={r.id} style={{ display: "grid", gridTemplateColumns: "140px 140px 120px 1fr", gap: 10, padding: 12, borderBottom: "1px solid #e2e8f0" }}>
                        <div><strong>{r.id}</strong></div>
                        <div>Avg: {r.avg}/24</div>
                        <div>Trend: {r.trend > 0 ? `+${r.trend}` : r.trend}</div>
                        <div>{r.flag}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeDirectorTab === "intelligence" && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Program Intelligence</h2>
                <div style={{ display: "grid", gap: 12 }}>
                  {leadershipMetrics.avgByDomain.map((d) => {
                    const val = Number(d.avg)
                    const color = val < 2 ? "#dc2626" : val < 3 ? "#d97706" : "#16a34a"
                    return (
                      <div key={d.key} style={{ display: "grid", gridTemplateColumns: "220px 1fr 80px", gap: 10, alignItems: "center" }}>
                        <div><strong>{d.title}</strong></div>
                        <div style={{ width: "100%", height: 14, background: "#e5e7eb", borderRadius: 999 }}>
                          <div style={{ width: `${Math.min((val / 4) * 100, 100)}%`, height: "100%", borderRadius: 999, background: color }} />
                        </div>
                        <div>{d.avg}/4</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeDirectorTab === "reports" && (
              <div style={card}>
                <h2 style={{ marginTop: 0 }}>Reports / Exports</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button type="button" onClick={exportAll} style={{ ...buttonBase, background: "#0f766e" }}>Export All CSV</button>
                  <button type="button" onClick={exportCurrentSession} style={{ ...buttonBase, background: "#2563eb" }}>Export Current Session CSV</button>
                  {["R1", "R2", "R3", "R4", "R5"].map((rid) => <button key={rid} type="button" onClick={() => exportResident(rid)} style={{ ...buttonBase, background: "#7c3aed" }}>Export {rid}</button>)}
                </div>
                <div style={{ marginTop: 16, color: "#64748b" }}>Export includes session day, phase, case index, timing, confidence, leading diagnosis, CRFT scores, error tags, and evaluator notes.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
