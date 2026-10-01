from .closed_loop import HumanizerLoop, HumanizerPolicy
from .patterns import PATTERNS
from .review import analyze
from .scorecard import build_scorecard
from .transform import refine

def test_catalog_has_39_patterns():
    assert len(PATTERNS) == 39

def test_borrowed_authority_is_flagged_not_rewritten():
    source = "Experts agree this is the best solution."
    result = HumanizerLoop().run(source)
    assert "Experts agree" in result.output_text
    assert result.scorecard.semantic_risk is True
    assert result.scorecard.disposition == "REVIEW_REQUIRED"
    assert result.authoritative is False

def test_safe_refinement_does_not_create_authority():
    source = "This is useful — in practice."
    result = HumanizerLoop().run(source)
    assert "Experts agree" not in result.output_text
    assert "We have seen" not in result.output_text
    assert result.scorecard.truth_preservation == "PRESERVED_SAFE_TRANSFORMS_ONLY"

def test_production_gate_is_false():
    result = HumanizerLoop(HumanizerPolicy(production_gate=False)).run("Plain text.")
    assert result.as_dict()["production_gate"] is False

def test_low_density_is_not_claimed_human():
    result = HumanizerLoop().run("Plain text with ordinary wording.")
    assert result.scorecard.calibration == "UNCALIBRATED"
    assert result.scorecard.disposition == "PASS_REVIEW_SIGNAL"

def test_semantic_risk_survives_recheck():
    first = analyze("Industry reports suggest this will transform the market.")
    refined = refine("Industry reports suggest this will transform the market.")
    second = analyze(refined.text)
    assert first.semantic_risk is True
    assert second.semantic_risk is True
