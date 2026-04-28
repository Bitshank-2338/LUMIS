"use client";

/**
 * Global AI Compliance Center — the "what laws apply to my model" page.
 * Becomes a sales tool: every CISO/legal team Googles "EU AI Act compliance"
 * and lands here.
 */

import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Globe,
  Scale,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  HeartPulse,
  CreditCard,
  Briefcase,
  Home as HomeIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Law = {
  id: string;
  name: string;
  jurisdiction: string;
  flag: string;
  status: "in_force" | "phasing_in" | "proposed";
  fine: string;
  scope: string;
  appliesTo: string[];
  keyRequirements: string[];
  lumisCovers: string[];
  citation: string;
  url: string;
};

const LAWS: Law[] = [
  {
    id: "eu_ai_act",
    name: "EU AI Act",
    jurisdiction: "European Union",
    flag: "🇪🇺",
    status: "in_force",
    fine: "Up to €35M or 7% of global revenue",
    scope: "Any AI system used in the EU — even by non-EU companies",
    appliesTo: ["hiring", "lending", "education", "law_enforcement", "essential_services", "biometrics"],
    keyRequirements: [
      "Article 9: Risk management system for high-risk AI",
      "Article 10: Data governance — training data must be representative & bias-tested",
      "Article 13: Transparency to users that AI is in use",
      "Article 14: Human oversight requirements",
      "Article 15: Accuracy, robustness & cybersecurity",
      "Conformity assessment + CE marking before market entry",
    ],
    lumisCovers: [
      "Demographic Parity Difference (Art. 10)",
      "Equalized Odds (Art. 10)",
      "Counterfactual Fairness (Art. 9)",
      "Auto-generated conformity assessment package",
      "Continuous monitoring → meets Art. 17 logging duty",
    ],
    citation: "Regulation (EU) 2024/1689",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
  },
  {
    id: "us_eeoc",
    name: "EEOC Uniform Guidelines (4/5ths Rule)",
    jurisdiction: "United States",
    flag: "🇺🇸",
    status: "in_force",
    fine: "Class action damages, back-pay, injunctive relief",
    scope: "Any employer using automated employment decisions",
    appliesTo: ["hiring", "promotion", "termination"],
    keyRequirements: [
      "Selection rate for any protected group ≥ 80% of highest group",
      "Disparate impact analysis on race, gender, age, national origin",
      "Validation studies if disparate impact exists",
      "Recordkeeping of selection rates (29 CFR 1607)",
    ],
    lumisCovers: [
      "Disparate Impact Ratio (the 4/5ths rule itself)",
      "Per-group acceptance rates with statistical confidence",
      "Chi-squared significance tests",
      "Auto-generated EEOC adverse impact analysis report",
    ],
    citation: "29 CFR Part 1607",
    url: "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XIV/part-1607",
  },
  {
    id: "nyc_law_144",
    name: "NYC Local Law 144 (AEDT)",
    jurisdiction: "New York City",
    flag: "🇺🇸",
    status: "in_force",
    fine: "$500–$1,500 per violation, per day",
    scope: "Automated Employment Decision Tools used on NYC residents",
    appliesTo: ["hiring", "promotion"],
    keyRequirements: [
      "Annual independent bias audit by qualified third party",
      "Public-facing summary of audit results",
      "Notification to candidates ≥ 10 business days before AEDT use",
      "Audit covers race × gender × intersectional groups",
    ],
    lumisCovers: [
      "Independent third-party audits (we are the auditor)",
      "Intersectional analysis (race × gender)",
      "Public-facing audit summary template",
      "Annual re-audit subscription tier",
    ],
    citation: "NYC Admin. Code §20-870",
    url: "https://rules.cityofnewyork.us/wp-content/uploads/2023/04/DCWP-NOA-for-Use-of-Automated-Employment-Decisionmaking-Tools-2.pdf",
  },
  {
    id: "ecoa",
    name: "Equal Credit Opportunity Act (ECOA)",
    jurisdiction: "United States",
    flag: "🇺🇸",
    status: "in_force",
    fine: "Punitive damages + CFPB enforcement actions",
    scope: "Any creditor making credit decisions (banks, fintech, BNPL, auto)",
    appliesTo: ["lending", "credit_cards", "mortgages", "BNPL", "auto_finance"],
    keyRequirements: [
      "No disparate treatment by race, color, religion, national origin, sex, marital status, age",
      "Adverse action notice within 30 days with specific reasons",
      "Regulation B (12 CFR 1002) — recordkeeping & monitoring",
      "CFPB Circular 2022-03: ML-specific adverse action explanations required",
    ],
    lumisCovers: [
      "Disparate Impact + Treatment analysis",
      "Adverse action reason codes (SHAP-based)",
      "Proxy detection (zip codes, names)",
      "CFPB Circular 2022-03 compliance reports",
    ],
    citation: "15 U.S.C. §1691; 12 CFR 1002",
    url: "https://www.consumerfinance.gov/rules-policy/regulations/1002/",
  },
  {
    id: "gdpr_22",
    name: "GDPR Article 22",
    jurisdiction: "European Union",
    flag: "🇪🇺",
    status: "in_force",
    fine: "Up to €20M or 4% of global revenue",
    scope: "Automated individual decision-making with legal/significant effects",
    appliesTo: ["hiring", "lending", "insurance", "any_significant_decision"],
    keyRequirements: [
      "Right not to be subject to solely automated decisions",
      "Right to human intervention, explanation, contestation",
      "Suitable safeguards including specific information about logic involved",
      "Special protection for sensitive personal data",
    ],
    lumisCovers: [
      "Counterfactual explanations per individual",
      "Automated reason-code generation",
      "Right-to-contestation appeal workflow (planned)",
      "Sensitive attribute proxy detection",
    ],
    citation: "Regulation (EU) 2016/679, Article 22",
    url: "https://gdpr-info.eu/art-22-gdpr/",
  },
  {
    id: "us_eo_14110",
    name: "US Executive Order on AI Safety",
    jurisdiction: "United States (Federal)",
    flag: "🇺🇸",
    status: "in_force",
    fine: "Federal contract loss + agency enforcement",
    scope: "Federal agencies + contractors using AI in consequential decisions",
    appliesTo: ["federal_hiring", "federal_benefits", "law_enforcement_AI", "healthcare_AI"],
    keyRequirements: [
      "NIST AI Risk Management Framework adoption",
      "Pre-deployment testing & red-teaming",
      "Civil rights impact assessment",
      "OMB M-24-10 minimum risk practices",
    ],
    lumisCovers: [
      "NIST AI RMF GOVERN-1 through MEASURE-2.11 alignment",
      "Civil rights impact assessment template",
      "Pre-deployment red-team simulation (MiroFish adversarial agents)",
    ],
    citation: "Executive Order 14110 (Oct 30, 2023) + OMB M-24-10",
    url: "https://www.whitehouse.gov/briefing-room/presidential-actions/2023/10/30/executive-order-on-the-safe-secure-and-trustworthy-development-and-use-of-artificial-intelligence/",
  },
  {
    id: "california_ai",
    name: "California SB-1001 + AB-2930",
    jurisdiction: "California",
    flag: "🇺🇸",
    status: "phasing_in",
    fine: "$25,000 per violation (AB-2930)",
    scope: "Automated decision tools used on California residents",
    appliesTo: ["hiring", "lending", "education", "housing", "healthcare"],
    keyRequirements: [
      "Bot disclosure (SB-1001)",
      "Pre-deployment impact assessment (AB-2930)",
      "Annual audit + adverse-impact analysis",
      "Right of access & contestation",
    ],
    lumisCovers: [
      "Pre-deployment impact assessment generator",
      "Annual subscription audits",
      "Per-individual contestation reports",
    ],
    citation: "Cal. Bus. & Prof. Code §17940; AB-2930 (2024)",
    url: "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2930",
  },
  {
    id: "uk_ai_white_paper",
    name: "UK Pro-Innovation AI Approach + Equality Act 2010",
    jurisdiction: "United Kingdom",
    flag: "🇬🇧",
    status: "in_force",
    fine: "Unlimited damages under Equality Act",
    scope: "Any AI causing unlawful discrimination (race, sex, age, disability, etc.)",
    appliesTo: ["all_consequential_AI"],
    keyRequirements: [
      "Equality Act 2010 §19 indirect-discrimination test",
      "ICO Guidance on AI and data protection",
      "DSIT context-specific principles (safety, transparency, fairness)",
    ],
    lumisCovers: [
      "Indirect discrimination test (statistical)",
      "ICO data-protection-by-design checklist",
    ],
    citation: "Equality Act 2010 §19; AI Regulation White Paper (CP 815)",
    url: "https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach",
  },
  {
    id: "canada_aida",
    name: "Canada AIDA (Bill C-27)",
    jurisdiction: "Canada",
    flag: "🇨🇦",
    status: "proposed",
    fine: "Up to CAD $25M or 5% of global revenue",
    scope: "High-impact AI systems in interprovincial/international trade",
    appliesTo: ["hiring", "lending", "essential_services", "biometrics"],
    keyRequirements: [
      "Risk assessment + mitigation plan",
      "Anonymized data governance",
      "Material harm reporting to Minister",
      "Public transparency information",
    ],
    lumisCovers: [
      "Risk assessment package",
      "Synthetic-population audit (no real PII = automatic anonymization)",
    ],
    citation: "Bill C-27 (Digital Charter Implementation Act)",
    url: "https://www.parl.ca/legisinfo/en/bill/44-1/c-27",
  },
  {
    id: "brazil_lgpd_ai",
    name: "Brazil PL 2338/2023 (AI Bill)",
    jurisdiction: "Brazil",
    flag: "🇧🇷",
    status: "proposed",
    fine: "Up to BRL 50M per violation",
    scope: "AI providers and operators in Brazilian territory",
    appliesTo: ["high_risk_AI", "biometrics", "credit_scoring"],
    keyRequirements: [
      "Algorithmic impact assessment",
      "Right to explanation & contestation",
      "Human oversight",
      "Discrimination audits",
    ],
    lumisCovers: [
      "Algorithmic impact assessment in Portuguese",
      "Discrimination audit reports",
    ],
    citation: "Projeto de Lei nº 2338/2023",
    url: "https://www25.senado.leg.br/web/atividade/materias/-/materia/157233",
  },
  {
    id: "china_genai",
    name: "China Generative AI Measures + PIPL",
    jurisdiction: "China",
    flag: "🇨🇳",
    status: "in_force",
    fine: "Up to ¥50M or 5% of revenue (PIPL)",
    scope: "Generative AI services and personal-info processing",
    appliesTo: ["genAI_services", "recommendation_algorithms", "deepfakes"],
    keyRequirements: [
      "CAC algorithm filing (备案) before launch",
      "Content moderation & socialist core values alignment",
      "Discrimination prevention in training data",
      "User consent + impact assessment",
    ],
    lumisCovers: [
      "Algorithm filing dossier preparation",
      "Discrimination-prevention audit reports",
    ],
    citation: "网信办 [2023] No. 15 / PIPL 2021",
    url: "https://www.cac.gov.cn/2023-07/13/c_1690898327029107.htm",
  },
  {
    id: "fair_housing",
    name: "US Fair Housing Act + HUD AI Guidance",
    jurisdiction: "United States",
    flag: "🇺🇸",
    status: "in_force",
    fine: "Up to $109,479 first violation; $250k+ for patterns",
    scope: "Algorithmic tenant screening, housing ads, mortgage lending",
    appliesTo: ["housing", "tenant_screening", "mortgage", "real_estate_ads"],
    keyRequirements: [
      "FHA §3604 — no discrimination by race, color, religion, sex, familial status, national origin, disability",
      "HUD 2024 guidance on AI tenant-screening tools",
      "Disparate impact analysis (Texas Dept. of Housing v. ICP, 2015)",
    ],
    lumisCovers: [
      "Tenant-screening algorithm audit",
      "Disparate impact analysis with cohort statistics",
      "HUD complaint defense documentation",
    ],
    citation: "42 U.S.C. §3604; HUD Office of Fair Housing 2024 guidance",
    url: "https://www.hud.gov/sites/dfiles/FHEO/documents/FHEO_Tenant_Screening_Guidance.pdf",
  },
];

