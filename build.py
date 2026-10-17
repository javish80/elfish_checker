#!/usr/bin/env python3
"""
Bundle all source files into a standalone bundle.js
that works both over HTTP and directly from file:// (no CORS, no Node.js needed).
"""
import re
from pathlib import Path

ROOT = Path(__file__).parent

ORDER = [
    ROOT / 'src' / 'game' / 'board.js',
    ROOT / 'src' / 'game' / 'rules.js',
    ROOT / 'src' / 'game' / 'ai.js',
    ROOT / 'src' / 'i18n.js',
    ROOT / 'src' / 'ui' / 'pieces.js',
    ROOT / 'src' / 'ui' / 'fx.js',
    ROOT / 'src' / 'ui' / 'renderer.js',
    ROOT / 'src' / 'main.js',
]

def clean_source(path: Path) -> str:
    content = path.read_text(encoding='utf-8')
    lines = []
    for line in content.splitlines():
        # Strip import statements
        if re.match(r'^\s*import\s+', line):
            continue
        # Strip standalone export { ... }
        if re.match(r'^\s*export\s*\{[^}]*\};?\s*$', line):
            continue
        # Strip "export default"
        line = re.sub(r'^\s*export\s+default\s+', '', line)
        # Strip "export " prefix from functions, classes, const, let, var
        line = re.sub(r'^\s*export\s+(async\s+function|function|class|const|let|var)\s+', r'\1 ', line)
        lines.append(line)
    return '\n'.join(lines)

def build():
    parts = [
        "// Elfish Checkers — Standalone Bundle (Zero dependencies, works in file:// and http://)",
        "(function() {",
        "  'use strict';",
    ]

    for path in ORDER:
        parts.append(f"\n  // ==================== {path.relative_to(ROOT)} ====================")
        cleaned = clean_source(path)
        # Indent each line
        indented = "\n".join("  " + l if l.strip() else "" for l in cleaned.splitlines())
        parts.append(indented)

        # After fx.js, provide the `fx` namespace used in renderer.js
        if path.name == 'fx.js':
            parts.append("\n  const fx = { leafTrail, bonk, dust, sparkle, leafShower };")

    parts.append("\n})();\n")

    bundle_content = "\n".join(parts)
    target = ROOT / 'bundle.js'
    target.write_text(bundle_content, encoding='utf-8')
    print(f"Generated {target} ({len(bundle_content):,} bytes)")

if __name__ == '__main__':
    build()
