"""LUMIS configuration."""
import os

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1")
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME", "gpt-4o-mini")

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

MAX_POPULATION_SIZE = int(os.getenv("LUMIS_MAX_POPULATION_SIZE", "10000"))
DEFAULT_POPULATION_SIZE = int(os.getenv("LUMIS_DEFAULT_POPULATION_SIZE", "1000"))
FAIRNESS_THRESHOLD = float(os.getenv("LUMIS_FAIRNESS_THRESHOLD", "0.05"))

PROTECTED_ATTRIBUTES = {
    "gender": ["male", "female", "non_binary"],
    "race": ["white", "black", "asian", "hispanic", "native_american", "pacific_islander"],
    "age_group": ["18-29", "30-39", "40-49", "50-59", "60+"],
    "disability": ["none", "physical", "cognitive", "sensory"],
    "nationality_origin": ["domestic", "foreign"],
}

COMPLIANCE_FRAMEWORKS = {
    "EU_AI_ACT": {
        "name": "EU AI Act",
        "metrics": ["demographic_parity", "equalized_odds", "counterfactual_fairness"],
        "threshold": 0.05,
    },
    "EEOC": {
        "name": "US EEOC Uniform Guidelines (4/5ths Rule)",
        "metrics": ["disparate_impact_ratio"],
        "threshold": 0.80,
    },
    "ECOA": {
        "name": "Equal Credit Opportunity Act",
        "metrics": ["demographic_parity", "disparate_impact_ratio"],
        "threshold": 0.05,
    },
    "GDPR": {
        "name": "GDPR Article 22 (Automated Decisions)",
        "metrics": ["counterfactual_fairness", "individual_fairness"],
        "threshold": 0.10,
    },
}
