"""Restricted educational output; quote matching is not clinical validation."""
import asyncio
import json
import re
from pydantic import BaseModel, ConfigDict, Field

class EducationalHypothesis(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    diagnostic: str = Field(min_length=3, max_length=140)
    evidence_quotes: list[str] = Field(min_length=1, max_length=5)

class EducationalAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    hypotheses: list[EducationalHypothesis] = Field(min_length=1, max_length=3)


def validate_answer(raw, source):
    answer = EducationalAnswer.model_validate_json(raw)
    for hypothesis in answer.hypotheses:
        for quote in hypothesis.evidence_quotes:
            if len(quote.strip()) < 12 or quote not in source:
                raise ValueError("Evidence must be a verbatim passage from the original input")
    return answer.model_dump()


class CitedHypothesis(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    diagnostic: str = Field(min_length=3, max_length=140)
    evidence_ids: list[int] = Field(min_length=1, max_length=5)

class CitedAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    hypotheses: list[CitedHypothesis] = Field(min_length=1, max_length=1)

def resolve_citations(raw, passages, source):
    answer = CitedAnswer.model_validate_json(raw)
    hypotheses = []
    for hypothesis in answer.hypotheses:
        if any(i < 1 or i > len(passages) for i in hypothesis.evidence_ids):
            raise ValueError("Unknown source passage")
        hypotheses.append({"diagnostic":hypothesis.diagnostic,
                           "evidence_quotes":[passages[i-1] for i in dict.fromkeys(hypothesis.evidence_ids)]})
    return validate_answer(json.dumps({"hypotheses":hypotheses}), source)


async def predict(state, call_llm, model_a, model_b, model_c):
    source = state["structured_data"].get("source_text", "")
    if not source.strip():
        raise ValueError("Original source text is required in educational mode")
    passages = re.split(r"(?<=[.!?])\s+", source.strip())
    numbered = "\n".join(f"[{i}] {text}" for i,text in enumerate(passages,1))
    system = """Prototype pédagogique sur données fictives. Propose des hypothèses à examiner,
jamais un diagnostic confirmé. Sélectionne uniquement les identifiants des passages SOURCE qui étayent l’hypothèse. Ne crée pas de citations ni d’identifiants. N'ajoute aucun fait, aucune exclusion de diagnostic,
aucun traitement, score, pourcentage ou conseil médical. Réponds uniquement en JSON :
{"hypotheses":[{"diagnostic":"nom court de l'hypothèse","evidence_ids":[1,2]}]}
Une seule hypothèse principale : ce parcours ne produit pas un différentiel exhaustif. Une étiologie reste une hypothèse.
Aucun autre champ. L'accord entre modèles ne démontre pas la justesse."""
    prompt = "SOURCE :\n" + numbered + "\nPRÉPARATION NON VÉRIFIÉE :\n" + state["step_outputs"].get("step_3", "")
    raw_a, raw_b = await asyncio.gather(
        asyncio.to_thread(call_llm, system, prompt, 0.1, 2000, model_a),
        asyncio.to_thread(call_llm, system, prompt, 0.1, 2000, model_b),
    )
    a, b = resolve_citations(raw_a, passages, source), resolve_citations(raw_b, passages, source)
    final_prompt = "SOURCE :\n" + numbered + "\nDeux propositions non validées :\n" + json.dumps([a,b], ensure_ascii=False) + "\nChoisis les hypothèses les mieux étayées. Respecte le même schéma JSON."
    raw_c = await asyncio.to_thread(call_llm, system, final_prompt, 0.1, 2000, model_c)
    final = resolve_citations(raw_c, passages, source)
    final.update(educational=True, source_text=source)
    for rank, hypothesis in enumerate(final["hypotheses"], 1):
        hypothesis["rang"] = rank
    detail = {"ia_a":{"model":model_a,"raw":raw_a},"ia_b":{"model":model_b,"raw":raw_b},"ia_c":{"model":model_c,"raw":raw_c}}
    return {**state, "current_step":4, "diagnostic":final, "prompt_final":prompt,
            "step_outputs":{**state["step_outputs"],"step_4":raw_c,"step_4_detail":json.dumps(detail,ensure_ascii=False)}}
