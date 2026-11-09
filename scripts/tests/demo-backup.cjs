// Uses a real archive and pg_restore, with a local Docker-command adapter.
// No database is modified and no real Docker daemon is contacted.
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const url = new URL(process.env.DATABASE_URL || "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/cafe_demo_cleanup_test", "Disposable local test environment required.");
const archive=process.env.CAFE_TEST_ARCHIVE, restore=process.env.CAFE_TEST_RESTORE;
assert.ok(archive && path.isAbsolute(archive) && fs.statSync(archive).size > 1048576, "A real archive larger than the pipe buffer is required.");
assert.ok(restore && path.isAbsolute(restore), "Explicit pg_restore binary required.");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cafe-backup-stream-"));
const prior={PATH:process.env.PATH,CAFE_DEMO_BACKUP_DIR:process.env.CAFE_DEMO_BACKUP_DIR,CAFE_DEMO_BACKUP_DRIVER:process.env.CAFE_DEMO_BACKUP_DRIVER};
try {
  const bin=path.join(dir,"bin");fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin,"docker"),'#!/bin/sh\n[ "$1" = exec ] && [ "$2" = -i ] && [ "$3" = infra-postgres-1 ] && [ "$4" = pg_restore ] && [ "$5" = --list ] || exit 99\nexec "$CAFE_TEST_RESTORE" --list\n',{mode:0o700});
  process.env.PATH=bin+path.delimiter+prior.PATH;
  process.env.CAFE_DEMO_BACKUP_DIR=dir;delete process.env.CAFE_DEMO_BACKUP_DRIVER;
  const {backupDatabase}=require("../demo-backup.cjs");
  function fixture(id,bytes){const target=path.join(dir,id);fs.mkdirSync(target);fs.writeFileSync(path.join(target,"database.dump"),bytes,{mode:0o600});return path.join(target,"database.dump");}
  fixture("valid",fs.readFileSync(archive));
  const result=backupDatabase("valid");assert.match(result.hash,/^[a-f0-9]{64}$/);assert.ok(fs.existsSync(result.path));
  fixture("corrupt",Buffer.alloc(4096));assert.throws(()=>backupDatabase("corrupt"),/verification failed/);
  fs.writeFileSync(path.join(bin,"docker"),'#!/bin/sh\nexit 7\n',{mode:0o700});
  assert.throws(()=>backupDatabase("valid"),/verification failed/);
  console.log("PASS: Docker verification handles successful early stdin closure, rejects corrupt archives and rejects nonzero command exits.");
} finally {
  for(const [key,value] of Object.entries(prior)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}
  fs.rmSync(dir,{recursive:true,force:true});
}
