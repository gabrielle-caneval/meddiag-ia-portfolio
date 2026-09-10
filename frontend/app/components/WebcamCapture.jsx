/*

PROTECTION – DROITS D’AUTEUR – 2026

 

© 2026 

 

Ce travail (code source + documents associés) est protégé par le droit d’auteur.

Code consultable pour évaluation du portfolio. Voir LICENSE.

Aucune cession de droits. Toute autre utilisation (reproduction, modification,

exploitation pédagogique ou commerciale) interdite sans accord écrit préalable.

*/
"use client";
import React, { useState, useEffect, useRef } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const P = {
  turquoise:"#75ddd3", turquoiseDark:"#4bbfb5", turquoiseLight:"rgba(117,221,211,0.12)",
  azur:"#54a4bf", azurDark:"#3a7fa0", azurFaint:"rgba(84,164,191,0.08)",
  jaune:"#e1e776", jauneLight:"#F2F0e9",
  white:"#ffffff", bg:"#f7f8fa",
  text:"#1d1d1f", textSub:"#3d3d3f", textMuted:"#86868b",
  border:"rgba(0,0,0,0.08)", borderMed:"rgba(0,0,0,0.12)",
  shadow:"0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)",
  red:"#ff3b30", orange:"#ff9500", green:"#34c759",
};

// ─── Fallback questions par contexte ─────────────────────────────────────────
const FALLBACK_QUESTIONS = {
  general: [
    {id:"g1",text:"Depuis combien de temps avez-vous ces symptômes ?",priority:"high",category:"Chronologie"},
    {id:"g2",text:"La douleur est-elle continue ou par crises ?",priority:"high",category:"Symptômes"},
    {id:"g3",text:"Avez-vous des antécédents médicaux connus ?",priority:"high",category:"Antécédents"},
    {id:"g4",text:"Prenez-vous des médicaments actuellement ?",priority:"high",category:"Traitements"},
    {id:"g5",text:"Avez-vous des allergies connues ?",priority:"medium",category:"Antécédents"},
    {id:"g6",text:"Y a-t-il eu un événement déclenchant ?",priority:"medium",category:"Chronologie"},
    {id:"g7",text:"La douleur irradie-t-elle vers une autre zone ?",priority:"medium",category:"Symptômes"},
    {id:"g8",text:"Avez-vous de la fièvre ou des frissons ?",priority:"medium",category:"Symptômes"},
  ],
  cardio: [
    {id:"c1",text:"La douleur irradie-t-elle vers le bras gauche ou la mâchoire ?",priority:"high",category:"Symptômes"},
    {id:"c2",text:"Avez-vous une sensation d'oppression thoracique ?",priority:"high",category:"Symptômes"},
    {id:"c3",text:"Avez-vous des palpitations ou un rythme irrégulier ?",priority:"high",category:"Symptômes"},
    {id:"c4",text:"Avez-vous des antécédents d'infarctus ou d'angine ?",priority:"high",category:"Antécédents"},
    {id:"c5",text:"Avez-vous une dyspnée au repos ou à l'effort ?",priority:"medium",category:"Symptômes"},
    {id:"c6",text:"Prenez-vous des anticoagulants ou des bêtabloquants ?",priority:"medium",category:"Traitements"},
  ],
  neuro: [
    {id:"n1",text:"Avez-vous des troubles de la vision ou de la parole ?",priority:"high",category:"Symptômes"},
    {id:"n2",text:"Avez-vous des fourmillements ou une faiblesse d'un côté ?",priority:"high",category:"Symptômes"},
    {id:"n3",text:"Avez-vous eu des pertes de connaissance récentes ?",priority:"high",category:"Antécédents"},
    {id:"n4",text:"La céphalée est-elle inhabituellement sévère ?",priority:"high",category:"Symptômes"},
    {id:"n5",text:"Avez-vous des antécédents d'AVC ou d'épilepsie ?",priority:"medium",category:"Antécédents"},
  ],
  digestif: [
    {id:"d1",text:"La douleur est-elle localisée ou diffuse dans l'abdomen ?",priority:"high",category:"Symptômes"},
    {id:"d2",text:"Avez-vous des nausées, vomissements ou diarrhées ?",priority:"high",category:"Symptômes"},
    {id:"d3",text:"Avez-vous remarqué du sang dans les selles ou les vomissements ?",priority:"high",category:"Symptômes"},
    {id:"d4",text:"Avez-vous mangé quelque chose d'inhabituel récemment ?",priority:"medium",category:"Chronologie"},
    {id:"d5",text:"Avez-vous des antécédents d'ulcère ou de chirurgie abdominale ?",priority:"medium",category:"Antécédents"},
  ],
};

