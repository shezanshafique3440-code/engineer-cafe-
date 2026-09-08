import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output as ZodOutput } from "zod";
import { Prisma } from "@prisma/client";
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

export const unauthorized = (msg = "Your session has expired. Please login again.") =>
  new HttpError(401, msg);
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
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json(
          { error: error.message, ...(error.fields ? { fields: error.fields } : {}) },
          { status: error.status },
        );
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Please check the highlighted fields.", fields: error.flatten().fieldErrors },
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
          return NextResponse.json({ error: "Record not found." }, { status: 404 });
        }
        if (error.code === "P2003") {
          return NextResponse.json(
            { error: "This record is still referenced by other data and cannot be removed." },
            { status: 409 },
          );
        }
      }
      console.error("[api]", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ZodOutput<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw badRequest("Invalid request body.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new HttpError(422, "Please check the highlighted fields.", result.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

export function parseQuery<S extends ZodTypeAny>(request: Request, schema: S): ZodOutput<S> {
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

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isStaff(user.role)) throw forbidden("Admin access required.");
  return user;
}
