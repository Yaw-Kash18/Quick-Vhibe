import type { RequestHandler } from "express";

export const CLERK_PROXY_PATH = "/api/__clerk";

export function getClerkProxyHost(req: { headers: any }): string | undefined {
  return req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  return (_req, _res, next) => next();
}
