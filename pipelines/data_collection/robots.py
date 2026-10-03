from __future__ import annotations
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from urllib.request import Request, urlopen

@dataclass(frozen=True)
class RobotsDecision:
    robots_url: str
    checked: bool
    allowed: bool | None
    error: str | None = None

def check_robots(url: str, user_agent: str) -> RobotsDecision:
    parsed=urlparse(url)
    robots_url=urljoin(f"{parsed.scheme}://{parsed.netloc}", "/robots.txt")
    try:
        req=Request(robots_url,headers={"User-Agent":user_agent},method="GET")
        with urlopen(req,timeout=15) as response:
            text=response.read().decode("utf-8","replace")
        rp=RobotFileParser()
        rp.set_url(robots_url); rp.parse(text.splitlines())
        return RobotsDecision(robots_url,True,rp.can_fetch(user_agent,url))
    except Exception as exc:
        return RobotsDecision(robots_url,False,None,str(exc))
