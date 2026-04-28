# LUMIS — Implementation Plan
## Large Unified Model Inspection System

> Built on MiroFish simulation engine + Google Cloud
> Two problem statements → One unified platform architecture

---

## Executive Summary

**LUMIS** is a universal AI compliance and crisis coordination platform with two product lines:

1. **LUMIS Audit** — Plug-and-play SDK/API that audits any AI model for bias and discrimination. Organizations connect their AI (via API key, SDK, or webhook) and LUMIS stress-tests it with synthetic diverse populations, measures fairness metrics, and generates regulatory-grade compliance reports.

2. **LUMIS Crisis** — Real-time emergency detection and coordination system for hospitality venues, powered by MiroFish scenario simulations for staff training and protocol optimization.

**The Multi-Billion Dollar Angle:**
The EU AI Act (2024) mandates bias audits for high-risk AI systems. US EEOC, ECOA, and state-level regulations create massive enterprise compliance demand. LUMIS becomes the "SOC 2 for AI" — every company deploying AI in hiring, lending, healthcare, or law enforcement needs it. TAM: $47B by 2030 (AI governance market).

---

## How MiroFish Powers Everything

MiroFish's core capabilities map directly to both problem statements:

| MiroFish Capability | LUMIS Audit Use | LUMIS Crisis Use |
|---|---|---|
| Agent persona generation | Synthetic test populations (diverse demographics) | Simulated guests/staff/responders |
| Knowledge graph (Zep) | Model behavior graph, bias pattern memory | Venue layout graph, resource mapping |
| Multi-agent simulation | Run AI decisions across 1000s of synthetic profiles | Simulate crisis scenarios, test response protocols |
| ReACT report agent | Bias audit report with remediation steps | Post-incident analysis, protocol recommendations |
| Deep interaction | Interrogate why model decisions differ by group | Train staff via interactive crisis drills |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        LUMIS PLATFORM                           │
│                                                                  │
│  ┌─────────────────────────┐  ┌──────────────────────────────┐  │
│  │     LUMIS AUDIT          │  │      LUMIS CRISIS            │  │
│  │  AI Bias Inspection SDK  │  │  Emergency Coordination      │  │
│  └────────────┬────────────┘  └──────────────┬───────────────┘  │
│               │                               │                  │
│  ┌────────────▼───────────────────────────────▼───────────────┐  │
│  │              LUMIS CORE ENGINE                              │  │
│  │                                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │            MiroFish Simulation Engine                │   │  │
│  │  │  • Agent generation   • Knowledge graphs             │   │  │
│  │  │  • OASIS simulation   • Report generation            │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │           Google Cloud Services                      │   │  │
│  │  │  Vertex AI │ Pub/Sub │ Maps API │ BigQuery │ FCM     │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

# PRODUCT 1: LUMIS AUDIT

## Concept

Organizations plug their AI model into LUMIS and receive a full bias audit. Works for:
- **Hiring AI** (resume screening, interview scoring)
- **Financial AI** (loan approval, credit scoring)
- **Healthcare AI** (diagnosis prioritization, treatment recommendations)
- **Legal AI** (recidivism prediction, bail decisions)
- **Any classification/ranking model**

## Integration Methods (Plug-in Options)

### Option A: REST API Integration
```http
POST https://api.lumis.ai/v1/audit
Authorization: Bearer lm_sk_...
Content-Type: application/json

{
  "model_endpoint": "https://your-ai.company.com/predict",
  "model_type": "hiring",
  "protected_attributes": ["gender", "race", "age"],
  "sample_size": 10000,
  "compliance_frameworks": ["EU_AI_ACT", "EEOC", "ECOA"]
}
```

### Option B: Python SDK
```python
pip install lumis-audit

from lumis import LumisAudit

auditor = LumisAudit(api_key="lm_sk_...")

# Wrap any callable model
@auditor.monitor
def my_hiring_model(applicant_data):
    return model.predict(applicant_data)

# Or audit an endpoint
report = auditor.audit_endpoint(
    url="https://api.company.com/hiring/score",
    model_type="hiring",
    protected_attrs=["gender", "race", "age"],
    n_samples=10000
)

report.save("audit_report.pdf")
report.dashboard()
```

