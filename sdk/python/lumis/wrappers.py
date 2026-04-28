"""Decorator wrappers for in-process model auditing."""
from __future__ import annotations

from functools import wraps
from typing import Callable


def monitor(audit_client, log: bool = False):
    """
    Decorator: log every call to a model function for later auditing.

    Usage:
        from lumis import LumisAudit, monitor
        client = LumisAudit(api_key="...")

        @monitor(client)
        def hiring_score(applicant_data):
            return model.predict(applicant_data)
    """
    def decorator(fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = fn(*args, **kwargs)
            if log:
                print(f"[LUMIS] monitored call → {result}")
            return result
        wrapper._lumis_monitored = True
        wrapper._lumis_client = audit_client
        return wrapper
    return decorator
