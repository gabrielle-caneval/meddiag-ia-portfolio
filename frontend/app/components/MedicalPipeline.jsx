
/*

PROTECTION – DROITS D’AUTEUR – 2026

 

© 2026 

 

Ce travail (code source + documents associés) est protégé par le droit d’auteur.

Code consultable pour évaluation du portfolio. Voir LICENSE.

Aucune cession de droits. Toute autre utilisation (reproduction, modification,

exploitation pédagogique ou commerciale) interdite sans accord écrit préalable.

*/
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import WebcamCapture from "./WebcamCapture";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
async function apiFetch(path, body) {
  const r = await fetch(`${API_BASE}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) {
    try {
      const err = JSON.parse(text);
      const msg = err.detail || err.message || text;
      if (msg.includes("rate_limit") || msg.includes("Rate limit") || msg.includes("429"))
        throw new Error("⏳ Limite de tokens atteinte. Réessayez dans quelques minutes.");
      throw new Error(msg.substring(0,200));
    } catch(e) {
      if (e.message.startsWith("⏳") || e.message.length < 200) throw e;
      throw new Error(`Erreur serveur ${r.status}`);
    }
  }
  try { return JSON.parse(text); } catch { throw new Error("Réponse invalide du serveur"); }
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const P = {
  turquoise:"#75ddd3", turquoiseDark:"#4bbfb5", turquoiseLight:"rgba(117,221,211,0.12)",
  azur:"#54a4bf", azurDark:"#3a7fa0", azurFaint:"rgba(84,164,191,0.08)",
  jaune:"#e1e776", jauneDark:"#c4ca50",
  white:"#ffffff", bg:"#f7f8fa", bgCard:"#ffffff",
  text:"#1d1d1f", textSub:"#3d3d3f", textMuted:"#86868b",
  border:"rgba(0,0,0,0.08)", borderMed:"rgba(0,0,0,0.12)",
  shadow:"0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
  shadowLg:"0 4px 16px rgba(0,0,0,0.1), 0 16px 40px rgba(0,0,0,0.08)",
  red:"#ff3b30", orange:"#ff9500", green:"#34c759",
};

function Icon({name, size=20, color, style={}}) {
  return (
    <span className="material-symbols-rounded" translate="no" aria-hidden="true"
      style={{fontSize:size,lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",
        userSelect:"none",flexShrink:0,fontFamily:"'Material Symbols Rounded'",
        fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
        ...(color?{color}:{}),...style}}>
      {name}
    </span>
  );
}

const card = (x={}) => ({background:P.bgCard,border:`1px solid ${P.border}`,borderRadius:18,padding:24,boxShadow:P.shadow,...x});
const inputSty = {width:"100%",background:"rgba(0,0,0,0.03)",border:`1px solid ${P.border}`,borderRadius:12,padding:"10px 14px",color:P.text,fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box",transition:"all 0.15s"};

function useHover() { const [h,setH]=useState(false); return [h,{onMouseEnter:()=>setH(true),onMouseLeave:()=>setH(false)}]; }

function Btn({onClick,disabled,children,variant="primary",small=false,style={}}) {
  const [hov,hProps]=useHover();
  const [p,setP]=useState(false);
  const V={
    primary:  {bg:hov&&!disabled?P.turquoiseDark:P.turquoise, color:P.text, shadow:hov?"0 4px 20px rgba(117,221,211,0.55)":"none", border:"none"},
    secondary:{bg:"transparent", color:P.azur, shadow:"none", border:`1.5px solid ${hov?P.azur:P.border}`},
    success:  {bg:hov&&!disabled?"#2db84d":P.green, color:"#fff", shadow:hov?"0 4px 16px rgba(52,199,89,0.4)":"none", border:"none"},
    danger:   {bg:hov&&!disabled?"#d70015":P.red, color:"#fff", shadow:hov?"0 4px 12px rgba(255,59,48,0.4)":"none", border:"none"},
    ghost:    {bg:hov&&!disabled?"rgba(0,0,0,0.05)":"transparent", color:P.textSub, shadow:"none", border:"none"},
  }[variant]||{};
  return (
    <button {...hProps} onMouseDown={()=>setP(true)} onMouseUp={()=>setP(false)} onClick={disabled?undefined:onClick}
      style={{background:V.bg,color:V.color,boxShadow:V.shadow,border:V.border||"none",
        borderRadius:small?8:12,padding:small?"7px 14px":"11px 22px",fontWeight:600,fontSize:small?12:14,
        cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.18s",
        display:"inline-flex",alignItems:"center",gap:6,
        transform:p&&!disabled?"scale(0.97)":"scale(1)",opacity:disabled?0.4:1,...style}}>
      {children}
    </button>
  );
}

// ─── Constantes par défaut ─────────────────────────────────────────────────
const DEFAULT_VITALS = [
  {key:"tension",       icon:"favorite",           label:"Tension",      unit:"mmHg", ph:"120/80"},
  {key:"fc",            icon:"ecg_heart",           label:"FC",           unit:"bpm",  ph:"72"},
  {key:"temperature",   icon:"device_thermostat",   label:"Température",  unit:"°C",   ph:"37.2"},
  {key:"poids",         icon:"scale",               label:"Poids",        unit:"kg",   ph:"70"},
  {key:"spo2",          icon:"pulmonology",         label:"SpO₂",         unit:"%",    ph:"98"},
  {key:"glycemie",      icon:"labs",                label:"Glycémie",     unit:"g/L",  ph:"1.0"},
  {key:"taille",        icon:"straighten",          label:"Taille",       unit:"cm",   ph:"170"},
  {key:"imc",           icon:"monitor_weight",      label:"IMC",          unit:"",     ph:"calc. auto"},
];

// Auto-extract vitals from text
function extractVitalsFromText(text) {
  const t = text.toLowerCase();
  const extracted = {};
  const patterns = [
    { key:"tension",     regex:/(?:ta|tension|pa|bp)\s*[:=]?\s*(\d{2,3}\/\d{2,3})/i },
    { key:"tension",     regex:/(\d{2,3}\/\d{2,3})\s*(?:mm\s*hg|mmhg)/i },
    { key:"fc",          regex:/(?:fc|pouls|hr|bpm)\s*[:=]?\s*(\d{2,3})\s*(?:bpm)?/i },
    { key:"temperature", regex:/(?:t°?|temp[ée]rature|fièvre)\s*[:=]?\s*(\d{2}[.,]\d)/i },
    { key:"temperature", regex:/(\d{2}[.,]\d)\s*°?c\b/i },
    { key:"spo2",        regex:/(?:spo2|saturation|sat)\s*[:=]?\s*(\d{2,3})\s*%?/i },
    { key:"poids",       regex:/(?:poids|weight)\s*[:=]?\s*(\d{2,3}(?:[.,]\d)?)\s*kg/i },
    { key:"glycemie",    regex:/(?:glyc[eé]mie|dextro|gly)\s*[:=]?\s*(\d+[.,]?\d*)\s*(?:g\/l|mmol)?/i },
    { key:"taille",      regex:/(?:taille|height)\s*[:=]?\s*(\d{2,3})\s*cm/i },
  ];
  patterns.forEach(({key, regex}) => {
    if (extracted[key]) return;
    const m = text.match(regex);
    if (m) extracted[key] = m[1].replace(",",".");
  });
  return extracted;
}

// ─── Login (infirmier uniquement) ─────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [role,setRole]=useState("infirmier");
  const [name,setName]=useState("");
  const [service,setService]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const handleLogin=async()=>{
    if(!name.trim()){setError("Indiquez votre nom");return;}
    setLoading(true);
    await new Promise(r=>setTimeout(r,500));
    onLogin({name:name.trim(),role,service:service.trim()||"Service de soins"});
    setLoading(false);
  };
  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg, #e8f4f8 0%, #f7f8fa 40%, #f0f9f7 100%)`,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{width:"100%",maxWidth:420,animation:"fadeUp 0.5s cubic-bezier(0.4,0,0.2,1)"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{width:72,height:72,background:P.turquoise,borderRadius:22,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,boxShadow:`0 8px 32px rgba(117,221,211,0.4)`}}>
            <Icon name="local_hospital" size={36} color={P.text}/>
          </div>
          <div style={{fontSize:28,fontWeight:700,color:P.text,letterSpacing:"-0.5px"}}>MedDiag IA</div>
          <div style={{fontSize:14,color:P.textMuted,marginTop:6}}>Exploration académique de pipelines IA</div>
        </div>
        <div style={{background:P.white,borderRadius:22,padding:32,boxShadow:P.shadowLg,border:`1px solid ${P.border}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {[{id:"infirmier",icon:"medical_services",label:"Infirmier(e)",desc:"Collecte des données patient",color:P.turquoise},
              {id:"medecin",icon:"stethoscope",label:"Médecin",desc:"Validation et prescription",color:P.azur}].map(r=>{
              const active=role===r.id;
              return <div key={r.id} onClick={()=>setRole(r.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:14,cursor:"pointer",transition:"all 0.18s",background:active?`${r.color}12`:"rgba(0,0,0,0.01)",border:`1.5px solid ${active?r.color:P.border}`}}>
                <div style={{width:38,height:38,borderRadius:12,background:active?r.color:"rgba(0,0,0,0.06)",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s"}}>
                  <Icon name={r.icon} size={20} color={active?P.text:P.textMuted}/>
                </div>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:P.text}}>{r.label}</div><div style={{fontSize:12,color:P.textMuted}}>{r.desc}</div></div>
                <div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${active?r.color:P.border}`,background:active?r.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {active&&<div style={{width:5,height:5,borderRadius:"50%",background:P.white}}/>}
                </div>
              </div>;
            })}
          </div>
                    {[{label:"Votre nom",val:name,set:setName,ph:"Prénom Nom",icon:"person"},{label:"Service",val:service,set:setService,ph:"Urgences, Cardiologie, CHU...",icon:"apartment"}].map(({label,val,set,ph,icon},i)=>(
            <div key={i} style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:7,display:"flex",alignItems:"center",gap:4}}><Icon name={icon} size={11} color={P.textMuted}/>{label}</div>
              <input value={val} onChange={e=>set(e.target.value)} placeholder={ph} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                style={{...inputSty,fontSize:14}}
                onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
                onBlur={e=>{e.target.style.outline="none";}}/>
            </div>
          ))}

          {error&&<div style={{fontSize:12,color:P.red,marginBottom:12,padding:"9px 13px",background:"rgba(255,59,48,0.06)",borderRadius:10,display:"flex",alignItems:"center",gap:6}}><Icon name="error" size={14} color={P.red}/>{error}</div>}
          <Btn onClick={handleLogin} disabled={loading} style={{width:"100%",justifyContent:"center",padding:"13px",borderRadius:14,marginTop:4,fontSize:15}}>
            {loading?<><Icon name="autorenew" size={16} style={{animation:"spin 1s linear infinite"}}/>Connexion...</>:<>Commencer la collecte<Icon name="arrow_forward" size={16}/></>}
          </Btn>
        </div>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
          <Icon name="lock" size={12}/> Prototype académique · Cas fictifs uniquement
        </div>
      </div>
    </div>
  );
}

