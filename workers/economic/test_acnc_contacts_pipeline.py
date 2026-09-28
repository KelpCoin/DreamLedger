import os
import unittest
from unittest.mock import patch

from acnc_contacts_pipeline import (
    enrich_person,
    parse_responsible_people,
    run_acnc_contacts,
    parse_profile_contacts,
    derive_subtypes,
)

class AcncPipelineTests(unittest.TestCase):
    def test_parse_public_responsible_people(self):
        html = b"<main>Jane Citizen Role: Chairperson Associated charities John Doe Role: Treasurer Associated charities</main>"
        people = parse_responsible_people(html)
        self.assertEqual(people[0]["name"], "Jane Citizen")
        self.assertEqual(people[0]["role"], "Chairperson")
        self.assertEqual(people[1]["name"], "John Doe")
        self.assertEqual(people[1]["role"], "Treasurer")

    def test_profile_contact_parser_reads_public_charity_contacts(self):
        html = b"<main>Email: info@example.org Address For Service email: acnc@example.org Website: example.org Phone: 03 1234 5678</main>"
        parsed = parse_profile_contacts(html)
        self.assertEqual(parsed["charity_email"], "info@example.org")
        self.assertEqual(parsed["address_for_service_email"], "acnc@example.org")
        self.assertEqual(parsed["charity_phone"], "03 1234 5678")
        self.assertEqual(parsed["charity_website_public"], "example.org")

    def test_subtypes_derive_from_official_register_flags(self):
        raw = {"Advancing_Education": "Y", "Advancing_Health": "true", "PBI": "1"}
        self.assertEqual(
            derive_subtypes(raw),
            ["Public Benevolent Institution", "Advancing education", "Advancing health"],
        )

    def test_no_provider_is_explicit(self):
        with patch.dict(os.environ, {"HUNTER_API_KEY": "", "APOLLO_API_KEY": ""}, clear=False):
            result = enrich_person({"name": "Jane Citizen", "role": "Chairperson"}, "example.org")
            self.assertEqual(result["contact_status"], "ENRICHMENT_PROVIDER_NOT_CONFIGURED")
            self.assertEqual(result["decision_maker_email"], "")
            self.assertEqual(result["decision_maker_phone"], "")

    def test_pipeline_never_fabricates_missing_people(self):
        def fake_fetch(url, method="GET", body=None, headers=None):
            if "datastore_search" in url:
                body = b'{"result":{"records":[{"ABN":"123","Charity_Legal_Name":"Example Charity","State":"WA","Website":"https://example.org","ACNC_Entity_ID":"abc"}]}}'
                return 200, "application/json", body
            return 200, "text/html", b"<main>Example Charity</main>"

        with patch("acnc_contacts_pipeline._request", side_effect=fake_fetch):
            with patch.dict(os.environ, {"HUNTER_API_KEY": "", "APOLLO_API_KEY": ""}, clear=False):
                with self.assertRaisesRegex(RuntimeError, "ACNC_ENRICHMENT_PROVIDER_REQUIRED"):
                    run_acnc_contacts({"states": ["WA"], "limit": 1})

if __name__ == "__main__":
    unittest.main()
