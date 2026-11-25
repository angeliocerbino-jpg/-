"""Refresh the public Hungarian promotion sources used by the dashboard."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from hashlib import sha256
from html import unescape
import json
import os
from pathlib import Path
import re
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from zoneinfo import ZoneInfo
from datetime import datetime

from lxml import html

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "promotions" / "scan-data.js"
UNKNOWN = "未公示"
PRICE = re.compile(r'(?<!\d)(\d{1,3}(?:[.\s]\d{3}){1,2})\s*,?[-–]?\s*Ft\b', re.I)
HONDA = "https://www.honda.hu/motorcycles/range/offers/"
KAWASAKI = "https://www.bajnokmotor.hu/kawasaki/aktualis_ajanlataink"
SUZUKI = "https://motor.suzuki.hu"
BENELLI = "https://benelli.hu/"
ZONTES = "https://www.zontes.hu/modellek.php"
TODAY = datetime.now(ZoneInfo("Europe/Budapest")).date()
FORCE = os.getenv("FORCE_PROMO_SCAN") == "1"


def text(node):
    return " ".join(" ".join(node.itertext()).split())


def first(items):
    return next(iter(items), "")


def normalize(base, href):
    parts = urlsplit(urljoin(base, unescape(href)))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, parts.query, ""))


def prices(value):
    return [int(re.sub(r"\D", "", amount)) for amount in PRICE.findall(value)]


def fetch_once(url):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; HungaryPromotionDashboard/1.0)"})
    with urlopen(request, timeout=18) as response:
        if urlsplit(response.url).hostname.removeprefix("www.") != urlsplit(url).hostname.removeprefix("www."):
            raise ValueError("unexpected redirect")
        page = response.read(5_000_001)
        if len(page) > 5_000_000:
            raise ValueError("unexpected document size")
    return html.fromstring(page.decode("utf-8", errors="replace"))


def fetch(url):
    try:
        return fetch_once(url)
    except HTTPError as error:
        if error.code not in {500, 502, 503, 504}:
            raise
        return fetch_once(url)


def safe_image(base, src):
    if not src:
        return ""
    url = normalize(base, src)
    return url if url.startswith("https://") else ""


def image_in(node, url):
    for img in node.xpath(".//img"):
        for attr in ("data-src", "src", "data-srcset", "srcset"):
            src = img.get(attr, "").strip().split()
            if not src or src[0].startswith("data:") or ".svg" in src[0]:
                continue
            if "placeholder" in src[0] or "logo" in src[0].lower():
                continue
            if image := safe_image(url, src[0]):
                return image
    return ""


def og_image(doc, url):
    return safe_image(url, first(doc.xpath('//meta[@property="og:image"]/@content')))


def related(doc, url, path_pattern):
    links = []
    for anchor in doc.xpath("//a[@href]"):
        link = normalize(url, anchor.get("href"))
        parts = urlsplit(link)
        if parts.hostname == urlsplit(url).hostname and re.fullmatch(path_pattern, parts.path):
            links.append(link)
    return sorted(set(links))


def row(brand, url, model, heading, description, photo="", original=None, price=None, kind="现金优惠", vehicle=False, timing=""):
    return dict(brand=brand, url=url, model=model, originalTitle=heading, originalText=description[:1500],
                checkedOn=TODAY.isoformat(), remoteImage=photo, original=original, price=price, type=kind, vehicle=vehicle, timing=timing)


def extract_dates(value):
    result = []
    for year, month, day in re.findall(r'\b(20\d\d)[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\b', value):
        try:
            result.append(date(int(year), int(month), int(day)).isoformat())
        except ValueError:
            continue
    months = "január február március április május június július augusztus szeptember október november december".split()
    for year, month, day in re.findall(r'\b(20\d\d)\.\s*([a-záéíóöőúüű]+)\s+(\d{1,2})\b',value,re.I):
        if month.lower() in months:
            try:
                result.append(date(int(year),months.index(month.lower())+1,int(day)).isoformat())
            except ValueError:
                continue
    return sorted(set(result))


def campaigns(doc, brand, url):
    if brand == "Honda":
        headers = doc.xpath('//h1[normalize-space()]')
        header = next((el for el in reversed(headers) if re.search(r'akci|csomag|ajánlat|finansz|Africa Twin', text(el), re.I)), None)
        if header is None:
            return []
        section = header.xpath('ancestor::div[contains(@class,"pageIntro") or contains(@class,"hme-component")][1]')
        heading = text(header)
        content = doc.xpath('//div[contains(@class,"hme-text__body") or contains(@class,"richTextType")]')
        notes = [text(el) for el in content if re.search(r'THM|Futamidő|érvényes|kedvezmény|csomag', text(el), re.I)]
        if "crf1100l-kiegeszit" in url:
            notes = [text(el) for el in doc.xpath('//div[contains(@class,"pageIntro")]//p|//div[contains(@class,"rttCopy")]//p|//div[contains(@class,"rttCopy")]//li') if text(el)]
        photo = (image_in(section[0], url) if section else "") or og_image(doc, url)
        intro = first(doc.xpath('//div[contains(@class,"pageIntroImage")]'))
        if not photo and intro != "":
            photo = image_in(intro, url)
        if not photo and section:
            photo = safe_image(url, first(section[0].xpath('.//picture/source/@srcset')).split(" ")[0])
        if not photo and "ruhazat-akcio" in url:
            photo = safe_image(url, first(doc.xpath('//img[contains(@src,"Apparel_Location")]/@src')))
    else:
        section = doc.xpath('//main')
        if not section:
            return []
        content = section[0]
        headers = content.xpath('.//h1[normalize-space()]')
        if not headers:
            return []
        heading = text(headers[0])
        notes = [text(el) for el in content.xpath('.//p|.//li') if text(el)]
        photo = image_in(content, url) or og_image(doc, url)
    description = " ".join(notes)[:1500] or heading
    combined = f"{heading} {description}"
    kind = ("分期优惠" if re.search(r'THM|finanszírozás|lízing',heading+" "+description[:180],re.I)
            else "配件优惠" if re.search(r'csomag|kiegészítő|tartozék',combined,re.I) else "品牌活动")
    model = heading[:heading.lower().index("csomagajánlat")].strip() if brand=="Suzuki" and "csomagajánlat" in heading.lower() else "—"
    if brand=="Honda" and "crf1100l-kiegeszit" in url:
        model = heading
    item = row(brand, url, model, heading, description, photo, kind=kind, vehicle=model!="—")
    dates = extract_dates(combined)
    if len(dates) == 2 and re.search(r'érvény|időszak', combined, re.I):
        item.update(start=dates[0], end=dates[1])
    elif len(dates) == 1 and re.search(r'-ig.{0,80}érvényes', combined, re.I):
        item.update(end=dates[0])
    return [item]


def honda_stock(doc, url):
    result = []
    for block in doc.xpath('//div[contains(concat(" ",normalize-space(@class)," ")," hme-grid-layout ")]'):
        chunks = block.xpath('.//div[contains(@class,"hme-text__body")]')
        model = first([text(h) for chunk in chunks for h in chunk.xpath('./h3') if re.match(r'Honda\s+',text(h),re.I)])
        if not model:
            continue
        content = " ".join(text(chunk) for chunk in chunks)
        amounts = prices(content)
        amount = re.search(r'([\d\s]+)\s*,?[-–]?\s*FT\s+ÁRELŐNNYEL',content,re.I)
        discount = int(re.sub(r'\D','',amount.group(1))) if amount else None
        package = bool(re.search(r'csomag|kiegészítő',content,re.I))
        if not amounts or (not discount and not package):
            continue
        new = amounts[-1]
        old = new + discount if discount else (new if re.search(r'ajándék',content,re.I) else None)
        photo = image_in(block,url)
        if not photo:
            photo = safe_image(url, first(block.xpath('.//picture/source/@srcset')).split(" ")[0])
        result.append(row("Honda",url,model.removeprefix("Honda "),model,content,photo,old,new,
                          "现金优惠" if discount else "配件优惠",True,"以官网活动及库存为准"))
    return result


def product(doc, brand, url):
    name = first([text(el) for el in doc.xpath("//h1[normalize-space()]") if text(el).lower() not in {"benelli","kawasaki"}])
    if not name:
        return []
    if brand == "Benelli":
        box = first(doc.xpath('//p[contains(@class,"product-price")]'))
        if box == "":
            return []
        values = prices(text(box))
        if len(values) < 2 or values[0] >= values[1]:
            return []
        pic = og_image(doc,url) or safe_image(url, first(doc.xpath('//img[contains(@src,"/motorok/")]/@src')))
        return [row(brand,url,name,name,text(box),pic,values[1],values[0],vehicle=True)]
    if brand == "Kawasaki":
        if "mule" in urlsplit(url).path.lower():
            return []
        main = first(doc.xpath('//main'))
        body = text(doc if main == "" else main)
        old = re.search(r'Eredeti ár\s+(.*?Ft)', body, re.I)
        new = re.search(r'Akciós ár\s+(.*?Ft)', body, re.I)
        regular = first(prices(old.group(1))) if old else None
        sale = first(prices(new.group(1))) if new else None
        if not regular or not sale or sale >= regular:
            return []
        return [row(brand,url,name,name,old.group(0)+" · "+new.group(0),og_image(doc,url),regular,sale,vehicle=True)]
    block = first(doc.xpath('//*[contains(@class,"ar-container")]'))
    if block == "":
        return []
    scope = text(block)
    if not re.search(r'akció|kedvezmény|visszavonásig|alapár tartalmazza|bevezető ár',scope,re.I):
        return []
    value = first(prices(scope))
    photo = og_image(doc,url) or safe_image(url,first(doc.xpath('//img[contains(@src,"/images/") and not(contains(@src,"logo"))]/@src')))
    needs_hardware = bool(re.search(r'alapár tartalmazza|adventure kit',scope,re.I))
    timing = "有效至撤回" if re.search(r'visszavonásig',scope,re.I) else ""
    return [row(brand,url,name,name,scope,photo,price=value or None,kind="配件优惠" if needs_hardware else "品牌活动",vehicle=True,timing=timing)]


def suzuki_prices(doc, url):
    result = []
    for a in doc.xpath('//main//a[@href]'):
        label = text(a)
        if "AKCIÓS" not in label or "/motorok/" not in a.get("href"):
            continue
        amounts = prices(label)
        if len(amounts) < 2 or amounts[0] >= amounts[1]:
            raise ValueError("Suzuki promotional price format changed")
        detail = normalize(url,a.get("href"))
        model = re.sub(r'-m\d+$','',urlsplit(detail).path.rsplit('/',1)[-1]).upper()
        year = first(re.findall(r'20\d\d',label))
        model = f"{model}（{year}）" if year else model
        item = row("Suzuki",detail,model,model,label,image_in(a,url),amounts[1],amounts[0],vehicle=True)
        item["priceUrl"] = url
        result.append(item)
    return result


def scan_brand(brand, config):
    seeds, pattern = config
    report = {"brand": brand, "pages": 0, "failed": [], "offers": 0}
    rows, detail_urls = [], set()
    for seed in seeds:
        try:
            doc = fetch(seed)
            report["pages"] += 1
            if seed == SUZUKI+"/arlista/":
                rows.extend(suzuki_prices(doc,seed))
            else:
                found = related(doc,seed,pattern)
                if not [link for link in found if link not in seeds]:
                    raise ValueError("no offer or model links found")
                detail_urls.update(found)
        except Exception as error:
            report["failed"].append(seed)
            print(brand, seed, str(error), flush=True)
    detail_urls.difference_update(seeds)
    if brand == "Honda":
        detail_urls = {url.replace("/content/honda/hu_hu","") for url in detail_urls}
        detail_urls.difference_update({HONDA+"uj-ajanlatok.html",HONDA+"offers-listing.html"})
    def detail(url):
        doc = fetch(url)
        if brand == "Honda":
            return honda_stock(doc,url) or campaigns(doc,brand,url)
        if brand == "Suzuki":
            return campaigns(doc,brand,url)
        return product(doc,brand,url)
    with ThreadPoolExecutor(max_workers=5) as pool:
        jobs = [(url,pool.submit(detail,url)) for url in sorted(detail_urls)]
        for url, job in jobs:
            try:
                rows.extend(job.result())
                report["pages"] += 1
            except Exception as error:
                report["failed"].append(url)
                print(brand,url,str(error),flush=True)
    if brand == "Suzuki":
        def compact(value):
            return re.sub(r'[^a-z0-9]', '', re.sub(r'（20\d{2}）', '', value).lower())
        bike_photos = {compact(item["model"]):item["remoteImage"] for item in rows if item.get("priceUrl")}
        for item in rows:
            if item["type"] == "配件优惠" and item["vehicle"]:
                item["remoteImage"] = bike_photos.get(compact(item["model"])) or item["remoteImage"]
    report["offers"] = len(rows)
    return rows, report


def translate(rows, previous):
    key = os.getenv("DEEPL_AUTH_KEY")
    endpoint = "https://api-free.deepl.com/v2/translate" if not key or key.endswith(":fx") else "https://api.deepl.com/v2/translate"
    cache = {item["fingerprint"]: (item["title"],item["summary"]) for item in previous if item.get("translated")}
    todo = []
    for item in rows:
        original = item["originalTitle"] + "\n" + item["originalText"]
        item["fingerprint"] = sha256(original.encode()).hexdigest()
        cached = cache.get(item["fingerprint"])
        if cached:
            item["title"],item["summary"] = cached
            item["translated"] = True
        elif item["type"] == "现金优惠" and item.get("original") and item.get("price"):
            item.update(title=item["model"]+" 促销",summary=f'原价 {item["original"]:,} HUF，优惠价 {item["price"]:,} HUF。',translated=True)
        else:
            item.update(title=item["originalTitle"],summary=item["originalText"],translated=False)
            todo.append(item)
    if not key:
        return
    for start in range(0,len(todo),15):
        batch = todo[start:start+15]
        payload = {"text":[value for item in batch for value in (item["originalTitle"],item["originalText"])],
                   "source_lang":"HU","target_lang":"ZH-HANS"}
        req = Request(endpoint,data=json.dumps(payload).encode(),headers={"Authorization":"DeepL-Auth-Key "+key,"Content-Type":"application/json"})
        try:
            with urlopen(req,timeout=22) as response:
                translated = json.load(response)["translations"]
            for i,item in enumerate(batch):
                item.update(title=translated[2*i]["text"],summary=translated[2*i+1]["text"],translated=True)
        except Exception as error:
            print("Translation unavailable:",type(error).__name__,flush=True)
            break


SOURCES = {
    "Honda": ([HONDA+"offers-listing.html"],r"(?:/content/honda/hu_hu)?/motorcycles/range/offers/[^/]+\.html"),
    "Kawasaki": ([KAWASAKI],r"/kawasaki/aktualis_ajanlataink/[^/]+\.html"),
    "Suzuki": ([SUZUKI+"/ajanlatok",SUZUKI+"/arlista/"],r"/ajanlatok/[^/]+"),
    "Benelli": ([BENELLI],r"/termek/[^/]+/?"),
    "Zontes": ([ZONTES],r"/(?:\d[^/]*|gk-350|g200|g-125|u1-125|v125|e-350)\.php"),
}


def main():
    previous = json.loads(SNAPSHOT.read_text().removeprefix("const promotionScan = ").strip().removesuffix(";")) if SNAPSHOT.exists() else {}
    if not FORCE and TODAY.isoformat() < previous.get("nextDate",""):
        print("Scan not due until",previous["nextDate"])
        return
    with ThreadPoolExecutor(max_workers=5) as pool:
        batches = list(pool.map(lambda pair: scan_brand(*pair),SOURCES.items()))
    if not any(report["pages"] for _, report in batches):
        raise RuntimeError("all source pages unavailable")
    records = []
    for rows, report in batches:
        if report["failed"]:
            known = {(item["url"],item["model"]) for item in rows}
            for item in previous.get("offers",[]):
                if item["brand"] == report["brand"] and (item["url"],item["model"]) not in known:
                    rows.append({**item,"stale":True})
        records.extend(rows)
    unique = {(item["brand"],item["url"],item["model"]):item for item in records}
    records = list(unique.values())
    translate(records,previous.get("offers",[]))
    snapshot = dict(checkedOn=TODAY.isoformat(),nextDate=(TODAY+timedelta(days=15)).isoformat(),
                    sources=[report for _, report in batches],offers=records)
    SNAPSHOT.write_text("const promotionScan = "+json.dumps(snapshot,ensure_ascii=False,indent=2)+";\n")
    print([(r['brand'],r['pages'],r['offers'],len(r['failed'])) for r in snapshot["sources"]])


if __name__ == "__main__":
    main()