### Option C: OpenAI-Compatible Drop-in Wrapper
```python
# Before LUMIS
client = OpenAI(api_key="sk-...")

# After LUMIS (zero code change, auto-auditing)
client = LumisOpenAI(
    openai_api_key="sk-...",
    lumis_api_key="lm_sk_...",
    audit_policy="hiring_v2"
)
# All calls now monitored and audited
```

### Option D: GitHub Action (CI/CD)
```yaml
# .github/workflows/ai-audit.yml
- name: LUMIS Bias Audit
  uses: lumis-ai/audit-action@v1
  with:
    model-endpoint: ${{ vars.MODEL_URL }}
    api-key: ${{ secrets.LUMIS_API_KEY }}
    fail-on-bias: true
    threshold: 0.05
```

### Option E: Jupyter Notebook Plugin
```python
%load_ext lumis
%lumis_audit model=my_model dataset=X_test protected=["gender","race"]
# Renders interactive fairness dashboard inline
```

---

## MiroFish Integration: Synthetic Population Generator

**This is the core differentiator.** Instead of relying on real (privacy-sensitive) test data, LUMIS uses MiroFish to generate synthetic diverse populations.

### How It Works

```
Seed Input: "Hiring model for software engineers in San Francisco"
     ↓
MiroFish Ontology Generator
  → Entity types: Applicant, Company, Role, Education, Experience
  → Protected attributes: Gender, Race, Age, Disability, Nationality
     ↓
MiroFish Agent Generator
  → 10,000 synthetic applicant profiles
  → Realistic intersectional demographics
  → Varied qualifications (controlled experiments)
  → Edge cases: names implying race/gender, address-based proxies
     ↓
LUMIS Model Connector
  → Routes each synthetic profile through target model
  → Captures decisions + confidence scores
     ↓
LUMIS Bias Detection Engine
  → Statistical fairness analysis
     ↓
MiroFish Report Agent
  → Compliance report with remediation steps
```

### Modified MiroFish Services for LUMIS Audit

**New service: `lumis_population_generator.py`**
```python
# Extends oasis_profile_generator.py
# Generates demographically diverse synthetic test populations
# instead of social media personas

class LumisPopulationGenerator:
    def generate_population(
        self,
        domain: str,           # "hiring", "lending", "medical"
        size: int,             # number of profiles
        demographics: dict,    # target demographic distribution
        controlled: bool       # matched pairs for counterfactual testing
    ) -> list[SyntheticProfile]:
        ...
```

**New service: `bias_detection_engine.py`**
```python
class BiasDetectionEngine:
    metrics = [
        "demographic_parity_difference",
        "equalized_odds_difference",
        "equal_opportunity_difference",
        "disparate_impact_ratio",
        "individual_fairness_score",
        "counterfactual_fairness_score",
        "intersectional_bias_matrix"
    ]

    def analyze(self, decisions: list[Decision]) -> BiasReport:
        ...
```

---

## Fairness Metrics Measured

| Metric | What It Measures | Regulatory Relevance |
|---|---|---|
| Demographic Parity | Acceptance rate equal across groups | EU AI Act Art. 10 |
| Equalized Odds | TPR and FPR equal across groups | EEOC adverse impact |
| Equal Opportunity | TPR equal (benefits fairness) | Fair Housing Act |
| Disparate Impact Ratio | 4/5ths rule test | EEOC Uniform Guidelines |
| Counterfactual Fairness | Change only race/gender → same decision? | Individual rights |
| Intersectional Analysis | Black women vs white women vs Black men | CROWN Act etc. |
| Proxy Detection | Zip code → race, name → gender | Disparate impact law |

---

## Audit Report Output

Generated by MiroFish's `report_agent.py` (enhanced):

