import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).with_name('evaluate.py')
spec = importlib.util.spec_from_file_location('adlc_eval', MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ADLCEvaluationTests(unittest.TestCase):
    def test_accuracy_and_per_field_metrics(self):
        examples = [{'id': 'a', 'expected': {'label': 'BUYING', 'urgency': 'high'}}, {'id': 'b', 'expected': {'label': 'NONE', 'urgency': 'low'}}]
        predictions = [{'id': 'a', 'prediction': {'label': 'BUYING', 'urgency': 'high'}}, {'id': 'b', 'prediction': {'label': 'NONE', 'urgency': 'high'}}]
        report = module.evaluate(examples, predictions)
        self.assertEqual(report['examples'], 2)
        self.assertEqual(report['scored_fields'], 4)
        self.assertEqual(report['accuracy'], 0.75)
        self.assertTrue(report['test_data_is_not_demand'])
        self.assertFalse(report['revenue_claim'])
        self.assertIn('urgency|low->high', report['mismatches'])

    def test_missing_predictions_are_counted_wrong(self):
        report = module.evaluate([{'id': 'x', 'expected': {'label': 'BUYING'}}], [])
        self.assertEqual(report['accuracy'], 0.0)

if __name__ == '__main__':
    unittest.main()
