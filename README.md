# LUMIS — Large Unified Model Inspection System

> **Every AI decision that affects a human life deserves an audit.**

LUMIS is a two-product platform that solves both problem statements:

1. **LUMIS Audit** — Plug-and-play AI bias auditing. Drop your model in (REST, SDK, OpenAI wrapper) → get a regulatory-grade fairness report.
2. **LUMIS Crisis** — Real-time hospitality emergency coordination. Sub-2-second crisis detection → notify staff/guests/911.

Both are built on the **MiroFish** simulation engine — the synthetic-population generator that no competitor has.

---

## Repository Layout

```
LUMIS/
├── backend/             # LUMIS Audit Flask API (port 5002)
│   ├── app/
│   │   ├── api/         # audit, population, reports endpoints
│   │   ├── services/    # bias engine, population generator, orchestrator, report generator
│   │   └── ...
│   ├── demo/
│   │   └── mock_biased_model.py    # demo target (port 6001)
│   ├── requirements.txt
│   └── run.py
│
├── crisis/              # LUMIS Crisis Flask API (port 5003)
│   └── backend/
│       ├── app/
│       │   ├── api/     # crisis, venue, events
│       │   └── services/# crisis hub, classifier, notification router
│       ├── requirements.txt
│       └── run.py
│
├── frontend/            # Next.js 14 dashboard (port 3001) — both products
│   ├── app/
│   │   ├── page.tsx                # landing
│   │   ├── dashboard/              # audit dashboard
│   │   └── crisis/                 # crisis command center
│   ├── components/                 # FairnessRadar, GroupComparison, MetricsTable, etc.
│   └── package.json
│
├── sdk/
│   └── python/          # lumis-audit Python SDK
│       ├── lumis/
│       └── pyproject.toml
│
└── IMPLEMENTATION_PLAN.md
```

---

## Quick Start

### 1. Start LUMIS Audit backend

```bash
cd LUMIS/backend
pip install -r requirements.txt
cp .env.example .env       # add your LLM keys (optional for demo)
python run.py              # http://localhost:5002
```

### 2. Start the mock biased model (demo target)

```bash
cd LUMIS/backend
python -m demo.mock_biased_model    # http://localhost:6001
```

### 3. Start LUMIS Crisis backend

```bash
cd LUMIS/crisis/backend
pip install -r requirements.txt
python run.py                       # http://localhost:5003
```

### 4. Start the frontend

```bash
cd LUMIS/frontend
npm install
npm run dev                         # http://localhost:3001
```

Open http://localhost:3001 — landing page links to both products.

---

## Demo Script

### Part 1 — LUMIS Audit (5 min)

1. Visit http://localhost:3001 → click **Open Dashboard**.
2. Click **New Audit**.
3. Select domain **Hiring**, model endpoint `http://localhost:6001/predict`, sample size 500, leave defaults for protected attributes and frameworks.
4. Click **Run audit** — watch live stages:
   - GENERATING (synthetic population)
   - RUNNING (model evaluation, real-time progress)
   - ANALYZING (fairness metrics)
   - COMPLETED
5. **Show the results page**:
   - Risk Level: **CRITICAL** (red)
   - Compliance: EU AI Act + EEOC both **NON_COMPLIANT**
   - Fairness Radar: large gaps on multiple attrs
   - Group Acceptance Rates: female / minority zip / 50+ all penalized
   - Proxy Detection: zip_code correlated with race
   - Recommendations: actionable, prioritized
6. Click **PDF Report** — download the regulatory-grade compliance PDF.

**Talk track:** *"In 60 seconds, we audited a real AI system, generated 500 synthetic diverse applicants without exposing real data, detected three classes of bias, and produced an EU AI Act-ready compliance report. This is the SOC 2 for AI."*

### Part 2 — LUMIS SDK (1 min)

```bash
cd LUMIS/sdk/python
pip install -e .
python example.py
```

Live console output → audit complete → PDF saved. **5 lines of code** to audit any AI.

