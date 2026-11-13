#!/usr/bin/env python3
"""Check documented relative targets and tracked temporary outputs offline.

Supports inline links and full/collapsed/shortcut references, outside fenced and
inline code. This intentionally small parser does not claim CommonMark parity.
"""
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
INLINE_LINK = re.compile(r'!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+[\"\'][^)]*)?\)')
REFERENCE = re.compile(r'!?\[([^\]\n]+)\](?:\[([^\]\n]*)\])?')
DEFINITION = re.compile(r'^ {0,3}\[([^\]\n]+)\]:[ \t]*(?:<([^>\n]+)>|([^\s]+))')
FENCE = re.compile(r'^ {0,3}(`{3,}|~{3,})(.*)$')
BACKTICKS = re.compile(r'`+')


def escaped(text, index):
    preceding = index - 1
    while preceding >= 0 and text[preceding] == '\\':
        preceding -= 1
    return (index - preceding - 1) % 2 == 1


def blank_code(text):
    """Preserve positions and newlines while masking fenced blocks/code spans."""
    lines = []
    fence = None
    for line in text.splitlines(keepends=True):
        marker = FENCE.match(line.rstrip('\r\n'))
        if fence is not None:
            lines.append(re.sub(r'[^\r\n]', ' ', line))
            if (marker and marker[1][0] == fence[0] and
                    len(marker[1]) >= fence[1] and not marker[2].strip()):
                fence = None
        elif marker:
            fence = (marker[1][0], len(marker[1]))
            lines.append(re.sub(r'[^\r\n]', ' ', line))
        else:
            lines.append(line)
    text = ''.join(lines)
    masked = list(text)
    position = 0
    while opening := BACKTICKS.search(text, position):
        position = opening.end()
        if escaped(text, opening.start()):
            continue
        closing = next((match for match in BACKTICKS.finditer(text, position)
                        if len(match[0]) == len(opening[0])), None)
        if closing is None:
            continue
        for index in range(opening.start(), closing.end()):
            if text[index] not in '\r\n':
                masked[index] = ' '
        position = closing.end()
    return ''.join(masked)


def reference_label(value):
    return ' '.join(value.split()).casefold()


def markdown_targets(text):
    """Yield (source line, target) for the explicitly supported link forms."""
    lines = blank_code(text).splitlines()
    definitions = {}
    definition_lines = set()
    for number, line in enumerate(lines, 1):
        match = DEFINITION.match(line)
        if match:
            definitions.setdefault(reference_label(match[1]), match[2] or match[3])
            definition_lines.add(number)
    for number, line in enumerate(lines, 1):
        if number in definition_lines:
            continue
        inline_spans = []
        for match in INLINE_LINK.finditer(line):
            bracket = match.start() + int(match[0].startswith('!'))
            if escaped(line, bracket):
                continue
            inline_spans.append(match.span())
            yield number, match[1].strip('<>')
        for match in REFERENCE.finditer(line):
            bracket = match.start() + int(match[0].startswith('!'))
            if escaped(line, bracket) or any(start <= match.start() < end for start, end in inline_spans):
                continue
            # Without a definition, bracketed text is not a reference link.
            label = reference_label(match[2] or match[1])
            if label in definitions:
                yield number, definitions[label]


def files(*options):
    return subprocess.check_output(['git', '-C', str(ROOT), 'ls-files', '-z', *options]).decode().split('\0')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    tracked = [name for name in files('--cached') if name]
    current = sorted(set(tracked + [name for name in files('--others', '--exclude-standard') if name]))
    report = {'status': 'failed', 'markdownFiles': 0, 'relativePathLinksTested': 0,
              'knownFrozenMissingLinks': [], 'unexpectedMissingLinks': [],
              'invalidLinkTargets': [], 'trackedTemporaryOutputs': [],
              'scope': 'Supported inline/reference Markdown target existence outside fenced/inline code and tracked output boundaries; limited parser, no CommonMark conformance, external URL, fragment, security or browser assertions.'}
    for name in tracked:
        path = Path(name)
        if (path.parts[0] in ('dist', 'dist-ssr', 'node_modules', 'work') or
                '__pycache__' in path.parts or path.suffix.lower() in ('.pyc', '.pyo')):
            report['trackedTemporaryOutputs'].append(name)
    for name in current:
        path = ROOT / name
        if path.suffix.lower() != '.md' or not path.is_file():
            continue
        report['markdownFiles'] += 1
        for number, target in markdown_targets(path.read_text()):
            try:
                parsed = urlsplit(target)
            except ValueError:
                report['invalidLinkTargets'].append({'file': name, 'line': number, 'target': target})
                continue
            if parsed.scheme or parsed.netloc or not parsed.path or parsed.path.startswith('/'):
                continue
            report['relativePathLinksTested'] += 1
            if not (path.parent / unquote(parsed.path)).exists():
                entry = {'file': name, 'line': number, 'target': target}
                key = 'knownFrozenMissingLinks' if name == FROZEN and target in KNOWN_OLD_TARGETS else 'unexpectedMissingLinks'
                report[key].append(entry)
    report['frozenReferenceUnchanged'] = hashlib.sha256((ROOT / FROZEN).read_bytes()).hexdigest() == FROZEN_SHA
    report['status'] = 'passed' if (not report['unexpectedMissingLinks'] and not report['invalidLinkTargets'] and
                                    not report['trackedTemporaryOutputs'] and report['frozenReferenceUnchanged']) else 'failed'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
