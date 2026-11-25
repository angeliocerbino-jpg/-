'use strict';

const byId = (id) => document.getElementById(id);
const brandFilter = byId('brand');
const typeFilter = byId('type');
const statusFilter = byId('status');
const query = byId('query');
const output = byId('results');
const exportButton = byId('export');
const download = byId('download');
const downloadStatus = byId('download-status');
const huf = new Intl.NumberFormat('en-US');
const percentage = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const rates = { EUR: 368.39, USD: 335.886 };
const unlisted = '未公示';
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Budapest' }).format(new Date());
let downloadUrl;
let visibleOffers = [];

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function externalLink(text, url, className) {
  const link = element('a', className, text);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function offerStatus(offer) {
  if (offer.end && offer.end < today) return '已结束';
  if (offer.start && offer.start > today) return '尚未开始';
  if (offer.archived) return '历史快照';
  if (offer.stale) return '本轮未核对';
  return offer.end ? '在公告有效期内' : '有效期需确认';
}

function savings(offer) {
  return offer.original != null && offer.price != null ? offer.original - offer.price : null;
}

function equivalent(price, currency) {
  return price == null ? null : Math.round(price / rates[currency]);
}

const scan = typeof promotionScan === 'undefined' ? null : promotionScan;
const compactModel = (model) => model.toLowerCase().replace(/^honda |^kawasaki |^zontes |^benelli /, '')
  .replace(/[(（]20\d{2}[)）]/g, '').split(/ és | \/ /)[0].replace(/[^a-z0-9]/g, '');
const canonicalUrl = (url) => url.replace(/\/$/, '');

function mergeOffers() {
  if (!scan) return offers;
  const covered = new Set();
  const current = scan.offers.map((item) => {
    const existing = offers.find((offer) => offer.brand === item.brand && (
      (item.vehicle && compactModel(offer.model) === compactModel(item.model) && offer.type === item.type)
      || (canonicalUrl(offer.url) === canonicalUrl(item.url) && (!item.vehicle || offers.filter((candidate) => candidate.url === offer.url).length === 1))
    ));
    if (!existing) return { ...item, checkedOn: item.checkedOn || scan.checkedOn };
    covered.add(existing);
    const samePrice = item.original === (existing.original ?? null) && item.price === (existing.price ?? null);
    const useExistingText = samePrice && item.vehicle && item.type === '现金优惠';
    return {
      ...existing, ...item, checkedOn: item.checkedOn || scan.checkedOn,
      model: item.model === '—' ? existing.model : item.model,
      image: existing.image,
      imageCaption: item.remoteImage ? (item.vehicle ? '车型图' : '活动页配图') : existing.imageCaption,
      title: useExistingText ? existing.title : item.title,
      summary: useExistingText ? existing.summary : item.summary,
      translated: useExistingText || item.translated,
      start: item.start || existing.start, end: item.end || existing.end,
      timing: item.timing || existing.timing,
      terms: samePrice ? existing.terms : undefined
    };
  });
  const archived = offers.filter((offer) => !covered.has(offer)).map((offer) => ({ ...offer, archived: true }));
  return [...current, ...archived];
}

const allOffers = mergeOffers();

const removedKey = 'hungary-promotions-removed-v1';
let removedOffers = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(removedKey) || '[]');
  if (Array.isArray(saved)) removedOffers = new Set(saved);
} catch {
  // Allow removals for the current session if browser storage is unavailable.
}

function offerId(offer) {
  return JSON.stringify([offer.brand, canonicalUrl(offer.url), offer.model]);
}

function setRemoved(offer, removed) {
  if (removed) removedOffers.add(offerId(offer));
  else removedOffers.delete(offerId(offer));
  try {
    localStorage.setItem(removedKey, JSON.stringify([...removedOffers]));
  } catch {
    // The in-memory selection still applies.
  }
  render();
}

function renderRemoved() {
  const removed = allOffers.filter((offer) => removedOffers.has(offerId(offer)));
  byId('removed-details').hidden = !removed.length;
  byId('removed-count').textContent = '已移除活动（' + removed.length + '）';
  byId('removed-list').replaceChildren(...removed.map((offer) => {
    const item = element('li', 'removed-row');
    const restore = element('button', 'remove-offer', '恢复');
    restore.type = 'button';
    restore.setAttribute('aria-label', '恢复 ' + offer.title);
    restore.addEventListener('click', () => setRemoved(offer, false));
    item.append(element('span', '', offer.title), restore);
    return item;
  }));
}

