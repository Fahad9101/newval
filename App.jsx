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
  evaluator: "",
  rotation: "",
  caseName: "",
  scores: initialScores,
  whatChanged: initialWhatChanged,
  structuredReasoning: "",
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
    "Case Setting",
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
    `"${e.universalCaseSetting || ""}"`,
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

function getWeakestDomainsFromScores(scores) {
  return Object.entries(scores)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key)
}

function getAdaptiveCase(pool, weakestDomains) {
  for (const weakDomain of weakestDomains) {
    const matches = pool.filter((c) => (c.targetDomains || []).includes(weakDomain))
    if (matches.length) {
      return matches[Math.floor(Math.random() * matches.length)]
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

function getPatternTrackerData(evaluations, residentName) {
  if (!residentName.trim()) return null

  const residentEvals = evaluations
    .filter((e) => (e.resident || "").toLowerCase() === residentName.trim().toLowerCase())
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
    .slice(0, 5)

  if (!residentEvals.length) return null

  const domainStats = domains.map((d) => {
    const values = residentEvals.map((e) => Number(e.scores?.[d.key] || 0))
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const lowCount = values.filter((v) => v > 0 && v <= 2).length

    return {
      key: d.key,
      title: d.title,
      avg: Number(avg.toFixed(2)),
      lowCount,
    }
  })

  const repeatedWeaknesses = domainStats
    .filter((d) => d.lowCount >= 2 || d.avg <= 2)
    .sort((a, b) => a.avg - b.avg)

  const message =
    repeatedWeaknesses.length > 0
      ? `Pattern detected: repeated difficulty in ${repeatedWeaknesses.slice(0, 3).map((d) => d.title).join(", ")}.`
      : "No clear repeated weak pattern detected yet."

  return {
    residentEvals,
    domainStats,
    repeatedWeaknesses,
    message,
  }
}

function detectWrongQuestion(answer) {
  const a = normalizeText(answer)

  const hasDiagnosisWords = /\bdiagnosis|acs|pneumonia|pe|sepsis|heart failure|mi|aki|siadh|delirium\b/.test(a)
  const hasFramingWords = /\bproblem|question|cause|why|syndrome|this is|frame|likely represents\b/.test(a)

  if (hasDiagnosisWords && !hasFramingWords) {
    return "⚠️ You jumped to diagnosis without clearly defining the clinical question."
  }

  if (!hasFramingWords) {
    return "⚠️ No clear clinical question identified."
  }

  return null
}

function getReasoningFeedback(answer) {
  const a = normalizeText(answer)
  const feedback = []

  if (!/\bbecause|due to|suggests|consistent with|therefore\b/.test(a)) {
    feedback.push("⚠️ No explicit explanation of reasoning.")
  }

  if (!/\brisk|next|anticipate|plan|monitor|watch for|prevent\b/.test(a)) {
    feedback.push("⚠️ No anticipation of next steps or complications.")
  }

  if (!/\bmost likely|priority|first|top|main\b/.test(a)) {
    feedback.push("⚠️ No clear prioritization of differential or plan.")
  }

  if (/\btroponin\b/.test(a) && !/\bdemand|context|trend|ischemia\b/.test(a)) {
    feedback.push("⚠️ Troponin mentioned without context interpretation.")
  }

  if (/\bd dimer|ddimer|d-dimer\b/.test(a) && !/\bpretest|probability|wells|context\b/.test(a)) {
    feedback.push("⚠️ D-dimer mentioned without pretest probability context.")
  }

  if (!/\bsyndrome|pattern|represents\b/.test(a)) {
    feedback.push("⚠️ Syndrome-level framing is weak or absent.")
  }

  if (feedback.length === 0) {
    feedback.push("✅ Reasoning structure is solid.")
  }

  return feedback
}

function buildStructuredReasoning(text = "") {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (!cleaned) return ""

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean)
  const take = (index, fallback) => sentences[index] || fallback

  const problem =
    /question|frame|represents|problem|syndrome/i.test(cleaned)
      ? take(0, "Clinical question: —")
      : `Clinical question: ${take(0, cleaned)}`

  const syndrome =
    /syndrome|physiology|pattern|heart failure|aki|pe|delirium|alkalosis|anemia/i.test(cleaned)
      ? take(1, "Syndrome / physiology: —")
      : "Syndrome / physiology: —"

  const differential =
    /differential|consider|likely|vs|because/i.test(cleaned)
      ? take(2, "Differential / priority diagnosis: —")
      : "Differential / priority diagnosis: —"

  const data =
    /lab|labs|troponin|creatinine|xray|cxr|ct|trend|vitals|data/i.test(cleaned)
      ? take(3, "Data interpretation: —")
      : "Data interpretation: —"

  const anticipation =
    /plan|monitor|watch|prevent|risk|next/i.test(cleaned)
      ? take(4, "Anticipation / next 12–24h: —")
      : "Anticipation / next 12–24h: —"

  const reassessment = take(5, "Reassessment trigger: what new data would change the model?")

  return [
    "1) Problem framing",
    problem,
    "",
    "2) Syndrome / physiology",
    syndrome,
    "",
    "3) Differential / priority diagnosis",
    differential,
    "",
    "4) Data interpretation",
    data,
    "",
    "5) Anticipation / next steps",
    anticipation,
    "",
    "6) Reassessment trigger",
    reassessment,
  ].join("\n")
}

function buildWhatChangedSummary(whatChanged = initialWhatChanged) {
  const lines = []

  if (whatChanged.clinicalStatus?.trim()) lines.push(`Clinical status: ${whatChanged.clinicalStatus.trim()}`)
  if (whatChanged.overnightEvents?.trim()) lines.push(`What changed since yesterday / last 24h: ${whatChanged.overnightEvents.trim()}`)
  if (whatChanged.vitalsTrend?.trim()) lines.push(`Vitals trend: ${whatChanged.vitalsTrend.trim()}`)
  if (whatChanged.labsTrend?.trim()) lines.push(`Labs trend: ${whatChanged.labsTrend.trim()}`)
  if (whatChanged.imagingProcedures?.trim()) lines.push(`Imaging / procedures: ${whatChanged.imagingProcedures.trim()}`)
  if (whatChanged.consultantChanges?.trim()) lines.push(`Consultant / plan changes: ${whatChanged.consultantChanges.trim()}`)
  if (whatChanged.dischargeBarriers?.trim()) lines.push(`Discharge barriers: ${whatChanged.dischargeBarriers.trim()}`)
  if (whatChanged.stillOnEDD === "yes") lines.push("EDD status: still on expected discharge date")
  if (whatChanged.stillOnEDD === "no") lines.push("EDD status: off expected discharge date")

  return lines.join("\n")
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

function RadarOverTime({ evaluations }) {
  const recent = [...evaluations]
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
    .slice(-5)

  if (!recent.length) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: "white",
          border: "1px solid #e2e8f0",
          color: "#475569",
        }}
      >
        No resident trend data yet.
      </div>
    )
  }

  const size = 340
  const center = size / 2
  const radius = 112
  const levels = 4
  const keys = domains.map((d) => d.key)
  const seriesColors = ["#94a3b8", "#60a5fa", "#34d399", "#f59e0b", "#0c4a6e"]

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

  const polygonPoints = (scores) =>
    keys
      .map((key, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
        const r = (radius * Number(scores?.[key] || 0)) / levels
        const x = center + Math.cos(angle) * r
        const y = center + Math.sin(angle) * r
        return `${x},${y}`
      })
      .join(" ")

  return (
    <div style={{ display: "grid", gap: 12 }}>
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
          {recent.map((evaluation, idx) => (
            <polygon
              key={evaluation.id || idx}
              points={polygonPoints(evaluation.scores || {})}
              fill="none"
              stroke={seriesColors[idx] || "#0c4a6e"}
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {recent.map((evaluation, idx) => (
          <div key={`legend-${evaluation.id || idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                background: seriesColors[idx] || "#0c4a6e",
              }}
            />
            <div style={{ fontSize: 13 }}>
              {formatFirebaseDate(evaluation.createdAt) || `Evaluation ${idx + 1}`} · {evaluation.total || evaluation.totalScore || 0}/24
            </div>
          </div>
        ))}
      </div>
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



function formatMonthLabel(key) {
  if (!key) return ""
  const [year, month] = key.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
}

function getMonthKeyFromEvaluation(evaluation) {
  const ts = evaluation?.createdAt?.seconds
  const date = ts ? new Date(ts * 1000) : new Date()
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, "0")
  return `${y}-${m}`
}

function getResidentSummaries(evaluations) {
  const grouped = {}

  evaluations.forEach((evaluation) => {
    const name = (evaluation.resident || "Unknown").trim() || "Unknown"
    if (!grouped[name]) grouped[name] = []
    grouped[name].push(evaluation)
  })

  return Object.entries(grouped).map(([resident, items]) => {
    const sorted = [...items].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
    const totals = sorted.map((item) => Number(item.total || item.totalScore || 0))
    const avgScore = totals.length
      ? Number((totals.reduce((sum, value) => sum + value, 0) / totals.length).toFixed(1))
      : 0
    const firstScore = totals[0] || 0
    const latestScore = totals[totals.length - 1] || 0
    const delta = Number((latestScore - firstScore).toFixed(1))
    const latest = sorted[sorted.length - 1]

    const lowDomains = domains
      .map((domain) => {
        const values = sorted.map((item) => Number(item.scores?.[domain.key] || 0)).filter((value) => value > 0)
        const avg = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
        return {
          key: domain.key,
          title: domain.title,
          avg,
        }
      })
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 2)
      .map((item) => item.title)

    let flag = "On track"
    if (avgScore < 12 || delta <= -2) flag = "High risk"
    else if (avgScore < 14 || delta < 0 || lowDomains.length) flag = "Watch"

    return {
      resident,
      evaluations: sorted,
      count: sorted.length,
      avgScore,
      firstScore,
      latestScore,
      delta,
      latestRating: latest?.globalRating || getGlobalRating(latestScore),
      lowDomains,
      lastDate: latest?.createdAt || null,
      flag,
    }
  })
}

function MetricCard({ label, value, subvalue, tone = "default" }) {
  const tones = {
    default: { bg: "#ffffff", border: "#e2e8f0", value: "#0f172a", pill: "#e2e8f0", pillText: "#334155" },
    primary: { bg: "#eff6ff", border: "#bfdbfe", value: "#1d4ed8", pill: "#dbeafe", pillText: "#1d4ed8" },
    success: { bg: "#ecfdf5", border: "#bbf7d0", value: "#047857", pill: "#d1fae5", pillText: "#047857" },
    warning: { bg: "#fffbeb", border: "#fde68a", value: "#b45309", pill: "#fef3c7", pillText: "#92400e" },
    danger: { bg: "#fef2f2", border: "#fecaca", value: "#dc2626", pill: "#fee2e2", pillText: "#b91c1c" },
  }
  const palette = tones[tone] || tones.default

  return (
    <div
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        borderRadius: 16,
        padding: 16,
        minHeight: 110,
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 10, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, lineHeight: 1, fontWeight: 800, color: palette.value }}>{value}</div>
      {subvalue ? (
        <div
          style={{
            display: "inline-flex",
            marginTop: 12,
            padding: "5px 10px",
            borderRadius: 999,
            background: palette.pill,
            color: palette.pillText,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {subvalue}
        </div>
      ) : null}
    </div>
  )
}

function SegmentedTabs({ value, onChange, options }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 6,
        background: "#e2e8f0",
        borderRadius: 14,
      }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              background: active ? "#0f172a" : "transparent",
              color: active ? "white" : "#334155",
              boxShadow: active ? "0 4px 12px rgba(15, 23, 42, 0.15)" : "none",
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function MiniLineChart({ data, max = 24, color = "#1d4ed8", height = 160, suffix = "" }) {
  if (!data.length) {
    return <div style={{ color: "#64748b" }}>No data yet.</div>
  }

  const width = 520
  const chartHeight = height
  const paddingX = 24
  const paddingY = 18
  const innerWidth = width - paddingX * 2
  const innerHeight = chartHeight - paddingY * 2
  const divisor = Math.max(data.length - 1, 1)

  const points = data.map((item, index) => {
    const x = paddingX + (index / divisor) * innerWidth
    const y = paddingY + innerHeight - (Math.max(Number(item.value) || 0, 0) / max) * innerHeight
    return { ...item, x, y }
  })

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ")

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${chartHeight}`} style={{ width: "100%", height: chartHeight }}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = paddingY + innerHeight - tick * innerHeight
          return <line key={tick} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="#e2e8f0" strokeWidth="1" />
        })}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point) => (
          <g key={`${point.label}-${point.value}`}>
            <circle cx={point.x} cy={point.y} r="4.5" fill={color} />
          </g>
        ))}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, gap: 8, marginTop: 6 }}>
        {data.map((item) => (
          <div key={`${item.label}-${item.value}`} style={{ fontSize: 12, color: "#475569", textAlign: "center" }}>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.value}{suffix}</div>
            <div>{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DomainHeatmap({ avgByDomain = {} }) {
  const getTone = (value) => {
    if (value < 2.5) return { bg: "#fee2e2", border: "#fecaca", text: "#b91c1c", badge: "Priority" }
    if (value < 3.1) return { bg: "#fef3c7", border: "#fde68a", text: "#92400e", badge: "Watch" }
    return { bg: "#dcfce7", border: "#bbf7d0", text: "#166534", badge: "Strong" }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
      {domains.map((domain) => {
        const value = Number(avgByDomain[domain.key] || 0)
        const tone = getTone(value)
        return (
          <div
            key={domain.key}
            style={{
              padding: 14,
              borderRadius: 14,
              background: tone.bg,
              border: `1px solid ${tone.border}`,
            }}
          >
            <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>{domain.title}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: tone.text }}>{value.toFixed(2)}/4</div>
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: tone.text }}>{tone.badge}</div>
          </div>
        )
      })}
    </div>
  )
}

