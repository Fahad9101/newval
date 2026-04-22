import React, { useEffect, useState } from "react";

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

// =========================
// CONSTANTS
// =========================

const RESIDENT_IDS = ["R1", "R2", "R3", "R4", "R5"];

const DOMAINS = [
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

const BIASES = {
  anchoring: "Anchoring Bias",
  confirmation: "Confirmation Bias",
  availability: "Availability Bias",
};

const ERRORS = {
  wrongQuestion: "Wrong Question Framing",
  prematureClosure: "Premature Closure",
  misinterpretation: "Incorrect Data Interpretation",
};

// =========================
// MAIN APP
// =========================

export default function App() {
  const [role, setRole] = useState("");
  const [records, setRecords] = useState([]);
  const [activations, setActivations] = useState([]);

  useEffect(() => {
    ensureAnonymousAuth();
    const unsub1 = subscribeToSubmissions(setRecords);
    const unsub2 = subscribeToActivations(setActivations);

    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // =========================
  // FIXED HANDLER
  // =========================

  async function handleSaveManualEvaluation(id, payload) {
    await updateSubmissionManual(id, payload);
  }

  async function handleCreateActivation(payload) {
    await createActivation(payload);
  }

  // =========================
  // ROLE SCREEN
  // =========================

  if (!role) {
    return (
      <div style={{ padding: 40 }}>
        <h2>Select Role</h2>
        <button onClick={() => setRole("Resident")}>Resident</button>
        <button onClick={() => setRole("Evaluator")}>Evaluator</button>
        <button onClick={() => setRole("PD")}>Program Director</button>
      </div>
    );
  }

  if (role === "Evaluator") {
    return (
      <EvaluatorView
        records={records}
        activations={activations}
        onSaveManualEvaluation={handleSaveManualEvaluation}
        onCreateActivation={handleCreateActivation}
        onBack={() => setRole("")}
      />
    );
  }

  if (role === "Resident") {
    return <div style={{ padding: 40 }}>Resident UI (unchanged)</div>;
  }

  if (role === "PD") {
    return <div style={{ padding: 40 }}>Program Director Dashboard (unchanged)</div>;
  }
}

// =========================
// EVALUATOR VIEW
// =========================

function EvaluatorView({
  records,
  activations,
  onSaveManualEvaluation,
  onCreateActivation,
  onBack,
}) {
  const [manual, setManual] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [code, setCode] = useState("");

  function setScore(id, domain, value) {
    setManual((p) => ({
      ...p,
      [id]: {
        ...p[id],
        scores: { ...p[id]?.scores, [domain]: Number(value) },
      },
    }));
  }

  function toggleTag(id, type, tag) {
    const current = manual[id]?.[type] || [];
    const next = current.includes(tag)
      ? current.filter((x) => x !== tag)
      : [...current, tag];

    setManual((p) => ({
      ...p,
      [id]: { ...p[id], [type]: next },
    }));
  }

  function summarize(scores = {}) {
    const total = Object.values(scores).reduce((a, b) => a + (b || 0), 0);

    const strong = Object.entries(scores)
      .filter(([_, v]) => v >= 3)
      .map(([k]) => DOMAIN_LABELS[k]);

    const weak = Object.entries(scores)
      .filter(([_, v]) => v <= 1)
      .map(([k]) => DOMAIN_LABELS[k]);

    return { total, strong, weak };
  }

  function buildComment(summary, bias, error) {
    return `
Strength: ${summary.strong.join(", ") || "none"}
Weakness: ${summary.weak.join(", ") || "none"}
Bias: ${bias.join(", ") || "none"}
Errors: ${error.join(", ") || "none"}
Total Score: ${summary.total}/24
`;
  }

  async function submitManual(id, record) {
    const data = manual[id] || {};
    const summary = summarize(data.scores);

    const comment = buildComment(
      summary,
      data.bias || [],
      data.error || []
    );

    await onSaveManualEvaluation(id, {
      manualDomainScores: data.scores,
      manualTotal: summary.total,
      manualBiasTags: data.bias || [],
      manualErrorTags: data.error || [],
      manualComments: comment,
    });

    setSubmitted((p) => ({ ...p, [id]: true }));
  }

  async function generateCode() {
    const c = generateActivationCode();

    await onCreateActivation({
      sessionCode: "CRFT",
      sessionDay: 1,
      caseId: "C1",
      activationCode: c,
      allowedResidentIds: RESIDENT_IDS,
      usedResidentIds: [],
      isActive: true,
    });

    setCode(c);
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={onBack}>Back</button>

      <h2>Evaluator Panel</h2>

      <button onClick={generateCode}>Generate Case Code</button>
      <div style={{ marginBottom: 20 }}>{code}</div>

      {records.map((r) => {
        const m = manual[r.id] || {};
        const summary = summarize(m.scores || {});
        const done = submitted[r.id];

        return (
          <div key={r.id} style={{ border: "1px solid", margin: 10, padding: 10 }}>
            <h3>{r.residentId}</h3>

            <div>{r.freeText}</div>

            <h4>Manual Scoring</h4>

            {DOMAINS.map((d) => (
              <div key={d}>
                {DOMAIN_LABELS[d]}
                <select onChange={(e) => setScore(r.id, d, e.target.value)}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            ))}

            <h4>Cognitive Bias</h4>
            {Object.entries(BIASES).map(([k, v]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  onChange={() => toggleTag(r.id, "bias", k)}
                />
                {v}
              </label>
            ))}

            <h4>Reasoning Errors</h4>
            {Object.entries(ERRORS).map(([k, v]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  onChange={() => toggleTag(r.id, "error", k)}
                />
                {v}
              </label>
            ))}

            <h4>Generated Feedback</h4>
            <pre>{buildComment(summary, m.bias || [], m.error || [])}</pre>

            <button onClick={() => submitManual(r.id, r)}>
              Submit Manual Evaluation
            </button>

            {done ? (
              <div style={{ marginTop: 10 }}>
                <h4>Auto Evaluation</h4>
                {r.autoTotal}
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>Auto hidden</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
