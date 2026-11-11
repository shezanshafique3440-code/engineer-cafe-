import "server-only";
import { fork } from "node:child_process";
import path from "node:path";
import type { Readable } from "node:stream";
import { HttpError } from "@/server/api";

type ExportInput = {
  from: string;
  to: string;
  actorName: string;
  module?: string;
  format: "xlsx" | "zip";
};
/** Bound Excel CPU/heap in a child, so a large owner download cannot crash the counter. */
export function runReportExport(input: ExportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const worker = fork(
      path.join(process.cwd(), "scripts/report-export-worker.cjs"),
      [],
      {
        execArgv: ["--max-old-space-size=768"],
        stdio: ["ignore", "ignore", "ignore", "pipe", "ipc"],
      },
    );
    const chunks: Buffer[] = [];
    let size = 0;
    let failure = new HttpError(
      503,
      "The report could not finish within its resource limit. Choose a shorter date range and retry; no data was changed.",
    );
    const timer = setTimeout(() => worker.kill("SIGKILL"), 50_000);
    const data = worker.stdio[3] as Readable;
    data.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 50 * 1024 * 1024) {
        failure = new HttpError(
          422,
          "This report exceeds the download limit. Choose a shorter date range; no partial file was downloaded.",
        );
        worker.kill("SIGKILL");
      } else chunks.push(chunk);
    });
    worker.on("message", (message: unknown) => {
      if (
        message &&
        typeof message === "object" &&
        "error" in message &&
        typeof message.error === "string" &&
        "status" in message &&
        [400, 422].includes(Number(message.status))
      )
        failure = new HttpError(
          Number(message.status),
          message.error.slice(0, 500),
        );
    });
    worker.on("error", () => {
      clearTimeout(timer);
      reject(failure);
    });
    worker.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && size > 0 && size <= 50 * 1024 * 1024)
        resolve(Buffer.concat(chunks));
      else reject(failure);
    });
    worker.send(input);
  });
}
