import { getStore } from '@netlify/blobs';
import { readPriceHistory } from '../lib/price-history.mjs';
import { sources } from '../lib/price-sources.mjs';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  }
  const store = getStore({ name: 'cfmoto-hu-price-history', consistency: 'strong' });
  const history = await readPriceHistory(store);
  return Response.json({ ...history, trackedIds: Object.keys(sources) }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
