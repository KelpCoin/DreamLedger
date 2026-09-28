import json
import tempfile
import unittest
from pathlib import Path

from economic_compute_trace import start_trace, observe_tool, finish_trace, write_trace

class EconomicComputeTraceTests(unittest.TestCase):
    def test_unknown_cost_is_not_zero(self):
        trace = start_trace("EA-1", "OP-1")
        self.assertIsNone(trace["actual_provider_cost"])
        self.assertEqual(trace["compute_cost_status"], "UNKNOWN")
        self.assertNotEqual(trace["compute_cost_status"], "ZERO")

    def test_tool_calls_accumulate(self):
        trace = start_trace()
        observe_tool(trace)
        observe_tool(trace)
        self.assertEqual(trace["tool_call_count"], 2)

    def test_failed_trace_preserved(self):
        trace = start_trace("EA-2", "OP-2")
        finish_trace(trace, "FAILED", "WORKER_RESOURCE_LIMIT", 502, "WORKER_RESOURCE_LIMIT")
        with tempfile.TemporaryDirectory() as tmp:
            path = write_trace(trace, tmp)
            data = json.loads(Path(path).read_text(encoding="utf-8"))
        self.assertEqual(data["failure_class"], "WORKER_RESOURCE_LIMIT")
        self.assertEqual(data["http_status"], 502)
        self.assertEqual(data["worker_resource_status"], "FAILED")

if __name__ == "__main__":
    unittest.main()
