# Execution Gate
DreamLedger outbound execution is fail-closed: canonical intent -> SHA-256 payload binding -> signed ticket -> expiry/policy check -> material precondition check immediately before effect -> atomic single-use payload lock -> external effect -> immutable trace -> termination certificate.
The persisted nonce/JTI is the security primitive. A six-digit display code, if later added, is only a human convenience and never the authorization secret.
