#!/usr/bin/env python3
"""Cloud stages around the interactive Codex design/implementation step."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parent.parent


def run(*args, capture=False):
    return subprocess.run(args, cwd=ROOT, check=True, text=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def preflight():
    # Check before changing the archive or consuming a rotation slot.
    for url in ('https://muuuuu.org', 'https://website.e-function.site/version.json'):
        try:
            with urllib.request.urlopen(url, timeout=20) as response:
                if response.status != 200:
                    raise RuntimeError(f'HTTP {response.status}')
                if url.endswith('/version.json'):
                    data = json.load(response)
                    if not data.get('deploy_id'):
                        raise RuntimeError('Missing deploy_id')
        except Exception as exc:
            raise RuntimeError(f'Network preflight failed: {url}: {exc}') from exc


def verify():
    run('npm', 'run', 'build')
    run('node', 'scripts/web-quality-check.mjs')
    report = (ROOT / 'docs/quality/latest.md').read_text()
    if '| 🔴 high |' in report:
        raise RuntimeError('Static quality has high findings; publication stopped')
    run('npm', 'run', 'check:catalog')
    run('npm', 'run', 'check:thumbs')
    run('node', 'scripts/web-render-check.mjs')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['preflight', 'prepare', 'verify', 'publish'])
    args = parser.parse_args()
    os.environ.setdefault('ASTRO_TELEMETRY_DISABLED', '1')
    if args.stage in ('preflight', 'prepare', 'publish'):
        preflight()
    if args.stage == 'prepare':
        run('python3', 'site_archive/fetch_site_archive.py', '--pages', '1')
        job = json.loads(run('python3', 'scripts/web-learning-next.py', '--models', 'cloud', capture=True))
        run_dir = job['paths']['run_dir']
        run('node', 'scripts/web-analyze-reference-motion.mjs',
            '--url=' + job['reference']['url'], '--out=' + run_dir, '--follow-nav=2')
        print(f'Prepared {run_dir}. Continue the Codex design/implementation steps in docs/cloud-learning-cycle.md.')
    if args.stage == 'publish' and (ROOT / '.release-worktree').exists():
        raise RuntimeError('Existing release worktree: preserve/review it before publication')
    if args.stage == 'publish' and run('git', 'status', '--porcelain', capture=True).strip():
        raise RuntimeError('Commit reviewed source changes before publishing')
    if args.stage in ('verify', 'publish'):
        verify()
    if args.stage == 'publish':
        # Verification refreshes only these reports; any other generated/source change blocks shipping.
        allowed = {'docs/quality/history.json', 'docs/quality/latest.md', 'docs/quality/render-check.json'}
        changes = run('git', 'status', '--porcelain', capture=True).splitlines()
        if any(line[3:] not in allowed or line[:2] != ' M' for line in changes):
            raise RuntimeError('Verification changed files other than quality reports; review and commit them first')
        run('git', 'fetch', 'origin', 'main')
        run('git', 'merge-base', '--is-ancestor', 'origin/main', 'HEAD')
        run('git', 'push', 'origin', 'HEAD:main')
        run('bash', 'scripts/release-deploy.sh')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        raise SystemExit(str(exc))