```
LUMIS AI BIAS AUDIT REPORT
Model: ResumeScorerAPI v2.3
Audit Date: 2026-04-24
Compliance Frameworks: EU AI Act, EEOC

EXECUTIVE SUMMARY
Risk Level: HIGH ⚠️
Critical findings: 3
Recommendations: 7

FINDINGS
1. [CRITICAL] Gender Bias in Technical Roles
   - Female applicants scored 23% lower for "Software Engineer" roles
   - Demographic Parity Difference: 0.23 (threshold: 0.05)
   - Affected profiles: 2,341 / 10,000

2. [HIGH] Racial Proxy via Zip Code
   - Model uses zip code as feature → 87% correlation with race
   - Disparate Impact Ratio: 0.61 (below 4/5ths rule: 0.80)

3. [MEDIUM] Age Bias in Leadership Roles
   - Applicants 50+ scored 15% lower with equal qualifications

REMEDIATION
1. Remove zip code feature or apply geographic fairness constraint
2. Apply adversarial debiasing to gender dimension
3. Implement fairness-aware ranking (listwise fairness)
4. Re-audit after changes

COMPLIANCE STATUS
EU AI Act: NON-COMPLIANT (Art. 10, Art. 13)
EEOC: AT RISK (adverse impact ratio below threshold)
ECOA: COMPLIANT ✓
```

---

## Business Model

### Pricing Tiers

| Tier | Price | Features |
|---|---|---|
| **Developer** | Free | 100 audits/mo, basic metrics, 7-day history |
| **Startup** | $499/mo | 5,000 audits/mo, all metrics, PDF reports |
| **Professional** | $1,999/mo | Unlimited, API access, continuous monitoring |
| **Enterprise** | $25k-$250k/yr | White-label, certified reports, SLA, on-premise |
| **Marketplace** | Revenue share | Third-party bias detectors/plugins |

### Revenue Streams
1. **SaaS subscriptions** — Recurring monthly/annual
2. **Per-audit API calls** — $0.10-$2.00 per audit depending on size
3. **Compliance certificates** — $5,000-$50,000 for regulatory filings
4. **SDK white-label licensing** — Embed in SAP, Salesforce, Workday
5. **Professional services** — $300/hr bias remediation consulting
6. **Training marketplace** — Debiased datasets, remediation templates

### Why Multi-Billion Dollar
- EU AI Act fines: up to €30M or 6% global revenue for non-compliance
- US EEOC settlements average $2.7M per case
- Every Fortune 500 needs AI auditing → 500 × $100k/yr = $50M ARR minimum
- Embedded in AI platforms (OpenAI, Google, Anthropic) → $B+ licensing
- Become the "Moody's for AI" — regulatory certification monopoly

---

# PRODUCT 2: LUMIS CRISIS

## Concept

Real-time emergency detection and multi-party coordination for hospitality venues.

**MiroFish role:** Pre-deployment scenario simulation and staff training via interactive crisis drills.

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    LUMIS CRISIS PLATFORM                      │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  GUEST   │  │  STAFF   │  │ MANAGERS │  │ EMERGENCY  │  │
│  │  APP     │  │  APP     │  │ DASHBOARD│  │ SERVICES   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │              │               │          │
│  ┌────▼──────────────▼──────────────▼───────────────▼──────┐  │
│  │              CRISIS COORDINATION HUB                     │  │
│  │          (Google Pub/Sub + Firebase Realtime)            │  │
│  └───────────────────────┬──────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │              DETECTION & INTELLIGENCE LAYER             │   │
│  │  • Vertex AI: anomaly detection, NLP crisis analysis    │   │
│  │  • IoT sensor integration (smoke, motion, SOS)          │   │
│  │  • Computer vision (optional: panic detection)          │   │
│  └────────────────────────┬───────────────────────────────┘   │
│                           │                                    │
│  ┌────────────────────────▼───────────────────────────────┐   │
│  │          MiroFish Simulation Layer (Training)           │   │
│  │  • Scenario generation  • Protocol optimization         │   │
│  │  • Staff drill mode     • Post-incident analysis        │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Google Cloud Services Map

