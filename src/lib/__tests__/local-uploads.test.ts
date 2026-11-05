import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readLocalUpload } from "../../server/local-uploads";
import { GET } from "../../app/uploads/[...path]/route";

test("an image created after the first lookup is immediately available", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cafe-upload-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  assert.equal(await readLocalUpload(["new-logo.png"], root), null);
  const bytes = Buffer.from("newly uploaded image bytes");
  await writeFile(path.join(root, "new-logo.png"), bytes);
  const image = await readLocalUpload(["new-logo.png"], root);
  assert.equal(image?.mime, "image/png");
  assert.deepEqual(image?.buffer, bytes);
});

test("existing nested menu images and all supported raster extensions retain their type", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cafe-upload-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "menu-photos-v1"));
  for (const [extension, mime] of [
    ["jpg", "image/jpeg"],
    ["JPEG", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
    ["avif", "image/avif"],
  ]) {
    const name = `cafe image.${extension}`;
    await writeFile(path.join(root, "menu-photos-v1", name), "image");
    assert.equal(
      (await readLocalUpload(["menu-photos-v1", name], root))?.mime,
      mime,
    );
  }
});

test("path traversal, hidden files, non-images and directories cannot be served", async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), "cafe-upload-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, "uploads");
  await mkdir(root);
  await writeFile(path.join(parent, "private.png"), "outside root");
  await writeFile(path.join(root, ".private.png"), "hidden");
  await writeFile(path.join(root, "script.html"), "not an image");
  await mkdir(path.join(root, "folder.png"));
  for (const parts of [
    [],
    [""],
    ["..", "private.png"],
    ["../private.png"],
    ["..\\private.png"],
    ["/private.png"],
    ["bad\0.png"],
    [".private.png"],
    ["script.html"],
    ["folder.png"],
  ])
    assert.equal(
      await readLocalUpload(parts, root),
      null,
      JSON.stringify(parts),
    );
});

test("symlinks cannot escape the uploads directory", async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), "cafe-upload-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = path.join(parent, "uploads");
  await mkdir(root);
  await writeFile(path.join(parent, "private.png"), "outside root");
  await symlink(path.join(parent, "private.png"), path.join(root, "logo.png"));
  assert.equal(await readLocalUpload(["logo.png"], root), null);
  await mkdir(path.join(parent, "private"));
  await writeFile(path.join(parent, "private", "photo.jpg"), "outside folder");
  await symlink(path.join(parent, "private"), path.join(root, "folder"));
  assert.equal(await readLocalUpload(["folder", "photo.jpg"], root), null);
  await writeFile(path.join(root, ".hidden.png"), "private image");
  await symlink(path.join(root, ".hidden.png"), path.join(root, "alias.png"));
  assert.equal(await readLocalUpload(["alias.png"], root), null);
  await writeFile(path.join(root, "private.txt"), "not an image");
  await symlink(path.join(root, "private.txt"), path.join(root, "alias.jpg"));
  assert.equal(await readLocalUpload(["alias.jpg"], root), null);
});

test("a persistent uploads volume symlink remains supported", async (t) => {
  const parent = await mkdtemp(path.join(tmpdir(), "cafe-upload-"));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const volume = path.join(parent, "persistent");
  await mkdir(volume);
  await writeFile(path.join(volume, "logo.png"), "stored image");
  const root = path.join(parent, "uploads");
  await symlink(volume, root);
  assert.equal(
    (await readLocalUpload(["logo.png"], root))?.buffer.toString(),
    "stored image",
  );
});

test("the public route serves fresh bytes, revalidates changes and never caches a missing image", async (t) => {
  const root = path.join(process.cwd(), "public", "uploads");
  await mkdir(root, { recursive: true });
  const folder = await mkdtemp(path.join(root, "route-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const parts = [path.basename(folder), "logo.png"];
  const params = { params: Promise.resolve({ path: parts }) };
  const url = "https://cafe.example/uploads/" + parts.join("/");
  const missing = await GET(new Request(url), params);
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get("cache-control"), "no-store");
  await writeFile(path.join(folder, "logo.png"), "first image");
  const first = await GET(new Request(url), params);
  assert.equal(first.status, 200);
  assert.equal(await first.text(), "first image");
  assert.equal(first.headers.get("content-type"), "image/png");
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  assert.ok(first.headers.get("cache-control")?.includes("must-revalidate"));
  const etag = first.headers.get("etag")!;
  const cached = await GET(
    new Request(url, { headers: { "If-None-Match": `W/${etag}` } }),
    params,
  );
  assert.equal(cached.status, 304);
  assert.equal(await cached.text(), "");
  await writeFile(path.join(folder, "logo.png"), "replaced image");
  const changed = await GET(
    new Request(url, { headers: { "If-None-Match": etag } }),
    params,
  );
  assert.equal(changed.status, 200);
  assert.equal(await changed.text(), "replaced image");
  assert.notEqual(changed.headers.get("etag"), etag);
});
