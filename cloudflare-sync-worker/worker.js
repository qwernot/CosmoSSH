/**
 * CosmoSSH Cloudflare Worker Sync Service
 * 
 * Provides zero-knowledge encrypted backup & sync for CosmoSSH.
 * All payloads are client-side encrypted with AES-256-GCM using your Master Password.
 * The server only stores the ciphertext blob.
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    const url = new URL(request.url);

    // Health Check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'CosmoSSH Cloudflare Sync Worker', time: Date.now() }),
        { headers: corsHeaders }
      );
    }

    // Token Authentication Check
    const authHeader = request.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    if (!match) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Bearer token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = match[1].trim();
    // Hash token to use as safe KV key
    const encoder = new TextEncoder();
    const tokenHashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const tokenKey = Array.from(new Uint8Array(tokenHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const KV = env.COSMOSSH_KV;
    if (!KV) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: COSMOSSH_KV namespace not bound' }),
        { status: 500, headers: corsHeaders }
      );
    }

    if (url.pathname === '/api/sync') {
      if (request.method === 'GET') {
        const stored = await KV.get(tokenKey, 'json');
        if (!stored) {
          return new Response(
            JSON.stringify({ exists: false, data: null, updatedAt: 0 }),
            { headers: corsHeaders }
          );
        }
        return new Response(
          JSON.stringify({ exists: true, data: stored.data, updatedAt: stored.updatedAt || 0 }),
          { headers: corsHeaders }
        );
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        if (!body || !body.data) {
          return new Response(
            JSON.stringify({ error: 'Bad Request: "data" field required' }),
            { status: 400, headers: corsHeaders }
          );
        }

        const payload = {
          data: body.data, // E2EE Ciphertext string
          updatedAt: body.updatedAt || Date.now(),
        };

        await KV.put(tokenKey, JSON.stringify(payload));
        return new Response(
          JSON.stringify({ success: true, updatedAt: payload.updatedAt }),
          { headers: corsHeaders }
        );
      }

      if (request.method === 'DELETE') {
        await KV.delete(tokenKey);
        return new Response(
          JSON.stringify({ success: true, message: 'Sync data cleared' }),
          { headers: corsHeaders }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: corsHeaders }
    );
  },
};
