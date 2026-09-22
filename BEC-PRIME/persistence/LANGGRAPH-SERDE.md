# LangGraph checkpoint serialization (BEC disk reference)

## Role

Serde encodes graph **channel values** to bytes for the checkpointer and decodes them on resume.

## Default

`JsonPlusSerializer` — ormsgpack + extended JSON for LangChain/LangGraph types, datetimes, enums.

Protocol:

```text
dumps_typed(obj) → (type_tag, bytes)
loads_typed((type_tag, bytes)) → obj
```

## Hard rules for BEC

1. Never put Stripe secrets in serializable state  
2. Prefer plain dict / JSON-safe stage payloads (as in air-gap store)  
3. If using real LangGraph: `LANGGRAPH_STRICT_MSGPACK=true` or allowlisted modules  
4. Optional `EncryptedSerializer` for at-rest encryption  
5. Avoid `pickle_fallback=True` unless isolated and understood  
6. Serde success ≠ verified revenue  

## Air-gap BEC choice

`checkpoint_store.py` uses **JSON only** for controlled stage state — narrower than JsonPlus, no code execution on load, no LangGraph dependency.