function detectContext(t="") {
  const s = t.toLowerCase();
  if (/douleur.*(thorac|poitrin|coeur|cardiaq)|palpitat|infarct|coronar|angine|essouffl/.test(s)) return "cardio";
  if (/céphalée|migraine|vertige|conscience|avc|paraly|fourmil|vision/.test(s)) return "neuro";
  if (/abdom|ventre|nausée|vomiss|diarrhée|selles|foie|pancré/.test(s)) return "digestif";
  return "general";
}

// Normalise les questions qu'elles soient des strings ou des objets
function normalizeQuestions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((q, i) => {
    if (typeof q === "string") {
      return { id: `q_${i}_${q.slice(0,8).replace(/\s/g,"_")}`, text: q, priority: "medium", category: "Général" };
    }
    // S'assurer que id est toujours défini et unique
    return { ...q, id: q.id ?? `q_${i}_${String(q.text||"").slice(0,8).replace(/\s/g,"_")}` };
  });
}

function Icon({name, size=20, color, style={}}) {
  return (
    <span className="material-symbols-rounded" translate="no" aria-hidden="true"
      style={{fontSize:size,lineHeight:1,display:"inline-flex",alignItems:"center",
        justifyContent:"center",userSelect:"none",flexShrink:0,
        fontFamily:"'Material Symbols Rounded'",
        fontVariationSettings:"'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 20",
        ...(color?{color}:{}),...style}}>
      {name}
    </span>
  );
}

