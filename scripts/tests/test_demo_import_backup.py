"""Test backup-before-import and service recovery without accessing a live VPS."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
LOADER = ROOT / 'scripts/load-business-demo.sh'

class DemoImportBackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='cafe-demo-backup-')
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.app = self.base / 'app'
        subprocess.run(['git','clone','--shared','--quiet',str(ROOT),str(self.app)],check=True)
        self.git('config','user.email','demo-qa@example.test')
        self.git('config','user.name','Demo QA')
        for name in ['business-demo.cjs','business-demo-data.ts','business-practice-data.ts','load-business-demo.sh']:
            (self.app/'scripts'/name).write_text((ROOT/'scripts'/name).read_text())
        self.git('add','scripts')
        self.git('commit','-qm','Demo loader fixture')
        self.target = self.git('rev-parse','HEAD').strip()
        (self.app/'.next').mkdir(exist_ok=True)
        (self.app/'.next/BUILD_ID').write_text('existing-build')
        (self.app/'node_modules/tsx').mkdir(parents=True,exist_ok=True)
        (self.app/'node_modules/tsx/package.json').write_text('{}')
        (self.app/'.env').write_text('DATABASE_URL="postgresql://fixture@127.0.0.1/engineer_cafe"\n')
        self.bin = self.base/'bin';self.bin.mkdir()
        self.log=self.base/'actions.log';self.seed=self.base/'seeded'
        self.env=dict(os.environ,CAFE_APP_DIR=str(self.app),CAFE_BACKUP_ROOT=str(self.base/'backups'),QA_LOG=str(self.log),QA_SEED=str(self.seed),PATH=str(self.bin)+':'+os.environ['PATH'])
        self.command('pm2', '''#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
with open(os.environ['QA_LOG'],'a') as f:f.write('pm2 '+' '.join(args)+'\\n')
if args[0]=='pid':
 print('0' if args[1]=='engineer-cafe-notifications' and os.environ.get('QA_WORKER_STOPPED') else '12345')
elif args[0] not in ['stop','restart']:sys.exit(99)
''')
        self.command('docker', '''#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
with open(os.environ['QA_LOG'],'a') as f:f.write('docker '+' '.join(args)+'\\n')
if 'pg_restore' in args:
 if '--list' not in args:sys.exit(97)
 sys.exit(0 if sys.stdin.buffer.read().startswith(b'PGDMP') else 1)
if os.environ.get('QA_FAIL_DUMP'):sys.exit(23)
sys.stdout.buffer.write(b'PGDMP_demo_backup')
''')
        self.command('node', '''#!/usr/bin/env python3
import os,sys
from pathlib import Path
with open(os.environ['QA_LOG'],'a') as f:f.write('node importer\\n')
backup=Path(sys.argv[1]).parent.parent
if not (backup/'SHA256SUMS').is_file():sys.exit(98)
if os.environ.get('QA_FAIL_SEED'):sys.exit(24)
Path(os.environ['QA_SEED']).write_text('demo imported')
print('PASS demo service double')
''')
    def command(self,name,source):
        p=self.bin/name;p.write_text(source);p.chmod(0o700)
    def git(self,*args):
        return subprocess.check_output(['git',*args],cwd=self.app,stderr=subprocess.PIPE,text=True)
    def run_loader(self,mode='demo',**extra):
        return subprocess.run(['bash',str(LOADER),self.target,mode],cwd=self.app,env=dict(self.env,**extra),capture_output=True,text=True,timeout=30)
    def test_success_has_verified_backup_before_import_and_preserves_build(self):
        r=self.run_loader();self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertTrue(self.seed.exists())
        backups=list((self.base/'backups').glob('demo-data-*'));self.assertEqual(len(backups),1)
        self.assertEqual((backups[0]/'database-before-demo.dump').read_bytes(),b'PGDMP_demo_backup')
        self.assertEqual((self.app/'.next/BUILD_ID').read_text(),'existing-build')
        self.assertEqual(self.git('rev-parse','HEAD').strip(),self.target)
        actions=self.log.read_text();self.assertLess(actions.index('pg_restore --list'),actions.index('node importer'))
        self.assertIn('pm2 restart engineer-cafe\n',actions)
        self.assertIn('pm2 restart engineer-cafe-notifications',actions)
    def test_practice_runner_is_included_in_verified_backup(self):
        r=self.run_loader(mode='practice');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        backups=list((self.base/'backups').glob('demo-data-*'));self.assertEqual(len(backups),1)
        self.assertTrue((backups[0]/'runner/business-practice-data.ts').is_file())
        self.assertIn('runner/business-practice-data.ts',(backups[0]/'SHA256SUMS').read_text())
        self.assertTrue(self.seed.exists())
    def test_practice_latest_real_directory_is_preserved(self):
        p=self.base/'backups/practice-latest';p.mkdir(parents=True)
        (p/'keep.txt').write_text('preserve')
        r=self.run_loader(mode='practice');self.assertNotEqual(r.returncode,0)
        self.assertEqual((p/'keep.txt').read_text(),'preserve');self.assertFalse(self.seed.exists())
    def test_failed_dump_never_runs_import_and_restores_services(self):
        r=self.run_loader(QA_FAIL_DUMP='1');self.assertNotEqual(r.returncode,0)
        self.assertFalse(self.seed.exists());actions=self.log.read_text()
        self.assertNotIn('node importer',actions)
        self.assertIn('pm2 restart engineer-cafe\n',actions)
        self.assertIn('pm2 restart engineer-cafe-notifications',actions)
    def test_failed_import_restores_services_without_importing_old_dump(self):
        r=self.run_loader(QA_FAIL_SEED='1');self.assertNotEqual(r.returncode,0)
        self.assertFalse(self.seed.exists());actions=self.log.read_text()
        self.assertIn('pm2 restart engineer-cafe\n',actions)
        self.assertEqual(actions.count('pg_restore'),1)
        self.assertIn('pg_restore --list',actions)
    def test_previously_stopped_worker_is_left_stopped(self):
        r=self.run_loader(QA_WORKER_STOPPED='1');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        actions=self.log.read_text();self.assertNotIn('pm2 stop engineer-cafe-notifications',actions)
        self.assertNotIn('pm2 restart engineer-cafe-notifications',actions)
    def test_uncommitted_accounting_edits_are_preserved(self):
        p=self.app/'src/server/business/core.ts';p.write_text(p.read_text()+'\n// preserve this local edit\n')
        r=self.run_loader();self.assertNotEqual(r.returncode,0)
        self.assertFalse(self.seed.exists());self.assertFalse(self.log.exists())
        self.assertIn('preserve this local edit',p.read_text())
    def test_changed_accounting_services_stop_before_backup_or_services(self):
        p=self.app/'src/server/business/core.ts';p.write_text(p.read_text()+'\n// changed service\n')
        self.git('add',str(p));self.git('commit','-qm','Changed accounting fixture')
        r=self.run_loader();self.assertNotEqual(r.returncode,0)
        self.assertFalse(self.seed.exists());self.assertFalse(self.log.exists())

if __name__=='__main__':unittest.main()
