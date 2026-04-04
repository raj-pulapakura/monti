#!/usr/bin/env python3
"""Resolve ClickUp tasks and Docs from IDs, links, or text queries."""

from __future__ import annotations

import argparse
import difflib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


API_BASE_V2 = os.environ.get("CLICKUP_API_BASE_V2") or os.environ.get(
    "CLICKUP_API_BASE", "https://api.clickup.com/api/v2"
)
API_BASE_V3 = os.environ.get("CLICKUP_API_BASE_V3", "https://api.clickup.com/api/v3")
API_BASE_V2 = API_BASE_V2.rstrip("/")
API_BASE_V3 = API_BASE_V3.rstrip("/")
DEFAULT_PAGE_LIMIT = 5
DEFAULT_DOC_PREVIEW_PAGES = 3
DEFAULT_MAX_IMAGE_DOWNLOADS = 4
MAX_BRANCH_LENGTH = 80
DOC_PREFIXES = ("doc:", "docs:")
TASK_PREFIXES = ("task:", "tasks:")
IMAGE_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
    ".heic",
    ".heif",
}


class ConfigError(RuntimeError):
    """Raised when required environment is missing."""


class ApiError(RuntimeError):
    """Raised when the ClickUp API returns an error."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resolve ClickUp tasks and Docs from IDs, links, or search queries."
    )
    parser.add_argument(
        "refs",
        nargs="+",
        help="One or more task/doc refs. Prefix with task: or doc: to force the kind.",
    )
    parser.add_argument(
        "--team-id",
        default=os.environ.get("PERSONAL_CLICKUP_TEAM_ID"),
        help="ClickUp Workspace/team ID. Defaults to PERSONAL_CLICKUP_TEAM_ID.",
    )
    parser.add_argument(
        "--page-limit",
        type=int,
        default=DEFAULT_PAGE_LIMIT,
        help=f"Maximum task-search pages to inspect. Default: {DEFAULT_PAGE_LIMIT}.",
    )
    parser.add_argument(
        "--doc-preview-pages",
        type=int,
        default=DEFAULT_DOC_PREVIEW_PAGES,
        help=f"Maximum Doc pages to fetch for previews. Default: {DEFAULT_DOC_PREVIEW_PAGES}.",
    )
    parser.add_argument(
        "--attachment-dir",
        default=os.environ.get("CLICKUP_ATTACHMENT_DIR"),
        help="Optional directory for downloaded task image attachments.",
    )
    parser.add_argument(
        "--max-image-downloads",
        type=int,
        default=int(os.environ.get("CLICKUP_MAX_IMAGE_DOWNLOADS", DEFAULT_MAX_IMAGE_DOWNLOADS)),
        help=(
            "Maximum image attachments to download per resolved task. "
            f"Default: {DEFAULT_MAX_IMAGE_DOWNLOADS}."
        ),
    )
    parser.add_argument(
        "--no-download-task-images",
        action="store_true",
        help="Skip downloading image attachments for resolved tasks.",
    )
    parser.add_argument(
        "--include-closed",
        action="store_true",
        help="Include closed tasks during workspace-wide task search.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON.",
    )
    return parser.parse_args()


def require_token() -> str:
    token = os.environ.get("PERSONAL_CLICKUP_API_TOKEN")
    if token:
        return token
    raise ConfigError("Missing PERSONAL_CLICKUP_API_TOKEN in the shell environment.")


def api_get(
    base_url: str,
    path: str,
    token: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    query = ""
    if params:
        filtered = {
            key: value
            for key, value in params.items()
            if value is not None and value != ""
        }
        query = "?" + urllib.parse.urlencode(filtered, doseq=True)

    request = urllib.request.Request(
        f"{base_url}{path}{query}",
        headers={
            "Authorization": token,
            "Content-Type": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace").strip()
        detail = body
        if body:
            try:
                payload = json.loads(body)
                detail = payload.get("err") or payload.get("error") or body
            except json.JSONDecodeError:
                detail = body
        raise ApiError(f"ClickUp API error {exc.code} for {path}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise ApiError(f"Could not reach ClickUp API: {exc.reason}") from exc


def resolve_team_id(explicit_team_id: str | None, token: str) -> str:
    if explicit_team_id:
        return explicit_team_id

    payload = api_get(API_BASE_V2, "/team", token)
    teams = payload.get("teams") or []
    if len(teams) == 1:
        return str(teams[0]["id"])

    names = ", ".join(str(team.get("name") or team.get("id")) for team in teams[:5])
    raise ConfigError(
        "Could not infer PERSONAL_CLICKUP_TEAM_ID automatically. "
        f"Available Workspaces: {names or 'none'}. Set PERSONAL_CLICKUP_TEAM_ID or pass --team-id."
    )


def looks_like_identifier(query: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_-]{4,}", query))


def normalize_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def slugify(value: str, *, max_length: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:max_length].strip("-")


def compact_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def truncate_text(value: str | None, limit: int) -> str:
    text = compact_text(value)
    return text[:limit]


def first_nonempty(*values: Any) -> Any:
    for value in values:
        if value not in (None, "", [], {}):
            return value
    return None


def extract_collection(payload: Any, keys: tuple[str, ...]) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def detect_ref_kind(raw_ref: str) -> tuple[str, str]:
    stripped = raw_ref.strip()
    lowered = stripped.lower()

    for prefix in TASK_PREFIXES:
        if lowered.startswith(prefix):
            return "task", stripped[len(prefix) :].strip()
    for prefix in DOC_PREFIXES:
        if lowered.startswith(prefix):
            return "doc", stripped[len(prefix) :].strip()

    return "auto", stripped


def extract_doc_url_ids(value: str) -> tuple[str | None, str | None]:
    if not value.startswith(("http://", "https://")):
        return None, None

    doc_match = re.search(r"/docs?/([A-Za-z0-9_-]+)", value)
    page_match = re.search(r"/pages?/([A-Za-z0-9_-]+)", value)
    doc_id = doc_match.group(1) if doc_match else None
    page_id = page_match.group(1) if page_match else None
    return doc_id, page_id


def default_attachment_dir() -> Path:
    return Path(tempfile.gettempdir()) / "clickup_attachments"


def safe_filename(value: str, fallback: str) -> str:
    name = value.strip() or fallback
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return name or fallback


def is_image_attachment(attachment: dict[str, Any]) -> bool:
    content_type = str(
        first_nonempty(
            attachment.get("content_type"),
            attachment.get("mime_type"),
            attachment.get("type"),
            "",
        )
    ).lower()
    if content_type.startswith("image/"):
        return True

    filename = str(
        first_nonempty(
            attachment.get("title"),
            attachment.get("name"),
            attachment.get("filename"),
            attachment.get("file_name"),
            "",
        )
    )
    extension = Path(filename).suffix.lower()
    return extension in IMAGE_EXTENSIONS


def download_attachment(
    url: str,
    destination: Path,
    *,
    token: str,
) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": token,
            "Content-Type": "application/json",
        },
        method="GET",
    )
    with urllib.request.urlopen(request) as response:
        destination.write_bytes(response.read())
    return destination.resolve()


def extract_ocr_preview(image_path: Path) -> str | None:
    if not shutil.which("tesseract"):
        return None

    try:
        result = subprocess.run(
            ["tesseract", str(image_path), "stdout", "--psm", "6"],
            check=False,
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return None

    if result.returncode not in (0, 1):
        return None

    preview = truncate_text(result.stdout, 500)
    return preview or None


def summarize_attachments(
    task: dict[str, Any],
    *,
    token: str | None,
    attachment_dir: Path,
    download_task_images: bool,
    max_image_downloads: int,
) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    downloaded_images = 0
    task_ref = str(task.get("custom_id") or task.get("id") or "task")
    task_dir = attachment_dir / safe_filename(task_ref, "task")

    for index, attachment in enumerate(task.get("attachments") or [], start=1):
        name = str(
            first_nonempty(
                attachment.get("title"),
                attachment.get("name"),
                attachment.get("filename"),
                attachment.get("file_name"),
                f"attachment-{index}",
            )
        )
        url = str(
            first_nonempty(
                attachment.get("url"),
                attachment.get("download_url"),
                attachment.get("attachment_url"),
                attachment.get("temporary_url"),
                attachment.get("temp_url"),
                "",
            )
        )
        attachment_id = str(first_nonempty(attachment.get("id"), attachment.get("attachment_id")) or "")
        content_type = first_nonempty(
            attachment.get("content_type"),
            attachment.get("mime_type"),
            attachment.get("type"),
        )
        extension = Path(name).suffix.lower()
        image_attachment = is_image_attachment(attachment)

        summary = {
            "id": attachment_id,
            "name": name,
            "url": url or None,
            "size": first_nonempty(attachment.get("size"), attachment.get("filesize")),
            "content_type": content_type,
            "extension": extension or None,
            "is_image": image_attachment,
        }

        if (
            image_attachment
            and download_task_images
            and token
            and url
            and downloaded_images < max(max_image_downloads, 0)
        ):
            file_name = safe_filename(name, f"attachment-{index}{extension or ''}")
            destination = task_dir / file_name
            try:
                local_path = download_attachment(url, destination, token=token)
                summary["local_path"] = str(local_path)
                summary["ocr_text_preview"] = extract_ocr_preview(local_path)
                downloaded_images += 1
            except (OSError, urllib.error.URLError, urllib.error.HTTPError):
                summary["download_error"] = "Failed to download attachment."

        summaries.append(summary)

    return summaries


def normalize_branch_ref(task: dict[str, Any]) -> str:
    raw_ref = str(task.get("custom_id") or task.get("id") or "task")
    ref_slug = slugify(raw_ref, max_length=24) or "task"
    if ref_slug.startswith("cu-"):
        return ref_slug[3:] or "task"
    return ref_slug


def make_branch_name(tasks: list[dict[str, Any]] | dict[str, Any]) -> str:
    if isinstance(tasks, dict):
        tasks = [tasks]

    refs: list[str] = []
    titles: list[str] = []
    for task in tasks:
        ref = normalize_branch_ref(task)
        if ref and ref not in refs:
            refs.append(ref)
        title = str(task.get("name") or "").strip()
        if title:
            titles.append(title)

    ids_part = f"cu-{'-'.join(refs or ['task'])}"
    title_source = " ".join(titles) or "work-items"
    remaining = MAX_BRANCH_LENGTH - len(ids_part) - 1
    if remaining <= 0:
        return ids_part[:MAX_BRANCH_LENGTH].rstrip("-")

    title_slug = slugify(title_source, max_length=remaining)
    if not title_slug:
        return ids_part[:MAX_BRANCH_LENGTH].rstrip("-")

    return f"{ids_part}-{title_slug}"[:MAX_BRANCH_LENGTH].rstrip("-")


def summarize_checklists(task: dict[str, Any]) -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for checklist in task.get("checklists") or []:
        items = []
        for item in checklist.get("items") or []:
            items.append(
                {
                    "name": item.get("name"),
                    "resolved": bool(item.get("resolved")),
                }
            )
        summaries.append(
            {
                "name": checklist.get("name"),
                "items": items,
            }
        )
    return summaries


def summarize_task(
    task: dict[str, Any],
    *,
    token: str | None = None,
    attachment_dir: Path | None = None,
    download_task_images: bool = False,
    max_image_downloads: int = 0,
) -> dict[str, Any]:
    assignees = []
    for assignee in task.get("assignees") or []:
        assignees.append(
            assignee.get("username")
            or assignee.get("email")
            or str(assignee.get("id") or "")
        )

    tags = []
    for tag in task.get("tags") or []:
        name = tag.get("name")
        if name:
            tags.append(name)

    description = compact_text(task.get("description"))
    attachments = summarize_attachments(
        task,
        token=token,
        attachment_dir=attachment_dir or default_attachment_dir(),
        download_task_images=download_task_images,
        max_image_downloads=max_image_downloads,
    )
    summary = {
        "kind": "task",
        "id": str(task.get("id") or ""),
        "custom_id": task.get("custom_id"),
        "task_ref": task.get("custom_id") or str(task.get("id") or ""),
        "name": task.get("name"),
        "status": (task.get("status") or {}).get("status"),
        "status_type": (task.get("status") or {}).get("type"),
        "priority": (task.get("priority") or {}).get("priority"),
        "url": task.get("url"),
        "assignees": assignees,
        "tags": tags,
        "space": (task.get("space") or {}).get("name"),
        "folder": (task.get("folder") or {}).get("name"),
        "list": (task.get("list") or {}).get("name"),
        "parent": task.get("parent"),
        "date_created": task.get("date_created"),
        "date_updated": task.get("date_updated"),
        "due_date": task.get("due_date"),
        "description": description,
        "description_preview": description[:400],
        "checklists": summarize_checklists(task),
        "attachments": attachments,
    }
    summary["branch_name"] = make_branch_name(summary)
    return summary


def fetch_task_by_id(task_ref: str, token: str) -> dict[str, Any] | None:
    try:
        return api_get(API_BASE_V2, f"/task/{urllib.parse.quote(task_ref)}", token)
    except ApiError as exc:
        if " 404 " in f" {exc} ":
            return None
        raise


def fetch_task_by_custom_id(task_ref: str, team_id: str, token: str) -> dict[str, Any] | None:
    try:
        return api_get(
            API_BASE_V2,
            f"/task/{urllib.parse.quote(task_ref)}",
            token,
            params={"custom_task_ids": "true", "team_id": team_id},
        )
    except ApiError as exc:
        if " 404 " in f" {exc} ":
            return None
        raise


def search_tasks(
    query: str,
    team_id: str,
    token: str,
    *,
    include_closed: bool,
    page_limit: int,
    use_search_param: bool,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    for page in range(max(page_limit, 1)):
        params: dict[str, Any] = {
            "page": page,
            "subtasks": "true",
            "include_closed": "true" if include_closed else "false",
        }
        if use_search_param:
            params["search"] = query

        payload = api_get(API_BASE_V2, f"/team/{team_id}/task", token, params=params)
        tasks = payload.get("tasks") or []
        if not tasks:
            break

        for task in tasks:
            task_id = str(task.get("id") or "")
            if task_id and task_id not in seen:
                seen.add(task_id)
                results.append(task)

        if len(tasks) < 100:
            break

    return results


def task_score(task: dict[str, Any], query: str) -> float:
    query_norm = normalize_text(query)
    query_tokens = set(query_norm.split())

    task_id = normalize_text(str(task.get("id") or ""))
    custom_id = normalize_text(str(task.get("custom_id") or ""))
    name = normalize_text(task.get("name"))
    description = normalize_text(task.get("description"))

    score = 0.0

    if query_norm and query_norm == task_id:
        score += 220
    if query_norm and query_norm == custom_id:
        score += 220
    if query_norm and query_norm == name:
        score += 200
    if query_norm and custom_id and query_norm in custom_id:
        score += 160
    if query_norm and name and query_norm in name:
        score += 150
    if query_norm and description and query_norm in description:
        score += 80

    score += difflib.SequenceMatcher(None, query_norm, name).ratio() * 50
    score += difflib.SequenceMatcher(None, query_norm, description[:400]).ratio() * 20
    score += len(query_tokens & set(name.split())) * 12
    score += len(query_tokens & set(description.split())) * 4

    status_type = ((task.get("status") or {}).get("type") or "").lower()
    if status_type != "closed":
        score += 2

    return score


def select_task_match(
    tasks: list[dict[str, Any]], query: str
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    scored = []
    for task in tasks:
        score = task_score(task, query)
        if score > 0:
            scored.append((score, task))

    scored.sort(key=lambda item: item[0], reverse=True)
    ranked = []
    for score, task in scored[:10]:
        summary = summarize_task(task)
        summary["match_score"] = round(score, 2)
        ranked.append(summary)

    if not ranked:
        return None, []

    top = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None

    exact_match = normalize_text(query) in {
        normalize_text(top["id"]),
        normalize_text(str(top.get("custom_id") or "")),
        normalize_text(top["name"]),
    }
    clear_gap = second is None or top["match_score"] - second["match_score"] >= 15

    if exact_match or top["match_score"] >= 185 or (top["match_score"] >= 90 and clear_gap):
        return top, ranked

    return None, ranked


def resolve_task_query(
    query: str,
    *,
    token: str,
    team_id: str | None,
    include_closed: bool,
    page_limit: int,
    attachment_dir: Path,
    download_task_images: bool,
    max_image_downloads: int,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "kind": "task",
        "query": query,
        "ambiguous": False,
        "resolution_method": None,
    }

    if looks_like_identifier(query):
        direct = fetch_task_by_id(query, token)
        if direct:
            result["resolution_method"] = "task_id"
            result["task"] = summarize_task(
                direct,
                token=token,
                attachment_dir=attachment_dir,
                download_task_images=download_task_images,
                max_image_downloads=max_image_downloads,
            )
            result["team_id"] = team_id
            result["branch_name"] = result["task"]["branch_name"]
            return result

    effective_team_id = team_id
    if looks_like_identifier(query):
        effective_team_id = resolve_team_id(effective_team_id, token)
        custom = fetch_task_by_custom_id(query, effective_team_id, token)
        if custom:
            result["resolution_method"] = "custom_task_id"
            result["task"] = summarize_task(
                custom,
                token=token,
                attachment_dir=attachment_dir,
                download_task_images=download_task_images,
                max_image_downloads=max_image_downloads,
            )
            result["team_id"] = effective_team_id
            result["branch_name"] = result["task"]["branch_name"]
            return result

    effective_team_id = resolve_team_id(effective_team_id, token)
    result["team_id"] = effective_team_id

    used_search_param = True
    try:
        tasks = search_tasks(
            query,
            effective_team_id,
            token,
            include_closed=include_closed,
            page_limit=page_limit,
            use_search_param=True,
        )
    except ApiError:
        used_search_param = False
        tasks = search_tasks(
            query,
            effective_team_id,
            token,
            include_closed=include_closed,
            page_limit=min(page_limit, 2),
            use_search_param=False,
        )

    selected, ranked = select_task_match(tasks, query)
    if selected:
        full_task = fetch_task_by_id(selected["id"], token) or next(
            (
                task
                for task in tasks
                if str(task.get("id") or "") == str(selected["id"])
            ),
            None,
        )
        result["resolution_method"] = "search"
        result["search_used_query_param"] = used_search_param
        if full_task is None:
            full_task = {"id": selected["id"], "name": selected["name"]}
        result["task"] = summarize_task(
            full_task,
            token=token,
            attachment_dir=attachment_dir,
            download_task_images=download_task_images,
            max_image_downloads=max_image_downloads,
        )
        result["branch_name"] = result["task"]["branch_name"]
        result["candidates"] = ranked[:5]
        return result

    if ranked:
        result["ambiguous"] = True
        result["resolution_method"] = "search"
        result["search_used_query_param"] = used_search_param
        result["message"] = "Multiple plausible ClickUp tasks matched the query."
        result["candidates"] = ranked[:5]
        return result

    result["message"] = "No ClickUp task matched the supplied query."
    result["candidates"] = []
    return result


def fetch_doc_by_id(doc_id: str, workspace_id: str, token: str) -> dict[str, Any] | None:
    try:
        return api_get(
            API_BASE_V3,
            f"/workspaces/{workspace_id}/docs/{urllib.parse.quote(doc_id)}",
            token,
        )
    except ApiError as exc:
        if " 404 " in f" {exc} ":
            return None
        raise


def fetch_doc_pages(doc_id: str, workspace_id: str, token: str) -> list[dict[str, Any]]:
    payload = api_get(
        API_BASE_V3,
        f"/workspaces/{workspace_id}/docs/{urllib.parse.quote(doc_id)}/pages",
        token,
    )
    return extract_collection(payload, ("pages", "items", "data", "results"))


def fetch_doc_page(
    doc_id: str, page_id: str, workspace_id: str, token: str
) -> dict[str, Any] | None:
    try:
        return api_get(
            API_BASE_V3,
            (
                f"/workspaces/{workspace_id}/docs/{urllib.parse.quote(doc_id)}"
                f"/pages/{urllib.parse.quote(page_id)}"
            ),
            token,
        )
    except ApiError as exc:
        if " 404 " in f" {exc} ":
            return None
        raise


def search_docs(query: str, workspace_id: str, token: str) -> tuple[list[dict[str, Any]], str]:
    attempts: list[tuple[str, dict[str, Any] | None]] = [
        ("search", {"search": query}),
        ("query", {"query": query}),
        ("all_docs", None),
    ]
    last_error: ApiError | None = None

    for label, params in attempts:
        try:
            payload = api_get(
                API_BASE_V3,
                f"/workspaces/{workspace_id}/docs",
                token,
                params=params,
            )
            docs = extract_collection(payload, ("docs", "items", "data", "results"))
            if params is None or docs:
                return docs, label
        except ApiError as exc:
            last_error = exc
            continue

    if last_error:
        raise last_error
    return [], "none"


def extract_page_preview(payload: Any) -> str:
    text_chunks: list[str] = []
    preferred_keys = {
        "content",
        "body",
        "markdown",
        "markdown_content",
        "content_markdown",
        "text",
        "text_content",
        "page_content",
    }

    def visit(node: Any, key_hint: str | None = None) -> None:
        if len(" ".join(text_chunks)) >= 1000:
            return
        if isinstance(node, str):
            if key_hint is None or key_hint in preferred_keys:
                chunk = compact_text(node)
                if chunk:
                    text_chunks.append(chunk)
            return
        if isinstance(node, dict):
            for key in preferred_keys:
                value = node.get(key)
                if value is not None:
                    visit(value, key)
            for key, value in node.items():
                if key not in preferred_keys:
                    visit(value, key)
            return
        if isinstance(node, list):
            for item in node:
                visit(item, key_hint)

    visit(payload)
    return truncate_text(" ".join(text_chunks), 500)


def summarize_doc_page(
    page: dict[str, Any],
    *,
    workspace_id: str,
    doc_id: str,
    token: str,
) -> dict[str, Any]:
    page_id = str(first_nonempty(page.get("id"), page.get("page_id")) or "")
    page_payload = fetch_doc_page(doc_id, page_id, workspace_id, token) if page_id else None
    page_name = first_nonempty(page.get("name"), page.get("title"), page.get("page_name"))
    return {
        "id": page_id,
        "name": page_name,
        "url": first_nonempty(page.get("url"), page.get("permalink")),
        "content_preview": extract_page_preview(page_payload or page),
    }


def doc_display_name(doc: dict[str, Any]) -> str:
    return str(first_nonempty(doc.get("name"), doc.get("title"), doc.get("doc_name")) or "")


def summarize_doc(
    doc: dict[str, Any],
    *,
    workspace_id: str,
    token: str,
    preview_pages: int,
    focus_page_id: str | None = None,
) -> dict[str, Any]:
    doc_id = str(first_nonempty(doc.get("id"), doc.get("doc_id")) or "")
    pages = fetch_doc_pages(doc_id, workspace_id, token) if doc_id else []
    page_summaries: list[dict[str, Any]] = []

    if focus_page_id:
        focus_page = next(
            (
                page
                for page in pages
                if str(first_nonempty(page.get("id"), page.get("page_id")) or "") == focus_page_id
            ),
            {"id": focus_page_id},
        )
        page_summaries.append(
            summarize_doc_page(
                focus_page,
                workspace_id=workspace_id,
                doc_id=doc_id,
                token=token,
            )
        )

    for page in pages:
        if len(page_summaries) >= max(preview_pages, 0):
            break
        page_id = str(first_nonempty(page.get("id"), page.get("page_id")) or "")
        if page_id and any(existing["id"] == page_id for existing in page_summaries):
            continue
        page_summaries.append(
            summarize_doc_page(
                page,
                workspace_id=workspace_id,
                doc_id=doc_id,
                token=token,
            )
        )

    return {
        "kind": "doc",
        "id": doc_id,
        "doc_ref": doc_id,
        "name": doc_display_name(doc),
        "url": first_nonempty(doc.get("url"), doc.get("permalink")),
        "creator": first_nonempty(
            (doc.get("creator") or {}).get("username") if isinstance(doc.get("creator"), dict) else None,
            doc.get("creator_name"),
        ),
        "date_created": first_nonempty(doc.get("date_created"), doc.get("created_at")),
        "date_updated": first_nonempty(doc.get("date_updated"), doc.get("updated_at")),
        "workspace_id": workspace_id,
        "pages": page_summaries,
        "page_count": len(pages),
    }


def doc_score(doc: dict[str, Any], query: str) -> float:
    query_norm = normalize_text(query)
    query_tokens = set(query_norm.split())
    doc_id = normalize_text(str(first_nonempty(doc.get("id"), doc.get("doc_id")) or ""))
    name = normalize_text(doc_display_name(doc))

    score = 0.0
    if query_norm and query_norm == doc_id:
        score += 220
    if query_norm and query_norm == name:
        score += 200
    if query_norm and query_norm in name:
        score += 150
    score += difflib.SequenceMatcher(None, query_norm, name).ratio() * 50
    score += len(query_tokens & set(name.split())) * 12
    return score


def select_doc_match(
    docs: list[dict[str, Any]], query: str
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    scored = []
    for doc in docs:
        score = doc_score(doc, query)
        if score > 0:
            scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    ranked = []
    for score, doc in scored[:10]:
        ranked.append(
            {
                "kind": "doc",
                "id": str(first_nonempty(doc.get("id"), doc.get("doc_id")) or ""),
                "doc_ref": str(first_nonempty(doc.get("id"), doc.get("doc_id")) or ""),
                "name": doc_display_name(doc),
                "url": first_nonempty(doc.get("url"), doc.get("permalink")),
                "match_score": round(score, 2),
            }
        )

    if not ranked:
        return None, []

    top = ranked[0]
    second = ranked[1] if len(ranked) > 1 else None
    exact_match = normalize_text(query) in {
        normalize_text(top["id"]),
        normalize_text(top["name"]),
    }
    clear_gap = second is None or top["match_score"] - second["match_score"] >= 15

    if exact_match or top["match_score"] >= 185 or (top["match_score"] >= 90 and clear_gap):
        return top, ranked
    return None, ranked


def resolve_doc_query(
    query: str,
    *,
    token: str,
    workspace_id: str | None,
    preview_pages: int,
) -> dict[str, Any]:
    effective_workspace_id = resolve_team_id(workspace_id, token)
    result: dict[str, Any] = {
        "kind": "doc",
        "query": query,
        "ambiguous": False,
        "workspace_id": effective_workspace_id,
        "team_id": effective_workspace_id,
        "resolution_method": None,
    }

    direct_doc_id, focus_page_id = extract_doc_url_ids(query)
    identifier_query = direct_doc_id or query

    if looks_like_identifier(identifier_query):
        direct = fetch_doc_by_id(identifier_query, effective_workspace_id, token)
        if direct:
            result["resolution_method"] = "doc_id"
            result["doc"] = summarize_doc(
                direct,
                workspace_id=effective_workspace_id,
                token=token,
                preview_pages=preview_pages,
                focus_page_id=focus_page_id,
            )
            return result

    docs, search_mode = search_docs(query, effective_workspace_id, token)
    selected, ranked = select_doc_match(docs, query)
    if selected:
        full_doc = fetch_doc_by_id(selected["id"], effective_workspace_id, token)
        if full_doc:
            result["resolution_method"] = "search"
            result["search_mode"] = search_mode
            result["doc"] = summarize_doc(
                full_doc,
                workspace_id=effective_workspace_id,
                token=token,
                preview_pages=preview_pages,
            )
            result["candidates"] = ranked[:5]
            return result

    if ranked:
        result["ambiguous"] = True
        result["resolution_method"] = "search"
        result["search_mode"] = search_mode
        result["message"] = "Multiple plausible ClickUp Docs matched the query."
        result["candidates"] = ranked[:5]
        return result

    result["message"] = "No ClickUp Doc matched the supplied query."
    result["candidates"] = []
    return result


def resolve_ref(
    raw_ref: str,
    *,
    token: str,
    team_id: str | None,
    include_closed: bool,
    page_limit: int,
    preview_pages: int,
    attachment_dir: Path,
    download_task_images: bool,
    max_image_downloads: int,
) -> dict[str, Any]:
    kind, query = detect_ref_kind(raw_ref)
    if not query:
        raise ConfigError("Ref query cannot be empty.")

    if kind == "task":
        return resolve_task_query(
            query,
            token=token,
            team_id=team_id,
            include_closed=include_closed,
            page_limit=page_limit,
            attachment_dir=attachment_dir,
            download_task_images=download_task_images,
            max_image_downloads=max_image_downloads,
        )

    if kind == "doc":
        return resolve_doc_query(
            query,
            token=token,
            workspace_id=team_id,
            preview_pages=preview_pages,
        )

    task_result = resolve_task_query(
        query,
        token=token,
        team_id=team_id,
        include_closed=include_closed,
        page_limit=page_limit,
        attachment_dir=attachment_dir,
        download_task_images=download_task_images,
        max_image_downloads=max_image_downloads,
    )
    if task_result.get("task"):
        return task_result
    if task_result.get("ambiguous"):
        return task_result

    doc_result = resolve_doc_query(
        query,
        token=token,
        workspace_id=task_result.get("team_id") or team_id,
        preview_pages=preview_pages,
    )
    if doc_result.get("doc"):
        return doc_result

    if doc_result.get("ambiguous"):
        return {
            "kind": "doc",
            "query": query,
            "ambiguous": True,
            "message": doc_result.get("message"),
            "candidates": doc_result.get("candidates", []),
            "team_id": doc_result.get("team_id") or task_result.get("team_id"),
        }

    return {
        "kind": "auto",
        "query": query,
        "ambiguous": False,
        "message": "No ClickUp task or Doc matched the supplied query.",
        "candidates": [],
        "team_id": doc_result.get("team_id") or task_result.get("team_id"),
    }


def resolve_refs(args: argparse.Namespace) -> dict[str, Any]:
    token = require_token()
    effective_team_id = args.team_id
    attachment_dir = Path(args.attachment_dir).expanduser() if args.attachment_dir else default_attachment_dir()

    aggregate: dict[str, Any] = {
        "refs": args.refs,
        "tasks": [],
        "docs": [],
        "unresolved_refs": [],
        "ambiguous": False,
    }
    resolution_methods: list[str] = []

    for raw_ref in args.refs:
        result = resolve_ref(
            raw_ref,
            token=token,
            team_id=effective_team_id,
            include_closed=args.include_closed,
            page_limit=args.page_limit,
            preview_pages=args.doc_preview_pages,
            attachment_dir=attachment_dir,
            download_task_images=not args.no_download_task_images,
            max_image_downloads=args.max_image_downloads,
        )

        if result.get("team_id"):
            effective_team_id = result["team_id"]

        task = result.get("task")
        doc = result.get("doc")
        if task:
            aggregate["tasks"].append(task)
            if result.get("resolution_method"):
                resolution_methods.append(result["resolution_method"])
            continue
        if doc:
            aggregate["docs"].append(doc)
            if result.get("resolution_method"):
                resolution_methods.append(result["resolution_method"])
            continue

        unresolved = {
            "query": result.get("query", raw_ref),
            "kind": result.get("kind", "auto"),
            "ambiguous": bool(result.get("ambiguous")),
            "message": result.get("message"),
            "candidates": result.get("candidates", []),
        }
        aggregate["unresolved_refs"].append(unresolved)
        if unresolved["ambiguous"]:
            aggregate["ambiguous"] = True

    aggregate["team_id"] = effective_team_id
    aggregate["attachment_dir"] = str(attachment_dir.resolve())
    if aggregate["tasks"]:
        aggregate["branch_name"] = make_branch_name(aggregate["tasks"])
        if len(aggregate["tasks"]) == 1:
            aggregate["task"] = aggregate["tasks"][0]
    if len(aggregate["docs"]) == 1:
        aggregate["doc"] = aggregate["docs"][0]

    if len(args.refs) == 1 and resolution_methods:
        aggregate["resolution_method"] = resolution_methods[0]
    elif resolution_methods:
        aggregate["resolution_methods"] = resolution_methods

    if aggregate["unresolved_refs"]:
        aggregate["message"] = "One or more ClickUp refs need confirmation before continuing."
    elif aggregate["tasks"] or aggregate["docs"]:
        aggregate["message"] = (
            f"Resolved {len(aggregate['tasks'])} task(s) and {len(aggregate['docs'])} doc(s)."
        )
    else:
        aggregate["message"] = "No ClickUp refs were resolved."

    return aggregate


def emit_text(payload: dict[str, Any]) -> None:
    print(payload.get("message") or "No ClickUp refs resolved.")

    tasks = payload.get("tasks") or []
    if tasks:
        print(f"Branch: {payload.get('branch_name') or 'n/a'}")
        for task in tasks:
            print(f"- task {task['task_ref']}: {task['name']} [{task.get('status') or 'unknown'}]")
            if task.get("url"):
                print(f"  URL: {task['url']}")
            for attachment in task.get("attachments") or []:
                kind = "image" if attachment.get("is_image") else "attachment"
                print(f"  {kind}: {attachment.get('name') or attachment.get('id')}")
                if attachment.get("local_path"):
                    print(f"    local: {attachment['local_path']}")
                if attachment.get("ocr_text_preview"):
                    print(f"    ocr: {attachment['ocr_text_preview']}")

    docs = payload.get("docs") or []
    if docs:
        for doc in docs:
            print(f"- doc {doc['doc_ref']}: {doc['name']}")
            if doc.get("url"):
                print(f"  URL: {doc['url']}")
            for page in doc.get("pages") or []:
                print(f"  page {page.get('id') or '?'}: {page.get('name') or 'Untitled'}")

    for unresolved in payload.get("unresolved_refs") or []:
        print(
            f"? {unresolved['kind']} {unresolved['query']}: "
            f"{unresolved.get('message') or 'Needs confirmation'}"
        )
        for candidate in unresolved.get("candidates") or []:
            ref = candidate.get("task_ref") or candidate.get("doc_ref") or candidate.get("id")
            name = candidate.get("name") or "Untitled"
            status = candidate.get("status")
            suffix = f" [{status}]" if status else ""
            print(f"  - {ref}: {name}{suffix}")


def main() -> int:
    args = parse_args()
    try:
        payload = resolve_refs(args)
    except (ConfigError, ApiError) as exc:
        error_payload = {"error": str(exc)}
        if args.json:
            print(json.dumps(error_payload, indent=2))
        else:
            print(str(exc), file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        emit_text(payload)

    if payload.get("unresolved_refs"):
        return 2 if payload.get("ambiguous") else 3
    if payload.get("tasks") or payload.get("docs"):
        return 0
    return 3


if __name__ == "__main__":
    sys.exit(main())