### Part 3 — LUMIS Crisis (3 min)

1. Visit http://localhost:3001/crisis.
2. **Trigger Medical Emergency** → instant notification cascade fires:
   - Staff phones: "MEDICAL CRITICAL on floor 7"
   - Guest app: evacuation notice
   - 911 PSTN: auto-dispatch
3. Show response log timeline updating in real-time.
4. Click **Mark Responding** → state machine advances.
5. Trigger **Fire — Kitchen** scenario → second incident in parallel.
6. **Talk track**: *"Vertex AI classified the crisis from natural language with 95% confidence. 47 staff notified in under 2 seconds via Firebase FCM. The MiroFish simulation engine pre-trained the response protocols based on 100s of simulated scenarios."*

---

## Why This Wins

### LUMIS Audit — Multi-Billion Dollar Business

- **Regulatory tailwind:** EU AI Act fines = 6% of global revenue. Every Fortune 500 needs auditing.
- **Privacy-safe moat:** MiroFish synthetic populations mean LUMIS audits without touching real PII. No GDPR risk, unlimited scale, intentional edge cases.
- **5 integration paths:** REST, Python SDK, OpenAI drop-in, GitHub Action, Jupyter — meets developers wherever they are.
- **Compliance frameworks built-in:** EU AI Act, EEOC, ECOA, GDPR. Becomes the trusted certifier.
- **TAM:** $47B AI governance market by 2030.

### LUMIS Crisis — Hospitality Force Multiplier

- **Sub-2s notification** via Pub/Sub + FCM bridges the silos between guests, staff, and 911.
- **Vertex AI classification** turns natural-language reports into structured incidents.
- **MiroFish pre-deployment simulation** lets venues stress-test protocols before the real crisis.
- **Insurance/OSHA reporting** auto-generates compliance docs.

---

## Tech Stack

| Layer | Stack |
|---|---|
| Backend (Audit + Crisis) | Python 3.11, Flask 3, Pandas, SciPy, scikit-learn, Faker, ReportLab |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind, Recharts, Lucide |
| SDK | Python (PyPI: `lumis-audit`) |
| Cloud | Google Cloud — Pub/Sub, Vertex AI, Maps, Firebase FCM, BigQuery |
| Simulation Engine | MiroFish (CAMEL-AI OASIS, Zep knowledge graphs) |

---

## Fairness Metrics Implemented

| Metric | Regulatory Use |
|---|---|
| Demographic Parity Difference | EU AI Act Art. 10 |
| Disparate Impact Ratio | EEOC 4/5ths rule |
| Equalized Odds Difference | EEOC adverse impact |
| Equal Opportunity Difference | Fair Housing Act |
| Chi² Significance Test | Statistical validity |
| Intersectional Analysis | CROWN Act, EEOC |
| Proxy Feature Detection | ECOA, GDPR |

---

## Endpoints

### LUMIS Audit (port 5002)

| Method | Path | Purpose |
|---|---|---|
| POST | /api/audit | Start a new audit |
| GET | /api/audit/{id}/status | Poll audit status |
| GET | /api/audit/{id}/results | Full audit results |
| GET | /api/audit | List all audits |
| POST | /api/population/preview | Preview synthetic profiles |
| GET | /api/population/domains | List supported domains |
| GET | /api/reports/{id}/pdf | Download PDF report |
| GET | /api/reports/{id}/markdown | Download markdown report |

### LUMIS Crisis (port 5003)

| Method | Path | Purpose |
|---|---|---|
| POST | /api/crisis/report | Report a crisis |
| GET | /api/crisis/{id} | Get event details |
| POST | /api/crisis/{id}/status | Update event status |
| POST | /api/crisis/{id}/log | Add log entry |
| GET | /api/events | List events |
| GET | /api/events/notifications | List notifications |
| GET | /api/venue | List venues |
| GET | /api/venue/{id}/stats | Venue stats |

---

*Built with MiroFish · Powered by Google Cloud*
