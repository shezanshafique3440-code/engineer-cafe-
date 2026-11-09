// No shell interpolation; credentials stay in child environment, never arguments/logs.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const allowed = new Set(["engineer_cafe", "cafe_demo_cleanup_test"]);
function run(command, args, options = {}) {
  const p = spawnSync(command, args, { timeout: 240000, ...options });
  if (p.error || p.status !== 0)
    throw Error(
      "Database backup or archive verification failed. No demo data was changed.",
    );
  return p;
}
function backupDatabase(jobId) {
  const u = new URL(process.env.DATABASE_URL);
  const db = decodeURIComponent(u.pathname.slice(1));
  if (!allowed.has(db) || !["localhost", "127.0.0.1"].includes(u.hostname))
    throw Error("Demo manager requires the reviewed local cafe database.");
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId))
    throw Error("Invalid backup job identifier.");
  const base =
    process.env.CAFE_DEMO_BACKUP_DIR ||
    "/var/backups/engineer-cafe/demo-manager";
  if (!path.isAbsolute(base)) throw Error("Backup directory must be absolute.");
  const dir = path.join(base, jobId);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const file = path.join(dir, "database.dump"),
    partial = file + ".partial";
  const env = {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port || "5432",
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: db,
  };
  const docker = process.env.CAFE_DEMO_BACKUP_DRIVER !== "local";
  const restore = () =>
    docker
      ? run(
          "docker",
          ["exec", "-i", "infra-postgres-1", "pg_restore", "--list"],
          { input: fs.readFileSync(file) },
        )
      : run(process.env.CAFE_PG_RESTORE || "pg_restore", ["--list", file], {
          env,
        });
  if (fs.existsSync(file)) {
    restore();
    return {
      path: file,
      hash: crypto
        .createHash("sha256")
        .update(fs.readFileSync(file))
        .digest("hex"),
    };
  }
  try {
    const fd = fs.openSync(partial, "w", 0o600);
    try {
      if (docker)
        run(
          "docker",
          [
            "exec",
            "infra-postgres-1",
            "sh",
            "-lc",
            'exec pg_dump -Fc --no-owner --no-acl -U "${POSTGRES_USER:-postgres}" -d "$1"',
            "demo-backup",
            db,
          ],
          { stdio: ["ignore", fd, "pipe"] },
        );
      else
        run(
          process.env.CAFE_PG_DUMP || "pg_dump",
          ["-Fc", "--no-owner", "--no-acl"],
          { env, stdio: ["ignore", fd, "pipe"] },
        );
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    if (fs.statSync(partial).size < 1000)
      throw Error("Database backup is unexpectedly small.");
    fs.renameSync(partial, file);
    restore();
    const hash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
    fs.writeFileSync(path.join(dir, "sha256.txt"), hash + "  database.dump\n", {
      mode: 0o600,
    });
    return { path: file, hash };
  } catch (e) {
    for (const f of [partial, file])
      try {
        fs.unlinkSync(f);
      } catch {}
    throw e;
  }
}
module.exports = { backupDatabase };
