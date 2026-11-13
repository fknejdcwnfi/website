#!/usr/bin/env python3
"""Exercise the actual repository guard CLI in isolated temporary Git samples."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class RepositoryStructureTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='website-structure-test-')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.guard = self.root / 'scripts/qa/verify_repository_structure.py'
        self.guard.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / 'scripts/qa/verify_repository_structure.py', self.guard)
        self.frozen = self.root / 'docs/reference/README.md'
        self.frozen.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / 'docs/reference/README.md', self.frozen)
        subprocess.run(['git', 'init', '-q', '-b', 'main', str(self.root)], check=True)

    def run_guard(self, text, *, optimized=False, extra=None):
        (self.root / 'README.md').write_text(text)
        for name, content in (extra or {}).items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)
        subprocess.run(['git', '-C', str(self.root), 'add', '--all'], check=True)
        env = dict(os.environ)
        env.pop('PYTHONOPTIMIZE', None)
        result = subprocess.run([sys.executable, *(['-O'] if optimized else []), str(self.guard)],
                                env=env, capture_output=True, text=True)
        report = json.loads(result.stdout)
        return result.returncode, report

    def test_frozen_seven_exceptions_remain_hash_pinned(self):
        code, report = self.run_guard('# Valid document\n')
        self.assertEqual(code, 0)
        self.assertEqual(len(report['knownFrozenMissingLinks']), 7)
        self.assertTrue(report['frozenReferenceUnchanged'])
        self.assertEqual(report['unexpectedMissingLinks'], [])

    def test_missing_target_exits_nonzero_with_or_without_optimization(self):
        for optimized in (False, True):
            with self.subTest(optimized=optimized):
                code, report = self.run_guard('[missing](missing.md)\n', optimized=optimized)
                self.assertEqual(code, 1)
                self.assertEqual(report['status'], 'failed')
                self.assertEqual(report['unexpectedMissingLinks'][0]['target'], 'missing.md')

    def test_frozen_content_change_fails_even_with_optimization(self):
        self.frozen.write_bytes(self.frozen.read_bytes() + b'\nchanged\n')
        code, report = self.run_guard('# Valid document\n', optimized=True)
        self.assertEqual(code, 1)
        self.assertFalse(report['frozenReferenceUnchanged'])

    def test_full_reference_checks_destination_and_usage_line(self):
        code, report = self.run_guard('[Read this][Guide]\n\n[guide]: missing.md "Guide"\n')
        self.assertEqual(code, 1)
        self.assertEqual(report['unexpectedMissingLinks'], [{'file': 'README.md', 'line': 1, 'target': 'missing.md'}])

    def test_collapsed_and_shortcut_references_are_checked(self):
        for text in ('[guide][]\n\n[guide]: missing.md\n', '[guide]\n\n[guide]: missing.md\n'):
            with self.subTest(text=text):
                code, report = self.run_guard(text)
                self.assertEqual(code, 1)
                self.assertEqual(report['unexpectedMissingLinks'][0]['target'], 'missing.md')

    def test_reference_labels_normalize_case_and_whitespace(self):
        code, report = self.run_guard('[Read][ Project  GUIDE ]\n\n[project guide]: guide.md\n', extra={'guide.md': '# Guide\n'})
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 1)

    def test_reference_images_check_target(self):
        code, report = self.run_guard('![picture][cover]\n\n[cover]: missing.png\n')
        self.assertEqual(code, 1)
        self.assertEqual(report['unexpectedMissingLinks'][0]['target'], 'missing.png')

    def test_unused_or_undefined_reference_text_is_not_a_link(self):
        code, report = self.run_guard('[undefined][not-defined]\n\n[unused]: missing.md\n')
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_inline_code_is_not_a_link(self):
        code, report = self.run_guard('Example: `[missing](missing.md)` and `` `[also](missing.md)` ``.\n')
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_multiline_code_span_is_not_a_link(self):
        code, report = self.run_guard('`a code span\n[missing](missing.md)`\n')
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_backtick_and_tilde_fences_hide_links_and_definitions(self):
        text = '```markdown\n[missing](missing.md)\n[hidden]: missing.md\n```\n~~~\n[missing][hidden]\n~~~\n[hidden]\n'
        code, report = self.run_guard(text)
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_unclosed_fence_is_code_until_end(self):
        code, report = self.run_guard('```\n[missing](missing.md)\n')
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_real_link_after_code_still_fails(self):
        code, report = self.run_guard('`[example](fake.md)` then [real](missing.md)\n')
        self.assertEqual(code, 1)
        self.assertEqual([link['target'] for link in report['unexpectedMissingLinks']], ['missing.md'])

    def test_escaped_bracket_is_not_a_link(self):
        code, report = self.run_guard(r'\[literal](missing.md)' + '\n')
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 0)

    def test_angle_destinations_with_spaces_and_first_definition_win(self):
        code, report = self.run_guard('[read][guide]\n\n[guide]: <space name.md>\n[guide]: missing.md\n', extra={'space name.md': '# Guide\n'})
        self.assertEqual(code, 0)
        self.assertEqual(report['relativePathLinksTested'] - len(report['knownFrozenMissingLinks']), 1)

    def test_loose_bytecode_and_known_temporary_directories_fail(self):
        for name in ('loose.pyc', 'nested/loose.pyo', 'nested/loose.PYC', 'work/result.txt',
                     'dist/index.html', 'node_modules/example.txt', 'nested/__pycache__/cache.txt'):
            with self.subTest(name=name):
                code, report = self.run_guard('# Valid document\n', extra={name: 'synthetic fixture'})
                self.assertEqual(code, 1)
                self.assertIn(name, report['trackedTemporaryOutputs'])

    def test_historical_audit_logs_are_not_temporary_cache(self):
        code, report = self.run_guard('# Valid document\n', extra={'artifacts/prior-audit/build.log': 'Historical evidence\n'})
        self.assertEqual(code, 0)
        self.assertEqual(report['trackedTemporaryOutputs'], [])

    def test_malformed_url_fails_with_machine_readable_report(self):
        code, report = self.run_guard('[bad](http://[)\n')
        self.assertEqual(code, 1)
        self.assertEqual(report['invalidLinkTargets'][0]['target'], 'http://[')


if __name__ == '__main__':
    unittest.main(verbosity=2)
