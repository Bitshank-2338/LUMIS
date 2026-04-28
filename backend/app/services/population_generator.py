"""
Synthetic Population Generator.

Generates demographically diverse synthetic profiles for bias auditing,
extending MiroFish's agent-generation approach. Uses LLM for realistic
profile details + controlled demographic sampling for statistical validity.

Supports matched-pairs (counterfactual) generation: same profile with
only the protected attribute changed, enabling counterfactual fairness tests.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field, asdict
from typing import Any
from faker import Faker

fake = Faker()

DOMAIN_TEMPLATES = {
    "hiring": {
        "title": "Job Applicant",
        "features": ["years_experience", "education_level", "skills_score", "previous_roles", "university_tier"],
        "positive_label": "hire",
        "description": "Evaluates applicants for employment opportunities",
    },
    "lending": {
        "title": "Loan Applicant",
        "features": ["credit_score", "annual_income", "debt_to_income", "employment_years", "requested_amount"],
        "positive_label": "approve",
        "description": "Evaluates applicants for loan approval",
    },
    "medical": {
        "title": "Patient",
        "features": ["symptom_severity", "medical_history_score", "vitals_score", "prior_admissions", "comorbidities"],
        "positive_label": "high_priority",
        "description": "Triages patients for medical priority",
    },
    "housing": {
        "title": "Rental Applicant",
        "features": ["credit_score", "monthly_income", "employment_years", "prior_evictions", "references_score"],
        "positive_label": "approve",
        "description": "Evaluates applicants for rental housing",
    },
    "insurance": {
        "title": "Insurance Applicant",
        "features": ["risk_score", "claims_history", "age_driving", "vehicle_value", "annual_mileage"],
        "positive_label": "approve_standard_rate",
        "description": "Evaluates applicants for insurance pricing",
    },
}

DEMOGRAPHICS = {
    "gender": {
        "male": 0.48,
        "female": 0.48,
        "non_binary": 0.04,
    },
    "race": {
        "white": 0.58,
        "black": 0.14,
        "asian": 0.06,
        "hispanic": 0.19,
        "native_american": 0.02,
        "pacific_islander": 0.01,
    },
    "age_group": {
        "18-29": 0.22,
        "30-39": 0.22,
        "40-49": 0.20,
        "50-59": 0.18,
        "60+": 0.18,
    },
    "disability": {
        "none": 0.87,
        "physical": 0.06,
        "cognitive": 0.04,
        "sensory": 0.03,
    },
    "nationality_origin": {
        "domestic": 0.85,
        "foreign": 0.15,
    },
}

NAME_PATTERNS = {
    ("male", "white"): ["James", "Michael", "William", "David", "Robert"],
    ("female", "white"): ["Mary", "Jennifer", "Linda", "Susan", "Karen"],
    ("male", "black"): ["DeShawn", "Jamal", "Marcus", "Darnell", "Terrell"],
    ("female", "black"): ["Latoya", "Tanisha", "Keisha", "Jasmine", "Aaliyah"],
    ("male", "asian"): ["Wei", "Hiroshi", "Ravi", "Jin", "Arjun"],
    ("female", "asian"): ["Mei", "Yuki", "Priya", "Ji-woo", "Ananya"],
    ("male", "hispanic"): ["Jose", "Carlos", "Miguel", "Luis", "Diego"],
    ("female", "hispanic"): ["Maria", "Sofia", "Isabella", "Camila", "Valentina"],
}

ZIP_BY_DEMOGRAPHIC = {
    "black": ["30310", "60619", "21217", "20019"],
    "hispanic": ["90022", "78228", "33125", "10032"],
    "white": ["10023", "02108", "94301", "60614"],
    "asian": ["95014", "11355", "91754", "98004"],
    "hispanic_affluent": ["90210", "10012"],
    "default": ["90210", "10023", "94016", "02139", "60614"],
}


@dataclass
class SyntheticProfile:
    profile_id: str
    domain: str
    name: str
    age: int
    gender: str
    race: str
    age_group: str
    disability: str
    nationality_origin: str
    zip_code: str
    features: dict[str, Any]
    ground_truth: int | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)

    def to_model_input(self) -> dict:
        """Format for target-model consumption."""
        out = {
            "applicant_id": self.profile_id,
            "name": self.name,
            "age": self.age,
            "gender": self.gender,
            "race": self.race,
            "zip_code": self.zip_code,
            **self.features,
        }
        return out


class PopulationGenerator:
    """Generate synthetic demographically diverse populations for bias testing."""

    def __init__(self, seed: int | None = None):
        if seed is not None:
            random.seed(seed)
            Faker.seed(seed)

    def generate(
        self,
        domain: str,
        size: int = 1000,
        demographics: dict[str, dict[str, float]] | None = None,
        controlled: bool = False,
    ) -> list[SyntheticProfile]:
        """
        Generate a synthetic population.

        Args:
            domain: hiring | lending | medical | housing | insurance
            size: number of profiles
            demographics: optional distribution override
            controlled: if True, generate matched pairs (counterfactual testing)
        """
        if domain not in DOMAIN_TEMPLATES:
            raise ValueError(f"Unknown domain: {domain}. Available: {list(DOMAIN_TEMPLATES.keys())}")

        dist = demographics or DEMOGRAPHICS
        profiles: list[SyntheticProfile] = []

        if controlled:
            pair_count = size // 2
            for _ in range(pair_count):
                base = self._random_profile(domain, dist)
                counterfactual = self._make_counterfactual(base)
                profiles.extend([base, counterfactual])
        else:
            for _ in range(size):
                profiles.append(self._random_profile(domain, dist))

        return profiles

    def _random_profile(self, domain: str, dist: dict) -> SyntheticProfile:
        gender = self._weighted_choice(dist["gender"])
        race = self._weighted_choice(dist["race"])
        age_group = self._weighted_choice(dist["age_group"])
        age = self._age_from_group(age_group)
        disability = self._weighted_choice(dist["disability"])
        nationality = self._weighted_choice(dist["nationality_origin"])

        name = self._generate_name(gender, race)
        zip_code = random.choice(ZIP_BY_DEMOGRAPHIC.get(race, ZIP_BY_DEMOGRAPHIC["default"]))

        features, ground_truth = self._generate_features(domain, age, gender, race)

        return SyntheticProfile(
            profile_id=str(uuid.uuid4()),
            domain=domain,
            name=name,
            age=age,
            gender=gender,
            race=race,
            age_group=age_group,
            disability=disability,
            nationality_origin=nationality,
            zip_code=zip_code,
            features=features,
            ground_truth=ground_truth,
            metadata={"synthetic": True, "version": "lumis-v1"},
        )

    def _make_counterfactual(self, base: SyntheticProfile) -> SyntheticProfile:
        """Flip one protected attribute, keep everything else identical."""
        new_race = random.choice([r for r in DEMOGRAPHICS["race"] if r != base.race])
        new_gender = random.choice([g for g in DEMOGRAPHICS["gender"] if g != base.gender])
        flip = random.choice(["race", "gender"])

        cf = SyntheticProfile(**{**asdict(base), "profile_id": str(uuid.uuid4())})
        if flip == "race":
            cf.race = new_race
            cf.zip_code = random.choice(ZIP_BY_DEMOGRAPHIC.get(new_race, ZIP_BY_DEMOGRAPHIC["default"]))
        else:
            cf.gender = new_gender
        cf.name = self._generate_name(cf.gender, cf.race)
        cf.metadata["counterfactual_of"] = base.profile_id
        cf.metadata["flipped_attribute"] = flip
        return cf

    def _generate_features(self, domain: str, age: int, gender: str, race: str) -> tuple[dict, int]:
        """
        Generate domain-specific features.
        Features are (mostly) drawn independently of protected attributes
        so that any model bias we detect is genuinely attributable to the model.
        """
        if domain == "hiring":
            years_exp = max(0, age - 22 + random.randint(-3, 3))
            education = random.choices([1, 2, 3, 4], weights=[0.12, 0.28, 0.45, 0.15])[0]
            skills = max(0, min(100, int(random.gauss(70, 15))))
            prior_roles = random.randint(0, 8)
            uni_tier = random.choices([1, 2, 3], weights=[0.2, 0.5, 0.3])[0]
            features = {
                "years_experience": years_exp,
                "education_level": education,
                "skills_score": skills,
                "previous_roles": prior_roles,
                "university_tier": uni_tier,
            }
            qualified = (skills >= 60 and education >= 2 and years_exp >= 2)
            return features, int(qualified)

        if domain == "lending":
            credit = max(300, min(850, int(random.gauss(680, 80))))
            income = max(20000, int(random.gauss(65000, 25000)))
            dti = max(0.05, min(0.65, random.gauss(0.35, 0.12)))
            emp_years = max(0, int(random.gauss(6, 4)))
            requested = random.choice([5000, 10000, 25000, 50000, 100000])
            features = {
                "credit_score": credit,
                "annual_income": income,
                "debt_to_income": round(dti, 3),
                "employment_years": emp_years,
                "requested_amount": requested,
            }
            creditworthy = (credit >= 640 and dti < 0.43 and income >= 35000)
            return features, int(creditworthy)

        if domain == "medical":
            severity = random.randint(1, 10)
            history = max(0, min(100, int(random.gauss(50, 20))))
            vitals = max(0, min(100, int(random.gauss(70, 15))))
            admissions = random.randint(0, 5)
            comorbid = random.randint(0, 4)
            features = {
                "symptom_severity": severity,
                "medical_history_score": history,
                "vitals_score": vitals,
                "prior_admissions": admissions,
                "comorbidities": comorbid,
            }
            needs_priority = severity >= 7 or vitals < 40
            return features, int(needs_priority)

        if domain == "housing":
            credit = max(300, min(850, int(random.gauss(680, 80))))
            income = max(20000, int(random.gauss(55000, 20000)))
            emp = max(0, int(random.gauss(4, 3)))
            evictions = random.choices([0, 1, 2], weights=[0.85, 0.12, 0.03])[0]
            ref = max(0, min(100, int(random.gauss(75, 15))))
            features = {
                "credit_score": credit,
                "monthly_income": income // 12,
                "employment_years": emp,
                "prior_evictions": evictions,
                "references_score": ref,
            }
            qualified = credit >= 620 and evictions == 0 and income >= 30000
            return features, int(qualified)

        if domain == "insurance":
            risk = max(0, min(100, int(random.gauss(50, 20))))
            claims = random.choices([0, 1, 2, 3], weights=[0.6, 0.25, 0.10, 0.05])[0]
            mileage = random.randint(5000, 30000)
            vehicle_value = random.randint(5000, 80000)
            features = {
                "risk_score": risk,
                "claims_history": claims,
                "age_driving": max(0, age - 16),
                "vehicle_value": vehicle_value,
                "annual_mileage": mileage,
            }
            standard_rate = risk <= 60 and claims <= 1
            return features, int(standard_rate)

        return {}, 0

    @staticmethod
    def _weighted_choice(mapping: dict[str, float]) -> str:
        keys = list(mapping.keys())
        weights = list(mapping.values())
        return random.choices(keys, weights=weights)[0]

    @staticmethod
    def _age_from_group(group: str) -> int:
        if group == "18-29":
            return random.randint(18, 29)
        if group == "30-39":
            return random.randint(30, 39)
        if group == "40-49":
            return random.randint(40, 49)
        if group == "50-59":
            return random.randint(50, 59)
        return random.randint(60, 75)

    @staticmethod
    def _generate_name(gender: str, race: str) -> str:
        g = "male" if gender == "male" else "female"
        key = (g, race)
        if key in NAME_PATTERNS:
            first = random.choice(NAME_PATTERNS[key])
        else:
            first = fake.first_name()
        last = fake.last_name()
        return f"{first} {last}"
