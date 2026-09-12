"""Registered adversarial belt modules."""
from .B01_evidence_grounding import Module as B01
from .B02_source_resolvability import Module as B02
from .B03_freshness import Module as B03
from .B04_scope_integrity import Module as B04
from .B05_price_integrity import Module as B05
from .B06_buyer_identity import Module as B06
from .B07_approval_boundary import Module as B07
from .B08_identity_binding import Module as B08
from .B09_attestation_isolation import Module as B09
from .B10_injection_resistance import Module as B10
from .B11_provider_marker import Module as B11
from .B12_contradiction import Module as B12
_INSTANCES=[B01(),B02(),B03(),B04(),B05(),B06(),B07(),B08(),B09(),B10(),B11(),B12()]
REGISTRY={m.MODULE_ID:m for m in _INSTANCES}
MODULE_ORDER=list(REGISTRY)
