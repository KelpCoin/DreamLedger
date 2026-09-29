# Transaction Primitive Factory v1

Date: 2026-09-29

## Mission

Build a reusable factory of transaction primitives rather than 300 isolated products. Each primitive is a reusable economic operation that can be instantiated across multiple domains. The objective is 300 primitives capable of serving at least 600 distinct problem applications.

The primitive is the reusable mechanism. The silo is the domain deployment. The product is the buyer-facing contract. The transaction is the economic boundary.

## Non-negotiable economic law

RESEARCH != DEMAND != PAYMENT != FULFILMENT != VERIFIED OUTCOME

A primitive, silo, checkout, URL, workflow, Stripe object, generated report, traffic event or internal action does not move the economic scoreboard. Verified economic truth still requires an independent external buyer, settled payment, attributable fulfilment and independent evidence.

## Factory loop

PAIN -> BUYER -> TRANSACTION -> PRIMITIVE -> INPUT CONTRACT -> PROCESS -> OUTPUT CONTRACT -> HUMAN GATE -> PAYMENT -> FULFILMENT -> EVIDENCE -> REPEAT -> ADJACENT SILO

## 300-primitives registry

| TP-001 | IDENTITY | identity normalization 1 | entity resolution | P1; P7 | reusable input -> verified transformation -> decision/output |
| TP-002 | IDENTITY | identity normalization 2 | entity resolution | P2; P14 | reusable input -> verified transformation -> decision/output |
| TP-003 | IDENTITY | identity normalization 3 | entity resolution | P3; P21 | reusable input -> verified transformation -> decision/output |
| TP-004 | IDENTITY | identity normalization 4 | entity resolution | P4; P28 | reusable input -> verified transformation -> decision/output |
| TP-005 | IDENTITY | identity normalization 5 | entity resolution | P5; P35 | reusable input -> verified transformation -> decision/output |
| TP-006 | IDENTITY | identity normalization 6 | entity resolution | P6; P42 | reusable input -> verified transformation -> decision/output |
| TP-007 | VERIFY | verification 1 | credential validation | P7; P49 | reusable input -> verified transformation -> decision/output |
| TP-008 | VERIFY | verification 2 | credential validation | P8; P56 | reusable input -> verified transformation -> decision/output |
| TP-009 | VERIFY | verification 3 | credential validation | P9; P63 | reusable input -> verified transformation -> decision/output |
| TP-010 | VERIFY | verification 4 | credential validation | P10; P70 | reusable input -> verified transformation -> decision/output |
| TP-011 | VERIFY | verification 5 | credential validation | P11; P77 | reusable input -> verified transformation -> decision/output |
| TP-012 | VERIFY | verification 6 | credential validation | P12; P84 | reusable input -> verified transformation -> decision/output |
| TP-013 | INGEST | document intake 1 | structured extraction | P13; P91 | reusable input -> verified transformation -> decision/output |
| TP-014 | INGEST | document intake 2 | structured extraction | P14; P98 | reusable input -> verified transformation -> decision/output |
| TP-015 | INGEST | document intake 3 | structured extraction | P15; P105 | reusable input -> verified transformation -> decision/output |
| TP-016 | INGEST | document intake 4 | structured extraction | P16; P112 | reusable input -> verified transformation -> decision/output |
| TP-017 | INGEST | document intake 5 | structured extraction | P17; P119 | reusable input -> verified transformation -> decision/output |
| TP-018 | INGEST | document intake 6 | structured extraction | P18; P126 | reusable input -> verified transformation -> decision/output |
| TP-019 | NORMALIZE | data normalization 1 | schema alignment | P19; P133 | reusable input -> verified transformation -> decision/output |
| TP-020 | NORMALIZE | data normalization 2 | schema alignment | P20; P140 | reusable input -> verified transformation -> decision/output |
| TP-021 | NORMALIZE | data normalization 3 | schema alignment | P21; P147 | reusable input -> verified transformation -> decision/output |
| TP-022 | NORMALIZE | data normalization 4 | schema alignment | P22; P154 | reusable input -> verified transformation -> decision/output |
| TP-023 | NORMALIZE | data normalization 5 | schema alignment | P23; P161 | reusable input -> verified transformation -> decision/output |
| TP-024 | NORMALIZE | data normalization 6 | schema alignment | P24; P168 | reusable input -> verified transformation -> decision/output |
| TP-025 | MATCH | record matching 1 | entity matching | P25; P175 | reusable input -> verified transformation -> decision/output |
| TP-026 | MATCH | record matching 2 | entity matching | P26; P182 | reusable input -> verified transformation -> decision/output |
| TP-027 | MATCH | record matching 3 | entity matching | P27; P189 | reusable input -> verified transformation -> decision/output |
| TP-028 | MATCH | record matching 4 | entity matching | P28; P196 | reusable input -> verified transformation -> decision/output |
| TP-029 | MATCH | record matching 5 | entity matching | P29; P203 | reusable input -> verified transformation -> decision/output |
| TP-030 | MATCH | record matching 6 | entity matching | P30; P210 | reusable input -> verified transformation -> decision/output |
| TP-031 | RECON | reconciliation 1 | exception reconciliation | P31; P217 | reusable input -> verified transformation -> decision/output |
| TP-032 | RECON | reconciliation 2 | exception reconciliation | P32; P224 | reusable input -> verified transformation -> decision/output |
| TP-033 | RECON | reconciliation 3 | exception reconciliation | P33; P231 | reusable input -> verified transformation -> decision/output |
| TP-034 | RECON | reconciliation 4 | exception reconciliation | P34; P238 | reusable input -> verified transformation -> decision/output |
| TP-035 | RECON | reconciliation 5 | exception reconciliation | P35; P245 | reusable input -> verified transformation -> decision/output |
| TP-036 | RECON | reconciliation 6 | exception reconciliation | P36; P252 | reusable input -> verified transformation -> decision/output |
| TP-037 | COMPARE | comparison 1 | quote/term comparison | P37; P259 | reusable input -> verified transformation -> decision/output |
| TP-038 | COMPARE | comparison 2 | quote/term comparison | P38; P266 | reusable input -> verified transformation -> decision/output |
| TP-039 | COMPARE | comparison 3 | quote/term comparison | P39; P273 | reusable input -> verified transformation -> decision/output |
| TP-040 | COMPARE | comparison 4 | quote/term comparison | P40; P280 | reusable input -> verified transformation -> decision/output |
| TP-041 | COMPARE | comparison 5 | quote/term comparison | P41; P287 | reusable input -> verified transformation -> decision/output |
| TP-042 | COMPARE | comparison 6 | quote/term comparison | P42; P294 | reusable input -> verified transformation -> decision/output |
| TP-043 | PRICE | pricing analysis 1 | price benchmarking | P43; P1 | reusable input -> verified transformation -> decision/output |
| TP-044 | PRICE | pricing analysis 2 | price benchmarking | P44; P8 | reusable input -> verified transformation -> decision/output |
| TP-045 | PRICE | pricing analysis 3 | price benchmarking | P45; P15 | reusable input -> verified transformation -> decision/output |
| TP-046 | PRICE | pricing analysis 4 | price benchmarking | P46; P22 | reusable input -> verified transformation -> decision/output |
| TP-047 | PRICE | pricing analysis 5 | price benchmarking | P47; P29 | reusable input -> verified transformation -> decision/output |
| TP-048 | PRICE | pricing analysis 6 | price benchmarking | P48; P36 | reusable input -> verified transformation -> decision/output |
| TP-049 | COST | total-cost analysis 1 | landed-cost calculation | P49; P43 | reusable input -> verified transformation -> decision/output |
| TP-050 | COST | total-cost analysis 2 | landed-cost calculation | P50; P50 | reusable input -> verified transformation -> decision/output |
| TP-051 | COST | total-cost analysis 3 | landed-cost calculation | P51; P57 | reusable input -> verified transformation -> decision/output |
| TP-052 | COST | total-cost analysis 4 | landed-cost calculation | P52; P64 | reusable input -> verified transformation -> decision/output |
| TP-053 | COST | total-cost analysis 5 | landed-cost calculation | P53; P71 | reusable input -> verified transformation -> decision/output |
| TP-054 | COST | total-cost analysis 6 | landed-cost calculation | P54; P78 | reusable input -> verified transformation -> decision/output |
| TP-055 | SCOPE | scope analysis 1 | requirements-to-deliverable mapping | P55; P85 | reusable input -> verified transformation -> decision/output |
| TP-056 | SCOPE | scope analysis 2 | requirements-to-deliverable mapping | P56; P92 | reusable input -> verified transformation -> decision/output |
| TP-057 | SCOPE | scope analysis 3 | requirements-to-deliverable mapping | P57; P99 | reusable input -> verified transformation -> decision/output |
| TP-058 | SCOPE | scope analysis 4 | requirements-to-deliverable mapping | P58; P106 | reusable input -> verified transformation -> decision/output |
| TP-059 | SCOPE | scope analysis 5 | requirements-to-deliverable mapping | P59; P113 | reusable input -> verified transformation -> decision/output |
| TP-060 | SCOPE | scope analysis 6 | requirements-to-deliverable mapping | P60; P120 | reusable input -> verified transformation -> decision/output |
| TP-061 | RFQ | request-for-quote 1 | supplier response intake | P61; P127 | reusable input -> verified transformation -> decision/output |
| TP-062 | RFQ | request-for-quote 2 | supplier response intake | P62; P134 | reusable input -> verified transformation -> decision/output |
| TP-063 | RFQ | request-for-quote 3 | supplier response intake | P63; P141 | reusable input -> verified transformation -> decision/output |
| TP-064 | RFQ | request-for-quote 4 | supplier response intake | P64; P148 | reusable input -> verified transformation -> decision/output |
| TP-065 | RFQ | request-for-quote 5 | supplier response intake | P65; P155 | reusable input -> verified transformation -> decision/output |
| TP-066 | RFQ | request-for-quote 6 | supplier response intake | P66; P162 | reusable input -> verified transformation -> decision/output |
| TP-067 | OFFER | offer normalization 1 | offer comparison | P67; P169 | reusable input -> verified transformation -> decision/output |
| TP-068 | OFFER | offer normalization 2 | offer comparison | P68; P176 | reusable input -> verified transformation -> decision/output |
| TP-069 | OFFER | offer normalization 3 | offer comparison | P69; P183 | reusable input -> verified transformation -> decision/output |
| TP-070 | OFFER | offer normalization 4 | offer comparison | P70; P190 | reusable input -> verified transformation -> decision/output |
| TP-071 | OFFER | offer normalization 5 | offer comparison | P71; P197 | reusable input -> verified transformation -> decision/output |
| TP-072 | OFFER | offer normalization 6 | offer comparison | P72; P204 | reusable input -> verified transformation -> decision/output |
| TP-073 | TRUST | counterparty trust 1 | supplier evidence | P73; P211 | reusable input -> verified transformation -> decision/output |
| TP-074 | TRUST | counterparty trust 2 | supplier evidence | P74; P218 | reusable input -> verified transformation -> decision/output |
| TP-075 | TRUST | counterparty trust 3 | supplier evidence | P75; P225 | reusable input -> verified transformation -> decision/output |
| TP-076 | TRUST | counterparty trust 4 | supplier evidence | P76; P232 | reusable input -> verified transformation -> decision/output |
| TP-077 | TRUST | counterparty trust 5 | supplier evidence | P77; P239 | reusable input -> verified transformation -> decision/output |
| TP-078 | TRUST | counterparty trust 6 | supplier evidence | P78; P246 | reusable input -> verified transformation -> decision/output |
| TP-079 | CONTRACT | contract obligations 1 | renewal/notice tracking | P79; P253 | reusable input -> verified transformation -> decision/output |
| TP-080 | CONTRACT | contract obligations 2 | renewal/notice tracking | P80; P260 | reusable input -> verified transformation -> decision/output |
| TP-081 | CONTRACT | contract obligations 3 | renewal/notice tracking | P81; P267 | reusable input -> verified transformation -> decision/output |
| TP-082 | CONTRACT | contract obligations 4 | renewal/notice tracking | P82; P274 | reusable input -> verified transformation -> decision/output |
| TP-083 | CONTRACT | contract obligations 5 | renewal/notice tracking | P83; P281 | reusable input -> verified transformation -> decision/output |
| TP-084 | CONTRACT | contract obligations 6 | renewal/notice tracking | P84; P288 | reusable input -> verified transformation -> decision/output |
| TP-085 | APPROVAL | approval routing 1 | decision authorization | P85; P295 | reusable input -> verified transformation -> decision/output |
| TP-086 | APPROVAL | approval routing 2 | decision authorization | P86; P2 | reusable input -> verified transformation -> decision/output |
| TP-087 | APPROVAL | approval routing 3 | decision authorization | P87; P9 | reusable input -> verified transformation -> decision/output |
| TP-088 | APPROVAL | approval routing 4 | decision authorization | P88; P16 | reusable input -> verified transformation -> decision/output |
| TP-089 | APPROVAL | approval routing 5 | decision authorization | P89; P23 | reusable input -> verified transformation -> decision/output |
| TP-090 | APPROVAL | approval routing 6 | decision authorization | P90; P30 | reusable input -> verified transformation -> decision/output |
| TP-091 | SIGNOFF | acceptance/signoff 1 | deliverable acceptance | P91; P37 | reusable input -> verified transformation -> decision/output |
| TP-092 | SIGNOFF | acceptance/signoff 2 | deliverable acceptance | P92; P44 | reusable input -> verified transformation -> decision/output |
| TP-093 | SIGNOFF | acceptance/signoff 3 | deliverable acceptance | P93; P51 | reusable input -> verified transformation -> decision/output |
| TP-094 | SIGNOFF | acceptance/signoff 4 | deliverable acceptance | P94; P58 | reusable input -> verified transformation -> decision/output |
| TP-095 | SIGNOFF | acceptance/signoff 5 | deliverable acceptance | P95; P65 | reusable input -> verified transformation -> decision/output |
| TP-096 | SIGNOFF | acceptance/signoff 6 | deliverable acceptance | P96; P72 | reusable input -> verified transformation -> decision/output |
| TP-097 | PAYMENT | payment matching 1 | settlement readiness | P97; P79 | reusable input -> verified transformation -> decision/output |
| TP-098 | PAYMENT | payment matching 2 | settlement readiness | P98; P86 | reusable input -> verified transformation -> decision/output |
| TP-099 | PAYMENT | payment matching 3 | settlement readiness | P99; P93 | reusable input -> verified transformation -> decision/output |
| TP-100 | PAYMENT | payment matching 4 | settlement readiness | P100; P100 | reusable input -> verified transformation -> decision/output |
| TP-101 | PAYMENT | payment matching 5 | settlement readiness | P101; P107 | reusable input -> verified transformation -> decision/output |
| TP-102 | PAYMENT | payment matching 6 | settlement readiness | P102; P114 | reusable input -> verified transformation -> decision/output |
| TP-103 | INVOICE | invoice audit 1 | billing exception detection | P103; P121 | reusable input -> verified transformation -> decision/output |
| TP-104 | INVOICE | invoice audit 2 | billing exception detection | P104; P128 | reusable input -> verified transformation -> decision/output |
| TP-105 | INVOICE | invoice audit 3 | billing exception detection | P105; P135 | reusable input -> verified transformation -> decision/output |
| TP-106 | INVOICE | invoice audit 4 | billing exception detection | P106; P142 | reusable input -> verified transformation -> decision/output |
| TP-107 | INVOICE | invoice audit 5 | billing exception detection | P107; P149 | reusable input -> verified transformation -> decision/output |
| TP-108 | INVOICE | invoice audit 6 | billing exception detection | P108; P156 | reusable input -> verified transformation -> decision/output |
| TP-109 | EXPENSE | expense audit 1 | expense evidence | P109; P163 | reusable input -> verified transformation -> decision/output |
| TP-110 | EXPENSE | expense audit 2 | expense evidence | P110; P170 | reusable input -> verified transformation -> decision/output |
| TP-111 | EXPENSE | expense audit 3 | expense evidence | P111; P177 | reusable input -> verified transformation -> decision/output |
| TP-112 | EXPENSE | expense audit 4 | expense evidence | P112; P184 | reusable input -> verified transformation -> decision/output |
| TP-113 | EXPENSE | expense audit 5 | expense evidence | P113; P191 | reusable input -> verified transformation -> decision/output |
| TP-114 | EXPENSE | expense audit 6 | expense evidence | P114; P198 | reusable input -> verified transformation -> decision/output |
| TP-115 | TAX | tax evidence 1 | tax-ready packaging | P115; P205 | reusable input -> verified transformation -> decision/output |
| TP-116 | TAX | tax evidence 2 | tax-ready packaging | P116; P212 | reusable input -> verified transformation -> decision/output |
| TP-117 | TAX | tax evidence 3 | tax-ready packaging | P117; P219 | reusable input -> verified transformation -> decision/output |
| TP-118 | TAX | tax evidence 4 | tax-ready packaging | P118; P226 | reusable input -> verified transformation -> decision/output |
| TP-119 | TAX | tax evidence 5 | tax-ready packaging | P119; P233 | reusable input -> verified transformation -> decision/output |
| TP-120 | TAX | tax evidence 6 | tax-ready packaging | P120; P240 | reusable input -> verified transformation -> decision/output |
| TP-121 | CLAIM | claim evidence 1 | claim chronology | P121; P247 | reusable input -> verified transformation -> decision/output |
| TP-122 | CLAIM | claim evidence 2 | claim chronology | P122; P254 | reusable input -> verified transformation -> decision/output |
| TP-123 | CLAIM | claim evidence 3 | claim chronology | P123; P261 | reusable input -> verified transformation -> decision/output |
| TP-124 | CLAIM | claim evidence 4 | claim chronology | P124; P268 | reusable input -> verified transformation -> decision/output |
| TP-125 | CLAIM | claim evidence 5 | claim chronology | P125; P275 | reusable input -> verified transformation -> decision/output |
| TP-126 | CLAIM | claim evidence 6 | claim chronology | P126; P282 | reusable input -> verified transformation -> decision/output |
| TP-127 | WARRANTY | warranty tracking 1 | warranty eligibility | P127; P289 | reusable input -> verified transformation -> decision/output |
| TP-128 | WARRANTY | warranty tracking 2 | warranty eligibility | P128; P296 | reusable input -> verified transformation -> decision/output |
| TP-129 | WARRANTY | warranty tracking 3 | warranty eligibility | P129; P3 | reusable input -> verified transformation -> decision/output |
| TP-130 | WARRANTY | warranty tracking 4 | warranty eligibility | P130; P10 | reusable input -> verified transformation -> decision/output |
| TP-131 | WARRANTY | warranty tracking 5 | warranty eligibility | P131; P17 | reusable input -> verified transformation -> decision/output |
| TP-132 | WARRANTY | warranty tracking 6 | warranty eligibility | P132; P24 | reusable input -> verified transformation -> decision/output |
| TP-133 | MAINT | maintenance planning 1 | service interval tracking | P133; P31 | reusable input -> verified transformation -> decision/output |
| TP-134 | MAINT | maintenance planning 2 | service interval tracking | P134; P38 | reusable input -> verified transformation -> decision/output |
| TP-135 | MAINT | maintenance planning 3 | service interval tracking | P135; P45 | reusable input -> verified transformation -> decision/output |
| TP-136 | MAINT | maintenance planning 4 | service interval tracking | P136; P52 | reusable input -> verified transformation -> decision/output |
| TP-137 | MAINT | maintenance planning 5 | service interval tracking | P137; P59 | reusable input -> verified transformation -> decision/output |
| TP-138 | MAINT | maintenance planning 6 | service interval tracking | P138; P66 | reusable input -> verified transformation -> decision/output |
| TP-139 | REPAIR | repair coordination 1 | repair quote analysis | P139; P73 | reusable input -> verified transformation -> decision/output |
| TP-140 | REPAIR | repair coordination 2 | repair quote analysis | P140; P80 | reusable input -> verified transformation -> decision/output |
| TP-141 | REPAIR | repair coordination 3 | repair quote analysis | P141; P87 | reusable input -> verified transformation -> decision/output |
| TP-142 | REPAIR | repair coordination 4 | repair quote analysis | P142; P94 | reusable input -> verified transformation -> decision/output |
| TP-143 | REPAIR | repair coordination 5 | repair quote analysis | P143; P101 | reusable input -> verified transformation -> decision/output |
| TP-144 | REPAIR | repair coordination 6 | repair quote analysis | P144; P108 | reusable input -> verified transformation -> decision/output |
| TP-145 | DELIVERY | delivery coordination 1 | delivery exception handling | P145; P115 | reusable input -> verified transformation -> decision/output |
| TP-146 | DELIVERY | delivery coordination 2 | delivery exception handling | P146; P122 | reusable input -> verified transformation -> decision/output |
| TP-147 | DELIVERY | delivery coordination 3 | delivery exception handling | P147; P129 | reusable input -> verified transformation -> decision/output |
| TP-148 | DELIVERY | delivery coordination 4 | delivery exception handling | P148; P136 | reusable input -> verified transformation -> decision/output |
| TP-149 | DELIVERY | delivery coordination 5 | delivery exception handling | P149; P143 | reusable input -> verified transformation -> decision/output |
| TP-150 | DELIVERY | delivery coordination 6 | delivery exception handling | P150; P150 | reusable input -> verified transformation -> decision/output |
| TP-151 | ACCEPT | delivery acceptance 1 | proof-of-delivery | P151; P157 | reusable input -> verified transformation -> decision/output |
| TP-152 | ACCEPT | delivery acceptance 2 | proof-of-delivery | P152; P164 | reusable input -> verified transformation -> decision/output |
| TP-153 | ACCEPT | delivery acceptance 3 | proof-of-delivery | P153; P171 | reusable input -> verified transformation -> decision/output |
| TP-154 | ACCEPT | delivery acceptance 4 | proof-of-delivery | P154; P178 | reusable input -> verified transformation -> decision/output |
| TP-155 | ACCEPT | delivery acceptance 5 | proof-of-delivery | P155; P185 | reusable input -> verified transformation -> decision/output |
| TP-156 | ACCEPT | delivery acceptance 6 | proof-of-delivery | P156; P192 | reusable input -> verified transformation -> decision/output |
| TP-157 | DISPUTE | dispute evidence 1 | dispute chronology | P157; P199 | reusable input -> verified transformation -> decision/output |
| TP-158 | DISPUTE | dispute evidence 2 | dispute chronology | P158; P206 | reusable input -> verified transformation -> decision/output |
| TP-159 | DISPUTE | dispute evidence 3 | dispute chronology | P159; P213 | reusable input -> verified transformation -> decision/output |
| TP-160 | DISPUTE | dispute evidence 4 | dispute chronology | P160; P220 | reusable input -> verified transformation -> decision/output |
| TP-161 | DISPUTE | dispute evidence 5 | dispute chronology | P161; P227 | reusable input -> verified transformation -> decision/output |
| TP-162 | DISPUTE | dispute evidence 6 | dispute chronology | P162; P234 | reusable input -> verified transformation -> decision/output |
| TP-163 | DOC | document control 1 | document versioning | P163; P241 | reusable input -> verified transformation -> decision/output |
| TP-164 | DOC | document control 2 | document versioning | P164; P248 | reusable input -> verified transformation -> decision/output |
| TP-165 | DOC | document control 3 | document versioning | P165; P255 | reusable input -> verified transformation -> decision/output |
| TP-166 | DOC | document control 4 | document versioning | P166; P262 | reusable input -> verified transformation -> decision/output |
| TP-167 | DOC | document control 5 | document versioning | P167; P269 | reusable input -> verified transformation -> decision/output |
| TP-168 | DOC | document control 6 | document versioning | P168; P276 | reusable input -> verified transformation -> decision/output |
| TP-169 | ACCESS | access control 1 | access expiry | P169; P283 | reusable input -> verified transformation -> decision/output |
| TP-170 | ACCESS | access control 2 | access expiry | P170; P290 | reusable input -> verified transformation -> decision/output |
| TP-171 | ACCESS | access control 3 | access expiry | P171; P297 | reusable input -> verified transformation -> decision/output |
| TP-172 | ACCESS | access control 4 | access expiry | P172; P4 | reusable input -> verified transformation -> decision/output |
| TP-173 | ACCESS | access control 5 | access expiry | P173; P11 | reusable input -> verified transformation -> decision/output |
| TP-174 | ACCESS | access control 6 | access expiry | P174; P18 | reusable input -> verified transformation -> decision/output |
| TP-175 | PRIVACY | privacy workflow 1 | data request handling | P175; P25 | reusable input -> verified transformation -> decision/output |
| TP-176 | PRIVACY | privacy workflow 2 | data request handling | P176; P32 | reusable input -> verified transformation -> decision/output |
| TP-177 | PRIVACY | privacy workflow 3 | data request handling | P177; P39 | reusable input -> verified transformation -> decision/output |
| TP-178 | PRIVACY | privacy workflow 4 | data request handling | P178; P46 | reusable input -> verified transformation -> decision/output |
| TP-179 | PRIVACY | privacy workflow 5 | data request handling | P179; P53 | reusable input -> verified transformation -> decision/output |
| TP-180 | PRIVACY | privacy workflow 6 | data request handling | P180; P60 | reusable input -> verified transformation -> decision/output |
| TP-181 | SECURITY | security evidence 1 | security questionnaire handling | P181; P67 | reusable input -> verified transformation -> decision/output |
| TP-182 | SECURITY | security evidence 2 | security questionnaire handling | P182; P74 | reusable input -> verified transformation -> decision/output |
| TP-183 | SECURITY | security evidence 3 | security questionnaire handling | P183; P81 | reusable input -> verified transformation -> decision/output |
| TP-184 | SECURITY | security evidence 4 | security questionnaire handling | P184; P88 | reusable input -> verified transformation -> decision/output |
| TP-185 | SECURITY | security evidence 5 | security questionnaire handling | P185; P95 | reusable input -> verified transformation -> decision/output |
| TP-186 | SECURITY | security evidence 6 | security questionnaire handling | P186; P102 | reusable input -> verified transformation -> decision/output |
| TP-187 | COMPLIANCE | compliance evidence 1 | licence/certificate monitoring | P187; P109 | reusable input -> verified transformation -> decision/output |
| TP-188 | COMPLIANCE | compliance evidence 2 | licence/certificate monitoring | P188; P116 | reusable input -> verified transformation -> decision/output |
| TP-189 | COMPLIANCE | compliance evidence 3 | licence/certificate monitoring | P189; P123 | reusable input -> verified transformation -> decision/output |
| TP-190 | COMPLIANCE | compliance evidence 4 | licence/certificate monitoring | P190; P130 | reusable input -> verified transformation -> decision/output |
| TP-191 | COMPLIANCE | compliance evidence 5 | licence/certificate monitoring | P191; P137 | reusable input -> verified transformation -> decision/output |
| TP-192 | COMPLIANCE | compliance evidence 6 | licence/certificate monitoring | P192; P144 | reusable input -> verified transformation -> decision/output |
| TP-193 | AUDIT | audit preparation 1 | audit evidence assembly | P193; P151 | reusable input -> verified transformation -> decision/output |
| TP-194 | AUDIT | audit preparation 2 | audit evidence assembly | P194; P158 | reusable input -> verified transformation -> decision/output |
| TP-195 | AUDIT | audit preparation 3 | audit evidence assembly | P195; P165 | reusable input -> verified transformation -> decision/output |
| TP-196 | AUDIT | audit preparation 4 | audit evidence assembly | P196; P172 | reusable input -> verified transformation -> decision/output |
| TP-197 | AUDIT | audit preparation 5 | audit evidence assembly | P197; P179 | reusable input -> verified transformation -> decision/output |
| TP-198 | AUDIT | audit preparation 6 | audit evidence assembly | P198; P186 | reusable input -> verified transformation -> decision/output |
| TP-199 | SEARCH | evidence search 1 | source-grounded retrieval | P199; P193 | reusable input -> verified transformation -> decision/output |
| TP-200 | SEARCH | evidence search 2 | source-grounded retrieval | P200; P200 | reusable input -> verified transformation -> decision/output |
| TP-201 | SEARCH | evidence search 3 | source-grounded retrieval | P201; P207 | reusable input -> verified transformation -> decision/output |
| TP-202 | SEARCH | evidence search 4 | source-grounded retrieval | P202; P214 | reusable input -> verified transformation -> decision/output |
| TP-203 | SEARCH | evidence search 5 | source-grounded retrieval | P203; P221 | reusable input -> verified transformation -> decision/output |
| TP-204 | SEARCH | evidence search 6 | source-grounded retrieval | P204; P228 | reusable input -> verified transformation -> decision/output |
| TP-205 | ALERT | change detection 1 | deadline/exception alerts | P205; P235 | reusable input -> verified transformation -> decision/output |
| TP-206 | ALERT | change detection 2 | deadline/exception alerts | P206; P242 | reusable input -> verified transformation -> decision/output |
| TP-207 | ALERT | change detection 3 | deadline/exception alerts | P207; P249 | reusable input -> verified transformation -> decision/output |
| TP-208 | ALERT | change detection 4 | deadline/exception alerts | P208; P256 | reusable input -> verified transformation -> decision/output |
| TP-209 | ALERT | change detection 5 | deadline/exception alerts | P209; P263 | reusable input -> verified transformation -> decision/output |
| TP-210 | ALERT | change detection 6 | deadline/exception alerts | P210; P270 | reusable input -> verified transformation -> decision/output |
| TP-211 | WORKFLOW | workflow routing 1 | request orchestration | P211; P277 | reusable input -> verified transformation -> decision/output |
| TP-212 | WORKFLOW | workflow routing 2 | request orchestration | P212; P284 | reusable input -> verified transformation -> decision/output |
| TP-213 | WORKFLOW | workflow routing 3 | request orchestration | P213; P291 | reusable input -> verified transformation -> decision/output |
| TP-214 | WORKFLOW | workflow routing 4 | request orchestration | P214; P298 | reusable input -> verified transformation -> decision/output |
| TP-215 | WORKFLOW | workflow routing 5 | request orchestration | P215; P5 | reusable input -> verified transformation -> decision/output |
| TP-216 | WORKFLOW | workflow routing 6 | request orchestration | P216; P12 | reusable input -> verified transformation -> decision/output |
| TP-217 | CAPACITY | capacity matching 1 | resource availability | P217; P19 | reusable input -> verified transformation -> decision/output |
| TP-218 | CAPACITY | capacity matching 2 | resource availability | P218; P26 | reusable input -> verified transformation -> decision/output |
| TP-219 | CAPACITY | capacity matching 3 | resource availability | P219; P33 | reusable input -> verified transformation -> decision/output |
| TP-220 | CAPACITY | capacity matching 4 | resource availability | P220; P40 | reusable input -> verified transformation -> decision/output |
| TP-221 | CAPACITY | capacity matching 5 | resource availability | P221; P47 | reusable input -> verified transformation -> decision/output |
| TP-222 | CAPACITY | capacity matching 6 | resource availability | P222; P54 | reusable input -> verified transformation -> decision/output |
| TP-223 | SERVICE | service coordination 1 | service-job management | P223; P61 | reusable input -> verified transformation -> decision/output |
| TP-224 | SERVICE | service coordination 2 | service-job management | P224; P68 | reusable input -> verified transformation -> decision/output |
| TP-225 | SERVICE | service coordination 3 | service-job management | P225; P75 | reusable input -> verified transformation -> decision/output |
| TP-226 | SERVICE | service coordination 4 | service-job management | P226; P82 | reusable input -> verified transformation -> decision/output |
| TP-227 | SERVICE | service coordination 5 | service-job management | P227; P89 | reusable input -> verified transformation -> decision/output |
| TP-228 | SERVICE | service coordination 6 | service-job management | P228; P96 | reusable input -> verified transformation -> decision/output |
| TP-229 | PROJECT | project evidence 1 | milestone tracking | P229; P103 | reusable input -> verified transformation -> decision/output |
| TP-230 | PROJECT | project evidence 2 | milestone tracking | P230; P110 | reusable input -> verified transformation -> decision/output |
| TP-231 | PROJECT | project evidence 3 | milestone tracking | P231; P117 | reusable input -> verified transformation -> decision/output |
| TP-232 | PROJECT | project evidence 4 | milestone tracking | P232; P124 | reusable input -> verified transformation -> decision/output |
| TP-233 | PROJECT | project evidence 5 | milestone tracking | P233; P131 | reusable input -> verified transformation -> decision/output |
| TP-234 | PROJECT | project evidence 6 | milestone tracking | P234; P138 | reusable input -> verified transformation -> decision/output |
| TP-235 | ASSET | asset lifecycle 1 | asset register | P235; P145 | reusable input -> verified transformation -> decision/output |
| TP-236 | ASSET | asset lifecycle 2 | asset register | P236; P152 | reusable input -> verified transformation -> decision/output |
| TP-237 | ASSET | asset lifecycle 3 | asset register | P237; P159 | reusable input -> verified transformation -> decision/output |
| TP-238 | ASSET | asset lifecycle 4 | asset register | P238; P166 | reusable input -> verified transformation -> decision/output |
| TP-239 | ASSET | asset lifecycle 5 | asset register | P239; P173 | reusable input -> verified transformation -> decision/output |
| TP-240 | ASSET | asset lifecycle 6 | asset register | P240; P180 | reusable input -> verified transformation -> decision/output |
| TP-241 | INVENTORY | inventory control 1 | stock reconciliation | P241; P187 | reusable input -> verified transformation -> decision/output |
| TP-242 | INVENTORY | inventory control 2 | stock reconciliation | P242; P194 | reusable input -> verified transformation -> decision/output |
| TP-243 | INVENTORY | inventory control 3 | stock reconciliation | P243; P201 | reusable input -> verified transformation -> decision/output |
| TP-244 | INVENTORY | inventory control 4 | stock reconciliation | P244; P208 | reusable input -> verified transformation -> decision/output |
| TP-245 | INVENTORY | inventory control 5 | stock reconciliation | P245; P215 | reusable input -> verified transformation -> decision/output |
| TP-246 | INVENTORY | inventory control 6 | stock reconciliation | P246; P222 | reusable input -> verified transformation -> decision/output |
| TP-247 | CATALOG | catalog management 1 | product attribute cleanup | P247; P229 | reusable input -> verified transformation -> decision/output |
| TP-248 | CATALOG | catalog management 2 | product attribute cleanup | P248; P236 | reusable input -> verified transformation -> decision/output |
| TP-249 | CATALOG | catalog management 3 | product attribute cleanup | P249; P243 | reusable input -> verified transformation -> decision/output |
| TP-250 | CATALOG | catalog management 4 | product attribute cleanup | P250; P250 | reusable input -> verified transformation -> decision/output |
| TP-251 | CATALOG | catalog management 5 | product attribute cleanup | P251; P257 | reusable input -> verified transformation -> decision/output |
| TP-252 | CATALOG | catalog management 6 | product attribute cleanup | P252; P264 | reusable input -> verified transformation -> decision/output |
| TP-253 | LISTING | listing operations 1 | listing syndication | P253; P271 | reusable input -> verified transformation -> decision/output |
| TP-254 | LISTING | listing operations 2 | listing syndication | P254; P278 | reusable input -> verified transformation -> decision/output |
| TP-255 | LISTING | listing operations 3 | listing syndication | P255; P285 | reusable input -> verified transformation -> decision/output |
| TP-256 | LISTING | listing operations 4 | listing syndication | P256; P292 | reusable input -> verified transformation -> decision/output |
| TP-257 | LISTING | listing operations 5 | listing syndication | P257; P299 | reusable input -> verified transformation -> decision/output |
| TP-258 | LISTING | listing operations 6 | listing syndication | P258; P6 | reusable input -> verified transformation -> decision/output |
| TP-259 | REPUTATION | portable reputation 1 | reference portability | P259; P13 | reusable input -> verified transformation -> decision/output |
| TP-260 | REPUTATION | portable reputation 2 | reference portability | P260; P20 | reusable input -> verified transformation -> decision/output |
| TP-261 | REPUTATION | portable reputation 3 | reference portability | P261; P27 | reusable input -> verified transformation -> decision/output |
| TP-262 | REPUTATION | portable reputation 4 | reference portability | P262; P34 | reusable input -> verified transformation -> decision/output |
| TP-263 | REPUTATION | portable reputation 5 | reference portability | P263; P41 | reusable input -> verified transformation -> decision/output |
| TP-264 | REPUTATION | portable reputation 6 | reference portability | P264; P48 | reusable input -> verified transformation -> decision/output |
| TP-265 | NEGOTIATE | negotiation preparation 1 | evidence-backed negotiation | P265; P55 | reusable input -> verified transformation -> decision/output |
| TP-266 | NEGOTIATE | negotiation preparation 2 | evidence-backed negotiation | P266; P62 | reusable input -> verified transformation -> decision/output |
| TP-267 | NEGOTIATE | negotiation preparation 3 | evidence-backed negotiation | P267; P69 | reusable input -> verified transformation -> decision/output |
| TP-268 | NEGOTIATE | negotiation preparation 4 | evidence-backed negotiation | P268; P76 | reusable input -> verified transformation -> decision/output |
| TP-269 | NEGOTIATE | negotiation preparation 5 | evidence-backed negotiation | P269; P83 | reusable input -> verified transformation -> decision/output |
| TP-270 | NEGOTIATE | negotiation preparation 6 | evidence-backed negotiation | P270; P90 | reusable input -> verified transformation -> decision/output |
| TP-271 | RENEW | renewal management 1 | renewal preparation | P271; P97 | reusable input -> verified transformation -> decision/output |
| TP-272 | RENEW | renewal management 2 | renewal preparation | P272; P104 | reusable input -> verified transformation -> decision/output |
| TP-273 | RENEW | renewal management 3 | renewal preparation | P273; P111 | reusable input -> verified transformation -> decision/output |
| TP-274 | RENEW | renewal management 4 | renewal preparation | P274; P118 | reusable input -> verified transformation -> decision/output |
| TP-275 | RENEW | renewal management 5 | renewal preparation | P275; P125 | reusable input -> verified transformation -> decision/output |
| TP-276 | RENEW | renewal management 6 | renewal preparation | P276; P132 | reusable input -> verified transformation -> decision/output |
| TP-277 | PROCURE | procurement memory 1 | repeat purchasing | P277; P139 | reusable input -> verified transformation -> decision/output |
| TP-278 | PROCURE | procurement memory 2 | repeat purchasing | P278; P146 | reusable input -> verified transformation -> decision/output |
| TP-279 | PROCURE | procurement memory 3 | repeat purchasing | P279; P153 | reusable input -> verified transformation -> decision/output |
| TP-280 | PROCURE | procurement memory 4 | repeat purchasing | P280; P160 | reusable input -> verified transformation -> decision/output |
| TP-281 | PROCURE | procurement memory 5 | repeat purchasing | P281; P167 | reusable input -> verified transformation -> decision/output |
| TP-282 | PROCURE | procurement memory 6 | repeat purchasing | P282; P174 | reusable input -> verified transformation -> decision/output |
| TP-283 | ORDER | order management 1 | order-change capture | P283; P181 | reusable input -> verified transformation -> decision/output |
| TP-284 | ORDER | order management 2 | order-change capture | P284; P188 | reusable input -> verified transformation -> decision/output |
| TP-285 | ORDER | order management 3 | order-change capture | P285; P195 | reusable input -> verified transformation -> decision/output |
| TP-286 | ORDER | order management 4 | order-change capture | P286; P202 | reusable input -> verified transformation -> decision/output |
| TP-287 | ORDER | order management 5 | order-change capture | P287; P209 | reusable input -> verified transformation -> decision/output |
| TP-288 | ORDER | order management 6 | order-change capture | P288; P216 | reusable input -> verified transformation -> decision/output |
| TP-289 | LOGISTICS | logistics matching 1 | pickup/delivery planning | P289; P223 | reusable input -> verified transformation -> decision/output |
| TP-290 | LOGISTICS | logistics matching 2 | pickup/delivery planning | P290; P230 | reusable input -> verified transformation -> decision/output |
| TP-291 | LOGISTICS | logistics matching 3 | pickup/delivery planning | P291; P237 | reusable input -> verified transformation -> decision/output |
| TP-292 | LOGISTICS | logistics matching 4 | pickup/delivery planning | P292; P244 | reusable input -> verified transformation -> decision/output |
| TP-293 | LOGISTICS | logistics matching 5 | pickup/delivery planning | P293; P251 | reusable input -> verified transformation -> decision/output |
| TP-294 | LOGISTICS | logistics matching 6 | pickup/delivery planning | P294; P258 | reusable input -> verified transformation -> decision/output |
| TP-295 | SCHEDULE | appointment scheduling 1 | availability coordination | P295; P265 | reusable input -> verified transformation -> decision/output |
| TP-296 | SCHEDULE | appointment scheduling 2 | availability coordination | P296; P272 | reusable input -> verified transformation -> decision/output |
| TP-297 | SCHEDULE | appointment scheduling 3 | availability coordination | P297; P279 | reusable input -> verified transformation -> decision/output |
| TP-298 | SCHEDULE | appointment scheduling 4 | availability coordination | P298; P286 | reusable input -> verified transformation -> decision/output |
| TP-299 | SCHEDULE | appointment scheduling 5 | availability coordination | P299; P293 | reusable input -> verified transformation -> decision/output |
| TP-300 | SCHEDULE | appointment scheduling 6 | availability coordination | P300; P300 | reusable input -> verified transformation -> decision/output |
| TP-301 | FOLLOWUP | follow-up automation 1 | commitment tracking | P1; P7 | reusable input -> verified transformation -> decision/output |
| TP-302 | FOLLOWUP | follow-up automation 2 | commitment tracking | P2; P14 | reusable input -> verified transformation -> decision/output |
| TP-303 | FOLLOWUP | follow-up automation 3 | commitment tracking | P3; P21 | reusable input -> verified transformation -> decision/output |
| TP-304 | FOLLOWUP | follow-up automation 4 | commitment tracking | P4; P28 | reusable input -> verified transformation -> decision/output |
| TP-305 | FOLLOWUP | follow-up automation 5 | commitment tracking | P5; P35 | reusable input -> verified transformation -> decision/output |
| TP-306 | FOLLOWUP | follow-up automation 6 | commitment tracking | P6; P42 | reusable input -> verified transformation -> decision/output |
| TP-307 | CUSTOMER | customer operations 1 | customer handoff | P7; P49 | reusable input -> verified transformation -> decision/output |
| TP-308 | CUSTOMER | customer operations 2 | customer handoff | P8; P56 | reusable input -> verified transformation -> decision/output |
| TP-309 | CUSTOMER | customer operations 3 | customer handoff | P9; P63 | reusable input -> verified transformation -> decision/output |
| TP-310 | CUSTOMER | customer operations 4 | customer handoff | P10; P70 | reusable input -> verified transformation -> decision/output |
| TP-311 | CUSTOMER | customer operations 5 | customer handoff | P11; P77 | reusable input -> verified transformation -> decision/output |
| TP-312 | CUSTOMER | customer operations 6 | customer handoff | P12; P84 | reusable input -> verified transformation -> decision/output |
| TP-313 | REVENUE | revenue attribution 1 | profitability analysis | P13; P91 | reusable input -> verified transformation -> decision/output |
| TP-314 | REVENUE | revenue attribution 2 | profitability analysis | P14; P98 | reusable input -> verified transformation -> decision/output |
| TP-315 | REVENUE | revenue attribution 3 | profitability analysis | P15; P105 | reusable input -> verified transformation -> decision/output |
| TP-316 | REVENUE | revenue attribution 4 | profitability analysis | P16; P112 | reusable input -> verified transformation -> decision/output |
| TP-317 | REVENUE | revenue attribution 5 | profitability analysis | P17; P119 | reusable input -> verified transformation -> decision/output |
| TP-318 | REVENUE | revenue attribution 6 | profitability analysis | P18; P126 | reusable input -> verified transformation -> decision/output |
| TP-319 | MARGIN | margin analysis 1 | unit economics | P19; P133 | reusable input -> verified transformation -> decision/output |
| TP-320 | MARGIN | margin analysis 2 | unit economics | P20; P140 | reusable input -> verified transformation -> decision/output |
| TP-321 | MARGIN | margin analysis 3 | unit economics | P21; P147 | reusable input -> verified transformation -> decision/output |
| TP-322 | MARGIN | margin analysis 4 | unit economics | P22; P154 | reusable input -> verified transformation -> decision/output |
| TP-323 | MARGIN | margin analysis 5 | unit economics | P23; P161 | reusable input -> verified transformation -> decision/output |
| TP-324 | MARGIN | margin analysis 6 | unit economics | P24; P168 | reusable input -> verified transformation -> decision/output |
| TP-325 | EVIDENCE | evidence packet 1 | minimum-necessary sharing | P25; P175 | reusable input -> verified transformation -> decision/output |
| TP-326 | EVIDENCE | evidence packet 2 | minimum-necessary sharing | P26; P182 | reusable input -> verified transformation -> decision/output |
| TP-327 | EVIDENCE | evidence packet 3 | minimum-necessary sharing | P27; P189 | reusable input -> verified transformation -> decision/output |
| TP-328 | EVIDENCE | evidence packet 4 | minimum-necessary sharing | P28; P196 | reusable input -> verified transformation -> decision/output |
| TP-329 | EVIDENCE | evidence packet 5 | minimum-necessary sharing | P29; P203 | reusable input -> verified transformation -> decision/output |
| TP-330 | EVIDENCE | evidence packet 6 | minimum-necessary sharing | P30; P210 | reusable input -> verified transformation -> decision/output |
| TP-331 | PASSPORT | transaction passport 1 | portable transaction history | P31; P217 | reusable input -> verified transformation -> decision/output |
| TP-332 | PASSPORT | transaction passport 2 | portable transaction history | P32; P224 | reusable input -> verified transformation -> decision/output |
| TP-333 | PASSPORT | transaction passport 3 | portable transaction history | P33; P231 | reusable input -> verified transformation -> decision/output |
| TP-334 | PASSPORT | transaction passport 4 | portable transaction history | P34; P238 | reusable input -> verified transformation -> decision/output |
| TP-335 | PASSPORT | transaction passport 5 | portable transaction history | P35; P245 | reusable input -> verified transformation -> decision/output |
| TP-336 | PASSPORT | transaction passport 6 | portable transaction history | P36; P252 | reusable input -> verified transformation -> decision/output |
| TP-337 | REPEAT | repeat transaction 1 | next-purchase generation | P37; P259 | reusable input -> verified transformation -> decision/output |
| TP-338 | REPEAT | repeat transaction 2 | next-purchase generation | P38; P266 | reusable input -> verified transformation -> decision/output |
| TP-339 | REPEAT | repeat transaction 3 | next-purchase generation | P39; P273 | reusable input -> verified transformation -> decision/output |
| TP-340 | REPEAT | repeat transaction 4 | next-purchase generation | P40; P280 | reusable input -> verified transformation -> decision/output |
| TP-341 | REPEAT | repeat transaction 5 | next-purchase generation | P41; P287 | reusable input -> verified transformation -> decision/output |
| TP-342 | REPEAT | repeat transaction 6 | next-purchase generation | P42; P294 | reusable input -> verified transformation -> decision/output |

