import React, { useEffect, useMemo, useState } from "react";
import {
  ensureAnonymousAuth,
  subscribeToSessionConfig,
  saveSessionConfig,
  createSubmission,
  subscribeToSubmissions,
  deleteSubmissionById,
  getExistingSubmissionKeyMap,
} from "./firebase";

// ============================================================
// CRFT PHASE 1 - FIREBASE WIRED APP.JSX
// ============================================================

const RESIDENT_IDS = ["R1", "R2", "R3", "R4", "R5"];
const ROLES = ["Resident", "Evaluator", "Program Director"];
const PHASES = ["baseline", "intervention"];

const CRFT_DOMAINS = [
  "problemFraming",
  "syndromeIdentification",
  "differentialDiagnosis",
  "dataInterpretation",
  "anticipation",
  "reassessment",
];

const DOMAIN_LABELS = {
  problemFraming: "Problem Framing",
  syndromeIdentification: "Syndrome Identification",
  differentialDiagnosis: "Differential Diagnosis",
  dataInterpretation: "Data Interpretation",
  anticipation: "Anticipation",
  reassessment: "Reassessment",
};

const DOMAIN_ANCHORS_0_4 = {
  0: "Absent / unsafe / fundamentally flawed",
  1: "Major gaps / fragmented reasoning",
  2: "Partial / basic but incomplete",
  3: "Competent / organized / mostly appropriate",
  4: "Strong / high-quality / near-consultant reasoning",
};

const GLOBAL_RATING_LABELS = [
  { min: 0, max: 5, label: "Junior" },
  { min: 6, max: 11, label: "Early Developing" },
  { min: 12, max: 17, label: "Advanced Junior" },
  { min: 18, max: 21, label: "Senior-like" },
  { min: 22, max: 24, label: "Near Consultant" },
];

const COGNITIVE_BIASES = {
  anchoring: {
    id: "anchoring",
    label: "Anchoring Bias",
    feedback: (ctx) =>
      `You anchored early on ${ctx?.leadingDx || "an initial diagnosis"} and did not sufficiently adjust when later findings emerged. Expert reasoning reopens the differential when new data no longer fit the first impression.`,
  },
  prematureClosure: {
    id: "prematureClosure",
    label: "Premature Closure",
    feedback: () =>
      "You reached a diagnosis too early without adequately exploring alternatives. Expert reasoning keeps competing hypotheses alive until the data are strong enough to narrow safely.",
  },
  confirmationBias: {
    id: "confirmationBias",
    label: "Confirmation Bias",
    feedback: () =>
      "Your reasoning emphasized supportive data but did not sufficiently address conflicting findings. Expert reasoning actively tests whether the preferred diagnosis could be wrong.",
  },
  availabilityBias: {
    id: "availabilityBias",
    label: "Availability Bias",
    feedback: () =>
      "The diagnosis appears influenced by familiarity more than by the specific pattern in this case. Expert reasoning prioritizes what best fits the current data, not what is most familiar.",
  },
  representativenessError: {
    id: "representativenessError",
    label: "Representativeness Error",
    feedback: () =>
      "You seem to have rejected an important possibility because the case did not look classic. Expert reasoning allows for atypical presentations when the risk is high or the data still fit.",
  },
  failureToUpdate: {
    id: "failureToUpdate",
    label: "Failure to Update",
    feedback: () =>
      "New data should have shifted your diagnostic priorities, but your reasoning remained unchanged. Expert reasoning continuously updates probabilities as evidence evolves.",
  },
  wrongQuestionFraming: {
    id: "wrongQuestionFraming",
    label: "Wrong-Question Framing",
    feedback: () =>
      "Your reasoning focused on a secondary issue rather than the main clinical problem. Expert reasoning first defines the exact question that must be solved.",
  },
};

const REASONING_ERRORS = {
  missedLifeThreatening: {
    id: "missedLifeThreatening",
    label: "Missed Life-Threatening Diagnosis",
    feedback: (ctx) =>
      `A life-threatening diagnosis${
        ctx?.dangerousExpected?.length ? ` (${ctx.dangerousExpected.join(", ")})` : ""
      } was not considered or not prioritized appropriately. Expert reasoning rules out dangerous causes early before narrowing.`,
  },
  poorProblemRepresentation: {
    id: "poorProblemRepresentation",
    label: "Poor Problem Representation",
    feedback: () =>
      "Your case summary lacked enough clarity and prioritization to guide the next step. Expert reasoning starts with a concise, high-yield framing statement.",
  },
  weakDifferentialPrioritization: {
    id: "weakDifferentialPrioritization",
    label: "Weak Differential Prioritization",
    feedback: () =>
      "Your differential was either too limited or not sufficiently prioritized. Expert reasoning ranks diagnoses by both likelihood and danger.",
  },
  incorrectDataInterpretation: {
    id: "incorrectDataInterpretation",
    label: "Incorrect Data Interpretation",
    feedback: () =>
      "Some key data were misinterpreted or not integrated into the diagnostic reasoning. Expert reasoning ensures the interpretation of findings is accurate before action is taken.",
  },
  failureToAnticipate: {
    id: "failureToAnticipate",
    label: "Failure to Anticipate",
    feedback: () =>
      "Your plan did not sufficiently anticipate what could happen next. Expert reasoning includes contingency planning for likely deterioration or downstream consequences.",
  },
  unsafeIncompleteManagement: {
    id: "unsafeIncompleteManagement",
    label: "Unsafe / Incomplete Management",
    feedback: () =>
      "The management plan was incomplete or not appropriately prioritized. Expert management addresses urgent actions first and aligns them with the leading diagnostic possibilities.",
  },
  noReassessmentStrategy: {
    id: "noReassessmentStrategy",
    label: "No Reassessment Strategy",
    feedback: () =>
      "There was no clear reassessment plan. Expert reasoning includes how and when to check whether the current interpretation and management are working.",
  },
  overconfidenceMismatch: {
    id: "overconfidenceMismatch",
    label: "Overconfidence Mismatch",
    feedback: () =>
      "Your stated confidence was higher than the strength of the reasoning. Expert clinicians align confidence with uncertainty and the quality of available evidence.",
  },
};

