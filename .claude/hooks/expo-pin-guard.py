#!/usr/bin/env python3
"""PreToolUse-Hook: blockiert Änderungen an der expo-Version in iri-app/package.json.

Hintergrund (CLAUDE.md): SDK 54 ist bewusst gepinnt — Expo Go auf Saschas
iPhone unterstützt max. 54; Upgrade erst mit Development Builds (~S11).
"""
import json
import pathlib
import re
import sys

data = json.load(sys.stdin)
tool_input = data.get("tool_input", {})
path = tool_input.get("file_path", "")
if not path.endswith("iri-app/package.json"):
    sys.exit(0)

REASON = (
    "Expo-SDK-Pin: iri-app bleibt bewusst auf SDK 54 (Expo Go unterstützt max. 54; "
    "Upgrade erst mit Dev-Builds, siehe CLAUDE.md/ENTWICKLUNGSPLAN). "
    "Die expo-Version darf nicht per Edit/Write geändert werden."
)

VERSION_RE = re.compile(r'"expo"\s*:\s*"([^"]+)"')


def deny() -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": REASON,
        }
    }))
    sys.exit(0)


file_on_disk = pathlib.Path(path)
current_match = VERSION_RE.search(file_on_disk.read_text()) if file_on_disk.exists() else None
current = current_match.group(1) if current_match else None

if data.get("tool_name") == "Write":
    new_match = VERSION_RE.search(tool_input.get("content", ""))
    new = new_match.group(1) if new_match else None
    if current is not None and new != current:
        deny()
else:  # Edit
    old_s = tool_input.get("old_string", "")
    new_s = tool_input.get("new_string", "")
    if '"expo"' in old_s or '"expo"' in new_s:
        m_old = VERSION_RE.search(old_s)
        m_new = VERSION_RE.search(new_s)
        versions_differ = (
            (m_old is None) != (m_new is None)
            or (m_old and m_new and m_old.group(1) != m_new.group(1))
        )
        if versions_differ:
            deny()