| Service | Component | Purpose |
|---|---|---|
| **Cloud Pub/Sub** | Crisis Hub | Real-time event streaming, guaranteed delivery |
| **Firebase FCM** | Staff/Guest Apps | Push notifications in <1 second |
| **Google Maps Platform** | Evacuation | Indoor mapping, real-time location, routing |
| **Vertex AI** | Detection Engine | Anomaly detection, NLP crisis classification |
| **Cloud Functions** | API Layer | Serverless crisis event handlers |
| **BigQuery** | Analytics | Post-incident analysis, pattern detection |
| **Cloud Storage** | Evidence | Incident recordings, documentation |
| **Google Speech-to-Text** | SOS calls | Voice crisis detection and transcription |
| **Identity Platform** | Auth | Multi-tenant hotel/staff/guest auth |
| **Cloud Run** | Backend | Containerized crisis coordination service |

## Crisis Detection Flow

```
TRIGGER SOURCES:
  Guest SOS button (app) → 
  IoT sensor (smoke/fire/motion) →     → Pub/Sub Topic: crisis.detected
  Staff report (app) →
  Call center NLP analysis →

CLASSIFICATION (Vertex AI):
  crisis.detected → classify(type, severity, location)
  Types: FIRE | MEDICAL | SECURITY | NATURAL_DISASTER | OTHER
  Severity: CRITICAL | HIGH | MEDIUM | LOW

NOTIFICATION ROUTING (< 2 seconds):
  CRITICAL → All staff + Emergency services (911 auto-call) + All guests
  HIGH → Relevant staff + Management + Nearby guests
  MEDIUM → Duty manager + Relevant staff
  LOW → Duty manager only

COORDINATION:
  Live incident dashboard (web)
  Staff task assignment
  Real-time location tracking (Google Maps)
  Communication bridge (staff ↔ 911)
  Evidence collection (photos, video, timestamps)
```

## MiroFish: Crisis Simulation for Training

Before any real crisis, venues use MiroFish to:

1. **Scenario Generation**
   - Seed: "Hotel with 300 guests, 45 staff, 12 floors, pool area"
   - MiroFish generates: fire scenario on floor 7 at 2am, 180 guests asleep
   - Simulates: staff response, guest behavior, communication flows

2. **Protocol Testing**
   - Run 100 simulation rounds with different initial conditions
   - Identify bottlenecks: "Elevator area always creates crowd crush"
   - Optimize evacuation routes via knowledge graph analysis

3. **Staff Drills**
   - Interactive mode: staff "plays" their role in simulated crisis
   - AI evaluates response time and decision quality
   - Report: "Your floor captain response was 4 min; optimal is 90 seconds"

4. **Post-Incident Analysis**
   - Feed real incident data back into MiroFish
   - Generate counterfactual: "What if notification was 2 min faster?"
   - Update protocols based on simulation outcomes

---

# TECHNICAL IMPLEMENTATION ROADMAP

## Phase 0 — Foundation (Hackathon Demo, Week 1)

**Goal:** Working demo of both products using MiroFish + Google Cloud free tier

### LUMIS Audit Demo
- [ ] Extend MiroFish `oasis_profile_generator.py` → `lumis_population_generator.py`
  - Generate 500 synthetic hiring profiles with demographic diversity
- [ ] Build `bias_detection_engine.py` 
  - Implement demographic parity + disparate impact ratio
- [ ] Create simple REST endpoint: `POST /api/lumis/audit`
  - Accepts model URL + protected attributes
  - Returns bias report JSON
- [ ] Enhance `report_agent.py` for bias reporting
  - Add bias-specific tools and report templates
- [ ] Build minimal React/Vue dashboard
  - Bias metrics visualization (fairness radar chart)
  - Side-by-side group comparison charts

### LUMIS Crisis Demo
- [ ] Set up Google Pub/Sub topic: `lumis.crisis.events`
- [ ] Build crisis detection endpoint: `POST /api/crisis/report`
- [ ] Integrate Google Maps for venue mapping
- [ ] Build real-time dashboard (WebSocket)
- [ ] MiroFish scenario: "Hotel fire simulation" → response protocol report

---

