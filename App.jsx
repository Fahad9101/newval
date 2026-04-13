import React, { useMemo, useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const domains = [
  { key: 'problemFraming', title: 'Problem Framing', levels: { 0: 'Not assessed', 1: 'Incorrect or vague question', 2: 'Symptom description only', 3: 'Correct clinical question', 4: 'Reframes independently when stuck' }, clue: 'define the actual clinical question first. Move from symptoms to the real decision problem that must be solved.' },
  { key: 'syndromeIdentification', title: 'Syndrome Identification', levels: { 0: 'Not assessed', 1: 'Jumps to diagnosis', 2: 'Partial physiology', 3: 'Correct syndrome identified', 4: 'Integrates multi-system physiology' }, clue: 'name the syndrome or physiology before naming the disease. Clarify what pattern the patient fits.' },
  { key: 'differentialDiagnosis', title: 'Differential Diagnosis', levels: { 0: 'Not assessed', 1: 'Narrow or premature', 2: 'Broad but unfocused', 3: 'Structured and prioritized', 4: 'Includes dangerous and subtle causes' }, clue: 'organize the differential into common, dangerous, and treatable causes, then prioritize rather than listing randomly.' },
  { key: 'dataInterpretation', title: 'Data Interpretation', levels: { 0: 'Not assessed', 1: 'Reads numbers only', 2: 'Basic interpretation', 3: 'Uses trends appropriately', 4: 'Tests hypotheses with data' }, clue: 'use trends, context, and timing. Data should confirm or challenge the working diagnosis, not just be repeated.' },
  { key: 'anticipation', title: 'Anticipation', levels: { 0: 'Not assessed', 1: 'Reactive only', 2: 'Limited prediction', 3: 'Predicts next steps', 4: 'Prevents complications proactively' }, clue: 'state what is likely to happen next and what risks should be prevented over the next 12–24 hours.' },
  { key: 'reassessment', title: 'Reassessment', levels: { 0: 'Not assessed', 1: 'Static thinking', 2: 'Adjusts only when told', 3: 'Self-corrects', 4: 'Continuously updates model' }, clue: 'revisit the diagnosis and plan as new information arrives. Show active updating rather than fixed thinking.' },
]

const initialScores = { problemFraming: 0, syndromeIdentification: 0, differentialDiagnosis: 0, dataInterpretation: 0, anticipation: 0, reassessment: 0 }

const appUrl = 'https://fahad9101.github.io/CRFT/'

function getGlobalRating(total) { if (total === 0) return ''; if (total <= 9) return 'Junior'; if (total <= 15) return 'Intermediate'; if (total <= 20) return 'Senior'; return 'Near Consultant' }

function getAutoStrengths(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []
  const s = []
  if (scores.problemFraming >= 3) s.push('The clinical question is being framed with useful structure.')
  if (scores.syndromeIdentification >= 3) s.push('Good syndrome-based reasoning before anchoring.')
  if (scores.differentialDiagnosis >= 3) s.push('Differential is structured and prioritized.')
  if (scores.dataInterpretation >= 3) s.push('Data interpreted with context and trends.')
  if (scores.anticipation >= 3) s.push('Demonstrates forward clinical thinking.')
  if (scores.reassessment >= 3) s.push('Shows dynamic reassessment and updating.')
  return s
}

function getPriorityRecommendations(scores) {
  if (Object.values(scores).every((v) => v === 0)) return []
  const recs = [
    { score: scores.problemFraming, text: 'Define the clinical question before moving to diagnosis.' },
    { score: scores.syndromeIdentification, text: 'Identify syndrome/physiology before naming disease.' },
    { score: scores.differentialDiagnosis, text: 'Structure differential: common, dangerous, treatable.' },
    { score: scores.dataInterpretation, text: 'Use trends and context, not isolated values.' },
    { score: scores.anticipation, text: 'State what will happen next and what to prevent.' },
    { score: scores.reassessment, text: 'Actively reassess when new data appears.' },
  ]
  return recs.filter(r => r.score > 0).sort((a,b)=>a.score-b.score).slice(0,2).map(r=>r.text)
}

function getSummary(scores,total,globalRating){
  if(total===0) return ''
  const strong = Object.entries(scores).filter(([,v])=>v>=3).map(([k])=>domains.find(d=>d.key===k).title)
  const weak = Object.entries(scores).filter(([,v])=>v>0 && v<=2).map(([k])=>domains.find(d=>d.key===k).title)
  return `This represents a ${globalRating.toLowerCase()} pattern with strength in ${strong.slice(0,2).join(' and ') || 'selected domains'} and need for improvement in ${weak.slice(0,2).join(' and ') || 'higher-level reasoning'}.`
}

export default function App(){
  const [scores,setScores]=useState(initialScores)
  const [quick,setQuick]=useState(false)

  useEffect(()=>{ const saved=localStorage.getItem('rubricData'); if(saved) setScores(JSON.parse(saved)) },[])
  useEffect(()=>{ localStorage.setItem('rubricData',JSON.stringify(scores)) },[scores])

  const total = useMemo(()=>Object.values(scores).reduce((a,b)=>a+b,0),[scores])
  const globalRating = getGlobalRating(total)
  const strengths = getAutoStrengths(scores)
  const priorities = getPriorityRecommendations(scores)
  const summary = getSummary(scores,total,globalRating)

  const vals = Object.values(scores).filter(v=>v>0)
  const max = vals.length?Math.max(...vals):null
  const min = vals.length?Math.min(...vals):null

  return (
    <div style={{maxWidth:1100,margin:'auto',padding:16,fontFamily:'Arial'}}>
      
      <h1>CRFT</h1>
      <div style={{marginBottom:10}}>Clinical Reasoning Feedback Tool</div>

      <button onClick={()=>{localStorage.removeItem('rubricData');setScores(initialScores)}}>Reset</button>
      <button onClick={()=>window.print()} style={{marginLeft:10}}>Print</button>
      <button onClick={()=>setQuick(!quick)} style={{marginLeft:10}}>{quick?'Full Mode':'Quick Mode'}</button>

      <p>Total: {total}</p>
      <p>{globalRating}</p>
      {summary && <p><strong>Summary:</strong> {summary}</p>}

      {domains.map(d=>{
        const val = scores[d.key]
        const isMax = val===max && val>0
        const isMin = val===min && val>0
        return (
          <div key={d.key} style={{marginTop:16,padding:10,border:isMax?'2px solid green':isMin?'2px solid red':'1px solid #ccc'}}>
            <h3>{d.title}</h3>
            <select value={val} onChange={e=>setScores({...scores,[d.key]:Number(e.target.value)})}>
              {[0,1,2,3,4].map(n=><option key={n} value={n}>{n} - {d.levels[n]}</option>)}
            </select>
            {!quick && <div style={{fontSize:13}}><strong>Try to:</strong> {d.clue}</div>}
          </div>
        )
      })}

      {strengths.length>0 && <div><h3>Strengths</h3>{strengths.map((s,i)=><div key={i}>{s}</div>)}</div>}
      {priorities.length>0 && <div><h3>Top 2 Priorities</h3>{priorities.map((p,i)=><div key={i}>{p}</div>)}</div>}

      <div style={{marginTop:20,padding:10,border:'1px solid #ccc'}}>
        <h3>Scan to open CRFT</h3>
        <QRCodeSVG value={appUrl} size={140}/>
      </div>

      <div style={{textAlign:'right',color:'green',fontSize:12,marginTop:20}}>
        Developed for KFSHRC-J IM residents
      </div>

    </div>
  )
}
