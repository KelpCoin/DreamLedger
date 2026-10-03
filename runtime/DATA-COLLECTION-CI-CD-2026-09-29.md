# DATA COLLECTION CI/CD

CI:
- Runs on changes to the collector.
- Executes unit tests.
- Tests source-policy hard stops.
- Does not perform live third-party collection.
- Does not contact buyers or make external financial actions.

CD:
- Triggered only by an explicit data-collection-v* Git tag.
- Re-runs tests before release.
- Builds a versioned source artifact.
- Generates SHA-256 checksums.
- Publishes a GitHub Release.
- Does not automatically deploy or activate a new third-party source.

Why no automatic scraping deployment:
A source configuration can change the legal, contractual, privacy, or platform-access boundary. Code delivery can be automated, but activation of a new third-party source remains source-policy gated.

Production progression:
CODE -> CI PASS -> VERSION TAG -> RELEASE ARTIFACT -> SOURCE POLICY PASS -> HUMAN/OWNER APPROVAL WHERE REQUIRED -> SOURCE ACTIVATION -> OBSERVED RUN -> EVIDENCE
