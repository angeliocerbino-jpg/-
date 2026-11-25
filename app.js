'use strict';

const categories = {
  ADV: 'ADV 探险', NK: 'NK 街车', Sport: 'SR 仿赛',
  CLC: 'CLC 巡航', SC: 'SC 踏板'
};
const rows = window.HU_CATALOG || [];
const state = { category: 'ADV', band: '251-500cc', query: '', priced: false, sort: 'model', period: 'latest' };
const currency = new Intl.NumberFormat('en-US');
const fx = { USD: 335.886, EUR: 368.39, date: '2026-11-18' };
const removedKey = 'cfmoto-hu-removed-models-v1';
const byId = (id) => document.getElementById(id);
const groupArea = byId('groups');
const resultStatus = byId('results');
const checkedPrices = new Map();
const periods = new Map();
const toolsMenu = byId('tools-menu');
const toolsButton = byId('tools-button');
const periodSelect = byId('price-period');
const historyDialog = byId('history-dialog');
const trackedIds = new Set();
const latestFailedIds = new Set();
let priceSnapshots = [];
let historyState = location.protocol === 'file:' ? 'offline' : 'loading';
let historyModel;
const budapestDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Europe/Budapest', dateStyle: 'medium'
});
const snapshotDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit'
});
const removedIds = new Set();
const removedDialog = byId('removed-dialog');
const actionStatus = byId('action-status');

try {
  const saved = JSON.parse(localStorage.getItem(removedKey) || '[]');
  if (Array.isArray(saved)) {
    const savedIds = new Set(saved);
    rows.forEach((row) => { if (savedIds.has(row.id)) removedIds.add(row.id); });
  }
} catch {
  // The current session works even when storage is blocked.
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function displayBand(band) {
  if (band === 'all') return '全部排量';
  const [low, high] = band.slice(0, -2).split('-');
  if (low === '0') return '≤' + high + ' cc';
  return high === '9999' ? low + ' cc 及以上' : low + '–' + high + ' cc';
}

function bandOrder(left, right) { return parseInt(left, 10) - parseInt(right, 10); }

function button(group, value, label, current, action) {
  const node = el('button', 'filter-button', label);
  node.type = 'button';
  node.setAttribute('aria-pressed', String(value === current));
  node.dataset.value = value;
  node.onclick = () => {
    action(value);
    group.querySelectorAll('button').forEach((item) => {
      const active = item === node;
      item.setAttribute('aria-pressed', String(active));
    });
    render();
  };
  group.append(node);
}

function renderCategories() {
  const group = byId('categories');
  group.replaceChildren();
  Object.entries(categories).forEach(([value, label]) =>
    button(group, value, label, state.category, (next) => {
      state.category = next;
      state.band = 'all';
      state.query = '';
      byId('query').value = '';
      renderBands();
    })
  );
}

function renderBands() {
  const group = byId('bands');
  group.replaceChildren();
  const bands = [...new Set(rows.filter((row) => row.cat === state.category).map((row) => row.band))].sort(bandOrder);
  for (const value of ['all', ...bands]) {
    button(group, value, displayBand(value), state.band, (next) => {
      state.band = next;
      state.query = '';
      byId('query').value = '';
    });
  }
}

function selectedPeriod() { return periods.get(state.period); }

function captureFor(row) {
  if (state.period === 'baseline') return undefined;
  return (selectedPeriod()?.quotes ?? checkedPrices).get(row.id);
}

function prices(row) {
  return captureFor(row)?.price ?? (selectedPeriod() ? null : row.price);
}

function periodLabel() {
  return selectedPeriod()?.label ?? (state.period === 'baseline' ? '月报基准报价' : '最新可用报价');
}

function exchange(price, code) {
  return price == null ? null : Math.round(price / fx[code]);
}

function setRemoved(row, removed) {
  if (removed) removedIds.add(row.id);
  else removedIds.delete(row.id);
  saveRemoved();
  render();
  actionStatus.textContent = row.brand + ' ' + row.model + (removed ? ' 已移除' : ' 已恢复');
}

function saveRemoved() {
  try { localStorage.setItem(removedKey, JSON.stringify([...removedIds])); } catch { /* Session only. */ }
}

function renderRemoved() {
  const list = byId('removed-list');
  const removed = rows.filter((row) => removedIds.has(row.id));
  byId('removed-button').textContent = '已移除（' + removed.length + '）';
  byId('restore-all').hidden = !removed.length;
  list.replaceChildren();
  if (!removed.length) list.append(el('li', 'muted', '暂无已移除车型。'));
  for (const row of removed) {
    const item = el('li', 'removed-row');
    const label = el('div');
    label.append(el('strong', '', row.brand + ' ' + row.model), el('small', '', categories[row.cat] + ' · ' + displayBand(row.band)));
    const restore = el('button', 'action-button', '恢复');
    restore.type = 'button';
    restore.setAttribute('aria-label', '恢复 ' + row.brand + ' ' + row.model);
    restore.onclick = () => {
      const index = [...list.querySelectorAll('button')].indexOf(restore);
      setRemoved(row, false);
      (list.querySelectorAll('button')[index] || list.querySelector('button') || removedDialog.querySelector('form button')).focus();
    };
    item.append(label, restore);
    list.append(item);
  }
}

function segmentKey(row) { return row.cat + '|' + row.band; }

function sortRows(left, right) {
  if (left.focus !== right.focus) return Number(right.focus) - Number(left.focus);
  const byName = left.model.localeCompare(right.model);
  if (state.sort === 'model') return byName;
  const a = prices(left);
  const b = prices(right);
  if (a == null || b == null) return Number(a == null) - Number(b == null) || byName;
  return (state.sort === 'asc' ? a - b : b - a) || byName;
}

const comparison = {
  cfmoto: byId('compare-cfmoto'), rival: byId('compare-rival'),
  originalDate: byId('compare-original-date'), currentDate: byId('compare-current-date'),
  dates: byId('compare-dates'), currency: byId('compare-currency'),
  originalCfmoto: byId('compare-original-cfmoto'), originalRival: byId('compare-original-rival'),
  currentRival: byId('compare-current-rival'), target: byId('compare-target'),
  summary: byId('compare-summary'), currentGap: byId('compare-current-gap')
};
const compareMoney = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 });
const comparePercent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 2 });

