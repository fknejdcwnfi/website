#!/usr/bin/env python3
"""Check current relative documentation links and tracked temporary outputs offline."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
FROZEN = 'docs/reference/README.md'
FROZEN_SHA = 'e85ed36faed65ae3ef88c25d9963a214791539f399d7464c5f5213cefc03094a'
KNOWN_OLD_TARGETS = {
    '../01-project-charter.md', '../03-animation-spec.md', '../04-architecture.md',
    '../05-development.md', '../06-codex-handoff.md', '../08-decisions.md',
}
LINK = re.compile(r'!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+[\"\'][^)]*)?\)')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path)
args = parser.parse_args()


def files(*options):
    return subprocess.check_output(['git', '-C', str(ROOT), 'ls-files', '-z', *options]).decode().split('\0')


tracked = [name for name in files('--cached') if name]
current = sorted(set(tracked + [name for name in files('--others', '--exclude-standard') if name]))
report = {'status': 'failed', 'markdownFiles': 0, 'relativePathLinksTested': 0,
          'knownFrozenMissingLinks': [], 'unexpectedMissingLinks': [],
          'trackedTemporaryOutputs': [], 'scope': 'Relative Markdown target existence and tracked output boundaries; no external URL, fragment, security or browser assertions.'}
for name in tracked:
    parts = Path(name).parts
    if parts[0] in ('dist', 'dist-ssr', 'node_modules', 'work') or '__pycache__' in parts:
        report['trackedTemporaryOutputs'].append(name)
for name in current:
    p = ROOT / name
    if p.suffix.lower() != '.md' or not p.is_file():
        continue
    report['markdownFiles'] += 1
    for number, line in enumerate(p.read_text().splitlines(), 1):
        for match in LINK.finditer(line):
            target = match.group(1).strip('<>')
            parsed = urlsplit(target)
            if parsed.scheme or parsed.netloc or not parsed.path or parsed.path.startswith('/'):
                continue
            report['relativePathLinksTested'] += 1
            if not (p.parent / unquote(parsed.path)).exists():
                entry = {'file': name, 'line': number, 'target': target}
                key = 'knownFrozenMissingLinks' if name == FROZEN and target in KNOWN_OLD_TARGETS else 'unexpectedMissingLinks'
                report[key].append(entry)
report['frozenReferenceUnchanged'] = hashlib.sha256((ROOT / FROZEN).read_bytes()).hexdigest() == FROZEN_SHA
report['status'] = 'passed' if (not report['unexpectedMissingLinks'] and not report['trackedTemporaryOutputs'] and report['frozenReferenceUnchanged']) else 'failed'
if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
assert report['status'] == 'passed', 'Repository structure check failed.'
