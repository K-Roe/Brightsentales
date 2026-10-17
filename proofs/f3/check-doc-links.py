"""Check local Markdown links in current project documentation."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[2]
files = [root / "README.md", root / "AGENTS.md", *sorted((root / "docs").glob("*.md"))]
missing = []
checked = 0
for source in files:
    text = source.read_text(encoding="utf-8")
    for target in re.findall(r"(?<!!)\[[^]]+\]\(([^)]+)\)", text):
        if "://" in target or target.startswith("mailto:"):
            continue
        path = target.split("#", 1)[0]
        if not path:
            continue
        checked += 1
        if not (source.parent / path).exists():
            missing.append(f"{source.relative_to(root)} -> {target}")
print(f"Checked {checked} local links across {len(files)} Markdown files; missing: {len(missing)}")
for item in missing:
    print(item)
raise SystemExit(bool(missing))
