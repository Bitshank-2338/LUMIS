"""
Unified LLM client.

Tries providers in order:
  1. Google Vertex AI Gemini (if GOOGLE_CLOUD_PROJECT set)
  2. OpenAI-compatible (if LLM_API_KEY set)
  3. Local heuristic fallback (always works for demo)

Lets the rest of the system call llm.chat() / llm.complete() without
caring which backend powers it.
"""
from __future__ import annotations

import os
import json
from typing import Iterable


class LLMClient:
    def __init__(self):
        self.provider = self._select_provider()
        self._client = None
        self._init_client()

    def _select_provider(self) -> str:
        if os.getenv("GOOGLE_CLOUD_PROJECT") and os.getenv("USE_VERTEX_AI", "true").lower() == "true":
            try:
                import vertexai  # noqa: F401
                return "vertex"
            except ImportError:
                pass
        if os.getenv("LLM_API_KEY"):
            return "openai"
        return "fallback"

    def _init_client(self):
        if self.provider == "vertex":
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel
                vertexai.init(
                    project=os.getenv("GOOGLE_CLOUD_PROJECT"),
                    location=os.getenv("VERTEX_LOCATION", "us-central1"),
                )
                model_name = os.getenv("VERTEX_MODEL", "gemini-1.5-flash")
                self._client = GenerativeModel(model_name)
            except Exception as e:
                print(f"[LLM] Vertex AI init failed: {e}, falling back")
                self.provider = "openai" if os.getenv("LLM_API_KEY") else "fallback"
                self._init_client()

        elif self.provider == "openai":
            try:
                from openai import OpenAI
                self._client = OpenAI(
                    api_key=os.getenv("LLM_API_KEY"),
                    base_url=os.getenv("LLM_BASE_URL", "https://api.openai.com/v1"),
                )
            except Exception as e:
                print(f"[LLM] OpenAI init failed: {e}, falling back")
                self.provider = "fallback"

    def chat(
        self,
        messages: list[dict],
        system: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """
        Chat completion.
        messages: list of {"role": "user"|"assistant", "content": str}
        """
        if self.provider == "vertex":
            return self._vertex_chat(messages, system, max_tokens, temperature)
        if self.provider == "openai":
            return self._openai_chat(messages, system, max_tokens, temperature)
        return self._fallback_chat(messages, system)

    def _vertex_chat(self, messages, system, max_tokens, temperature) -> str:
        try:
            from vertexai.generative_models import Content, Part
            history = []
            if system:
                history.append(Content(role="user", parts=[Part.from_text(f"[SYSTEM]\n{system}")]))
                history.append(Content(role="model", parts=[Part.from_text("Understood.")]))
            for m in messages[:-1]:
                role = "model" if m["role"] == "assistant" else "user"
                history.append(Content(role=role, parts=[Part.from_text(m["content"])]))

            chat = self._client.start_chat(history=history)
            last = messages[-1]["content"]
            response = chat.send_message(
                last,
                generation_config={"max_output_tokens": max_tokens, "temperature": temperature},
            )
            return response.text
        except Exception as e:
            return f"[LLM error: {e}]"

    def _openai_chat(self, messages, system, max_tokens, temperature) -> str:
        try:
            full_messages = []
            if system:
                full_messages.append({"role": "system", "content": system})
            full_messages.extend(messages)
            response = self._client.chat.completions.create(
                model=os.getenv("LLM_MODEL_NAME", "gpt-4o-mini"),
                messages=full_messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"[LLM error: {e}]"

    def _fallback_chat(self, messages, system) -> str:
        """No LLM available — return a templated response based on context."""
        last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        ctx = (system or "") + " " + last_user
        ctx_lower = ctx.lower()

        if "rejected" in ctx_lower or "denied" in ctx_lower or "why" in ctx_lower:
            return (
                "Based on my profile data, the model rejected me despite my qualifications. "
                "I noticed candidates with similar skills but different demographics received different outcomes. "
                "This suggests the model is using protected attributes (or proxies) in ways that may violate fairness norms. "
                "(Note: this is a fallback response — set LLM_API_KEY or GOOGLE_CLOUD_PROJECT for richer interactions.)"
            )
        if "fair" in ctx_lower or "bias" in ctx_lower:
            return (
                "Looking at the cohort data, there's measurable disparity across demographic groups. "
                "The model's decision boundary appears to shift based on attributes that shouldn't be relevant to merit."
            )
        return (
            "I'm a synthetic profile generated for this audit. I can describe my characteristics and the model's decision about me. "
            "What would you like to know? (Configure LLM_API_KEY for full conversation.)"
        )


_singleton: LLMClient | None = None


def get_llm() -> LLMClient:
    global _singleton
    if _singleton is None:
        _singleton = LLMClient()
    return _singleton
