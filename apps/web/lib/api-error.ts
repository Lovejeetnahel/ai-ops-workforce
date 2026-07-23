/**
 * Parses the error thrown by lib/api.ts's `request()` helper, which is
 * `Error("<status> <raw response body>")`. The body is usually Nest's JSON
 * error shape (`{ message, error, statusCode }`) — pull the human message
 * out of it when present, since that's the only backend text ever safe to
 * show verbatim (it's the message we deliberately wrote for the user).
 * `status: null` means the request never reached the server (network error).
 */
export function parseApiError(err: unknown): { status: number | null; text: string; correlationId?: string } {
  const msg = String((err as any)?.message ?? '');
  const match = msg.match(/^(\d{3})\s?(.*)$/s);
  if (!match) return { status: null, text: msg };
  const status = Number(match[1]);
  let text = match[2];
  let correlationId: string | undefined;
  try {
    const parsed = JSON.parse(match[2]);
    if (typeof parsed?.message === 'string') text = parsed.message;
    else if (Array.isArray(parsed?.message)) text = parsed.message[0];
    if (typeof parsed?.correlationId === 'string') correlationId = parsed.correlationId;
  } catch {
    // not JSON — keep raw text
  }
  return { status, text, correlationId };
}
