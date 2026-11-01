# Phone catalogue correction

Owner: Codex. Parent: MTG master silo. Scope: shared public catalogue shell, homepage, gateway, MTG landing and task routes, copy and cloud Website Gauntlet.

Acceptance: three card-back auction slots on one row at 360px; no fabricated auctions; swipeable keyboard-accessible catalogue and CTA cards; shared self-hosted fonts and lime/dark tokens; working search, filters, list comparison, odds, basic spread and trade-post tools. Existing held payments remain held. Humanizer reviews all MTG routes and shared entry copy. Cloud browser tests cover 360, 390, 768 and 1280 pixels, with screenshots. No additional services or paid infrastructure.

Reference patterns: Moxfield search and deck discovery, TappedOut list/collection tools, MTGStocks separation of free/premium market features, MTG Salvation community destinations. Card-back source: https://cards.scryfall.io/back.png, Wizards of the Coast imagery. Fonts: Google Fonts Inter and Space Grotesk, locally hosted.

Status: LIVE. Cloud Humanizer, canonical Gauntlet V6 and 32 phone/tablet/desktop route checks passed. Live homepage and MTG search/auction/theme checks passed. See proof/PHONE-CATALOG-LIVE-20261101.json and PR #928. The legacy commerce compiler remains blocked on the held diagnostic; this is not full commerce certification. Production baseline 70920f4021f65eddbf3b32c8b921e112cc0cac88; deploy bounded release branch rather than unrelated main changes.