## Phase 1 — MVP (Month 1-2)

### LUMIS Audit
- [ ] Python SDK package: `pip install lumis-audit`
- [ ] REST API with authentication (JWT + API keys)
- [ ] 7 fairness metrics implemented
- [ ] PDF report generation
- [ ] Supabase backend (user accounts, audit history, API key management)
- [ ] Next.js dashboard with real-time audit progress
- [ ] Stripe payment integration (Startup tier launch)

### LUMIS Crisis
- [ ] Mobile apps (Flutter): Guest SOS + Staff Responder
- [ ] Firebase FCM notification pipeline
- [ ] Vertex AI crisis classification model (fine-tune on incident reports)
- [ ] Google Maps indoor routing
- [ ] Pilot with 2-3 hospitality partners

---

## Phase 2 — Scale (Month 3-6)

### LUMIS Audit
- [ ] JavaScript/TypeScript SDK
- [ ] OpenAI drop-in wrapper
- [ ] GitHub Action
- [ ] Continuous monitoring (cron-based re-audits)
- [ ] Intersectional analysis
- [ ] Proxy feature detection (correlation-based)
- [ ] Compliance framework templates (EU AI Act, EEOC, ECOA, GDPR)
- [ ] Enterprise SSO (SAML/OIDC)
- [ ] BigQuery analytics for enterprise audit history

### LUMIS Crisis
- [ ] 911/emergency services API integration
- [ ] IoT sensor webhook ingestion
- [ ] Multi-venue management
- [ ] Incident replay and analysis
- [ ] Insurance reporting module
- [ ] Compliance reports (OSHA, fire safety standards)

---

## Phase 3 — Moat (Month 6-12)

### LUMIS Audit
- [ ] Marketplace: third-party bias detectors
- [ ] Lumis Certification Program (like SOC2 auditors)
- [ ] Model registry: track model versions + bias over time
- [ ] Regulatory partnership (EU AI Office, EEOC)
- [ ] White-label SDK licensing to Workday, SAP SuccessFactors
- [ ] Anthropic/OpenAI/Google native integration

### LUMIS Crisis
- [ ] Predictive risk scoring (Vertex AI)
- [ ] Regional emergency service integrations
- [ ] Insurance underwriting API
- [ ] Franchise/chain management (Marriott, Hilton scale)

---

# FILE STRUCTURE (New Code in LUMIS/)

```
LUMIS/
├── audit/                          # LUMIS Audit product
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   └── audit.py        # Audit endpoints
│   │   │   ├── services/
│   │   │   │   ├── population_generator.py  # MiroFish extension
│   │   │   │   ├── model_connector.py       # Target model adapter
│   │   │   │   ├── bias_detection.py        # Fairness metrics engine
│   │   │   │   └── audit_reporter.py        # MiroFish report extension
│   │   │   └── sdk/
│   │   │       ├── python/         # lumis-audit PyPI package
│   │   │       └── typescript/     # @lumis/audit NPM package
│   │   └── run.py
│   └── frontend/                   # Next.js audit dashboard
│       ├── app/
│       │   ├── dashboard/
│       │   ├── audit/[id]/
│       │   └── reports/
│       └── components/
│           ├── FairnessRadar.tsx
│           ├── GroupComparison.tsx
│           └── BiasTimeline.tsx
│
├── crisis/                         # LUMIS Crisis product
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── crisis.py       # Crisis reporting endpoints
│   │   │   │   ├── venue.py        # Venue management
│   │   │   │   └── notify.py       # Notification routing
│   │   │   ├── services/
│   │   │   │   ├── crisis_classifier.py    # Vertex AI integration
│   │   │   │   ├── pubsub_manager.py       # Google Pub/Sub
│   │   │   │   ├── notification_router.py  # FCM + SMS routing
│   │   │   │   ├── location_service.py     # Google Maps API
│   │   │   │   └── mirofish_trainer.py     # Simulation for drills
│   │   │   └── models/
│   │   │       ├── crisis_event.py
│   │   │       └── venue.py
│   │   └── run.py
│   ├── frontend/                   # Next.js coordination dashboard
│   │   └── app/
│   │       ├── command-center/     # Real-time crisis hub
│   │       ├── venue/[id]/
│   │       └── simulation/         # MiroFish drill interface
│   └── mobile/                     # Flutter apps
│       ├── guest_app/              # Guest SOS button
│       └── staff_app/              # Staff responder
│
└── shared/                         # Shared utilities
    ├── auth/                       # Supabase auth
    ├── db/                         # Supabase schema + migrations
    └── mirofish_bridge/            # MiroFish integration layer
```

