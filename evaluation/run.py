"""Run the actual extraction and LangGraph pipeline on fixed synthetic cases."""
import argparse, asyncio, hashlib, json, os, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repo', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--dry-run', action='store_true')
args = parser.parse_args()
cases_path = Path(__file__).with_name('cases.json')
cases = json.loads(cases_path.read_text())
assert len({c['id'] for c in cases}) == len(cases)
assert all(c['expected'].lower() not in c['input']['transcription'].lower() for c in cases)
if args.dry_run:
    print(f'{len(cases)} cases validated; no model calls.'); sys.exit(0)
from dotenv import load_dotenv
load_dotenv(args.repo / '.env')
if not os.environ.get('GROQ_API_KEY'):
    sys.exit('GROQ_API_KEY missing. No evaluation performed; no score produced.')
if args.output.exists():
    sys.exit('Output already exists. Use a new filename to preserve all runs.')
sys.path.insert(0, str(args.repo.resolve()))
from pipeline import nodes
from pipeline.graph import build_pipeline_graph
from models.schemas import PatientRawData
original_client = nodes.Groq
calls = []
def traced_client(*a, **kw):
    client = original_client(*a, **kw, timeout=30.0, max_retries=0)
    create = client.chat.completions.create
    def record(**request):
        response = create(**request)
        calls.append({'requested_model': request['model'], 'returned_model': response.model,
                      'temperature': request.get('temperature'), 'max_tokens': request.get('max_tokens'),
                      'usage': response.usage.model_dump() if response.usage else None})
        return response
    client.chat.completions.create = record
    return client
nodes.Groq = traced_client
report = {'started_at': datetime.now(timezone.utc).isoformat(),
          'commit': subprocess.check_output(['git', '-C', str(args.repo), 'rev-parse', 'HEAD'], text=True).strip(),
          'working_diff_sha256': hashlib.sha256(subprocess.check_output(['git', '-C', str(args.repo), 'diff'])).hexdigest(),
          'configured_models': {'prep': nodes.PREP_MODEL, 'analysis_a': nodes.TEXT_MODEL, 'analysis_b': nodes.MODEL_B, 'arbiter': nodes.MODEL_ARBITER},
          'cases_sha256': hashlib.sha256(cases_path.read_bytes()).hexdigest(),
          'protocol': '8 fixed synthetic cases; actual extraction + full graph; one attempt per case; no diagnosis labels sent to models; no model judge; all failures retained.',
          'results': []}
args.output.parent.mkdir(parents=True, exist_ok=True)
def save():
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
async def run():
    for case in cases:
        calls.clear(); start=time.monotonic()
        item={'id':case['id'], 'expected':case['expected'], 'input':case['input']}
        try:
            structured=await nodes.extract_and_structure(PatientRawData(**case['input']))
            item['structured']=structured
            state={'structured_data':structured,'image_analysis':'','patient_address':'',
                   'step_outputs':{},'current_step':0,'diagnostic':None,'prompt_final':None}
            result=await build_pipeline_graph().ainvoke(state)
            item['pipeline_response']=result
            item['status']='completed'
        except Exception as error:
            item['status']='failed'
            # Never serialize provider exceptions (may contain request or credential details).
            item['error_type']=type(error).__name__
        item['seconds']=round(time.monotonic()-start,2)
        item['calls']=list(calls)
        report['results'].append(item); save()
        print(case['id'], item['status'], flush=True)
    report['finished_at']=datetime.now(timezone.utc).isoformat();save()
asyncio.run(run())