function showComparisonConversions(id, amount) {
  const label = byId('compare-' + id + '-converted');
  const unit = comparison.currency.value;
  const huf = amount * (fx[unit] ?? 1);
  label.hidden = !Number.isFinite(huf) || huf <= 0;
  label.textContent = label.hidden ? '' : ['HUF', 'USD', 'EUR']
    .filter((currency) => currency !== unit)
    .map((currency) => '≈ ' + compareMoney.format(huf / (fx[currency] ?? 1)) + ' ' + currency)
    .join(' · ');
}

function updateComparison() {
  const originalCfmoto = comparison.originalCfmoto.valueAsNumber;
  const originalRival = comparison.originalRival.valueAsNumber;
  const unit = comparison.currency.value;
  const quote = comparisonQuote(comparison.rival.value, comparison.currentDate.value);
  const currentRival = quote == null ? null : quote / (fx[unit] ?? 1);
  const gapText = (amount) => compareMoney.format(amount) + ' ' + unit;
  comparison.currentRival.textContent = currentRival > 0 ? gapText(currentRival) : '—';
  showComparisonConversions('original-cfmoto', originalCfmoto);
  showComparisonConversions('original-rival', originalRival);
  showComparisonConversions('current-rival', currentRival);
  showComparisonConversions('target', null);
  comparison.target.textContent = '—';
  comparison.currentGap.textContent = comparison.rival.value && !(currentRival > 0) ? '该竞品暂无可选报价。' : '';
  if (!comparison.originalDate.value || !(originalCfmoto > 0 && originalRival > 0)) {
    comparison.summary.textContent = comparison.originalDate.value
      ? '请补齐基准日期的两个价格。'
      : '请选择基准日期。';
    return;
  }

  const gap = originalRival - originalCfmoto;
  const ratio = originalCfmoto / originalRival;
  const direction = Math.sign(gap);
  comparison.summary.textContent = direction === 0 ? '春风与竞品同价' :
    '春风比竞品' + (direction > 0 ? '低 ' : '高 ') +
    comparePercent.format(Math.abs(gap / originalRival)) + '，差价 ' + gapText(Math.abs(gap));

  if (!(currentRival > 0)) return;
  const target = currentRival * ratio;
  comparison.target.textContent = gapText(target);
  showComparisonConversions('target', target);
  comparison.currentGap.textContent = '差价 ' + gapText(Math.abs(currentRival - target));
}

