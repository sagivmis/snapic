from __future__ import annotations

import os


def init_sentry() -> None:
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return

    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    traces_rate = os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")
    try:
        sample_rate = float(traces_rate)
    except ValueError:
        sample_rate = 0.1

    sentry_sdk.init(
        dsn=dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=sample_rate,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        release=os.getenv("SENTRY_RELEASE") or None,
        send_default_pii=False,
    )
