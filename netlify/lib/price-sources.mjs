export const sources = {
  m003: ['honda', 'https://www.honda.hu/motorcycles/range/scooter/pcx-125/specifications.html'],
  m019: ['honda', 'https://www.honda.hu/motorcycles/range/scooter/adv350/specification-and-price.html'],
  m020: ['zontes', 'https://www.zontes.hu/368k.php'],
  m042: ['cfmoto', 'https://cfmoto.hu/hu/termek/cfmoto-450mt-26'],
  m043: ['honda', 'https://www.honda.hu/motorcycles/range/adventure/nx500/specifications-and-price.html'],
  m053: ['benelli', 'https://benelli.hu/termek/trk-702'],
  m054: ['cfmoto', 'https://cfmoto.hu/hu/termek/cfmoto-700mt-abs-26'],
  m064: ['suzuki', 'https://motor.suzuki.hu/model/v-strom-800-m6'],
  m065: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-800mt-sport/'],
  m066: ['honda', 'https://www.honda.hu/motorcycles/range/adventure/xl750_transalp/specifications-and-price.html'],
  m067: ['voge', 'https://www.voge.hu/800dsx_rally.php'],
  m069: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-800mt-x/'],
  m074: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-1000mt-x/'],
  m096: ['honda', 'https://www.honda.hu/motorcycles/range/street/cb500-hornet/specifications-and-price.html'],
  m097: ['kawasaki', 'https://www.kawasaki.hu/hu_hu/Motorcycles/Supernaked/Z500_2027.html'],
  m098: ['kawasaki', 'https://www.kawasaki.hu/hu_hu/Motorcycles/A2_Bikes/Ninja_500_2027.html'],
  m099: ['cfmoto', 'https://cfmoto.hu/hu/termek/cfmoto-450nk-abs-26'],
  m103: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-300nk-abs/'],
  m107: ['redbaron', 'https://www.redbaron.hu/elado-motorok/z650/8821'],
  m108: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-675nk-abs/'],
  m109: ['honda', 'https://www.honda.hu/motorcycles/range/street/cb650r/specifications-and-price.html'],
  m117: ['kawasaki', 'https://www.kawasaki.hu/hu_hu/Motorcycles/Supernaked/Z900_2026.html'],
  m118: ['suzuki', 'https://motor.suzuki.hu/motorok/gsx-8s-m6'],
  m119: ['honda', 'https://www.honda.hu/motorcycles/range/street/hornet/specifications-and-price.html'],
  m127: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-800nk/'],
  m143: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-450sr-abs/'],
  m144: ['cfmoto', 'https://cfmoto.hu/hu/termek/cfmoto-300sr-abs-26'],
  m145: ['honda', 'https://www.honda.hu/motorcycles/range/super-sport/cbr500r/specifications-and-price.html'],
  m154: ['honda', 'https://www.honda.hu/motorcycles/range/super-sport/cbr650r/specifications-and-price.html'],
  m155: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-675sr-r-abs/'],
  m156: ['kawasaki', 'https://www.kawasaki.hu/hu_hu/Motorcycles/Supersport_Sport/Ninja_650_2026.html'],
  m189: ['honda', 'https://www.honda.hu/motorcycles/range/street/gb350s/specifications-and-price.html'],
  m190: ['kawasaki', 'https://www.kawasaki.hu/hu_hu/Motorcycles/Urban_Cruiser/eliminator_500_2026.html'],
  m191: ['woo', 'https://cfmotomagyarorszag.hu/termekeink/cfmoto-450cl-c/'],
  m192: ['honda', 'https://www.honda.hu/motorcycles/range/street/cl500/specifications-and-price.html']
};

export function extractPrice(provider, html) {
  const clean = html.replace(/&(?:nbsp|#160|#xA0);/gi, ' ');
  const hufAmount = /([1-9]\d{0,2}(?:[.\s]\d{3}){1,2})\s*Ft/i;
  const validPrice = (value) => {
    const price = Number(value?.replace(/\D/g, ''));
    return Number.isSafeInteger(price) && price >= 100000 && price <= 30000000 ? price : null;
  };
  if (provider === 'honda') {
    const variants = [...clean.matchAll(/\bdata-price="([^"]+)"/gi)];
    const prices = variants.map((variant) => validPrice(variant[1].match(hufAmount)?.[1])).filter(Boolean);
    return prices.length ? Math.min(...prices) : null;
  }

  let match;
  if (provider === 'kawasaki') {
    const base = clean.match(/class="productsummary__baseprice-value"[^>]*>\s*<span[^>]*>([^<]+)/i)?.[1];
    match = (base ?? '').match(/HUF[\s\u200e\u200f]*([1-9]\d{0,2}(?:[.\s]\d{3}){1,3}),00/i);
  } else if (provider === 'cfmoto') {
    const variant = clean.match(/class="active"\s*>\s*<div class="variant-price">([\s\S]{0,1800})/i)?.[1];
    match = variant?.match(/class="price"\s*>\s*<span class="value"\s*>\s*([1-9][\d.\s]+)\s*Ft/i);
  } else if (provider === 'woo') {
    const section = clean.match(/<p class="price"[^>]*>([\s\S]{0,2600}?)<\/p>/i)?.[1];
    const current = section?.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] ?? section;
    match = current?.match(/<bdi[^>]*>\s*([1-9][\d\s.]+)\s*<span class="woocommerce-Price-currencySymbol"[^>]*>(?:Ft|&#0*70;&#0*116;)<\/span>/i);
  }
  const priceAreas = {
    zontes: /<h2\b[^>]*\bitemprop="price"[^>]*>([^<]+)</i,
    benelli: /<p class="product-price"[^>]*>\s*<strong[^>]*>([^<]+)</i,
    voge: /<div class="price"[^>]*>([^<]+)</i,
    suzuki: /<span\b[^>]*class="[^"]*SuzukiHeadline[^"]*text-\[70px\][^"]*"[^>]*>([^<]+)</i,
    redbaron: /<span>\s*Ár\s*<\/span>\s*<span>([^<]+)</i
  };
  if (priceAreas[provider]) {
    match = clean.match(priceAreas[provider])?.[1].match(hufAmount);
  }
  return validPrice(match?.[1]);
}

export async function capturePrices(fetchPage = fetch) {
  return Promise.all(Object.entries(sources).map(async ([id, [provider, url]]) => {
    try {
      const page = await fetchPage(url, { redirect: 'follow', signal: AbortSignal.timeout(7000) });
      const sameSite = !page.url || new URL(page.url).hostname.replace(/^www\./, '') === new URL(url).hostname.replace(/^www\./, '');
      const price = page.ok && sameSite ? extractPrice(provider, await page.text()) : null;
      return { id, price };
    } catch {
      return { id, price: null };
    }
  }));
}
