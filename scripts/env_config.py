#!/usr/bin/env python3
"""Load environment-specific website-designer settings from .env (no hardcoding).

Lookup order for each key:
  1) process environment
  2) repo-root .env
  3) built-in defaults (local-safe, not a specific machine)

Never put host-specific MagicDNS names in source.
"""
from __future__ import annotations

import os
from pathlib import Path

# scripts/ -> repo root
ROOT = Path(__file__).resolve().parent.parent


def _parse_dotenv(path: Path) -> dict[str, str]:
    if not path.is_file():
        return {}
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip("'").strip('"')
        if key:
            out[key] = val
    return out


_DOTENV = _parse_dotenv(ROOT / ".env")


def env(key: str, default: str | None = None) -> str | None:
    if key in os.environ and os.environ[key] != "":
        return os.environ[key]
    if key in _DOTENV and _DOTENV[key] != "":
        return _DOTENV[key]
    return default


def require_env(key: str, default: str | None = None) -> str:
    val = env(key, default)
    if val is None or val == "":
        raise SystemExit(
            f"Missing required config `{key}`. "
            f"Set it in the environment or copy .env.example → .env"
        )
    return val


def repo_root() -> Path:
    """Allow WEB_DESIGNER_ROOT override; default = this repository root."""
    override = env("WEB_DESIGNER_ROOT")
    if override:
        return Path(override).expanduser().resolve()
    return ROOT


def _base_url(scheme: str, host: str, port: int | str) -> str:
    host = host.strip().rstrip("/")
    # host may already include scheme
    if host.startswith("http://") or host.startswith("https://"):
        base = host.rstrip("/")
        # if caller also passed port and host has no explicit port, append
        if "://" in base:
            after = base.split("://", 1)[1]
            if ":" not in after.split("/")[0]:
                return f"{base}:{port}"
        return base
    return f"{scheme}://{host}:{port}"


def preview_port() -> int:
    return int(require_env("WEB_DESIGNER_PREVIEW_PORT", "4321"))


def report_port() -> int:
    return int(require_env("WEB_DESIGNER_REPORT_PORT", "8766"))


def preview_scheme() -> str:
    return require_env("WEB_DESIGNER_PREVIEW_SCHEME", "http")


def preview_host() -> str:
    # Prefer explicit host; fall back to Tailscale IP / localhost for local use
    return require_env(
        "WEB_DESIGNER_PREVIEW_HOST",
        env("WEB_DESIGNER_TAILSCALE_HOST", "127.0.0.1") or "127.0.0.1",
    )


def preview_base() -> str:
    override = env("WEB_DESIGNER_PREVIEW_BASE")
    if override:
        return override.rstrip("/")
    return _base_url(preview_scheme(), preview_host(), preview_port())


def report_base() -> str:
    override = env("WEB_DESIGNER_REPORT_BASE")
    if override:
        return override.rstrip("/")
    return _base_url(preview_scheme(), preview_host(), report_port())


def public_urls() -> dict[str, str]:
    return {
        "preview_base": preview_base(),
        "report_base": report_base(),
        "preview_host": preview_host(),
        "preview_port": str(preview_port()),
        "report_port": str(report_port()),
        "scheme": preview_scheme(),
    }
