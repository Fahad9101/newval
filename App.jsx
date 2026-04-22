import React, { useEffect, useMemo, useState } from "react";
import {
  ensureAnonymousAuth,
  subscribeToSessionConfig,
  saveSessionConfig,
  createSubmission,
  subscribeToSubmissions,
  updateSubmissionManual,
  createActivation,
  validateActivation,
  markActivationUsed,
  subscribeToActivations,
  generateActivationCode,
} from "./firebase";

// ============================================================
// CRFT SCALABLE ROLE-STRUCTURED APP
// Resident / Evaluator / Program Director separated
// ============================================================

const PHASES = ["baseline", "intervention"];
const RESIDENT_IDS = ["R1", "R2", "R3", "R4", "R5"];
const ROLE_OPTIONS = ["Resident", "Evaluator", "Program Director"];

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
  anchoring: "Anchoring Bias",
  prematureClosure: "Premature Closure",
  confirmationBias: "Confirmation Bias",
  availabilityBias: "Availability Bias",
  representativenessError: "Representativeness Error",
  failureToUpdate: "Failure to Update",
  wrongQuestionFraming: "Wrong-Question Framing",
};

const REASONING_ERRORS = {
  missedLifeThreatening: "Missed Life-Threatening Diagnosis",
  poorProblemRepresentation: "Poor Problem Representation",
  weakDifferentialPrioritization: "Weak Differential Prioritization",
  incorrectDataInterpretation: "Incorrect Data Interpretation",
  failureToAnticipate: "Failure To Anticipate",
  unsafeIncompleteManagement: "Unsafe / Incomplete Management",
  noReassessmentStrategy: "No Reassessment Strategy",
  overconfidenceMismatch: "Overconfidence Mismatch",
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

function normalize(text) {
  return (text || "").toLowerCase().trim();
}

function includesAny(text, phrases = []) {
  const n = normalize(text);
  return phrases.some((p) => n.includes(normalize(p)));
}

function countHits(text, phrases = []) {
  const n = normalize(text);
  return phrases.filter((p) => n.includes(normalize(p))).length;
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

function scoreDomainFromConcepts(text, conceptList = []) {
  const hits = countHits(text, conceptList);
  if (hits === 0) return 0;
  if (hits === 1) return 1;
  if (hits === 2) return 2;
  if (hits === 3) return 3;
  return 4;
}

function computeDangerousMiss(response, caseObj) {
  const text = normalize(`${response.leadingDiagnosis} ${response.freeText}`);
  const dangerous = caseObj.hiddenRubric.dangerousDiagnoses || [];
  if (!dangerous.length) return false;
  return !includesAny(text, dangerous);
}

function detectBiasTags(response, caseObj, domainScores) {
  const text = normalize(response.freeText);
  const tags = [];
  if (caseObj.hiddenRubric.biasTriggers?.anchoring && response.leadingDiagnosis) {
    const leadingLower = normalize(response.leadingDiagnosis);
    const dangerousMentioned = includesAny(text, caseObj.hiddenRubric.dangerousDiagnoses || []);
    if (!dangerousMentioned && includesAny(leadingLower, caseObj.hiddenRubric.biasTriggers.anchoring)) {
      tags.push("anchoring");
    }
  }
  if (domainScores.differentialDiagnosis <= 1) tags.push("prematureClosure");
  if (domainScores.dataInterpretation <= 1 && domainScores.differentialDiagnosis >= 2) tags.push("confirmationBias");
  if (domainScores.problemFraming <= 1) tags.push("wrongQuestionFraming");
  if (domainScores.dataInterpretation <= 1 && domainScores.reassessment <= 1) tags.push("failureToUpdate");
  return [...new Set(tags)].slice(0, 3);
}

function detectErrorTags(response, domainScores, dangerousMiss) {
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
    errorTags: detectErrorTags(response, domainScores, dangerousMiss),
  };
}

function computeBenchmark(caseObj, response) {
  const text = normalize(`${response.leadingDiagnosis} ${response.freeText}`);
  const mustHits = caseObj.hiddenRubric.conceptMap || {};
  const acceptedLeadingDiagnoses = caseObj.hiddenRubric.acceptedLeadingDiagnoses || [];
  const allMustHits = Object.values(mustHits).flat();
  const totalHitCount = countHits(text, allMustHits);
  const totalTargetCount = allMustHits.length || 0;
  const benchmarkPercent = totalTargetCount ? Math.round((totalHitCount / totalTargetCount) * 100) : 0;
  let competencyLevel = "Needs major support";
  if (benchmarkPercent >= 80) competencyLevel = "Strong alignment";
  else if (benchmarkPercent >= 60) competencyLevel = "Competent alignment";
  else if (benchmarkPercent >= 40) competencyLevel = "Partial alignment";

  return {
    benchmarkPercent,
    competencyLevel,
    leadingDxAccepted: acceptedLeadingDiagnoses.length ? includesAny(response.leadingDiagnosis, acceptedLeadingDiagnoses) : false,
    missedMustHits: [...new Set(allMustHits.filter((p) => !text.includes(normalize(p))))].slice(0, 8),
  };
}

function buildFeedback(response, caseObj, autoResult, benchmark) {
  const strengths = CRFT_DOMAINS.filter((d) => autoResult.domainScores[d] >= 3).map((d) => DOMAIN_LABELS[d]);
  const weakest = [...CRFT_DOMAINS].sort((a, b) => autoResult.domainScores[a] - autoResult.domainScores[b])[0];
  return [
    strengths.length ? `Strengths: ${strengths.join(", ")}.` : "Strengths: reasoning structure needs more organization.",
    `Benchmark alignment: ${benchmark.benchmarkPercent}% (${benchmark.competencyLevel}).`,
    benchmark.leadingDxAccepted ? "Leading diagnosis matched the accepted benchmark set." : "Leading diagnosis did not clearly match the accepted benchmark set.",
    benchmark.missedMustHits.length ? `Key missed concepts: ${benchmark.missedMustHits.slice(0, 4).join(", ")}.` : "All major benchmark concepts were represented.",
    autoResult.dangerousMiss ? "Critical miss: a dangerous diagnosis should have been considered earlier." : "Safety signal: no dangerous-miss flag was triggered.",
    `Bias tags: ${autoResult.biasTags.length ? autoResult.biasTags.map((t) => COGNITIVE_BIASES[t]).join(", ") : "none"}.`,
    `Reasoning error tags: ${autoResult.errorTags.length ? autoResult.errorTags.map((t) => REASONING_ERRORS[t]).join(", ") : "none"}.`,
    `Priority for the next case: improve ${DOMAIN_LABELS[weakest].toLowerCase()}.`,
  ].join(" ");
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildManualSummary(manual) {
  const total = sumDomainScores(manual.domainScores);
  return {
    ...manual,
    total,
    globalRating: getGlobalRating(total),
  };
}

function buildCalibration(autoResult, manualSummary) {
  const totalDifference = Math.abs((autoResult?.total || 0) - (manualSummary?.total || 0));
  const domainDifferences = Object.fromEntries(
    CRFT_DOMAINS.map((d) => [d, Math.abs((autoResult?.domainScores?.[d] || 0) - (manualSummary?.domainScores?.[d] || 0))])
  );
  const exactMatchDomains = CRFT_DOMAINS.filter(
    (d) => Number(autoResult?.domainScores?.[d] || 0) === Number(manualSummary?.domainScores?.[d] || 0)
  ).length;
  const agreementClass = totalDifference <= 2 ? "high" : totalDifference <= 5 ? "moderate" : "low";
  return { totalDifference, domainDifferences, exactMatchDomains, agreementClass };
}

function buildManualComment(manualSummary, selectedBiasTags = [], selectedErrorTags = []) {
  const strongDomains = CRFT_DOMAINS.filter((d) => (manualSummary?.domainScores?.[d] || 0) >= 3).map((d) => DOMAIN_LABELS[d]);
  const weakDomains = [...CRFT_DOMAINS]
    .sort((a, b) => (manualSummary?.domainScores?.[a] || 0) - (manualSummary?.domainScores?.[b] || 0))
    .slice(0, 2)
    .map((d) => DOMAIN_LABELS[d]);

  const biasText = selectedBiasTags.length
    ? selectedBiasTags.map((t) => COGNITIVE_BIASES[t] || t).join(", ")
    : "no dominant cognitive bias was clearly identified";

  const errorText = selectedErrorTags.length
    ? selectedErrorTags.map((t) => REASONING_ERRORS[t] || t).join(", ")
    : "no major discrete reasoning error tags were selected";

  const strengthSentence = strongDomains.length
    ? `The resident showed relative strength in ${strongDomains.join(", ")}.`
    : "The resident did not yet demonstrate a consistent strength pattern across the CRFT domains.";

  const weaknessSentence = weakDomains.length
    ? `The main areas needing improvement are ${weakDomains.join(" and ")}.`
    : "A clear weakest-domain pattern was not identified.";

  return `${strengthSentence} ${weaknessSentence} The evaluator identified ${biasText}, with the main observable reasoning problems being ${errorText}. Overall manual performance was rated as ${manualSummary.globalRating} with a total score of ${manualSummary.total}/24. The resident should focus on making reasoning more explicit, prioritizing the differential more clearly, and updating the assessment more deliberately as new information emerges.`;
}

function buildModelSolution(caseObj) {
  const accepted = caseObj.hiddenRubric?.acceptedLeadingDiagnoses || [];
  const conceptMap = caseObj.hiddenRubric?.conceptMap || {};
  const primaryDx = accepted[0] || "the leading dangerous diagnosis";
  const differential = (conceptMap.differentialDiagnosis || []).slice(0, 4).join(", ") || "a prioritized differential";
  const keyData = (conceptMap.dataInterpretation || []).slice(0, 4).join(", ") || "the key supporting data";
  const anticipatory = (conceptMap.anticipation || []).slice(0, 3).join(", ") || "the major immediate risks";
  const reassess = (conceptMap.reassessment || []).slice(0, 3).join(", ") || "serial reassessment targets";

  return [
    `Problem representation: ${caseObj.vignette}`,
    `Leading diagnosis: ${primaryDx}.`,
    `Prioritized differential: ${differential}.`,
    `Key data to integrate: ${keyData}.`,
    `Immediate priorities: stabilize the patient, address the most dangerous possibilities first, and act on ${anticipatory}.`,
    `Reassessment plan: follow ${reassess} and update the working diagnosis as new information emerges.`,
  ].join(" ");
}

function Button({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`rounded-2xl px-4 py-2 text-sm font-medium shadow-sm ${className}`}
    >
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

function RoleGateway({ onSelect }) {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-bold">CRFT Platform</h1>
          <p className="mt-3 text-sm text-slate-600">
            Select the role-specific workspace you want to use.
          </p>
        </section>
        <div className="grid gap-6 md:grid-cols-3">
          {ROLE_OPTIONS.map((role) => (
            <section key={role} className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">{role}</h2>
              <p className="mt-3 text-sm text-slate-600">
                {role === "Resident" && "Enter assigned activation code and submit your case response."}
                {role === "Evaluator" && "Release resident access, score submissions, and manage the study workflow."}
                {role === "Program Director" && "Review leadership metrics and program-level performance."}
              </p>
              <Button
                className="mt-6 w-full bg-slate-900 text-white"
                onClick={() => onSelect(role)}
              >
                Continue as {role}
              </Button>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResidentView({
  session,
  activations,
  onBack,
  onSubmitResident,
  caseObj,
}) {
  const [residentId, setResidentId] = useState("R1");
  const [activationCode, setActivationCode] = useState("");
  const [access, setAccess] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState({
    leadingDiagnosis: "",
    freeText: "",
    confidence: 50,
    timeSeconds: 0,
  });
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [submittedFeedback, setSubmittedFeedback] = useState(null);

  async function handleUnlock() {
    setChecking(true);
    setError("");
    setSubmittedFeedback(null);
    try {
      const result = await validateActivation({
        residentId,
        activationCode,
        sessionDay: session.dayIndex,
        caseId: session.currentCaseId,
      });
      if (!result.ok) {
        setError(result.message || "Invalid activation.");
        setAccess(null);
      } else {
        setAccess(result.activation);
        setSessionStartTime(Date.now());
      }
    } catch (e) {
      setError("Activation check failed.");
      setAccess(null);
    } finally {
      setChecking(false);
    }
  }

  async function handleResidentSubmit() {
    if (!access) return;
    const finalResponse = {
      residentId,
      role: "Resident",
      pgy: "PGY1",
      confidence: Number(response.confidence),
      leadingDiagnosis: response.leadingDiagnosis,
      freeText: response.freeText,
      timeSeconds: sessionStartTime ? Math.max(1, Math.round((Date.now() - sessionStartTime) / 1000)) : 0,
      startedAt: sessionStartTime ? new Date(sessionStartTime).toISOString() : (access.createdAt || new Date().toISOString()),
      submittedAt: new Date().toISOString(),
    };

    const autoResult = autoScoreSubmission(finalResponse, caseObj);
    const benchmark = computeBenchmark(caseObj, finalResponse);
    const feedbackText = buildFeedback(finalResponse, caseObj, autoResult, benchmark);

    const record = {
      sessionCode: session.sessionCode,
      sessionDay: session.dayIndex,
      phase: session.phase,
      caseId: caseObj.id,
      caseTitle: caseObj.title,
      residentId,
      pgy: "PGY1",
      role: "Resident",
      confidence: Number(response.confidence),
      leadingDiagnosis: response.leadingDiagnosis,
      freeText: response.freeText,
      timeSeconds: finalResponse.timeSeconds,
      startedAt: finalResponse.startedAt,
      submittedAt: finalResponse.submittedAt,
      autoDomainScores: autoResult.domainScores,
      autoTotal: autoResult.total,
      autoGlobalRating: autoResult.globalRating,
      autoBiasTags: autoResult.biasTags,
      autoErrorTags: autoResult.errorTags,
      dangerousMiss: autoResult.dangerousMiss,
      manualDomainScores: null,
      manualTotal: null,
      manualGlobalRating: null,
      manualBiasTags: [],
      manualErrorTags: [],
      manualComments: "",
      calibration: null,
      benchmark,
      feedbackText,
      exportFlat: {
        autoTotal: autoResult.total,
        benchmarkPercent: benchmark.benchmarkPercent,
        benchmarkCompetencyLevel: benchmark.competencyLevel,
      },
    };

    await onSubmitResident(record, access.id);
    setSubmittedFeedback({
      autoResult,
      benchmark,
      feedbackText,
    });
    setAccess(null);
    setActivationCode("");
    setResponse({
      leadingDiagnosis: "",
      freeText: "",
      confidence: 50,
      timeSeconds: 0,
    });
    setSessionStartTime(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Resident Workspace</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter your assigned resident ID and activation code to unlock the released case.
              </p>
            </div>
            <Button onClick={onBack} className="border bg-white text-slate-900">Back</Button>
          </div>
        </header>

        {!access ? (
          <Card title="Resident Access">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">Resident ID</label>
                <select
                  className="w-full rounded-2xl border p-3"
                  value={residentId}
                  onChange={(e) => setResidentId(e.target.value)}
                >
                  {RESIDENT_IDS.map((id) => <option key={id}>{id}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">Activation Code</label>
                <input
                  className="w-full rounded-2xl border p-3"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={handleUnlock} className="bg-slate-900 text-white">
                {checking ? "Checking..." : "Unlock Case"}
              </Button>
              {error ? <span className="text-sm text-rose-600">{error}</span> : null}
            </div>

            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Active session: {session.sessionCode} · Day {session.dayIndex} · Case {session.currentCaseId} · {session.phase}
            </div>
          </Card>
        ) : (
          <>
            <Card title="Assigned Case" right={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{caseObj.difficulty}</span>}>
              <p className="text-lg font-semibold">{caseObj.id} — {caseObj.title}</p>
              <p className="mt-3 text-sm leading-6">{caseObj.vignette}</p>
            </Card>

            <Card title="Submit Response">
              <div className="space-y-4">
                <input
                  className="w-full rounded-2xl border p-3"
                  value={response.leadingDiagnosis}
                  onChange={(e) => setResponse((r) => ({ ...r, leadingDiagnosis: e.target.value }))}
                  placeholder="Leading diagnosis"
                />
                <textarea
                  className="min-h-[220px] w-full rounded-2xl border p-3"
                  value={response.freeText}
                  onChange={(e) => setResponse((r) => ({ ...r, freeText: e.target.value }))}
                  placeholder="Enter your reasoning"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">Confidence (0–100)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className="w-full rounded-2xl border p-3"
                      value={response.confidence}
                      onChange={(e) => setResponse((r) => ({ ...r, confidence: clamp(Number(e.target.value) || 0, 0, 100) }))}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Time tracking</label>
                    <div className="w-full rounded-2xl border bg-slate-50 p-3 text-sm text-slate-600">
                      Calculated automatically from case unlock to submission
                    </div>
                  </div>
                </div>
                <Button onClick={handleResidentSubmit} className="bg-slate-900 text-white">
                  Submit Case
                </Button>
              </div>
            </Card>
          </>
        )}

        {submittedFeedback ? (
          <Card title="Your Feedback">
            {session.dayIndex <= 2 ? (
              <div className="text-sm text-slate-700">
                Feedback is intentionally hidden for the first two cases.
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div>Auto total: <span className="font-semibold">{submittedFeedback.autoResult.total}/24</span></div>
                <div>Global rating: <span className="font-semibold">{submittedFeedback.autoResult.globalRating}</span></div>
                <div>Benchmark score: <span className="font-semibold">{submittedFeedback.benchmark.benchmarkPercent}%</span></div>
                <div className="leading-7 text-slate-700">{submittedFeedback.feedbackText}</div>
              </div>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function EvaluatorView({
  session,
  setSessionRemote,
  records,
  activations,
  onBack,
  onCreateActivation,
  onSaveManualEvaluation,
}) {
  const [activationForm, setActivationForm] = useState({
    sessionDay: session.dayIndex,
    caseId: session.currentCaseId,
    note: "",
  });
  const [createdCode, setCreatedCode] = useState("");
  const [manualMap, setManualMap] = useState({});
  const [manualSubmittedMap, setManualSubmittedMap] = useState({});

  const currentCase = CASE_LIBRARY.find((c) => c.id === session.currentCaseId) || CASE_LIBRARY[0];

  function buildManualDefaults(record) {
    return {
      domainScores: Object.fromEntries(CRFT_DOMAINS.map((d) => [d, record.manualDomainScores?.[d] ?? 0])),
      selectedBiasTags: record.manualBiasTags || [],
      selectedErrorTags: record.manualErrorTags || [],
      comments: record.manualComments || "",
      submitted: !!(record.manualDomainScores && Object.keys(record.manualDomainScores).length),
    };
  }

  function getManualState(record) {
    return manualMap[record.id] || buildManualDefaults(record);
  }

  function setManualState(recordId, next) {
    setManualMap((prev) => ({ ...prev, [recordId]: next }));
  }

  function toggleManualTag(recordId, field, tag) {
    const currentManual = manualMap[recordId] || {};
    const current = currentManual[field] || [];
    const next = current.includes(tag) ? current.filter((x) => x !== tag) : [...current, tag];
    setManualMap((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || {}),
        [field]: next,
      },
    }));
  }

  async function handleSubmitManualEvaluation(recordId, record) {
    const manual = manualMap[recordId] || buildManualDefaults(record);
    const manualSummary = buildManualSummary(manual);
    const generatedComment = buildManualComment(
      manualSummary,
      manual.selectedBiasTags || [],
      manual.selectedErrorTags || []
    );
    const calibration = buildCalibration(
      { total: record.autoTotal, domainScores: record.autoDomainScores || {} },
      manualSummary
    );

    await onSaveManualEvaluation(recordId, {
      manualDomainScores: manualSummary.domainScores,
      manualTotal: manualSummary.total,
      manualGlobalRating: manualSummary.globalRating,
      manualBiasTags: manual.selectedBiasTags || [],
      manualErrorTags: manual.selectedErrorTags || [],
      manualComments: generatedComment,
      calibration,
    });

    setManualSubmittedMap((prev) => ({ ...prev, [recordId]: true }));
    setManualMap((prev) => ({
      ...prev,
      [recordId]: {
        ...(prev[recordId] || {}),
        submitted: true,
        comments: generatedComment,
      },
    }));
  }

  async function handleCreateActivation() {
    const code = generateActivationCode();
    const payload = {
      sessionCode: session.sessionCode,
      sessionDay: Number(activationForm.sessionDay),
      caseId: activationForm.caseId,
      activationCode: code,
      allowedResidentIds: RESIDENT_IDS,
      usedResidentIds: [],
      isActive: true,
      note: activationForm.note || "",
    };
    await onCreateActivation(payload);
    setCreatedCode(code);
  }

  const todayRecords = records.filter(
    (r) => r.sessionDay === session.dayIndex && r.caseId === session.currentCaseId
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Evaluator Workspace</h1>
              <p className="mt-2 text-sm text-slate-600">
                Release resident access, control sessions, and review submissions.
              </p>
            </div>
            <Button onClick={onBack} className="border bg-white text-slate-900">Back</Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Session Controls">
            <div className="space-y-3">
              <input
                className="w-full rounded-2xl border p-3"
                value={session.sessionCode}
                onChange={(e) => setSessionRemote({ ...session, sessionCode: e.target.value })}
              />
              <select
                className="w-full rounded-2xl border p-3"
                value={session.currentCaseId}
                onChange={(e) => {
                  const next = { ...session, currentCaseId: e.target.value };
                  setSessionRemote(next);
                  setActivationForm((f) => ({ ...f, caseId: e.target.value }));
                }}
              >
                {CASE_LIBRARY.map((c) => (
                  <option key={c.id} value={c.id}>{c.id} - {c.title}</option>
                ))}
              </select>
              <input
                type="number"
                className="w-full rounded-2xl border p-3"
                value={session.dayIndex}
                onChange={(e) => {
                  const dayIndex = Number(e.target.value) || 1;
                  const next = { ...session, dayIndex };
                  setSessionRemote(next);
                  setActivationForm((f) => ({ ...f, sessionDay: dayIndex }));
                }}
              />
              <select
                className="w-full rounded-2xl border p-3"
                value={session.phase}
                onChange={(e) => setSessionRemote({ ...session, phase: e.target.value })}
              >
                {PHASES.map((p) => <option key={p}>{p}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={session.isOpen}
                  onChange={(e) => setSessionRemote({ ...session, isOpen: e.target.checked })}
                />
                Session open
              </label>
            </div>
          </Card>

          <Card title="Activation Manager">
            <div className="space-y-3">
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                Generate one code for the selected case/day. For now, the code applies to residents R1–R5.
              </div>
              <input
                type="number"
                className="w-full rounded-2xl border p-3"
                value={activationForm.sessionDay}
                onChange={(e) => setActivationForm((f) => ({ ...f, sessionDay: Number(e.target.value) || 1 }))}
              />
              <select
                className="w-full rounded-2xl border p-3"
                value={activationForm.caseId}
                onChange={(e) => setActivationForm((f) => ({ ...f, caseId: e.target.value }))}
              >
                {CASE_LIBRARY.map((c) => <option key={c.id} value={c.id}>{c.id} - {c.title}</option>)}
              </select>
              <input
                className="w-full rounded-2xl border p-3"
                value={activationForm.note}
                onChange={(e) => setActivationForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Optional note"
              />
              <Button onClick={handleCreateActivation} className="w-full bg-slate-900 text-white">
                Generate Activation
              </Button>
              {createdCode ? (
                <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700">
                  Case code for {activationForm.caseId} / Day {activationForm.sessionDay}: <span className="font-semibold">{createdCode}</span>
                </div>
              ) : null}
            </div>
          </Card>

          <Card title="Activation Status">
            <div className="space-y-2 text-sm">
              {activations
                .filter((a) => a.sessionDay === session.dayIndex && a.caseId === session.currentCaseId)
                .slice(0, 10)
                .map((a) => (
                  <div key={a.id} className="rounded-xl border p-3">
                    <div className="font-medium">{a.caseId} · Day {a.sessionDay}</div>
                    <div>Code: {a.activationCode}</div>
                    <div>Allowed residents: {(a.allowedResidentIds || []).join(", ")}</div>
                    <div>Used by: {(a.usedResidentIds || []).length ? a.usedResidentIds.join(", ") : "None"}</div>
                    <div>Status: {a.isActive ? "Active" : "Inactive"}</div>
                  </div>
                ))}
              {!activations.filter((a) => a.sessionDay === session.dayIndex && a.caseId === session.currentCaseId).length ? (
                <div className="text-slate-500">No activations yet for this case/day.</div>
              ) : null}
            </div>
          </Card>
        </div>

        <Card title="Released Case" right={<span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{currentCase.difficulty}</span>}>
          <div className="space-y-3">
            <div className="text-lg font-semibold">{currentCase.id} — {currentCase.title}</div>
            <div className="text-sm">{currentCase.vignette}</div>
          </div>
        </Card>

        <Card title="Model Solution for Evaluator">
          <div className="space-y-3 text-sm">
            <div className="font-medium">Expert reference answer for the released case</div>
            <div className="rounded-2xl bg-slate-50 p-4 leading-7 text-slate-700">
              {buildModelSolution(currentCase)}
            </div>
          </div>
        </Card>

        <Card title="Submissions for Current Case/Day">
          <div className="space-y-4">
            {todayRecords.map((record) => {
              const manual = getManualState(record);
              const manualSummary = buildManualSummary(manual);
              const calibration = buildCalibration(
                { total: record.autoTotal, domainScores: record.autoDomainScores || {} },
                manualSummary
              );
              const manualAlreadySaved = !!manualSubmittedMap[record.id] || !!(record.manualDomainScores && Object.keys(record.manualDomainScores).length);

              return (
                <div key={record.id} className="rounded-2xl border p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{record.residentId}</div>
                      <div className="text-sm text-slate-500">{record.caseId} · Day {record.sessionDay} · Benchmark {record.benchmark?.benchmarkPercent ?? 0}%</div>
                    </div>
                    <div className="text-sm text-slate-500">Confidence {record.confidence}% · Time {record.timeSeconds}s</div>
                  </div>

                  <div className="mb-6 grid gap-6 xl:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-3 text-base font-semibold">Resident Submission</div>
                      <div className="rounded-xl bg-white p-3 text-sm"><span className="font-medium">Leading diagnosis:</span> {record.leadingDiagnosis || "—"}</div>
                      <div className="mt-3 rounded-xl bg-white p-3 text-sm leading-6 whitespace-pre-wrap">{record.freeText || "—"}</div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-3 text-base font-semibold">Automatic Evaluation</div>
                      {manualAlreadySaved ? (
                        <div className="space-y-2 text-sm">
                          {CRFT_DOMAINS.map((domain) => (
                            <div key={domain} className="flex items-center justify-between">
                              <span>{DOMAIN_LABELS[domain]}</span>
                              <span className="font-semibold">{record.autoDomainScores?.[domain] ?? 0}/4</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 font-semibold">Auto total: {record.autoTotal}/24</div>
                          <div>Global rating: {record.autoGlobalRating || "—"}</div>
                          <div>Dangerous miss: {record.dangerousMiss ? "Yes" : "No"}</div>
                          <div>Benchmark: {record.benchmark?.benchmarkPercent ?? 0}%</div>
                          <div className="pt-2">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Auto cognitive bias tags</div>
                            <div className="flex flex-wrap gap-2">
                              {(record.autoBiasTags || []).length ? record.autoBiasTags.map((tag) => (
                                <span key={tag} className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-800">{COGNITIVE_BIASES[tag] || tag}</span>
                              )) : <span className="text-slate-500">None</span>}
                            </div>
                          </div>
                          <div className="pt-2">
                            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Auto reasoning error tags</div>
                            <div className="flex flex-wrap gap-2">
                              {(record.autoErrorTags || []).length ? record.autoErrorTags.map((tag) => (
                                <span key={tag} className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-800">{REASONING_ERRORS[tag] || tag}</span>
                              )) : <span className="text-slate-500">None</span>}
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl bg-white p-3 text-sm leading-6">
                            <div className="mb-2 font-medium">Auto feedback</div>
                            {record.feedbackText}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-white p-3 text-sm text-slate-500">
                          Automatic evaluation is hidden until the evaluator submits the manual evaluation.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="mb-3 text-base font-semibold">Calibration Summary</div>
                      <div className="space-y-2 text-sm">
                        <div>Manual total: <span className="font-semibold">{manualSummary.total}/24</span></div>
                        <div>Manual rating: <span className="font-semibold">{manualSummary.globalRating}</span></div>
                        <div>Total difference: <span className="font-semibold">{calibration.totalDifference}</span></div>
                        <div>Agreement: <span className="font-semibold">{calibration.agreementClass}</span></div>
                        <div>Exact match domains: <span className="font-semibold">{calibration.exactMatchDomains}/6</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="mb-4 text-base font-semibold">Manual Evaluation</div>
                    <div className="grid gap-6 xl:grid-cols-2">
                      <div className="space-y-3">
                        {CRFT_DOMAINS.map((domain) => (
                          <div key={domain} className="grid grid-cols-[1fr,180px] items-center gap-3">
                            <div>
                              <div className="text-sm font-medium">{DOMAIN_LABELS[domain]}</div>
                              <div className="text-xs text-slate-500">Set manual score independent of auto score</div>
                            </div>
                            <select
                              className="rounded-2xl border p-2"
                              value={manual.domainScores[domain]}
                              onChange={(e) => setManualState(record.id, {
                                ...manual,
                                domainScores: {
                                  ...manual.domainScores,
                                  [domain]: Number(e.target.value),
                                },
                              })}
                            >
                              {[0,1,2,3,4].map((n) => (
                                <option key={n} value={n}>{n} — {DOMAIN_ANCHORS_0_4[n]}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium">Cognitive Bias Tags</label>
                            <div className="mb-2 text-xs text-slate-500">Tick one or more thinking traps that explain why the resident went wrong.</div>
                            <div className="grid gap-2">
                              {Object.entries(COGNITIVE_BIASES).map(([key, label]) => (
                                <label key={key} className="flex items-start gap-2 rounded-xl border p-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={(manual.selectedBiasTags || []).includes(key)}
                                    onChange={() => toggleManualTag(record.id, "selectedBiasTags", key)}
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">Reasoning Error Tags</label>
                            <div className="mb-2 text-xs text-slate-500">Tick one or more observable reasoning problems seen in the final answer.</div>
                            <div className="grid gap-2">
                              {Object.entries(REASONING_ERRORS).map(([key, label]) => (
                                <label key={key} className="flex items-start gap-2 rounded-xl border p-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={(manual.selectedErrorTags || []).includes(key)}
                                    onChange={() => toggleManualTag(record.id, "selectedErrorTags", key)}
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium">Generated Manual Evaluation</label>
                          <div className="rounded-2xl border bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                            {buildManualComment(manualSummary, manual.selectedBiasTags || [], manual.selectedErrorTags || [])}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => handleSubmitManualEvaluation(record.id, record)}
                            className="bg-slate-900 text-white"
                          >
                            Submit Manual Evaluation
                          </Button>
                          {manualAlreadySaved ? (
                            <span className="text-sm text-emerald-700">Manual evaluation submitted</span>
                          ) : (
                            <span className="text-sm text-slate-500">Submit manual evaluation to reveal automatic evaluation.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}            {!todayRecords.length ? <div className="text-slate-500">No submissions yet for the current case/day.</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProgramDirectorView({ session, records, activations, onBack }) {
  const [selectedResidentFile, setSelectedResidentFile] = useState("");
  const totalAssessments = records.length;
  const avgAutoScore = average(records.map((r) => r.autoTotal));
  const dangerousMissRate = average(records.map((r) => (r.dangerousMiss ? 1 : 0)));
  const avgBenchmark = average(records.map((r) => r.benchmark?.benchmarkPercent || 0));
  const weakestDomain = [...CRFT_DOMAINS].sort(
    (a, b) =>
      average(records.map((r) => r.autoDomainScores?.[a] || 0)) -
      average(records.map((r) => r.autoDomainScores?.[b] || 0))
  )[0];

  const residentSummary = RESIDENT_IDS
    .map((id) => {
      const mine = records.filter((r) => r.residentId === id);
      return {
        id,
        count: mine.length,
        avgAuto: average(mine.map((r) => r.autoTotal)),
        avgManual: average(mine.map((r) => {
          const manualScores = r.manualDomainScores || {};
          return Object.keys(manualScores).length ? sumDomainScores(manualScores) : 0;
        }).filter((n) => n > 0)),
        avgBenchmark: average(mine.map((r) => r.benchmark?.benchmarkPercent || 0)),
      };
    })
    .filter((r) => r.count > 0);

  const residentFileRecords = selectedResidentFile
    ? records.filter((r) => r.residentId === selectedResidentFile)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Program Director Workspace</h1>
              <p className="mt-2 text-sm text-slate-600">
                Program-level dashboard with no resident submission form and no manual scoring tools.
              </p>
            </div>
            <Button onClick={onBack} className="border bg-white text-slate-900">Back</Button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-4">
          <Card title="Total Assessments"><div className="text-3xl font-bold">{totalAssessments}</div></Card>
          <Card title="Average Auto Score"><div className="text-3xl font-bold">{avgAutoScore.toFixed(1)}/24</div></Card>
          <Card title="Average Benchmark"><div className="text-3xl font-bold">{avgBenchmark.toFixed(0)}%</div></Card>
          <Card title="Dangerous Miss Rate"><div className="text-3xl font-bold">{(dangerousMissRate * 100).toFixed(0)}%</div></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Current Session">
            <div className="space-y-2 text-sm">
              <div>Session code: <span className="font-semibold">{session.sessionCode}</span></div>
              <div>Day: <span className="font-semibold">{session.dayIndex}</span></div>
              <div>Phase: <span className="font-semibold">{session.phase}</span></div>
              <div>Case: <span className="font-semibold">{session.currentCaseId}</span></div>
              <div>Open: <span className="font-semibold">{session.isOpen ? "Yes" : "No"}</span></div>
            </div>
          </Card>

          <Card title="Weakest Domain">
            <div className="text-xl font-semibold">{DOMAIN_LABELS[weakestDomain] || "—"}</div>
          </Card>

          <Card title="Active Activations">
            <div className="text-3xl font-bold">{activations.filter((a) => a.isActive).length}</div>
          </Card>
        </div>

        <Card title="Resident Summary">
          <div className="mb-4 grid gap-4 md:grid-cols-[260px,1fr]">
            <div>
              <label className="mb-2 block text-sm font-medium">Resident File</label>
              <select
                className="w-full rounded-2xl border p-3"
                value={selectedResidentFile}
                onChange={(e) => setSelectedResidentFile(e.target.value)}
              >
                <option value="">Select resident</option>
                {residentSummary.map((r) => (
                  <option key={r.id} value={r.id}>{r.id}</option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Program Director can review the dashboard above and open a separate resident file below containing both automatic and manual evaluations.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Resident</th>
                  <th className="p-2">Assessments</th>
                  <th className="p-2">Avg Auto</th>
                  <th className="p-2">Avg Manual</th>
                  <th className="p-2">Avg Benchmark</th>
                </tr>
              </thead>
              <tbody>
                {residentSummary.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2">{r.count}</td>
                    <td className="p-2">{r.avgAuto.toFixed(1)}</td>
                    <td className="p-2">{r.avgManual ? r.avgManual.toFixed(1) : "—"}</td>
                    <td className="p-2">{r.avgBenchmark.toFixed(0)}%</td>
                  </tr>
                ))}
                {!residentSummary.length ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-500">No resident data yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedResidentFile ? (
          <Card title={`Resident File — ${selectedResidentFile}`}>
            <div className="space-y-4">
              {residentFileRecords.map((r) => {
                const manualTotal = r.manualDomainScores && Object.keys(r.manualDomainScores).length
                  ? sumDomainScores(r.manualDomainScores)
                  : null;
                return (
                  <div key={r.id} className="rounded-2xl border p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="font-semibold">{r.caseId} · Day {r.sessionDay}</div>
                      <div className="text-sm text-slate-500">Benchmark {r.benchmark?.benchmarkPercent ?? 0}%</div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="mb-3 text-base font-semibold">Submission</div>
                        <div className="text-sm"><span className="font-medium">Leading diagnosis:</span> {r.leadingDiagnosis || "—"}</div>
                        <div className="mt-3 text-sm leading-6 whitespace-pre-wrap">{r.freeText || "—"}</div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="mb-3 text-base font-semibold">Automatic Evaluation</div>
                        <div className="space-y-2 text-sm">
                          {CRFT_DOMAINS.map((domain) => (
                            <div key={domain} className="flex items-center justify-between">
                              <span>{DOMAIN_LABELS[domain]}</span>
                              <span className="font-semibold">{r.autoDomainScores?.[domain] ?? 0}/4</span>
                            </div>
                          ))}
                          <div className="border-t pt-2 font-semibold">Auto total: {r.autoTotal}/24</div>
                          <div>Auto rating: {r.autoGlobalRating || "—"}</div>
                          <div>Dangerous miss: {r.dangerousMiss ? "Yes" : "No"}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="mb-3 text-base font-semibold">Manual Evaluation</div>
                        <div className="space-y-2 text-sm">
                          {r.manualDomainScores && Object.keys(r.manualDomainScores).length ? (
                            <>
                              {CRFT_DOMAINS.map((domain) => (
                                <div key={domain} className="flex items-center justify-between">
                                  <span>{DOMAIN_LABELS[domain]}</span>
                                  <span className="font-semibold">{r.manualDomainScores?.[domain] ?? 0}/4</span>
                                </div>
                              ))}
                              <div className="border-t pt-2 font-semibold">Manual total: {manualTotal}/24</div>
                              <div>Manual rating: {r.manualGlobalRating || "—"}</div>

                              <div className="pt-2">
                                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Manual cognitive bias tags</div>
                                <div className="flex flex-wrap gap-2">
                                  {(r.manualBiasTags || []).length ? r.manualBiasTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-800">{COGNITIVE_BIASES[tag] || tag}</span>
                                  )) : <span className="text-slate-500">None</span>}
                                </div>
                              </div>

                              <div className="pt-2">
                                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Manual reasoning error tags</div>
                                <div className="flex flex-wrap gap-2">
                                  {(r.manualErrorTags || []).length ? r.manualErrorTags.map((tag) => (
                                    <span key={tag} className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-800">{REASONING_ERRORS[tag] || tag}</span>
                                  )) : <span className="text-slate-500">None</span>}
                                </div>
                              </div>

                              <div className="mt-3 rounded-xl bg-white p-3 text-sm leading-6">
                                {r.manualComments || "—"}
                              </div>
                            </>
                          ) : (
                            <div className="text-slate-500">No manual evaluation saved yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!residentFileRecords.length ? (
                <div className="text-slate-500">No records found for this resident.</div>
              ) : null}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");
  const [session, setSession] = useState(defaultSession);
  const [records, setRecords] = useState([]);
  const [activations, setActivations] = useState([]);

  const currentCase = useMemo(
    () => CASE_LIBRARY.find((c) => c.id === session.currentCaseId) || CASE_LIBRARY[0],
    [session.currentCaseId]
  );

  useEffect(() => {
    let unsubSession = null;
    let unsubSubmissions = null;
    let unsubActivations = null;

    async function boot() {
      await ensureAnonymousAuth();
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

      unsubSubmissions = subscribeToSubmissions((rows) => setRecords(rows));
      unsubActivations = subscribeToActivations((rows) => setActivations(rows));
      setLoading(false);
    }

    boot();

    return () => {
      if (unsubSession) unsubSession();
      if (unsubSubmissions) unsubSubmissions();
      if (unsubActivations) unsubActivations();
    };
  }, []);

  async function handleResidentSubmission(record, activationId) {
    await createSubmission(record);
    await markActivationUsed(activationId, record.residentId);
  }

  async function handleCreateActivation(payload) {
    await createActivation(payload);
  }

  async function handleSaveManualEvaluation(submissionId, payload) {
    await updateSubmissionManual(submissionId, payload);
  }

  async function setSessionRemote(nextSession) {
    setSession(nextSession);
    await saveSessionConfig(nextSession);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold">Loading CRFT platform…</h1>
        </div>
      </div>
    );
  }

  if (!role) {
    return <RoleGateway onSelect={setRole} />;
  }

  if (role === "Resident") {
    return (
      <ResidentView
        session={session}
        activations={activations}
        onBack={() => setRole("")}
        onSubmitResident={handleResidentSubmission}
        caseObj={currentCase}
      />
    );
  }

  if (role === "Evaluator") {
    return (
      <EvaluatorView
        session={session}
        setSessionRemote={setSessionRemote}
        records={records}
        activations={activations}
        onBack={() => setRole("")}
        onCreateActivation={handleCreateActivation}
        onSaveManualEvaluation={handleSaveManualEvaluation}
      />
    );
  }

  return (
    <ProgramDirectorView
      session={session}
      records={records}
      activations={activations}
      onBack={() => setRole("")}
    />
  );
}