function comparisonInputPrice(price) {
  if (price == null) return '';
  const unit = comparison.currency.value;
  return unit === 'HUF' ? price : (price / fx[unit]).toFixed(2);
}

const comparisonFields = [
  {input: comparison.originalCfmoto, model: comparison.cfmoto, date: comparison.originalDate},
  {input: comparison.originalRival, model: comparison.rival, date: comparison.originalDate}
];
const editedComparisonPrices = new Map();
const catalogDates = [...new Set(rows.map((row) => row.date).filter(Boolean))].sort();
comparison.originalDate.value = catalogDates[0] ?? '';

function renderComparisonDates() {
  const dates = [...new Set([...catalogDates, ...periods.keys()])].sort().reverse();
  comparison.dates.replaceChildren(...dates.map((date) => new Option(date, date)));
}

function comparisonQuote(id, date) {
  const row = rows.find((candidate) => candidate.id === id);
  return periods.get(date)?.quotes.get(id)?.price ?? (row?.date === date ? row.price : null);
}

function renderTargetDates() {
  const id = comparison.rival.value;
  const previous = comparison.currentDate.value;
  const dates = [...new Set([...catalogDates, ...periods.keys()])]
    .filter((date) => comparisonQuote(id, date) > 0).sort().reverse();
  comparison.currentDate.replaceChildren(...(dates.length
    ? dates.map((date) => new Option(date, date))
    : [new Option(id ? '暂无可选报价日期' : '请先选竞品车型', '')]));
  comparison.currentDate.disabled = !dates.length;
  comparison.currentDate.value = dates.includes(previous) ? previous : (dates[0] ?? '');
}

function comparisonKey({input, model, date}) {
  return JSON.stringify([input.id, model.value, date.value, comparison.currency.value]);
}

function fillComparisonPrices() {
  renderTargetDates();
  for (const field of comparisonFields) {
    const {input, model, date} = field;
    const quoted = comparisonQuote(model.value, date.value);
    input.value = editedComparisonPrices.get(comparisonKey(field)) ?? comparisonInputPrice(quoted);
  }
  updateComparison();
}

function renderComparisonModels() {
  let selectionChanged = false;
  for (const [select, isCfmoto] of [[comparison.cfmoto, true], [comparison.rival, false]]) {
    const previous = select.value;
    const models = rows.filter((row) => (row.brand === 'CFMOTO') === isCfmoto && !removedIds.has(row.id));
    select.replaceChildren(new Option(isCfmoto ? '选春风车型' : '选竞品车型', ''),
      ...models.map((row) => new Option(row.brand + ' ' + row.model, row.id)));
    select.value = models.some((row) => row.id === previous) ? previous : '';
    selectionChanged ||= select.value !== previous;
  }
  if (selectionChanged) fillComparisonPrices();
}

for (const control of [comparison.rival, comparison.cfmoto, comparison.currency, comparison.originalDate]) {
  control.onchange = fillComparisonPrices;
}
for (const field of comparisonFields) {
  field.input.oninput = () => {
    editedComparisonPrices.set(comparisonKey(field), field.input.value);
    updateComparison();
  };
}
comparison.currentDate.onchange = updateComparison;
renderComparisonDates();
fillComparisonPrices();

