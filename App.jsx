import React, { useMemo, useState, useEffect } from 'react'

const domains = [
  {
    key: 'problemFraming',
    title: 'Problem Framing',
    levels: {
      0: 'Not assessed',
      1: 'Incorrect or vague question',
      2: 'Symptom description only',
      3: 'Correct clinical question',
      4: 'Reframes independently when stuck',
    },
    clue:
      'define the actual clinical question first. Move from symptoms to the real decision problem that must be solved.',
  },
  {
    key: 'syndromeIdentification',
    title: 'Syndrome Identification',
    levels: {
      0: 'Not assessed',
      1: 'Jumps to diagnosis',
      2: 'Partial physiology',
      3: 'Correct syndrome identified',
      4: 'Integrates multi-system physiology',
    },
    clue:
      'name the syndrome or physiology before naming the disease. Clarify what pattern the patient fits.',
  },
  {
    key: 'differentialDiagnosis',
    title: 'Differential Diagnosis',
    levels: {
      0: 'Not assessed',
      1: 'Narrow or premature',
      2: 'Broad but unfocused',
      3: 'Structured and prioritized',
      4: 'Includes dangerous and subtle causes',
    },
    clue:
      'organize the differential into common, dangerous, and treatable causes, then prioritize rather than listing randomly.',
  },
  {
    key: 'dataInterpretation',
    title: 'Data Interpretation',
    levels: {
      0: 'Not assessed',
      1: 'Reads numbers only',
      2: 'Basic interpretation',
      3: 'Uses trends appropriately',
      4: 'Tests hypotheses with data',
    },
    clue:
      'use trends, context, and timing. Data should confirm or challenge the working diagnosis, not just be repeated.',
  },
  {
    key: 'anticipation',
    title: 'Anticipation',
    levels: {
      0: 'Not assessed',
      1: 'Reactive only',
      2: 'Limited prediction',
      3: 'Predicts next steps',
      4: 'Prevents complications proactively',
    },
    clue:
      'state what is likely to happen next and what risks should be prevented over the next 12–24 hours.',
  },
  {
    key: 'reassessment',
    title: 'Reassessment',
    levels: {
      0: 'Not assessed',
      1: 'Static thinking',
      2: 'Adjusts only when told',
      3: 'Self-corrects',
      4: 'Continuously updates model',
    },
    clue:
      'revisit the diagnosis and plan as new information arrives. Show active updating rather than fixed thinking.',
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

const teachingPrompts = [
  'What is the actual clinical question in this case?',
  'What syndrome or physiology best explains the presentation?',
  'What are the common, dangerous, and treatable causes here?',
  'Which data points support the current working diagnosis, and which do not fit?',
  'What is most likely to happen in the next 12–24 hours if nothing changes?',
  'What would make you reassess and update your model?',
]

function getGlobalRating(total) {
  if (total === 0) return ''
  if (total <= 9) return 'Junior'
  if (total <= 15) return 'Intermediate'
  if (total <= 20) return 'Senior'
  return 'Near Consultant'
}

function getAutoStrengths(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []

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

  return strengths
}

function getPriorityRecommendations(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []

  const candidates = [
    {
      key: 'problemFraming',
      score: scores.problemFraming,
      text: 'Before discussing causes, first state the exact clinical question being answered in this case.',
    },
    {
      key: 'syndromeIdentification',
      score: scores.syndromeIdentification,
      text: 'Pause before naming a disease and identify the syndrome or physiology first.',
    },
    {
      key: 'differentialDiagnosis',
      score: scores.differentialDiagnosis,
      text: 'Restructure the differential into common, dangerous, and treatable causes, then rank them.',
    },
    {
      key: 'dataInterpretation',
      score: scores.dataInterpretation,
      text: 'Interpret data using trends, timing, and clinical context rather than repeating individual values.',
    },
    {
      key: 'anticipation',
      score: scores.anticipation,
      text: 'Add a prediction step: what may happen next, and what complication must be prevented?',
    },
    {
      key: 'reassessment',
      score: scores.reassessment,
      text: 'Reassess the diagnosis and plan explicitly when new information appears.',
    },
  ]

  return candidates
    .filter((item) => item.score > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((item) => item.text)
}

function getOneLineSummary(scores, total, globalRating) {
  if (total === 0) return ''

  const strong = Object.entries(scores)
    .filter(([, value]) => value >= 3)
    .map(([key]) => domains.find((d) => d.key === key)?.title)
    .filter(Boolean)

  const weak = Object.entries(scores)
    .filter(([, value]) => value > 0 && value <= 2)
    .map(([key]) => domains.find((d) => d.key === key)?.title)
    .filter(Boolean)

  const strongText = strong.length ? strong.slice(0, 2).join(' and ').toLowerCase() : 'selected domains'
  const weakText = weak.length ? weak.slice(0, 2).join(' and ').toLowerCase() : 'higher-order reasoning'

  return `Overall, this assessment suggests a ${globalRating.toLowerCase()} pattern, with relative strength in ${strongText} and the greatest need for development in ${weakText}.`
}

function getConsultantReport({
  resident,
  evaluator,
  rotation,
  caseName,
  scores,
  total,
  globalRating,
  strengths,
  priorities,
}) {
  if (total === 0) return ''

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

  const intro = contextBits.length ? `${contextBits.join(' · ')}.` : ''

  const para1 = `This CRFT assessment places the learner in the ${globalRating} range with a total score of ${total}/24. ${
    strongDomains.length
      ? `Relative strengths were observed in ${strongDomains.slice(0, 3).join(', ')}.`
      : 'No clear strength domains were established in this assessment.'
  }`

  const para2 = `${
    weakDomains.length
      ? `The main areas for improvement were ${weakDomains.slice(0, 3).join(', ')}.`
      : 'No major deficit domains were identified among the assessed categories.'
  } ${
    priorities.length
      ? `The most useful next steps are: ${priorities.join(' ')}`
      : ''
  }`

  const para3 = strengths.length
    ? `In practical terms, the learner is showing signs of developing structured clinical reasoning, and feedback should now focus on deepening consistency, prioritization, and anticipatory thinking.`
    : `At this stage, feedback should focus on helping the learner build a clearer structure for case framing, physiological reasoning, and dynamic reassessment.`

  return [intro, para1, para2, para3].filter(Boolean).join('\n\n')
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
  const [quickMode, setQuickMode] = useState(false)
  const [showTeachingMode, setShowTeachingMode] = useState(false)
  const [showConsultantReport, setShowConsultantReport] = useState(true)

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
      setQuickMode(data.quickMode || false)
      setShowTeachingMode(data.showTeachingMode || false)
      setShowConsultantReport(
        typeof data.showConsultantReport === 'boolean' ? data.showConsultantReport : true
      )
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
      quickMode,
      showTeachingMode,
      showConsultantReport,
    }
    localStorage.setItem('rubricData', JSON.stringify(data))
  }, [
    resident,
    evaluator,
    rotation,
    caseName,
    scores,
    strengthsNotes,
    improvementsNotes,
    quickMode,
    showTeachingMode,
    showConsultantReport,
  ])

  const total = useMemo(() => {
    return Object.values(scores).reduce((sum, value) => sum + Number(value), 0)
  }, [scores])

  const globalRating = getGlobalRating(total)
  const autoStrengths = useMemo(() => getAutoStrengths(scores), [scores])
  const priorityRecommendations = useMemo(() => getPriorityRecommendations(scores), [scores])
  const oneLineSummary = useMemo(
    () => getOneLineSummary(scores, total, globalRating),
    [scores, total, globalRating]
  )

  const consultantReport = useMemo(
    () =>
      getConsultantReport({
        resident,
        evaluator,
        rotation,
        caseName,
        scores,
        total,
        globalRating,
        strengths: autoStrengths,
        priorities: priorityRecommendations,
      }),
    [
      resident,
      evaluator,
      rotation,
      caseName,
      scores,
      total,
      globalRating,
      autoStrengths,
      priorityRecommendations,
    ]
  )

  const nonZeroScores = Object.values(scores).filter((v) => v > 0)
  const highestScore = nonZeroScores.length ? Math.max(...nonZeroScores) : null
  const lowestScore = nonZeroScores.length ? Math.min(...nonZeroScores) : null

  const copyConsultantReport = async () => {
    if (!consultantReport) return
    try {
      await navigator.clipboard.writeText(consultantReport)
      alert('Consultant report copied.')
    } catch {
      alert('Copy failed. Please copy manually.')
    }
  }

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
        <h1 style={{ margin: 0, fontSize: 'clamp(28px, 5vw, 44px)' }}>CRFT</h1>
        <div style={{ marginTop: 6, opacity: 0.95, fontSize: 15 }}>
          Clinical Reasoning Feedback Tool
        </div>
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
            setQuickMode(false)
            setShowTeachingMode(false)
            setShowConsultantReport(true)
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

        <button
          onClick={() => setQuickMode(!quickMode)}
          style={{
            padding: '10px 14px',
            background: quickMode ? '#0f766e' : '#475569',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {quickMode ? 'Exit Quick Mode' : 'Quick Mode'}
        </button>

        <button
          onClick={() => setShowTeachingMode(!showTeachingMode)}
          style={{
            padding: '10px 14px',
            background: showTeachingMode ? '#7c3aed' : '#475569',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showTeachingMode ? 'Hide Teaching Mode' : 'Case Teaching Mode'}
        </button>

        <button
          onClick={() => setShowConsultantReport(!showConsultantReport)}
          style={{
            padding: '10px 14px',
            background: showConsultantReport ? '#0f766e' : '#475569',
            color: 'white',
            border: 'none',
            borderRadius: 10,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showConsultantReport ? 'Hide Report Generator' : 'Show Report Generator'}
        </button>
      </div>

      {!quickMode && (
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
      )}

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
          {globalRating && <p style={{ margin: '8px 0' }}><strong>Global Rating:</strong> {globalRating}</p>}
          {oneLineSummary && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: 'white',
                border: '1px solid #e2e8f0',
              }}
            >
              <strong>1-line summary:</strong> {oneLineSummary}
            </div>
          )}
        </div>

        {!quickMode && (
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
        )}
      </div>

      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        {domains.map((domain) => {
          const score = scores[domain.key]
          const isHighest = highestScore !== null && score === highestScore && score > 0
          const isLowest = lowestScore !== null && score === lowestScore && score > 0

          return (
            <div
              key={domain.key}
              style={{
                border: isHighest
                  ? '2px solid #16a34a'
                  : isLowest
                  ? '2px solid #dc2626'
                  : '1px solid #dbe4ee',
                borderRadius: 16,
                padding: 16,
                background: isHighest
                  ? '#f0fdf4'
                  : isLowest
                  ? '#fef2f2'
                  : '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <h3 style={{ marginTop: 0, marginBottom: 10 }}>{domain.title}</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {isHighest && (
                    <span
                      style={{
                        background: '#16a34a',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Highest
                    </span>
                  )}
                  {isLowest && (
                    <span
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      Lowest
                    </span>
                  )}
                </div>
              </div>

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
                {[0, 1, 2, 3, 4].map((level) => (
                  <option key={level} value={level}>
                    {level} - {domain.levels[level]}
                  </option>
                ))}
              </select>

              <p style={{ marginTop: 10, marginBottom: 6, color: '#475569' }}>
                Current level: {domain.levels[scores[domain.key]]}
              </p>

              {!quickMode && (
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
                  <strong>Try to:</strong> {domain.clue}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showTeachingMode && (
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#faf5ff',
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Case-Based Teaching Mode</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {teachingPrompts.map((prompt, index) => (
              <div
                key={index}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'white',
                  border: '1px solid #e9d5ff',
                }}
              >
                {prompt}
              </div>
            ))}
          </div>
        </div>
      )}

      {autoStrengths.length > 0 && (
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#f8fafc',
            marginBottom: 18,
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
      )}

      {priorityRecommendations.length > 0 && (
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#f8fafc',
            marginBottom: 18,
          }}
        >
          <h2 style={{ marginTop: 0, fontSize: 20 }}>Top 2 Priorities</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {priorityRecommendations.map((item, index) => (
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
      )}

      {showConsultantReport && consultantReport && (
        <div
          style={{
            border: '1px solid #dbe4ee',
            borderRadius: 16,
            padding: 18,
            background: '#eff6ff',
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <h2 style={{ marginTop: 0, fontSize: 20, marginBottom: 0 }}>Consultant Report Generator</h2>
            <button
              onClick={copyConsultantReport}
              style={{
                padding: '10px 14px',
                background: '#1d4ed8',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy Report
            </button>
          </div>
          <textarea
            value={consultantReport}
            readOnly
            rows={12}
            style={{
              width: '100%',
              padding: 12,
              marginTop: 12,
              borderRadius: 10,
              border: '1px solid #bfdbfe',
              background: 'white',
            }}
          />
        </div>
      )}

      {!quickMode && (
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
      )}

      <div
        style={{
          textAlign: 'right',
          color: 'green',
          fontSize: 12,
          marginBottom: 8,
        }}
      >
        Developed for KFSHRC-J IM Residents 
      </div>
    </div>
  )
}
