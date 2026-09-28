from __future__ import annotations
import time
from dataclasses import dataclass

@dataclass
class RateLimiter:
    requests_per_second: float = 1.0
    _next_allowed: float = 0.0

    def wait(self) -> None:
        now=time.monotonic()
        delay=max(0.0,self._next_allowed-now)
        if delay: time.sleep(delay)
        self._next_allowed=time.monotonic()+(1.0/self.requests_per_second)
