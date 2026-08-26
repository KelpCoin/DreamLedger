from dataclasses import dataclass, asdict, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

@dataclass
class Wanted:
    wanted_id: str
    raw_text: str
    brand: List[str] = field(default_factory=list)
    category: List[str] = field(default_factory=list)
    sizes: List[str] = field(default_factory=list)
    colours: List[str] = field(default_factory=list)
    era: List[str] = field(default_factory=list)
    max_price_nzd: Optional[Decimal] = None
    destination_country: str = "NZ"

    def to_dict(self) -> Dict[str, Any]:
        value = asdict(self)
        if self.max_price_nzd is not None:
            value["max_price_nzd"] = str(self.max_price_nzd)
        return value

@dataclass
class Candidate:
    item_id: str
    item_url: str
    title: str
    item_price: Optional[Decimal] = None
    item_currency: Optional[str] = None
    shipping_price: Optional[Decimal] = None
    shipping_currency: Optional[str] = None
    condition: Optional[str] = None
    seller: Dict[str, Any] = field(default_factory=dict)
    raw: Dict[str, Any] = field(default_factory=dict)
    scores: Dict[str, float] = field(default_factory=dict)
    total_score: float = 0.0
    verdict: str = "WEAK"

    def to_dict(self) -> Dict[str, Any]:
        value = asdict(self)
        for key in ("item_price", "shipping_price"):
            if value[key] is not None:
                value[key] = str(value[key])
        return value