const CASE_LIBRARY = [
  {
    id: "C1",
    title: "Acute Dyspnea Overnight",
    difficulty: "moderate",
    traps: ["anchoring on heart failure", "missing PE"],
    domainFocus: ["problemFraming", "differentialDiagnosis", "anticipation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "68-year-old man with HTN and CAD presents with acute nocturnal dyspnea, orthopnea, tachycardia, and hypoxemia.",
    hiddenRubric: {
      dangerousDiagnoses: ["pulmonary embolism", "pe", "acs", "flash pulmonary edema"],
      conceptMap: {
        problemFraming: ["acute", "dyspnea", "hypoxemia", "cardiopulmonary"],
        syndromeIdentification: [
          "acute cardiopulmonary syndrome",
          "acute decompensated heart failure",
          "pulmonary embolism syndrome",
        ],
        differentialDiagnosis: ["heart failure", "pulmonary embolism", "pe", "acs", "pneumonia"],
        dataInterpretation: ["bnp", "troponin", "crackles", "jvp", "interstitial opacities"],
        anticipation: ["deterioration", "respiratory failure", "hemodynamic worsening", "oxygen"],
        reassessment: ["repeat vitals", "oxygen response", "trend troponin", "reassess"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["heart failure"] },
      acceptedLeadingDiagnoses: ["acute heart failure", "pulmonary embolism", "acs with pulmonary edema"],
    },
  },
  {
    id: "C2",
    title: "Fever, Hypotension, and AKI",
    difficulty: "moderate",
    traps: ["narrowing too fast to UTI", "missing source control issue"],
    domainFocus: ["syndromeIdentification", "anticipation", "reassessment"],
    targetDomains: CRFT_DOMAINS,
    vignette: "72-year-old woman presents with fever, confusion, hypotension, elevated lactate, and AKI.",
    hiddenRubric: {
      dangerousDiagnoses: ["septic shock", "obstructive infection", "adrenal crisis"],
      conceptMap: {
        problemFraming: ["shock", "infection", "aki", "altered mental status"],
        syndromeIdentification: ["septic shock", "distributive shock", "sepsis"],
        differentialDiagnosis: ["urosepsis", "biliary sepsis", "pneumonia", "adrenal crisis"],
        dataInterpretation: ["lactate", "creatinine", "hypotension", "urinalysis"],
        anticipation: ["vasopressors", "source control", "icu", "fluid response"],
        reassessment: ["repeat lactate", "map", "urine output", "cultures"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: {},
      acceptedLeadingDiagnoses: ["septic shock", "urosepsis", "biliary sepsis"],
    },
  },
  {
    id: "C3",
    title: "Chest Pain with Mild Troponin Rise",
    difficulty: "moderate",
    traps: ["labeling as reflux", "ignoring ACS"],
    domainFocus: ["problemFraming", "dataInterpretation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "59-year-old man with diabetes presents with exertional chest pressure, diaphoresis, and a mild rise in troponin.",
    hiddenRubric: {
      dangerousDiagnoses: ["acs", "nstemi", "aortic dissection", "pulmonary embolism"],
      conceptMap: {
        problemFraming: ["chest pain", "ischemic", "troponin", "high risk"],
        syndromeIdentification: ["acute coronary syndrome", "acs", "nste-acs"],
        differentialDiagnosis: ["nstemi", "unstable angina", "aortic dissection", "pe", "gerd"],
        dataInterpretation: ["troponin", "ecg", "ischemia", "risk factors"],
        anticipation: ["arrhythmia", "hemodynamic instability", "telemetry", "cardiology"],
        reassessment: ["repeat ecg", "repeat troponin", "serial assessment"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["gerd", "reflux"] },
      acceptedLeadingDiagnoses: ["acs", "nste-acs", "unstable angina", "nstemi"],
    },
  },
  {
    id: "C4",
    title: "Confusion and Severe Hyponatremia",
    difficulty: "moderate",
    traps: ["treating the sodium number only", "not classifying tonicity/volume status"],
    domainFocus: ["syndromeIdentification", "dataInterpretation", "reassessment"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "76-year-old woman presents with confusion and falls. Sodium is 116 mmol/L, serum osmolality is low, and urine osmolality is high.",
    hiddenRubric: {
      dangerousDiagnoses: ["symptomatic hyponatremia", "seizure risk", "osmotic demyelination risk"],
      conceptMap: {
        problemFraming: ["confusion", "falls", "severe hyponatremia", "symptomatic"],
        syndromeIdentification: ["hypotonic hyponatremia", "euvolemic hyponatremia", "siadh"],
        differentialDiagnosis: ["siadh", "thiazide", "adrenal insufficiency", "hypothyroidism"],
        dataInterpretation: ["serum osmolality", "urine osmolality", "urine sodium", "severity"],
        anticipation: ["seizure", "overcorrection", "hypertonic saline", "monitoring"],
        reassessment: ["repeat sodium", "correction rate", "q4h", "recheck"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: {},
      acceptedLeadingDiagnoses: ["symptomatic hypotonic hyponatremia", "siadh", "thiazide-associated hyponatremia"],
    },
  },
  {
    id: "C5",
    title: "Jaundice with RUQ Pain",
    difficulty: "moderate",
    traps: ["calling it hepatitis only", "missing cholangitis"],
    domainFocus: ["differentialDiagnosis", "anticipation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "63-year-old patient has fever, jaundice, RUQ pain, leukocytosis, and cholestatic liver tests.",
    hiddenRubric: {
      dangerousDiagnoses: ["ascending cholangitis", "septic shock"],
      conceptMap: {
        problemFraming: ["fever", "jaundice", "ruq pain", "cholestatic"],
        syndromeIdentification: ["ascending cholangitis", "biliary sepsis"],
        differentialDiagnosis: ["ascending cholangitis", "choledocholithiasis", "acute cholecystitis", "hepatitis"],
        dataInterpretation: ["bilirubin", "alp", "ast", "alt", "leukocytosis"],
        anticipation: ["ercp", "source control", "sepsis", "hemodynamic worsening"],
        reassessment: ["fever trend", "bilirubin trend", "post drainage assessment"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["hepatitis"] },
      acceptedLeadingDiagnoses: ["ascending cholangitis", "choledocholithiasis with infection"],
    },
  },
  {
    id: "C6",
    title: "Leg Swelling and Pleuritic Pain",
    difficulty: "moderate",
    traps: ["calling it cellulitis only", "missing VTE"],
    domainFocus: ["problemFraming", "differentialDiagnosis", "anticipation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "44-year-old woman with unilateral leg swelling develops pleuritic chest pain and tachycardia two days later.",
    hiddenRubric: {
      dangerousDiagnoses: ["pulmonary embolism", "massive pe"],
      conceptMap: {
        problemFraming: ["unilateral leg swelling", "pleuritic chest pain", "tachycardia"],
        syndromeIdentification: ["venous thromboembolism", "pulmonary embolism"],
        differentialDiagnosis: ["pe", "dvt", "cellulitis", "pneumonia", "acs"],
        dataInterpretation: ["risk factors", "tachycardia", "hypoxemia", "d-dimer"],
        anticipation: ["hemodynamic collapse", "anticoagulation", "ctpa", "right heart strain"],
        reassessment: ["oxygen", "vitals", "bleeding risk", "response to therapy"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["cellulitis", "musculoskeletal"] },
      acceptedLeadingDiagnoses: ["pulmonary embolism", "venous thromboembolism", "dvt with pe"],
    },
  },
  {
    id: "C7",
    title: "GI Bleeding on Anticoagulation",
    difficulty: "moderate",
    traps: ["stopping all therapy without plan", "missing resuscitation priorities"],
    domainFocus: ["anticipation", "reassessment"],
    targetDomains: CRFT_DOMAINS,
    vignette: "70-year-old man on apixaban presents with melena, orthostasis, Hb 78 g/L, and rising BUN.",
    hiddenRubric: {
      dangerousDiagnoses: ["hemorrhagic shock", "massive gi bleed"],
      conceptMap: {
        problemFraming: ["melena", "orthostasis", "anemia", "anticoagulation"],
        syndromeIdentification: ["upper gi bleeding", "acute blood loss"],
        differentialDiagnosis: ["peptic ulcer bleed", "variceal bleed", "malignancy", "avm"],
        dataInterpretation: ["hb", "bun", "hemodynamics", "ongoing bleeding"],
        anticipation: ["transfusion", "endoscopy", "reversal", "shock"],
        reassessment: ["repeat hb", "vitals", "ongoing melena", "response"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: {},
      acceptedLeadingDiagnoses: ["upper gi bleed", "anticoagulant-associated gi bleeding"],
    },
  },
  {
    id: "C8",
    title: "New Delirium on the Ward",
    difficulty: "moderate",
    traps: ["calling it age only", "not searching for precipitant"],
    domainFocus: ["problemFraming", "reassessment"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "81-year-old inpatient becomes acutely confused overnight after urinary retention, constipation, and a new sedating medication.",
    hiddenRubric: {
      dangerousDiagnoses: ["delirium due to sepsis", "stroke", "medication toxicity"],
      conceptMap: {
        problemFraming: ["acute confusion", "delirium", "hospitalized", "precipitant"],
        syndromeIdentification: ["delirium", "toxic metabolic encephalopathy"],
        differentialDiagnosis: ["medication effect", "urinary retention", "constipation", "infection", "stroke"],
        dataInterpretation: ["acute onset", "attention", "retention", "med changes"],
        anticipation: ["falls", "aspiration", "self-harm", "deconditioning"],
        reassessment: ["review meds", "bladder scan", "repeat neuro exam", "follow mentation"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: {},
      acceptedLeadingDiagnoses: ["delirium", "multifactorial delirium"],
    },
  },
  {
    id: "C9",
    title: "Metabolic Acidosis with Tachypnea",
    difficulty: "moderate",
    traps: ["calling it sepsis only", "missing DKA"],
    domainFocus: ["syndromeIdentification", "dataInterpretation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "28-year-old patient with diabetes presents with abdominal pain, vomiting, tachypnea, glucose 28 mmol/L, and high anion gap metabolic acidosis.",
    hiddenRubric: {
      dangerousDiagnoses: ["dka", "severe acidosis", "cerebral edema"],
      conceptMap: {
        problemFraming: ["diabetes", "abdominal pain", "tachypnea", "anion gap"],
        syndromeIdentification: ["dka", "high anion gap metabolic acidosis"],
        differentialDiagnosis: ["dka", "sepsis", "toxic alcohol", "lactic acidosis"],
        dataInterpretation: ["anion gap", "ketones", "glucose", "potassium", "bicarbonate"],
        anticipation: ["potassium drop", "insulin", "icu", "cerebral edema"],
        reassessment: ["anion gap closure", "glucose", "potassium", "repeat gas"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["sepsis"] },
      acceptedLeadingDiagnoses: ["dka", "diabetic ketoacidosis"],
    },
  },
  {
    id: "C10",
    title: "Sudden Back Pain and Hypotension",
    difficulty: "high",
    traps: ["assuming renal colic", "missing aortic catastrophe"],
    domainFocus: ["differentialDiagnosis", "anticipation"],
    targetDomains: CRFT_DOMAINS,
    vignette:
      "74-year-old man with vascular disease presents with sudden severe back pain, diaphoresis, hypotension, and a pulsatile abdominal mass.",
    hiddenRubric: {
      dangerousDiagnoses: ["ruptured aaa", "aortic dissection"],
      conceptMap: {
        problemFraming: ["sudden back pain", "hypotension", "vascular disease", "pulsatile mass"],
        syndromeIdentification: ["aortic catastrophe", "ruptured aaa"],
        differentialDiagnosis: ["ruptured aaa", "aortic dissection", "renal colic", "mesenteric ischemia"],
        dataInterpretation: ["shock", "pulsatile mass", "abdominal pain", "hemodynamics"],
        anticipation: ["death", "massive hemorrhage", "vascular surgery", "resuscitation"],
        reassessment: ["hemodynamics", "blood products", "operative readiness"],
      },
      dangerousMissPenalty: { penaltyPoints: 3 },
      biasTriggers: {},
      acceptedLeadingDiagnoses: ["ruptured aaa", "aortic catastrophe"],
    },
  },
];

const defaultSession = {
  sessionCode: "CRFT-001",
  isOpen: true,
  dayIndex: 1,
  phase: "baseline",
  currentCaseId: "C1",
};

const emptyResidentResponse = {
  role: "Resident",
  residentId: "R1",
  pgy: "PGY1",
  confidence: 50,
  leadingDiagnosis: "",
  freeText: "",
  startedAt: null,
  submittedAt: null,
  timeSeconds: 0,
};

const emptyManualScoring = () => ({
  evaluatorId: "Evaluator-1",
  domainScores: Object.fromEntries(CRFT_DOMAINS.map((d) => [d, 0])),
  selectedBiasTags: [],
  selectedErrorTags: [],
  comments: "",
});

function normalize(text) {
  return (text || "").toLowerCase().trim();
}
function includesAny(text, phrases = []) {
  const normalized = normalize(text);
  return phrases.some((p) => normalized.includes(normalize(p)));
}
function countHits(text, phrases = []) {
  const normalized = normalize(text);
  return phrases.filter((p) => normalized.includes(normalize(p))).length;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function sumDomainScores(scores) {
  return CRFT_DOMAINS.reduce((acc, d) => acc + (Number(scores?.[d]) || 0), 0);
}
function getGlobalRating(total) {
  return GLOBAL_RATING_LABELS.find((r) => total >= r.min && total <= r.max)?.label || "Unclassified";
}
function getAgreementClass(diff) {
  if (diff <= 2) return "high";
  if (diff <= 5) return "moderate";
  return "low";
}
function exactMatchCount(autoScores, manualScores) {
  return CRFT_DOMAINS.filter((d) => Number(autoScores[d]) === Number(manualScores[d])).length;
}
function scoreDomainFromConcepts(text, conceptList = []) {
  const hits = countHits(text, conceptList);
  if (hits === 0) return 0;
  if (hits === 1) return 1;
  if (hits === 2) return 2;
  if (hits === 3) return 3;
  return 4;
}
function detectBiasTags(response, caseObj, domainScores) {
  const text = normalize(response.freeText);
  const tags = [];

  if (caseObj.hiddenRubric.biasTriggers?.anchoring && response.leadingDiagnosis) {
    const leadingLower = normalize(response.leadingDiagnosis);
    const dangerousMentioned = includesAny(text, caseObj.hiddenRubric.dangerousDiagnoses || []);
    if (leadingLower && !dangerousMentioned && includesAny(leadingLower, caseObj.hiddenRubric.biasTriggers.anchoring)) {
      tags.push("anchoring");
    }
  }
  if ((caseObj.hiddenRubric.acceptedLeadingDiagnoses?.length || 0) > 0) {
    if (domainScores.differentialDiagnosis <= 1) tags.push("prematureClosure");
  }
  if (domainScores.dataInterpretation <= 1 && domainScores.differentialDiagnosis >= 2) tags.push("confirmationBias");
  if (domainScores.problemFraming <= 1) tags.push("wrongQuestionFraming");
  if (domainScores.dataInterpretation <= 1 && domainScores.reassessment <= 1) tags.push("failureToUpdate");

  return [...new Set(tags)].slice(0, 3);
}
function detectErrorTags(response, caseObj, domainScores, dangerousMiss) {
  const tags = [];
  if (dangerousMiss) tags.push("missedLifeThreatening");
  if (domainScores.problemFraming <= 1) tags.push("poorProblemRepresentation");
  if (domainScores.differentialDiagnosis <= 1) tags.push("weakDifferentialPrioritization");
  if (domainScores.dataInterpretation <= 1) tags.push("incorrectDataInterpretation");
  if (domainScores.anticipation <= 1) tags.push("failureToAnticipate");
  if (domainScores.reassessment <= 1) tags.push("noReassessmentStrategy");
  if (Number(response.confidence) >= 80 && sumDomainScores(domainScores) <= 10) tags.push("overconfidenceMismatch");
  if (domainScores.anticipation <= 1 || domainScores.reassessment <= 1) tags.push("unsafeIncompleteManagement");
  return [...new Set(tags)].slice(0, 5);
}
function computeDangerousMiss(response, caseObj) {
  const text = normalize(`${response.leadingDiagnosis} ${response.freeText}`);
  const expectedDangerous = caseObj.hiddenRubric.dangerousDiagnoses || [];
  if (!expectedDangerous.length) return false;
  return !includesAny(text, expectedDangerous);
}
function autoScoreSubmission(response, caseObj) {
  const text = `${response.leadingDiagnosis} ${response.freeText}`;
  const conceptMap = caseObj.hiddenRubric.conceptMap;
  const domainScores = {
    problemFraming: scoreDomainFromConcepts(text, conceptMap.problemFraming),
    syndromeIdentification: scoreDomainFromConcepts(text, conceptMap.syndromeIdentification),
    differentialDiagnosis: scoreDomainFromConcepts(text, conceptMap.differentialDiagnosis),
    dataInterpretation: scoreDomainFromConcepts(text, conceptMap.dataInterpretation),
    anticipation: scoreDomainFromConcepts(text, conceptMap.anticipation),
    reassessment: scoreDomainFromConcepts(text, conceptMap.reassessment),
  };
  const dangerousMiss = computeDangerousMiss(response, caseObj);
  let total = sumDomainScores(domainScores);
  if (dangerousMiss) {
    total = clamp(total - (caseObj.hiddenRubric.dangerousMissPenalty?.penaltyPoints || 0), 0, 24);
  }
  return {
    domainScores,
    total,
    globalRating: getGlobalRating(total),
    dangerousMiss,
    biasTags: detectBiasTags(response, caseObj, domainScores),
    errorTags: detectErrorTags(response, caseObj, domainScores, dangerousMiss),
  };
}
function buildStrengths(domainScores) {
  return CRFT_DOMAINS.filter((d) => domainScores[d] >= 3).map((d) => DOMAIN_LABELS[d]);
}

function computeBenchmark(caseObj, response, autoResult) {
  const text = normalize(`${response.leadingDiagnosis} ${response.freeText}`);
  const mustHits = caseObj.hiddenRubric.conceptMap || {};
  const acceptedLeadingDiagnoses = caseObj.hiddenRubric.acceptedLeadingDiagnoses || [];

  const domainHitCounts = Object.fromEntries(
    CRFT_DOMAINS.map((d) => {
      const phrases = mustHits[d] || [];
      return [d, countHits(text, phrases)];
    })
  );

  const domainTargetCounts = Object.fromEntries(
    CRFT_DOMAINS.map((d) => [d, (mustHits[d] || []).length])
  );

  const domainPercentages = Object.fromEntries(
    CRFT_DOMAINS.map((d) => {
      const denom = domainTargetCounts[d] || 0;
      const pct = denom ? Math.round((domainHitCounts[d] / denom) * 100) : 0;
      return [d, pct];
    })
  );

  const allMustHits = Object.values(mustHits).flat();
  const totalHitCount = countHits(text, allMustHits);
  const totalTargetCount = allMustHits.length || 0;
  const benchmarkPercent = totalTargetCount ? Math.round((totalHitCount / totalTargetCount) * 100) : 0;

  const missedMustHits = [...new Set(allMustHits.filter((p) => !text.includes(normalize(p))))].slice(0, 8);
  const leadingDxAccepted = acceptedLeadingDiagnoses.length
    ? includesAny(response.leadingDiagnosis, acceptedLeadingDiagnoses)
    : false;

  let competencyLevel = "Needs major support";
  if (benchmarkPercent >= 80) competencyLevel = "Strong alignment";
  else if (benchmarkPercent >= 60) competencyLevel = "Competent alignment";
  else if (benchmarkPercent >= 40) competencyLevel = "Partial alignment";

  return {
    benchmarkPercent,
    competencyLevel,
    leadingDxAccepted,
    missedMustHits,
    domainHitCounts,
    domainTargetCounts,
    domainPercentages,
  };
}
function buildWeakestDomain(domainScores) {
  return [...CRFT_DOMAINS].sort((a, b) => domainScores[a] - domainScores[b])[0];
}
function buildFeedback({ response, caseObj, autoResult, manualResult }) {
  const strengths = buildStrengths(autoResult.domainScores);
  const weakest = buildWeakestDomain(autoResult.domainScores);
  const biasFeedback = autoResult.biasTags
    .map((tag) => COGNITIVE_BIASES[tag]?.feedback({ leadingDx: response.leadingDiagnosis, dangerousExpected: caseObj.hiddenRubric.dangerousDiagnoses }))
    .filter(Boolean)
    .slice(0, 2);
  const errorFeedback = autoResult.errorTags
    .map((tag) => REASONING_ERRORS[tag]?.feedback({ dangerousExpected: caseObj.hiddenRubric.dangerousDiagnoses }))
    .filter(Boolean)
    .slice(0, 3);

  const benchmark = computeBenchmark(caseObj, response, autoResult);

  return [
    strengths.length ? `Strengths: ${strengths.join(", ")}.` : "Strengths: You engaged with the case, but the reasoning structure needs more organization.",
    `Benchmark alignment: ${benchmark.benchmarkPercent}% (${benchmark.competencyLevel}).`,
    benchmark.leadingDxAccepted ? "Leading diagnosis matched the accepted benchmark set." : "Leading diagnosis did not clearly match the accepted benchmark set.",
    benchmark.missedMustHits.length ? `Key missed benchmark concepts: ${benchmark.missedMustHits.slice(0, 4).join(", ")}.` : "All major benchmark concepts were represented.",
    autoResult.dangerousMiss
      ? "Critical miss: a dangerous diagnosis should have been considered earlier in the reasoning process."
      : "Safety signal: no dangerous-miss flag was triggered.",
    ...biasFeedback,
    ...errorFeedback,
    `Priority for the next case: improve ${DOMAIN_LABELS[weakest].toLowerCase()} by making your reasoning more explicit and better prioritized.`,
    manualResult ? `Calibration: manual total ${manualResult.total}/24 vs auto total ${autoResult.total}/24.` : "Calibration: manual review pending.",
  ].join(" ");
}
function buildManualResult(manual) {
  const total = sumDomainScores(manual.domainScores);
  return { ...manual, total, globalRating: getGlobalRating(total) };
}
function buildCalibration(autoResult, manualResult) {
  const totalDifference = Math.abs((autoResult?.total || 0) - (manualResult?.total || 0));
  const domainDifferences = Object.fromEntries(CRFT_DOMAINS.map((d) => [d, Math.abs((autoResult?.domainScores?.[d] || 0) - (manualResult?.domainScores?.[d] || 0))]));
  return {
    totalDifference,
    domainDifferences,
    agreementClass: getAgreementClass(totalDifference),
    exactMatchDomains: exactMatchCount(autoResult.domainScores, manualResult.domainScores),
  };
}
function buildSubmissionRecord({ session, caseObj, response, autoResult, manualResult, calibration, feedbackText, benchmark }) {
  return {
    sessionCode: session.sessionCode,
    sessionDay: session.dayIndex,
    phase: session.phase,
    caseId: caseObj.id,
    caseTitle: caseObj.title,
    residentId: response.residentId,
    pgy: response.pgy,
    role: response.role,
    confidence: Number(response.confidence),
    leadingDiagnosis: response.leadingDiagnosis,
    freeText: response.freeText,
    timeSeconds: Number(response.timeSeconds),
    startedAt: response.startedAt,
    submittedAt: response.submittedAt,
    autoDomainScores: autoResult.domainScores,
    autoTotal: autoResult.total,
    autoGlobalRating: autoResult.globalRating,
    autoBiasTags: autoResult.biasTags,
    autoErrorTags: autoResult.errorTags,
    dangerousMiss: autoResult.dangerousMiss,
    manualDomainScores: manualResult?.domainScores || null,
    manualTotal: manualResult?.total || null,
    manualGlobalRating: manualResult?.globalRating || null,
    manualBiasTags: manualResult?.selectedBiasTags || [],
    manualErrorTags: manualResult?.selectedErrorTags || [],
    manualComments: manualResult?.comments || "",
    calibration: calibration || null,
    benchmark: benchmark || null,
    feedbackText,
    exportFlat: {
      ...Object.fromEntries(CRFT_DOMAINS.map((d) => [`auto_${d}`, autoResult.domainScores[d]])),
      ...Object.fromEntries(CRFT_DOMAINS.map((d) => [`manual_${d}`, manualResult?.domainScores?.[d] ?? ""])),
      autoTotal: autoResult.total,
      manualTotal: manualResult?.total ?? "",
      calibrationTotalDifference: calibration?.totalDifference ?? "",
      agreementClass: calibration?.agreementClass ?? "",
      benchmarkPercent: benchmark?.benchmarkPercent ?? "",
      benchmarkCompetencyLevel: benchmark?.competencyLevel ?? "",
      benchmarkLeadingDxAccepted: benchmark?.leadingDxAccepted ?? "",
    },
  };
}
function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function computeResidentProfile(records, residentId) {
  const mine = records.filter((r) => r.residentId === residentId);
  return {
    residentId,
    assessments: mine.length,
    avgAutoTotal: average(mine.map((r) => r.autoTotal)),
    avgManualTotal: average(mine.map((r) => r.manualTotal).filter((n) => Number.isFinite(n))),
    dangerousMissRate: average(mine.map((r) => (r.dangerousMiss ? 1 : 0))),
    avgConfidence: average(mine.map((r) => r.confidence)),
    avgTimeSeconds: average(mine.map((r) => r.timeSeconds)),
    weakestDomain: [...CRFT_DOMAINS].sort((a, b) => average(mine.map((r) => r.autoDomainScores[a])) - average(mine.map((r) => r.autoDomainScores[b])))[0],
  };
}
function toCsv(records) {
  if (!records.length) return "";
  const headers = [
    "sessionCode", "sessionDay", "phase", "caseId", "caseTitle", "residentId", "pgy", "confidence", "leadingDiagnosis", "timeSeconds",
    ...CRFT_DOMAINS.map((d) => `auto_${d}`), "autoTotal", "autoGlobalRating",
    ...CRFT_DOMAINS.map((d) => `manual_${d}`), "manualTotal", "manualGlobalRating",
    "dangerousMiss", "autoBiasTags", "autoErrorTags", "manualBiasTags", "manualErrorTags",
    "calibrationTotalDifference", "agreementClass", "benchmarkPercent", "benchmarkCompetencyLevel", "benchmarkLeadingDxAccepted", "feedbackText",
  ];
  const rows = records.map((r) => [
    r.sessionCode, r.sessionDay, r.phase, r.caseId, r.caseTitle, r.residentId, r.pgy, r.confidence,
    JSON.stringify(r.leadingDiagnosis || ""), r.timeSeconds,
    ...CRFT_DOMAINS.map((d) => r.autoDomainScores[d]), r.autoTotal, r.autoGlobalRating,
    ...CRFT_DOMAINS.map((d) => r.manualDomainScores?.[d] ?? ""), r.manualTotal ?? "", r.manualGlobalRating ?? "",
    r.dangerousMiss, JSON.stringify(r.autoBiasTags), JSON.stringify(r.autoErrorTags),
    JSON.stringify(r.manualBiasTags || []), JSON.stringify(r.manualErrorTags || []),
    r.calibration?.totalDifference ?? "", r.calibration?.agreementClass ?? "",
    r.benchmark?.benchmarkPercent ?? "", r.benchmark?.competencyLevel ?? "", r.benchmark?.leadingDxAccepted ?? "",
    JSON.stringify(r.feedbackText || ""),
  ]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
}
function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
function Button({ children, onClick, variant = "primary", className = "", disabled = false }) {
  const styles = variant === "primary" ? "bg-slate-900 text-white" : variant === "secondary" ? "border border-slate-300 bg-white text-slate-900" : "bg-slate-100 text-slate-900";
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-2xl px-4 py-2 text-sm font-medium shadow-sm ${styles} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}>
      {children}
    </button>
  );
}
function Card({ title, children, right }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function App() {
  const [session, setSession] = useState(defaultSession);
  const [response, setResponse] = useState({ ...emptyResidentResponse, startedAt: new Date().toISOString() });
  const [manual, setManual] = useState(emptyManualScoring());
  const [records, setRecords] = useState([]);
  const [submittedKeys, setSubmittedKeys] = useState({});
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSession, setSavingSession] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [accessGranted, setAccessGranted] = useState(false);

  function enterResident() {
    setSelectedRole("Resident");
    setResponse((r) => ({ ...r, role: "Resident" }));
    setAccessGranted(true);
  }

  function enterEvaluator() {
    setSelectedRole("Evaluator");
    setResponse((r) => ({ ...r, role: "Evaluator" }));
    setAccessGranted(true);
  }

  function enterProgramDirector() {
    setSelectedRole("Program Director");
    setResponse((r) => ({ ...r, role: "Program Director" }));
    setAccessGranted(true);
  }

  function backToRoleSelect() {
    setAccessGranted(false);
    setSelectedRole("");
  }

  const currentCase = useMemo(() => CASE_LIBRARY.find((c) => c.id === session.currentCaseId) || CASE_LIBRARY[0], [session.currentCaseId]);
  const submissionKey = `${session.sessionCode}-${session.dayIndex}-${response.residentId}`;

  const autoResult = useMemo(() => autoScoreSubmission(response, currentCase), [response, currentCase]);
  const manualResult = useMemo(() => buildManualResult(manual), [manual]);
  const calibration = useMemo(() => buildCalibration(autoResult, manualResult), [autoResult, manualResult]);
  const benchmark = useMemo(() => computeBenchmark(currentCase, response, autoResult), [currentCase, response, autoResult]);
  const feedbackText = useMemo(() => buildFeedback({ response, caseObj: currentCase, autoResult, manualResult }), [response, currentCase, autoResult, manualResult]);

  useEffect(() => {
    let unsubSession = null;
    let unsubSubmissions = null;

    async function boot() {
      try {
        await ensureAnonymousAuth();
        const keyMap = await getExistingSubmissionKeyMap();
        setSubmittedKeys(keyMap);
        unsubSession = subscribeToSessionConfig((remoteSession) => {
          if (remoteSession) {
            setSession((prev) => ({
              ...prev,
              sessionCode: remoteSession.sessionCode ?? prev.sessionCode,
              isOpen: remoteSession.isOpen ?? prev.isOpen,
              dayIndex: remoteSession.dayIndex ?? prev.dayIndex,
              phase: remoteSession.phase ?? prev.phase,
              currentCaseId: remoteSession.currentCaseId ?? prev.currentCaseId,
            }));
          } else {
            saveSessionConfig(defaultSession).catch(() => {});
          }
        });
        unsubSubmissions = subscribeToSubmissions((rows) => {
          setRecords(rows);
          const nextKeyMap = {};
          rows.forEach((row) => {
            nextKeyMap[`${row.sessionCode}-${row.sessionDay}-${row.residentId}`] = row.id;
          });
          setSubmittedKeys(nextKeyMap);
        });
        setFirebaseReady(true);
      } catch (e) {
        console.error(e);
        setSaveError("Firebase setup failed. Check config and auth.");
      } finally {
        setLoading(false);
      }
    }

    boot();
    return () => {
      if (unsubSession) unsubSession();
      if (unsubSubmissions) unsubSubmissions();
    };
  }, []);

  async function persistSession(nextSession) {
    setSession(nextSession);
    if (!firebaseReady) return;
    try {
      setSavingSession(true);
      setSaveError("");
      await saveSessionConfig(nextSession);
    } catch (e) {
      console.error(e);
      setSaveError("Failed to save session config.");
    } finally {
      setSavingSession(false);
    }
  }

  function resetResidentForm() {
    setResponse({
      ...emptyResidentResponse,
      residentId: response.residentId,
      startedAt: new Date().toISOString(),
    });
    setManual(emptyManualScoring());
  }

  async function handleSubmitResident() {
    if (!session.isOpen) {
      alert("Session is closed.");
      return;
    }
    if (submittedKeys[submissionKey]) {
      alert("This resident already submitted for this session/day.");
      return;
    }
    const finalResponse = {
      ...response,
      submittedAt: new Date().toISOString(),
      timeSeconds: response.timeSeconds || 180,
    };
    const finalAuto = autoScoreSubmission(finalResponse, currentCase);
    const finalManual = buildManualResult(manual);
    const finalCalibration = buildCalibration(finalAuto, finalManual);
    const finalFeedback = buildFeedback({
      response: finalResponse,
      caseObj: currentCase,
      autoResult: finalAuto,
      manualResult: finalManual,
    });
    const finalBenchmark = computeBenchmark(currentCase, finalResponse, finalAuto);
    const record = buildSubmissionRecord({
      session,
      caseObj: currentCase,
      response: finalResponse,
      autoResult: finalAuto,
      manualResult: finalManual,
      calibration: finalCalibration,
      feedbackText: finalFeedback,
      benchmark: finalBenchmark,
    });

    try {
      await createSubmission(record);
      alert("Submission saved to Firebase.");
      resetResidentForm();
    } catch (e) {
      console.error(e);
      alert("Failed to save submission to Firebase.");
    }
  }

  async function handleDeleteRecord(id) {
    try {
      await deleteSubmissionById(id);
    } catch (e) {
      console.error(e);
      alert("Failed to delete record.");
    }
  }

  const residentProfiles = useMemo(() => RESIDENT_IDS.map((id) => computeResidentProfile(records, id)), [records]);

  const totalAssessments = records.length;
  const avgAutoScore = average(records.map((r) => r.autoTotal));
  const avgGap = average(records.map((r) => r.calibration?.totalDifference || 0));
  const dangerousMissRate = average(records.map((r) => (r.dangerousMiss ? 1 : 0)));
  const weakestDomainOverall = [...CRFT_DOMAINS].sort(
    (a, b) =>
      average(records.map((r) => r.autoDomainScores?.[a] || 0)) -
      average(records.map((r) => r.autoDomainScores?.[b] || 0))
  )[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Loading CRFT app…</h1>
          <p className="mt-2 text-sm text-slate-600">Initializing Firebase, session config, and submissions.</p>
        </div>
      </div>
    );
  }

  if (!accessGranted) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-5xl space-y-6">
          <section className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="text-3xl font-bold">CRFT Phase 1 Integrated App</h1>
            <p className="mt-3 text-sm text-slate-600">
              Choose how you want to enter the system.
            </p>
          </section>

          <div className="grid gap-6 md:grid-cols-3">
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Resident</h2>
              <p className="mt-3 text-sm text-slate-600">
                Enter cases, submit reasoning, and receive structured feedback.
              </p>
              <button
                onClick={enterResident}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm"
              >
                Enter as Resident
              </button>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Evaluator</h2>
              <p className="mt-3 text-sm text-slate-600">
                Review resident performance, assign manual scores, and track calibration.
              </p>
              <button
                onClick={enterEvaluator}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm"
              >
                Enter as Evaluator
              </button>
            </section>

            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Program Director</h2>
              <p className="mt-3 text-sm text-slate-600">
                View leadership dashboard, session controls, and program-level performance.
              </p>
              <button
                onClick={enterProgramDirector}
                className="mt-6 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm"
              >
                Enter as Program Director
              </button>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">CRFT Phase 1 Integrated App (Firebase)</h1>
              <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Logged in as: {selectedRole}
              </div>
            </div>
            <button
              onClick={backToRoleSelect}
              className="rounded-2xl border px-4 py-2 text-sm font-medium"
            >
              Change role
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Firebase-wired version with persistent session control, real-time submissions, manual/auto scoring,
            bias/error tagging, dangerous-miss logic, calibration, and CSV export.
          </p>
          <div className="mt-3 text-xs text-slate-500">
            Firebase: {firebaseReady ? "Connected" : "Not connected"} {savingSession ? "• Saving session…" : ""}
          </div>
          {saveError ? <div className="mt-2 text-sm text-rose-600">{saveError}</div> : null}
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Session Control Panel">
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border p-2"
                value={session.sessionCode}
                onChange={(e) => persistSession({ ...session, sessionCode: e.target.value })}
                placeholder="Session code"
              />
              <select
                className="w-full rounded-xl border p-2"
                value={session.currentCaseId}
                onChange={(e) => persistSession({ ...session, currentCaseId: e.target.value })}
              >
                {CASE_LIBRARY.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} - {c.title}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-full rounded-xl border p-2"
                value={session.dayIndex}
                onChange={(e) => persistSession({ ...session, dayIndex: Number(e.target.value) || 1 })}
              />
              <select
                className="w-full rounded-xl border p-2"
                value={session.phase}
                onChange={(e) => persistSession({ ...session, phase: e.target.value })}
              >
                {PHASES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={session.isOpen}
                  onChange={(e) => persistSession({ ...session, isOpen: e.target.checked })}
                />
                Session open
              </label>
            </div>
          </Card>

          <Card title="Current Case" right={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{currentCase.difficulty}</span>}>
            <p className="text-sm font-medium">{currentCase.id} — {currentCase.title}</p>
            <p className="mt-3 text-sm">{currentCase.vignette}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {currentCase.traps.map((trap) => (
                <span key={trap} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                  Trap: {trap}
                </span>
              ))}
            </div>
          </Card>

          <Card title="Leadership Dashboard">
            <div className="space-y-2 text-sm">
              <div>Total Assessments: <span className="font-semibold">{totalAssessments}</span></div>
              <div>Average Auto Score: <span className="font-semibold">{avgAutoScore.toFixed(1)}/24</span></div>
              <div>Average Calibration Gap: <span className="font-semibold">{avgGap.toFixed(1)}</span></div>
              <div>Dangerous Miss Rate: <span className="font-semibold">{(dangerousMissRate * 100).toFixed(0)}%</span></div>
              <div>Weakest Domain: <span className="font-semibold">{DOMAIN_LABELS[weakestDomainOverall] || "—"}</span></div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Resident Input" right={<span className="text-xs text-slate-500">One-time submission enforced per resident/day</span>}>
            <div className="space-y-3">
              <select className="w-full rounded-xl border p-2" value={response.role} onChange={(e) => setResponse((r) => ({ ...r, role: e.target.value }))}>
                {ROLES.map((role) => <option key={role}>{role}</option>)}
              </select>

              <select className="w-full rounded-xl border p-2" value={response.residentId} onChange={(e) => setResponse((r) => ({ ...r, residentId: e.target.value }))}>
                {RESIDENT_IDS.map((id) => <option key={id}>{id}</option>)}
              </select>

              <input className="w-full rounded-xl border p-2" value={response.leadingDiagnosis} onChange={(e) => setResponse((r) => ({ ...r, leadingDiagnosis: e.target.value }))} placeholder="Leading diagnosis" />
              <textarea className="min-h-[190px] w-full rounded-xl border p-3" value={response.freeText} onChange={(e) => setResponse((r) => ({ ...r, freeText: e.target.value }))} placeholder="Enter resident reasoning here" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm">Confidence (0–100)</label>
                  <input type="number" min={0} max={100} className="w-full rounded-xl border p-2" value={response.confidence} onChange={(e) => setResponse((r) => ({ ...r, confidence: clamp(Number(e.target.value) || 0, 0, 100) }))} />
                </div>
                <div>
                  <label className="mb-1 block text-sm">Time (seconds)</label>
                  <input type="number" min={0} className="w-full rounded-xl border p-2" value={response.timeSeconds} onChange={(e) => setResponse((r) => ({ ...r, timeSeconds: Number(e.target.value) || 0 }))} />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleSubmitResident} disabled={!firebaseReady}>Submit evaluation</Button>
                <Button onClick={resetResidentForm} variant="secondary">Reset form</Button>
              </div>
            </div>
          </Card>

          <Card title="Manual Scoring Panel">
            <div className="space-y-3">
              {CRFT_DOMAINS.map((domain) => (
                <div key={domain} className="grid grid-cols-[1fr,150px] items-center gap-3">
                  <div>
                    <div className="text-sm font-medium">{DOMAIN_LABELS[domain]}</div>
                    <div className="text-xs text-slate-500">0–4 anchored rubric</div>
                  </div>
                  <select
                    className="rounded-xl border p-2"
                    value={manual.domainScores[domain]}
                    onChange={(e) => setManual((m) => ({ ...m, domainScores: { ...m.domainScores, [domain]: Number(e.target.value) } }))}
                  >
                    {[0,1,2,3,4].map((n) => <option key={n} value={n}>{n} — {DOMAIN_ANCHORS_0_4[n]}</option>)}
                  </select>
                </div>
              ))}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Manual Bias Tags</label>
                  <select
                    multiple
                    className="min-h-[140px] w-full rounded-xl border p-2"
                    value={manual.selectedBiasTags}
                    onChange={(e) => setManual((m) => ({ ...m, selectedBiasTags: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                  >
                    {Object.values(COGNITIVE_BIASES).map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Manual Error Tags</label>
                  <select
                    multiple
                    className="min-h-[140px] w-full rounded-xl border p-2"
                    value={manual.selectedErrorTags}
                    onChange={(e) => setManual((m) => ({ ...m, selectedErrorTags: Array.from(e.target.selectedOptions).map((o) => o.value) }))}
                  >
                    {Object.values(REASONING_ERRORS).map((tag) => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
                  </select>
                </div>
              </div>

              <textarea className="min-h-[120px] w-full rounded-xl border p-3" value={manual.comments} onChange={(e) => setManual((m) => ({ ...m, comments: e.target.value }))} placeholder="Manual evaluator comments" />
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Auto Scoring">
            <div className="space-y-2 text-sm">
              {CRFT_DOMAINS.map((d) => (
                <div key={d} className="flex items-center justify-between">
                  <span>{DOMAIN_LABELS[d]}</span>
                  <span className="font-semibold">{autoResult.domainScores[d]}/4</span>
                </div>
              ))}
              <div className="mt-3 border-t pt-3 font-semibold">Auto Total: {autoResult.total}/24</div>
              <div>Global Rating: {autoResult.globalRating}</div>
              <div>Dangerous Miss: {autoResult.dangerousMiss ? "Yes" : "No"}</div>
            </div>
          </Card>

          <Card title="Taxonomy Output">
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-medium">Auto Bias Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {autoResult.biasTags.length ? autoResult.biasTags.map((t) => (
                    <span key={t} className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-800">
                      {COGNITIVE_BIASES[t]?.label}
                    </span>
                  )) : <span className="text-slate-500">None</span>}
                </div>
              </div>
              <div>
                <div className="font-medium">Auto Error Tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {autoResult.errorTags.length ? autoResult.errorTags.map((t) => (
                    <span key={t} className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-800">
                      {REASONING_ERRORS[t]?.label}
                    </span>
                  )) : <span className="text-slate-500">None</span>}
                </div>
              </div>
            </div>
          </Card>

          <Card title="Calibration Summary">
            <div className="space-y-2 text-sm">
              <div>Manual Total: {manualResult.total}/24</div>
              <div>Manual Rating: {manualResult.globalRating}</div>
              <div>Total Difference: {calibration.totalDifference}</div>
              <div>Agreement: {calibration.agreementClass}</div>
              <div>Exact Match Domains: {calibration.exactMatchDomains}/6</div>
            </div>
          </Card>
        </div>

        <Card title="Benchmark Summary">
          <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div className="space-y-2">
              <div>Benchmark Score: <span className="font-semibold">{benchmark.benchmarkPercent}%</span></div>
              <div>Competency Level: <span className="font-semibold">{benchmark.competencyLevel}</span></div>
              <div>Leading Diagnosis Match: <span className="font-semibold">{benchmark.leadingDxAccepted ? "Yes" : "No"}</span></div>
            </div>
            <div>
              <div className="font-medium mb-2">Missed Must-Hit Concepts</div>
              <div className="flex flex-wrap gap-2">
                {benchmark.missedMustHits.length ? benchmark.missedMustHits.slice(0, 6).map((item) => (
                  <span key={item} className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800">
                    {item}
                  </span>
                )) : <span className="text-slate-500">None</span>}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Generated Feedback">
          <p className="text-sm leading-7 text-slate-700">{feedbackText}</p>
        </Card>

        <Card title="Assessment Log" right={<Button onClick={() => downloadCsv(`crft-export-${session.sessionCode}.csv`, toCsv(records))} variant="secondary">Export CSV</Button>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Resident</th>
                  <th className="p-2">Day</th>
                  <th className="p-2">Case</th>
                  <th className="p-2">Auto</th>
                  <th className="p-2">Manual</th>
                  <th className="p-2">Gap</th>
                  <th className="p-2">Benchmark</th>
                  <th className="p-2">Danger</th>
                  <th className="p-2">Delete</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.residentId}</td>
                    <td className="p-2">{r.sessionDay}</td>
                    <td className="p-2">{r.caseId}</td>
                    <td className="p-2">{r.autoTotal}</td>
                    <td className="p-2">{r.manualTotal ?? "—"}</td>
                    <td className="p-2">{r.calibration?.totalDifference ?? "—"}</td>
                    <td className="p-2">{r.benchmark?.benchmarkPercent ?? "—"}%</td>
                    <td className="p-2">{r.dangerousMiss ? "Yes" : "No"}</td>
                    <td className="p-2">
                      <Button variant="ghost" onClick={() => handleDeleteRecord(r.id)} className="px-2 py-1">Delete</Button>
                    </td>
                  </tr>
                ))}
                {!records.length && (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-slate-500">No submissions yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Resident Performance Profiles">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {residentProfiles.map((p) => (
              <div key={p.residentId} className="rounded-2xl border p-4 text-sm">
                <div className="font-semibold">{p.residentId}</div>
                <div className="mt-2">Assessments: {p.assessments}</div>
                <div>Avg Auto: {p.avgAutoTotal.toFixed(1)}</div>
                <div>Avg Manual: {Number.isFinite(p.avgManualTotal) ? p.avgManualTotal.toFixed(1) : "—"}</div>
                <div>Avg Confidence: {p.avgConfidence.toFixed(0)}%</div>
                <div>Avg Time: {p.avgTimeSeconds.toFixed(0)}s</div>
                <div>Danger Rate: {(p.dangerousMissRate * 100).toFixed(0)}%</div>
                <div>Weakest: {DOMAIN_LABELS[p.weakestDomain] || "—"}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
