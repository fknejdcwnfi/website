#!/usr/bin/env python3
"""Backward-compatible entry point for the former journal-only browser check.

The current site combines logs and thoughts, so this delegates to the unified
writing-space verifier while preserving historical command links.
"""
from pathlib import Path
import runpy

runpy.run_path(str(Path(__file__).with_name('verify_writing.py')), run_name='__main__')