---

# MIROFISH BRIDGE: KEY INTEGRATION POINTS

## For LUMIS Audit

### `mirofish_bridge/audit_population.py`
```python
"""
Extends MiroFish's oasis_profile_generator to create
demographically diverse synthetic test populations
instead of social media personas.
"""

from MiroFish.backend.app.services.oasis_profile_generator import ProfileGenerator
from MiroFish.backend.app.services.graph_builder import GraphBuilder

class AuditPopulationBridge:
    """
    Uses MiroFish's agent generation to create synthetic
    test populations for AI bias auditing.
    
    Seeds: domain description (e.g., "NYC software hiring")
    Output: Diverse profiles with controlled demographic attributes
    """
    
    DOMAINS = {
        "hiring": "resume_templates/hiring_profiles.md",
        "lending": "seed_templates/loan_applicants.md",
        "medical": "seed_templates/patient_profiles.md",
    }
    
    def generate(self, domain: str, n: int, demographics: dict) -> list:
        # 1. Build knowledge graph from domain seed
        # 2. Generate diverse agent profiles
        # 3. Apply demographic distribution constraints
        # 4. Generate edge cases (name-based proxies, address patterns)
        # 5. Create matched pairs for counterfactual testing
        pass
```

### `mirofish_bridge/audit_reporter.py`
```python
"""
Extends MiroFish's report_agent to generate bias audit reports
with regulatory compliance framing.
"""

from MiroFish.backend.app.services.report_agent import ReportAgent

LUMIS_AUDIT_TOOLS = [
    "compare_group_outcomes",
    "calculate_fairness_metrics",
    "detect_proxy_features",
    "generate_remediation_steps",
    "check_compliance_framework",
    "generate_executive_summary",
]

class AuditReportBridge(ReportAgent):
    system_prompt = """You are LUMIS, an AI fairness auditor...
    Generate compliance-grade bias audit reports with:
    1. Executive summary with risk level
    2. Detailed findings per protected attribute
    3. Statistical evidence with confidence intervals
    4. Regulatory compliance status
    5. Specific remediation recommendations
    """
```

## For LUMIS Crisis

### `mirofish_bridge/crisis_simulator.py`
```python
"""
Uses MiroFish's simulation engine to model crisis scenarios
for staff training and protocol optimization.
"""

CRISIS_SEED_TEMPLATE = """
Venue: {venue_name}
Type: {venue_type}  
Capacity: {capacity} guests, {staff_count} staff
Layout: {floor_count} floors, {special_areas}
Crisis: {crisis_type} at {location} at {time}
"""

class CrisisSimulatorBridge:
    """
    Runs MiroFish simulations with crisis scenarios.
    Uses Twitter-like platform to simulate:
    - Information spread (rumors, panic)
    - Staff communication patterns
    - Response coordination failures
    """
    
    def run_crisis_drill(
        self,
        venue_config: VenueConfig,
        crisis_scenario: CrisisScenario,
        n_rounds: int = 50
    ) -> CrisisDrillReport:
        # 1. Generate venue knowledge graph
        # 2. Create agents: guests, staff, managers, responders
        # 3. Inject crisis event into simulation
        # 4. Run OASIS simulation (staff communication patterns)
        # 5. Generate protocol optimization report
        pass
```

---

# GOOGLE CLOUD INTEGRATION DETAILS

## Services & Setup

