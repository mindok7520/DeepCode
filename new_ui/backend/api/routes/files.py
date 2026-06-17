"""
Files API Routes
Handles file upload and download operations
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

from settings import settings


router = APIRouter()

# In-memory file registry (in production, use a database)
_file_registry: dict = {}
_CHUNK_SIZE = 1024 * 1024


def _is_git_lfs_pointer(file_path: Path) -> bool:
    """Return True when the uploaded file is a Git LFS pointer, not real content."""
    try:
        header = file_path.read_bytes()[:256]
    except OSError:
        return False
    return header.startswith(b"version https://git-lfs.github.com/spec/")


def _upload_root() -> Path:
    return Path(settings.upload_dir).expanduser().resolve()


def _sanitize_original_name(filename: str | None, fallback: str) -> str:
    name = (filename or fallback).replace("\\", "/").rsplit("/", maxsplit=1)[-1]
    return name or fallback


def _resolve_registered_path(file_info: dict) -> Path:
    root = _upload_root()
    path = Path(file_info["path"]).expanduser().resolve()
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid uploaded file path") from exc
    return path


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file (PDF, markdown, etc.)"""
    # Validate file type
    allowed_types = {".pdf", ".md", ".txt", ".markdown"}
    original_name = _sanitize_original_name(file.filename, "upload")
    file_ext = Path(original_name).suffix.lower()

    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{file_ext}' not allowed. Allowed: {', '.join(allowed_types)}",
        )

    # Generate unique file ID
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}{file_ext}"
    upload_root = _upload_root()
    file_path = upload_root / safe_filename

    try:
        # Ensure upload directory exists
        upload_root.mkdir(parents=True, exist_ok=True)

        # Save file with a hard size cap while streaming. This avoids writing
        # an entire oversized upload before rejecting it.
        file_size = 0
        with file_path.open("wb") as buffer:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > settings.max_upload_size:
                    file_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "File size exceeds limit of "
                            f"{settings.max_upload_size // (1024*1024)}MB"
                        ),
                    )
                buffer.write(chunk)

        if file_size == 0:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        if _is_git_lfs_pointer(file_path):
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=400,
                detail=(
                    "Uploaded file is a Git LFS pointer, not the real document. "
                    "Run `git lfs pull` in the source repository or upload the actual PDF."
                ),
            )

        # Register file
        _file_registry[file_id] = {
            "id": file_id,
            "original_name": original_name,
            "path": str(file_path),
            "size": file_size,
            "type": file_ext,
        }

        return {
            "file_id": file_id,
            "filename": original_name,
            "path": str(file_path),
            "size": file_size,
        }

    except HTTPException:
        raise
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}",
        )


@router.get("/download/{file_id}")
async def download_file(file_id: str):
    """Download a file by ID"""
    file_info = _file_registry.get(file_id)

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _resolve_registered_path(file_info)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File no longer exists")

    return FileResponse(
        path=str(file_path),
        filename=file_info["original_name"],
        media_type="application/octet-stream",
    )


@router.delete("/delete/{file_id}")
async def delete_file(file_id: str):
    """Delete an uploaded file"""
    file_info = _file_registry.get(file_id)

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = _resolve_registered_path(file_info)

    try:
        if file_path.exists():
            file_path.unlink()

        del _file_registry[file_id]

        return {"status": "deleted", "file_id": file_id}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete file: {str(e)}",
        )


@router.get("/info/{file_id}")
async def get_file_info(file_id: str):
    """Get information about an uploaded file"""
    file_info = _file_registry.get(file_id)

    if not file_info:
        raise HTTPException(status_code=404, detail="File not found")

    return file_info
