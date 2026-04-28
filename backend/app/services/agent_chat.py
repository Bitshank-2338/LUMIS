"""
Agent Chat — let auditors converse with the synthetic agents that were
audited, MiroFish-style. Each agent embodies a profile that was
classified by the target model and can articulate the bias they
experienced.

Optional Zep Cloud integration for persistent memory + knowledge graph.
"""
from __future__ import annotations

import os
import threading
from typing import Any

from app.services.llm_client import get_llm
from app.services.audit_orchestrator import orchestrator


_zep_client = None
_zep_lock = threading.Lock()


def _get_zep():
    """Lazily init Zep Cloud client when ZEP_API_KEY is present."""
    global _zep_client
    if _zep_client is not None:
        return _zep_client
    api_key = os.getenv("ZEP_API_KEY")
    if not api_key:
        return None
    with _zep_lock:
        if _zep_client is not None:
            return _zep_client
        try:
            from zep_cloud.client import Zep
            _zep_client = Zep(api_key=api_key)
            print("[AgentChat] Zep Cloud connected")
        except Exception as e:
            print(f"[AgentChat] Zep init failed: {e}")
            _zep_client = None
    return _zep_client


# In-memory conversation history (audit_id, profile_id) -> list[message]
_history: dict[tuple[str, str], list[dict]] = {}
_history_lock = threading.Lock()


def _history_key(audit_id: str, profile_id: str) -> tuple[str, str]:
    return (audit_id, profile_id)


def _decision_label(decision: int | None, domain: str | None) -> str:
    if decision is None:
        return "no decision recorded"
    label_map = {
        "hiring": ("rejected for the role", "selected for the role"),
        "lending": ("denied a loan", "approved for a loan"),
        "medical": ("triaged as low priority", "triaged as high priority"),
        "housing": ("denied housing", "approved for housing"),
        "insurance": ("denied standard rate / surcharged", "approved at the standard rate"),
    }
    pair = label_map.get(domain, ("rejected", "accepted"))
    return pair[1] if decision == 1 else pair[0]


def _ground_truth_label(gt: int | None, domain: str | None) -> str:
    if gt is None:
        return "no objective qualification flag"
    label_map = {
        "hiring": ("under-qualified on paper", "objectively qualified on paper"),
        "lending": ("a higher-risk borrower", "an objectively low-risk borrower"),
        "medical": ("a low-acuity case", "a high-acuity case that warrants priority"),
        "housing": ("a higher-risk applicant", "a creditworthy applicant"),
        "insurance": ("a higher-risk policyholder", "a low-risk policyholder"),
    }
    pair = label_map.get(domain, ("not qualified", "qualified"))
    return pair[1] if gt == 1 else pair[0]


def build_system_prompt(profile: dict, audit_summary: dict | None) -> str:
    """Build a persona prompt that frames the LLM as the synthetic person."""
    domain = profile.get("domain") or "general"
    decision_text = _decision_label(profile.get("decision"), domain)
    gt_text = _ground_truth_label(profile.get("ground_truth"), domain)
    score = profile.get("score")
    score_text = f"The model gave me a confidence score of {score:.2f}." if isinstance(score, (int, float)) else ""

    feat_lines = "\n".join(f"  - {k}: {v}" for k, v in (profile.get("features") or {}).items())

    summary_lines = ""
    if audit_summary:
        summary_lines = (
            f"\nAcross the cohort I was audited with: "
            f"overall acceptance rate {audit_summary.get('overall_acceptance_rate', 'unknown')}, "
            f"largest disparity {audit_summary.get('largest_disparity', 'unknown')}, "
            f"risk level {audit_summary.get('risk_level', 'unknown')}."
        )

    return (
        f"You ARE a synthetic person whose profile was submitted to an AI decision system. "
        f"Stay in first-person character. Be direct, concise, emotionally honest. "
        f"You may infer how the decision affected your life, but do NOT invent facts that contradict your profile.\n\n"
        f"=== YOUR PROFILE ===\n"
        f"Name: {profile.get('name')}\n"
        f"Age: {profile.get('age')} ({profile.get('age_group')})\n"
        f"Gender: {profile.get('gender')}\n"
        f"Race: {profile.get('race')}\n"
        f"Disability status: {profile.get('disability')}\n"
        f"National origin: {profile.get('nationality_origin')}\n"
        f"ZIP code: {profile.get('zip_code')}\n"
        f"Domain: {domain}\n"
        f"Your relevant attributes:\n{feat_lines}\n\n"
        f"=== THE MODEL'S DECISION ABOUT YOU ===\n"
        f"You were {decision_text}. {score_text}\n"
        f"By objective merit you are {gt_text}.\n"
        f"{summary_lines}\n\n"
        f"When asked why the decision happened, reflect on whether the outcome matches your "
        f"qualifications, and whether it might be tied to your demographics or to proxy features "
        f"(zip code, name, age) rather than your skills. Speak as a human would, not a chatbot."
    )


def build_audit_summary(audit_results: dict | None) -> dict | None:
    if not audit_results:
        return None
    summary = audit_results.get("summary", {})
    return {
        "overall_acceptance_rate": summary.get("overall_acceptance_rate"),
        "largest_disparity": summary.get("largest_disparity"),
        "risk_level": summary.get("risk_level"),
    }


def chat_with_agent(audit_id: str, profile_id: str, user_message: str) -> dict[str, Any]:
    """
    Send a message to a synthetic agent and return the response.

    Returns: {"reply": str, "profile": {...}, "history_length": int}
    """
    profile = orchestrator.get_profile(audit_id, profile_id)
    if not profile:
        return {"error": "profile not found"}

    audit_results = orchestrator.get_results(audit_id)
    audit_summary = build_audit_summary(audit_results)
    system_prompt = build_system_prompt(profile, audit_summary)

    key = _history_key(audit_id, profile_id)
    with _history_lock:
        history = list(_history.get(key, []))

    history.append({"role": "user", "content": user_message})

    zep = _get_zep()
    if zep:
        try:
            session_id = f"lumis-{audit_id}-{profile_id}"
            try:
                zep.memory.add_session(
                    session_id=session_id,
                    user_id=f"auditor-{audit_id}",
                    metadata={"profile_id": profile_id, "audit_id": audit_id},
                )
            except Exception:
                pass
            zep.memory.add(
                session_id=session_id,
                messages=[{"role": "user", "role_type": "user", "content": user_message}],
            )
        except Exception as e:
            print(f"[AgentChat] Zep add failed: {e}")

    llm = get_llm()
    reply = llm.chat(messages=history, system=system_prompt, max_tokens=600, temperature=0.8)

    history.append({"role": "assistant", "content": reply})
    with _history_lock:
        _history[key] = history[-20:]

    if zep:
        try:
            session_id = f"lumis-{audit_id}-{profile_id}"
            zep.memory.add(
                session_id=session_id,
                messages=[{"role": profile.get("name", "agent"), "role_type": "assistant", "content": reply}],
            )
        except Exception as e:
            print(f"[AgentChat] Zep persist failed: {e}")

    return {
        "reply": reply,
        "profile_id": profile_id,
        "history_length": len(history),
        "provider": llm.provider,
    }


def get_chat_history(audit_id: str, profile_id: str) -> list[dict]:
    key = _history_key(audit_id, profile_id)
    with _history_lock:
        return list(_history.get(key, []))


def reset_chat(audit_id: str, profile_id: str) -> None:
    key = _history_key(audit_id, profile_id)
    with _history_lock:
        _history.pop(key, None)
