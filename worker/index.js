/**
 * Cloudflare Worker - Todoist CORS Proxy
 * Deploy to Cloudflare Workers (free tier: 100k requests/day)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Get the path after the worker URL
    const url = new URL(request.url);
    const todoistPath = url.pathname + url.search;

    // Forward to Todoist API
    const todoistUrl = 'https://api.todoist.com/rest/v2' + todoistPath;

    // Forward headers (including Authorization)
    const headers = new Headers();
    headers.set('Authorization', request.headers.get('Authorization') || '');

    try {
      const response = await fetch(todoistUrl, {
        method: request.method,
        headers: headers,
      });

      // Return response with CORS headers
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
  },
};
