// Records the actual local interface. All API responses are explicit fixtures.
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs/promises');
const baseURL = process.env.DEMO_URL || 'http://127.0.0.1:5180';
if (!['127.0.0.1','localhost'].includes(new URL(baseURL).hostname)) throw new Error('Local recording only');
const out = path.resolve(__dirname, '../docs/media');
const structured = {motif_consultation:'Cas fictif pour démonstration de l’interface',symptomes_principaux:['Symptôme pédagogique A','Symptôme pédagogique B'],constantes_vitales:{},antecedents:'Aucun antécédent réel : scénario entièrement fictif.',symptomes_confirmes:[],urgence_estimee:'faible',contexte_clinique:'Données de démonstration. Ne pas utiliser en pratique clinique.',score_gravite:0};
const diagnostic = {hypotheses:[{rang:1,diagnostic:'Hypothèse pédagogique A',probabilite:0,justification:'Sortie simulée pour montrer la présentation des résultats. Aucune conclusion médicale.',examens:[]},{rang:2,diagnostic:'Hypothèse pédagogique B',probabilite:0,justification:'Deuxième sortie fictive. Les valeurs affichées ne sont pas des mesures cliniques.',examens:[]}],urgence:'faible',score_confiance:0,conduite:{niveau:'maison',raison:'Scénario d’interface uniquement. Aucune orientation médicale réelle.',instructions_immediates:['Lire et vérifier les informations du cas fictif.'],conseils_maison:[],actes_labo:[],diagnostics_a_eliminer:[],traitement_suggere:''},raisonnement_explicite:'Deux analyses parallèles puis un arbitre dans l’architecture du projet. Les réponses de cet enregistrement sont simulées.',consensus:{accord_ia:'partiel',point_accord:'Données simulées identiques pour les deux analyses.',point_divergence:'Deux hypothèses pédagogiques distinctes.',arbitrage:'Exemple de synthèse affichée dans l’interface.',avis_ia_a:{diagnostic_principal:'Hypothèse pédagogique A',probabilite:0,specificite:'Réponse simulée A'},avis_ia_b:{diagnostic_principal:'Hypothèse pédagogique B',probabilite:0,specificite:'Réponse simulée B'}}};
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:out,size:{width:1440,height:1000}},locale:'fr-FR'});
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());let response={};
  if(url.pathname==='/api/extract')response=structured;
  else if(url.pathname==='/api/questions/generate')response={questions:[]};
  else if(url.pathname==='/api/pipeline/run'){await new Promise(r=>setTimeout(r,6500));response={diagnostic,prompt_final:'Démonstration : aucun appel à un modèle réel.'};}
  else throw new Error('Unexpected API route: '+url.pathname);
  await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'POST, OPTIONS'},body:JSON.stringify(response)});
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const hold=ms=>page.waitForTimeout(ms);
 const caption=async(title,detail)=>{await page.evaluate(({title,detail})=>{
  let el=document.getElementById('demo-caption');if(!el){el=document.createElement('aside');el.id='demo-caption';document.body.append(el);}
  Object.assign(el.style,{position:'fixed',bottom:'0',left:'0',right:'0',zIndex:'2147483647',background:'#102e33',color:'#fff',padding:'18px 42px',fontFamily:'Arial,sans-serif',borderTop:'3px solid #75ddd3',pointerEvents:'none'});
  el.replaceChildren();const strong=document.createElement('div');strong.style.cssText='font-size:23px;font-weight:600;margin-bottom:7px';strong.textContent=title;const sub=document.createElement('div');sub.style.cssText='font-size:16px;color:#c8ded8';sub.textContent=detail;const badge=document.createElement('div');badge.style.cssText='font-size:12px;letter-spacing:1px;color:#f5d68d;margin-top:10px';badge.textContent='INTERFACE RÉELLE • DONNÉES FICTIVES • RÉPONSES IA SIMULÉES';el.append(strong,sub,badge);
  document.body.style.paddingBottom='150px';
 },{title,detail});};
 try{
 await page.goto(baseURL,{waitUntil:'networkidle',timeout:60000});
 await caption('MedDiag IA | Gabrielle Caneval','Prototype académique : de la collecte à la validation dans l’interface.');await hold(4500);
 await page.getByPlaceholder('Prénom Nom',{exact:true}).fill('Camille Démonstration');
 await page.getByPlaceholder('Urgences, Cardiologie, CHU...').fill('Service pédagogique');
 await page.getByRole('button',{name:/Commencer la collecte/}).click();
 await caption('01 | Collecter les informations','L’interface rassemble la description du cas et les informations à vérifier.');
 await page.locator('textarea').first().fill('CAS FICTIF. Démonstration du parcours logiciel avec deux symptômes pédagogiques A et B. Aucune donnée patient, aucun diagnostic réel.');
 await hold(4500);await page.getByRole('button',{name:/^Continuer/}).click();
 await caption('02 | Vérifier la structuration','Les informations sont présentées avant le lancement du pipeline.');await hold(5000);
 await page.screenshot({path:path.join(out,'meddiag-structure.png')});
 await page.getByRole('button',{name:/Lancer l’analyse|Lancer l'analyse/}).click();
 await caption('03 | Orchestrer plusieurs analyses','Architecture : préparation LangGraph, deux analyses parallèles, puis un arbitre.');
 await page.getByRole('button',{name:/Analyser maintenant/}).click();
 await page.getByRole('heading',{name:'Résultats diagnostiques'}).waitFor({timeout:20000});
 await caption('04 | Lire les sorties','Les hypothèses affichées ici sont simulées. Les scores ne sont pas des probabilités validées.');
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'smooth'}));await hold(5500);
 await page.screenshot({path:path.join(out,'meddiag-results.png')});
 await page.getByRole('button',{name:/Transmettre au médecin/}).click();
 await caption('05 | Passer à la revue humaine','La transmission et le changement de rôle sont locaux à cette interface.');await hold(4000);
 await page.getByTitle('Se déconnecter').click();
 await page.getByText('Médecin',{exact:true}).click();
 await page.getByPlaceholder('Prénom Nom',{exact:true}).fill('Alex Démonstration');
 await page.getByPlaceholder('Urgences, Cardiologie, CHU...').fill('Revue pédagogique');
 await page.getByRole('button',{name:/Commencer la collecte/}).click();
 await page.getByText('Interface Médecin',{exact:true}).waitFor();
 await caption('06 | Examiner le dossier','Le rôle médecin relit et valide le cas. Ce prototype n’impose pas d’autorisation côté serveur.');await hold(5000);
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
 console.log('VERIFIED: collection, structuring, simulated pipeline, local handoff, doctor validation');
 }catch(e){await page.screenshot({path:path.join(out,'recording-error.png')});throw e;}
 finally{await context.close();await browser.close();}
 console.log('VIDEO',await page.video().path());
})().catch(e=>{console.error(e);process.exitCode=1});