function makeCard(row) {
  const card = el('article', row.focus ? 'card focus' : 'card');
  const media = el('div', 'card-media');
  const remove = el('button', 'remove-model', '×');
  remove.type = 'button';
  remove.title = '移除此车型';
  remove.setAttribute('aria-label', '移除 ' + row.brand + ' ' + row.model);
  remove.onclick = () => {
    const index = [...groupArea.querySelectorAll('.remove-model')].indexOf(remove);
    setRemoved(row, true);
    (groupArea.querySelectorAll('.remove-model')[index] || toolsButton).focus({ preventScroll: true });
  };
  media.append(remove);
  const blank = el('span', 'placeholder', '暂无车型图片');
  if (row.focus) media.append(el('span', 'badge', '春风'));
  if (row.image) {
    const img = el('img');
    img.src = row.image;
    img.alt = row.imageReference ? row.imageReference + '（参考图）' : row.brand + ' ' + row.model;
    img.loading = 'lazy';
    img.onerror = () => { img.remove(); media.append(blank); };
    media.append(img);
    if (row.imageReference) {
      const caption = el('a', 'photo-reference', '参考图 · ' + row.imageReference);
      caption.href = row.imagePage || row.imageSource;
      caption.target = '_blank';
      caption.rel = 'noopener noreferrer';
      caption.title = '登记版本待核对。打开照片来源。';
      media.append(caption);
    }
  } else media.append(blank);
  const body = el('div', 'card-body');
  const title = el('h4', '', row.model);
  title.title = '月报登记名 ' + row.registered;
  body.append(el('p', 'brand', row.brand), title);
  const stats = el('div', 'card-data');
  const price = prices(row);
  const emptyLabel = selectedPeriod() ? '当期无报价' : '报价待补';
  const amount = el('span', price == null ? 'card-price empty' : 'card-price', price == null ? emptyLabel : currency.format(price));
  const check = captureFor(row);
  if (price != null) {
    amount.append(el('small', '', 'HUF'));
    amount.title = check ? '定期采集 ' + check.date : (row.priceNote || '月报报价') + ' · ' + row.date;
  }
  stats.append(amount);
  if (price != null) {
    const equivalents = el('div', 'equivalents');
    equivalents.title = '按月报换算口径估算（' + fx.date + '）';
    equivalents.append(
      el('span', '', '≈ ' + currency.format(exchange(price, 'USD')) + ' USD'),
      el('span', '', '≈ ' + currency.format(exchange(price, 'EUR')) + ' EUR')
    );
    stats.append(equivalents);
  }
  if (!check && price != null && row.priceNote) {
    const source = el('a', 'checked', row.priceNote);
    source.href = row.priceSource;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    stats.append(source);
  }
  if (check) stats.append(el('span', 'checked', '采集日期 ' + check.date));
  if (state.period === 'latest' && latestFailedIds.has(row.id)) {
    stats.append(el('span', 'checked', '本轮未获取报价 · 显示上次有效价'));
  }
  const links = el('div', 'card-links');
  if (row.url) {
    const out = el('a', '', row.linkLabel || '打开车型页');
    out.href = row.url;
    out.target = '_blank';
    out.rel = 'noopener noreferrer';
    out.title = new URL(row.url).hostname;
    out.setAttribute('aria-label', (row.linkLabel || '打开 ' + row.brand + ' ' + row.model + ' 车型页') + '，新标签页');
    links.append(out);
  } else {
    links.append(el('span', 'no-source', '暂无对应车型页'));
  }
  const historyButton = el('button', 'history-button', '价格历史');
  historyButton.type = 'button';
  historyButton.setAttribute('aria-label', row.brand + ' ' + row.model + ' 的价格历史');
  historyButton.onclick = () => {
    historyModel = row;
    showPriceHistory(row);
    historyDialog.showModal();
  };
  links.append(historyButton, el('span', 'cc', row.cc ? row.cc + ' cc' : ''));
  body.append(stats);
  body.append(links);
  card.append(media, body);
  return card;
}

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s\-_/]+/g, '');
}

function matchingRows() {
  const query = normalize(state.query);
  return rows.filter((row) => {
    if (removedIds.has(row.id)) return false;
    const match = query
      ? normalize(row.brand + ' ' + row.model + ' ' + row.registered).includes(query)
      : row.cat === state.category && (state.band === 'all' || state.band === row.band);
    return match && (!state.priced || prices(row) != null);
  });
}