const DOMAIN_ICONS: Record<string, any> = {
  hiring: Briefcase,
  lending: CreditCard,
  housing: HomeIcon,
  healthcare: HeartPulse,
  insurance: ShieldCheck,
};

export default function LawsPage() {
  const [filter, setFilter] = useState<string>("all");
  const [activeJurisdiction, setActiveJurisdiction] = useState<string>("all");

  const filtered = LAWS.filter((l) => {
    if (filter !== "all" && !l.appliesTo.some((a) => a.includes(filter))) return false;
    if (activeJurisdiction !== "all" && !l.jurisdiction.toLowerCase().includes(activeJurisdiction)) return false;
    return true;
  });

  const inForce = LAWS.filter((l) => l.status === "in_force").length;
  const totalFines = "€35M + 7% revenue (max)";

  return (
    <main className="min-h-screen">
      <nav className="border-b border-border/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMIS</span>
            <span className="text-xs text-slate-500">/ Global Compliance Center</span>
          </Link>
          <Link
            href="/dashboard/new"
            className="px-4 py-2 rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white text-sm font-medium"
          >
            Audit my model
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-400 mb-4">
            <Globe className="w-3.5 h-3.5" />
            12 jurisdictions · {inForce} laws in force · 1 audit covers all
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Every AI law on Earth — <span className="bg-gradient-to-r from-pink-400 to-orange-400 bg-clip-text text-transparent">covered in one audit</span>
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            LUMIS auto-maps your model against every major AI regulation worldwide. One run produces compliance evidence for EU, US, UK, Canada, Brazil, China — simultaneously.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <KPI label="Laws in force" value={`${inForce}`} icon={Scale} color="#10B981" />
          <KPI label="Jurisdictions" value="12" icon={Globe} color="#60A5FA" />
          <KPI label="Max fine" value={totalFines} icon={AlertTriangle} color="#F472B6" />
          <KPI label="LUMIS coverage" value="100%" icon={ShieldCheck} color="#A78BFA" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Filter:</span>
          <div className="flex flex-wrap gap-1 border border-border rounded-lg p-1">
            {["all", "hiring", "lending", "housing", "healthcare", "biometrics"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs transition capitalize",
                  filter === f ? "bg-accent-primary/20 text-accent-glow" : "text-slate-400 hover:text-white"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1 border border-border rounded-lg p-1">
            {[
              { key: "all", flag: "🌐" },
              { key: "european", flag: "🇪🇺" },
              { key: "united states", flag: "🇺🇸" },
              { key: "united kingdom", flag: "🇬🇧" },
              { key: "canada", flag: "🇨🇦" },
              { key: "brazil", flag: "🇧🇷" },
              { key: "china", flag: "🇨🇳" },
            ].map((j) => (
              <button
                key={j.key}
                onClick={() => setActiveJurisdiction(j.key)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs transition capitalize",
                  activeJurisdiction === j.key ? "bg-accent-primary/20 text-accent-glow" : "text-slate-400 hover:text-white"
                )}
              >
                {j.flag} {j.key === "all" ? "All" : ""}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Law cards */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((law) => (
            <LawCard key={law.id} law={law} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500">No laws match your filters.</div>
        )}
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24 text-center">
        <div className="glow-card rounded-3xl p-12">
          <ShieldCheck className="w-12 h-12 text-accent-glow mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">One audit. Every regulator covered.</h2>
          <p className="text-slate-400 max-w-xl mx-auto mb-8">
            Drop in your model, run a single LUMIS audit, and download regulator-ready compliance packages for EU AI Act, EEOC, ECOA, GDPR, NYC LL144, and 7 more.
          </p>
          <Link
            href="/dashboard/new"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold"
          >
            Run a global compliance audit →
          </Link>
        </div>
      </section>
    </main>
  );
}

function KPI({ label, value, icon: Icon, color }: any) {
  return (
    <div className="glow-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function LawCard({ law }: { law: Law }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor =
    law.status === "in_force"
      ? "bg-severity-critical/15 text-severity-critical border-severity-critical/40"
      : law.status === "phasing_in"
      ? "bg-severity-high/15 text-severity-high border-severity-high/40"
      : "bg-slate-500/15 text-slate-400 border-slate-500/40";

  return (
    <div className="glow-card rounded-2xl p-6 hover:border-accent-primary/40 transition">
      <div className="flex items-start gap-4 mb-4">
        <div className="text-3xl">{law.flag}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full uppercase font-medium border", statusColor)}>
              {law.status.replace("_", " ")}
            </span>
            <span className="text-[10px] text-slate-500">{law.jurisdiction}</span>
          </div>
          <h3 className="text-lg font-bold leading-tight mb-1">{law.name}</h3>
          <p className="text-xs text-slate-400">{law.scope}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="rounded-lg bg-severity-critical/5 border border-severity-critical/20 p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Max penalty</div>
          <div className="text-severity-critical font-semibold">{law.fine}</div>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">LUMIS coverage</div>
          <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {law.lumisCovers.length} controls
          </div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 mb-4 text-xs">
          <div>
            <div className="font-semibold text-slate-300 mb-1.5">Key requirements:</div>
            <ul className="space-y-1 text-slate-400">
              {law.keyRequirements.map((req) => (
                <li key={req} className="flex items-start gap-2">
                  <span className="text-pink-400 mt-1">→</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-emerald-400 mb-1.5">How LUMIS covers it:</div>
            <ul className="space-y-1 text-slate-300">
              {law.lumisCovers.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <span className="text-[10px] text-slate-500 font-mono">{law.citation}</span>
        <div className="flex items-center gap-3">
          <a
            href={law.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            Source <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-accent-glow hover:underline"
          >
            {expanded ? "Less" : "Details →"}
          </button>
        </div>
      </div>
    </div>
  );
}
