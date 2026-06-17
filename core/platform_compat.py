"""Small cross-platform runtime helpers.

DeepCode starts several Python and Node subprocesses from different entry
points. On Windows, default console encoding may be GBK/cp936, while Python
tool servers and model logs freely emit UTF-8 text. Keep the policy in one
place so launchers, FastAPI, and MCP stdio clients inherit the same behavior.
"""

from __future__ import annotations

import errno
import io
import json
import os
import shutil
import sys
import tempfile
from collections.abc import Mapping
from pathlib import Path
from typing import Any

UTF8_ENV: dict[str, str] = {
    "PYTHONUTF8": "1",
    "PYTHONIOENCODING": "utf-8",
}

_WINDOWS_SHELL_LAUNCHERS = frozenset(("npx", "npm", "pnpm", "yarn", "bunx"))
_REPLACE_FALLBACK_ERRNOS = {errno.EBUSY, errno.EXDEV}


def configure_utf8_stdio() -> None:
    """Prefer UTF-8 stdio and replace unencodable characters safely."""
    for key, value in UTF8_ENV.items():
        os.environ.setdefault(key, value)
    os.environ.setdefault("PYTHONLEGACYWINDOWSSTDIO", "0")

    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue
        try:
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8", errors="replace")
            elif hasattr(stream, "detach"):
                wrapped = io.TextIOWrapper(
                    stream.detach(),
                    encoding="utf-8",
                    errors="replace",
                )
                setattr(sys, stream_name, wrapped)
        except Exception:
            # Do not make startup fail because a host replaced stdio with a
            # non-standard object.
            continue


def subprocess_env(extra: Mapping[str, Any] | None = None) -> dict[str, str]:
    """Return an environment suitable for child Python/MCP processes."""
    env = os.environ.copy()
    env.update(UTF8_ENV)
    env.setdefault("PYTHONLEGACYWINDOWSSTDIO", "0")
    if extra:
        env.update({str(k): str(v) for k, v in extra.items()})
    return env


def subprocess_text_kwargs() -> dict[str, Any]:
    """Text-mode kwargs that avoid locale-dependent decode failures."""
    return {"text": True, "encoding": "utf-8", "errors": "replace"}


def restrict_private_permissions(path: str | Path, *, directory: bool = False) -> None:
    """Best-effort private permissions for local secret-bearing files."""
    if os.name == "nt":
        return

    target = Path(path)
    try:
        if directory or (target.exists() and target.is_dir()):
            os.chmod(target, 0o700)
            return
        if target.exists():
            os.chmod(target, 0o600)
    except OSError:
        return


def write_private_json_file(
    path: str | Path,
    payload: Any,
    *,
    ensure_ascii: bool = False,
    private_parent: bool = False,
) -> None:
    """Atomically write a JSON file and make it private where supported."""
    target = Path(path).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    if private_parent:
        restrict_private_permissions(target.parent, directory=True)

    tmp_name = ""
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{target.name}.",
        suffix=".tmp",
        dir=str(target.parent),
        text=True,
    )
    tmp_path = Path(tmp_name)

    def write_json(fh: Any) -> None:
        json.dump(payload, fh, indent=2, ensure_ascii=ensure_ascii)
        fh.write("\n")

    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            write_json(fh)
        restrict_private_permissions(tmp_path)
        try:
            os.replace(tmp_path, target)
        except OSError as exc:
            if exc.errno not in _REPLACE_FALLBACK_ERRNOS:
                raise
            # Docker single-file bind mounts cannot always be replaced as an
            # inode, even when the file itself is writable. Fall back to
            # truncating the existing file so Settings saves still work.
            with target.open("w", encoding="utf-8") as fh:
                write_json(fh)
        restrict_private_permissions(target)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except OSError:
                pass


def _basename(command: str) -> str:
    return command.replace("\\", "/").rsplit("/", maxsplit=1)[-1].lower()


def normalize_stdio_command(
    command: str,
    args: list[str] | None,
    env: Mapping[str, Any] | None = None,
) -> tuple[str, list[str], dict[str, str]]:
    """Normalize MCP stdio command/env for Windows and virtualenv safety.

    - ``python`` / ``python3`` map to the current interpreter on every OS, so
      MCP tool servers run in the same environment as the backend.
    - Windows ``.cmd``/``.bat`` launchers such as ``npx`` are wrapped in
      ``cmd.exe /d /c`` because CreateProcess does not reliably execute them
      as stdio children across environments.
    - The returned environment is always a full environment plus UTF-8 flags.
    """
    normalized_args = list(args or [])
    child_env = subprocess_env(env)
    command = str(command)

    base = _basename(command)
    if base in {"python", "python.exe", "python3", "python3.exe"}:
        command = sys.executable
        base = _basename(command)

    if os.name != "nt":
        return command, normalized_args, child_env

    if base in {"cmd", "cmd.exe", "powershell", "powershell.exe", "pwsh", "pwsh.exe"}:
        return command, normalized_args, child_env

    if base.endswith((".exe", ".com")):
        return command, normalized_args, child_env

    resolved = shutil.which(command, path=child_env.get("PATH")) or command
    resolved_base = _basename(resolved)
    should_wrap = (
        base in _WINDOWS_SHELL_LAUNCHERS
        or base.endswith((".cmd", ".bat"))
        or resolved_base.endswith((".cmd", ".bat"))
    )
    if not should_wrap:
        return command, normalized_args, child_env

    comspec = child_env.get("COMSPEC") or os.environ.get("COMSPEC") or "cmd.exe"
    return comspec, ["/d", "/c", command, *normalized_args], child_env
