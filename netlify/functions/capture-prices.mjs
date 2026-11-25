import { getStore } from '@netlify/blobs';
import { captureDuePrices } from '../lib/price-history.mjs';
import { capturePrices } from '../lib/price-sources.mjs';

export const config = { schedule: '0 8 * * *' };

export default async function handler() {
  const store = getStore({ name: 'cfmoto-hu-price-history', consistency: 'strong' });
  await captureDuePrices(store, capturePrices);
  return new Response(null, { status: 204 });
}
