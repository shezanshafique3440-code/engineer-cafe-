"""Exercise release/rollback safety with real Git, archives and isolated service doubles.

No VPS, Docker daemon or production data is accessed.
"""
import os
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
DEPLOY = ROOT / 'scripts/deploy-reference-storefront.sh'
ROLLBACK = ROOT / 'scripts/rollback-cafe-release.sh'


class ReleaseBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cafe-release-qa-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.app = self.base / 'app'
        self.app.mkdir()
        self.backups = self.base / 'backups'
        self.bin = self.base / 'bin'
        self.bin.mkdir()
        self.pm2log = self.base / 'pm2.log'
        self.dockerlog = self.base / 'docker.log'
        self.state = self.base / 'state'
        self.state.write_text('running')
        self.theme = self.base / 'theme'
        self.theme.write_text('midnight')
        self.env = dict(os.environ, CAFE_APP_DIR=str(self.app), CAFE_BACKUP_ROOT=str(self.backups),
                        QA_APP=str(self.app), QA_PM2_LOG=str(self.pm2log), QA_DOCKER_LOG=str(self.dockerlog),
                        QA_STATE=str(self.state), QA_THEME=str(self.theme), PATH=str(self.bin) + ':' + os.environ['PATH'])
        self.write('.gitignore', '.env\n.next\npublic/uploads/\nnode_modules/\n')
        self.write('package.json', '{"name":"release-fixture"}\n')
        self.write('index.txt', 'old design')
        self.write('node_modules/fixture.txt', 'old dependencies')
        self.write('.env', 'DATABASE_URL="postgresql://fixture:fixture@127.0.0.1:5432/engineer_cafe"\n')
        self.write('.next/BUILD_ID', 'old-build')
        self.write('.next/server/app.js', 'old compiled app')
        self.write('.next/cache/webpack.cache', 'regenerable')
        self.write('public/uploads/menu.png', 'original menu photo')
        self.git('init', '-q')
        self.git('config', 'user.name', 'Release QA')
        self.git('config', 'user.email', 'release-qa@example.test')
        self.git('add', '.')
        self.git('commit', '-qm', 'old release')
        self.old = self.git('rev-parse', 'HEAD').strip()
        self.write('index.txt', 'new design')
        self.write('public/experience/signature-chai.webp', 'test chai artwork')
        self.write('public/experience/cafe-atmosphere.webp', 'test cafe artwork')
        for name in ['chai-cup', 'chai-splash', 'chai-stream', 'ice-cube', 'ingredient-atlas', 'ingredient-extras']:
            self.write('public/experience/' + name + '.webp', 'fixture ' + name)
        self.write('scripts/rollback-cafe-release.sh', ROLLBACK.read_text())
        # Isolate the outer backup/rollback wrapper from the already deployed
        # updater. This delegate deliberately does NOT recover on failure.
        self.write('scripts/deploy-mobile-polish.sh', '''#!/usr/bin/env bash
set -euo pipefail
cd "$CAFE_APP_DIR"
pm2 stop engineer-cafe
mv .next "$CAFE_BACKUP_ROOT/delegate-old-build"
git switch --detach "$1"
mkdir -p .next/server
printf new-build > .next/BUILD_ID
printf 'new compiled app' > .next/server/app.js
if [ "${QA_FAIL_BUILD:-0}" = 1 ]; then exit 23; fi
pm2 restart engineer-cafe --update-env
''')
        self.git('add', '.')
        self.git('commit', '-qm', 'new reviewed release')
        self.target = self.git('rev-parse', 'HEAD').strip()
        self.git('switch', '--detach', self.old)
        self.command('pm2', '''#!/usr/bin/env python3
import os,sys
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['QA_PM2_LOG'],'a') as f:f.write(' '.join(args)+'\\n')
if args[0]!='save' and (len(args)<2 or args[1]!='engineer-cafe'):sys.exit(97)
if args[0]=='stop':Path(os.environ['QA_STATE']).write_text('stopped')
if args[0]=='restart':Path(os.environ['QA_STATE']).write_text('running')
if args[0]=='describe':print('engineer-cafe fixture process')
''')
        self.command('docker', '''#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
with open(os.environ['QA_DOCKER_LOG'],'a') as f:f.write(' '.join(args)+'\\n')
if args[0]=='inspect':sys.exit(0)
if 'pg_restore' in args:
 if '--list' not in args:sys.exit(98)
 sys.exit(0 if sys.stdin.buffer.read().startswith(b'PGDMP') else 1)
if '-lc' in args:
 command=args[args.index('-lc')+1]
 if 'psql' in command:
  from pathlib import Path
  sql=sys.stdin.read()
  if 'SELECT theme' in sql:print(Path(os.environ['QA_THEME']).read_text());sys.exit(0)
  if 'UPDATE public."CafeSetting" SET theme' in sql:
   Path(os.environ['QA_THEME']).write_text(args[-1]);sys.exit(0)
  sys.exit(96)
 if os.environ.get('QA_FAIL_DUMP')=='1':sys.exit(41)
 sys.stdout.buffer.write(b'PGDMP_fixture_database_snapshot');sys.exit(0)
sys.exit(99)
''')
        self.command('curl', '''#!/usr/bin/env python3
import os,sys
from pathlib import Path
from urllib.parse import urlparse
args=sys.argv[1:];app=Path(os.environ['QA_APP'])
if Path(os.environ['QA_STATE']).read_text()!='running':sys.exit(7)
url=next(a for a in reversed(args) if a.startswith('http'))
path=urlparse(url).path
if os.environ.get('QA_FAIL_ROLLBACK')=='1' and (app/'index.txt').read_text()=='old design':sys.exit(22)
if path.startswith('/experience/'):
 data=(app/'public'/path.lstrip('/')).read_bytes()
 if os.environ.get('QA_FAIL_ASSET')=='1':data=b'wrong asset'
elif path=='/':data=b'<main class="cinema-hero">new design</main>' if (app/'index.txt').read_text()=='new design' else b'old homepage'
elif path=='/admin/login':data=b'Cafe control room'
else:data=b'{"products":[]}'
if '-o' in args:
 dest=args[args.index('-o')+1]
 if dest!='/dev/null':Path(dest).write_bytes(data)
else:sys.stdout.buffer.write(data)
if '-w' in args:sys.stdout.write('200')
''')

    def write(self, relative, text):
        path = self.app / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)

    def command(self, name, text):
        path = self.bin / name
        path.write_text(text)
        path.chmod(0o700)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.app, stderr=subprocess.PIPE, text=True)

    def run_script(self, path, *args, **extra_env):
        return subprocess.run(['bash', str(path), *args], cwd=self.app, env=dict(self.env, **extra_env),
                              capture_output=True, text=True, timeout=40)

    def deploy(self, **extra_env):
        return self.run_script(DEPLOY, self.target, **extra_env)

    def snapshot(self):
        return (self.backups / 'latest').resolve(strict=True)

    def assert_old_running(self):
        self.assertEqual(self.git('rev-parse', 'HEAD').strip(), self.old)
        self.assertEqual((self.app / '.next/BUILD_ID').read_text(), 'old-build')
        self.assertEqual(self.state.read_text(), 'running')

    def archive_file(self, path, member):
        with tarfile.open(path) as archive:
            return archive.extractfile(member).read()

    def test_snapshot_and_later_rollback_keep_new_orders_uploads_and_environment(self):
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        backup = self.snapshot()
        self.assertTrue((backup / 'backup-complete').exists())
        self.assertEqual(self.archive_file(backup / 'build.tar.gz', '.next/BUILD_ID'), b'old-build')
        self.assertEqual(self.archive_file(backup / 'dependencies.tar.gz', 'node_modules/fixture.txt'), b'old dependencies')
        self.assertEqual(self.archive_file(backup / 'previous-code.tar.gz', 'index.txt'), b'old design')
        self.assertEqual(self.archive_file(backup / 'uploads.tar.gz', 'public/uploads/menu.png'), b'original menu photo')
        with tarfile.open(backup / 'build.tar.gz') as archive:
            self.assertNotIn('.next/cache/webpack.cache', archive.getnames())
        self.assertEqual((backup / 'previous.env').read_bytes(), (self.app / '.env').read_bytes())
        self.assertTrue((backup / 'database.dump').read_bytes().startswith(b'PGDMP'))
        self.assertEqual(backup.stat().st_mode & 0o777, 0o700)
        original_archive = (backup / 'build.tar.gz').read_bytes()
        self.write('public/uploads/new-menu-photo.png', 'new photo after release')
        self.write('new-order.txt', 'new order after release')
        self.write('node_modules/fixture.txt', 'new dependencies')
        self.write('.env', (self.app / '.env').read_text() + 'AFTER_RELEASE_SETTING=keep\n')
        db_calls = self.dockerlog.read_text()
        rollback = self.run_script(backup / 'rollback.sh')
        self.assertEqual(rollback.returncode, 0, rollback.stdout + rollback.stderr)
        self.assert_old_running()
        self.assertEqual((self.app / 'new-order.txt').read_text(), 'new order after release')
        self.assertEqual((self.app / 'node_modules/fixture.txt').read_text(), 'old dependencies')
        self.assertEqual((self.app / 'public/uploads/new-menu-photo.png').read_text(), 'new photo after release')
        self.assertIn('AFTER_RELEASE_SETTING=keep', (self.app / '.env').read_text())
        self.assertEqual(self.dockerlog.read_text(), db_calls, 'Rollback must never restore the database')
        self.assertEqual((backup / 'build.tar.gz').read_bytes(), original_archive)
        replaced = list(backup.glob('rollback-attempt.*/replaced-build/BUILD_ID'))
        self.assertEqual(len(replaced), 1)
        self.assertEqual(replaced[0].read_text(), 'new-build')

    def test_failed_build_automatically_recovers_from_retained_snapshot(self):
        result = self.deploy(QA_FAIL_BUILD='1')
        self.assertEqual(result.returncode, 23, result.stdout + result.stderr)
        self.assert_old_running()
        self.assertTrue((self.snapshot() / 'build.tar.gz').exists())
        self.assertIn('previous code and build restored', result.stdout)

    def test_wrong_https_artwork_triggers_automatic_rollback(self):
        result = self.deploy(QA_FAIL_ASSET='1')
        self.assertNotEqual(result.returncode, 0)
        self.assert_old_running()
        self.assertTrue((self.snapshot() / 'build.tar.gz').exists())

    def test_failed_database_backup_restarts_original_before_any_code_change(self):
        result = self.deploy(QA_FAIL_DUMP='1')
        self.assertEqual(result.returncode, 41, result.stdout + result.stderr)
        self.assert_old_running()
        self.assertTrue((self.app / '.next/cache/webpack.cache').exists())
        self.assertFalse((self.backups / 'latest').exists())

    def test_modified_snapshot_is_rejected_before_stopping_current_app(self):
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        backup = self.snapshot()
        (backup / 'build.tar.gz').write_bytes(b'corrupted')
        process_log = self.pm2log.read_text()
        result = self.run_script(backup / 'rollback.sh')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('rev-parse', 'HEAD').strip(), self.target)
        self.assertEqual(self.pm2log.read_text(), process_log)
        self.assertEqual(self.state.read_text(), 'running')

    def test_failed_manual_rollback_recovers_the_release_it_was_replacing(self):
        result = self.deploy()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result = self.run_script(self.snapshot() / 'rollback.sh', QA_FAIL_ROLLBACK='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('rev-parse', 'HEAD').strip(), self.target)
        self.assertEqual((self.app / '.next/BUILD_ID').read_text(), 'new-build')
        self.assertEqual(self.state.read_text(), 'running')
        self.assertTrue((self.snapshot() / 'build.tar.gz').exists())

    def test_shared_theme_is_backed_up_and_only_that_setting_is_restored(self):
        result = self.deploy(CAFE_SHARED_THEME='chai')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.theme.read_text(), 'chai')
        backup = self.snapshot()
        self.assertEqual((backup / 'previous-theme').read_text().strip(), 'midnight')
        self.write('new-order.txt', 'keep the new order')
        result = self.run_script(backup / 'rollback.sh')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assert_old_running()
        self.assertEqual(self.theme.read_text(), 'midnight')
        self.assertEqual((self.app / 'new-order.txt').read_text(), 'keep the new order')
        self.assertNotIn('pg_restore -d', self.dockerlog.read_text())

    def test_failed_shared_theme_release_automatically_restores_the_old_palette(self):
        result = self.deploy(CAFE_SHARED_THEME='chai', QA_FAIL_ASSET='1')
        self.assertNotEqual(result.returncode, 0)
        self.assert_old_running()
        self.assertEqual(self.theme.read_text(), 'midnight')

    def test_new_theme_presets_can_be_backed_up_and_restored(self):
        self.theme.write_text('ocean')
        result = self.deploy(CAFE_SHARED_THEME='espresso')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.theme.read_text(), 'espresso')
        self.assertEqual((self.snapshot() / 'previous-theme').read_text().strip(), 'ocean')
        result = self.run_script(self.snapshot() / 'rollback.sh')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assert_old_running()
        self.assertEqual(self.theme.read_text(), 'ocean')

    def test_failed_rollback_recovers_a_new_dark_preset(self):
        self.theme.write_text('royal')
        result = self.deploy(CAFE_SHARED_THEME='espresso')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result = self.run_script(self.snapshot() / 'rollback.sh', QA_FAIL_ROLLBACK='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('rev-parse', 'HEAD').strip(), self.target)
        self.assertEqual(self.theme.read_text(), 'espresso')
        self.assertEqual(self.state.read_text(), 'running')

    def test_failed_manual_rollback_recovers_current_palette_alongside_current_code(self):
        result = self.deploy(CAFE_SHARED_THEME='chai')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        result = self.run_script(self.snapshot() / 'rollback.sh', QA_FAIL_ROLLBACK='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git('rev-parse', 'HEAD').strip(), self.target)
        self.assertEqual(self.theme.read_text(), 'chai')
        self.assertEqual((self.app / '.next/BUILD_ID').read_text(), 'new-build')


    def test_tracked_local_edits_block_release_without_stopping_app(self):
        self.write('index.txt', 'local edit to preserve')
        result = self.deploy()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((self.app / 'index.txt').read_text(), 'local edit to preserve')
        self.assertEqual(self.state.read_text(), 'running')
        self.assertFalse(self.pm2log.exists())

    def test_additive_policy_accepts_reviewed_upgrade_and_rejects_extra_migration(self):
        self.git('switch', '--detach', self.old)
        files = ['package.json', 'package-lock.json', 'prisma/schema.prisma']
        baseline_ref = json.loads((ROOT / 'scripts/experience-release-policy.json').read_text())['baselineCommit']
        existing = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', baseline_ref, 'prisma/migrations'], cwd=ROOT, text=True).splitlines()
        for file in files + existing:
            self.write(file, subprocess.check_output(['git', 'show', baseline_ref + ':' + file], cwd=ROOT, text=True))
        self.git('add', '.')
        self.git('commit', '-qm', 'real baseline fixture')
        baseline = self.git('rev-parse', 'HEAD').strip()
        for file in files + ['scripts/experience-release-policy.json', 'prisma/migrations/20261106120000_cafe_experience/migration.sql']:
            self.write(file, (ROOT / file).read_text())
        self.git('add', '.')
        self.git('commit', '-qm', 'reviewed additive fixture')
        upgraded = self.git('rev-parse', 'HEAD').strip()
        command = ['node', str(ROOT / 'scripts/check-experience-release.cjs'), baseline, upgraded]
        accepted = subprocess.run(command, cwd=self.app, capture_output=True, text=True)
        self.assertEqual(accepted.returncode, 0, accepted.stdout + accepted.stderr)
        self.write('prisma/migrations/extra/migration.sql', 'DROP TABLE "Order";')
        self.git('add', '.')
        self.git('commit', '-qm', 'unreviewed fixture migration')
        command[-1] = self.git('rev-parse', 'HEAD').strip()
        rejected = subprocess.run(command, cwd=self.app, capture_output=True, text=True)
        self.assertNotEqual(rejected.returncode, 0)
        self.assertIn('Unexpected migration set', rejected.stderr)
        self.git('switch', '--detach', upgraded)
        self.write('prisma/migrations/20261106120000_cafe_experience/migration.sql', 'DROP TABLE "Order";')
        self.git('add', '.')
        self.git('commit', '-qm', 'tampered reviewed migration')
        command[-1] = self.git('rev-parse', 'HEAD').strip()
        tampered = subprocess.run(command, cwd=self.app, capture_output=True, text=True)
        self.assertNotEqual(tampered.returncode, 0)
        self.assertIn('Unreviewed upgrade content', tampered.stderr)


if __name__ == '__main__':
    unittest.main()
