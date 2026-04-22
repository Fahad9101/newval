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
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [activations, setActivations] = useState([]);

  useEffect(() => {
    ensureAnonymousAuth();
    const unsub1 = subscribeToSessionConfig(setSession);
    const unsub2 = subscribeToSubmissions(setRecords);
    const unsub3 = subscribeToActivations(setActivations);

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, []);

  // =========================
  // HANDLERS
  // =========================

  async function handleSaveManualEvaluation(id, payload) {
    await updateSubmissionManual(id, payload);
  }

  async function handleCreateActivation(payload) {
    await createActivation(payload);
  }

  // =========================
  // ROLE SELECT
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

  return <div>Other roles unchanged</div>;
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
  const [manualState, setManualState] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [code, setCode] = useState("");

  function toggleTag(id, type, tag) {
    const current = manualState[id]?.[type] || [];
    const next = current.includes(tag)
      ? current.filter((x) => x !== tag)
      : [...current, tag];

    setManualState((p) => ({
      ...p,
      [id]: { ...p[id], [type]: next },
    }));
  }

  function setDomain(id, domain, value) {
    setManualState((p) => ({
      ...p,
      [id]: {
        ...p[id],
        scores: { ...p[id]?.scores, [domain]: Number(value) },
      },
    }));
  }

  function buildComment(summary, bias, error) {
    return `
Strength: ${summary.strong.join(", ") || "none"}
Weakness: ${summary.weak.join(", ") || "none"}
Bias: ${bias.join(", ") || "none"}
Errors: ${error.join(", ") || "none"}
Total: ${summary.total}/24
    `;
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

  async function submitManual(id, record) {
    const data = manualState[id] || {};
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

      <h2>Evaluator</h2>

      <button onClick={generateCode}>Generate Case Code</button>
      <div>{code}</div>

      {records.map((r) => {
        const m = manualState[r.id] || {};
        const summary = summarize(m.scores || {});

        const isDone = submitted[r.id];

        return (
          <div key={r.id} style={{ border: "1px solid", margin: 10, padding: 10 }}>
            <h3>{r.residentId}</h3>

            <div>{r.freeText}</div>

            <h4>Manual Scoring</h4>

            {DOMAINS.map((d) => (
              <div key={d}>
                {DOMAIN_LABELS[d]}
                <select onChange={(e) => setDomain(r.id, d, e.target.value)}>
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </div>
            ))}

            <h4>Bias</h4>
            {Object.entries(BIASES).map(([k, v]) => (
              <label key={k}>
                <input
                  type="checkbox"
                  onChange={() => toggleTag(r.id, "bias", k)}
                />
                {v}
              </label>
            ))}

            <h4>Error</h4>
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
            <pre>
              {buildComment(summary, m.bias || [], m.error || [])}
            </pre>

            <button onClick={() => submitManual(r.id, r)}>
              Submit Manual
            </button>

            {isDone ? (
              <div>
                <h4>Auto Evaluation</h4>
                {r.autoTotal}
              </div>
            ) : (
              <div>Auto hidden</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
