// Accept only reviewed additive releases from the pinned supported baselines.
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const [old, next] = process.argv.slice(2);
const read = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`]);
const hash = (ref, path) =>
  createHash("sha256").update(read(ref, path)).digest("hex");
const policy = JSON.parse(read(next, "scripts/experience-release-policy.json"));
if (
  ![policy.baseline, ...(policy.additionalBaselines || [])].some((base) =>
    Object.entries(base).every(
      ([path, expected]) => hash(old, path) === expected,
    ),
  )
)
  throw Error("Unreviewed baseline: package or schema");
for (const [path, expected] of Object.entries(policy.upgrade))
  if (hash(next, path) !== expected)
    throw Error("Unreviewed upgrade content: " + path);
const migrations = (ref) =>
  execFileSync(
    "git",
    ["ls-tree", "-r", "--name-only", ref, "prisma/migrations"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);
const before = migrations(old),
  after = migrations(next);
for (const file of before)
  if (!after.includes(file) || hash(old, file) !== hash(next, file))
    throw Error("Existing migration changed: " + file);
const added = after.filter((p) => !before.includes(p));
const expected = Object.keys(policy.upgrade)
  .filter((p) => p.startsWith("prisma/migrations/") && !before.includes(p))
  .sort();
if (JSON.stringify(added.sort()) !== JSON.stringify(expected))
  throw Error("Unexpected migration set");
const oldPackage = JSON.parse(read(old, "package.json")),
  newPackage = JSON.parse(read(next, "package.json"));
if (!oldPackage.dependencies["web-push"])
  delete newPackage.dependencies["web-push"];
if (!oldPackage.devDependencies["@types/web-push"])
  delete newPackage.devDependencies["@types/web-push"];
if (JSON.stringify(oldPackage) !== JSON.stringify(newPackage))
  throw Error("Unexpected package changes");
console.log("PASS: reviewed additive cafe schema and dependency upgrade.");
