import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output as ZodOutput } from "zod";
import { Prisma } from "@prisma/client";
import { env } from "@/lib/env";
import { canBusiness } from "@/lib/business-access";
import { getCurrentUser, isStaff } from "./auth";
import type { SessionUser } from "@/lib/types";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const unauthorized = (
  msg = "Your session has expired. Please login again.",
) => new HttpError(401, msg);
export const forbidden = (msg = "You do not have permission to do that.") =>
  new HttpError(403, msg);
export const notFound = (msg = "We couldn't find what you were looking for.") =>
  new HttpError(404, msg);
export const badRequest = (msg: string, fields?: Record<string, string[]>) =>
  new HttpError(400, msg, fields);

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Wraps a route handler so that every failure returns a clean, user-safe
 * message. Database errors and stack traces are logged server-side only.
 */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    const requestId = randomUUID();
    try {
      const request = args[0];
      if (
        request instanceof Request &&
        !["GET", "HEAD", "OPTIONS"].includes(request.method)
      ) {
        const origin = request.headers.get("origin");
        const allowed = new Set([
          new URL(env.siteUrl).origin,
          new URL(request.url).origin,
        ]);
        // Next normalizes loopback URLs to localhost; the actual Host also
        // identifies this browser origin. Browsers cannot forge the Host header.
        const host = request.headers.get("host");
        if (host && /^[a-zA-Z0-9.\[\]:-]+$/.test(host))
          allowed.add(`${new URL(request.url).protocol}//${host}`);
        if (
          (origin && !allowed.has(origin)) ||
          request.headers.get("sec-fetch-site") === "cross-site"
        )
          throw forbidden("This request must originate from the cafe website.");
      }
      const response = await fn(...args);
      response.headers.set("X-Request-ID", requestId);
      return response;
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          {
            error: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
          { status: error.status },
        );
      }
      if (
        error instanceof Error &&
        error.message.includes(
          "Demo preparation is running. Please try again shortly.",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Demo data preparation is running. Please wait, then retry this save.",
          },
          { status: 503, headers: { "Retry-After": "10" } },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            error: "Please check the highlighted fields.",
            fields: error.flatten().fieldErrors,
          },
          { status: 422 },
        );
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return NextResponse.json(
            { error: "That record already exists." },
            { status: 409 },
          );
        }
        if (error.code === "P2025") {
          return NextResponse.json(
            { error: "Record not found." },
            { status: 404 },
          );
        }
        if (error.code === "P2003") {
          return NextResponse.json(
            {
              error:
                "This record is still referenced by other data and cannot be removed.",
            },
            { status: 409 },
          );
        }
      }
      const request = args[0] instanceof Request ? args[0] : null;
      console.error(
        JSON.stringify({
          event: "api_error",
          requestId,
          method: request?.method,
          path: request ? new URL(request.url).pathname : undefined,
          errorType: error instanceof Error ? error.name : "Unknown",
          code:
            error instanceof Prisma.PrismaClientKnownRequestError
              ? error.code
              : undefined,
        }),
      );
      if (!env.isProd) console.error(error);
      return NextResponse.json(
        {
          error: "Something went wrong. Please try again.",
          reference: requestId,
        },
        { status: 500, headers: { "X-Request-ID": requestId } },
      );
    }
  };
}

export async function readBodyBytes(
  request: Request,
  maxBytes = 64 * 1024,
): Promise<Uint8Array> {
  const announced = Number(request.headers.get("content-length"));
  if (Number.isFinite(announced) && announced > maxBytes)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function readJsonBody(request: Request): Promise<unknown> {
  const bytes = await readBodyBytes(request);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw badRequest("Invalid request body.");
  }
}
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ZodOutput<S>> {
  const raw = await readJsonBody(request);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(
      422,
      "Please check the highlighted fields.",
      result.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  return result.data;
}

export function parseQuery<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): ZodOutput<S> {
  const url = new URL(request.url);
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const result = schema.safeParse(raw);
  if (!result.success) throw badRequest("Invalid query parameters.");
  return result.data;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(capability = "admin"): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role) || !canBusiness(user, capability))
    throw forbidden("Your staff role does not allow this action.");
  return user;
}
