"""Configuration API routes.

Reads / writes the active LLM provider against the shared
``deepcode_config.json``. The shape of the responses is preserved so the
existing frontend (``SettingsPage``) does not need to be rewritten in
this PR.
"""

from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from core.codex_auth import (
    CodexAuthError,
    CodexAuthNotConfigured,
    get_codex_auth_status,
    list_codex_models,
    logout_codex_auth,
    start_codex_login,
)
from core.compat.runtime import set_runtime
from core.providers.registry import find_by_name

from settings import (
    CONFIG_PATH,
    get_api_key,
    get_document_segmentation,
    get_llm_models,
    get_llm_provider,
    is_indexing_enabled,
    list_available_providers,
)
from services.openrouter_models import list_openrouter_models
from models.requests import LLMModelsUpdateRequest, LLMProviderUpdateRequest
from models.responses import (
    ConfigResponse,
    OpenRouterModelsResponse,
    SettingsResponse,
)
from core.platform_compat import write_private_json_file


router = APIRouter()


def _write_deepcode_config(config: dict) -> None:
    write_private_json_file(CONFIG_PATH, config, ensure_ascii=False)


@router.get("/settings", response_model=SettingsResponse)
async def get_settings():
    """Return the current application settings."""
    provider = get_llm_provider()
    return SettingsResponse(
        llm_provider=provider,
        models=get_llm_models(provider),
        indexing_enabled=is_indexing_enabled(),
        document_segmentation=get_document_segmentation(),
    )


@router.get("/llm-providers", response_model=ConfigResponse)
async def get_llm_providers():
    """List available providers and the currently active one."""
    current_provider = get_llm_provider()
    return ConfigResponse(
        llm_provider=current_provider,
        available_providers=list_available_providers(),
        models=get_llm_models(current_provider),
        indexing_enabled=is_indexing_enabled(),
    )


@router.get("/openrouter/models", response_model=OpenRouterModelsResponse)
async def get_openrouter_models(
    supported_parameters: str | None = None,
    force_refresh: bool = False,
):
    """Return OpenRouter model ids and metadata for the settings UI."""
    return list_openrouter_models(
        supported_parameters=supported_parameters,
        force_refresh=force_refresh,
    )


@router.get("/codex-auth/status")
async def get_codex_status() -> dict[str, object]:
    """Return Codex/ChatGPT browser-login status without exposing tokens."""
    return asdict(get_codex_auth_status(refresh=False))


@router.post("/codex-auth/login/start")
async def start_codex_auth_login() -> dict[str, object]:
    """Start Codex/ChatGPT browser login and return the authorization URL."""
    try:
        return asdict(start_codex_login())
    except CodexAuthError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err


@router.get("/codex-auth/models")
async def get_codex_models() -> dict[str, object]:
    """Return models available to the logged-in Codex/ChatGPT account."""
    try:
        return {"models": [asdict(model) for model in list_codex_models()]}
    except CodexAuthNotConfigured as err:
        raise HTTPException(status_code=401, detail=str(err)) from err
    except CodexAuthError as err:
        raise HTTPException(status_code=500, detail=str(err)) from err


@router.post("/codex-auth/logout")
async def logout_codex() -> dict[str, bool]:
    logout_codex_auth()
    set_runtime(None)
    return {"ok": True}


@router.put("/llm-provider")
async def set_llm_provider(request: LLMProviderUpdateRequest):
    """Force a specific provider for all phases by setting ``agents.defaults.provider``."""
    spec = find_by_name(request.provider)
    if spec is None:
        raise HTTPException(
            status_code=400,
            detail=f"알 수 없는 제공자입니다: '{request.provider}'",
        )

    needs_key = not (spec.is_oauth or spec.is_local or spec.is_direct)
    if needs_key and not get_api_key(spec.name):
        raise HTTPException(
            status_code=400,
            detail=f"'{spec.name}' 제공자의 apiKey가 deepcode_config.json에 설정되어 있지 않습니다.",
        )

    try:
        config: dict = {}
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f) or {}

        agents = config.setdefault("agents", {})
        defaults = agents.setdefault("defaults", {})
        defaults["provider"] = spec.name

        _write_deepcode_config(config)

        # Force the runtime to reload on the next access so subsequent
        # workflow calls see the new provider selection.
        set_runtime(None)

        return {
            "status": "success",
            "message": f"LLM 제공자가 '{spec.name}'(으)로 변경되었습니다.",
            "provider": spec.name,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정을 업데이트하지 못했습니다: {str(e)}",
        )


@router.put("/llm-models")
async def set_llm_models(request: LLMModelsUpdateRequest):
    """Update default/planning/implementation models and reload runtime."""
    spec = find_by_name(request.provider)
    if spec is None:
        raise HTTPException(
            status_code=400,
            detail=f"알 수 없는 제공자입니다: '{request.provider}'",
        )

    needs_key = not (spec.is_oauth or spec.is_local or spec.is_direct)
    if needs_key and not get_api_key(spec.name):
        raise HTTPException(
            status_code=400,
            detail=f"'{spec.name}' 제공자의 apiKey가 deepcode_config.json에 설정되어 있지 않습니다.",
        )

    models = {
        "default": request.default_model.strip(),
        "planning": request.planning_model.strip(),
        "implementation": request.implementation_model.strip(),
    }
    missing = [phase for phase, model in models.items() if not model]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"다음 단계의 모델 ID가 비어 있습니다: {', '.join(missing)}",
        )

    try:
        config: dict = {}
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                config = json.load(f) or {}

        agents = config.setdefault("agents", {})
        defaults = agents.setdefault("defaults", {})
        defaults["provider"] = spec.name
        defaults["model"] = models["default"]

        planning = agents.setdefault("planning", {})
        planning["provider"] = spec.name
        planning["model"] = models["planning"]

        implementation = agents.setdefault("implementation", {})
        implementation["provider"] = spec.name
        implementation["model"] = models["implementation"]

        _write_deepcode_config(config)

        set_runtime(None)

        return {
            "status": "success",
            "message": "LLM 모델 설정이 변경되었습니다. 새 워크플로우부터 선택한 모델을 사용합니다.",
            "provider": spec.name,
            "models": models,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"모델 설정을 업데이트하지 못했습니다: {str(e)}",
        )
