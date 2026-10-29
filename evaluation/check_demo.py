"""Check replay integrity, not medical correctness. Never print provider credentials."""
import argparse
import hashlib
import json
import re
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.educational import resolve_citations

parser=argparse.ArgumentParser()
parser.add_argument('run',type=Path)
parser.add_argument('--manifest',type=Path)
args=parser.parse_args()
run=json.loads(args.run.read_text())
assert len(run['results']) == 1, 'A demonstration must contain one case, not benchmark results'
case=run['results'][0]
assert case['status']=='completed'
source=case['input']['transcription']
result=case['pipeline_response']['diagnostic']
assert result['educational'] is True and result['source_text']==source
assert len(case['calls'])==7 and all(c['finish_reason']=='stop' for c in case['calls'])
resolved=resolve_citations(case['calls'][-1]['content'],re.split(r'(?<=[.!?])\s+',source.strip()),source)
for rank,h in enumerate(resolved['hypotheses'],1): h['rang']=rank
assert result['hypotheses']==resolved['hypotheses'], 'Displayed result must match the model output and source mapping'
assert set(result)=={'educational','source_text','hypotheses'}
manifest={'scope':'Single guided fictional demonstration, not a clinical evaluation or benchmark',
          'recorded_at':run['started_at'], 'source_run_sha256':hashlib.sha256(args.run.read_bytes()).hexdigest(),
          'models_returned':[c['returned_model'] for c in case['calls']],
          'source_text':source,'displayed_result':result,
          'verification':'Schema, source passage integrity and replay identity checked; medical validity not established',
          'code_sha256':{str(p.relative_to(Path(__file__).resolve().parents[1])):hashlib.sha256(p.read_bytes()).hexdigest() for p in [Path(__file__).resolve().parents[1]/'pipeline/educational.py',Path(__file__).resolve().parents[1]/'pipeline/nodes.py']}}
if args.manifest: args.manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('PASS: completed real run, original source, seven completed calls, identical resolved final output; no clinical certification')
print(json.dumps(result,ensure_ascii=False,indent=2))
