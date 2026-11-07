"""Regression: run the real CLI from /tmp, without the QA preload's NODE_PATH."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]

class DemoRunnerResolutionTests(unittest.TestCase):
    def run_external(self,preserve_extra=False):
        with tempfile.TemporaryDirectory(prefix='cafe-external-runner-') as tmp:
            directory=Path(tmp)
            runner=directory/'business-demo.cjs'
            runner.write_text((ROOT/'scripts/business-demo.cjs').read_text())
            preload=directory/'preload.cjs'
            preload.write_text('globalThis.prisma={$disconnect:async()=>{}};')
            source=directory/'business-practice-data.ts'
            source.write_text('''import bcrypt from "bcryptjs";
import {Prisma} from "@prisma/client";
import "server-only";
import {paise} from "@/lib/business-math";
export async function seedBusinessPractice(){
 if(typeof bcrypt.hash!=="function"||!Prisma||paise("0.01")!==1n)throw Error("Dependency unavailable");
 if(process.env.QA_CHECK_EXTRA && require("qa-extra-dependency")!==42)throw Error("Existing NODE_PATH was lost");
 console.log("PASS external runner dependencies and aliases");
}
''')
            env=dict(os.environ,DATABASE_URL='postgresql://fixture@localhost/cafe_business_test',CAFE_DEMO_SOURCE=str(source),TSX_TSCONFIG_PATH=str(ROOT/'tsconfig.json'))
            env.pop('NODE_PATH',None);env.pop('NODE_OPTIONS',None)
            if preserve_extra:
                extra=directory/'extra';package=extra/'qa-extra-dependency';package.mkdir(parents=True)
                (package/'index.js').write_text('module.exports=42;')
                env.update(NODE_PATH=str(extra),QA_CHECK_EXTRA='1')
            result=subprocess.run(['node','--require',str(preload),str(runner),'--apply'],cwd=ROOT,env=env,capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stdout+result.stderr)
            self.assertIn('PASS external runner dependencies and aliases',result.stdout)
    def test_external_backup_directory_without_node_path(self):self.run_external()
    def test_existing_custom_node_path_is_preserved(self):self.run_external(True)

if __name__=='__main__':unittest.main()
