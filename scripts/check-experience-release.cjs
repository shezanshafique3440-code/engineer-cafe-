// Permit only the reviewed additive schema/dependency upgrade, in either direction.
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const [old, next] = process.argv.slice(2);
const read = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`]);
const hash = (ref, path) =>
  createHash("sha256").update(read(ref, path)).digest("hex");
const policy = JSON.parse(read(next, "scripts/experience-release-policy.json"));
for (const [path, expected] of Object.entries(policy.baseline)) {
  if (hash(old, path) !== expected)
    throw new Error(`Unreviewed baseline: ${path}`);
}
for (const [path, expected] of Object.entries(policy.upgrade)) {
  if (hash(next, path) !== expected)
    throw new Error(`Unreviewed upgrade content: ${path}`);
}
const oldMigrations = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", old, "prisma/migrations"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n");
for (const file of oldMigrations)
  if (hash(old, file) !== hash(next, file))
    throw new Error("Existing migration changed: " + file);
const added = execFileSync(
  "git",
  ["diff", "--name-only", old, next, "--", "prisma/migrations"],
  { encoding: "utf8" },
)
  .trim()
  .split("\n")
  .filter(Boolean);
if (
  JSON.stringify(added) !==
  JSON.stringify([
    "prisma/migrations/20261106120000_cafe_experience/migration.sql",
  ])
)
  throw new Error("Unexpected migration set");
const before = JSON.parse(read(old, "package.json")),
  after = JSON.parse(read(next, "package.json"));
delete after.dependencies["web-push"];
delete after.devDependencies["@types/web-push"];
if (JSON.stringify(before) !== JSON.stringify(after))
  throw new Error("Unexpected package changes");
console.log(
  "PASS: reviewed additive experience migration and Web Push dependencies.",
);