## Registry columns

ID | FAMILY | PRIMARY PRIMITIVE | SECONDARY OPERATION | EXISTING PAIN VECTORS | CONTRACT

## The 600-problem expansion rule

Every primitive must be capable of at least two materially different deployments before it is considered a reusable primitive. The first deployment proves fulfilment. The second deployment proves transferability. The factory therefore treats 300 primitives x 2 deployments as a minimum 600-problem substrate, not 300 websites.

A deployment is not counted merely because a route exists. It needs a named buyer, a concrete input, a concrete output, a fulfilment path, and a measurable external result. A second deployment must change the substrate or buyer context enough to demonstrate that the primitive is genuinely reusable.

## Primitive contract

Every primitive implementation must declare:

- primitive_id
- version
- input_schema
- output_schema
- state_machine
- authorization requirements
- evidence requirements
- human_gate conditions
- idempotency key
- failure states
- retry/expiry policy
- fulfilment method
- payment boundary
- verification boundary
- reusable domains

## Build law

Do not clone 300 stacks.

Clone the primitive.
Instantiate the primitive.
Change the domain semantics.
Keep the economic and evidence contracts intact.

The preferred architecture is therefore:

DOMAIN-BLIND KERNEL -> PRIMITIVE -> SILO ADAPTER -> BUYER -> TRANSACTION -> EVIDENCE

MTG remains a useful dense sandbox because cards, buyers, inventory, condition, price, provenance, delivery and repeat transactions provide a concrete environment for testing the same primitives without pretending sandbox activity is external economic proof.

## First production primitive family

TP-001 through TP-006 form the initial RFQ/quote comparison family. The first external wedge remains quote normalization and comparison because it has a clean input contract, manually fulfillable output, explicit buyer value and a natural path toward supplier verification, negotiation, ordering, payment, delivery and repeat purchasing.

The machine should not wait for 300 finished products. It should make each primitive progressively executable, then instantiate it where real demand appears.

## Readiness states

CANDIDATE -> SPECIFIED -> IMPLEMENTED -> TESTED -> DEPLOYED -> LIVE -> TRANSACTING -> VERIFIED

Only LIVE means the public route is functioning. Only TRANSACTING means a real external transaction has occurred. Only VERIFIED changes the economic scoreboard.

## Current truth

VERIFIED_EXTERNAL_REVENUE = NZ$0.00
SETTLED_EXTERNAL_PAYMENTS = 0
INDEPENDENT_EXTERNAL_BUYERS = 0
VERIFIED_ECONOMIC_OUTCOMES = 0

This registry increases capability and substrate coverage only. It does not claim revenue.
