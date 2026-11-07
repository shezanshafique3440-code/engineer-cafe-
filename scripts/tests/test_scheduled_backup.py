"""Exercise backup verification and failure recovery without accessing a VPS."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[2]
class ScheduledBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='cafe-backup-qa-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.app = self.root/'app'
        (self.app/'public/uploads').mkdir(parents=True)
        (self.app/'.env').write_text('PRIVATE_TEST_SECRET=keep-private\nDATABASE_URL=postgresql://fixture:private@127.0.0.1/engineer_cafe\n')
        (self.app/'public/uploads/logo.txt').write_text('retained upload')
        self.bin = self.root/'bin'; self.bin.mkdir()
        self.log = self.root/'actions'
        self.env = dict(os.environ, PATH=str(self.bin)+':'+os.environ['PATH'], CAFE_APP_DIR=str(self.app), CAFE_BACKUP_ROOT=str(self.root/'backups'), QA_LOG=str(self.log))
        self.command('git', '#!/bin/sh\nprintf "%040d\\n" 1\n')
        self.command('pm2', '''#!/usr/bin/env python3
import os,sys
with open(os.environ['QA_LOG'],'a') as f:f.write('pm2 '+' '.join(sys.argv[1:])+'\\n')
if sys.argv[1]=='pid':print('0' if os.environ.get('QA_STOPPED') else '123')
''')
        self.command('docker', '''#!/usr/bin/env python3
import os,sys
args=' '.join(sys.argv[1:])
with open(os.environ['QA_LOG'],'a') as f:f.write('docker '+args+'\\n')
if 'pg_dump' in args:
 if os.environ.get('QA_FAIL_DUMP'):sys.exit(2)
 sys.stdout.buffer.write(b'PGDMP_test_snapshot')
elif 'pg_restore' in args:
 sys.stdin.buffer.read()
 if '--list' not in args and os.environ.get('QA_FAIL_RESTORE'):sys.exit(3)
elif 'psql' in args:sys.stdin.read();print('Verified restored ledger')
''')
    def command(self,name,content):
        p=self.bin/name;p.write_text(content);p.chmod(0o700)
    def run_script(self,name,*args,**env):
        return subprocess.run(['bash',str(ROOT/'scripts'/name),*map(str,args)],env=dict(self.env,**env),capture_output=True,text=True,timeout=15)
    def backup(self):
        r=self.run_script('backup-cafe.sh');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        return next((self.root/'backups').glob('scheduled-*'))
    def test_verified_database_env_and_uploads_with_private_permissions(self):
        backup=self.backup()
        self.assertEqual((backup/'previous.env').read_bytes(),(self.app/'.env').read_bytes())
        self.assertTrue((backup/'backup-complete').is_file())
        self.assertEqual(backup.stat().st_mode & 0o777,0o700)
        self.assertNotIn('PRIVATE_TEST_SECRET',self.log.read_text())
        subprocess.run(['tar','-xzf',str(backup/'uploads.tar.gz'),'-C',str(self.root)],check=True)
        self.assertEqual((self.root/'uploads/logo.txt').read_text(),'retained upload')
        actions=self.log.read_text();self.assertIn('pm2 restart engineer-cafe\n',actions);self.assertNotIn('seller-api',actions)
    def test_failed_dump_recovers_services_without_completion_marker(self):
        r=self.run_script('backup-cafe.sh',QA_FAIL_DUMP='1');self.assertNotEqual(r.returncode,0)
        self.assertFalse(list((self.root/'backups').glob('*/backup-complete')))
        self.assertIn('pm2 restart engineer-cafe\n',self.log.read_text())
    def test_previously_stopped_services_remain_stopped(self):
        r=self.run_script('backup-cafe.sh',QA_STOPPED='1');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertNotIn('pm2 restart',self.log.read_text());self.assertNotIn('pm2 stop',self.log.read_text())
    def test_restore_checks_only_new_temporary_database_and_cleans_it(self):
        backup=self.backup();self.log.write_text('')
        r=self.run_script('verify-cafe-backup.sh',backup);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        actions=self.log.read_text();self.assertIn('createdb',actions);self.assertIn('cafe_restore_check_',actions);self.assertIn('dropdb',actions)
        self.assertNotIn('-d engineer_cafe',actions)
    def test_failed_restore_removes_only_temporary_database(self):
        backup=self.backup();self.log.write_text('')
        r=self.run_script('verify-cafe-backup.sh',backup,QA_FAIL_RESTORE='1');self.assertNotEqual(r.returncode,0)
        self.assertIn('dropdb',self.log.read_text())
    def test_corruption_stops_before_database_creation(self):
        backup=self.backup();(backup/'database.dump').write_bytes(b'corrupted');self.log.write_text('')
        r=self.run_script('verify-cafe-backup.sh',backup);self.assertNotEqual(r.returncode,0)
        self.assertNotIn('createdb',self.log.read_text())

    def test_active_client_database_is_selected_without_exposing_credentials(self):
        (self.app/'.env').write_text('DATABASE_URL=postgresql://fixture:private@127.0.0.1/engineer_cafe_client\n')
        backup=self.backup()
        self.assertEqual((backup/'database-name').read_text().strip(),'engineer_cafe_client')
        self.assertIn('engineer_cafe_client',self.log.read_text())
        self.assertNotIn('fixture:private',self.log.read_text())
    def test_unrelated_database_refused_before_stopping_services(self):
        (self.app/'.env').write_text('DATABASE_URL=postgresql://fixture:private@127.0.0.1/unrelated_store\n')
        r=self.run_script('backup-cafe.sh');self.assertNotEqual(r.returncode,0)
        self.assertFalse(self.log.exists())
