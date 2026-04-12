import React, { useMemo, useState, useEffect } from 'react'

const domains = [
  {
    key: 'problemFraming',
    title: 'Problem Framing',
    levels: {
      1: 'Incorrect or vague question',
      2: 'Symptom description only',
      3: 'Correct clinical question',
      4: 'Reframes independently when stuck',
    },
    clue:
      'Ideal: define the actual clinical question first. Move from symptoms to the real decision problem that must be solved.',
  },
  {
    key: 'syndromeIdentification',
    title: 'Syndrome Identification',
    levels: {
      1: 'Jumps to diagnosis',
      2: 'Partial physiology',
      3: 'Correct syndrome identified',
      4: 'Integrates multi-system physiology',
    },
    clue:
      'Ideal: name the syndrome or physiology before naming the disease. Clarify what pattern the patient fits.',
  },
  {
    key: 'differentialDiagnosis',
    title: 'Differential Diagnosis',
    levels: {
      1: 'Narrow or premature',
      2: 'Broad but unfocused',
      3: 'Structured and prioritized',
      4: 'Includes dangerous and subtle causes',
    },
    clue:
      'Ideal: organize the differential into common, dangerous, and treatable causes, then prioritize rather than listing randomly.',
  },
  {
    key: 'dataInterpretation',
    title: 'Data Interpretation',
    levels: {
      1: 'Reads numbers only',
      2: 'Basic interpretation',
      3: 'Uses trends appropriately',
      4: 'Tests hypotheses with data',
    },
    clue:
      'Ideal: use trends, context, and timing. Data should confirm or challenge the working diagnosis, not just be repeated.',
  },
  {
    key: 'anticipation',
    title: 'Anticipation',
    levels: {
      1: 'Reactive only',
      2: 'Limited prediction',
      3: 'Predicts next steps',
      4: 'Prevents complications proactively',
    },
    clue:
      'Ideal: state what is likely to happen next and what risks should be prevented over the next 12–24 hours.',
  },
  {
    key: 'reassessment',
    title: 'Reassessment',
    levels: {
      1: 'Static thinking',
      2: 'Adjusts only when told',
      3: 'Self-corrects',
      4: 'Continuously updates model',
    },
    clue:
      'Ideal: revisit the diagnosis and plan as new information arrives. Show active updating rather than fixed thinking.',
  },
]

const initialScores = {
  problemFraming: 1,
  syndromeIdentification: 1,
  differentialDiagnosis: 1,
  dataInterpretation: 1,
  anticipation: 1,
  reassessment: 1,
}

function getGlobalRating(total) {
  if (total <= 9) return 'Junior'
  if (total <= 15) return 'Intermediate'
  if (total <= 20) return 'Senior'
  return 'Near Consultant'
}

function getAutoStrengths(scores) {
  const strengths = []

  if (scores.problemFraming >= 3) {
    strengths.push('The clinical question is being framed with useful structure and direction.')
  }
  if (scores.syndromeIdentification >= 3) {
    strengths.push('The resident identifies the syndrome or physiology appropriately before anchoring too early.')
  }
  if (scores.differentialDiagnosis >= 3) {
    strengths.push('The differential is reasonably organized and prioritized.')
  }
  if (scores.dataInterpretation >= 3) {
    strengths.push('Clinical data is interpreted with attention to pattern and trend rather than isolated values only.')
  }
  if (scores.anticipation >= 3) {
    strengths.push('The resident shows forward thinking by anticipating clinical trajectory and next steps.')
  }
  if (scores.reassessment >= 3) {
    strengths.push('The resident demonstrates willingness to revise the working model as new data emerges.')
  }

  if (strengths.length === 0) {
    strengths.push('No major strength domains identified yet at the current scoring pattern.')
  }

  return strengths
}