// ─── Phase 1 : Collecte ───────────────────────────────────────────────────────
function Phase1({onNext, user, patientAddress="", setPatientAddress}) {
  const [transcription,setTranscription]=useState("");
  const [isRecording,setIsRecording]=useState(false);
  const [recError,setRecError]=useState("");
  const [vitals,setVitals]=useState({});
  const [extraVitals,setExtraVitals]=useState([]); // {key,label,unit,value}
  const [newMeasure,setNewMeasure]=useState({label:"",unit:"",value:""});
  const [showAddMeasure,setShowAddMeasure]=useState(false);
  const [documents,setDocuments]=useState([]);
  const [extracting,setExtracting]=useState(false);
  const [inputMode,setInputMode]=useState("write");
  const [showCameraModal,setShowCameraModal]=useState(false);
  const [questions,setQuestions]=useState([]);
  const [checkedQ,setCheckedQ]=useState({});
  const [loadingQ,setLoadingQ]=useState(false);
  const [patientName,setPatientName]=useState("");
  const fileInputRef=useRef(null);
  const recognitionRef=useRef(null);
  const textareaRef=useRef(null);
  const qTimerRef=useRef(null);

  // Questions dynamiques
  useEffect(()=>{
    if(transcription.length<60){setQuestions([]);return;}
    clearTimeout(qTimerRef.current);
    qTimerRef.current=setTimeout(async()=>{
      setLoadingQ(true);
      try{
        const r=await apiFetch("/api/questions/generate",{transcription});
        setQuestions(Array.isArray(r.questions)?r.questions:[]);
      }catch{
        setQuestions(["Antécédents cardiovasculaires ?","Douleur irradiante ?","Dyspnée associée ?","Fièvre présente ?","Facteurs de risque ?","Médicaments en cours ?","Allergies connues ?","Épisodes similaires passés ?"]);
      }
      setLoadingQ(false);
    },2000);
    return ()=>clearTimeout(qTimerRef.current);
  },[transcription]);

  // Auto-extract vitals from text (dictée + saisie)
  useEffect(()=>{
    if(transcription.length<15) return;
    const extracted = extractVitalsFromText(transcription);
    if(Object.keys(extracted).length>0) {
      setVitals(prev => {
        const next = {...prev};
        Object.entries(extracted).forEach(([k,v])=>{ if(!prev[k]) next[k]=v; });
        return next;
      });
    }
    // Auto-compute IMC
    if(vitals.poids && vitals.taille) {
      const p=parseFloat(vitals.poids), t=parseFloat(vitals.taille)/100;
      if(p>0&&t>0) setVitals(prev=>({...prev,imc:(p/(t*t)).toFixed(1)}));
    }
  },[transcription]);

  // IMC auto
  useEffect(()=>{
    const p=parseFloat(vitals.poids), t=parseFloat(vitals.taille)/100;
    if(p>0&&t>0&&!isNaN(p)&&!isNaN(t)) setVitals(prev=>({...prev,imc:(p/(t*t)).toFixed(1)}));
  },[vitals.poids,vitals.taille]);

  const startRec=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){setRecError("Chrome requis.");return;}
    setRecError("");
    const rec=new SR();rec.lang="fr-FR";rec.continuous=true;rec.interimResults=true;
    let ft=transcription;
    rec.onresult=e=>{let it="";for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)ft+=e.results[i][0].transcript+" ";else it=e.results[i][0].transcript;}setTranscription(ft+it);};
    rec.onerror=e=>{setRecError("Erreur : "+e.error);setIsRecording(false);};
    rec.onend=()=>{setIsRecording(false);setTranscription(ft);const ev=extractVitalsFromText(ft);if(Object.keys(ev).length)setVitals(p=>{const n={...p};Object.entries(ev).forEach(([k,v])=>{if(!p[k])n[k]=v;});return n;});};
    rec.start();recognitionRef.current=rec;setIsRecording(true);
  };
  const stopRec=()=>{recognitionRef.current?.stop();setIsRecording(false);};

  const handleWebcamPhoto = useCallback((photo)=>{
    setDocuments(prev=>prev.find(d=>d.name===photo.name)?prev:[...prev,photo]);
  },[]);

  const handleFileUpload=async e=>{
    const files=Array.from(e.target.files);
    for(const file of files){
      const base64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      // Déduplique par nom
      setDocuments(prev=>{if(prev.some(d=>d.name===file.name))return prev;return[...prev,{name:file.name,base64,mediaType:file.type,analysis:"",analyzing:true}];});
      try{const{analysis}=await apiFetch("/api/analyze-document",{image_base64:base64,media_type:file.type,filename:file.name});
        setDocuments(prev=>prev.map(d=>d.name===file.name?{...d,analysis,analyzing:false}:d));
      }catch{setDocuments(prev=>prev.map(d=>d.name===file.name?{...d,analysis:"[Analyse indisponible]",analyzing:false}:d));}
    }
    e.target.value="";
  };

  const addMeasure=()=>{
    if(!newMeasure.label.trim()) return;
    const key=`extra_${Date.now()}`;
    setExtraVitals(prev=>[...prev,{key,label:newMeasure.label,unit:newMeasure.unit,value:newMeasure.value}]);
    setNewMeasure({label:"",unit:"",value:""});
    setShowAddMeasure(false);
  };

  const handleExtract=async()=>{
    setExtracting(true);
    try{
      const allVitals={...vitals};
      extraVitals.forEach(ev=>{ if(ev.value) allVitals[ev.key]=`${ev.value}${ev.unit?` ${ev.unit}`:""}` });
      const data=await apiFetch("/api/extract",{transcription,vital_signs:allVitals,confirmed_symptoms:questions.filter((_,i)=>checkedQ[i]),region:user?.region||"Europe - France"});
      const imageAnalysis=documents.filter(d=>d.analysis).map(d=>`[${d.name}]|||${d.analysis}`).join("<<<DOC>>>");
      onNext({...data,_patientName:patientName||"Patient",_patientAddress:patientAddress||""},imageAnalysis);
    }catch(e){console.error(e);}
    setExtracting(false);
  };

  const hasContent = transcription.length>=20;
  const vitalCount = Object.values(vitals).filter(Boolean).length;

  return (
    <div style={{animation:"fadeIn 0.35s ease-out"}}>

      {/* ══ BANDEAU PATIENT ══ */}
      <div style={{display:"flex",gap:10,marginBottom:12,background:P.white,borderRadius:16,padding:"11px 16px",border:`1px solid ${P.border}`,boxShadow:P.shadow,alignItems:"center"}}>
        <div style={{width:38,height:38,borderRadius:11,background:`${P.turquoise}20`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Icon name="person" size={21} color={P.turquoiseDark}/>
        </div>
        <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>Nom du patient</div>
            <input value={patientName} onChange={e=>setPatientName&&setPatientName(e.target.value)} placeholder="Nom Prénom"
              style={{...inputSty,fontSize:13,padding:"7px 11px"}}
              onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
              onBlur={e=>{e.target.style.outline="none";}}/>
          </div>
          <div>
            <div style={{fontSize:9,fontWeight:700,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span>Adresse (Google Maps)</span>
              <button onClick={()=>{if(!navigator.geolocation)return;navigator.geolocation.getCurrentPosition(async p=>{const la=p.coords.latitude,lo=p.coords.longitude;try{const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${la}&lon=${lo}&format=json&accept-language=fr`);const d=await r.json();const a=d.address||{};setPatientAddress?.([a.road,a.city||a.town||a.village,a.postcode,a.country].filter(Boolean).join(", "));}catch{setPatientAddress?.(`${la.toFixed(4)}, ${lo.toFixed(4)}`);} },()=>{});}} style={{fontSize:9,fontWeight:700,color:P.turquoiseDark,background:P.turquoiseLight,border:"1px solid rgba(117,221,211,0.4)",borderRadius:6,padding:"2px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3,fontFamily:"inherit"}}>
                <Icon name="my_location" size={10} color={P.turquoiseDark}/>Localiser
              </button>
            </div>
            <input value={patientAddress} onChange={e=>setPatientAddress?.(e.target.value)} placeholder="Rue, Ville — ou cliquez Localiser"
              style={{...inputSty,fontSize:13,padding:"7px 11px",background:patientAddress?"rgba(117,221,211,0.05)":"rgba(0,0,0,0.03)"}}
              onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
              onBlur={e=>{e.target.style.outline="none";}}/>
          </div>
        </div>
      </div>

      {/* ══ GRILLE PRINCIPALE : 2 colonnes ══ */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:12}}>

        {/* ── COL GAUCHE ── */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Zone anamnèse */}
          <div style={{...card({padding:0,overflow:"hidden"})}}>
            <div style={{padding:"13px 16px 10px",borderBottom:`1px solid ${P.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Icon name="chat_bubble" size={16} color={P.turquoiseDark}/>
                <span style={{fontWeight:700,fontSize:14,color:P.text}}>Anamnèse &amp; Symptômes</span>
                {transcription.length>0&&<span style={{fontSize:10,color:P.textMuted,background:"rgba(0,0,0,0.04)",padding:"1px 7px",borderRadius:8}}>{transcription.split(" ").filter(Boolean).length} mots</span>}
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                {isRecording
                  ?<button onClick={stopRec} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 13px",background:"rgba(255,59,48,0.08)",border:"1px solid rgba(255,59,48,0.25)",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:700,color:P.red,fontFamily:"inherit"}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:P.red,animation:"pulse 0.8s infinite"}}/>Arrêter
                  </button>
                  :<button onClick={startRec} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 13px",background:P.turquoiseLight,border:"1px solid rgba(117,221,211,0.4)",borderRadius:20,cursor:"pointer",fontSize:12,fontWeight:600,color:P.turquoiseDark,fontFamily:"inherit"}}>
                    <Icon name="mic" size={13} color={P.turquoiseDark}/>Dicter
                  </button>
                }
                {transcription.length>0&&<button onClick={()=>setTranscription("")} style={{padding:"4px 9px",background:"transparent",border:`1px solid ${P.border}`,borderRadius:7,cursor:"pointer",fontSize:11,color:P.textMuted,fontFamily:"inherit",display:"flex",alignItems:"center",gap:3}}><Icon name="close" size={11}/>Effacer</button>}
              </div>
            </div>
            {recError&&<div style={{margin:"8px 16px 0",padding:"6px 11px",background:"rgba(255,59,48,0.06)",border:"1px solid rgba(255,59,48,0.2)",borderRadius:8,fontSize:12,color:P.red,display:"flex",alignItems:"center",gap:5}}><Icon name="error" size={13} color={P.red}/>{recError}</div>}
            {isRecording&&<div style={{margin:"8px 16px 0",display:"flex",alignItems:"center",gap:5,padding:"6px 11px",background:"rgba(117,221,211,0.04)",borderRadius:8,border:"1px dashed rgba(117,221,211,0.35)"}}>
              {[3,5,8,6,4,7,5,3].map((h,i)=><div key={i} style={{width:3,height:`${h}px`,background:P.turquoise,borderRadius:2,animation:`pulse ${0.35+i*0.08}s ease-in-out infinite`}}/>)}
              <span style={{fontSize:11,color:P.turquoiseDark,fontWeight:600}}>Écoute active...</span>
            </div>}
            <textarea ref={textareaRef} value={transcription} onChange={e=>setTranscription(e.target.value)}
              placeholder={"Décrivez les symptômes : motif, localisation, durée, intensité (1-10), facteurs aggravants / soulageants, antécédents pertinents…"}
              style={{...inputSty,border:"none",borderRadius:0,resize:"none",lineHeight:1.85,fontSize:13.5,padding:"13px 16px",minHeight:180,background:"transparent",outline:"none"}}
              onFocus={e=>e.target.style.background="rgba(117,221,211,0.02)"}
              onBlur={e=>e.target.style.background="transparent"}/>
          </div>

          {/* Vidéo + Documents côte à côte */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{...card({padding:14})}}>
              <div style={{fontSize:12,fontWeight:700,color:P.text,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                <Icon name="videocam" size={14} color={P.azur}/>Consultation vidéo
              </div>
              <WebcamCapture onPhotoCapture={handleWebcamPhoto} transcription={transcription} onSessionData={(sd)=>{
                if(sd.transcript) setTranscription(prev=>(prev?prev+"\n\n":"")+"[Vidéo] "+sd.transcript);
                if(sd.symptoms) setTranscription(prev=>(prev?prev+"\n":"")+(sd.symptoms));
                if(sd.vitals&&Object.keys(sd.vitals).length) setVitals(prev=>({...prev,...sd.vitals}));
                if(sd.photos?.length) sd.photos.forEach(p=>handleWebcamPhoto(p));
              }}/>
            </div>

            <div style={{...card({padding:14})}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:700,color:P.text,display:"flex",alignItems:"center",gap:6}}>
                  <Icon name="attach_file" size={14} color={P.azur}/>Documents
                  {documents.length>0&&<span style={{fontSize:10,background:P.turquoiseLight,color:P.turquoiseDark,padding:"1px 7px",borderRadius:8,fontWeight:700}}>{documents.length}</span>}
                </div>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={()=>setShowCameraModal(true)} style={{padding:"4px 9px",border:`1px solid ${P.border}`,borderRadius:7,background:"transparent",cursor:"pointer",fontSize:11,color:P.textSub,display:"flex",alignItems:"center",gap:3,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.borderColor=P.azur} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>
                    <Icon name="photo_camera" size={12}/>Photo
                  </button>
                  <button onClick={()=>fileInputRef.current?.click()} style={{padding:"4px 9px",border:`1px solid ${P.border}`,borderRadius:7,background:"transparent",cursor:"pointer",fontSize:11,color:P.textSub,display:"flex",alignItems:"center",gap:3,fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.borderColor=P.azur} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>
                    <Icon name="upload" size={12}/>Fichier
                  </button>
                </div>
                <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf" style={{display:"none"}} onChange={handleFileUpload}/>
              </div>

            {documents.length===0?(
              <div onClick={()=>fileInputRef.current?.click()} style={{border:`2px dashed ${P.border}`,borderRadius:10,padding:"20px",textAlign:"center",cursor:"pointer",color:P.textMuted,fontSize:12,background:"rgba(0,0,0,0.01)",transition:"all 0.2s",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=P.turquoise;e.currentTarget.style.background="rgba(117,221,211,0.04)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=P.border;e.currentTarget.style.background="rgba(0,0,0,0.01)";}}>
                <Icon name="cloud_upload" size={24} color="rgba(0,0,0,0.1)"/>
                <div><div style={{fontWeight:500,color:P.textSub}}>Radios · ECG · Bilans · Photos</div><span style={{fontSize:10}}>JPG, PNG, PDF</span></div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {documents.map((doc,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",background:doc.analyzing?"rgba(0,0,0,0.02)":"rgba(117,221,211,0.06)",border:`1px solid ${doc.analyzing?P.border:P.turquoise}`,borderRadius:10,position:"relative"}}>
                    <Icon name={doc.mediaType?.startsWith("image/")?"photo_camera":"description"} size={15} color={doc.analyzing?P.textMuted:P.turquoiseDark}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:P.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:18}}>{doc.name.replace(/photo_\d+\.jpg/i,"Photo").replace(/capture_[\d-T]+\.jpg/i,"Photo")}</div>
                      {doc.analyzing?<div style={{fontSize:10,color:P.textMuted,display:"flex",alignItems:"center",gap:3,marginTop:1}}><Icon name="autorenew" size={10} style={{animation:"spin 1s linear infinite"}}/>Analyse...</div>:<div style={{fontSize:10,color:P.turquoiseDark,marginTop:1,display:"flex",alignItems:"center",gap:3}}><Icon name="check_circle" size={10} color={P.turquoiseDark}/>Analysé</div>}
                    </div>
                    <button onClick={()=>setDocuments(p=>p.filter(d=>d.name!==doc.name))} style={{position:"absolute",top:5,right:5,background:"rgba(255,59,48,0.08)",border:"none",borderRadius:5,width:18,height:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,59,48,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,59,48,0.08)"}>
                      <Icon name="close" size={10} color={P.red}/>
                    </button>
                  </div>
                ))}
                <button onClick={()=>fileInputRef.current?.click()} style={{padding:"6px",border:`2px dashed ${P.border}`,borderRadius:8,cursor:"pointer",fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",justifyContent:"center",gap:4,background:"transparent",fontFamily:"inherit"}} onMouseEnter={e=>e.currentTarget.style.borderColor=P.turquoise} onMouseLeave={e=>e.currentTarget.style.borderColor=P.border}>
                  <Icon name="add" size={13}/>Ajouter
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* ── COL DROITE : Constantes + Questions ── */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <div style={{...card({padding:16})}}>
            <div style={{fontWeight:700,fontSize:13,color:P.text,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
              <Icon name="monitor_heart" size={15} color={P.azur}/>Constantes vitales
              {vitalCount>0&&<span style={{marginLeft:"auto",fontSize:10,color:P.green,display:"flex",alignItems:"center",gap:3}}><Icon name="check_circle" size={11} color={P.green}/>{vitalCount} renseignée{vitalCount>1?"s":""}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {DEFAULT_VITALS.map(({key,icon,label,unit,ph})=>(
                <div key={key}>
                  <div style={{fontSize:9,color:P.textMuted,marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em",display:"flex",alignItems:"center",gap:3}}>
                    <Icon name={icon} size={9} color={P.textMuted}/>{label}{unit&&<span style={{color:P.border}}>{unit}</span>}
                  </div>
                  <input style={{...inputSty,fontSize:12,padding:"6px 9px",background:vitals[key]?"rgba(117,221,211,0.08)":"rgba(0,0,0,0.03)",borderColor:vitals[key]?P.turquoise:P.border}}
                    placeholder={key==="imc"&&vitals.poids&&vitals.taille?"auto":ph}
                    value={vitals[key]||""} readOnly={key==="imc"}
                    onChange={e=>setVitals(v=>({...v,[key]:e.target.value}))}
                    onFocus={e=>{if(key!=="imc"){e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}}
                    onBlur={e=>{e.target.style.outline="none";}}/>
                </div>
              ))}
            </div>
            {extraVitals.length>0&&<div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${P.border}`}}>
              {extraVitals.map((ev,i)=>(
                <div key={ev.key} style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:P.textMuted,marginBottom:3,fontWeight:600,textTransform:"uppercase"}}>{ev.label}{ev.unit&&<span style={{color:P.border}}> {ev.unit}</span>}</div>
                    <input value={ev.value} onChange={e=>setExtraVitals(p=>p.map((x,j)=>j===i?{...x,value:e.target.value}:x))} style={{...inputSty,fontSize:12,padding:"6px 9px"}} placeholder="Valeur" onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
                  </div>
                  <span onClick={()=>setExtraVitals(p=>p.filter((_,j)=>j!==i))} style={{cursor:"pointer",marginTop:14,opacity:0.4}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.4"}><Icon name="close" size={13}/></span>
                </div>
              ))}
            </div>}
            {showAddMeasure?(
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${P.border}`,display:"flex",flexDirection:"column",gap:6}}>
                <div style={{fontSize:11,fontWeight:600,color:P.text}}>Nouvelle mesure</div>
                <input value={newMeasure.label} onChange={e=>setNewMeasure(m=>({...m,label:e.target.value}))} placeholder="Nom (ex: CRP)" style={{...inputSty,fontSize:12,padding:"6px 9px"}} onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <input value={newMeasure.unit} onChange={e=>setNewMeasure(m=>({...m,unit:e.target.value}))} placeholder="Unité" style={{...inputSty,fontSize:12,padding:"6px 9px"}} onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
                  <input value={newMeasure.value} onChange={e=>setNewMeasure(m=>({...m,value:e.target.value}))} placeholder="Valeur" style={{...inputSty,fontSize:12,padding:"6px 9px"}} onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <Btn onClick={addMeasure} small style={{flex:1,justifyContent:"center"}}><Icon name="check" size={12}/>Ajouter</Btn>
                  <Btn onClick={()=>setShowAddMeasure(false)} variant="secondary" small><Icon name="close" size={12}/></Btn>
                </div>
              </div>
            ):(
              <button onClick={()=>setShowAddMeasure(true)} style={{marginTop:10,width:"100%",padding:"6px",border:`2px dashed ${P.border}`,borderRadius:8,background:"transparent",cursor:"pointer",fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",justifyContent:"center",gap:5,fontFamily:"inherit"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=P.turquoise;e.currentTarget.style.color=P.turquoiseDark;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=P.border;e.currentTarget.style.color=P.textMuted;}}>
                <Icon name="add" size={13}/>Mesure supplémentaire
              </button>
            )}
          </div>
        </div>
      </div>



      {/* ══ QUESTIONS DIAGNOSTIQUES ══ */}
      {(loadingQ||questions.length>0)&&(
        <div style={{...card({padding:0,overflow:"hidden",marginTop:12})}}>
          <div style={{padding:"12px 18px",borderBottom:questions.length>0?`1px solid ${P.border}`:"none",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:10,background:`${P.azur}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon name="quiz" size={16} color={P.azur}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:P.text,display:"flex",alignItems:"center",gap:8}}>
                Questions à poser au patient
                {questions.length>0&&<span style={{fontSize:11,fontWeight:400,color:P.textMuted}}>— cochez les réponses positives</span>}
                {loadingQ&&<span style={{fontSize:11,color:P.turquoiseDark,display:"flex",alignItems:"center",gap:4,marginLeft:4}}><Icon name="autorenew" size={12} style={{animation:"spin 1s linear infinite"}}/>Génération en cours...</span>}
              </div>
              {Object.values(checkedQ).filter(Boolean).length>0&&<div style={{fontSize:11,color:P.green,marginTop:2,display:"flex",alignItems:"center",gap:4}}><Icon name="check_circle" size={11} color={P.green}/>{Object.values(checkedQ).filter(Boolean).length} réponse{Object.values(checkedQ).filter(Boolean).length>1?"s":""} positive{Object.values(checkedQ).filter(Boolean).length>1?"s":""} enregistrée{Object.values(checkedQ).filter(Boolean).length>1?"s":""}</div>}
            </div>
          </div>
          {questions.length>0&&(
            <div style={{padding:"14px 18px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {[...questions].sort((a,b)=>{
                const kw=/urgence|douleur|irrad|essouf|antécéd|fièvre|perte|sang|allergi|conscien/i;
                return (kw.test(b)?1:0)-(kw.test(a)?1:0);
              }).map((q,i)=>(
                <label key={i} style={{display:"flex",gap:10,cursor:"pointer",padding:"10px 13px",borderRadius:10,background:checkedQ[i]?"rgba(117,221,211,0.08)":"rgba(0,0,0,0.015)",border:`1px solid ${checkedQ[i]?P.turquoise:P.border}`,alignItems:"flex-start",transition:"all 0.12s",boxShadow:checkedQ[i]?"0 2px 8px rgba(117,221,211,0.15)":"none"}}
                  onMouseEnter={e=>{if(!checkedQ[i]){e.currentTarget.style.background="rgba(0,0,0,0.03)";e.currentTarget.style.borderColor="rgba(0,0,0,0.12)";}}}
                  onMouseLeave={e=>{if(!checkedQ[i]){e.currentTarget.style.background="rgba(0,0,0,0.015)";e.currentTarget.style.borderColor=P.border;}}}>
                  <div style={{width:18,height:18,borderRadius:5,flexShrink:0,marginTop:1,background:checkedQ[i]?P.turquoise:"white",border:`2px solid ${checkedQ[i]?P.turquoiseDark:P.borderMed}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s"}}>
                    {checkedQ[i]&&<Icon name="check" size={11} color={P.text}/>}
                  </div>
                  <input type="checkbox" checked={!!checkedQ[i]} onChange={e=>setCheckedQ(c=>({...c,[i]:e.target.checked}))} style={{display:"none"}}/>
                  <span style={{fontSize:12.5,lineHeight:1.55,color:checkedQ[i]?P.text:P.textSub,fontWeight:checkedQ[i]?600:400,userSelect:"none"}}>{q}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Camera modal */}
      {showCameraModal&&<CameraModal
        onCapture={async({base64:b64,dataUrl})=>{
          const fname=`photo_${Date.now()}.jpg`;
          setDocuments(p=>[...p,{name:fname,base64:b64,mediaType:"image/jpeg",analysis:"",analyzing:true,preview:dataUrl}]);
          try{const{analysis}=await apiFetch("/api/analyze-document",{image_base64:b64,media_type:"image/jpeg",filename:fname});setDocuments(p=>p.map(d=>d.name===fname?{...d,analysis,analyzing:false}:d));}
          catch{setDocuments(p=>p.map(d=>d.name===fname?{...d,analysis:"[Indisponible]",analyzing:false}:d));}
        }}
        onClose={()=>setShowCameraModal(false)}
      />}



      <div style={{marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",background:P.white,border:`1px solid ${P.border}`,borderRadius:14,boxShadow:P.shadow}}>
        <div style={{fontSize:12,color:P.textMuted,display:"flex",alignItems:"center",gap:14}}>
          {hasContent&&<span style={{display:"flex",alignItems:"center",gap:4,color:P.green}}><Icon name="check_circle" size={14} color={P.green}/>Description saisie</span>}
          {Object.values(vitals).some(v=>v)&&<span style={{display:"flex",alignItems:"center",gap:4,color:P.green}}><Icon name="check_circle" size={14} color={P.green}/>Constantes renseignées</span>}
          {documents.length>0&&<span style={{display:"flex",alignItems:"center",gap:4,color:P.green}}><Icon name="check_circle" size={14} color={P.green}/>{documents.length} document(s)</span>}
          {!hasContent&&<span style={{color:P.orange,display:"flex",alignItems:"center",gap:4}}><Icon name="info" size={13} color={P.orange}/>Décrivez les symptômes pour continuer</span>}
        </div>
        <Btn onClick={handleExtract} disabled={!hasContent||extracting}>
          {extracting?<><Icon name="autorenew" size={16} style={{animation:"spin 1s linear infinite"}}/>Structuration...</>:<>Continuer<Icon name="arrow_forward" size={16}/></>}
        </Btn>
      </div>
    </div>
  );
}


// ─── CameraModal ──────────────────────────────────────────────────────────────
function CameraModal({onCapture,onClose}) {
  const videoRef=useRef(null);
  const [stream,setStream]=useState(null);
  const [preview,setPreview]=useState(null);
  const [error,setError]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}}});
        setStream(s);
        if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play().catch(()=>{});}
      }catch(e){setError("Accès caméra refusé. Vérifiez les permissions.");}
    })();
    return ()=>{ stream?.getTracks().forEach(t=>t.stop()); };
  },[]);

  const capture=()=>{
    if(!videoRef.current)return;
    const canvas=document.createElement("canvas");
    canvas.width=videoRef.current.videoWidth||1280;
    canvas.height=videoRef.current.videoHeight||720;
    canvas.getContext("2d").drawImage(videoRef.current,0,0);
    setPreview(canvas.toDataURL("image/jpeg",0.92));
    stream?.getTracks().forEach(t=>t.stop());
    setStream(null);
  };

  const confirm=()=>{
    if(!preview)return;
    const b64=preview.split(",")[1];
    onCapture({base64:b64,dataUrl:preview});
    onClose();
  };

  const retake=async()=>{
    setPreview(null);
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
      setStream(s);
      if(videoRef.current){videoRef.current.srcObject=s;videoRef.current.play();}
    }catch{}
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#111",borderRadius:20,overflow:"hidden",maxWidth:600,width:"100%",boxShadow:"0 24px 80px rgba(0,0,0,0.5)"}}>
        <div style={{padding:"12px 16px",background:"#1a1a1a",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          <span style={{fontSize:13,fontWeight:600,color:"white",display:"flex",alignItems:"center",gap:7}}>
            <Icon name="photo_camera" size={16} color="#75ddd3"/>Appareil photo
          </span>
          <button onClick={()=>{stream?.getTracks().forEach(t=>t.stop());onClose();}} style={{background:"rgba(255,255,255,0.1)",border:"none",borderRadius:7,padding:"5px 10px",cursor:"pointer",color:"rgba(255,255,255,0.7)",fontSize:11,fontFamily:"inherit",display:"flex",alignItems:"center",gap:4}}>
            <Icon name="close" size={13}/>Annuler
          </button>
        </div>
        <div style={{position:"relative",background:"#000",minHeight:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {error?(
            <div style={{textAlign:"center",padding:40,color:"#888"}}>
              <Icon name="videocam_off" size={40} color="#555" style={{display:"block",margin:"0 auto 12px"}}/>
              <div style={{fontSize:13,lineHeight:1.6}}>{error}</div>
              <button onClick={onClose} style={{marginTop:16,padding:"8px 16px",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:8,cursor:"pointer",color:"white",fontSize:12,fontFamily:"inherit"}}>Fermer</button>
            </div>
          ):preview?(
            <img src={preview} alt="aperçu" style={{width:"100%",maxHeight:380,objectFit:"contain",display:"block"}}/>
          ):(
            <video ref={videoRef} autoPlay muted playsInline style={{width:"100%",maxHeight:380,objectFit:"cover",display:"block"}}/>
          )}
        </div>
        <div style={{padding:"14px 16px",background:"#1a1a1a",display:"flex",gap:10,justifyContent:"center",alignItems:"center"}}>
          {!preview?(
            <button onClick={capture} disabled={!stream} style={{width:56,height:56,borderRadius:"50%",background:stream?"white":"#555",border:"3px solid rgba(255,255,255,0.3)",cursor:stream?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(stream)e.currentTarget.style.transform="scale(1.08)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#75ddd3"}}/>
            </button>
          ):(
            <>
              <button onClick={retake} style={{padding:"10px 20px",background:"rgba(255,255,255,0.12)",border:"none",borderRadius:10,cursor:"pointer",color:"white",fontSize:13,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                <Icon name="refresh" size={15} color="white"/>Reprendre
              </button>
              <button onClick={confirm} style={{padding:"10px 24px",background:"#75ddd3",border:"none",borderRadius:10,cursor:"pointer",color:"#1d1d1f",fontSize:13,fontWeight:700,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                <Icon name="check" size={15}/>Utiliser cette photo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2 : Structuration ──────────────────────────────────────────────────
function Phase2({data,imageAnalysis,onNext,onBack}) {
  const symptomes = Array.isArray(data.symptomes_principaux)?data.symptomes_principaux:[];
  const vitals = data.constantes_vitales||{};
  const antecedents = Array.isArray(data.antecedents)?data.antecedents:typeof data.antecedents==="string"?[data.antecedents]:[];
  const traitements = Array.isArray(data.traitements_en_cours)?data.traitements_en_cours:typeof data.traitements_en_cours==="string"?[data.traitements_en_cours]:[];

  return (
    <div style={{animation:"fadeIn 0.35s ease-out"}}>
      <div style={{marginBottom:22}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:700,color:P.text,letterSpacing:"-0.3px"}}>Vérification des données</h2>
        <p style={{margin:0,color:P.textMuted,fontSize:14}}>Confirmez les informations extraites avant l'analyse IA</p>
      </div>

      {/* ── Point de contrôle EN HAUT ── */}
      <div style={{...card({padding:16,marginBottom:16,background:"rgba(117,221,211,0.06)",borderColor:"rgba(117,221,211,0.35)"})}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:38,height:38,borderRadius:12,background:P.turquoise,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Icon name="verified_user" size={20} color={P.text}/>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:P.text}}>Point de contrôle infirmier</div>
            <div style={{fontSize:12,color:P.textSub,marginTop:2}}>Vérifiez que les données ci-dessous correspondent bien au patient. En validant, vous engagez votre responsabilité clinique.</div>
          </div>
        </div>
      </div>

      {/* ── Motif ── */}
      <div style={{...card({padding:18,marginBottom:12})}}>
        <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:10,display:"flex",alignItems:"center",gap:5}}>
          <Icon name="medical_services" size={12} color={P.textMuted}/>Motif principal
        </div>
        <div style={{fontSize:16,fontWeight:700,color:P.text}}>{data.motif_consultation||"—"}</div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        {/* Symptômes — mots-clés uniquement */}
        {symptomes.length>0&&(
          <div style={card({padding:18})}>
            <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
              <Icon name="symptoms" size={12} color={P.textMuted}/>Symptômes identifiés
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {symptomes.map((s,i)=>(
                <span key={i} style={{padding:"5px 12px",borderRadius:20,background:"rgba(84,164,191,0.08)",border:`1px solid rgba(84,164,191,0.2)`,fontSize:13,color:P.azurDark,fontWeight:500}}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Antécédents — toujours affiché */}
        <div style={card({padding:18})}>
          <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
            <Icon name="history" size={12} color={P.textMuted}/>Antécédents
          </div>
          {antecedents.length>0
            ?<div style={{display:"flex",flexWrap:"wrap",gap:7}}>
              {antecedents.map((a,i)=>(
                <span key={i} style={{padding:"5px 12px",borderRadius:20,background:"rgba(225,231,118,0.15)",border:`1px solid rgba(196,202,80,0.3)`,fontSize:13,color:"#5a5e00",fontWeight:500}}>{a}</span>
              ))}
            </div>
            :<span style={{fontSize:13,color:P.textMuted,fontStyle:"italic"}}>Aucun antécédent médical renseigné</span>
          }
        </div>
      </div>

      {/* Constantes vitales */}
      {Object.values(vitals).some(v=>v)&&(
        <div style={{...card({padding:18,marginBottom:12})}}>
          <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
            <Icon name="monitor_heart" size={12} color={P.textMuted}/>Constantes vitales
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10}}>
            {[["tension","Tension"],["fc","FC"],["temperature","Temp"],["spo2","SpO₂"],["poids","Poids"],["glycemie","Glycémie"],["taille","Taille"],["imc","IMC"]]
              .filter(([k])=>vitals[k]).map(([k,l])=>(
              <div key={k} style={{padding:"10px 16px",borderRadius:12,background:"rgba(0,0,0,0.03)",border:`1px solid ${P.border}`,textAlign:"center",minWidth:75}}>
                <div style={{fontSize:10,color:P.textMuted,fontWeight:600,marginBottom:2,textTransform:"uppercase"}}>{l}</div>
                <div style={{fontSize:16,fontWeight:700,color:P.text}}>{vitals[k]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Traitements */}
      {traitements.length>0&&(
        <div style={{...card({padding:18,marginBottom:12})}}>
          <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:5}}>
            <Icon name="medication" size={12} color={P.textMuted}/>Traitements en cours
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {traitements.map((t,i)=>(
              <span key={i} style={{padding:"5px 12px",borderRadius:20,background:"rgba(52,199,89,0.08)",border:`1px solid rgba(52,199,89,0.2)`,fontSize:13,color:"#1a7a35",fontWeight:500}}>{t}</span>
            ))}
          </div>
        </div>
      )}

      {imageAnalysis&&(
        <div style={{...card({padding:14,marginBottom:12,background:"rgba(117,221,211,0.04)",borderColor:"rgba(117,221,211,0.3)"})}}>
          <div style={{fontSize:11,fontWeight:600,color:P.turquoiseDark,marginBottom:7,display:"flex",alignItems:"center",gap:5}}><Icon name="description" size={13} color={P.turquoiseDark}/>Documents analysés</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {(()=>{
              const docs=imageAnalysis.split("<<<DOC>>>").filter(Boolean);
              return <>
                {docs.map((block,i)=>{
                  const name=block.split("|||")[0].replace(/^\[|\]$/g,"")||`Document ${i+1}`;
                  const analysis=block.split("|||")[1]||"";
                  const isImg=/\.(jpg|jpeg|png|gif|webp)/i.test(name);
                  const isPdf=/\.pdf/i.test(name);
                  const icon=isImg?"photo_camera":isPdf?"picture_as_pdf":"description";
                  const cleanName=name.replace(/photo_\d+\.jpg/i,"Photo").replace(/capture_[\d-]+\.jpg/i,"Photo").replace(/\.[a-z]{2,4}$/i,"").substring(0,20)||`Fichier ${i+1}`;
                  // Type de document : extrait uniquement ce que l'IA identifie comme type
                  const summary=(()=>{
                    const s=analysis
                      .replace(/#+\s*/g,"").replace(/\*\*/g,"")
                      .replace(/nommée?[^.\n]*/gi,"") // retire les références au nom de fichier
                      .replace(/Capture[^.\n]*/gi,"")  // retire "Capture d'écran..."
                      .replace(/Étape\s*\d+[^:]*:/gi,"").trim();
                    const lines=s.split(/[.\n!?]/).map(l=>l.trim()).filter(l=>l.length>8);
                    // Priorité aux lignes qui décrivent le type visuel
                    const typeLine=lines.find(l=>/photographie|photo d|image d|cliché|radio|écg|tracé|bilan|scan|lésion|plaie|érythème|éruption|dermat|région|membre|peau|visage|montre|présente|révèle|représente|il s'agit|c'est une/i.test(l));
                    const first=typeLine||lines[0]||"";
                    // Nettoie et tronque
                    return first.replace(/^(cette|l'image|le document|la photo|la capture)\s+/i,"").substring(0,60)+(first.length>60?"…":"");
                  })();
                  return <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"8px 12px",borderRadius:12,background:"rgba(117,221,211,0.08)",border:"1px solid rgba(117,221,211,0.25)"}}>
                    <Icon name={icon} size={14} color={P.turquoiseDark} style={{marginTop:1,flexShrink:0}}/>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,color:P.turquoiseDark,lineHeight:1.3}}>{cleanName}</div>
                      {summary&&<div style={{fontSize:11,color:P.azur,marginTop:2,lineHeight:1.4}}>{summary}</div>}
                    </div>
                  </div>;
                })}
                <div style={{fontSize:11,color:P.textMuted,marginTop:2}}>· {docs.length} document{docs.length>1?"s":""} joint{docs.length>1?"s":""}</div>
              </>;
            })()}
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <Btn onClick={onBack} variant="secondary"><Icon name="arrow_back" size={15}/>Modifier</Btn>
        <Btn onClick={()=>onNext(data,imageAnalysis)} variant="success"><Icon name="send" size={15}/>Lancer l'analyse</Btn>
      </div>
    </div>
  );
}

// ─── Phase 3 : Chargement ─────────────────────────────────────────────────────
function Phase3({data,imageAnalysis,onNext,onBack}) {
  const [status,setStatus]=useState("idle");
  const [error,setError]=useState("");
  const [dots,setDots]=useState(0);
  const timerRef=useRef(null);

  const run=async()=>{
    setStatus("loading");setError("");
    timerRef.current=setInterval(()=>setDots(d=>(d+1)%4),500);
    try{
      const result=await apiFetch("/api/pipeline/run",{structured_data:data,image_analysis:imageAnalysis||"",patient_address:data._patientAddress||""});
      clearInterval(timerRef.current);
      setStatus("done");
      await new Promise(r=>setTimeout(r,800));
      // Merge prompt_final (returned at root level) into diagnostic object
      const diag={...(result.diagnostic||{}),prompt_final:result.prompt_final||""};
      onNext(diag);
    }catch(e){
      clearInterval(timerRef.current);
      setError(e.message);
      setStatus("error");
    }
  };

  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  const MESSAGES=["Analyse des symptômes en cours...","Consultation des modèles IA...","Génération du diagnostic différentiel...","Arbitrage et consensus en cours..."];
  const [msgIdx,setMsgIdx]=useState(0);
  useEffect(()=>{
    if(status!=="loading") return;
    const t=setInterval(()=>setMsgIdx(i=>(i+1)%MESSAGES.length),4000);
    return ()=>clearInterval(t);
  },[status]);

  return (
    <div style={{animation:"fadeIn 0.35s ease-out",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:360,gap:32}}>
      {status==="idle"&&(
        <>
          <div style={{textAlign:"center"}}>
            <div style={{width:72,height:72,borderRadius:22,background:P.turquoiseLight,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",boxShadow:`0 4px 24px rgba(117,221,211,0.2)`}}>
              <Icon name="play_circle" size={38} color={P.turquoiseDark}/>
            </div>
            <h2 style={{margin:"0 0 8px",fontSize:20,fontWeight:700,color:P.text}}>Lancer l'analyse diagnostique</h2>
            <p style={{margin:0,color:P.textMuted,fontSize:14,maxWidth:400}}>3 modèles IA analyseront les données en parallèle pour produire un diagnostic différentiel argumenté.</p>
          </div>
          <div style={{display:"flex",gap:14}}>
            <Btn onClick={onBack} variant="secondary"><Icon name="arrow_back" size={15}/>Retour</Btn>
            <Btn onClick={run}><Icon name="smart_toy" size={16}/>Analyser maintenant</Btn>
          </div>
        </>
      )}

      {status==="loading"&&(
        <div style={{textAlign:"center"}}>
          <div style={{position:"relative",width:80,height:80,margin:"0 auto 24px"}}>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`3px solid ${P.turquoiseLight}`}}/>
            <div style={{position:"absolute",inset:0,borderRadius:"50%",border:`3px solid transparent`,borderTopColor:P.turquoise,animation:"spin 1s linear infinite"}}/>
            <div style={{position:"absolute",inset:10,borderRadius:"50%",background:P.turquoiseLight,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Icon name="smart_toy" size={28} color={P.turquoiseDark}/>
            </div>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:P.text,marginBottom:8}}>Analyse en cours{".".repeat(dots+1)}</div>
          <div style={{fontSize:13,color:P.textMuted,marginBottom:24,height:18,transition:"all 0.3s"}}>{MESSAGES[msgIdx]}</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            {[P.turquoise,P.azur,P.azur].map((c,i)=>(
              <span key={i} style={{width:10,height:10,borderRadius:"50%",background:c,animation:`pulse ${1.2+i*0.3}s ease-in-out infinite`,display:"inline-block"}}/>
            ))}
          </div>
        </div>
      )}

      {status==="error"&&(
        <div style={{textAlign:"center",maxWidth:440}}>
          <div style={{width:64,height:64,borderRadius:20,background:"rgba(255,59,48,0.08)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
            <Icon name="error" size={32} color={P.red}/>
          </div>
          <div style={{fontSize:16,fontWeight:700,color:P.text,marginBottom:8}}>Erreur d'analyse</div>
          <div style={{fontSize:13,color:P.textSub,lineHeight:1.7,marginBottom:24,padding:"12px 16px",background:"rgba(255,59,48,0.05)",borderRadius:12,border:"1px solid rgba(255,59,48,0.15)"}}>{error}</div>
          <div style={{display:"flex",gap:10,justifyContent:"center"}}>
            <Btn onClick={onBack} variant="secondary"><Icon name="arrow_back" size={15}/>Retour</Btn>
            <Btn onClick={run}><Icon name="refresh" size={15}/>Réessayer</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phase 4 : Résultats ──────────────────────────────────────────────────────
const HYPO_C=[P.azur, P.turquoise, P.azur];
const CONDUITE_CFG={
  maison:     {icon:"home",         label:"Prise en charge à domicile",  color:P.green, bg:"rgba(52,199,89,0.06)",  border:"rgba(52,199,89,0.2)"},
  laboratoire:{icon:"labs",         label:"Examens biologiques",          color:P.azur,  bg:P.azurFaint,             border:"rgba(84,164,191,0.2)"},
  hopital:    {icon:"local_hospital",label:"Orientation hospitalière",    color:P.red,   bg:"rgba(255,59,48,0.05)",  border:"rgba(255,59,48,0.2)"},
};

function HypoCard({h,i}) {
  const [hov,hProps]=useHover();
  const c=HYPO_C[i]||P.textMuted;
  return (
    <div {...hProps} style={{...card({padding:20,borderColor:hov?c:P.border}),transform:hov?"translateY(-3px)":"none",boxShadow:hov?`0 10px 28px ${c}18`:P.shadow,transition:"all 0.22s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:10,color:c,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",background:`${c}15`,padding:"3px 10px",borderRadius:20}}>Hypothèse #{h.rang}</span>
        <span style={{fontSize:11,color:P.textMuted,fontFamily:"monospace",background:"rgba(0,0,0,0.04)",padding:"2px 8px",borderRadius:6}}>{h.cim10}</span>
      </div>
      <div style={{fontWeight:700,fontSize:16,marginBottom:12,lineHeight:1.3,color:P.text}}>{h.diagnostic}</div>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:P.textMuted}}>Probabilité</span><span style={{fontWeight:700,color:c,fontSize:20,lineHeight:1}}>{h.probabilite}%</span></div>
        <div style={{height:5,background:"rgba(0,0,0,0.06)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${h.probabilite}%`,background:c,borderRadius:3,transition:"width 1.2s cubic-bezier(0.4,0,0.2,1)"}}/></div>
      </div>
      <div style={{fontSize:13,color:P.textSub,lineHeight:1.65,marginBottom:12}}>{h.justification}</div>
      {h.examens?.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {h.examens.map((e,j)=><span key={j} style={{fontSize:11,color:P.azurDark,padding:"3px 10px",background:"rgba(84,164,191,0.1)",borderRadius:20}}>{e}</span>)}
      </div>}
    </div>
  );
}

function ConduiteBlock({conduite,hypotheses}) {
  if(!conduite) return null;
  const cfg=CONDUITE_CFG[conduite.niveau]||CONDUITE_CFG.maison;
  const isHopital=conduite.niveau==="hopital";
  const isLabo=conduite.niveau==="laboratoire";
  const isMaison=conduite.niveau==="maison";
  // Treatment detection for items in conseils_maison
  const treatmentKw=/mg|%|comprim|pris|pommade|crème|shampoo|kéto|antibi|antiinflamm|analg|antifong|dose|application|appliqu|antibio|aspirine|ibupro|paracétamol|amoxicilline/i;
  const allConseils=conduite.conseils_maison||[];
  const treatItems=!conduite.traitement_suggere?allConseils.filter(c=>treatmentKw.test(c)):[];
  const lifeItems=!conduite.traitement_suggere?allConseils.filter(c=>!treatmentKw.test(c)):allConseils;
  const hasTreatment=!!(conduite.traitement_suggere||treatItems.length>0);
  // Justification auto si pas de traitement
  const noTreatJustification=(()=>{
    if(hasTreatment) return null;
    const diag=(hypotheses?.[0]?.diagnostic||"").toLowerCase();
    if(isHopital) return "Prise en charge hospitalière urgente — traitement IV/surveillance à initier en milieu médical uniquement.";
    if(isLabo) return "Les examens complémentaires sont nécessaires avant toute prescription médicamenteuse.";
    if(/viral|rhinite|pharyngite viral|grippe|gastro-entérite viral/i.test(diag)) return "Affection virale présumée — aucun antibiotique indiqué. Traitement symptomatique uniquement.";
    return "Aucun traitement médicamenteux spécifique suggéré à ce stade — à la discrétion du médecin après évaluation.";
  })();

  return (
    <div style={{...card({marginBottom:14,background:cfg.bg,borderColor:cfg.border})}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
        <div style={{width:44,height:44,borderRadius:14,background:P.white,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:P.shadow}}>
          <Icon name={cfg.icon} size={22} color={cfg.color}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600}}>Conduite à suivre</div>
          <div style={{fontWeight:700,fontSize:15,color:cfg.color}}>{cfg.label}</div>
        </div>
        <div style={{fontSize:13,color:P.textSub,fontStyle:"italic",maxWidth:260,textAlign:"right",lineHeight:1.4}}>{conduite.raison}</div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>

        {/* ══ URGENCE : blocs prioritaires EN HAUT ══ */}
        {isHopital&&(
          <>
            {/* 1. Actions immédiates — ce qu'on fait dans les 2 prochaines minutes */}
            {conduite.instructions_immediates?.length>0&&<div style={{padding:14,background:"rgba(255,59,48,0.06)",borderRadius:12,border:"2px solid rgba(255,59,48,0.3)"}}>
              <div style={{fontSize:11,fontWeight:700,color:P.red,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                <Icon name="emergency" size={14} color={P.red}/>Actions immédiates
                <span style={{fontSize:10,fontWeight:400,color:P.red,opacity:0.75}}>— maintenant</span>
              </div>
              <ul style={{margin:0,paddingLeft:18,fontSize:13,color:"#7a1a1a",lineHeight:2,fontWeight:600}}>{conduite.instructions_immediates.map((e,i)=><li key={i}>{e}</li>)}</ul>
            </div>}

            {/* 2. En attendant les secours — gestes précis jusqu'à l'arrivée */}
            {conduite.en_attendant_hopital?.length>0&&<div style={{padding:14,background:"rgba(255,149,0,0.07)",borderRadius:12,border:"1px solid rgba(255,149,0,0.3)"}}>
              <div style={{fontSize:11,fontWeight:700,color:P.orange,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                <Icon name="timer" size={13} color={P.orange}/>En attendant l'arrivée des secours
              </div>
              <ul style={{margin:0,paddingLeft:18,fontSize:13,color:P.textSub,lineHeight:1.9}}>{conduite.en_attendant_hopital.map((e,i)=><li key={i}>{e}</li>)}</ul>
            </div>}

            {/* 3. Motif d'orientation — pour la transmission */}
            {conduite.raison_hospitalisation&&<div style={{padding:12,background:"rgba(255,59,48,0.03)",borderRadius:12,border:"1px solid rgba(255,59,48,0.15)"}}>
              <div style={{fontSize:11,fontWeight:700,color:P.red,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6,display:"flex",alignItems:"center",gap:4}}><Icon name="local_hospital" size={12} color={P.red}/>Motif d'orientation</div>
              <p style={{margin:0,fontSize:13,color:P.textSub,lineHeight:1.7}}>{conduite.raison_hospitalisation}</p>
            </div>}

            {/* Séparateur visuel */}
            <div style={{borderTop:`2px dashed ${P.border}`,margin:"4px 0"}}/>

            {/* 4. Traitement initial — ce qui peut être initié avant l'hôpital */}
            <div style={{padding:"12px 14px",background:P.white,borderRadius:12,border:"1px solid rgba(255,59,48,0.2)"}}>
              <div style={{fontSize:10,fontWeight:700,color:P.red,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                <Icon name="medication" size={13} color={P.red}/>Traitement initial d'urgence
                <span style={{fontSize:10,fontWeight:400,color:P.textMuted,marginLeft:2}}>· traitement définitif sur place</span>
              </div>
              {hasTreatment
                ?(conduite.traitement_suggere
                  ?<div style={{fontSize:13,color:P.textSub,lineHeight:1.75,whiteSpace:"pre-line"}}>{conduite.traitement_suggere}</div>
                  :<ul style={{margin:0,paddingLeft:18,fontSize:13,color:P.textSub,lineHeight:1.9}}>{treatItems.map((c,i)=><li key={i}>{c}</li>)}</ul>)
                :<div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <Icon name="info" size={14} color={P.textMuted} style={{marginTop:1,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:P.textSub}}>Aucun traitement pré-hospitalier suggéré</div>
                    <div style={{fontSize:12,color:P.textMuted,marginTop:2,lineHeight:1.55}}>{noTreatJustification}</div>
                  </div>
                </div>
              }
            </div>
          </>
        )}

        {/* ══ NON-URGENCE : ordre standard ══ */}
        {!isHopital&&(
          <div style={{padding:"12px 14px",background:P.white,borderRadius:12,border:`1px solid ${hasTreatment?P.azur+"30":P.border}`}}>
            <div style={{fontSize:10,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
              <Icon name="medication" size={13} color={P.azurDark}/>Traitement suggéré IA
              <span style={{fontSize:10,fontWeight:400,color:P.textMuted,marginLeft:2}}>· sous confirmation médicale</span>
            </div>
            {hasTreatment
              ?(conduite.traitement_suggere
                ?<div style={{fontSize:13,color:P.textSub,lineHeight:1.75,whiteSpace:"pre-line"}}>{conduite.traitement_suggere}</div>
                :<ul style={{margin:0,paddingLeft:18,fontSize:13,color:P.textSub,lineHeight:1.9}}>{treatItems.map((c,i)=><li key={i}>{c}</li>)}</ul>)
              :<div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                <Icon name="info" size={14} color={P.textMuted} style={{marginTop:1,flexShrink:0}}/>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:P.textSub}}>Aucun traitement suggéré</div>
                  <div style={{fontSize:12,color:P.textMuted,marginTop:2,lineHeight:1.55}}>{noTreatJustification}</div>
                </div>
              </div>
            }
          </div>
        )}

        {/* Diagnostics à éliminer — Q2 */}
        {conduite.diagnostics_a_eliminer?.length>0&&<div style={{padding:12,background:"rgba(255,59,48,0.03)",borderRadius:12,border:"1px solid rgba(255,59,48,0.15)"}}>
          <div style={{fontSize:10,fontWeight:700,color:P.red,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
            <Icon name="remove_circle" size={12} color={P.red}/>Diagnostics redoutables à éliminer
          </div>
          <ul style={{margin:0,paddingLeft:18,fontSize:12.5,color:P.textSub,lineHeight:1.85}}>{conduite.diagnostics_a_eliminer.map((d,i)=><li key={i}>{d}</li>)}</ul>
        </div>}

        {/* Examens — Q3 */}
        {conduite.actes_labo?.length>0&&<div style={{padding:14,background:P.white,borderRadius:12,border:`1px solid ${P.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}><Icon name="labs" size={13} color={P.azurDark}/>Examens complémentaires à prescrire</div>
          <ul style={{margin:0,paddingLeft:18,fontSize:13,color:P.textSub,lineHeight:1.9}}>{conduite.actes_labo.map((a,i)=><li key={i}>{a}</li>)}</ul>
        </div>}

        {/* Conseils / En attendant labo */}
        {!isHopital&&lifeItems.length>0&&<div style={{padding:14,background:P.white,borderRadius:12,border:`1px solid ${P.border}`}}>
          <div style={{fontSize:11,fontWeight:700,color:P.green,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
            <Icon name={isLabo?"schedule":"home"} size={13} color={P.green}/>
            {isLabo?"En attendant les résultats":"Conseils à domicile"}
          </div>
          <ul style={{margin:0,paddingLeft:18,fontSize:13,color:P.textSub,lineHeight:1.9}}>{lifeItems.map((c,i)=><li key={i}>{c}</li>)}</ul>
        </div>}

      </div>

      <div style={{marginTop:10,fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",gap:5}}>
        <Icon name="info" size={11} color={P.textMuted}/>Aide à la décision uniquement. Le diagnostic et le traitement relèvent de la responsabilité exclusive du médecin.
      </div>
    </div>
  );
}

// Carte localisation Google Maps
function HospitalMap({urgenceLevel}) {
  const [query,setQuery]=useState("");
  const [submitted,setSubmitted]=useState(false);
  const urgCfg = urgenceLevel==="haute"
    ? {msg:"Urgences recommandées",color:P.red,icon:"emergency"}
    : {msg:"Consultation médicale recommandée",color:P.azur,icon:"local_hospital"};
  const openGMaps=()=>{
    const q=encodeURIComponent((query||"hôpital urgences")+", France");
    window.open(`https://www.google.com/maps/search/${q}`,"_blank","noopener");
  };
  return (
    <div style={{...card({marginBottom:14})}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <Icon name="location_on" size={20} color={P.azur}/>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:P.text}}>Établissements à proximité</div>
            <div style={{fontSize:11,color:P.textMuted}}>Google Maps</div>
          </div>
        </div>
        <span style={{fontSize:12,padding:"4px 12px",borderRadius:20,background:`${urgCfg.color}12`,color:urgCfg.color,fontWeight:600,display:"flex",alignItems:"center",gap:5}}>
          <Icon name={urgCfg.icon} size={13} color={urgCfg.color}/>{urgCfg.msg}
        </span>
      </div>
      <div style={{display:"flex",gap:8}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&openGMaps()}
          placeholder={urgenceLevel==="haute"?"urgences hospitalières":"hôpital, clinique, médecin"}
          style={{...inputSty,flex:1,fontSize:13}}
          onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
          onBlur={e=>{e.target.style.outline="none";}}/>
        <Btn onClick={openGMaps}><Icon name="open_in_new" size={15}/>Ouvrir Maps</Btn>
      </div>
      <div style={{marginTop:8,fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",gap:4}}>
        <Icon name="info" size={11}/>Ouvre Google Maps dans un nouvel onglet avec la recherche
      </div>
    </div>
  );
}

// Bloc traitement médecin
function TraitementBlock({conduite,onValidate}) {
  const [diagConfirmed,setDiagConfirmed]=useState(false);
  const [treatment,setTreatment]=useState(conduite?.traitement_propose||"");
  const [validated,setValidated]=useState(false);
  const [notes,setNotes]=useState("");

  if(validated) return (
    <div style={{...card({padding:18,background:"rgba(52,199,89,0.06)",borderColor:"rgba(52,199,89,0.25)",marginBottom:14}),display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:40,height:40,borderRadius:"50%",background:P.green,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon name="check" size={20} color="white"/>
      </div>
      <div>
        <div style={{fontWeight:700,color:"#1a7a35",fontSize:14}}>Plan de soins validé par le médecin</div>
        <div style={{fontSize:12,color:P.textMuted,marginTop:2}}>{treatment.substring(0,100)}{treatment.length>100?"...":""}</div>
      </div>
    </div>
  );

  return (
    <div style={{...card({padding:20,marginBottom:14,borderColor:"rgba(84,164,191,0.3)",background:P.azurFaint})}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:12,background:P.azur,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <Icon name="stethoscope" size={20} color="white"/>
        </div>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:P.text}}>Décision médicale</div>
          <div style={{fontSize:12,color:P.textMuted}}>Réservé au médecin — validation du diagnostic et du traitement</div>
        </div>
      </div>

      {/* Étape 1 : Confirmer le diagnostic */}
      <div style={{marginBottom:14,padding:"14px 16px",background:P.white,borderRadius:12,border:`1px solid ${diagConfirmed?"rgba(52,199,89,0.3)":P.border}`}}>
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
          <input type="checkbox" checked={diagConfirmed} onChange={e=>setDiagConfirmed(e.target.checked)} style={{width:18,height:18,accentColor:P.green,cursor:"pointer"}}/>
          <div>
            <div style={{fontWeight:600,fontSize:13,color:P.text}}>Je confirme le diagnostic IA</div>
            <div style={{fontSize:12,color:P.textMuted}}>Cochez pour débloquer la prescription</div>
          </div>
          {diagConfirmed&&<Icon name="check_circle" size={18} color={P.green} style={{marginLeft:"auto"}}/>}
        </label>
      </div>

      {/* Étape 2 : Traitement */}
      <div style={{opacity:diagConfirmed?1:0.4,transition:"opacity 0.2s",pointerEvents:diagConfirmed?"auto":"none"}}>
        <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Plan de traitement</div>
        <textarea value={treatment} onChange={e=>setTreatment(e.target.value)}
          placeholder="Saisissez ou modifiez le plan de traitement : médicaments, posologies, durée, surveillance..."
          style={{...inputSty,height:90,resize:"vertical",lineHeight:1.7,fontSize:13,marginBottom:10}}
          onFocus={e=>{e.target.style.outline="2px solid "+P.azur;e.target.style.outlineOffset="0px";e.target.style.boxShadow=`0 0 0 3px rgba(84,164,191,0.12)`;}}
          onBlur={e=>{e.target.style.outline="none";}}/>
        <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Notes cliniques (optionnel)</div>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observations, consignes infirmières, suivi..."
          style={{...inputSty,fontSize:13,marginBottom:12}}
          onFocus={e=>{e.target.style.outline="2px solid "+P.azur;e.target.style.outlineOffset="0px";e.target.style.boxShadow=`0 0 0 3px rgba(84,164,191,0.12)`;}}
          onBlur={e=>{e.target.style.outline="none";}}/>
        <Btn onClick={()=>{ setValidated(true); onValidate?.({treatment,notes}); }} disabled={!treatment.trim()} variant="success">
          <Icon name="assignment_turned_in" size={15}/>Valider le plan de soins
        </Btn>
      </div>
    </div>
  );
}


function PromptBlock({prompt}) {
  const [show,setShow]=useState(false);
  const [copied,setCopied]=useState(false);
  const copy=()=>{
    navigator.clipboard?.writeText(prompt).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);});
  };
  return (
    <div style={{marginTop:12,borderTop:`1px solid ${P.border}`,paddingTop:12}}>
      <button onClick={()=>setShow(s=>!s)} style={{background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6,color:P.textMuted,fontSize:11,fontFamily:"inherit",padding:0}}>
        <Icon name={show?"expand_less":"expand_more"} size={14} color={P.textMuted}/>
        <span style={{fontFamily:"monospace"}}>Prompt final soumis aux modèles</span>
        <span style={{fontSize:10,color:P.border}}>({prompt.length} caractères)</span>
      </button>
      {show&&(
        <div style={{marginTop:8,position:"relative"}}>
          <pre style={{margin:0,padding:"12px 14px",background:"rgba(0,0,0,0.03)",borderRadius:10,border:`1px solid ${P.border}`,fontSize:10.5,color:P.textSub,lineHeight:1.7,overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-word",maxHeight:260,overflowY:"auto",fontFamily:"'SF Mono','Fira Mono','Consolas',monospace"}}>{prompt}</pre>
          <button onClick={copy} style={{position:"absolute",top:6,right:6,background:copied?P.green:P.white,border:`1px solid ${P.border}`,borderRadius:7,padding:"3px 8px",cursor:"pointer",fontSize:10,color:copied?"white":P.textSub,display:"flex",alignItems:"center",gap:3,fontFamily:"inherit",transition:"all 0.2s"}}>
            <Icon name={copied?"check":"content_copy"} size={11} color={copied?"white":P.textMuted}/>{copied?"Copié !":"Copier"}
          </button>
        </div>
      )}
    </div>
  );
}

function Phase4({data,onReset,onBack,userRole="infirmier",user,structData,patientAddress="",onSubmitToDoctor,submittedCase}) {
  const [showExplain,setShowExplain]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [patientName]=useState(structData?._patientName||structData?.patient_name||structData?.nom||"Patient");
  const [showConsensus,setShowConsensus]=useState(false);
  const urgColor=URGENCE_C[data.urgence]||P.orange;
  const consensus=data.consensus;

  return (
    <div style={{animation:"fadeIn 0.35s ease-out"}}>
      {/* ── En-tête avec indicateurs ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <div style={{padding:"6px 14px",borderRadius:20,background:`${urgColor}12`,border:`1px solid ${urgColor}30`,display:"flex",alignItems:"center",gap:6}}>
            <Icon name={data.urgence==="haute"?"emergency":data.urgence==="moyenne"?"warning":"check_circle"} size={15} color={urgColor}/>
            <span style={{fontSize:12,fontWeight:700,color:urgColor,textTransform:"capitalize"}}>Urgence {data.urgence}</span>
          </div>
          <div style={{padding:"6px 14px",borderRadius:20,background:`${P.azur}12`,border:`1px solid ${P.azur}30`,display:"flex",alignItems:"center",gap:6}}>
            <Icon name="verified" size={15} color={P.azur}/>
            <span style={{fontSize:12,fontWeight:700,color:P.azur}}>Confiance {data.score_confiance}%</span>
          </div>
          <div style={{padding:"6px 14px",borderRadius:20,background:`${P.turquoiseDark}12`,border:`1px solid ${P.turquoiseDark}30`,display:"flex",alignItems:"center",gap:6}}>
            <Icon name="biotech" size={15} color={P.turquoiseDark}/>
            <span style={{fontSize:12,fontWeight:700,color:P.turquoiseDark}}>{data.hypotheses?.length} hypothèse(s)</span>
          </div>
        </div>
        </div>
      <h2 style={{margin:"0 0 12px",fontSize:20,fontWeight:700,color:P.text,letterSpacing:"-0.3px"}}>Résultats diagnostiques</h2>

      {/* ── Hypothèses ── */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(data.hypotheses?.length||1,3)},1fr)`,gap:12,marginBottom:14}}>
        {data.hypotheses?.map((h,i)=><HypoCard key={i} h={h} i={i}/>)}
      </div>

      {/* ── Conduite ── */}
      <ConduiteBlock conduite={data.conduite} hypotheses={data.hypotheses}/>

      {/* ── Localisation ── */}
      {(()=>{
        const sp=getSpecialtySuggestion(data.hypotheses,data.conduite);
        const country=user?.region?.split(" - ")[1]||user?.region||"France";
        const baseLocation=patientAddress?`${patientAddress}, ${country}`:country;
        return(
          <div style={{...card({padding:18,marginBottom:14})}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Icon name="location_on" size={18} color={P.azur}/>
                <div>
                  <div style={{fontWeight:700,fontSize:13,color:P.text}}>Établissements recommandés</div>
                  <div style={{fontSize:11,color:P.textMuted}}>{sp.label}</div>
                </div>
              </div>
              {patientAddress&&<span style={{fontSize:11,color:P.turquoiseDark,background:P.turquoiseLight,padding:"3px 9px",borderRadius:8,display:"flex",alignItems:"center",gap:4}}>
                <Icon name="person_pin" size={12} color={P.turquoiseDark}/>Près de : {patientAddress.substring(0,25)}{patientAddress.length>25?"…":""}
              </span>}
            </div>
            <div style={{display:"flex",gap:8}}>
              <input id="nurseMapQry" defaultValue={sp.query} style={{...inputSty,flex:1,fontSize:13}}
                onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
                onBlur={e=>{e.target.style.outline="none";}}/>
              <Btn onClick={()=>{const q=document.getElementById("nurseMapQry")?.value||sp.query;window.open(`https://www.google.com/maps/search/${encodeURIComponent(q+" near "+baseLocation)}`,"_blank","noopener");}}>
                <Icon name="open_in_new" size={14}/>Google Maps
              </Btn>
            </div>
            {!patientAddress&&<div style={{marginTop:6,fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",gap:4}}><Icon name="info" size={11}/>Ajoutez l'adresse du patient (phase 1) pour une recherche géolocalisée</div>}
          </div>
        );
      })()}

      {/* ── Décision médicale ── */}
      {userRole==="medecin"
        ?<TraitementBlock conduite={data.conduite} onValidate={()=>{}}/>
        :<div style={{...card({padding:16,marginBottom:14,background:(submittedCase?.doctorValidated)?"rgba(52,199,89,0.06)":submitted?"rgba(84,164,191,0.06)":"rgba(84,164,191,0.05)",borderColor:(submittedCase?.doctorValidated)?"rgba(52,199,89,0.25)":"rgba(84,164,191,0.25)"})}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:40,height:40,borderRadius:12,background:(submittedCase?.doctorValidated)?P.green:submitted?P.azur:"rgba(84,164,191,0.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Icon name={(submittedCase?.doctorValidated)?"check_circle":submitted?"schedule":"stethoscope"} size={20} color="white"/>
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:P.text}}>
                  {(submittedCase?.doctorValidated)?
                    (submittedCase.doctorDiagOnly?"✓ Diagnostic validé — traitement à confirmer":"✓ Diagnostic et traitement validés")
                    :submitted?"Dossier transmis — en attente":"Décision médicale requise"}
                </div>
                <div style={{fontSize:12,color:P.textMuted}}>
                  {(submittedCase?.doctorValidated)?`Dr ${submittedCase.doctorSignature} · ${submittedCase.doctorTimestamp}`:submitted?"Le dossier est disponible dans cette session":"Le médecin doit valider le diagnostic et prescrire le traitement"}
                </div>
              </div>
            </div>
            {!submitted&&<Btn onClick={()=>{
              if(onSubmitToDoctor){
                onSubmitToDoctor({patientName,patientAddress:patientAddress||"",nurseUser:user,timestamp:new Date().toLocaleString("fr-FR"),structData,diagnostic:data});
                setSubmitted(true);
              }
            }} variant="success"><Icon name="send" size={14}/>Transmettre au médecin</Btn>}
          </div>
          {(submittedCase?.doctorValidated)&&submittedCase.doctorTreatment&&(
            <div style={{marginTop:12,padding:"12px 14px",background:P.white,borderRadius:12,border:`1px solid rgba(52,199,89,0.25)`}}>
              <div style={{fontSize:10,fontWeight:700,color:P.green,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,display:"flex",alignItems:"center",gap:4}}>
                <Icon name="medication" size={12} color={P.green}/>Traitement prescrit par le médecin
              </div>
              <div style={{fontSize:13,color:P.textSub,lineHeight:1.7}}>{submittedCase.doctorTreatment}</div>
              {submittedCase.doctorNotes&&<div style={{marginTop:6,fontSize:12,color:P.textMuted,fontStyle:"italic"}}>{submittedCase.doctorNotes}</div>}
            </div>
          )}
        </div>}





      {/* ── Section IA (repliable) ── */}

      <div style={{...card({padding:0,overflow:"hidden",marginBottom:14,opacity:0.85})}}>
        <button onClick={()=>setShowExplain(e=>!e)} style={{width:"100%",padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"inherit"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Icon name="psychology" size={18} color={P.azur}/>
            <span style={{fontWeight:700,fontSize:13,color:P.text}}>Voir l'analyse IA détaillée</span>
            <span style={{fontSize:10,color:P.textMuted,background:"rgba(0,0,0,0.05)",padding:"2px 8px",borderRadius:6}}>Aide à la décision · responsabilité médicale exclusive</span>
          </div>
          <Icon name={showExplain?"expand_less":"expand_more"} size={18} color={P.textMuted}/>
        </button>

        {showExplain&&(
          <div style={{padding:"0 18px 18px",borderTop:`1px solid ${P.border}`}}>
            <div style={{paddingTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {/* Raisonnement */}
              <div style={{padding:16,background:"rgba(0,0,0,0.02)",borderRadius:12,border:`1px solid ${P.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <div style={{width:24,height:24,borderRadius:7,background:`${P.azur}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <Icon name="psychology" size={14} color={P.azur}/>
                  </div>
                  <div>
                    <span style={{fontWeight:700,fontSize:12,color:P.text}}>Raisonnement IA</span>
                    <span style={{fontSize:10,color:P.textMuted,marginLeft:6}}>par <span style={{fontFamily:"monospace",fontWeight:600,color:P.turquoiseDark}}>gpt-oss-120b</span></span>
                  </div>
                </div>
                <div style={{fontSize:12,color:P.textSub,lineHeight:1.75}}>{data.raisonnement_explicite||"—"}</div>
              </div>

              {/* Consensus */}
              {consensus&&(
                <div style={{padding:16,background:"rgba(0,0,0,0.02)",borderRadius:12,border:`1px solid ${P.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                    <div style={{width:24,height:24,borderRadius:7,background:`${P.turquoise}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name="account_tree" size={14} color={P.turquoiseDark}/>
                    </div>
                    <span style={{fontWeight:700,fontSize:12,color:P.text}}>Consensus</span>
                    <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:consensus.accord_ia==="total"?"rgba(52,199,89,0.12)":consensus.accord_ia==="partiel"?"rgba(255,149,0,0.12)":"rgba(255,59,48,0.1)",color:consensus.accord_ia==="total"?P.green:consensus.accord_ia==="partiel"?P.orange:P.red,textTransform:"capitalize"}}>{consensus.accord_ia}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {[{l:"IA A",c:P.azur,a:consensus.avis_ia_a,m:"llama-3.3"},{l:"IA B",c:P.turquoiseDark,a:consensus.avis_ia_b,m:"kimi-k2"}].map(({l,c,a,m})=>(
                      <div key={l} style={{padding:"10px 12px",background:`${c}08`,border:`1px solid ${c}20`,borderRadius:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                          <div style={{width:16,height:16,borderRadius:4,background:c,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:8,fontWeight:800,color:"white"}}>{l.replace("IA ","")}</span></div>
                          <span style={{fontSize:10,fontWeight:700,color:c}}>{l}</span>
                          <span style={{fontSize:9,color:P.textMuted,marginLeft:"auto"}}>{m}</span>
                        </div>
                        <div style={{fontSize:11,fontWeight:600,color:P.text,marginBottom:3}}>{a?.diagnostic_principal||"—"}</div>
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <div style={{flex:1,height:3,background:"rgba(0,0,0,0.06)",borderRadius:2}}><div style={{height:"100%",width:`${a?.probabilite||0}%`,background:c,borderRadius:2}}/></div>
                          <span style={{fontSize:10,fontWeight:700,color:c}}>{a?.probabilite||0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {consensus.arbitrage&&<div style={{padding:"9px 12px",background:"rgba(0,0,0,0.025)",borderRadius:10,fontSize:11,color:P.textSub,lineHeight:1.6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:P.turquoiseDark,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>Arbitrage IA C</span>{consensus.arbitrage}</div>}
                  {consensus.point_divergence&&<div style={{padding:"9px 12px",background:"rgba(255,149,0,0.04)",borderRadius:10,fontSize:11,color:P.textSub,lineHeight:1.6,border:"1px solid rgba(255,149,0,0.15)"}}><span style={{fontSize:10,fontWeight:700,color:P.orange,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>Divergence</span>{consensus.point_divergence}</div>}
                </div>
              )}
            </div>
            {/* Prompt final */}
            <PromptBlock prompt={(()=>{
              if(data.prompt_final&&data.prompt_final.length>50) return data.prompt_final;
              // Reconstruit le prompt envoyé aux modèles depuis les données disponibles
              const s=structData||{};
              const vitals=Object.entries(s.constantes_vitales||{}).filter(([,v])=>v).map(([k,v])=>`  ${k}: ${v}`).join("\n")||"  (aucune)";
              const symp=(s.symptomes_principaux||[]).join(", ")||"non spécifiés";
              const atcd=(Array.isArray(s.antecedents)?s.antecedents:s.antecedents?[s.antecedents]:[]).join(", ")||"aucun";
              return `PROMPT DIAGNOSTIQUE — RECONSTRUCTION FRONTEND
════════════════════════════════════════

MOTIF DE CONSULTATION : ${s.motif_consultation||"—"}
CONTEXTE CLINIQUE : ${s.contexte_clinique||"—"}

SYMPTÔMES PRINCIPAUX :
  ${symp}

CONSTANTES VITALES :
${vitals}

ANTÉCÉDENTS : ${atcd}

SYMPTÔMES CONFIRMÉS PAR L'INFIRMIER(E) :
  ${(s.symptomes_confirmes||[]).join(", ")||"aucun"}

URGENCE ESTIMÉE : ${s.urgence_estimee||"—"}

────────────────────────────────────────
NOTE : Pour afficher le vrai prompt SHARED_PROMPT envoyé aux 3 modèles IA,
ajoutez dans pipeline/nodes.py :
  return { ...state, "diagnostic": diag_final, "prompt_final": SHARED_PROMPT }
════════════════════════════════════════`;
            })()}/>
          </div>
        )}
      </div>

      <div style={{display:"flex",gap:10,justifyContent:"space-between"}}>
        <Btn onClick={onBack} variant="secondary"><Icon name="arrow_back" size={15}/>Revoir</Btn>
        <Btn onClick={onReset}><Icon name="person_add" size={15}/>Nouveau patient</Btn>
      </div>
    </div>
  );
}


// ─── Génération rapport texte ─────────────────────────────────────────────────
function genReport({caseObj}) {
  const d = caseObj.diagnostic||{};
  const s = caseObj.structData||{};
  const lines = [
    "═".repeat(62),"RAPPORT MÉDICAL — MEDDIAG IA","═".repeat(62),"",
    `Patient      : ${caseObj.patientName||"—"}`,
    `Infirmier(e) : ${caseObj.nurseUser?.name||"—"} · ${caseObj.nurseUser?.service||"—"}`,
    `Date         : ${caseObj.timestamp||"—"}`,"",
    "─".repeat(62),"SYMPTÔMES ET DONNÉES COLLECTÉES","─".repeat(62),
    `Motif : ${s.motif_consultation||"—"}`,
    `Contexte : ${s.contexte_clinique||"—"}`,"",
    "Symptômes : "+((Array.isArray(s.symptomes_principaux)?s.symptomes_principaux:[]).join(", ")||"—"),"",
  ];
  const vitals=s.constantes_vitales||{};
  if(Object.values(vitals).some(v=>v)){lines.push("Constantes :");Object.entries(vitals).forEach(([k,v])=>{if(v)lines.push(`  ${k} : ${v}`);});lines.push("");}
  lines.push("─".repeat(62),"DIAGNOSTICS IA","─".repeat(62));
  (d.hypotheses||[]).forEach(h=>{lines.push(`#${h.rang} ${h.diagnostic} (${h.probabilite}%) — ${h.cim10||""}`);lines.push(`  ${h.justification||""}`);lines.push("");});
  lines.push("─".repeat(62),"CONDUITE À SUIVRE","─".repeat(62));
  const c=d.conduite||{};
  lines.push(`Niveau : ${c.niveau||"—"} — ${c.raison||""}`);
  if(c.traitement_suggere)lines.push(`Traitement suggéré : ${c.traitement_suggere}`);
  if(c.actes_labo?.length)lines.push("Examens :",...c.actes_labo.map(a=>`  • ${a}`));
  if(c.conseils_maison?.length)lines.push("Conseils :",...c.conseils_maison.map(a=>`  • ${a}`));
  lines.push("");
  lines.push("─".repeat(62),"EXPLICABILITÉ IA","─".repeat(62));
  lines.push("Raisonnement IA :");lines.push(d.raisonnement_explicite||"—");lines.push("");
  const cons=d.consensus||{};
  if(cons.accord_ia){
    lines.push(`Consensus : ${cons.accord_ia}`);
    lines.push(`IA A : ${cons.avis_ia_a?.diagnostic_principal||"—"} — ${cons.avis_ia_a?.probabilite||0}%`);
    lines.push(`IA B : ${cons.avis_ia_b?.diagnostic_principal||"—"} — ${cons.avis_ia_b?.probabilite||0}%`);
    lines.push(`Arbitrage : ${cons.arbitrage||"—"}`);lines.push("");
  }
  lines.push("─".repeat(62),"⚠  AIDE À LA DÉCISION UNIQUEMENT","─".repeat(62));
  lines.push("Le diagnostic et le traitement relèvent de la responsabilité exclusive du médecin.");
  return lines.join("\n");
}

// ─── Interface Médecin ────────────────────────────────────────────────────────
function DoctorInterface({user, cases, onCaseUpdate}) {
  const [selected, setSelected] = useState(cases[0]||null);
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [validated, setValidated] = useState(false);
  const [diagConfirmed, setDiagConfirmed] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  useEffect(()=>{
    if(!selected) return;
    setValidated(selected.doctorValidated||false);
    setTreatment(selected.doctorTreatment||selected.diagnostic?.conduite?.traitement_suggere||"");
    setNotes(selected.doctorNotes||"");
    setSignature(selected.doctorSignature||"");
    setDiagConfirmed(false);
    setShowExplain(false);
  },[selected?.id]);

  const exportPDF = () => {
    if(!selected)return;
    const d=selected.diagnostic||{};
    const s=selected.structData||{};
    const c=d.conduite||{};
    const cons=d.consensus||{};
    const ts=selected.doctorTimestamp||new Date().toLocaleString("fr-FR");
    const htmlContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Rapport Médical — ${selected.patientName||"Patient"}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:20mm 18mm;line-height:1.5;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2.5px solid #4bbfb5;}
  .logo{font-size:20px;font-weight:800;color:#4bbfb5;letter-spacing:-0.5px;}
  .logo span{font-size:11px;font-weight:400;color:#888;display:block;margin-top:2px;}
  .stamp{border:2px solid #4bbfb5;border-radius:8px;padding:10px 16px;text-align:center;min-width:180px;}
  .stamp .name{font-weight:700;font-size:13px;color:#1a1a1a;}
  .stamp .detail{font-size:10px;color:#666;margin-top:2px;}
  .stamp .sig{font-size:11px;font-style:italic;color:#4bbfb5;margin-top:6px;padding-top:6px;border-top:1px dashed #ccc;}
  .section{margin-bottom:16px;}
  .section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#4bbfb5;border-bottom:1px solid #e0e0e0;padding-bottom:4px;margin-bottom:10px;}
  .info-row{display:flex;gap:20px;margin-bottom:8px;}
  .info-block{flex:1;}
  .label{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:2px;}
  .value{font-size:11px;font-weight:600;color:#1a1a1a;}
  .badge{display:inline-block;padding:2px 9px;border-radius:12px;font-size:10px;font-weight:700;margin-right:6px;}
  .badge-red{background:#ffe5e5;color:#c0392b;}
  .badge-orange{background:#fff0d6;color:#d35400;}
  .badge-green{background:#e8f8ee;color:#1a7a35;}
  .badge-blue{background:#e6f1fb;color:#185fa5;}
  .badge-blue{background:#f0ebff;color:#3a7fa0;}
  .hypo{border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:10px;}
  .hypo-name{font-size:13px;font-weight:700;margin-bottom:4px;}
  .hypo-prob{font-size:11px;color:#888;margin-bottom:6px;}
  .prog-bar{height:4px;background:#eee;border-radius:2px;margin-bottom:6px;}
  .prog-fill{height:100%;border-radius:2px;}
  .prog-teal{background:#4bbfb5;}
  .prog-blue{background:#54a4bf;}
  .prog-blue{background:#4bbfb5;}
  .treatment-box{background:#f3edff;border:1px solid #d4b8ff;border-radius:8px;padding:12px;margin-bottom:12px;}
  .treatment-title{font-size:10px;font-weight:700;text-transform:uppercase;color:#4bbfb5;margin-bottom:6px;}
  .examen-list{padding-left:16px;}
  .examen-list li{margin-bottom:3px;}
  .disclaimer{margin-top:20px;padding:10px 14px;background:#fff8e6;border:1px solid #f5d76e;border-radius:6px;font-size:10px;color:#7d6608;}
  .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;font-size:9px;color:#aaa;}
  table{width:100%;border-collapse:collapse;}
  td,th{padding:5px 8px;border:1px solid #e8e8e8;font-size:10px;}
  th{background:#f5f5f5;font-weight:600;text-align:left;}
  @media print{body{padding:0;}}
</style></head><body>
  <div class="header">
    <div>
      <div class="logo">MedDiag IA<span>Diagnostic médical assisté par intelligence artificielle</span></div>
      <div style="margin-top:10px">
        <div class="label">Patient</div>
        <div class="value" style="font-size:16px">${selected.patientName||"Patient"}</div>
        <div style="font-size:10px;color:#666;margin-top:2px">Collecté par ${selected.nurseUser?.name||"—"} · ${selected.nurseUser?.service||"—"} · ${selected.timestamp||"—"}</div>
      </div>
    </div>
    <div class="stamp">
      <div class="name">Dr ${selected.doctorSignature||user?.name||"—"}</div>
      <div class="detail">${user?.service||"Service médical"}</div>
      <div class="sig">✎ ${selected.doctorSignature||"Signature électronique"}</div>
      <div style="font-size:9px;color:#aaa;margin-top:4px">${ts}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Niveau d'urgence &amp; Confiance</div>
    <span class="badge ${d.urgence==="haute"?"badge-red":d.urgence==="moyenne"?"badge-orange":"badge-green"}">
      ▲ Urgence ${d.urgence||"—"}
    </span>
    <span class="badge badge-blue">✓ Confiance ${d.score_confiance||0}%</span>
    <span class="badge badge-blue">⚗ ${(d.hypotheses||[]).length} hypothèse(s)</span>
  </div>

  <div class="section">
    <div class="section-title">Motif de consultation</div>
    <div>${s.motif_consultation||"—"}</div>
    <div style="margin-top:6px;color:#555">${s.contexte_clinique||""}</div>
  </div>

  ${Object.values(s.constantes_vitales||{}).some(v=>v)?`<div class="section">
    <div class="section-title">Constantes vitales</div>
    <table><tr>${Object.entries(s.constantes_vitales||{}).filter(([,v])=>v).map(([k,v])=>`<th>${k}</th>`).join("")}</tr>
    <tr>${Object.entries(s.constantes_vitales||{}).filter(([,v])=>v).map(([,v])=>`<td>${v}</td>`).join("")}</tr></table>
  </div>`:""}

  <div class="section">
    <div class="section-title">Diagnostics IA</div>
    ${(d.hypotheses||[]).map((h,i)=>`<div class="hypo">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span class="badge ${i===0?"badge-blue":i===1?"badge-blue":"badge-green"}">#${h.rang} ${h.cim10||""}</span>
        <span style="font-weight:700;font-size:13px;color:${i===0?"#185fa5":i===1?P.azurDark:"#1a7a35"}">${h.probabilite}%</span>
      </div>
      <div class="hypo-name">${h.diagnostic}</div>
      <div class="prog-bar"><div class="prog-fill ${i===0?"prog-blue":i===1?"prog-blue":"prog-teal"}" style="width:${h.probabilite}%"></div></div>
      <div style="color:#555;font-size:10px">${h.justification||""}</div>
    </div>`).join("")}
  </div>

  <div class="section">
    <div class="section-title">Conduite à suivre — ${c.niveau||"—"}</div>
    <div style="color:#555;margin-bottom:10px">${c.raison||""}</div>
    ${c.actes_labo?.length?`<div><strong>Examens à réaliser :</strong><ul class="examen-list">${c.actes_labo.map(a=>`<li>${a}</li>`).join("")}</ul></div>`:""}
    ${c.conseils_maison?.length?`<div style="margin-top:8px"><strong>Conseils :</strong><ul class="examen-list">${c.conseils_maison.map(a=>`<li>${a}</li>`).join("")}</ul></div>`:""}
  </div>

  <div class="treatment-box">
    <div class="treatment-title">💊 Traitement prescrit par le médecin</div>
    <div style="font-size:12px">${selected.doctorTreatment||c.traitement_suggere||"Aucun traitement prescrit"}</div>
    ${selected.doctorNotes?`<div style="margin-top:8px;font-size:10px;color:#666;font-style:italic">Notes : ${selected.doctorNotes}</div>`:""}
  </div>

  <div class="section">
    <div class="section-title">Explicabilité IA</div>
    <div style="margin-bottom:8px"><strong>Raisonnement (gpt-oss-120b) :</strong><br/><span style="color:#555">${d.raisonnement_explicite||"—"}</span></div>
    ${cons.accord_ia?`<div><strong>Consensus :</strong> ${cons.accord_ia} — IA A: ${cons.avis_ia_a?.diagnostic_principal||"—"} (${cons.avis_ia_a?.probabilite||0}%) · IA B: ${cons.avis_ia_b?.diagnostic_principal||"—"} (${cons.avis_ia_b?.probabilite||0}%)</div>`:""}
    ${cons.arbitrage?`<div style="margin-top:6px;color:#555">${cons.arbitrage}</div>`:""}
  </div>

  <div class="disclaimer">⚠ Aide à la décision uniquement. Le diagnostic et le traitement relèvent de la responsabilité exclusive du médecin.</div>

  <div class="footer">
    <div>MedDiag IA — Rapport généré le ${new Date().toLocaleString("fr-FR")}</div>
    <div>Document confidentiel — Usage médical uniquement</div>
  </div>
</body></html>`;
    const w=window.open("","_blank","width=900,height=700");
    w.document.write(htmlContent);
    w.document.close();
    setTimeout(()=>w.print(),800);
  };

  const validate = () => {
    if(!signature.trim()){alert("Ajoutez votre signature.");return;}
    const updated={
      ...selected,
      doctorValidated:true,
      doctorDiagOnly:!treatment.trim(), // diagnostic seul si pas de traitement
      doctorTreatment:treatment||"",
      doctorNotes:notes,
      doctorSignature:signature,
      doctorTimestamp:new Date().toLocaleString("fr-FR")
    };
    setValidated(true);
    onCaseUpdate(updated);
  };

  if(!selected||cases.length===0) return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,color:P.textMuted,padding:40}}>
      <Icon name="inbox" size={52} color="rgba(0,0,0,0.1)"/>
      <div style={{fontSize:15,fontWeight:500,color:P.text}}>Aucun dossier en attente</div>
      <div style={{fontSize:13,color:P.textMuted}}>Les dossiers soumis par les infirmier(e)s apparaîtront ici</div>
    </div>
  );

  const d = selected.diagnostic||{};
  const urgColor = URGENCE_C[d.urgence]||P.orange;
  const specialty = getSpecialtySuggestion(d.hypotheses, d.conduite);

  return (
    <div style={{display:"grid",gridTemplateColumns:"290px 1fr",height:"calc(100vh - 56px)",overflow:"hidden"}}>
      {/* ── Sidebar ── */}
      <div style={{borderRight:`1px solid ${P.border}`,overflowY:"auto",background:"rgba(0,0,0,0.01)"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${P.border}`,fontSize:11,fontWeight:700,color:P.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",display:"flex",alignItems:"center",gap:6}}>
          <Icon name="folder_open" size={13}/>Dossiers
          <span style={{marginLeft:"auto",background:P.turquoise,color:P.text,fontSize:10,padding:"1px 7px",borderRadius:8,fontWeight:700}}>{cases.length}</span>
        </div>
        {cases.map(c=>{
          const urg=c.diagnostic?.urgence;
          const isSelected=selected?.id===c.id;
          return <div key={c.id} onClick={()=>setSelected(c)} style={{padding:"12px 16px",cursor:"pointer",transition:"all 0.15s",background:isSelected?"rgba(117,221,211,0.1)":"transparent",borderLeft:`3px solid ${isSelected?P.turquoise:"transparent"}`,borderBottom:`1px solid ${P.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
              <div style={{fontWeight:600,fontSize:13,color:P.text}}>{c.patientName||"Patient"}</div>
              {urg&&<span style={{fontSize:9,padding:"2px 7px",borderRadius:8,fontWeight:700,background:`${URGENCE_C[urg]||P.orange}15`,color:URGENCE_C[urg]||P.orange,textTransform:"capitalize"}}>{urg}</span>}
            </div>
            <div style={{fontSize:11,color:P.textMuted,marginBottom:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.diagnostic?.hypotheses?.[0]?.diagnostic||"—"}</div>
            <div style={{fontSize:10,color:P.textMuted,display:"flex",alignItems:"center",gap:4}}>
              <Icon name="person" size={10}/>Infirmier(e) {c.nurseUser?.name}
              {c.doctorValidated&&<><Icon name="check_circle" size={10} color={P.green} style={{marginLeft:4}}/><span style={{color:P.green}}>Validé</span></>}
            </div>
          </div>;
        })}
      </div>

      {/* ── Detail ── */}
      <div style={{overflowY:"auto",padding:"24px 28px"}}>
        {/* Header */}
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <div style={{fontSize:11,color:P.textMuted,marginBottom:4}}>Patient · soumis par l'infirmier(e) <strong style={{color:P.textSub}}>{selected.nurseUser?.name}</strong> le {selected.timestamp||""}</div>
              <h2 style={{margin:0,fontSize:20,fontWeight:700,color:P.text,letterSpacing:"-0.3px"}}>{selected.patientName||"Patient"}</h2>
            </div>
            <button onClick={exportPDF} style={{padding:"8px 16px",background:"linear-gradient(135deg,#4bbfb5,#3a7fa0)",border:"none",borderRadius:10,cursor:"pointer",fontSize:12,fontWeight:700,color:"white",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",boxShadow:"0 4px 14px rgba(84,164,191,0.35)",transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(84,164,191,0.5)";}} onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 14px rgba(84,164,191,0.35)";}}>
              <Icon name="picture_as_pdf" size={15} color="white"/>Export PDF complet
            </button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{padding:"5px 13px",borderRadius:20,background:`${urgColor}12`,border:`1px solid ${urgColor}25`,display:"flex",alignItems:"center",gap:5}}>
              <Icon name={d.urgence==="haute"?"emergency":d.urgence==="moyenne"?"warning":"check_circle"} size={13} color={urgColor}/>
              <span style={{fontSize:11,fontWeight:700,color:urgColor,textTransform:"capitalize"}}>Urgence {d.urgence||"—"}</span>
            </div>
            <div style={{padding:"5px 13px",borderRadius:20,background:`${P.azur}12`,border:`1px solid ${P.azur}25`,display:"flex",alignItems:"center",gap:5}}>
              <Icon name="verified" size={13} color={P.azur}/>
              <span style={{fontSize:11,fontWeight:700,color:P.azur}}>Confiance {d.score_confiance||0}%</span>
            </div>
          </div>
        </div>

        {/* Hypothèses */}
        <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(d.hypotheses?.length||1,3)},1fr)`,gap:12,marginBottom:14}}>
          {(d.hypotheses||[]).map((h,i)=>{
            const col=[P.azur,P.turquoise,P.azur][i]||P.textMuted;
            return <div key={i} style={{...card({padding:18,borderColor:`${col}20`})}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                <span style={{fontSize:10,color:col,fontWeight:700,textTransform:"uppercase",background:`${col}15`,padding:"2px 10px",borderRadius:20}}>Hypothèse #{h.rang}</span>
                <span style={{fontSize:10,fontFamily:"monospace",color:P.textMuted,background:"rgba(0,0,0,0.04)",padding:"2px 7px",borderRadius:6}}>{h.cim10}</span>
              </div>
              <div style={{fontWeight:700,fontSize:14,color:P.text,marginBottom:8}}>{h.diagnostic}</div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:P.textMuted}}>Probabilité</span><span style={{fontWeight:700,color:col,fontSize:17}}>{h.probabilite}%</span></div>
              <div style={{height:4,background:"rgba(0,0,0,0.06)",borderRadius:2}}><div style={{height:"100%",width:`${h.probabilite}%`,background:col,borderRadius:2,transition:"width 1.2s ease"}}/></div>
              <div style={{fontSize:12,color:P.textSub,lineHeight:1.65,marginTop:10}}>{h.justification}</div>
            </div>;
          })}
        </div>

        {/* Conduite — même composant que l'infirmier */}
        {d.conduite&&<ConduiteBlock conduite={d.conduite} hypotheses={d.hypotheses}/>}

        {/* Localisation adaptée */}
        <div style={{...card({marginBottom:14})}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <Icon name="location_on" size={18} color={P.azur}/>
            <div><div style={{fontWeight:700,fontSize:13,color:P.text}}>Orientation spécialisée</div><div style={{fontSize:11,color:P.textMuted}}>{specialty.label}</div></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <input id="docMapQuery" defaultValue={specialty.query+((selected.patientAddress||"")?" near "+(selected.patientAddress||""):"")} style={{...inputSty,flex:1,fontSize:13}}
              onFocus={e=>{e.target.style.outline="2px solid "+P.turquoise;e.target.style.outlineOffset="0px";}}
              onBlur={e=>{e.target.style.outline="none";}}/>
            <Btn onClick={()=>{const q=document.getElementById("docMapQuery").value;window.open(`https://www.google.com/maps/search/${encodeURIComponent(q+", France")}`,"_blank","noopener");}}>
              <Icon name="open_in_new" size={14}/>Google Maps
            </Btn>
          </div>
        </div>

        {/* Décision médicale */}
        {validated?(
          <div style={{...card({padding:18,marginBottom:14,background:"rgba(52,199,89,0.06)",borderColor:"rgba(52,199,89,0.25)"})}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:treatment?12:0}}>
              <div style={{width:42,height:42,borderRadius:"50%",background:P.green,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="verified" size={22} color="white"/></div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:"#1a7a35",fontSize:14}}>
                  {treatment?"Diagnostic + traitement validés":"Diagnostic validé (sans traitement prescrit)"}
                </div>
                <div style={{fontSize:12,color:P.textMuted}}>Dr {signature} · {selected.doctorTimestamp}</div>
              </div>
              <Btn onClick={()=>{setValidated(false);setDiagConfirmed(false);}} variant="ghost" small>Modifier</Btn>
            </div>
            {treatment&&<div style={{padding:"12px 14px",background:P.white,borderRadius:12,border:"1px solid rgba(52,199,89,0.2)"}}>
              <div style={{fontSize:10,fontWeight:700,color:P.green,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,display:"flex",alignItems:"center",gap:4}}><Icon name="medication" size={12} color={P.green}/>Traitement prescrit</div>
              <div style={{fontSize:13,color:P.textSub,lineHeight:1.7,whiteSpace:"pre-line"}}>{treatment}</div>
              {notes&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${P.border}`,fontSize:12,color:P.textMuted,fontStyle:"italic"}}>{notes}</div>}
            </div>}
            <div style={{marginTop:10,padding:"10px 14px",background:"rgba(52,199,89,0.06)",borderRadius:10,border:"1px solid rgba(52,199,89,0.2)",display:"flex",alignItems:"center",gap:8}}>
              <Icon name="send" size={14} color={P.green}/>
              <span style={{fontSize:12,color:"#1a7a35",fontWeight:600}}>Transmis à l'infirmier(e) — dossier clôturé</span>
            </div>
          </div>
        ):(
          <div style={{...card({padding:20,marginBottom:14,borderColor:"rgba(84,164,191,0.3)",background:P.azurFaint})}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:40,height:40,borderRadius:12,background:P.azur,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="stethoscope" size={20} color="white"/></div>
              <div><div style={{fontWeight:700,fontSize:14,color:P.text}}>Décision médicale</div><div style={{fontSize:12,color:P.textMuted}}>Confirmez le diagnostic et validez/corrigez le traitement</div></div>
            </div>
            {/* Étape 1 — Diagnostic */}
            <div style={{marginBottom:10,padding:"12px 14px",background:P.white,borderRadius:12,border:`1px solid ${diagConfirmed?"rgba(52,199,89,0.3)":P.border}`}}>
              <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                <input type="checkbox" checked={diagConfirmed} onChange={e=>setDiagConfirmed(e.target.checked)} style={{width:17,height:17,accentColor:P.green,cursor:"pointer"}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13,color:P.text}}>Je confirme le diagnostic IA</div>
                  <div style={{fontSize:11,color:P.textMuted}}>Débloque la prescription</div>
                </div>
                {diagConfirmed&&<Icon name="check_circle" size={18} color={P.green}/>}
              </label>
            </div>
            {/* Étape 2 — Traitement */}
            <div style={{opacity:diagConfirmed?1:0.35,transition:"opacity 0.2s",pointerEvents:diagConfirmed?"auto":"none"}}>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>Plan de traitement</span>
                  {d.conduite?.traitement_suggere&&!treatment&&<button onClick={()=>setTreatment(d.conduite.traitement_suggere)} style={{fontSize:10,color:P.azur,background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Utiliser le traitement IA</button>}
                </div>
                <textarea value={treatment} onChange={e=>setTreatment(e.target.value)}
                  placeholder={d.conduite?.traitement_suggere?"Cliquez 'Utiliser le traitement IA' ou rédigez votre prescription...":"Médicaments, posologies, durée, surveillance..."}
                  style={{...inputSty,height:90,resize:"vertical",lineHeight:1.7,background:"white"}}
                  onFocus={e=>{e.target.style.outline="2px solid "+P.azur;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
              </div>
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4}}>Notes / Consignes infirmières</div>
                <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observations, consignes de suivi..."
                  style={{...inputSty,background:"white"}} onFocus={e=>{e.target.style.outline="2px solid "+P.azur;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
              </div>
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:P.azurDark,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:4,display:"flex",alignItems:"center",gap:5}}><Icon name="draw" size={12} color={P.azurDark}/>Signature électronique</div>
                <input value={signature} onChange={e=>setSignature(e.target.value)} placeholder="Dr Nom Prénom — N° RPPS"
                  style={{...inputSty,fontStyle:signature?"italic":"normal",background:"white"}}
                  onFocus={e=>{e.target.style.outline="2px solid "+P.azur;e.target.style.outlineOffset="0px";}} onBlur={e=>{e.target.style.outline="none";}}/>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <Btn onClick={validate} variant="success" disabled={!signature.trim()}>
                  <Icon name="assignment_turned_in" size={15}/>{treatment.trim()?"Valider diagnostic + traitement":"Valider le diagnostic seul"}
                </Btn>
                {!treatment.trim()&&<span style={{fontSize:11,color:P.textMuted,fontStyle:"italic"}}>Sans traitement : le diagnostic seul sera transmis</span>}
              </div>
            </div>
          </div>
        )}

        {/* Analyse IA détaillée — identique infirmier */}
  
        <div style={{...card({padding:0,overflow:"hidden",marginBottom:14,opacity:0.85})}}>
          <button onClick={()=>setShowExplain(e=>!e)} style={{width:"100%",padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"inherit"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Icon name="psychology" size={18} color={P.azur}/>
              <span style={{fontWeight:700,fontSize:13,color:P.text}}>Voir l'analyse IA détaillée</span>
              <span style={{fontSize:10,color:P.textMuted,background:"rgba(0,0,0,0.05)",padding:"2px 8px",borderRadius:6}}>Aide à la décision · responsabilité médicale exclusive</span>
            </div>
            <Icon name={showExplain?"expand_less":"expand_more"} size={18} color={P.textMuted}/>
          </button>
  
          {showExplain&&(
            <div style={{padding:"0 18px 18px",borderTop:`1px solid ${P.border}`}}>
              <div style={{paddingTop:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {/* Raisonnement */}
                <div style={{padding:16,background:"rgba(0,0,0,0.02)",borderRadius:12,border:`1px solid ${P.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                    <div style={{width:24,height:24,borderRadius:7,background:`${P.azur}15`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <Icon name="psychology" size={14} color={P.azur}/>
                    </div>
                    <div>
                      <span style={{fontWeight:700,fontSize:12,color:P.text}}>Raisonnement IA</span>
                      <span style={{fontSize:10,color:P.textMuted,marginLeft:6}}>par <span style={{fontFamily:"monospace",fontWeight:600,color:P.turquoiseDark}}>gpt-oss-120b</span></span>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:P.textSub,lineHeight:1.75}}>{d.raisonnement_explicite||"—"}</div>
                </div>
  
                {/* Consensus */}
                {d.consensus&&(
                  <div style={{padding:16,background:"rgba(0,0,0,0.02)",borderRadius:12,border:`1px solid ${P.border}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:12}}>
                      <div style={{width:24,height:24,borderRadius:7,background:`${P.turquoise}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Icon name="account_tree" size={14} color={P.turquoiseDark}/>
                      </div>
                      <span style={{fontWeight:700,fontSize:12,color:P.text}}>Consensus</span>
                      <span style={{fontSize:10,padding:"2px 8px",borderRadius:8,fontWeight:700,background:consensus.accord_ia==="total"?"rgba(52,199,89,0.12)":consensus.accord_ia==="partiel"?"rgba(255,149,0,0.12)":"rgba(255,59,48,0.1)",color:consensus.accord_ia==="total"?P.green:consensus.accord_ia==="partiel"?P.orange:P.red,textTransform:"capitalize"}}>{consensus.accord_ia}</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      {[{l:"IA A",c:P.azur,a:consensus.avis_ia_a,m:"llama-3.3"},{l:"IA B",c:P.turquoiseDark,a:consensus.avis_ia_b,m:"kimi-k2"}].map(({l,c,a,m})=>(
                        <div key={l} style={{padding:"10px 12px",background:`${c}08`,border:`1px solid ${c}20`,borderRadius:10}}>
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5}}>
                            <div style={{width:16,height:16,borderRadius:4,background:c,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:8,fontWeight:800,color:"white"}}>{l.replace("IA ","")}</span></div>
                            <span style={{fontSize:10,fontWeight:700,color:c}}>{l}</span>
                            <span style={{fontSize:9,color:P.textMuted,marginLeft:"auto"}}>{m}</span>
                          </div>
                          <div style={{fontSize:11,fontWeight:600,color:P.text,marginBottom:3}}>{a?.diagnostic_principal||"—"}</div>
                          <div style={{display:"flex",alignItems:"center",gap:4}}>
                            <div style={{flex:1,height:3,background:"rgba(0,0,0,0.06)",borderRadius:2}}><div style={{height:"100%",width:`${a?.probabilite||0}%`,background:c,borderRadius:2}}/></div>
                            <span style={{fontSize:10,fontWeight:700,color:c}}>{a?.probabilite||0}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {consensus.arbitrage&&<div style={{padding:"9px 12px",background:"rgba(0,0,0,0.025)",borderRadius:10,fontSize:11,color:P.textSub,lineHeight:1.6,marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:P.turquoiseDark,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>Arbitrage IA C</span>{consensus.arbitrage}</div>}
                    {consensus.point_divergence&&<div style={{padding:"9px 12px",background:"rgba(255,149,0,0.04)",borderRadius:10,fontSize:11,color:P.textSub,lineHeight:1.6,border:"1px solid rgba(255,149,0,0.15)"}}><span style={{fontSize:10,fontWeight:700,color:P.orange,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:4}}>Divergence</span>{consensus.point_divergence}</div>}
                  </div>
                )}
              </div>
              {/* Prompt final */}
              <PromptBlock prompt={(()=>{
                if(d.prompt_final&&d.prompt_final.length>50) return d.prompt_final;
                // Reconstruit le prompt envoyé aux modèles depuis les données disponibles
                const s=selected?.structData||{};
                const vitals=Object.entries(s.constantes_vitales||{}).filter(([,v])=>v).map(([k,v])=>`  ${k}: ${v}`).join("\n")||"  (aucune)";
                const symp=(s.symptomes_principaux||[]).join(", ")||"non spécifiés";
                const atcd=(Array.isArray(s.antecedents)?s.antecedents:s.antecedents?[s.antecedents]:[]).join(", ")||"aucun";
                return `PROMPT DIAGNOSTIQUE — RECONSTRUCTION FRONTEND
  ════════════════════════════════════════
  
  MOTIF DE CONSULTATION : ${s.motif_consultation||"—"}
  CONTEXTE CLINIQUE : ${s.contexte_clinique||"—"}
  
  SYMPTÔMES PRINCIPAUX :
    ${symp}
  
  CONSTANTES VITALES :
  ${vitals}
  
  ANTÉCÉDENTS : ${atcd}
  
  SYMPTÔMES CONFIRMÉS PAR L'INFIRMIER(E) :
    ${(s.symptomes_confirmes||[]).join(", ")||"aucun"}
  
  URGENCE ESTIMÉE : ${s.urgence_estimee||"—"}
  
  ────────────────────────────────────────
  NOTE : Pour afficher le vrai prompt SHARED_PROMPT envoyé aux 3 modèles IA,
  ajoutez dans pipeline/nodes.py :
    return { ...state, "diagnostic": diag_final, "prompt_final": SHARED_PROMPT }
  ════════════════════════════════════════`;
              })()}/>
            </div>
          )}
        </div>
  
      </div>
    </div>
  );
}

function getSpecialtySuggestion(hypotheses=[], conduite=null) {
  const diag=(hypotheses[0]?.diagnostic||"").toLowerCase();
  const niveau=conduite?.niveau||"laboratoire";
  if(diag.includes("cardio")||diag.includes("coronar")||diag.includes("infarct")||diag.includes("sca"))return{query:"cardiologue urgences cardiaques",label:"Cardiologie / Urgences cardiaques"};
  if(diag.includes("pulmon")||diag.includes("bpco")||diag.includes("pneumon")||diag.includes("asthm"))return{query:"pneumologue hôpital",label:"Pneumologie"};
  if(diag.includes("neuro")||diag.includes("avc")||diag.includes("cérébr"))return{query:"neurologue urgences neurologiques",label:"Neurologie / AVC"};
  if(diag.includes("rein")||diag.includes("néphro")||diag.includes("urinaire"))return{query:"néphrologue ou urologue",label:"Néphrologie"};
  if(diag.includes("digest")||diag.includes("gastro")||diag.includes("foie"))return{query:"gastroentérologue hôpital",label:"Gastroentérologie"};
  if(niveau==="hopital")return{query:"hôpital urgences",label:"Hôpital / Urgences"};
  if(niveau==="laboratoire")return{query:"laboratoire médical analyse",label:"Laboratoire d'analyses"};
  return{query:"médecin généraliste",label:"Médecin généraliste"};
}

const URGENCE_C={haute:P.red, moyenne:P.orange, faible:P.green};

// ─── Stepper phases ────────────────────────────────────────────────────────────
const PHASES=[{id:1,label:"Collecte"},{id:2,label:"Vérification"},{id:3,label:"Analyse"},{id:4,label:"Résultats"}];
function PhaseStep({p,phase,setPhase}) {
  const [hov,hProps]=useHover();
  const done=phase>p.id,active=phase===p.id;
  return (
    <div {...hProps} onClick={()=>done&&setPhase(p.id)} style={{display:"flex",alignItems:"center",gap:7,padding:"5px 12px",borderRadius:20,background:active?"rgba(84,164,191,0.1)":"transparent",border:`1px solid ${active?P.azur:"transparent"}`,cursor:done?"pointer":"default",transition:"all 0.2s"}}>
      <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:done?P.turquoise:active?P.azur:"rgba(0,0,0,0.08)",transition:"all 0.2s"}}>
        {done?<Icon name="check" size={13} color={P.text}/>:<span style={{fontSize:10,fontWeight:700,color:done||active?"white":P.textMuted}}>{p.id}</span>}
      </div>
      <span style={{fontSize:12,fontWeight:active?600:400,color:active?P.azur:done?P.textSub:P.textMuted}}>{p.label}</span>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function MedicalPipeline() {
  const [user,setUser]=useState(null);
  const [phase,setPhase]=useState(1);
  const [structData,setStructData]=useState(null);
  const [imageAnalysis,setImageA]=useState("");
  const [diagnostic,setDiagnostic]=useState(null);
  const [phase3Key,setPhase3Key]=useState(0);
  const [cases,setCases]=useState([]);
  const [patientAddress,setPatientAddress]=useState("");
  const reset=()=>{setPhase(1);setStructData(null);setImageA("");setDiagnostic(null);setPatientAddress("");};

  if(!user) return <LoginScreen onLogin={setUser}/>;
  const isDoctor = user.role==="medecin";

  // Nurse submits to doctor pool
  const handleSubmitToDoctor = (d) => {
    setCases(prev=>[{id:Date.now(),patientName:d.patientName,patientAddress:d.patientAddress||"",nurseUser:d.nurseUser,timestamp:d.timestamp,structData:d.structData,diagnostic:d.diagnostic,doctorValidated:false},...prev]);
  };
  const handleCaseUpdate = (updated) => {
    setCases(prev=>prev.map(c=>c.id===updated.id?updated:c));
  };

  return (
    <div style={{minHeight:"100vh",background:P.bg,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',system-ui,sans-serif"}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);border-radius:3px;}
        input:focus,textarea:focus{outline:none!important;}
        button{font-family:inherit;}
        .material-symbols-rounded{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20;}
      `}</style>
      <header style={{background:"rgba(255,255,255,0.85)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:`1px solid ${P.border}`,padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:P.turquoise,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 8px rgba(117,221,211,0.4)`}}>
            <Icon name="local_hospital" size={19} color={P.text}/>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,color:P.text,letterSpacing:"-0.2px"}}>MedDiag IA</div>
            <div style={{fontSize:9,color:P.textMuted,letterSpacing:"0.06em",textTransform:"uppercase"}}>Diagnostic médical assisté</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:2}}>
          {!isDoctor&&PHASES.map((p,i)=>(
            <React.Fragment key={p.id}>
              <PhaseStep p={p} phase={phase} setPhase={setPhase}/>
              {i<3&&<div style={{width:16,height:1,background:phase>p.id?P.turquoise:"rgba(0,0,0,0.08)",transition:"background 0.3s"}}/>}
            </React.Fragment>
          ))}
          {isDoctor&&<div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 14px",borderRadius:20,background:"rgba(84,164,191,0.1)",border:`1px solid ${P.azur}30`}}>
            <Icon name="stethoscope" size={14} color={P.azur}/>
            <span style={{fontSize:12,fontWeight:600,color:P.azur}}>Interface Médecin</span>
            {cases.filter(c=>!c.doctorValidated).length>0&&<span style={{background:P.red,color:"white",fontSize:10,padding:"1px 7px",borderRadius:8,fontWeight:700}}>{cases.filter(c=>!c.doctorValidated).length}</span>}
          </div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:12,fontWeight:600,color:P.text}}>{user.name}</div>
            <div style={{fontSize:10,color:P.textMuted}}>{isDoctor?"Médecin":"Infirmier(e)"} · {user.service}</div>
          </div>
          <div style={{width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,0.05)",border:`1px solid ${P.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.15s"}}
            onClick={()=>setUser(null)} title="Se déconnecter"
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,59,48,0.08)";e.currentTarget.style.borderColor="rgba(255,59,48,0.3)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.05)";e.currentTarget.style.borderColor=P.border;}}>
            {user.role==="medecin"?<Icon name="stethoscope" size={16} color={P.textMuted}/>:<Icon name="medical_services" size={16} color={P.textMuted}/>}
          </div>
        </div>
      </header>
      {isDoctor
        ?<DoctorInterface user={user} cases={cases} onCaseUpdate={handleCaseUpdate}/>
        :<main style={{padding:"28px",maxWidth:1320,margin:"0 auto"}}>
          {phase===1&&<Phase1 onNext={(d,img)=>{setStructData(d);setImageA(img||"");setPhase(2);}} user={user} patientAddress={patientAddress} setPatientAddress={setPatientAddress}/>}
          {phase===2&&structData&&<Phase2 data={structData} imageAnalysis={imageAnalysis} onNext={(d,img)=>{setStructData(d);setImageA(img||"");setPhase3Key(k=>k+1);setPhase(3);}} onBack={()=>setPhase(1)}/>}
          {phase===3&&<Phase3 key={phase3Key} data={structData} imageAnalysis={imageAnalysis} onNext={d=>{setDiagnostic(d);setPhase(4);}} onBack={()=>setPhase(2)}/>}
          {phase===4&&diagnostic&&<Phase4 data={diagnostic} userRole={user?.role||"infirmier"} onReset={reset} onBack={()=>{setPhase3Key(k=>k+1);setPhase(3);}} user={user} structData={structData} patientAddress={patientAddress} onSubmitToDoctor={handleSubmitToDoctor} submittedCase={cases.find(c=>c.diagnostic===diagnostic)||null}/>}
        </main>}
    </div>
  );
}