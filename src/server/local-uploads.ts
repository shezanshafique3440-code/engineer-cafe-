import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/** Read runtime uploads without relying on Next's startup public-file index. */
export async function readLocalUpload(
  segments: string[],
  root = path.join(process.cwd(), "public", "uploads"),
) {
  if (
    !segments.length ||
    segments.some(
      (part) => !part || part.startsWith(".") || /[/\\\0]/.test(part),
    )
  )
    return null;

  const mime = IMAGE_TYPES[path.extname(segments.at(-1)!).toLowerCase()];
  if (!mime) return null;

  try {
    const base = await realpath(root);
    const filename = await realpath(path.join(base, ...segments));
    const relative = path.relative(base, filename);
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative) ||
      relative.split(path.sep).some((part) => part.startsWith("."))
    )
      return null;

    const actualMime = IMAGE_TYPES[path.extname(filename).toLowerCase()];
    if (!actualMime || !(await stat(filename)).isFile()) return null;
    const buffer = await readFile(filename);
    return {
      buffer,
      mime: actualMime,
      etag: `"${createHash("sha256").update(buffer).digest("hex")}"`,
    };
  } catch (error) {
    if (
      ["ENOENT", "ENOTDIR", "ELOOP", "EACCES", "ENAMETOOLONG"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
    )
      return null;
    throw error;
  }
}
