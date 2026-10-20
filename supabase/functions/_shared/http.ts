// Shared HTTP helpers for Nimble edge functions. Errors use the app's ServiceError shape.
export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type ErrorCode = 'not_found' | 'forbidden' | 'invalid_link' | 'unauthenticated' | 'invalid' | 'unavailable';

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: ErrorCode, message: string) {
    super(message);
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Wraps a handler with CORS preflight and error mapping. */
export function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message } }, e.status);
      console.error(e);
      return json({ error: { code: 'unavailable', message: 'Something went wrong on our side. Try again in a moment.' } }, 500);
    }
  });
}
