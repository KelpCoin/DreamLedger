# DreamLedger Actuator Layer

Status: IMPLEMENTED CONTRACT / EXTERNAL BROWSER NOT CONNECTED

The production boundary is:

ACTION_READY -> APPROVED -> LOCAL BROWSER ADAPTER -> ATTEMPTED -> INDEPENDENT VERIFICATION.

The browser actuator is deliberately unable to declare an external effect verified. It produces an ATTEMPTED receipt only. A separate verifier must establish listing ID/URL, account, price, timestamp and current external state.

Initial supported external action types:

- TRADEME_CREATE_LISTING
- TRADEME_EDIT_LISTING
- TRADEME_WITHDRAW_LISTING
- TRADEME_RELIST

The adapter is vendor-neutral. Set DREAMLEDGER_BROWSER_ACTUATOR_URL on the machine that owns the authenticated browser session. The endpoint must expose POST /v1/execute.

The adapter must refuse spending actions. Publishing a listing is an external action, not revenue.

First economic proof sequence:

T0 external listing verified
T1 external interest
T2 purchase intent
T3 settled payment
T4 fulfillment
T5 BusinessTruth

Do not promote a mechanism before T5. Do not infer payment from listing publication.