function getAutoRecommendations(scores) {
  const recs = []

  if (scores.problemFraming <= 2) {
    recs.push('Before discussing causes, first state the exact clinical question being answered in this case.')
  }
  if (scores.syndromeIdentification <= 2) {
    recs.push('Pause before naming a disease and identify the syndrome or physiology first.')
  }
  if (scores.differentialDiagnosis <= 2) {
    recs.push('Restructure the differential into common, dangerous, and treatable causes, then rank them.')
  }
  if (scores.dataInterpretation <= 2) {
    recs.push('Interpret data using trends, timing, and clinical context rather than repeating individual values.')
  }
  if (scores.anticipation <= 2) {
    recs.push('Add a prediction step: what may happen next, and what complication must be prevented?')
  }
  if (scores.reassessment <= 2) {
    recs.push('Reassess the diagnosis and plan explicitly when new information appears.')
  }

  if (recs.length === 0) {
    recs.push('Maintain the current approach and deepen consultant-level synthesis across all domains.')
  }

  return recs
}

function RadarChart({ scores }) {
  const size = 300
  const center = size / 2
  const radius = 105
  const levels = 4
  const keys = domains.map((d) => d.key)

  const pointsForLevel = (level) => {
    return keys
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
        const r = (radius * level) / levels
        const x = center + Math.cos(angle) * r
        const y = center + Math.sin(angle) * r
        return `${x},${y}`
      })
      .join(' ')
  }

  const dataPoints = keys
    .map((key, i) => {
      const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
      const r = (radius * scores[key]) / levels
      const x = center + Math.cos(angle) * r
      const y = center + Math.sin(angle) * r
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {[1, 2, 3, 4].map((level) => (
          <polygon
            key={level}
            points={pointsForLevel(level)}
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
        ))}

        {keys.map((key, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
          const x = center + Math.cos(angle) * radius
          const y = center + Math.sin(angle) * radius
          return (
            <line
              key={key}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="#d1d5db"
              strokeWidth="1"
            />
          )
        })}

        <polygon
          points={dataPoints}
          fill="rgba(12, 74, 110, 0.18)"
          stroke="#0c4a6e"
          strokeWidth="2"
        />

        {keys.map((key, i) => {
          const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2
          const r = (radius * scores[key]) / levels
          const x = center + Math.cos(angle) * r
          const y = center + Math.sin(angle) * r
          return <circle key={key} cx={x} cy={y} r="4" fill="#0c4a6e" />
        })}

        {domains.map((domain, i) => {
          const angle = (Math.PI * 2 * i) / domains.length - Math.PI / 2
          const labelRadius = radius + 22
          const x = center + Math.cos(angle) * labelRadius
          const y = center + Math.sin(angle) * labelRadius

          return (
            <text
              key={domain.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill="#334155"
            >
              {domain.title}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

export default function App() {
  const [resident, setResident] = useState('')
  const [evaluator, setEvaluator] = useState('')
  const [rotation, setRotation] = useState('')
  const [caseName, setCaseName] = useState('')
  const [scores, setScores] = useState(initialScores)
  const [strengthsNotes, setStrengthsNotes] = useState('')
  const [improvementsNotes, setImprovementsNotes] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('rubricData')
    if (saved) {
      const data = JSON.parse(saved)
      setResident(data.resident || '')
      setEvaluator(data.evaluator || '')
      setRotation(data.rotation || '')
      setCaseName(data.caseName || '')
      setScores(data.scores || initialScores)
      setStrengthsNotes(data.strengthsNotes || '')
      setImprovementsNotes(data.improvementsNotes || '')
    }
  }, [])

  useEffect(() => {
    const data = {
      resident,
      evaluator,
      rotation,
      caseName,
      scores,
      strengthsNotes,
      improvementsNotes,
    }
    localStorage.setItem('rubricData', JSON.stringify(data))
  }, [resident, evaluator, rotation, caseName, scores, strengthsNotes, improvementsNotes])

  const total = useMemo(() => {
    return Object.values(scores).reduce((sum, value) => sum + Number(value), 0)
  }, [scores])

  const globalRating = getGlobalRating(total)
  const autoStrengths = useMemo(() => getAutoStrengths(scores), [scores])
  const autoRecommendations = useMemo(() => getAutoRecommendations(scores), [scores])

  return (
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 16,
        fontFamily: 'Arial, sans-serif',
        color: '#0f172a',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0c4a6e, #0f766e)',
          color: 'white',
          borderRadius: 18,
          padding: 18,
          marginBottom: 18,
          boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 44px)' }}>
          Resident Assessment Feedback Tool
        </h1>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          onClick={() => {
            localStorage.removeItem('rubricData')
            setResident('')
            setEvaluator('')
            setRotation('')
            setCaseName('')
            setScores(initialScores)
            setStrengthsNotes('')
            setImprovementsNotes('')
          }}
          style={{
            padding: '10px 14px',
            background: '#e11d48',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reset
        </button>

        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 14px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Print / Save PDF
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div>
          <label><strong>Resident</strong></label>
          <input
            value={resident}
            onChange={(e) => setResident(e.target.value)}
            style={{ width: '100%', padding: 12, marginTop: 6, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label><strong>Evaluator</strong></label>
          <input
            value={evaluator}
            onChange={(e) => setEvaluator(e.target.value)}
            style={{ width: '100%', padding: 12, marginTop: 6, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label><strong>Rotation</strong></label>
          <input
            value={rotation}
            onChange={(e) => setRotation(e.target.value)}
            style={{ width: '100%', padding: 12, marginTop: 6, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </div>

        <div>
          <label><strong>Case</strong></label>
          <input
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            style={{ width: '100%', padding: 12, marginTop: 6, borderRadius: 10, border: '1px solid #cbd5e1' }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#f8fafc',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Summary</h2>
          <p style={{ margin: '8px 0' }}><strong>Total Score:</strong> {total} / 24</p>
          <p style={{ margin: '8px 0' }}><strong>Global Rating:</strong> {globalRating}</p>
        </div>

        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#ffffff',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Performance Radar</h2>
          <RadarChart scores={scores} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        {domains.map((domain) => (
          <div
            key={domain.key}
            style={{
              border: '1px solid #dbe4ee',
              borderRadius: 16,
              padding: 16,
              background: '#ffffff',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>{domain.title}</h3>

            <select
              value={scores[domain.key]}
              onChange={(e) =>
                setScores((prev) => ({
                  ...prev,
                  [domain.key]: Number(e.target.value),
                }))
              }
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 10,
                border: '1px solid #cbd5e1',
              }}
            >
              {[1, 2, 3, 4].map((level) => (
                <option key={level} value={level}>
                  {level} - {domain.levels[level]}
                </option>
              ))}
            </select>

            <p style={{ marginTop: 10, marginBottom: 6, color: '#475569' }}>
              Current level: {domain.levels[scores[domain.key]]}
            </p>

            <div
              style={{
                marginTop: 8,
                padding: 12,
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#334155',
                fontSize: 14,
              }}
            >
              <strong>Illustration / clue:</strong> {domain.clue}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#f8fafc',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Auto-Generated Strengths</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {autoStrengths.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#f8fafc',
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Auto-Generated Recommendations</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {autoRecommendations.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'white',
                  border: '1px solid #e2e8f0',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 40,
        }}
      >
        <div>
          <label><strong>Additional Strength Notes</strong></label>
          <textarea
            value={strengthsNotes}
            onChange={(e) => setStrengthsNotes(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              borderRadius: 10,
              border: '1px solid #cbd5e1',
            }}
          />
        </div>

        <div>
          <label><strong>Additional Improvement Notes</strong></label>
          <textarea
            value={improvementsNotes}
            onChange={(e) => setImprovementsNotes(e.target.value)}
            rows={6}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 6,
              borderRadius: 10,
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
      </div>

      <div
        style={{
          textAlign: 'right',
          color: 'green',
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        made in KFSHRC-J
      </div>
    </div>
  )
}