function offerCard(offer) {
  const brand = brands[offer.brand];
  const state = offerStatus(offer);
  const difference = savings(offer);
  const card = element('article', 'offer-card');
  card.style.setProperty('--accent', brand.color);
  const body = element('div', 'card-body');
  const tags = element('div', 'tags');
  tags.append(element('span', 'tag brand-tag', brand.label), element('span', 'tag', offer.type), element('span', 'tag status', state));
  const remove = element('button', 'remove-offer remove-offer-close', '×');
  remove.title = '移除活动';
  remove.type = 'button';
  remove.setAttribute('aria-label', '移除 ' + offer.title);
  remove.addEventListener('click', () => setRemoved(offer, true));
  body.append(tags, element('h3', '', offer.title), element('p', 'model', offer.model));

  const price = element('div', 'price');
  if (offer.price != null) {
    price.append(element('strong', '', huf.format(offer.price) + ' HUF'));
    if (difference > 0) price.append(element('del', '', huf.format(offer.original) + ' HUF'));
    body.append(price, element('p', 'conversions', '≈ €' + huf.format(equivalent(offer.price, 'EUR')) + ' / $' + huf.format(equivalent(offer.price, 'USD'))));
  }
  if (difference > 0) {
    const converted = '≈ $' + huf.format(equivalent(difference, 'USD')) + ' / €' + huf.format(equivalent(difference, 'EUR'));
    body.append(element('p', 'savings', '优惠 ' + huf.format(difference) + ' HUF · '
      + percentage.format(difference / offer.original) + ' · ' + converted));
  }
  if (offer.translated === false) body.append(element('p', 'terms', '待自动翻译 · 下方为匈牙利语原文'));
  body.append(element('p', 'summary', offer.summary));

  const details = element('dl', 'details');
  details.append(
    element('dt', '', '开始'), element('dd', '', offer.start || unlisted),
    element('dt', '', '结束'), element('dd', '', [offer.end || unlisted, offer.timing].filter(Boolean).join(' · ')),
    element('dt', '', '范围'), element('dd', '', brand.scope),
    element('dt', '', '来源'), element('dd', '', brand.publisher + ' · ' + (brand.dealer ? '经销商' : '品牌官方渠道'))
  );
  body.append(details);
  if (offer.terms) body.append(element('p', 'terms', offer.terms));
  const links = element('div', 'card-links');
  links.append(externalLink('查看匈牙利语原文 ↗', offer.url, 'text-link'));
  if (offer.priceUrl) links.append(externalLink('核对价目表 ↗', offer.priceUrl, 'text-link'));
  if (offer.remoteImage || offer.image) {
    const figure = element('figure', 'offer-image');
    const image = element('img');
    image.src = offer.remoteImage || 'assets/' + offer.image;
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => {
      if (offer.image && image.getAttribute('src') !== 'assets/' + offer.image) image.src = 'assets/' + offer.image;
      else figure.hidden = true;
    });
    const caption = offer.imageCaption || (offer.vehicle ? '车型图' : '活动页配图');
    image.alt = offer.title + ' · ' + caption;
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.append(image, element('figcaption', '', caption));
    card.append(figure);
  }
  card.append(remove, body, links);
  return card;
}

function render() {
  const keyword = query.value.trim().toLowerCase();
  visibleOffers = allOffers.filter((offer) => {
    const state = offerStatus(offer);
    return !removedOffers.has(offerId(offer))
      && (!brandFilter.value || offer.brand === brandFilter.value)
      && (!typeFilter.value || offer.type === typeFilter.value)
      && (statusFilter.value !== 'current' || !['已结束', '历史快照'].includes(state))
      && (statusFilter.value !== 'expired' || state === '已结束')
      && (!keyword || [brands[offer.brand].label, offer.title, offer.model, offer.summary].join(' ').toLowerCase().includes(keyword));
  });
  output.replaceChildren(...(visibleOffers.length ? visibleOffers.map(offerCard) : [element('p', 'empty', '没有符合筛选条件的活动。')]));
  byId('count').textContent = visibleOffers.length + ' 条活动';
  renderRemoved();
  exportButton.disabled = !visibleOffers.length;
  download.hidden = true;
  downloadStatus.textContent = '';
}

