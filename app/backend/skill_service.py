from __future__ import annotations

import json
from pathlib import Path
import re
import shutil

from .config import get_knowledge_base_dir


FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
ALLOWED_SCHEMA_SUFFIXES = {".json", ".yaml", ".yml", ".md"}
SUPPORT_DOC_NAMES = {"readme.md", "agents.md"}


def _skills_dir() -> Path:
    return get_knowledge_base_dir() / "skills"


def _schemas_dir() -> Path:
    return get_knowledge_base_dir() / "schemas"


def _parse_frontmatter(text: str) -> dict[str, str]:
    match = FRONTMATTER_PATTERN.match(text)
    if not match:
        return {}
    result: dict[str, str] = {}
    for line in match.group(1).splitlines():
        raw = str(line or "").strip()
        if not raw or ":" not in raw:
            continue
        key, value = raw.split(":", 1)
        result[key.strip()] = value.strip()
    return result


def _normalize_skill_name(value: str, fallback: str) -> str:
    raw = str(value or "").strip() or fallback
    return re.sub(r"[^a-z0-9-]+", "-", raw.lower()).strip("-") or fallback


def _strip_schema_suffix(filename: str) -> str:
    value = str(filename or "").strip()
    value = re.sub(r"\.schema$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"[-_]?schema$", "", value, flags=re.IGNORECASE)
    return value or filename


def _guess_metadata_from_text(text: str) -> dict[str, str]:
    frontmatter = _parse_frontmatter(text)
    if frontmatter:
        return frontmatter

    metadata: dict[str, str] = {}
    for key in ("title", "name", "description"):
        pattern = re.compile(rf"^\s*{key}\s*:\s*(.+?)\s*$", re.IGNORECASE | re.MULTILINE)
        match = pattern.search(text)
        if match:
            metadata[key] = match.group(1).strip().strip("'\"")
    return metadata


def list_skills() -> list[dict[str, str]]:
    skills_dir = _skills_dir()
    if not skills_dir.exists() or not skills_dir.is_dir():
        return []

    items: list[dict[str, str]] = []
    for path in sorted(skills_dir.iterdir()):
        if not path.is_dir():
            continue
        skill_file = path / "SKILL.md"
        if not skill_file.exists() or not skill_file.is_file():
            continue

        text = skill_file.read_text(encoding="utf-8")
        frontmatter = _parse_frontmatter(text)
        command = _normalize_skill_name(frontmatter.get("name", ""), path.name)
        description = frontmatter.get("description", "").strip()
        items.append(
            {
                "command": command,
                "name": frontmatter.get("name", "").strip() or path.name,
                "description": description or f"Use the {path.name} skill from the current knowledge base.",
                "path": str(skill_file.relative_to(get_knowledge_base_dir()).as_posix()),
                "source": "skill",
            }
        )

    return items


def list_schemas() -> list[dict[str, str]]:
    schemas_dir = _schemas_dir()
    if not schemas_dir.exists() or not schemas_dir.is_dir():
        return []

    items: list[dict[str, str]] = []
    for path in sorted(schemas_dir.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.name.lower() == "agents.md":
            continue
        if path.suffix.lower() not in ALLOWED_SCHEMA_SUFFIXES:
            continue

        fallback_name = _strip_schema_suffix(path.stem)
        text = path.read_text(encoding="utf-8")
        metadata = _guess_metadata_from_text(text)

        if path.suffix.lower() == ".json":
            try:
                payload = json.loads(text)
            except json.JSONDecodeError:
                payload = None
            if isinstance(payload, dict):
                metadata.setdefault("title", str(payload.get("title") or "").strip())
                metadata.setdefault("name", str(payload.get("name") or "").strip())
                metadata.setdefault("description", str(payload.get("description") or "").strip())

        display_name = (
            metadata.get("title", "").strip()
            or metadata.get("name", "").strip()
            or fallback_name
        )
        command = _normalize_skill_name(display_name, _normalize_skill_name(fallback_name, "schema"))
        description = metadata.get("description", "").strip()
        items.append(
            {
                "command": command,
                "name": display_name,
                "description": description or f"Use the {path.name} schema from the current knowledge base.",
                "path": str(path.relative_to(get_knowledge_base_dir()).as_posix()),
                "source": "schema",
            }
        )

    return items


def list_slash_commands() -> list[dict[str, str]]:
    items = [*list_skills(), *list_schemas()]
    return sorted(
        items,
        key=lambda item: (
            0 if item.get("source") == "skill" else 1,
            str(item.get("command") or "").lower(),
        ),
    )


def list_capability_entries() -> list[dict[str, object]]:
    kb_dir = get_knowledge_base_dir()
    items: list[dict[str, object]] = []

    for item in list_skills():
        items.append(
            {
                **item,
                "group": "Skills",
                "deletable": True,
            }
        )
        skill_file = kb_dir / str(item["path"])
        skill_dir = skill_file.parent
        for support_name in ("README.md", "AGENTS.md"):
            support_path = skill_dir / support_name
            if not support_path.exists() or not support_path.is_file():
                continue
            items.append(
                {
                    "name": f"{item['name']} · {support_name}",
                    "description": f"{item['name']} 的支持说明文件。",
                    "path": str(support_path.relative_to(kb_dir).as_posix()),
                    "source": "skill-doc",
                    "group": "Skill Docs",
                    "deletable": False,
                }
            )

    for item in list_schemas():
        items.append(
            {
                **item,
                "group": "Schemas",
                "deletable": True,
            }
        )

    schemas_dir = _schemas_dir()
    if schemas_dir.exists() and schemas_dir.is_dir():
        for path in sorted(schemas_dir.rglob("*")):
            if not path.is_file() or path.name.lower() not in SUPPORT_DOC_NAMES:
                continue
            items.append(
                {
                    "name": f"Schemas · {path.name}",
                    "description": "schemas 目录的支持说明文件。",
                    "path": str(path.relative_to(kb_dir).as_posix()),
                    "source": "schema-doc",
                    "group": "Schema Docs",
                    "deletable": False,
                }
            )

    root_agents = kb_dir / "AGENTS.md"
    if root_agents.exists() and root_agents.is_file():
        items.append(
            {
                "name": "Knowledge Base · AGENTS.md",
                "description": "当前知识库根目录的 AGENTS 指令文件。",
                "path": "AGENTS.md",
                "source": "knowledge-base-doc",
                "group": "Knowledge Base",
                "deletable": False,
            }
        )

    return items


def _resolve_capability_path(relative_path: str) -> Path:
    kb_dir = get_knowledge_base_dir().resolve()
    raw = str(relative_path or "").strip()
    if not raw:
        raise ValueError("能力文件路径不能为空。")

    candidate = (kb_dir / raw).resolve()
    if not candidate.is_relative_to(kb_dir):
        raise ValueError("能力文件路径不在当前知识库内。")

    relative = candidate.relative_to(kb_dir)
    if not relative.parts:
        raise ValueError("能力文件路径无效。")

    first = relative.parts[0]
    if relative.as_posix() == "AGENTS.md":
        return candidate
    if first == "skills":
        if candidate.name == "SKILL.md" or candidate.name.lower() in SUPPORT_DOC_NAMES:
            return candidate
        raise ValueError("当前只允许编辑 skills 下的 SKILL.md / README.md / AGENTS.md。")
    if first == "schemas":
        if candidate.name.lower() in SUPPORT_DOC_NAMES:
            return candidate
        if candidate.suffix.lower() not in ALLOWED_SCHEMA_SUFFIXES:
            raise ValueError("当前只允许编辑 schemas 下的 JSON/YAML/Markdown 文件。")
        return candidate

    raise ValueError("当前能力编辑仅支持知识库根目录 AGENTS.md、skills/ 与 schemas/ 目录。")


def get_capability_file(relative_path: str) -> dict[str, str]:
    path = _resolve_capability_path(relative_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(relative_path)
    return {
        "path": str(path.relative_to(get_knowledge_base_dir()).as_posix()),
        "content": path.read_text(encoding="utf-8"),
    }


def save_capability_file(relative_path: str, content: str) -> dict[str, str]:
    path = _resolve_capability_path(relative_path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(relative_path)
    path.write_text(str(content or ""), encoding="utf-8")
    return {
        "path": str(path.relative_to(get_knowledge_base_dir()).as_posix()),
        "content": str(content or ""),
    }


def create_capability_file(source: str, name: str, description: str = "") -> dict[str, str]:
    source_kind = str(source or "").strip().lower()
    display_name = str(name or "").strip()
    if not display_name:
        raise ValueError("能力名称不能为空。")

    slug = _normalize_skill_name(display_name, "capability")
    description_text = str(description or "").strip()

    if source_kind == "skill":
        skill_dir = _skills_dir() / slug
        path = skill_dir / "SKILL.md"
        if path.exists():
            raise ValueError(f"skill `{slug}` 已存在。")
        skill_dir.mkdir(parents=True, exist_ok=True)
        content = "\n".join(
            [
                "---",
                f"name: {display_name}",
                f"description: {description_text or 'Describe what this skill does.'}",
                "---",
                "",
                f"# {display_name}",
                "",
                "## Purpose",
                "",
                "Describe what this skill does.",
                "",
                "## Instructions",
                "",
                "- Replace this placeholder with the concrete workflow.",
                "",
            ]
        )
        path.write_text(content, encoding="utf-8")
        return {
            "path": str(path.relative_to(get_knowledge_base_dir()).as_posix()),
            "content": content,
            "source": "skill",
        }

    if source_kind == "schema":
        schema_dir = _schemas_dir()
        schema_dir.mkdir(parents=True, exist_ok=True)
        path = schema_dir / f"{slug}.md"
        if path.exists():
            raise ValueError(f"schema `{slug}` 已存在。")
        content = "\n".join(
            [
                "---",
                f"title: {display_name}",
                f"description: {description_text or 'Describe what this schema is for.'}",
                "---",
                "",
                f"# {display_name}",
                "",
                "## Purpose",
                "",
                "Describe what this schema is for.",
                "",
                "## Fields",
                "",
                "- Add the required fields here.",
                "",
                "## Validation",
                "",
                "- Describe validation or formatting rules here.",
                "",
            ]
        )
        path.write_text(content, encoding="utf-8")
        return {
            "path": str(path.relative_to(get_knowledge_base_dir()).as_posix()),
            "content": content,
            "source": "schema",
        }

    raise ValueError("当前只支持创建 skill 或 schema。")


def delete_capability_file(relative_path: str) -> dict[str, str]:
    path = _resolve_capability_path(relative_path)
    if not path.exists():
        raise FileNotFoundError(relative_path)

    relative = path.relative_to(get_knowledge_base_dir())
    if relative.as_posix() == "AGENTS.md":
        raise ValueError("知识库根目录 AGENTS.md 只支持编辑，不支持删除。")
    if relative.parts[0] == "skills":
        if path.name != "SKILL.md":
            raise ValueError("skills 下的 README.md / AGENTS.md 只支持编辑，不支持删除。")
        skill_dir = path.parent
        if skill_dir == _skills_dir():
            raise ValueError("不能直接删除 skills 根目录。")
        shutil.rmtree(skill_dir)
        return {
            "path": str(relative.as_posix()),
            "source": "skill",
        }

    if path.name.lower() in SUPPORT_DOC_NAMES:
        raise ValueError("schemas 下的 README.md / AGENTS.md 只支持编辑，不支持删除。")
    path.unlink()
    return {
        "path": str(relative.as_posix()),
        "source": "schema",
    }
