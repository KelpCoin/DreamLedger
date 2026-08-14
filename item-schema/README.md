# Canonical Item Schema

This directory defines the canonical item object shared by the avatar and RPG adapters.

The canonical object is the source of truth. Adapters may select and present fields, but must not create ecosystem-specific copies of the item or assert economic ownership.

`economic.acquisition_proof_ref` is an evidence reference. A reference alone does not prove current ownership. Production ownership verification must bind the proof to the transaction, item, entitlement, and owner.

Fixtures are TEST_ONLY and must never be promoted to production economic proof.

Run the validator with:

    node validator.js

Run the executable demonstration with:

    node demo.js

Expected result: 3/3 canonical items validate, both adapters execute, and invalid ownership/proof bindings are rejected.