// ─── Indicateur audio niveau micro ───────────────────────────────────────────
function AudioMeter({ stream }) {
  const [levels, setLevels] = useState([2,3,2,4,2,3,2,4,2,3]);
  const rafRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    if (!stream) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = Array.from({length:10}, (_,i) => {
          const v = data[Math.floor(i * data.length / 10)] / 255;
          return Math.max(2, Math.round(v * 22));
        });
        setLevels(bars);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(rafRef.current);
        try { ctx.close(); } catch {}
      };
    } catch {}
  }, [stream]);

  return (
    <div style={{display:"flex",alignItems:"center",gap:2,height:24}}>
      {levels.map((h,i) => (
        <div key={i} style={{
          width:3, height:`${h}px`, borderRadius:2,
          background:h>14?P.red:h>8?P.orange:P.turquoise,
          transition:"height 0.08s ease",
        }}/>
      ))}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function WebcamCapture({ onPhotoCapture, transcription="", onSessionData }) {
  const [isOpen, setIsOpen]           = useState(false);
  const [stream, setStream]           = useState(null);
  const [error, setError]             = useState("");
  const [isMuted, setIsMuted]         = useState(false);
  const [isCamOff, setIsCamOff]       = useState(false);
  const [photos, setPhotos]           = useState([]);
  const [analyzing, setAnalyzing]     = useState(null); // photo index en cours
  const [flash, setFlash]             = useState(false);
  const [timer, setTimer]             = useState(null); // 3,2,1 countdown
  const [elapsed, setElapsed]         = useState(0);
  const [facingMode, setFacingMode]   = useState("user");
  const [zoom, setZoom]               = useState(1);
  const [showGrid, setShowGrid]       = useState(false);

  // ── États panel questions + transcription ──────────────────────────────────
  const [questions,      setQuestions]   = useState([]);
  const [checkedQ,       setCheckedQ]    = useState({});
  const [loadingQ,       setLoadingQ]    = useState(false);
  const [activePanel,    setActivePanel] = useState("questions");
  const [activeCategory, setActiveCategory] = useState("all");
  const [newQId,         setNewQId]      = useState(null);
  const [localText,      setLocalText]   = useState("");   // texte editable
  const [interimText,    setInterimText] = useState("");   // interim STT grisé
  const [isListening,    setIsListening] = useState(false);
  const qTimerRef  = useRef(null);
  const speechRef  = useRef(null);
  const accumRef   = useRef("");

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const timerRef   = useRef(null);
  const elapsedRef = useRef(null);

  // ── Start webcam ──────────────────────────────────────────────────────────
  const startCamera = async () => {
    setError("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width:{ideal:1280}, height:{ideal:720} },
        audio: true,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      // Chrono
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(e => e+1), 1000);
    } catch(e) {
      setError("Accès caméra refusé. Autorisez l'accès dans les paramètres du navigateur.");
    }
  };

  const stopCamera = () => {
    clearInterval(elapsedRef.current);
    stream?.getTracks().forEach(t => t.stop());
    setStream(null); setElapsed(0);
  };

  const open = () => { setIsOpen(true); setQuestions([]); setLocalText(""); accumRef.current = ""; startCamera(); };
  const close = () => {
    stopCamera();
    if (speechRef.current) { speechRef.current.stop(); setIsListening(false); setInterimText(""); }
    if (onSessionData) {
      const answeredQ = questions.filter(q=>checkedQ[q.id]).map(q=>q.text).join(". ");
      if (localText || answeredQ || photos.length) {
        onSessionData({
          transcript: localText,
          symptoms: answeredQ,
          vitals: {},
          photos: photos.map(p=>({name:p.filename,base64:p.base64,mediaType:"image/jpeg",analysis:p.analysis,analyzing:false})),
        });
      }
    }
    setIsOpen(false);
    setPhotos([]);
    setCheckedQ({});
    setLocalText("");
    setInterimText("");
    accumRef.current = "";
  };

  // ── Mute / cam off ────────────────────────────────────────────────────────
  const toggleMute = () => {
    stream?.getAudioTracks().forEach(t => t.enabled = isMuted);
    setIsMuted(m => !m);
  };

  const toggleCam = () => {
    stream?.getVideoTracks().forEach(t => t.enabled = isCamOff);
    setIsCamOff(c => !c);
  };

  const flipCamera = async () => {
    stopCamera();
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
  };

  useEffect(() => {
    if (isOpen && !stream) startCamera();
  }, [facingMode]);

  // ── Reset questions quand la modale se ferme ────────────────────────────────
  useEffect(() => {
    if (!isOpen) setQuestions([]);
  }, [isOpen]);

  // ── Questions dynamiques — se mettent à jour dès que localText change ────────
  // Déclenchement uniquement à partir de 20 caractères tapés/dictés
  useEffect(() => {
    if (localText.trim().length < 20) {
      setQuestions([]);
      return;
    }
    clearTimeout(qTimerRef.current);
    qTimerRef.current = setTimeout(async () => {
      setLoadingQ(true);
      try {
        const r = await fetch(`${API_BASE}/api/questions/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcription: localText }),
        });
        if (!r.ok) throw new Error("API KO");
        const data = await r.json();
        if (data?.questions?.length) {
          setNewQId(data.questions[0]?.id);
          setQuestions(normalizeQuestions(data.questions));
          setTimeout(() => setNewQId(null), 600);
        } else {
          throw new Error("Réponse vide");
        }
      } catch {
        // Fallback local — questions générées par détection de contexte
        setQuestions(normalizeQuestions(FALLBACK_QUESTIONS[detectContext(localText)] || FALLBACK_QUESTIONS.general));
      }
      setLoadingQ(false);
    }, 1800);
    return () => clearTimeout(qTimerRef.current);
  }, [localText]);

  // fullText reste disponible pour la transmission finale au parent
  const fullText = [transcription, localText].filter(Boolean).join(" ").trim();

  // ── Dictée vocale interne ────────────────────────────────────────────────
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    accumRef.current = localText;
    const rec = new SR();
    rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumRef.current += (accumRef.current ? " " : "") + e.results[i][0].transcript.trim();
          setLocalText(accumRef.current);
        } else { interim = e.results[i][0].transcript; }
      }
      setInterimText(interim);
    };
    rec.onend = () => { setIsListening(false); setInterimText(""); };
    rec.onerror = () => { setIsListening(false); setInterimText(""); };
    rec.start();
    speechRef.current = rec;
    setIsListening(true);
  };

  const stopListening = () => {
    speechRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  };

  // ── Capture photo ─────────────────────────────────────────────────────────
  const captureNow = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width  = video.videoWidth  || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (zoom !== 1) {
      const sw = canvas.width / zoom;
      const sh = canvas.height / zoom;
      const sx = (canvas.width - sw) / 2;
      const sy = (canvas.height - sh) / 2;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0);
    }
    // Flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    const dataUrl  = canvas.toDataURL("image/jpeg", 0.92);
    const base64   = dataUrl.split(",")[1];
    const filename = `photo_consultation_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.jpg`;

    const newPhoto = { id: Date.now(), dataUrl, base64, filename, analysis: "", analyzing: true };
    setPhotos(p => [newPhoto, ...p]);

    // Analyse IA
    analyzePhoto(newPhoto);
  };

  const captureWithTimer = () => {
    let count = 3;
    setTimer(count);
    timerRef.current = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(timerRef.current);
        setTimer(null);
        captureNow();
      } else {
        setTimer(count);
      }
    }, 1000);
  };

  const analyzePhoto = async (photo) => {
    setAnalyzing(photo.id);
    try {
      const res = await fetch(`${API_BASE}/api/analyze-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: photo.base64, media_type: "image/jpeg", filename: photo.filename }),
      });
      const text = await res.text();
      let analysis = "Analyse indisponible";
      try { analysis = JSON.parse(text).analysis || analysis; } catch {}
      setPhotos(p => p.map(ph => ph.id===photo.id ? {...ph, analysis, analyzing:false} : ph));
    } catch {
      setPhotos(p => p.map(ph => ph.id===photo.id ? {...ph, analysis:"Analyse indisponible", analyzing:false} : ph));
    }
    setAnalyzing(null);
  };

  const addToCase = (photo) => {
    onPhotoCapture?.({
      name: photo.filename,
      base64: photo.base64,
      mediaType: "image/jpeg",
      analysis: photo.analysis,
      analyzing: false,
    });
  };

  const removePhoto = (id) => setPhotos(p => p.filter(ph => ph.id !== id));

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  // ── Trigger button ────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <button onClick={open} style={{
        display:"flex",alignItems:"center",gap:8,padding:"10px 18px",
        background:"rgba(0,0,0,0.04)",border:`1px solid ${P.border}`,
        borderRadius:12,cursor:"pointer",fontFamily:"inherit",
        color:P.textSub,fontSize:13,fontWeight:500,transition:"all 0.18s",
      }}
        onMouseEnter={e=>{e.currentTarget.style.background=P.turquoiseLight;e.currentTarget.style.borderColor=P.turquoise;}}
        onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.04)";e.currentTarget.style.borderColor=P.border;}}>
        <Icon name="videocam" size={18} color={P.azur}/>
        Démarrer la consultation vidéo
      </button>
    );
  }

  // ── Modal webcam ──────────────────────────────────────────────────────────
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <style>{`
        @keyframes flashAnim{0%{opacity:0.9}100%{opacity:0}}
        @keyframes timerPop{0%{transform:scale(1.4);opacity:0}50%{opacity:1}100%{transform:scale(0.9);opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
      `}</style>

      <div style={{width:"100%",maxWidth:1100,height:"88vh",background:P.white,borderRadius:22,overflow:"hidden",boxShadow:"0 24px 80px rgba(0,0,0,0.3)",display:"flex",flexDirection:"column",animation:"fadeIn 0.25s ease-out"}}>

        {/* ── Header ── */}
        <div style={{padding:"14px 20px",background:"#111",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:stream?P.red:"#666",animation:stream?"pulse 1.5s ease-in-out infinite":"none"}}/>
            <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>Consultation vidéo</span>
            {stream && <span style={{fontSize:12,color:"#aaa",fontFamily:"monospace"}}>{formatTime(elapsed)}</span>}
            {stream && <AudioMeter stream={stream}/>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:11,color:"#666"}}>MedDiag IA</span>
            <button onClick={close} style={{background:"rgba(255,59,48,0.15)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:P.red,fontSize:12,fontWeight:600,display:"flex",alignItems:"center",gap:5,transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,59,48,0.3)"}
              onMouseLeave={e=>e.currentTarget.style.background="rgba(255,59,48,0.15)"}>
              <Icon name="call_end" size={14} color={P.red}/>Terminer
            </button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",flex:1,overflow:"hidden",minHeight:0}}>
          {/* ── Vidéo principale ── */}
          <div style={{position:"relative",background:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {error ? (
              <div style={{textAlign:"center",padding:32,color:"#888"}}>
                <Icon name="videocam_off" size={48} color="#555" style={{display:"block",margin:"0 auto 12px"}}/>
                <div style={{fontSize:14,color:"#aaa",lineHeight:1.6}}>{error}</div>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay muted playsInline style={{
                  width:"100%",height:"100%",objectFit:"cover",
                  transform:`scale(${zoom}) ${facingMode==="user"?"scaleX(-1)":""}`,
                  opacity: isCamOff ? 0.15 : 1, transition:"opacity 0.3s",
                }}/>

                {/* Flash capture */}
                {flash && <div style={{position:"absolute",inset:0,background:"white",animation:"flashAnim 0.3s ease-out",pointerEvents:"none"}}/>}

                {/* Countdown timer */}
                {timer && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                    <div style={{fontSize:120,fontWeight:800,color:"white",textShadow:"0 4px 20px rgba(0,0,0,0.5)",animation:"timerPop 1s ease-out",lineHeight:1}}>{timer}</div>
                  </div>
                )}

                {/* Grille de composition */}
                {showGrid && (
                  <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
                    {[1,2].map(i=><div key={`h${i}`} style={{position:"absolute",left:0,right:0,top:`${i*33.3}%`,borderTop:"1px solid rgba(255,255,255,0.25)"}}/>)}
                    {[1,2].map(i=><div key={`v${i}`} style={{position:"absolute",top:0,bottom:0,left:`${i*33.3}%`,borderLeft:"1px solid rgba(255,255,255,0.25)"}}/>)}
                  </div>
                )}

                {/* Cam off overlay */}
                {isCamOff && (
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.7)"}}>
                    <div style={{textAlign:"center"}}>
                      <Icon name="videocam_off" size={48} color="#666" style={{display:"block",margin:"0 auto 8px"}}/>
                      <span style={{color:"#888",fontSize:13}}>Caméra désactivée</span>
                    </div>
                  </div>
                )}

                {/* Contrôles caméra */}
                <div style={{position:"absolute",top:12,right:12,display:"flex",flexDirection:"column",gap:6}}>
                  <button onClick={()=>setShowGrid(g=>!g)} title="Grille" style={{...camBtn, background:showGrid?"rgba(117,221,211,0.3)":"rgba(0,0,0,0.5)"}}>
                    <Icon name="grid_on" size={16} color={showGrid?P.turquoise:"white"}/>
                  </button>
                  <button onClick={flipCamera} title="Retourner" style={camBtn}>
                    <Icon name="flip_camera_ios" size={16} color="white"/>
                  </button>
                </div>

                {/* Zoom slider */}
                <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <Icon name="zoom_in" size={14} color="rgba(255,255,255,0.7)"/>
                  <input type="range" min={1} max={3} step={0.1} value={zoom}
                    onChange={e=>setZoom(Number(e.target.value))}
                    style={{writingMode:"vertical-lr",direction:"rtl",width:4,height:80,accentColor:P.turquoise,cursor:"pointer"}}/>
                  <Icon name="zoom_out" size={14} color="rgba(255,255,255,0.7)"/>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace"}}>{zoom.toFixed(1)}x</span>
                </div>
              </>
            )}

            {/* ── Barre de contrôles bas ── */}
            <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"16px 20px",background:"linear-gradient(transparent,rgba(0,0,0,0.7))",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
              <CallBtn onClick={toggleMute} active={isMuted} icon={isMuted?"mic_off":"mic"} label={isMuted?"Micro coupé":"Micro"}/>
              <CallBtn onClick={toggleCam}  active={isCamOff} icon={isCamOff?"videocam_off":"videocam"} label={isCamOff?"Caméra off":"Caméra"}/>
              <div style={{width:1,height:36,background:"rgba(255,255,255,0.2)",margin:"0 4px"}}/>
              {/* Bouton capture principal */}
              <button onClick={captureNow} disabled={!stream||isCamOff} style={{
                width:58,height:58,borderRadius:"50%",background:"white",border:"3px solid rgba(255,255,255,0.4)",
                cursor:!stream||isCamOff?"not-allowed":"pointer",display:"flex",alignItems:"center",
                justifyContent:"center",transition:"all 0.15s",opacity:!stream||isCamOff?0.4:1,
                boxShadow:"0 4px 16px rgba(0,0,0,0.4)",
              }}
                onMouseEnter={e=>{ if(stream&&!isCamOff){e.currentTarget.style.transform="scale(1.08)";e.currentTarget.style.boxShadow=`0 4px 20px rgba(117,221,211,0.6)`;}}}
                onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)";e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.4)";}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:P.turquoise}}/>
              </button>
              <button onClick={captureWithTimer} disabled={!stream||isCamOff||timer!==null} style={{
                width:42,height:42,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"none",
                cursor:!stream||isCamOff||timer?"not-allowed":"pointer",display:"flex",alignItems:"center",
                justifyContent:"center",transition:"all 0.15s",opacity:!stream||isCamOff||timer?0.4:1,
              }}>
                <Icon name="timer_3" size={20} color="white"/>
              </button>
              <div style={{width:1,height:36,background:"rgba(255,255,255,0.2)",margin:"0 4px"}}/>
              <CallBtn onClick={()=>{}} active={false} icon="screen_share" label="Partager"/>
            </div>
          </div>

          {/* ── Panel latéral — Transcription + Questions + Photos ── */}
          <div style={{background:P.bg,borderLeft:`1px solid ${P.border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>

            {/* ── Zone transcription + dictée ── */}
            <div style={{borderBottom:`1px solid ${P.border}`,background:P.white,flexShrink:0}}>

              {/* Header */}
              <div style={{padding:"10px 12px 7px",display:"flex",alignItems:"center",gap:7}}>
                <Icon name="transcribe" size={14} color={P.azur}/>
                <span style={{fontSize:12,fontWeight:700,color:P.text,flex:1}}>Transcription</span>
                <button
                  onClick={isListening ? stopListening : startListening}
                  style={{
                    display:"flex",alignItems:"center",gap:5,padding:"5px 11px",
                    borderRadius:7,border:"none",fontFamily:"inherit",
                    background:isListening?"rgba(255,59,48,0.1)":"rgba(117,221,211,0.15)",
                    cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.15s",
                    color:isListening?P.red:P.turquoiseDark,
                  }}>
                  {isListening
                    ? <><div style={{width:6,height:6,borderRadius:"50%",background:P.red,animation:"pulse 0.8s infinite"}}/> Arrêter</>
                    : <><Icon name="mic" size={13} color={P.turquoiseDark}/> Dicter</>
                  }
                </button>
                {localText && (
                  <button onClick={()=>{setLocalText("");accumRef.current="";setInterimText("");}}
                    style={{padding:"4px 7px",borderRadius:6,border:`1px solid ${P.border}`,background:"none",cursor:"pointer",display:"flex",alignItems:"center",fontFamily:"inherit"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=P.red;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=P.border;}}>
                    <Icon name="close" size={11} color={P.textMuted}/>
                  </button>
                )}
              </div>

              {/* Textarea */}
              <div style={{position:"relative",padding:"0 10px 8px"}}>
                <textarea
                  value={localText + (interimText ? " " + interimText : "")}
                  onChange={e => {
                    const v = interimText && e.target.value.endsWith(interimText)
                      ? e.target.value.slice(0, -interimText.length - 1)
                      : e.target.value;
                    setLocalText(v);
                    accumRef.current = v;
                  }}
                  placeholder="Dictez ou tapez… les questions s'adapteront automatiquement."
                  style={{
                    width:"100%",boxSizing:"border-box",height:76,resize:"none",
                    background:isListening?"rgba(117,221,211,0.04)":"rgba(0,0,0,0.02)",
                    border:`1.5px solid ${isListening?P.turquoise:P.border}`,
                    borderRadius:9,padding:"8px 10px",fontSize:12,lineHeight:1.65,
                    color:P.text,fontFamily:"inherit",outline:"none",transition:"border-color 0.2s",
                  }}
                  onFocus={e=>{e.target.style.borderColor=P.turquoise;}}
                  onBlur={e=>{e.target.style.borderColor=isListening?P.turquoise:P.border;}}
                />
                {interimText && (
                  <div style={{
                    position:"absolute",bottom:15,right:17,fontSize:9,color:P.turquoiseDark,
                    fontStyle:"italic",background:"rgba(255,255,255,0.9)",padding:"2px 6px",
                    borderRadius:5,display:"flex",alignItems:"center",gap:3,boxShadow:"0 1px 3px rgba(0,0,0,0.07)",
                  }}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:P.turquoise,animation:"pulse 0.7s infinite"}}/>
                    {interimText.length>32 ? "…"+interimText.slice(-32) : interimText}
                  </div>
                )}
              </div>

              {/* Stat */}
              <div style={{padding:"0 12px 7px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:10,color:P.textMuted}}>{localText.split(" ").filter(Boolean).length} mots</span>
                {loadingQ && (
                  <span style={{fontSize:10,color:P.azur,display:"flex",alignItems:"center",gap:3,marginLeft:"auto"}}>
                    <Icon name="autorenew" size={10} style={{animation:"spin 0.8s linear infinite"}}/>
                    Questions en cours…
                  </span>
                )}
                {!loadingQ && fullText.length>30 && (
                  <span style={{fontSize:10,color:P.turquoiseDark,marginLeft:"auto",display:"flex",alignItems:"center",gap:3}}>
                    <Icon name="auto_awesome" size={10} color={P.turquoiseDark}/>
                    Questions adaptées
                  </span>
                )}
              </div>
            </div>

            {/* ── Onglets Questions / Photos ── */}
            <div style={{display:"flex",borderBottom:`1px solid ${P.border}`,background:P.white,flexShrink:0}}>
              {[
                {id:"questions",icon:"quiz",     label:"Questions",badge:Object.values(checkedQ).filter(Boolean).length||null,bc:P.turquoiseDark},
                {id:"photos",   icon:"photo_library",label:"Photos",  badge:photos.length||null,bc:P.azur},
              ].map(tab=>{
                const active = activePanel===tab.id;
                return (
                  <button key={`tab-${tab.id}`} onClick={()=>setActivePanel(tab.id)} style={{
                    flex:1,padding:"9px 6px",background:active?"white":"transparent",
                    border:"none",borderBottom:`2px solid ${active?P.turquoise:"transparent"}`,
                    cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:5,
                  }}>
                    <Icon name={tab.icon} size={13} color={active?P.turquoiseDark:P.textMuted}/>
                    <span style={{fontSize:11,fontWeight:active?700:400,color:active?P.text:P.textMuted}}>{tab.label}</span>
                    {tab.badge>0&&<span style={{fontSize:9,fontWeight:700,color:"white",background:tab.bc,padding:"1px 5px",borderRadius:7,lineHeight:1.5}}>{tab.badge}</span>}
                  </button>
                );
              })}
            </div>

            {/* ════ Onglet Questions ════ */}
            {activePanel==="questions"&&(
              <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>

                {/* Filtres catégorie */}
                {questions.length>0&&(
                  <div style={{padding:"6px 10px",borderBottom:`1px solid ${P.border}`,display:"flex",gap:4,overflowX:"auto",flexShrink:0,background:P.white}}>
                    {["all",...Array.from(new Set(questions.map(q=>q.category)))].map((cat,ci)=>(
                      <button key={`cat-${ci}-${cat}`} onClick={()=>setActiveCategory(cat)} style={{
                        padding:"2px 9px",borderRadius:10,flexShrink:0,fontFamily:"inherit",
                        background:activeCategory===cat?P.turquoise:"rgba(0,0,0,0.04)",
                        border:`1px solid ${activeCategory===cat?P.turquoiseDark:P.border}`,
                        cursor:"pointer",fontSize:10,fontWeight:activeCategory===cat?700:400,
                        color:activeCategory===cat?P.text:P.textMuted,transition:"all 0.15s",whiteSpace:"nowrap",
                      }}>
                        {cat==="all"?`Tout (${questions.length})`:cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Liste questions scrollable */}
                <div style={{flex:1,overflowY:"auto",padding:"8px 10px"}}>
                  {questions.length===0&&(
                    <div style={{textAlign:"center",padding:"28px 12px",color:P.textMuted,fontSize:11,lineHeight:1.8}}>
                      <Icon name="mic" size={26} color="rgba(0,0,0,0.08)" style={{display:"block",margin:"0 auto 8px"}}/>
                      {localText.length===0
                        ? <><strong style={{color:P.textSub}}>Démarrez la dictée</strong><br/>Les questions apparaîtront<br/>au fur et à mesure</>
                        : <>Continuez à parler…<br/>({localText.split(" ").filter(Boolean).length} mots, encore {Math.max(0,4-localText.split(" ").filter(Boolean).length)} minimum)</>
                      }
                    </div>
                  )}
                  {(activeCategory==="all"?questions:questions.filter(q=>q.category===activeCategory)).map((q,idx)=>{
                    const checked = !!checkedQ[q.id];
                    const isNew   = q.id===newQId;
                    const pColor  = {high:P.red,medium:P.orange,low:P.textMuted}[q.priority]||P.textMuted;
                    return (
                      <label key={`q-${idx}-${q.id||idx}`} style={{
                        display:"flex",alignItems:"flex-start",gap:8,
                        padding:"7px 9px",borderRadius:9,cursor:"pointer",marginBottom:4,
                        background:checked?P.turquoiseLight:"rgba(0,0,0,0.015)",
                        border:`1px solid ${checked?"rgba(117,221,211,0.45)":P.border}`,
                        transition:"all 0.12s",
                        animation:isNew?"fadeIn 0.3s ease-out":`fadeIn 0.18s ease-out ${Math.min(idx,4)*0.04}s both`,
                      }}
                        onMouseEnter={e=>{if(!checked){e.currentTarget.style.background=P.turquoiseLight;e.currentTarget.style.borderColor="rgba(117,221,211,0.3)";}}}
                        onMouseLeave={e=>{if(!checked){e.currentTarget.style.background="rgba(0,0,0,0.015)";e.currentTarget.style.borderColor=P.border;}}}>
                        <div style={{
                          width:16,height:16,borderRadius:4,flexShrink:0,marginTop:2,
                          background:checked?P.turquoise:`${pColor}14`,
                          border:`1.5px solid ${checked?P.turquoiseDark:pColor}`,
                          display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.12s",
                        }}>
                          {checked?<Icon name="check" size={10} color={P.text}/>:<span style={{fontSize:8,fontWeight:700,color:pColor}}>{q.priority==="high"?"!":q.priority==="medium"?"~":"·"}</span>}
                        </div>
                        <input type="checkbox" checked={checked}
                          onChange={e=>setCheckedQ(c=>({...c,[q.id]:e.target.checked}))}
                          style={{display:"none"}}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:11.5,lineHeight:1.55,userSelect:"none",color:checked?P.text:P.textSub,fontWeight:checked?600:400}}>{q.text}</div>
                          <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
                            <span style={{fontSize:9,color:"white",fontWeight:700,padding:"1px 6px",borderRadius:6,background:pColor}}>
                              {q.priority==="high"?"Prioritaire":q.priority==="medium"?"Moyen":"Faible"}
                            </span>
                            {q.category&&<span style={{fontSize:9,color:P.textMuted}}>{q.category}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Pied */}
                {Object.values(checkedQ).some(Boolean)&&(
                  <div style={{padding:"7px 12px",borderTop:`1px solid ${P.border}`,background:P.white,flexShrink:0,display:"flex",alignItems:"center",gap:7}}>
                    <Icon name="check_circle" size={13} color={P.turquoiseDark}/>
                    <span style={{fontSize:10,color:P.textSub,flex:1}}>
                      {Object.values(checkedQ).filter(Boolean).length} confirmé{Object.values(checkedQ).filter(Boolean).length>1?"s":""}
                    </span>
                    <button onClick={()=>setCheckedQ({})} style={{fontSize:9,color:P.textMuted,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Effacer</button>
                  </div>
                )}
              </div>
            )}

            {/* ════ Onglet Photos ════ */}
            {activePanel==="photos"&&(
              <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:10}}>
                {photos.length===0&&(
                  <div style={{textAlign:"center",padding:"36px 16px",color:P.textMuted,fontSize:12,lineHeight:1.8}}>
                    <Icon name="photo_camera" size={32} color="rgba(0,0,0,0.1)" style={{display:"block",margin:"0 auto 8px"}}/>
                    Appuyez sur le bouton blanc<br/>pour capturer une photo
                  </div>
                )}
                {photos.map((photo) => (
                  <div key={photo.id} style={{background:P.white,border:`1px solid ${P.border}`,borderRadius:12,overflow:"hidden",animation:"fadeIn 0.25s ease-out"}}>
                    <div style={{position:"relative"}}>
                      <img src={photo.dataUrl} alt="capture" style={{width:"100%",height:130,objectFit:"cover",display:"block"}}/>
                      <div style={{position:"absolute",top:6,left:6,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"2px 7px",fontSize:10,color:"white",fontFamily:"monospace"}}>
                        {new Date(photo.id).toLocaleTimeString("fr-FR")}
                      </div>
                      <button onClick={()=>removePhoto(photo.id)} style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <Icon name="close" size={12} color="white"/>
                      </button>
                    </div>
                    <div style={{padding:10}}>
                      {photo.analyzing ? (
                        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:P.textMuted}}>
                          <Icon name="autorenew" size={12} style={{animation:"spin 1s linear infinite"}}/>
                          Analyse IA en cours...
                        </div>
                      ) : (
                        <div style={{fontSize:11,color:P.textSub,lineHeight:1.6,marginBottom:8,maxHeight:60,overflow:"auto"}}>{photo.analysis||"—"}</div>
                      )}
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>addToCase(photo)} disabled={photo.analyzing} style={{
                          flex:1,padding:"6px 10px",background:photo.analyzing?"rgba(0,0,0,0.04)":P.turquoise,
                          border:"none",borderRadius:8,cursor:photo.analyzing?"not-allowed":"pointer",
                          fontSize:11,fontWeight:600,color:photo.analyzing?P.textMuted:P.text,
                          display:"flex",alignItems:"center",justifyContent:"center",gap:4,transition:"all 0.15s",
                        }}>
                          <Icon name="add_to_photos" size={12}/>Ajouter au dossier
                        </button>
                        <a href={photo.dataUrl} download={photo.filename} style={{padding:"6px 8px",background:"rgba(0,0,0,0.04)",border:"none",borderRadius:8,cursor:"pointer",fontSize:11,color:P.textMuted,display:"flex",alignItems:"center",textDecoration:"none"}}>
                          <Icon name="download" size={14} color={P.textMuted}/>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Canvas hidden pour capture */}
            <canvas ref={canvasRef} style={{display:"none"}}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bouton de contrôle d'appel ────────────────────────────────────────────
const camBtn = {
  width:32, height:32, borderRadius:8, background:"rgba(0,0,0,0.5)",
  border:"none", cursor:"pointer", display:"flex", alignItems:"center",
  justifyContent:"center", backdropFilter:"blur(4px)",
};

function CallBtn({ onClick, active, icon, label }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      title={label}
      style={{
        width:44, height:44, borderRadius:12,
        background: active ? "rgba(255,59,48,0.25)" : hov ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.12)",
        border: `1px solid ${active ? "rgba(255,59,48,0.4)" : "rgba(255,255,255,0.15)"}`,
        cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", gap:2, transition:"all 0.15s",
        transform: hov ? "translateY(-1px)" : "none",
      }}>
      <Icon name={icon} size={18} color={active?"#ff6b6b":"white"}/>
      <span style={{fontSize:9,color:active?"#ff9999":"rgba(255,255,255,0.6)",fontWeight:500}}>{label}</span>
    </button>
  );
}
