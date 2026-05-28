import { randomUUID } from "crypto";

/**
 * Per-request correlation id.
 *
 * Middleware stamps `x-request-id` on every page response. API routes
 * are excluded from the middleware matcher, so use this helper at the
 * top of any route handler that wants a stable id for log correlation:
 *
 *   const reqId = getRequestId(request);
 *   try { ... } catch (error) { console.error("[my-route]", reqId, error); }
 *
 * Pair with `withRequestId(response, reqId)` if you want the response
 * headers to also carry the id back to the caller.
 */
export function getRequestId(request: Request): string {
  const inbound = request.headers.get("x-request-id");
  if (inbound && inbound.length > 0 && inbound.length <= 80) return inbound;
  return randomUUID();
}

export function withRequestId(response: Response, requestId: string): Response {
  response.headers.set("x-request-id", requestId);
  return response;
}
