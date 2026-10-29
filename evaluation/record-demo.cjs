// Records the local interface using unmodified responses from an actual evaluation run.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const baseURL = process.env.DEMO_URL || 'http://127.0.0.1:5180';
if (!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local recording only');
const out = path.resolve(__dirname, 'recording');
if (!process.env.EVAL_RUN) throw new Error('EVAL_RUN must reference an actual completed evaluation');
const run = JSON.parse(require('node:fs').readFileSync(process.env.EVAL_RUN, 'utf8'));
const sample = run.results.find(r => r.id === 'case-01');
if (!sample || sample.status !== 'completed' || !sample.calls?.length) throw new Error('Case 01 has no completed real model run');
const structured = sample.structured;
const diagnostic = sample.pipeline_response.diagnostic;
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}},locale:'fr-FR'});
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());let response={};
  if(url.pathname==='/api/extract')response=structured;
  else if(url.pathname==='/api/questions/generate')response={questions:[]};
  else if(url.pathname==='/api/pipeline/run'){await new Promise(r=>setTimeout(r,6500));response=sample.pipeline_response;}
  else throw new Error('Unexpected API route: '+url.pathname);
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS'},body:JSON.stringify(response)});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const hold=ms=>page.waitForTimeout(ms);
 const caption=async(title,detail)=>{await page.evaluate(({title,detail})=>{
  let el=document.getElementById('demo-caption');if(!el){el=document.createElement('aside');el.id='demo-caption';document.body.append(el);}
  Object.assign(el.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'2147483647',background:'#102e33',color:'#fff',padding:'18px 42px',fontFamily:'Arial,sans-serif',borderTop:'3px solid #75ddd3',pointerEvents:'none'});
  el.replaceChildren();const strong=document.createElement('div');strong.style.cssText='font-size:23px;font-weight:600;margin-bottom:7px';strong.textContent=title;const sub=document.createElement('div');sub.style.cssText='font-size:16px;color:#c8ded8';sub.textContent=detail;const badge=document.createElement('div');badge.style.cssText='font-size:12px;letter-spacing:1px;color:#f5d68d;margin-top:10px';badge.textContent='INTERFACE RÉELLE • DONNÉES FICTIVES • RÉPONSES IA ENREGISTRÉES, REJOUÉES';el.append(strong,sub,badge);
  document.body.style.paddingBottom='150px';
 },{title,detail});};
 try{
 await page.goto(baseURL,{waitUntil:'networkidle',timeout:60000});
 await caption('MedDiag IA | Caneval Gabrielle','Prototype académique : de la collecte à la validation dans l’interface.');await hold(4500);
 await page.getByPlaceholder('Prénom Nom',{exact:true}).fill('Caneval Gabrielle');
 await page.getByPlaceholder('Urgences, Cardiologie, CHU...').fill('Service pédagogique');
 await page.getByRole('button',{name:/Commencer la collecte/}).click();
 await caption('01 | Collecter les informations','L’interface rassemble la description du cas et les informations à vérifier.');
 await page.getByPlaceholder('Nom Prénom', {exact:true}).fill('Patient fictif 01');
 await page.locator('textarea').first().fill(sample.input.transcription);
 await hold(4500);await page.getByRole('button',{name:/^Continuer/}).click();
 await caption('02 | Vérifier la structuration','Les informations sont présentées avant le lancement du pipeline.');await hold(5000);
 await page.screenshot({path:path.join(out,'meddiag-structure.png')});
 await page.getByRole('button',{name:/Lancer l’analyse|Lancer l'analyse/}).click();
 await caption('03 | Orchestrer plusieurs analyses','Architecture : préparation LangGraph, deux analyses parallèles, puis un arbitre.');
 await page.getByRole('button',{name:/Analyser maintenant/}).click();
 await page.getByRole('heading',{name:'Résultats diagnostiques'}).waitFor({timeout:20000});
 await caption('04 | Lire les sorties','Cas fictif de pneumonie : lire l’hypothèse, sa justification et les éléments à vérifier. Scores non calibrés.');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await hold(5500);
 await page.screenshot({path:path.join(out,'meddiag-results.png')});
 await page.getByRole('button',{name:/Transmettre au médecin/}).click();
 await caption('05 | Passer à la revue humaine','La transmission et le changement de rôle sont locaux à cette interface.');await hold(4000);
 await page.getByTitle('Se déconnecter').click();
 await page.getByText('Médecin',{exact:true}).click();
 await page.getByPlaceholder('Prénom Nom',{exact:true}).fill('Revue Démonstration');
 await page.getByPlaceholder('Urgences, Cardiologie, CHU...').fill('Revue pédagogique');
 await page.getByRole('button',{name:/Commencer la collecte/}).click();
 await page.getByText('Interface Médecin',{exact:true}).waitFor();
 await caption('06 | Examiner le dossier','Démonstration du rôle de revue : ce changement de rôle ne constitue pas une authentification serveur.');await hold(5000);
 await page.screenshot({path:path.join(out,'meddiag-doctor.png')});
 await page.getByRole('checkbox',{name:/Je confirme le diagnostic IA/}).check();
 await page.getByPlaceholder(/Dr Nom Prénom/).fill('Validation fictive');
 await caption('07 | Valider dans l’interface','Confirmation manuelle du cas fictif. Aucun acte médical, aucune prescription réelle.');
 await page.getByRole('button',{name:/Valider le diagnostic seul/}).click();
 await page.getByText(/Diagnostic validé/).first().waitFor();
 await page.getByText(/Diagnostic validé/).first().evaluate(el=>el.scrollIntoView({block:'center',behavior:'smooth'}));
 await hold(5500);
 await page.screenshot({path:path.join(out,'meddiag-validation.png')});
 await caption('MedDiag IA | Python · FastAPI · LangGraph · Next.js','Un prototype d’orchestration multi-modèle, avec une étape de revue humaine dans l’interface.');
 await hold(4500);
 if(errors.length)throw new Error('Browser errors: '+JSON.stringify(errors));
 console.log('VERIFIED: interface replay of recorded model responses, local handoff and simulated human review');
 }catch(e){await page.screenshot({path:path.join(out,'recording-error.png')});throw e;}
 finally{await context.close();await browser.close();}
 console.log('VIDEO',await page.video().path());
})().catch(e=>{console.error(e);process.exitCode=1});
