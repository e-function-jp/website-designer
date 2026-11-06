import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('cycle', Path(__file__).resolve().parents[1] / 'scripts/web-cloud-cycle.py')
cycle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cycle)

class CloudCycleTests(unittest.TestCase):
    def test_prepare_network_failure_does_not_consume_run(self):
        with patch.object(sys, 'argv', ['cycle', 'prepare']), patch.object(cycle, 'preflight', side_effect=RuntimeError('403')), patch.object(cycle, 'run') as run:
            with self.assertRaises(RuntimeError): cycle.main()
            run.assert_not_called()

    def test_failed_quality_never_pushes(self):
        with patch.object(sys, 'argv', ['cycle', 'publish']), patch.object(cycle, 'preflight'), patch.object(cycle, 'verify', side_effect=RuntimeError('high')), patch.object(cycle, 'run', return_value='') as run:
            with self.assertRaises(RuntimeError): cycle.main()
            self.assertFalse(any(c.args[1:2] == ('push',) for c in run.call_args_list))

    def test_verified_reports_allow_release(self):
        def result(*args, **kwargs):
            if args[:2] == ('git', 'status'):
                return '' if result.first else ' M docs/quality/latest.md\n'
            return ''
        result.first = True
        def verify(): result.first = False
        with patch.object(sys, 'argv', ['cycle', 'publish']), patch.object(cycle, 'preflight'), patch.object(cycle, 'verify', side_effect=verify), patch.object(cycle, 'run', side_effect=result) as run:
            cycle.main()
            self.assertIn(unittest.mock.call('git', 'push', 'origin', 'HEAD:main'), run.call_args_list)
            self.assertIn(unittest.mock.call('bash', 'scripts/release-deploy.sh'), run.call_args_list)

    def test_unexpected_generated_file_blocks_release(self):
        with patch.object(sys, 'argv', ['cycle', 'publish']), patch.object(cycle, 'preflight'), patch.object(cycle, 'verify'), patch.object(cycle, 'run', side_effect=['', '?? public/thumbs/new.jpg\n']) as run:
            with self.assertRaises(RuntimeError): cycle.main()
            self.assertEqual(run.call_count, 2)

if __name__ == '__main__': unittest.main()
