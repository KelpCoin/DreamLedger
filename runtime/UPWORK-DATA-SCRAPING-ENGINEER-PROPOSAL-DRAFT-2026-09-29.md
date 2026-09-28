# UPWORK PROPOSAL DRAFT - DATA SCRAPING ENGINEER
# Human review and submission required

I can build this as a parameterized data-collection pipeline rather than a one-off scraper.

For the first implementation I would keep the pipeline bounded and testable:
- configurable source, location, category and keyword parameters
- public-source extraction with source URL and provenance retained per record
- structured normalization into CSV/JSON
- entity matching and deduplication
- incremental change detection for monthly runs
- retry/error classification and run logging
- validation before delivery
- source code and documentation included

For dynamic sites, I would use the least-invasive permitted retrieval method available for the target source, with browser automation only where it is actually required. I would not bypass authentication, access controls or anti-bot restrictions.

For the approximately 200,000-record target, I would first validate one representative source and a smaller batch, establish the schema and duplicate/change rules, then expand the same pipeline across the remaining sources. That reduces the risk of producing a large dataset that later fails validation.

Deliverables:
1. Parameterized collector
2. Normalized CSV/JSON output
3. Provenance/source fields
4. Deduplication and change-detection logic
5. Retry/error handling
6. Validation report
7. Source code and run documentation

I would propose confirming one representative source and its permitted access method before committing the full 200,000-record run.

I can work within the stated $200 fixed budget only if the agreed first delivery is bounded to the actual acceptance criteria and permitted source access. I would prefer to confirm the exact source list and acceptance test before promising the full production scope.

Human submission required. This draft does not claim prior client work, payment, or credentials that have not been independently verified.