function groupedRows(filtered) {
  const groups = new Map();
  for (const row of filtered) {
    const key = segmentKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map((models) => ({ models: models.sort(sortRows) })).sort((left, right) =>
    Number(right.models[0].focus) - Number(left.models[0].focus) || bandOrder(left.models[0].band, right.models[0].band)
  );
}

function render() {
  const filtered = matchingRows();
  const sections = [];
  for (const { models } of groupedRows(filtered)) {
    const { cat, band } = models[0];
    const section = el('section', 'segment');
    const heading = el('div', 'segment-head');
    heading.append(el('h3', '', (state.query ? categories[cat] + ' · ' : '') + displayBand(band)), el('span', '', models.length + ' 条记录'));
    const cards = el('div', 'cards');
    models.forEach((row) => cards.append(makeCard(row)));
    section.append(heading, cards);
    sections.push(section);
  }
  groupArea.replaceChildren(...(sections.length ? sections : [el('p', 'nothing', '没有找到符合条件的车型。')]));
  byId('active-period').textContent = '报价 · ' + periodLabel();
  resultStatus.textContent = '显示 ' + filtered.length + ' 条记录';
  byId('export-filtered').disabled = !filtered.length;
  byId('export-all').disabled = removedIds.size === rows.length;
  renderRemoved();
  renderComparisonModels();
}

let excelDownloadUrl;
let exportingExcel = false;

async function exportCatalog(all) {
  if (exportingExcel) return;
  const data = all ? rows.filter((row) => !removedIds.has(row.id)) : matchingRows();
  if (!data.length) return;
  const categoryOrder = Object.keys(categories);
  data.sort((left, right) =>
    categoryOrder.indexOf(left.cat) - categoryOrder.indexOf(right.cat)
    || bandOrder(left.band, right.band)
    || left.brand.localeCompare(right.brand)
    || left.model.localeCompare(right.model)
  );
  closeTools();
  const panel = byId('excel-download-panel');
  const message = byId('excel-export-message');
  const download = byId('excel-download');
  exportingExcel = true;
  panel.hidden = false;
  download.hidden = true;
  message.textContent = '正在生成 Excel…';
  if (excelDownloadUrl) {
    URL.revokeObjectURL(excelDownloadUrl);
    excelDownloadUrl = undefined;
  }
  try {
    const headers = ['报价日期', '品类', '排量段', '品牌', '型号', '价格（HUF）', '价格（USD）', '价格（EUR）'];
    const records = data.map((row) => {
      const price = prices(row);
      return [
        price == null ? null : (captureFor(row)?.isoDate ?? row.date),
        categories[row.cat], displayBand(row.band), row.brand, row.model,
        price, exchange(price, 'USD'), exchange(price, 'EUR')
      ];
    });
    const exportPeriod = selectedPeriod()?.date ?? periodLabel();
    const file = await window.createCatalogWorkbook(headers, records, [16, 18, 20, 18, 25, 18, 18, 18]);
    excelDownloadUrl = URL.createObjectURL(file);
    download.href = excelDownloadUrl;
    download.download = '匈牙利竞品价格_' + (all ? '全部车型' : '当前筛选') + '_' + exportPeriod + '.xlsx';
    download.hidden = false;
    message.textContent = 'Excel 已生成，共 ' + data.length + ' 款车型。若未自动下载，请点击手动下载。';
    download.click();
  } catch (error) {
    console.error('Excel 导出失败', error);
    message.textContent = 'Excel 生成失败，请刷新网站后重试。';
  } finally {
    exportingExcel = false;
  }
}

function closeTools() {
  toolsMenu.open = false;
  toolsButton.focus({ preventScroll: true });
}

byId('removed-button').onclick = () => {
  closeTools();
  removedDialog.showModal();
};
periodSelect.onchange = () => {
  state.period = periodSelect.value;
  closeTools();
  render();
  byId('catalog').scrollIntoView({ block: 'start' });
};
toolsMenu.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', closeTools);
});
toolsMenu.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && toolsMenu.open) closeTools();
});
byId('restore-all').onclick = () => {
  removedIds.clear();
  saveRemoved();
  render();
  removedDialog.querySelector('form button').focus();
  actionStatus.textContent = '已恢复全部车型';
};
byId('export-filtered').onclick = () => exportCatalog(false);
byId('export-all').onclick = () => exportCatalog(true);
document.addEventListener('click', (event) => {
  if (toolsMenu.open && !toolsMenu.contains(event.target)) toolsMenu.open = false;
});

byId('query').oninput = (event) => { state.query = event.target.value.trim(); render(); };
byId('priced').onchange = (event) => { state.priced = event.target.checked; render(); };
byId('sort').onchange = (event) => { state.sort = event.target.value; render(); };
renderCategories();
renderBands();
render();

function formatCaptureDate(date) {
  return budapestDate.format(new Date(date));
}

