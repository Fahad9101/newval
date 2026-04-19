import React, { useEffect, useMemo, useState } from "react";
import {
  ensureAnonymousAuth,
  subscribeToSessionConfig,
  saveSessionConfig,
  createSubmission,
  subscribeToSubmissions,
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
const RESIDENT_IDS = Array.from({ length: 30 }, (_, i) => `R${i + 1}`);
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
    vignette:
      "68-year-old man with HTN and CAD presents with acute nocturnal dyspnea, orthopnea, tachycardia, and hypoxemia.",
    traps: ["anchoring on heart failure", "missing PE"],
    hiddenRubric: {
      dangerousDiagnoses: ["pulmonary embolism", "pe", "acs", "flash pulmonary edema"],
      acceptedLeadingDiagnoses: ["acute heart failure", "pulmonary embolism", "acs with pulmonary edema"],
      conceptMap: {
        problemFraming: ["acute", "dyspnea", "hypoxemia", "cardiopulmonary"],
        syndromeIdentification: ["acute cardiopulmonary syndrome", "acute decompensated heart failure", "pulmonary embolism syndrome"],
        differentialDiagnosis: ["heart failure", "pulmonary embolism", "pe", "acs", "pneumonia"],
        dataInterpretation: ["bnp", "troponin", "crackles", "jvp", "interstitial opacities"],
        anticipation: ["deterioration", "respiratory failure", "hemodynamic worsening", "oxygen"],
        reassessment: ["repeat vitals", "oxygen response", "trend troponin", "reassess"],
      },
      dangerousMissPenalty: { penaltyPoints: 2 },
      biasTriggers: { anchoring: ["heart failure"] },
    },
  },
  {
    id: "C2",
    title: "Fever, Hypotension, and AKI",
    difficulty: "moderate",
    vignette:
      "72-year-old woman presents with fever, confusion, hypotension, elevated lactate, and AKI.",
    traps: ["narrowing too fast to UTI", "missing source control issue"],
    hiddenRubric: {
      dangerousDiagnoses: ["septic shock", "obstructive infection", "adrenal crisis"],
      acceptedLeadingDiagnoses: ["septic shock", "urosepsis", "biliary sepsis"],
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
    },
  },
  {
    id: "C3",
    title: "Chest Pain with Mild Troponin Rise",
    difficulty: "moderate",
    vignette:
      "59-year-old man with diabetes presents with exertional chest pressure, diaphoresis, and a mild rise in troponin.",
    traps: ["labeling as reflux", "ignoring ACS"],
    hiddenRubric: {
      dangerousDiagnoses: ["acs", "nstemi", "aortic dissection", "pulmonary embolism"],
      acceptedLeadingDiagnoses: ["acs", "nste-acs", "unstable angina", "nstemi"],
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
      timeSeconds: Number(response.timeSeconds || 0),
      startedAt: access.createdAt || new Date().toISOString(),
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
      timeSeconds: Number(response.timeSeconds || 0),
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
                    <label className="mb-2 block text-sm font-medium">Time (seconds)</label>
                    <input
                      type="number"
                      min={0}
                      className="w-full rounded-2xl border p-3"
                      value={response.timeSeconds}
                      onChange={(e) => setResponse((r) => ({ ...r, timeSeconds: Number(e.target.value) || 0 }))}
                    />
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
            <div className="space-y-3 text-sm">
              <div>Auto total: <span className="font-semibold">{submittedFeedback.autoResult.total}/24</span></div>
              <div>Global rating: <span className="font-semibold">{submittedFeedback.autoResult.globalRating}</span></div>
              <div>Benchmark score: <span className="font-semibold">{submittedFeedback.benchmark.benchmarkPercent}%</span></div>
              <div className="leading-7 text-slate-700">{submittedFeedback.feedbackText}</div>
            </div>
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
}) {
  const [activationForm, setActivationForm] = useState({
    residentId: "R1",
    sessionDay: session.dayIndex,
    caseId: session.currentCaseId,
    note: "",
  });
  const [createdCode, setCreatedCode] = useState("");
  const [manualMap, setManualMap] = useState({});

  const currentCase = CASE_LIBRARY.find((c) => c.id === session.currentCaseId) || CASE_LIBRARY[0];

  function buildManualDefaults(record) {
    return {
      domainScores: Object.fromEntries(CRFT_DOMAINS.map((d) => [d, record.manualDomainScores?.[d] ?? 0])),
      selectedBiasTags: record.manualBiasTags || [],
      selectedErrorTags: record.manualErrorTags || [],
      comments: record.manualComments || "",
    };
  }

  function getManualState(record) {
    return manualMap[record.id] || buildManualDefaults(record);
  }

  function setManualState(recordId, next) {
    setManualMap((prev) => ({ ...prev, [recordId]: next }));
  }

  async function handleCreateActivation() {
    const code = generateActivationCode();
    const payload = {
      residentId: activationForm.residentId,
      sessionCode: session.sessionCode,
      sessionDay: Number(activationForm.sessionDay),
      caseId: activationForm.caseId,
      activationCode: code,
      isActive: true,
      used: false,
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
              <select
                className="w-full rounded-2xl border p-3"
                value={activationForm.residentId}
                onChange={(e) => setActivationForm((f) => ({ ...f, residentId: e.target.value }))}
              >
                {RESIDENT_IDS.map((id) => <option key={id}>{id}</option>)}
              </select>
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
                  New code for {activationForm.residentId}: <span className="font-semibold">{createdCode}</span>
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
                    <div className="font-medium">{a.residentId}</div>
                    <div>Code: {a.activationCode}</div>
                    <div>Status: {a.used ? "Used" : a.isActive ? "Active" : "Inactive"}</div>
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

        <Card title="Submissions for Current Case/Day">
          <div className="space-y-4">
            {todayRecords.map((record) => {
              const manual = getManualState(record);
              return (
                <div key={record.id} className="rounded-2xl border p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{record.residentId}</div>
                      <div className="text-sm text-slate-500">Auto total: {record.autoTotal}/24 · Benchmark: {record.benchmark?.benchmarkPercent ?? 0}%</div>
                    </div>
                    <div className="text-sm text-slate-500">{record.caseId} · Day {record.sessionDay}</div>
                  </div>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="space-y-3">
                      <div className="rounded-xl bg-slate-50 p-3 text-sm"><span className="font-medium">Leading diagnosis:</span> {record.leadingDiagnosis || "—"}</div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6 whitespace-pre-wrap">{record.freeText || "—"}</div>
                      <div className="rounded-xl bg-slate-50 p-3 text-sm leading-6">{record.feedbackText}</div>
                    </div>

                    <div className="space-y-3">
                      {CRFT_DOMAINS.map((domain) => (
                        <div key={domain} className="grid grid-cols-[1fr,180px] items-center gap-3">
                          <div>
                            <div className="text-sm font-medium">{DOMAIN_LABELS[domain]}</div>
                            <div className="text-xs text-slate-500">Auto: {record.autoDomainScores?.[domain] ?? 0}/4</div>
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

                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          multiple
                          className="min-h-[120px] rounded-2xl border p-3"
                          value={manual.selectedBiasTags}
                          onChange={(e) => setManualState(record.id, {
                            ...manual,
                            selectedBiasTags: Array.from(e.target.selectedOptions).map((o) => o.value),
                          })}
                        >
                          {Object.entries(COGNITIVE_BIASES).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>

                        <select
                          multiple
                          className="min-h-[120px] rounded-2xl border p-3"
                          value={manual.selectedErrorTags}
                          onChange={(e) => setManualState(record.id, {
                            ...manual,
                            selectedErrorTags: Array.from(e.target.selectedOptions).map((o) => o.value),
                          })}
                        >
                          {Object.entries(REASONING_ERRORS).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        className="min-h-[100px] w-full rounded-2xl border p-3"
                        value={manual.comments}
                        onChange={(e) => setManualState(record.id, { ...manual, comments: e.target.value })}
                        placeholder="Manual evaluator comments"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {!todayRecords.length ? <div className="text-slate-500">No submissions yet for the current case/day.</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProgramDirectorView({ session, records, activations, onBack }) {
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
        avgBenchmark: average(mine.map((r) => r.benchmark?.benchmarkPercent || 0)),
      };
    })
    .filter((r) => r.count > 0);

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
            <div className="text-3xl font-bold">{activations.filter((a) => a.isActive && !a.used).length}</div>
          </Card>
        </div>

        <Card title="Resident Summary">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Resident</th>
                  <th className="p-2">Assessments</th>
                  <th className="p-2">Avg Auto</th>
                  <th className="p-2">Avg Benchmark</th>
                </tr>
              </thead>
              <tbody>
                {residentSummary.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{r.id}</td>
                    <td className="p-2">{r.count}</td>
                    <td className="p-2">{r.avgAuto.toFixed(1)}</td>
                    <td className="p-2">{r.avgBenchmark.toFixed(0)}%</td>
                  </tr>
                ))}
                {!residentSummary.length ? (
                  <tr><td colSpan={4} className="p-4 text-center text-slate-500">No resident data yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
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
    await markActivationUsed(activationId);
  }

  async function handleCreateActivation(payload) {
    await createActivation(payload);
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
