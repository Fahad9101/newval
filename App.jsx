
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
  subscribeSessionConfig,
  saveSessionConfig,
} from "./firebase"

const appUrl = "https://fahad9101.github.io/CRFT/"
const RESIDENT_IDS = ["R1", "R2", "R3", "R4", "R5"]

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
  {
    key: "clinic-resistant-pressure",
    title: "The Difficult Blood Pressure Visit",
    setting: "Outpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Uncontrolled clinic blood pressure is not automatically true resistant hypertension.",
    domainFocus: "Data Interpretation + Reframing",
    targetDomains: ["dataInterpretation", "problemFraming", "reassessment"],
    vignette:
      "63M is referred for uncontrolled hypertension despite 3 medications.",
    progressiveData: [
      "Clinic BP 168/96",
      "Home readings not available",
      "Current meds: amlodipine, losartan, hydrochlorothiazide",
      "NSAID use for knee pain",
    ],
    reasoningMap: [
      "Confirm whether this is true resistant hypertension",
      "Assess adherence, measurement accuracy, and contributors",
      "Review drugs that worsen blood pressure",
    ],
    mustHit: [
      "Do not label resistant hypertension too early",
      "Check home or ambulatory measurements if feasible",
      "Identify contributing medications and lifestyle factors",
    ],
    redFlags: [
      "Escalating drugs without confirming diagnosis",
      "Ignoring NSAID contribution",
      "No attention to BP technique",
    ],
    evaluatorGuide: [
      "Does the resident verify the problem before intensifying therapy?",
      "Do they look for pseudo-resistance?",
    ],
  },
  {
    key: "clinic-high-calcium",
    title: "The Incidental High Calcium",
    setting: "Outpatient",
    difficulty: 3,
    isTrap: true,
    trapMessage: "Not every elevated calcium needs emergency treatment. First determine severity, symptoms, and physiology.",
    domainFocus: "Problem Framing + Focused Differential",
    targetDomains: ["problemFraming", "dataInterpretation", "differentialDiagnosis"],
    vignette:
      "58F is referred after routine labs show elevated calcium. She reports constipation and mild fatigue.",
    progressiveData: [
      "Calcium mildly elevated on repeat test",
      "Creatinine normal",
      "PTH inappropriately normal-high",
      "No acute symptoms",
    ],
    reasoningMap: [
      "Confirm true hypercalcemia and severity",
      "Use PTH to organize the differential",
      "Distinguish outpatient evaluation from emergency hypercalcemia care",
    ],
    mustHit: [
      "Recognize likely PTH-mediated hypercalcemia",
      "Assess severity and symptoms before deciding urgency",
      "Plan focused outpatient workup and follow-up",
    ],
    redFlags: [
      "Treating a stable outpatient as hypercalcemic crisis",
      "Ignoring repeat confirmation",
      "Not organizing causes by PTH status",
    ],
    evaluatorGuide: [
      "Does the resident use physiology to structure the differential?",
      "Do they match intensity of workup to urgency?",
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

const initialWhatChanged = {
  clinicalStatus: "",
  overnightEvents: "",
  vitalsTrend: "",
  labsTrend: "",
  imagingProcedures: "",
  consultantChanges: "",
  dischargeBarriers: "",
  stillOnEDD: "unknown",
}

const initialForm = {
  resident: "",
  residentId: "",
  evaluator: "",
  rotation: "",
  caseName: "",
  scores: initialScores,
  whatChanged: initialWhatChanged,
  structuredReasoning: "",
  traineeAnswer: "",
}

function getGlobalRating(total) {
  if (total === 0) return ""
  if (total <= 9) return "Junior"
  if (total <= 15) return "Intermediate"
  if (total <= 20) return "Senior"
  return "Near Consultant"
}

function formatFirebaseDate(ts) {
  if (!ts) return ""
  if (typeof ts?.seconds === "number") return new Date(ts.seconds * 1000).toLocaleString()
  return ""
}

function average(values) {
  if (!values.length) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

function safeLower(value) {
  return String(value || "").trim().toLowerCase()
}


function normalizeSessionConfig(raw) {
  const value = raw || {}
  const releasedCaseKey = value.releasedCaseKey || value.activeCase || ""
  const releasedCaseTitle =
    value.releasedCaseTitle ||
    universalCases.find((item) => item.key === releasedCaseKey)?.title ||
    ""
  return {
    isOpen: Boolean(value.isOpen),
    sessionCode: value.sessionCode || "",
    releasedCaseKey,
    releasedCaseTitle,
  }
}

function card(bg = "#fff") {
  return {
    background: bg,
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
  }
}

const pageWrap = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "24px 16px 40px",
  fontFamily: "Arial, sans-serif",
  color: "#0f172a",
}

const container = {
  maxWidth: 1320,
  margin: "0 auto",
}

const hero = {
  background: "linear-gradient(135deg, #0c4a6e, #0f766e)",
  color: "white",
  borderRadius: 24,
  padding: 22,
  marginBottom: 18,
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
}

const buttonBase = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 12,
  color: "white",
  cursor: "pointer",
  fontWeight: 700,
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  marginTop: 6,
  background: "white",
}

function TopNav({ items, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          style={{
            ...buttonBase,
            background: active === item ? "#0c4a6e" : "#cbd5e1",
            color: active === item ? "white" : "#0f172a",
          }}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function KPIGrid({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
      {items.map((item) => (
        <div key={item.label} style={card()}>
          <div style={{ fontSize: 13, color: "#475569", marginBottom: 8 }}>{item.label}</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{item.value}</div>
          {item.note ? <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>{item.note}</div> : null}
        </div>
      ))}
    </div>
  )
}

function ScoreBadge({ total, rating }) {
  const bg = total >= 21 ? "#065f46" : total >= 16 ? "#0369a1" : total >= 10 ? "#b45309" : "#991b1b"
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: bg, color: "white", fontWeight: 700 }}>
      <span>{total}/24</span>
      <span style={{ opacity: 0.9 }}>·</span>
      <span>{rating || "Unrated"}</span>
    </div>
  )
}

