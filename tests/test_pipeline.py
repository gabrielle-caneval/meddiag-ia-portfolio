import unittest
from unittest.mock import patch
from pipeline import nodes
from pipeline.graph import build_pipeline_graph

class PipelineTests(unittest.IsolatedAsyncioTestCase):
    async def test_graph_retains_context_and_final_prompt(self):
        async def identity(state):
            self.assertEqual(state['image_analysis'], 'image fictive')
            self.assertEqual(state['patient_address'], 'lieu fictif')
            return {**state, 'prompt_final': 'prompt pédagogique'}
        with patch('pipeline.graph.initialization_node', identity), patch('pipeline.graph.generation_node', identity), patch('pipeline.graph.evaluation_node', identity), patch('pipeline.graph.predictive_node', identity):
            result = await build_pipeline_graph().ainvoke({'structured_data':{}, 'image_analysis':'image fictive','patient_address':'lieu fictif','step_outputs':{},'current_step':0,'diagnostic':None,'prompt_final':None})
        self.assertEqual(result['prompt_final'], 'prompt pédagogique')

    async def test_invalid_arbitration_does_not_invent_result(self):
        state = {'structured_data':{},'step_outputs':{'step_3':'test'},'current_step':3}
        with patch.object(nodes, 'call_llm', return_value='invalid JSON'):
            with self.assertRaises(ValueError):
                await nodes.predictive_node(state)

if __name__ == '__main__': unittest.main()