function showPriceHistory(row) {
  byId('history-title').textContent = row.brand + ' ' + row.model + ' · 价格历史';
  const entries = priceSnapshots.flatMap(({checkedAt, prices}) => {
    const item = prices.find((price) => price.id === row.id);
    return item ? [{ date: formatCaptureDate(checkedAt), price: item.price, source: '定期采集' }] : [];
  });
  if (row.price > 0) entries.push({ date: row.date || '日期未记录', price: row.price, source: row.priceNote || '月报基准' });

  const note = byId('history-note');
  if (historyState === 'loading') note.textContent = '正在读取已保存的价格记录…';
  else if (historyState === 'offline') note.textContent = '当前为本地预览，部署后可读取定期采集记录。';
  else if (historyState === 'unavailable') note.textContent = '暂时无法读取定期采集历史。';
  else if (!trackedIds.has(row.id)) note.textContent = '此车型暂未纳入自动采集。';
  else note.textContent = '报价每 15 天采集一次，可按日期查看。';

  byId('history-empty').hidden = entries.length > 0;
  byId('history-table').hidden = entries.length === 0;
  byId('history-fx-note').textContent = 'EUR、USD 均按图鉴参考汇率（' + fx.date + '）折算。';
  const body = byId('history-entries');
  body.replaceChildren();
  for (const entry of entries) {
    const tr = el('tr');
    const hasPrice = entry.price != null;
    tr.append(
      el('td', '', entry.date),
      el('td', 'history-price', hasPrice ? currency.format(entry.price) : '未获取'),
      el('td', 'history-price', hasPrice ? currency.format(exchange(entry.price, 'EUR')) : '—'),
      el('td', 'history-price', hasPrice ? currency.format(exchange(entry.price, 'USD')) : '—'),
      el('td', '', entry.source)
    );
    body.append(tr);
  }
}

async function loadPriceHistory() {
  try {
    const response = await fetch('./.netlify/functions/price-history', {signal: AbortSignal.timeout(8500)});
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('History unavailable');
    const {snapshots, nextDate, trackedIds: tracked} = await response.json();
    if (!Array.isArray(snapshots) || !Array.isArray(tracked)) throw new Error('Invalid history');
    historyState = 'ready';
    tracked.forEach((id) => trackedIds.add(id));
    priceSnapshots = snapshots.filter(({checkedAt, prices}) =>
      Number.isFinite(Date.parse(checkedAt)) && Array.isArray(prices)
    ).sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt));
    for (const snapshot of priceSnapshots) {
      const date = snapshotDate.format(new Date(snapshot.checkedAt));
      const label = formatCaptureDate(snapshot.checkedAt);
      const quotes = new Map();
      for (const item of snapshot.prices) {
        if (!Number.isSafeInteger(item.price) || item.price <= 0) continue;
        const quote = { price: item.price, date: label, isoDate: date };
        quotes.set(item.id, quote);
        if (!checkedPrices.has(item.id)) checkedPrices.set(item.id, quote);
      }
      if (!periods.has(date)) {
        periods.set(date, { date, label, quotes });
        periodSelect.add(new Option(label, date));
      }
    }
    latestFailedIds.clear();
    const latest = priceSnapshots[0];
    if (latest) {
      const attempted = latest.prices.filter((item) => trackedIds.has(item.id));
      for (const item of attempted) {
        if (!Number.isSafeInteger(item.price) || item.price <= 0) latestFailedIds.add(item.id);
      }
      const succeeded = new Set(attempted.map((item) => item.id)).size - latestFailedIds.size;
      const missing = trackedIds.size - new Set(attempted.map((item) => item.id)).size;
      byId('price-status').textContent = '上次采集 ' + formatCaptureDate(latest.checkedAt)
        + ' · 成功 ' + succeeded + '/' + trackedIds.size + ' 款'
        + (latestFailedIds.size ? ' · 未获取 ' + latestFailedIds.size + ' 款' : '')
        + (missing ? ' · 未检查 ' + missing + ' 款' : '')
        + (nextDate ? ' · 下次计划 ' + nextDate : '');
    } else {
      byId('price-status').textContent = '首次采集尚未完成。当前显示基准报价。';
    }
    renderComparisonDates();
    fillComparisonPrices();
    render();
  } catch {
    historyState = 'unavailable';
    byId('price-status').textContent = '暂时无法读取定期采集记录。当前显示月报基准报价。';
  }
  updatePeriodHelp();
  if (historyDialog.open && historyModel) showPriceHistory(historyModel);
}

function updatePeriodHelp() {
  byId('period-help').textContent = {
    loading: '正在读取采集日期…',
    offline: '部署后可切换已采集日期。',
    unavailable: '暂时无法读取采集日期。',
    ready: periods.size ? '切换日期更新整页报价。缺失的报价显示为当期无报价。' : '首次采集后，这里会显示可选日期。'
  }[historyState];
}

updatePeriodHelp();
if (historyState === 'loading') loadPriceHistory();