function DomainHeatmap({ avgByDomain }) {
  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>Program Cognitive Heatmap</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {domains.map((domain) => {
          const value = Number(avgByDomain?.[domain.key] || 0)
          const bg = value < 2 ? "#fee2e2" : value < 3 ? "#fef3c7" : "#dcfce7"
          const tone = value < 2 ? "#991b1b" : value < 3 ? "#92400e" : "#166534"
          return (
            <div key={domain.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", padding: 12, borderRadius: 12, background: bg, color: tone }}>
              <div>
                <div style={{ fontWeight: 700 }}>{domain.title}</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{domain.clue}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{value.toFixed(2)}/4</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SimpleLineChart({ points, title }) {
  if (!points.length) {
    return <div style={card()}><h3 style={{ marginTop: 0 }}>{title}</h3><div style={{ color: "#64748b" }}>No trend data yet.</div></div>
  }

  const width = 780
  const height = 240
  const pad = 30
  const maxY = Math.max(24, ...points.map((p) => Number(p.value || 0)))
  const minY = 0
  const stepX = points.length > 1 ? (width - pad * 2) / (points.length - 1) : 0

  const coords = points.map((p, i) => {
    const x = pad + i * stepX
    const y = height - pad - ((Number(p.value || 0) - minY) / (maxY - minY || 1)) * (height - pad * 2)
    return [x, y]
  })

  const path = coords.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt[0]} ${pt[1]}`).join(" ")

  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ overflowX: "auto" }}>
        <svg width={width} height={height}>
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" />
          <path d={path} fill="none" stroke="#0c4a6e" strokeWidth="3" />
          {coords.map((pt, i) => (
            <g key={points[i].label}>
              <circle cx={pt[0]} cy={pt[1]} r="4" fill="#0c4a6e" />
              <text x={pt[0]} y={height - 8} textAnchor="middle" fontSize="11" fill="#475569">{points[i].label}</text>
              <text x={pt[0]} y={pt[1] - 10} textAnchor="middle" fontSize="11" fill="#0f172a">{points[i].value}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

function ResidentSubmissionPanel({
  residentId,
  sessionCodeInput,
  setSessionCodeInput,
  sessionConfig,
  releasedCase,
  existingSubmission,
  onSignOut,
  onSubmit,
  answer,
  setAnswer,
  canAccess,
}) {
  const isOpen = Boolean(sessionConfig?.isOpen)
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={card("#eff6ff")}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginTop: 0, marginBottom: 6 }}>Resident Portal · {residentId || "Select ID"}</h2>
            <div style={{ color: "#475569" }}>Released-case access only. One-time submission. No case browsing.</div>
          </div>
          <button onClick={onSignOut} style={{ ...buttonBase, background: "#475569" }}>Logout</button>
        </div>
      </div>

      <div style={card()}>
        <label><strong>Session code</strong></label>
        <input value={sessionCodeInput} onChange={(e) => setSessionCodeInput(e.target.value)} placeholder="Enter today's session code" style={inputStyle} />
        <div style={{ marginTop: 8, fontSize: 13, color: canAccess ? "#166534" : "#64748b" }}>
          {canAccess ? "Session unlocked." : isOpen ? "Enter the correct active session code to access the released case." : "Session is currently closed."}
        </div>
      </div>

      <div style={card()}>
        <h3 style={{ marginTop: 0 }}>Released Case</h3>
        {!releasedCase ? (
          <div style={{ color: "#64748b" }}>No case has been released yet.</div>
        ) : !canAccess ? (
          <div style={{ color: "#64748b" }}>Case is hidden until the session is open and the correct code is entered.</div>
        ) : existingSubmission ? (
          <div style={{ padding: 14, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" }}>
            Submitted successfully. This case is now locked for {residentId}.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              <div><strong>{releasedCase.title}</strong> · {releasedCase.setting}</div>
              <div style={{ color: "#475569" }}>{releasedCase.domainFocus}</div>
              <div>{releasedCase.vignette}</div>
              <div>
                <strong>Progressive data</strong>
                <ul style={{ marginBottom: 0 }}>
                  {releasedCase.progressiveData.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <label><strong>Your reasoning</strong></label>
              <textarea
                rows={10}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Enter your one-line framing, syndrome/physiology, prioritized differential, interpretation, and next steps."
                style={{ ...inputStyle, minHeight: 220 }}
              />
            </div>

            <button
              onClick={onSubmit}
              style={{ ...buttonBase, background: "#0f766e", marginTop: 12 }}
            >
              Submit Once
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SessionControlPanel({ sessionConfig, setDraft, draft, onSave, cases }) {
  const liveCase = cases.find((item) => item.key === sessionConfig?.releasedCaseKey)
  return (
    <div style={card()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 6 }}>Session Control</h3>
          <div style={{ color: "#475569" }}>Change the code, release one case, then open or close the session without touching Firebase.</div>
        </div>
        <div style={{
          padding: "8px 12px",
          borderRadius: 999,
          background: sessionConfig?.isOpen ? "#dcfce7" : "#fee2e2",
          color: sessionConfig?.isOpen ? "#166534" : "#991b1b",
          fontWeight: 700,
        }}>
          {sessionConfig?.isOpen ? "LIVE · OPEN" : "LIVE · CLOSED"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 }}>
        <div>
          <label><strong>Session code</strong></label>
          <input value={draft.sessionCode || ""} onChange={(e) => setDraft((prev) => ({ ...prev, sessionCode: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label><strong>Release case</strong></label>
          <select value={draft.releasedCaseKey || ""} onChange={(e) => setDraft((prev) => ({ ...prev, releasedCaseKey: e.target.value }))} style={inputStyle}>
            <option value="">Select case</option>
            {cases.map((caseItem) => <option key={caseItem.key} value={caseItem.key}>{caseItem.title} · {caseItem.setting}</option>)}
          </select>
          <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>Stored key: {draft.releasedCaseKey || "—"}</div>
        </div>
        <div>
          <label><strong>Session status</strong></label>
          <select value={draft.isOpen ? "open" : "closed"} onChange={(e) => setDraft((prev) => ({ ...prev, isOpen: e.target.value === "open" }))} style={inputStyle}>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Live code</div>
          <div style={{ fontWeight: 800 }}>{sessionConfig?.sessionCode || "—"}</div>
        </div>
        <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Live case</div>
          <div style={{ fontWeight: 800 }}>{sessionConfig?.releasedCaseTitle || liveCase?.title || "None"}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sessionConfig?.releasedCaseKey || "No key"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={() => setDraft((prev) => ({ ...prev, isOpen: true }))} style={{ ...buttonBase, background: "#0f766e" }}>Set Open</button>
        <button onClick={() => setDraft((prev) => ({ ...prev, isOpen: false }))} style={{ ...buttonBase, background: "#b91c1c" }}>Set Closed</button>
        <button onClick={onSave} style={{ ...buttonBase, background: "#0c4a6e" }}>Save Session Settings</button>
      </div>
    </div>
  )
}

function EvaluatorAssessmentForm({ form, setForm, onSubmit, editingId }) {
  const total = useMemo(() => Object.values(form.scores || {}).reduce((a, b) => a + Number(b || 0), 0), [form.scores])
  const rating = getGlobalRating(total)
  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>{editingId ? "Update Assessment" : "Score Assessment"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div>
          <label><strong>Resident ID</strong></label>
          <input value={form.residentId || ""} onChange={(e) => setForm((prev) => ({ ...prev, residentId: e.target.value, resident: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label><strong>Evaluator</strong></label>
          <input value={form.evaluator || ""} onChange={(e) => setForm((prev) => ({ ...prev, evaluator: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label><strong>Rotation</strong></label>
          <input value={form.rotation || ""} onChange={(e) => setForm((prev) => ({ ...prev, rotation: e.target.value }))} style={inputStyle} />
        </div>
        <div>
          <label><strong>Case</strong></label>
          <input value={form.caseName || ""} onChange={(e) => setForm((prev) => ({ ...prev, caseName: e.target.value }))} style={inputStyle} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {domains.map((domain) => (
          <div key={domain.key} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "#f8fafc" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{domain.title}</div>
            <div style={{ fontSize: 12, color: "#64748b", minHeight: 34 }}>{domain.clue}</div>
            <select value={form.scores?.[domain.key] ?? 0} onChange={(e) => setForm((prev) => ({ ...prev, scores: { ...prev.scores, [domain.key]: Number(e.target.value) } }))} style={inputStyle}>
              {Object.entries(domain.levels || {}).map(([value, label]) => <option key={value} value={value}>{value} · {label}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <label><strong>Structured reasoning / evaluator notes</strong></label>
        <textarea rows={8} value={form.structuredReasoning || ""} onChange={(e) => setForm((prev) => ({ ...prev, structuredReasoning: e.target.value }))} style={{ ...inputStyle, minHeight: 180 }} />
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <ScoreBadge total={total} rating={rating} />
        <button onClick={onSubmit} style={{ ...buttonBase, background: "#0f766e" }}>{editingId ? "Update Evaluation" : "Save Evaluation"}</button>
      </div>
    </div>
  )
}

function AssessmentLog({ evaluations, onLoad, onDelete }) {
  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>Assessment Log</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {evaluations.map((entry) => {
          const total = Number(entry.total || 0)
          const rating = entry.globalRating || getGlobalRating(total)
          return (
            <div key={entry.id} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, background: "white", display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <strong>{entry.residentId || entry.resident || "Unknown resident"}</strong> · {entry.caseName || "Untitled case"}
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {formatFirebaseDate(entry.createdAt)} · session {entry.sessionCode || "—"} · {entry.recordType || "evaluation"}
                  </div>
                </div>
                <ScoreBadge total={total} rating={rating} />
              </div>
              {entry.traineeAnswer ? <div><strong>Resident answer:</strong> {entry.traineeAnswer}</div> : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => onLoad(entry)} style={{ ...buttonBase, background: "#2563eb" }}>Load</button>
                <button onClick={() => onDelete(entry.id)} style={{ ...buttonBase, background: "#dc2626" }}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResidentProfiles({ evaluations }) {
  const byResident = useMemo(() => {
    const map = {}
    evaluations.forEach((entry) => {
      const key = entry.residentId || entry.resident || "Unknown"
      if (!map[key]) map[key] = []
      map[key].push(entry)
    })
    Object.values(map).forEach((items) => items.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
    return map
  }, [evaluations])

  const summary = useMemo(() => Object.entries(byResident).map(([resident, items]) => {
    const scored = items.filter((x) => Number(x.total || 0) > 0)
    const avg = average(scored.map((x) => Number(x.total || 0)))
    const domainAverages = domains.map((domain) => ({
      key: domain.key,
      title: domain.title,
      value: average(scored.map((x) => Number(x.scores?.[domain.key] || 0))),
    }))
    const weakest = [...domainAverages].sort((a, b) => a.value - b.value)[0]
    return {
      resident,
      count: items.length,
      avg: avg.toFixed(1),
      weakest: weakest?.title || "—",
    }
  }), [byResident])

  return (
    <div style={card()}>
      <h3 style={{ marginTop: 0 }}>Resident Profiles</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {summary.map((row) => (
          <div key={row.resident} style={{ border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <div><strong>{row.resident}</strong></div>
            <div>Entries: {row.count}</div>
            <div>Avg: {row.avg}/24</div>
            <div>Weakest: {row.weakest}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LeadershipDashboard({ evaluations }) {
  const scored = evaluations.filter((x) => Number(x.total || 0) > 0)
  const byResident = useMemo(() => {
    const map = {}
    scored.forEach((entry) => {
      const key = entry.residentId || entry.resident || "Unknown"
      if (!map[key]) map[key] = []
      map[key].push(entry)
    })
    Object.values(map).forEach((items) => items.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)))
    return map
  }, [scored])

  const avgByDomain = useMemo(() => {
    const result = {}
    domains.forEach((domain) => {
      result[domain.key] = average(scored.map((x) => Number(x.scores?.[domain.key] || 0)))
    })
    return result
  }, [scored])

  const weakestDomain = useMemo(() => {
    const sorted = Object.entries(avgByDomain).sort((a, b) => a[1] - b[1])[0]
    return domains.find((d) => d.key === sorted?.[0])?.title || "—"
  }, [avgByDomain])

  const trendPoints = useMemo(() => {
    const buckets = {}
    scored.forEach((entry) => {
      const label = formatFirebaseDate(entry.createdAt).split(",")[0] || "Unknown"
      if (!buckets[label]) buckets[label] = []
      buckets[label].push(Number(entry.total || 0))
    })
    return Object.entries(buckets).slice(-8).map(([label, values]) => ({ label, value: Number(average(values).toFixed(1)) }))
  }, [scored])

  const atRisk = useMemo(() => Object.entries(byResident).map(([resident, items]) => {
    const totals = items.map((x) => Number(x.total || 0))
    const avg = average(totals)
    const trend = totals.length >= 2 ? totals[totals.length - 1] - totals[0] : 0
    return { resident, avg: Number(avg.toFixed(1)), trend, n: totals.length }
  }).filter((x) => x.avg < 12 || x.trend < 0).sort((a, b) => a.avg - b.avg), [byResident])

  const kpis = [
    { label: "Scored evaluations", value: scored.length },
    { label: "Residents represented", value: Object.keys(byResident).length },
    { label: "Average CRFT score", value: scored.length ? average(scored.map((x) => Number(x.total || 0))).toFixed(1) : "0.0" },
    { label: "Weakest domain", value: weakestDomain },
    { label: "At-risk residents", value: atRisk.length },
  ]

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <KPIGrid items={kpis} />
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <SimpleLineChart points={trendPoints} title="Average Score Trend" />
        <DomainHeatmap avgByDomain={avgByDomain} />
      </div>
      <div style={card()}>
        <h3 style={{ marginTop: 0 }}>Residents Needing Attention</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {atRisk.length ? atRisk.map((row) => (
            <div key={row.resident} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              <div><strong>{row.resident}</strong></div>
              <div>Avg {row.avg}</div>
              <div>Trend {row.trend > 0 ? `+${row.trend}` : row.trend}</div>
              <div>{row.n} scored case(s)</div>
            </div>
          )) : <div style={{ color: "#166534" }}>No currently flagged residents.</div>}
        </div>
      </div>
    </div>
  )
}

function ProgramIntelligence({ evaluations }) {
  const scored = evaluations.filter((x) => Number(x.total || 0) > 0)
  const byCase = useMemo(() => {
    const map = {}
    scored.forEach((entry) => {
      const key = entry.caseName || "Unknown case"
      if (!map[key]) map[key] = []
      map[key].push(Number(entry.total || 0))
    })
    return Object.entries(map).map(([caseName, values]) => ({ caseName, avg: Number(average(values).toFixed(1)), n: values.length })).sort((a, b) => a.avg - b.avg)
  }, [scored])

  const bySession = useMemo(() => {
    const map = {}
    evaluations.forEach((entry) => {
      const key = entry.sessionCode || "No session"
      if (!map[key]) map[key] = 0
      map[key] += 1
    })
    return Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
  }, [evaluations])

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card()}>
          <h3 style={{ marginTop: 0 }}>Case-Level Performance</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {byCase.map((row) => (
              <div key={row.caseName} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                <div>{row.caseName}</div>
                <div>{row.avg}/24</div>
                <div>{row.n} scored</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card()}>
          <h3 style={{ marginTop: 0 }}>Session Volume</h3>
          <div style={{ display: "grid", gap: 10 }}>
            {bySession.map((row) => (
              <div key={row.label} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>{row.label}</div>
                <strong>{row.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ResidentProfiles evaluations={scored} />
    </div>
  )
}

function ReportsPage({ evaluations, sessionConfig }) {
  const buildCsv = (rows, filename) => {
    const headers = ["Resident ID","Case","Session","Type","Total","Global Rating","Timestamp","Evaluator","Rotation","Case Key"]
    const contentRows = rows.map((entry) => [
      `"${entry.residentId || entry.resident || ""}"`,
      `"${entry.caseName || ""}"`,
      `"${entry.sessionCode || ""}"`,
      `"${entry.recordType || ""}"`,
      `"${entry.total || 0}"`,
      `"${entry.globalRating || ""}"`,
      `"${formatFirebaseDate(entry.createdAt)}"`,
      `"${entry.evaluator || ""}"`,
      `"${entry.rotation || ""}"`,
      `"${entry.universalCaseKey || ""}"`,
    ])
    const content = [headers, ...contentRows].map((row) => row.join(",")).join("\n")
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const currentSessionRows = evaluations.filter((entry) => safeLower(entry.sessionCode) === safeLower(sessionConfig?.sessionCode))
  const residentCounts = RESIDENT_IDS.map((id) => ({
    id,
    n: evaluations.filter((entry) => safeLower(entry.residentId) === safeLower(id)).length,
  }))

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={card()}>
        <h3 style={{ marginTop: 0 }}>Reports / Exports</h3>
        <div style={{ color: "#475569", marginBottom: 12 }}>Export a flat CSV for QI analysis, session monitoring, or program review.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => buildCsv(evaluations, "crft_program_export_all.csv")} style={{ ...buttonBase, background: "#0c4a6e" }}>Export All CSV</button>
          <button onClick={() => buildCsv(currentSessionRows, `crft_session_${sessionConfig?.sessionCode || "current"}.csv`)} style={{ ...buttonBase, background: "#0f766e" }}>Export Current Session</button>
          {RESIDENT_IDS.map((id) => (
            <button key={id} onClick={() => buildCsv(evaluations.filter((entry) => safeLower(entry.residentId) === safeLower(id)), `crft_${id}.csv`)} style={{ ...buttonBase, background: "#475569" }}>
              Export {id}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <MetricCard label="All records" value={evaluations.length} tone="#0c4a6e" />
        <MetricCard label="Current session records" value={currentSessionRows.length} tone="#0f766e" />
        <MetricCard label="Live session code" value={sessionConfig?.sessionCode || "—"} tone="#7c3aed" />
      </div>

      <div style={card()}>
        <h3 style={{ marginTop: 0 }}>Resident Export Readiness</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {residentCounts.map((row) => (
            <div key={row.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>{row.id}</div>
              <strong>{row.n} records</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AccessCard({ title, subtitle, accent, children }) {
  return (
    <div style={{ ...card(), borderTop: `6px solid ${accent}` }}>
      <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
      <div style={{ color: "#64748b", marginBottom: 12 }}>{subtitle}</div>
      {children}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [portal, setPortal] = useState("evaluator")
  const [appTab, setAppTab] = useState("Session Control")
  const [directorTab, setDirectorTab] = useState("Leadership Dashboard")

  const [residentId, setResidentId] = useState("R1")
  const [sessionCodeInput, setSessionCodeInput] = useState("")
  const [residentAnswer, setResidentAnswer] = useState("")

  const [evaluatorEmail, setEvaluatorEmail] = useState("")
  const [evaluatorPassword, setEvaluatorPassword] = useState("")
  const [directorEmail, setDirectorEmail] = useState("")
  const [directorPassword, setDirectorPassword] = useState("")

  const [evaluations, setEvaluations] = useState([])
  const [sessionConfig, setSessionConfig] = useState(normalizeSessionConfig())
  const [sessionDraft, setSessionDraft] = useState(normalizeSessionConfig())
  const [statusMessage, setStatusMessage] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)

  const effectiveRole = !user ? "guest" : user.isAnonymous ? "resident" : portal === "director" ? "director" : "evaluator"

  useEffect(() => {
    const unsub = watchAuth((u) => setUser(u))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user) return
    const unsubEvals = subscribeEvaluations(setEvaluations)
    const unsubSession = subscribeSessionConfig((value) => {
      const normalized = normalizeSessionConfig(value)
      setSessionConfig(normalized)
      setSessionDraft((prev) => ({ ...prev, ...normalized }))
    })
    return () => {
      if (typeof unsubEvals === "function") unsubEvals()
      if (typeof unsubSession === "function") unsubSession()
    }
  }, [user])

  useEffect(() => {
    if (!statusMessage) return
    const t = setTimeout(() => setStatusMessage(""), 2500)
    return () => clearTimeout(t)
  }, [statusMessage])

  const releasedCase = useMemo(
    () => universalCases.find((x) => x.key === sessionConfig?.releasedCaseKey) || null,
    [sessionConfig]
  )

  const canResidentAccess = useMemo(
    () => Boolean(sessionConfig?.isOpen) && Boolean(sessionCodeInput.trim()) && sessionCodeInput.trim() === String(sessionConfig?.sessionCode || "").trim(),
    [sessionCodeInput, sessionConfig]
  )

  const residentExistingSubmission = useMemo(() => {
    return evaluations.find((entry) =>
      safeLower(entry.residentId) === safeLower(residentId) &&
      safeLower(entry.sessionCode) === safeLower(sessionConfig?.sessionCode) &&
      safeLower(entry.universalCaseKey) === safeLower(sessionConfig?.releasedCaseKey) &&
      entry.recordType === "resident_submission"
    ) || null
  }, [evaluations, residentId, sessionConfig])

  const resetEvaluatorForm = () => {
    setEditingId(null)
    setForm({
      resident: "",
      residentId: "",
      evaluator: "",
      rotation: "",
      caseName: "",
      scores: { ...initialScores },
      whatChanged: { ...initialWhatChanged },
      structuredReasoning: "",
      traineeAnswer: "",
    })
  }

  const handleResidentEnter = async () => {
    try {
      setPortal("resident")
      await signInResident()
    } catch (error) {
      console.error(error)
      alert("Resident login failed.")
    }
  }

  const handleStaffLogin = async (role) => {
    const email = role === "director" ? directorEmail : evaluatorEmail
    const password = role === "director" ? directorPassword : evaluatorPassword
    try {
      setPortal(role)
      await signInEvaluator(email, password)
    } catch (error) {
      console.error(error)
      alert(`${role === "director" ? "Program Director" : "Evaluator"} login failed.`)
    }
  }

  const handleSaveSession = async () => {
    const chosenCase = universalCases.find((x) => x.key === sessionDraft.releasedCaseKey)
    const payload = {
      ...sessionDraft,
      releasedCaseTitle: chosenCase?.title || "",
      updatedBy: effectiveRole,
    }
    try {
      await saveSessionConfig(payload)
      setStatusMessage("Session settings saved.")
    } catch (error) {
      console.error(error)
      alert("Failed to save session settings.")
    }
  }

  const handleResidentSubmit = async () => {
    if (!residentId) {
      alert("Select resident ID.")
      return
    }
    if (!canResidentAccess || !releasedCase) {
      alert("Session is not unlocked.")
      return
    }
    if (residentExistingSubmission) {
      alert("This released case is already locked for this resident.")
      return
    }
    if (!residentAnswer.trim()) {
      alert("Enter your reasoning before submitting.")
      return
    }

    try {
      await createEvaluation({
        resident: residentId,
        residentId,
        evaluator: "",
        rotation: "",
        caseName: releasedCase.title,
        universalCaseKey: releasedCase.key,
        universalCaseTitle: releasedCase.title,
        universalCaseSetting: releasedCase.setting,
        sessionCode: sessionConfig.sessionCode,
        recordType: "resident_submission",
        traineeAnswer: residentAnswer.trim(),
        scores: { ...initialScores },
        total: 0,
        globalRating: "",
        structuredReasoning: "",
      })
      setResidentAnswer("")
      setStatusMessage(`Submitted successfully for ${residentId}.`)
    } catch (error) {
      console.error(error)
      alert("Submission failed.")
    }
  }

  const handleEvaluatorSave = async () => {
    const total = Object.values(form.scores || {}).reduce((a, b) => a + Number(b || 0), 0)
    const payload = {
      ...form,
      resident: form.residentId || form.resident,
      residentId: form.residentId || form.resident,
      total,
      globalRating: getGlobalRating(total),
      recordType: "scored_evaluation",
    }
    try {
      if (editingId) {
        await updateEvaluation(editingId, payload)
        setStatusMessage("Evaluation updated.")
      } else {
        await createEvaluation(payload)
        setStatusMessage("Evaluation saved.")
      }
      resetEvaluatorForm()
    } catch (error) {
      console.error(error)
      alert("Save failed.")
    }
  }

  const handleLoadEvaluation = (entry) => {
    setEditingId(entry.id)
    setForm({
      resident: entry.resident || entry.residentId || "",
      residentId: entry.residentId || entry.resident || "",
      evaluator: entry.evaluator || "",
      rotation: entry.rotation || "",
      caseName: entry.caseName || "",
      scores: entry.scores || { ...initialScores },
      whatChanged: entry.whatChanged || { ...initialWhatChanged },
      structuredReasoning: entry.structuredReasoning || entry.traineeAnswer || "",
      traineeAnswer: entry.traineeAnswer || "",
    })
    setStatusMessage("Loaded into evaluator form.")
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return
    try {
      await removeEvaluation(id)
      if (editingId === id) resetEvaluatorForm()
      setStatusMessage("Record deleted.")
    } catch (error) {
      console.error(error)
      alert("Delete failed.")
    }
  }

  const visibleEvaluations = useMemo(() => {
    if (effectiveRole === "resident") {
      return evaluations.filter((entry) => safeLower(entry.residentId) === safeLower(residentId))
    }
    return evaluations
  }, [effectiveRole, evaluations, residentId])

  if (!user) {
    return (
      <div style={pageWrap}>
        <div style={container}>
          <div style={hero}>
            <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)" }}>CRFT</h1>
            <div style={{ marginTop: 6, opacity: 0.95, fontSize: 15 }}>Clinical Reasoning Platform</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <AccessCard title="Resident Access" subtitle="Controlled data-collection mode. One released case only." accent="#0f766e">
              <label><strong>Resident ID</strong></label>
              <select value={residentId} onChange={(e) => setResidentId(e.target.value)} style={inputStyle}>
                {RESIDENT_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
              <button onClick={handleResidentEnter} style={{ ...buttonBase, background: "#0f766e", marginTop: 12, width: "100%" }}>
                Enter Resident Portal
              </button>
            </AccessCard>

            <AccessCard title="Evaluator Access" subtitle="Release cases, score submissions, and manage assessments." accent="#2563eb">
              <input placeholder="Evaluator email" value={evaluatorEmail} onChange={(e) => setEvaluatorEmail(e.target.value)} style={inputStyle} />
              <input placeholder="Password" type="password" value={evaluatorPassword} onChange={(e) => setEvaluatorPassword(e.target.value)} style={inputStyle} />
              <button onClick={() => handleStaffLogin("evaluator")} style={{ ...buttonBase, background: "#2563eb", marginTop: 12, width: "100%" }}>
                Login as Evaluator
              </button>
            </AccessCard>

            <AccessCard title="Program Director Access" subtitle="Leadership dashboard, program intelligence, and reports." accent="#7c3aed">
              <input placeholder="Program Director email" value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} style={inputStyle} />
              <input placeholder="Password" type="password" value={directorPassword} onChange={(e) => setDirectorPassword(e.target.value)} style={inputStyle} />
              <button onClick={() => handleStaffLogin("director")} style={{ ...buttonBase, background: "#7c3aed", marginTop: 12, width: "100%" }}>
                Login as Program Director
              </button>
            </AccessCard>
          </div>

          <div style={{ ...card("#eff6ff"), marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Open on phone</h3>
            <div style={{ color: "#475569", marginBottom: 10 }}>Residents can scan to open the app on their own devices.</div>
            <div style={{ marginBottom: 12, wordBreak: "break-all" }}>{appUrl}</div>
            <QRCodeSVG value={appUrl} size={150} bgColor="#ffffff" fgColor="#0f172a" level="M" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={hero}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "clamp(28px, 5vw, 44px)" }}>CRFT</h1>
              <div style={{ marginTop: 6, opacity: 0.95, fontSize: 15 }}>
                {effectiveRole === "resident" && `Resident Portal · ${residentId}`}
                {effectiveRole === "evaluator" && "Evaluator Portal"}
                {effectiveRole === "director" && "Program Director Portal"}
              </div>
            </div>
            <button onClick={async () => { await logOut(); setResidentAnswer(""); setSessionCodeInput(""); resetEvaluatorForm() }} style={{ ...buttonBase, background: "#475569" }}>Logout</button>
          </div>
        </div>

        {statusMessage ? <div style={{ ...card("#ecfeff"), marginBottom: 16, padding: 12 }}>{statusMessage}</div> : null}

        {effectiveRole === "resident" ? (
          <ResidentSubmissionPanel
            residentId={residentId}
            sessionCodeInput={sessionCodeInput}
            setSessionCodeInput={setSessionCodeInput}
            sessionConfig={sessionConfig}
            releasedCase={releasedCase}
            existingSubmission={residentExistingSubmission}
            onSignOut={async () => { await logOut(); setSessionCodeInput(""); setResidentAnswer("") }}
            onSubmit={handleResidentSubmit}
            answer={residentAnswer}
            setAnswer={setResidentAnswer}
            canAccess={canResidentAccess}
          />
        ) : effectiveRole === "evaluator" ? (
          <>
            <TopNav items={["Session Control", "Scoring Workspace", "Assessment Log", "Resident Profiles"]} active={appTab} onChange={setAppTab} />
            {appTab === "Session Control" && <SessionControlPanel sessionConfig={sessionConfig} setDraft={setSessionDraft} draft={sessionDraft} onSave={handleSaveSession} cases={universalCases} />}
            {appTab === "Scoring Workspace" && <EvaluatorAssessmentForm form={form} setForm={setForm} onSubmit={handleEvaluatorSave} editingId={editingId} />}
            {appTab === "Assessment Log" && <AssessmentLog evaluations={visibleEvaluations} onLoad={handleLoadEvaluation} onDelete={handleDelete} />}
            {appTab === "Resident Profiles" && <ResidentProfiles evaluations={evaluations.filter((x) => Number(x.total || 0) > 0)} />}
          </>
        ) : (
          <>
            <TopNav items={["Leadership Dashboard", "Program Intelligence", "Reports / Exports"]} active={directorTab} onChange={setDirectorTab} />
            {directorTab === "Leadership Dashboard" && <LeadershipDashboard evaluations={evaluations} />}
            {directorTab === "Program Intelligence" && <ProgramIntelligence evaluations={evaluations} />}
            {directorTab === "Reports / Exports" && <ReportsPage evaluations={evaluations} sessionConfig={sessionConfig} />}
          </>
        )}
      </div>
    </div>
  )
}