function RiskTable({ residents = [], onSelectResident }) {
  if (!residents.length) {
    return <div style={{ color: "#64748b" }}>No resident risk data yet.</div>
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Resident", "Avg", "Trend", "Weakest pattern", "Flag", "Action"].map((header) => (
              <th
                key={header}
                style={{
                  textAlign: "left",
                  padding: "12px 10px",
                  borderBottom: "1px solid #e2e8f0",
                  fontSize: 12,
                  textTransform: "uppercase",
                  color: "#64748b",
                  letterSpacing: 0.4,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {residents.map((resident) => {
            const tone = resident.flag === "High risk" ? "#dc2626" : resident.flag === "Watch" ? "#b45309" : "#047857"
            return (
              <tr key={resident.resident}>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 700 }}>{resident.resident}</td>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9" }}>{resident.avgScore}/24</td>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9", color: resident.delta > 0 ? "#047857" : resident.delta < 0 ? "#dc2626" : "#475569", fontWeight: 700 }}>
                  {resident.delta > 0 ? `+${resident.delta}` : resident.delta}
                </td>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9" }}>{resident.lowDomains.join(", ") || "—"}</td>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: 999, background: `${tone}16`, color: tone, fontSize: 12, fontWeight: 800 }}>{resident.flag}</span>
                </td>
                <td style={{ padding: "12px 10px", borderBottom: "1px solid #f1f5f9" }}>
                  <button onClick={() => onSelectResident(resident.resident)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", cursor: "pointer", fontWeight: 700 }}>
                    Open profile
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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
  const [caseSettingFilter, setCaseSettingFilter] = useState("All")
  const [dashboardView, setDashboardView] = useState("program")

  const [facultyMode, setFacultyMode] = useState(false)
  const [traineeAnswer, setTraineeAnswer] = useState("")
  const [benchmarkResult, setBenchmarkResult] = useState(null)

  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState("")
  const recognitionRef = useRef(null)

  const [overrideReflection, setOverrideReflection] = useState("")
  const [overrideCompleted, setOverrideCompleted] = useState(false)

  const [form, setForm] = useState(initialForm)

  const selectedCase = useMemo(
    () => universalCases.find((c) => c.key === selectedCaseKey) || null,
    [selectedCaseKey]
  )

  const filteredCases = useMemo(() => {
    if (caseSettingFilter === "All") return universalCases
    return universalCases.filter((c) => c.setting === caseSettingFilter)
  }, [caseSettingFilter])

  const currentResidentPattern = useMemo(
    () => getPatternTrackerData(evaluations, form.resident || ""),
    [evaluations, form.resident]
  )

  const whatChangedSummary = useMemo(
    () => buildWhatChangedSummary(form.whatChanged || initialWhatChanged),
    [form.whatChanged]
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
      }) +
      (form.structuredReasoning?.trim()
        ? `\n\nStructured reasoning\n\n${form.structuredReasoning.trim()}`
        : "") +
      (whatChangedSummary ? `\n\nWhat changed since yesterday\n\n${whatChangedSummary}` : ""),
    [form, total, globalRating, priorityRecommendations, whatChangedSummary]
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
        (e.rotation || "").toLowerCase().includes(q) ||
        (e.universalCaseSetting || "").toLowerCase().includes(q)

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

  const programIntelligence = useMemo(() => {
    const residentSummaries = getResidentSummaries(evaluations)
    const uniqueResidents = residentSummaries.length
    const avgTotal = cohortAnalytics.avgTotal || 0

    const nearConsultantCount = evaluations.filter((evaluation) => (evaluation.globalRating || getGlobalRating(Number(evaluation.total || evaluation.totalScore || 0))) === "Near Consultant").length
    const nearConsultantRate = evaluations.length ? Math.round((nearConsultantCount / evaluations.length) * 100) : 0

    const highRiskResidents = residentSummaries
      .filter((resident) => resident.flag === "High risk" || resident.flag === "Watch")
      .sort((a, b) => {
        const rank = { "High risk": 0, Watch: 1, "On track": 2 }
        if (rank[a.flag] !== rank[b.flag]) return rank[a.flag] - rank[b.flag]
        return a.avgScore - b.avgScore
      })

    const improvingResidents = residentSummaries.filter((resident) => resident.delta >= 2).length
    const stagnantResidents = residentSummaries.filter((resident) => resident.delta <= 0 && resident.count >= 2).length

    const monthlyMap = {}
    evaluations.forEach((evaluation) => {
      const key = getMonthKeyFromEvaluation(evaluation)
      if (!monthlyMap[key]) monthlyMap[key] = { total: 0, count: 0 }
      monthlyMap[key].total += Number(evaluation.total || evaluation.totalScore || 0)
      monthlyMap[key].count += 1
    })

    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({
        label: formatMonthLabel(key),
        value: Number((value.total / value.count).toFixed(1)),
      }))

    const settingCounts = ["Inpatient", "Outpatient"]
      .map((setting) => ({
        label: setting,
        value: evaluations.filter((evaluation) => (evaluation.universalCaseSetting || "").toLowerCase() === setting.toLowerCase()).length,
      }))
      .filter((item) => item.value > 0)

    const leaderboard = residentSummaries
      .filter((resident) => resident.count >= 2)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 5)

    return {
      uniqueResidents,
      avgTotal,
      nearConsultantRate,
      highRiskResidents,
      improvingResidents,
      stagnantResidents,
      monthlyTrend,
      settingCounts,
      leaderboard,
      residentSummaries,
    }
  }, [evaluations, cohortAnalytics])

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
    const pool =
      caseSettingFilter === "All"
        ? universalCases
        : universalCases.filter((c) => c.setting === caseSettingFilter)

    if (!pool.length) return

    const picked = pool[Math.floor(Math.random() * pool.length)]

    stopVoiceTyping()
    setSelectedCaseKey(picked.key)
    setForm((prev) => ({
      ...prev,
      caseName: picked.title,
    }))
    setFacultyMode(false)
    setTraineeAnswer("")
    setBenchmarkResult(null)
    setOverrideReflection("")
    setOverrideCompleted(false)
    setSpeechError("")
    setStatusMessage(`Random case assigned: ${picked.title}`)
  }

  const assignAdaptiveCase = () => {
    const pool =
      caseSettingFilter === "All"
        ? universalCases
        : universalCases.filter((c) => c.setting === caseSettingFilter)

    if (!pool.length) return

    let weakestDomains = []

    if (currentResidentPattern?.repeatedWeaknesses?.length) {
      weakestDomains = currentResidentPattern.repeatedWeaknesses.map((d) => d.key)
    } else if (Object.values(form.scores).some((v) => Number(v) > 0)) {
      weakestDomains = getWeakestDomainsFromScores(form.scores)
    } else {
      weakestDomains = domains.map((d) => d.key)
    }

    const picked = getAdaptiveCase(pool, weakestDomains)

    stopVoiceTyping()
    setSelectedCaseKey(picked.key)
    setForm((prev) => ({
      ...prev,
      caseName: picked.title,
    }))
    setFacultyMode(false)
    setTraineeAnswer("")
    setBenchmarkResult(null)
    setOverrideReflection("")
    setOverrideCompleted(false)
    setSpeechError("")
    setStatusMessage(`Adaptive case assigned: ${picked.title}`)
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
    setOverrideReflection("")
    setOverrideCompleted(false)
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
    setOverrideCompleted(false)
  }

  const revealFacultyAfterOverride = () => {
    if (!overrideReflection.trim()) {
      alert("Enter what you would change before revealing the faculty answer.")
      return
    }
    setOverrideCompleted(true)
    setFacultyMode(true)
    setStatusMessage("Faculty answer revealed after reflection.")
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

  const handleWhatChanged = (field, value) => {
    setForm((prev) => ({
      ...prev,
      whatChanged: { ...(prev.whatChanged || initialWhatChanged), [field]: value },
    }))
  }

  const autoFormatStructuredReasoning = () => {
    if (!traineeAnswer.trim()) {
      alert("Enter or dictate trainee reasoning first.")
      return
    }
    handleField("structuredReasoning", buildStructuredReasoning(traineeAnswer))
    setStatusMessage("Structured reasoning generated.")
  }

  const resetForm = () => {
    stopVoiceTyping()
    setForm({
      resident: "",
      evaluator: "",
      rotation: "",
      caseName: "",
      scores: { ...initialScores },
      whatChanged: { ...initialWhatChanged },
      structuredReasoning: "",
    })
    setSelectedCaseKey("")
    setCaseSettingFilter("All")
    setEditingId(null)
    setFacultyMode(false)
    setTraineeAnswer("")
    setBenchmarkResult(null)
    setOverrideReflection("")
    setOverrideCompleted(false)
    setSpeechError("")
  }

  const submit = async () => {
    if (!form.resident && !form.caseName && total === 0 && !traineeAnswer.trim() && !whatChangedSummary) {
      alert("Enter at least a resident name, case, reasoning, or some assessment.")
      return
    }

    const payload = {
      ...form,
      total,
      globalRating,
      oneLineSummary,
      consultantReport,
      whatChangedSummary,
      residentEmail: residentEmail || null,
      submittedBy: user?.email || "resident-anonymous",
      submittedByRole: isEvaluator ? "evaluator" : "resident",
      universalCaseKey: selectedCaseKey || null,
      universalCaseTitle: selectedCase?.title || null,
      universalCaseSetting: selectedCase?.setting || null,
      traineeAnswer: traineeAnswer || null,
      benchmarkResult: benchmarkResult || null,
      overrideReflection: overrideReflection || null,
      overrideCompleted: overrideCompleted || false,
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
      whatChanged: record.whatChanged || { ...initialWhatChanged },
      structuredReasoning: record.structuredReasoning || "",
    })
    setSelectedCaseKey(record.universalCaseKey || "")
    setCaseSettingFilter(record.universalCaseSetting || "All")
    setEditingId(record.id)
    setTraineeAnswer(record.traineeAnswer || "")
    setBenchmarkResult(record.benchmarkResult || null)
    setOverrideReflection(record.overrideReflection || "")
    setOverrideCompleted(record.overrideCompleted || false)
    setFacultyMode(Boolean(record.overrideCompleted))
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

        {form.resident.trim() && currentResidentPattern && (
          <div className="hide-print" style={{ ...mutedCard, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Error Pattern Tracker</h2>
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "white",
                border: "1px solid #e2e8f0",
                marginBottom: 12,
              }}
            >
              <strong>{currentResidentPattern.message}</strong>
              <div style={{ marginTop: 8, color: "#475569" }}>
                Based on the most recent {currentResidentPattern.residentEvals.length} evaluation(s).
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {currentResidentPattern.domainStats.map((item) => (
                <div
                  key={item.key}
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <strong>{item.title}</strong>
                  <div style={{ marginTop: 6 }}>Average: {item.avg}/4</div>
                  <div>Low scores count: {item.lowCount}</div>
                </div>
              ))}
            </div>
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
                value={caseSettingFilter}
                onChange={(e) => {
                  stopVoiceTyping()
                  setCaseSettingFilter(e.target.value)
                  setSelectedCaseKey("")
                  setBenchmarkResult(null)
                  setTraineeAnswer("")
                  setFacultyMode(false)
                  setOverrideReflection("")
                  setOverrideCompleted(false)
                  setSpeechError("")
                }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  minWidth: 160,
                }}
              >
                <option value="All">All Settings</option>
                <option value="Inpatient">Inpatient</option>
                <option value="Outpatient">Outpatient</option>
              </select>

              <select
                value={selectedCaseKey}
                onChange={(e) => {
                  stopVoiceTyping()
                  setSelectedCaseKey(e.target.value)
                  setBenchmarkResult(null)
                  setTraineeAnswer("")
                  setFacultyMode(false)
                  setOverrideReflection("")
                  setOverrideCompleted(false)
                  setSpeechError("")
                }}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  minWidth: 280,
                }}
              >
                <option value="">Select a case</option>
                {filteredCases.map((c) => (
                  <option key={c.key} value={c.key}>
                    [{c.setting}] L{c.difficulty} {c.title}
                  </option>
                ))}
              </select>

              <button onClick={assignRandomCase} style={{ ...buttonBase, background: "#7c3aed" }}>
                Random Case
              </button>

              <button onClick={assignAdaptiveCase} style={{ ...buttonBase, background: "#0ea5e9" }}>
                Adaptive Case
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
                  Setting: {selectedCase.setting} · Difficulty: Level {selectedCase.difficulty} · Domain focus: {selectedCase.domainFocus}
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
                    onClick={autoFormatStructuredReasoning}
                    style={{ ...buttonBase, background: "#0f766e" }}
                  >
                    Auto-format Reasoning
                  </button>

                  <button
                    onClick={() => {
                      stopVoiceTyping()
                      setTraineeAnswer("")
                      setBenchmarkResult(null)
                      setOverrideReflection("")
                      setOverrideCompleted(false)
                      setFacultyMode(false)
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

                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 10,
                    background: "white",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h4 style={{ marginTop: 0 }}>Voice → Structured Reasoning</h4>
                  <textarea
                    rows={10}
                    value={form.structuredReasoning || ""}
                    onChange={(e) => handleField("structuredReasoning", e.target.value)}
                    placeholder="Auto-structured reasoning will appear here."
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid #cbd5e1",
                      background: "white",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {benchmarkResult && (
                  <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
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
                      <br />
                      <strong>Difficulty:</strong> Level {selectedCase?.difficulty}
                    </div>

                    {detectWrongQuestion(traineeAnswer) && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          fontWeight: 600,
                        }}
                      >
                        {detectWrongQuestion(traineeAnswer)}
                      </div>
                    )}

                    <div
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <strong>Reasoning Feedback</strong>
                      <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                        {getReasoningFeedback(traineeAnswer).map((f, i) => (
                          <div key={i}>• {f}</div>
                        ))}
                      </div>
                    </div>

                    {selectedCase?.isTrap && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                          color: "#7c2d12",
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ Trap Case: {selectedCase.trapMessage}
                      </div>
                    )}

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

                    {!overrideCompleted && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: "#fff7ed",
                          border: "1px solid #fed7aa",
                        }}
                      >
                        <h4 style={{ marginTop: 0 }}>Consultant Override Mode</h4>
                        <div style={{ color: "#7c2d12", marginBottom: 10 }}>
                          Before revealing the faculty answer, state what you would change after seeing this benchmark.
                        </div>

                        <textarea
                          rows={5}
                          value={overrideReflection}
                          onChange={(e) => setOverrideReflection(e.target.value)}
                          placeholder="What would you change in your framing, differential, interpretation, or plan?"
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

                        <button
                          onClick={revealFacultyAfterOverride}
                          style={{ ...buttonBase, background: "#b45309" }}
                        >
                          Reveal Faculty Answer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
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

        <div className="hide-print" style={{ ...mutedCard, marginBottom: 18 }}>
          <h2 style={{ marginTop: 0, fontSize: 20 }}>“What Changed Since Yesterday” Engine</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label><strong>Clinical status</strong></label>
              <input
                value={form.whatChanged?.clinicalStatus || ""}
                onChange={(e) => handleWhatChanged("clinicalStatus", e.target.value)}
                placeholder="Better / same / worse"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Events in last 24h</strong></label>
              <input
                value={form.whatChanged?.overnightEvents || ""}
                onChange={(e) => handleWhatChanged("overnightEvents", e.target.value)}
                placeholder="New symptoms, procedures, instability"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Vitals trend</strong></label>
              <input
                value={form.whatChanged?.vitalsTrend || ""}
                onChange={(e) => handleWhatChanged("vitalsTrend", e.target.value)}
                placeholder="Improved / stable / worsening"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Labs trend</strong></label>
              <input
                value={form.whatChanged?.labsTrend || ""}
                onChange={(e) => handleWhatChanged("labsTrend", e.target.value)}
                placeholder="Creatinine up, CRP down, K corrected"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Imaging / procedures</strong></label>
              <input
                value={form.whatChanged?.imagingProcedures || ""}
                onChange={(e) => handleWhatChanged("imagingProcedures", e.target.value)}
                placeholder="New CT, echo, line, drain, biopsy"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Consultant / plan changes</strong></label>
              <input
                value={form.whatChanged?.consultantChanges || ""}
                onChange={(e) => handleWhatChanged("consultantChanges", e.target.value)}
                placeholder="Antibiotics changed, anticoag started"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Discharge barriers</strong></label>
              <input
                value={form.whatChanged?.dischargeBarriers || ""}
                onChange={(e) => handleWhatChanged("dischargeBarriers", e.target.value)}
                placeholder="Pending IR, oxygen, social issue, placement"
                style={inputStyle}
              />
            </div>
            <div>
              <label><strong>Still on EDD?</strong></label>
              <select
                value={form.whatChanged?.stillOnEDD || "unknown"}
                onChange={(e) => handleWhatChanged("stillOnEDD", e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  marginTop: 6,
                  borderRadius: 10,
                  border: "1px solid #cbd5e1",
                  background: "white",
                  boxSizing: "border-box",
                }}
              >
                <option value="unknown">Not specified</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "white",
              border: "1px solid #e2e8f0",
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>Auto-summary</strong>
            <div style={{ marginTop: 8, color: whatChangedSummary ? "#0f172a" : "#64748b" }}>
              {whatChangedSummary || "Enter the fields above and the engine will build the update summary here."}
            </div>
          </div>
        </div>

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

          <div className="print-card" style={sectionCard}>
            <h2 style={{ marginTop: 0, fontSize: 20 }}>Radar Over Time</h2>
            <RadarOverTime evaluations={residentData} />
          </div>
        </div>

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
            <div className="hide-print" style={{ ...mutedCard, marginBottom: 18, padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, letterSpacing: 1.1, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>
                    Leadership Dashboard
                  </div>
                  <h2 style={{ margin: "6px 0 0", fontSize: 26 }}>Program Intelligence</h2>
                  <div style={{ color: "#475569", marginTop: 6 }}>
                    Turn CRFT activity into program-level decisions, resident coaching, and leadership-ready evidence.
                  </div>
                </div>

                <SegmentedTabs
                  value={dashboardView}
                  onChange={setDashboardView}
                  options={[
                    { value: "program", label: "Program Intelligence" },
                    { value: "residents", label: "Resident Profiles" },
                    { value: "log", label: "Assessment Log" },
                  ]}
                />
              </div>

              {dashboardView === "program" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <MetricCard label="Unique residents" value={programIntelligence.uniqueResidents} subvalue={`${cohortAnalytics.totalEvaluations} total assessments`} tone="primary" />
                    <MetricCard label="Average CRFT score" value={`${programIntelligence.avgTotal}/24`} subvalue={`${programIntelligence.improvingResidents} residents improved ≥2 points`} tone="success" />
                    <MetricCard label="Near consultant rate" value={`${programIntelligence.nearConsultantRate}%`} subvalue="Leadership-friendly outcome metric" tone="warning" />
                    <MetricCard label="Residents needing attention" value={programIntelligence.highRiskResidents.length} subvalue={`${programIntelligence.stagnantResidents} stagnant or declining`} tone={programIntelligence.highRiskResidents.length ? "danger" : "success"} />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.3fr 1fr",
                      gap: 16,
                      alignItems: "stretch",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Program score trend</h3>
                          <div style={{ color: "#64748b", marginTop: 4 }}>Average CRFT score by month</div>
                        </div>
                        <div style={{ ...chipStyle("#0c4a6e") }}>Leadership signal</div>
                      </div>
                      <MiniLineChart data={programIntelligence.monthlyTrend} max={24} color="#0c4a6e" suffix="/24" />
                    </div>

                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Program pressure points</h3>
                          <div style={{ color: "#64748b", marginTop: 4 }}>What leadership needs to act on now</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Weakest domain</div>
                          <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800 }}>{cohortAnalytics.weakestDomain || "—"}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Case mix</div>
                          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                            {(programIntelligence.settingCounts.length ? programIntelligence.settingCounts : [{ label: "No tagged cases yet", value: 0 }]).map((item) => (
                              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                <span>{item.label}</span>
                                <strong>{item.value}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                          <div style={{ fontWeight: 800, color: "#1d4ed8" }}>Leadership interpretation</div>
                          <div style={{ color: "#1e3a8a", marginTop: 6, lineHeight: 1.45 }}>
                            This page should answer three questions fast: Are we improving? Where are we weak? Which residents need coaching now?
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>Domain heatmap</h3>
                        <div style={{ color: "#64748b", marginTop: 4 }}>Program cognitive fingerprint</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Priority</span>
                        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 800 }}>Watch</span>
                        <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 800 }}>Strong</span>
                      </div>
                    </div>
                    <DomainHeatmap avgByDomain={cohortAnalytics.avgByDomain} />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Residents needing attention</h3>
                          <div style={{ color: "#64748b", marginTop: 4 }}>Early detection for coaching and remediation</div>
                        </div>
                      </div>
                      <RiskTable
                        residents={programIntelligence.highRiskResidents.slice(0, 8)}
                        onSelectResident={(resident) => {
                          setSelectedResident(resident)
                          setDashboardView("residents")
                        }}
                      />
                    </div>

                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <h3 style={{ margin: 0 }}>Top performers</h3>
                          <div style={{ color: "#64748b", marginTop: 4 }}>Residents with ≥2 assessments</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {(programIntelligence.leaderboard.length ? programIntelligence.leaderboard : [{ resident: "No leaderboard yet", avgScore: 0, delta: 0, count: 0 }]).map((resident, idx) => (
                          <div key={resident.resident} style={{ padding: 12, borderRadius: 12, background: idx === 0 ? "#eff6ff" : "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                              <div>
                                <div style={{ fontWeight: 800 }}>{idx + 1}. {resident.resident}</div>
                                <div style={{ color: "#64748b", marginTop: 4 }}>{resident.count} assessments</div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontWeight: 800 }}>{resident.avgScore}/24</div>
                                <div style={{ color: resident.delta > 0 ? "#047857" : resident.delta < 0 ? "#dc2626" : "#64748b", fontWeight: 700 }}>
                                  {resident.delta > 0 ? `+${resident.delta}` : resident.delta}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {dashboardView === "residents" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>
                    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                      <h3 style={{ marginTop: 0 }}>Resident profile</h3>
                      <div style={{ color: "#64748b", marginBottom: 12 }}>Type a resident name exactly as saved in evaluations.</div>
                      <input
                        placeholder="Resident name"
                        value={selectedResident}
                        onChange={(e) => setSelectedResident(e.target.value)}
                        style={{ ...inputStyle, marginTop: 0 }}
                      />

                      {selectedResident && (
                        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                          <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Assessments</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{residentData.length}</div>
                          </div>
                          <div style={{ padding: 12, borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                            <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", fontWeight: 800 }}>Average score</div>
                            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>{residentAverage}/24</div>
                          </div>
                          {latestResidentEval && (
                            <div style={{ padding: 12, borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                              <div style={{ fontSize: 12, color: "#1d4ed8", textTransform: "uppercase", fontWeight: 800 }}>Latest rating</div>
                              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: "#1e3a8a" }}>{latestResidentEval.globalRating || getGlobalRating(Number(latestResidentEval.total || latestResidentEval.totalScore || 0))}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                      {residentData.length >= 1 && latestResidentEval && (
                        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                            <div>
                              <h3 style={{ margin: 0 }}>Latest reasoning profile</h3>
                              <div style={{ color: "#64748b", marginTop: 4 }}>{selectedResident} · latest assessment</div>
                            </div>
                            <div style={{ ...chipStyle("#0f766e") }}>{latestResidentEval.total || latestResidentEval.totalScore || 0}/24</div>
                          </div>
                          <RadarChart scores={latestResidentEval.scores || initialScores} />
                        </div>
                      )}

                      {residentData.length >= 2 && (
                        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                          <h3 style={{ marginTop: 0 }}>Resident comparison over time</h3>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14 }}>
                            <MetricCard label="First score" value={`${firstResidentEval?.total || firstResidentEval?.totalScore || 0}/24`} subvalue={formatFirebaseDate(firstResidentEval?.createdAt)} />
                            <MetricCard label="Latest score" value={`${latestResidentEval?.total || latestResidentEval?.totalScore || 0}/24`} subvalue={formatFirebaseDate(latestResidentEval?.createdAt)} tone="primary" />
                            <MetricCard label="Net change" value={latestResidentEval ? `${(Number(latestResidentEval?.total || latestResidentEval?.totalScore || 0) - Number(firstResidentEval?.total || firstResidentEval?.totalScore || 0)) > 0 ? "+" : ""}${Number(latestResidentEval?.total || latestResidentEval?.totalScore || 0) - Number(firstResidentEval?.total || firstResidentEval?.totalScore || 0)}` : "0"} subvalue="Simple headline number" tone={(Number(latestResidentEval?.total || latestResidentEval?.totalScore || 0) - Number(firstResidentEval?.total || firstResidentEval?.totalScore || 0)) >= 0 ? "success" : "danger"} />
                          </div>

                          <div style={{ display: "grid", gap: 8 }}>
                            {comparison.map((c) => (
                              <div key={c.key} style={{ padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <strong>{c.title}</strong>
                                <div>
                                  {c.first} → {c.latest} <span style={{ color: c.diff > 0 ? "#16a34a" : c.diff < 0 ? "#dc2626" : "#475569", fontWeight: 800 }}>{c.diff > 0 ? `(+${c.diff})` : `(${c.diff})`}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {trendComments.length > 0 && (
                            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                              {trendComments.map((comment, idx) => (
                                <div key={idx} style={{ padding: 10, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>{comment}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {residentData.length >= 2 && (
                        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 16, padding: 16 }}>
                          <h3 style={{ marginTop: 0 }}>Domain trend over time</h3>
                          <RadarOverTime evaluations={residentData} />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {dashboardView === "log" && (
                <>
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
                    <h3 style={{ margin: 0 }}>Assessment log</h3>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => exportToCSV(evaluations)} style={{ ...buttonBase, background: "#0ea5e9" }}>
                        Export CSV
                      </button>

                      <input
                        placeholder="Search resident / case / evaluator / rotation / setting"
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        style={{ ...inputStyle, marginTop: 0, minWidth: 320 }}
                      />

                      <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                        style={{ padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}
                      >
                        <option>All</option>
                        <option>Junior</option>
                        <option>Intermediate</option>
                        <option>Senior</option>
                        <option>Near Consultant</option>
                      </select>
                    </div>
                  </div>

                  {filteredEvaluations.length === 0 ? (
                    <div style={{ padding: 12, borderRadius: 10, background: "white", border: "1px solid #e2e8f0" }}>
                      No matching evaluations.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {filteredEvaluations.map((e) => (
                        <div key={e.id} style={{ padding: 14, borderRadius: 14, background: "white", border: "1px solid #e2e8f0", boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ display: "grid", gap: 4 }}>
                              <div><strong>Resident:</strong> {e.resident || "—"}</div>
                              <div><strong>Case:</strong> {e.caseName || "—"}</div>
                              <div><strong>Setting:</strong> {e.universalCaseSetting || "—"}</div>
                              <div><strong>Rotation:</strong> {e.rotation || "—"}</div>
                              <div><strong>Evaluator:</strong> {e.evaluator || "—"}</div>
                              <div><strong>Score:</strong> {e.total || e.totalScore || 0}/24 {e.globalRating ? `· ${e.globalRating}` : ""}</div>
                              <div><strong>Date:</strong> {formatFirebaseDate(e.createdAt)}</div>
                              {e.universalCaseTitle && <div><strong>Universal case:</strong> {e.universalCaseTitle}</div>}
                              {e.benchmarkResult?.totalScore !== undefined && <div><strong>Benchmark:</strong> {e.benchmarkResult.totalScore}/100 · {e.benchmarkResult.level}</div>}
                              {e.overrideCompleted && <div><strong>Consultant override:</strong> completed</div>}
                              {e.whatChangedSummary && <div><strong>What changed:</strong> saved</div>}
                              {e.structuredReasoning && <div><strong>Structured reasoning:</strong> saved</div>}
                            </div>

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "start" }}>
                              <button onClick={() => loadEvaluation(e)} style={{ ...buttonBase, background: "#0f766e" }}>
                                Load into Form
                              </button>
                              <button onClick={() => handleDeleteEvaluation(e.id)} style={{ ...buttonBase, background: "#dc2626" }}>
                                Delete
                              </button>
                            </div>
                          </div>

                          {e.oneLineSummary && (
                            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                              <strong>Summary:</strong> {e.oneLineSummary}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

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

        <div style={{ textAlign: "right", color: "green", fontSize: 12, marginTop: 18 }}>
          Developed for KFSHRC-J IM residents
        </div>
      </div>
    </div>
  )
}
