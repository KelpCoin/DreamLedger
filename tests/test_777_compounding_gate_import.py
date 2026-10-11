import ast
import unittest
from pathlib import Path


class CompoundingGateRegressionTests(unittest.TestCase):
    def test_os_is_imported_for_current_run_noop_receipt(self):
        source = Path("scripts/777_compounding_gate.py").read_text(encoding="utf-8")
        tree = ast.parse(source)
        imported_os = any(
            isinstance(node, ast.Import) and any(alias.name == "os" for alias in node.names)
            for node in tree.body
        )
        self.assertTrue(imported_os, "777 compounding gate must import os before reading GITHUB_RUN_ID")

        uses_environment = any(
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Attribute)
            and node.func.value.attr == "environ"
            and isinstance(node.func.value.value, ast.Name)
            and node.func.value.id == "os"
            for node in ast.walk(tree)
        )
        self.assertTrue(uses_environment, "No-op receipt must be tied to the current GitHub run")


if __name__ == "__main__":
    unittest.main()
