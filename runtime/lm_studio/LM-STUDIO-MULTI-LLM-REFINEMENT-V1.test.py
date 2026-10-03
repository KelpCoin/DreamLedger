import importlib.util, os, unittest

SPEC=importlib.util.spec_from_file_location("refinement","LM-STUDIO-MULTI-LLM-REFINEMENT-V1.py")

class ThreeModelContractTests(unittest.TestCase):
    def setUp(self):
        self.mod=importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(self.mod)
        for key in ("DREAMLEDGER_CREATOR_MODEL","DREAMLEDGER_CRITIC_MODEL","DREAMLEDGER_SYNTHESIS_MODEL","DREAMLEDGER_VISION_MODEL","DREAMLEDGER_BUILDER_MODEL","DREAMLEDGER_SCOUT_MODEL","DREAMLEDGER_GAUNTLET_MODEL"):
            os.environ.pop(key,None)

    def test_requires_three_distinct_models(self):
        os.environ["DREAMLEDGER_CREATOR_MODEL"]="creator"
        os.environ["DREAMLEDGER_CRITIC_MODEL"]="vision"
        os.environ["DREAMLEDGER_SYNTHESIS_MODEL"]="vision"
        with self.assertRaisesRegex(RuntimeError,"MINIMUM_THREE_DISTINCT_MODELS_REQUIRED"):
            self.mod.assign_models(["creator","vision"])

    def test_accepts_three_distinct_models_and_designates_vision(self):
        os.environ["DREAMLEDGER_CREATOR_MODEL"]="creator"
        os.environ["DREAMLEDGER_CRITIC_MODEL"]="vision"
        os.environ["DREAMLEDGER_SYNTHESIS_MODEL"]="synth"
        os.environ["DREAMLEDGER_VISION_MODEL"]="vision"
        assignments,vision=self.mod.assign_models(["creator","vision","synth"])
        self.assertEqual(len(set(assignments.values())),3)
        self.assertEqual(vision,"vision")

    def test_vision_model_must_be_one_of_three(self):
        os.environ["DREAMLEDGER_CREATOR_MODEL"]="creator"
        os.environ["DREAMLEDGER_CRITIC_MODEL"]="critic"
        os.environ["DREAMLEDGER_SYNTHESIS_MODEL"]="synth"
        os.environ["DREAMLEDGER_VISION_MODEL"]="fourth"
        with self.assertRaisesRegex(RuntimeError,"VISION_MODEL_MUST_BE_ONE_OF_THREE"):
            self.mod.assign_models(["creator","critic","synth"])

if __name__=="__main__":
    unittest.main()