function renderBrands() {
  for (const [key, brand] of Object.entries(brands)) {
    brandFilter.add(new Option(brand.label, key));
    const link = externalLink('', brand.entry, 'brand-card');
    link.style.setProperty('--accent', brand.color);
    const image = element('img');
    image.src = 'assets/' + brand.image + '.webp';
    image.alt = '';
    image.loading = 'lazy';
    const text = element('div', 'brand-caption');
    text.append(element('strong', '', brand.label), element('small', '', brand.dealer ? '经销商优惠 ↗' : '品牌促销 ↗'));
    link.append(image, text);
    byId('brand-links').append(link);
  }
  for (const type of new Set(allOffers.map((offer) => offer.type))) typeFilter.add(new Option(type));
}

exportButton.addEventListener('click', async () => {
  if (!visibleOffers.length) return;
  const selection = visibleOffers;
  const headers = ['核对日期', '品牌', '活动名称', '活动类型', '适用车型', '状态', '原价 HUF', '促销价 HUF', '优惠 HUF', '优惠 USD', '优惠 EUR', '优惠幅度', '促销价 USD', '促销价 EUR', '开始日期', '截止日期', '期限补充', '参与范围', '中文摘要', '条件', '来源', '原文链接', '价格依据链接'];
  const records = selection.map((offer) => {
    const brand = brands[offer.brand];
    const difference = savings(offer);
    return [offer.checkedOn || checkedOn, brand.label, offer.title, offer.type, offer.model, offerStatus(offer),
      offer.original, offer.price, difference, equivalent(difference, 'USD'), equivalent(difference, 'EUR'),
      difference == null ? null : percentage.format(difference / offer.original),
      equivalent(offer.price, 'USD'), equivalent(offer.price, 'EUR'), offer.start || unlisted, offer.end || unlisted,
      offer.timing || '', brand.scope, offer.translated === false ? '待翻译：' + offer.summary : offer.summary, offer.terms || '', brand.publisher + (brand.dealer ? '（经销商）' : '（官方渠道）'), offer.url, offer.priceUrl || ''];
  });
  exportButton.disabled = true;
  download.hidden = true;
  downloadStatus.textContent = '正在生成 Excel…';
  try {
    const blob = await window.createCatalogWorkbook(headers, records,
      [15, 18, 33, 15, 36, 20, 16, 16, 16, 16, 16, 14, 16, 16, 15, 15, 22, 46, 80, 66, 28, 75, 58], 21);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(blob);
    download.href = downloadUrl;
    download.download = '匈牙利摩托车促销_' + (scan?.checkedOn || checkedOn) + '.xlsx';
    download.hidden = false;
    downloadStatus.textContent = '已生成 ' + selection.length + ' 条活动。';
    download.click();
  } catch (error) {
    console.error(error);
    downloadStatus.textContent = 'Excel 生成失败，请刷新页面后重试。';
  } finally {
    exportButton.disabled = !visibleOffers.length;
  }
});

for (const filter of [brandFilter, typeFilter, statusFilter, query]) filter.addEventListener('input', render);
byId('checked-date').textContent = '来源核对日期 ' + (scan?.checkedOn || checkedOn)
  + (scan ? ' · 下次计划 ' + scan.nextDate : '') + ' · 导出当前筛选结果';
byId('scan-details').hidden = !scan;
if (scan) {
  for (const source of scan.sources) {
    const result = element('li', '', brands[source.brand].label + ' · 已读取 '
      + source.pages + ' 页 · ' + source.offers + ' 条活动'
      + (source.failed.length ? ' · ' + source.failed.length + ' 页读取失败' : ''));
    for (const url of source.failed) {
      result.append(document.createTextNode(' '), externalLink('失败页面 ↗', url, 'text-link'));
    }
    byId('scan-results').append(result);
  }
}
renderBrands();
render();
