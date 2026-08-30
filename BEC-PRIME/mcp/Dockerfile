FROM node:20-alpine
WORKDIR /app/BEC-PRIME
COPY security ./security
COPY mcp ./mcp
COPY runtime/EconomicCourtV2.js ./runtime/EconomicCourtV2.js
RUN mkdir -p data/mcp-ledger data/proofs catalog/products
ENV BECKPRIME_ROOT=/app/BEC-PRIME
ENTRYPOINT ["node","/app/BEC-PRIME/mcp/DreamLedgerGatewayV2.js"]