```bash
# Google Cloud project setup
gcloud projects create lumis-platform
gcloud services enable \
  pubsub.googleapis.com \
  maps-backend.googleapis.com \
  firebase.googleapis.com \
  aiplatform.googleapis.com \
  bigquery.googleapis.com \
  speech.googleapis.com \
  run.googleapis.com
```

## Pub/Sub Schema (Crisis Events)
```json
{
  "event_id": "uuid",
  "venue_id": "string",
  "timestamp": "ISO8601",
  "crisis_type": "FIRE|MEDICAL|SECURITY|NATURAL_DISASTER|OTHER",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW",
  "location": {
    "floor": "number",
    "zone": "string",
    "coordinates": {"lat": 0.0, "lng": 0.0}
  },
  "reporter": {
    "type": "GUEST|STAFF|SENSOR|NLP",
    "id": "string"
  },
  "description": "string",
  "media_urls": ["string"]
}
```

## Vertex AI: Crisis Classifier
```python
# Fine-tune on hospitality incident reports
# Classes: FIRE, MEDICAL, SECURITY, NATURAL_DISASTER, FALSE_ALARM
# Input: text report OR sensor data
# Output: crisis_type + severity + confidence

from google.cloud import aiplatform

endpoint = aiplatform.Endpoint(
    endpoint_name="projects/lumis-platform/locations/us-central1/endpoints/crisis-classifier"
)

prediction = endpoint.predict(
    instances=[{"text": "Guest on floor 7 unresponsive, not breathing"}]
)
# → {"crisis_type": "MEDICAL", "severity": "CRITICAL", "confidence": 0.97}
```

## Google Maps: Evacuation Routing
```python
import googlemaps

gmaps = googlemaps.Client(key=GOOGLE_MAPS_API_KEY)

# Indoor routing (requires venue to upload floor plans)
evacuation_route = gmaps.directions(
    origin={"place_id": "room_712_placeid"},
    destination={"place_id": "exit_north_placeid"},
    mode="walking",
    avoid=["fire_zone_floor7"]  # Dynamic avoidance
)
```

---

# DEMO SCRIPT (Hackathon Presentation)

## LUMIS Audit (5 minutes)
1. Show biased hiring model API endpoint (pre-built mock)
2. Run LUMIS audit: `lumis audit --model https://demo-hiring.lumis.ai --type hiring`
3. Watch MiroFish generate 500 synthetic profiles (live)
4. Show real-time bias detection dashboard
5. Display audit report: "Gender bias detected — 23% disparity"
6. Show remediation suggestions

## LUMIS Crisis (5 minutes)
1. Open command center dashboard (hotel floor plan on Google Maps)
2. Guest triggers SOS on mobile app
3. Pub/Sub event fires → dashboard lights up
4. Vertex AI classifies: MEDICAL EMERGENCY, CRITICAL
5. Staff apps notify in <2 seconds
6. Show MiroFish simulation: "If response was 2 min faster, 40% better outcome"

---

# COMPETITIVE LANDSCAPE

| Company | Focus | Gap LUMIS fills |
|---|---|---|
| IBM OpenScale | Enterprise only, IBM-locked | Open, any model, any platform |
| Microsoft Fairlearn | Python library, no reporting | Full SaaS + compliance reports |
| Google Model Cards | Documentation only | Active auditing + monitoring |
| Fiddler AI | Post-deployment monitoring | Pre-deployment + simulation |
| Holistic AI | Consulting-heavy | Self-serve SDK + automated |

**LUMIS differentiator:** MiroFish simulation for synthetic population generation = no privacy concerns, unlimited scale, edge case generation impossible with real data.

---

# NEXT STEPS (Immediate)

1. **Today:** Set up LUMIS/ directory structure, install Google Cloud SDK
2. **Day 1-2:** Build `population_generator.py` extending MiroFish
3. **Day 2-3:** Build `bias_detection.py` with core metrics
4. **Day 3:** Build REST API endpoint + minimal dashboard
5. **Day 4:** Crisis system: Pub/Sub + Maps + notification pipeline
6. **Day 5:** Demo polish, presentation prep

---

*LUMIS — Because every AI decision that affects a human life deserves an audit.*
