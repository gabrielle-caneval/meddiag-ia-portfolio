import json
import unittest
from unittest.mock import patch
from pipeline.educational import validate_answer, predict, resolve_citations
from pipeline import nodes
from models.schemas import PatientRawData, StructuredPatientData

class EducationalTests(unittest.IsolatedAsyncioTestCase):
    source = "Fièvre à 39 °C. Radiographie : foyer de condensation alvéolaire basal droit."
    def answer(self, **extra):
        return json.dumps({"hypotheses":[{"diagnostic":"Hypothèse respiratoire", "evidence_quotes":[self.source], **extra}]})
    def test_rejects_invented_evidence(self):
        with self.assertRaises(ValueError):
            validate_answer(self.answer(evidence_quotes=["IRM normale et absence de facteurs de risque"]),self.source)
    def test_rejects_treatment_and_percentage_fields(self):
        for key,value in [("traitement","antibiotique"),("probabilite",85)]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_answer(self.answer(**{key:value}),self.source)
    def test_rejects_empty_hypotheses(self):
        with self.assertRaises(ValueError): validate_answer('{"hypotheses":[]}',self.source)
    async def test_extraction_preserves_source_not_llm_rewrite(self):
        with patch.object(nodes,'call_llm',return_value='{"motif_consultation":"fièvre","source_text":"FAUX"}'):
            result=await nodes.extract_and_structure(PatientRawData(transcription=self.source))
        self.assertEqual(StructuredPatientData(**result).source_text,self.source)
    async def test_rejects_invalid_arbiter_even_if_analysts_valid(self):
        def llm(system,prompt,temp,tokens,model):
            return 'invalid' if model=='arbiter' else json.dumps({'hypotheses':[{'diagnostic':'Hypothèse respiratoire','evidence_ids':[1]}]})
        with self.assertRaises(ValueError):
            await predict({'structured_data':{'source_text':self.source},'step_outputs':{}},llm,'a','b','arbiter')
    async def test_three_calls_and_no_scores_or_prescriptions(self):
        calls=[]
        def llm(system,prompt,temp,tokens,model):
            calls.append(model); return json.dumps({'hypotheses':[{'diagnostic':'Hypothèse respiratoire','evidence_ids':[1]}]})
        result=await predict({'structured_data':{'source_text':self.source},'step_outputs':{}},llm,'a','b','arbiter')
        self.assertCountEqual(calls,['a','b','arbiter'])
        self.assertEqual(set(result['diagnostic']),{'educational','source_text','hypotheses'})

    def test_unknown_passage_id_fails_closed(self):
        for bad_id in [0, -1, 999, True, "1"]:
            with self.subTest(bad_id=bad_id), self.assertRaises(ValueError):
                resolve_citations(json.dumps({"hypotheses":[{"diagnostic":"Pneumonie", "evidence_ids":[bad_id]}]}),[self.source],self.source)
    def test_passage_resolution_does_not_rewrite_input(self):
        result=resolve_citations('{"hypotheses":[{"diagnostic":"Pneumonie","evidence_ids":[1]}]}',[self.source],self.source)
        self.assertEqual(result['hypotheses'][0]['evidence_quotes'],[self.source])

    def test_truncated_model_reply_is_not_forwarded(self):
        from types import SimpleNamespace
        response=SimpleNamespace(choices=[SimpleNamespace(finish_reason='length',message=SimpleNamespace(content='incomplete'))])
        client=SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs:response)))
        with patch.object(nodes,'Groq',return_value=client), self.assertRaises(ValueError):
            nodes.call_llm('test','test')
