const historyKey = 'history-v1';
const dayMs = 86400000;
const intervalDays = 15;
const leaseMs = 5 * 60 * 1000;
const utcDay = (time) => new Date(time).toISOString().slice(0, 10);

export async function readPriceHistory(store) {
  const entry = await store.getWithMetadata(historyKey, { type: 'json' });
  return { snapshots: entry?.data?.snapshots ?? [], nextDate: entry?.data?.nextDate ?? null };
}

export async function captureDuePrices(store, capturePrices, clock = Date.now) {
  const now = clock();
  const today = utcDay(now);
  const entry = await store.getWithMetadata(historyKey, { type: 'json' });
  const state = entry?.data ?? { snapshots: [], nextDate: null };
  if ((state.nextDate && today < state.nextDate) || state.leaseUntil > now) return false;

  const condition = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
  const claim = await store.setJSON(historyKey, { ...state, leaseUntil: now + leaseMs }, condition);
  if (!claim.modified) return false;

  const prices = await capturePrices();
  const snapshot = { checkedAt: new Date(clock()).toISOString(), prices };
  const completed = await store.setJSON(historyKey, {
    snapshots: [...state.snapshots, snapshot],
    nextDate: utcDay(Date.parse(today) + intervalDays * dayMs)
  }, { onlyIfMatch: claim.etag });
  if (!completed.modified) throw new Error('Price history was changed during capture.');
  return true;
}
