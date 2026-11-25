'use strict';

const checkedOn = '2026-11-25';
const brands = {
  Honda: { color: '#b92245', label: 'Honda', image: 'm043', entry: 'https://www.honda.hu/motorcycles/range/offers/offers-listing.html', publisher: 'Honda 匈牙利', scope: '匈牙利官方渠道，库存及参与细节向当地授权店确认' },
  Kawasaki: { color: '#3e6e31', label: 'Kawasaki', image: 'm098', entry: 'https://www.bajnokmotor.hu/kawasaki/aktualis_ajanlataink', publisher: 'Bajnok Motor', scope: 'Bajnok Motor 经销商报价', dealer: true },
  Suzuki: { color: '#254acb', label: 'Suzuki', image: 'm064', entry: 'https://motor.suzuki.hu/ajanlatok', publisher: 'Suzuki 匈牙利', scope: '匈牙利官方渠道，向当地授权店确认供应' },
  Benelli: { color: '#785f29', label: 'Benelli 贝纳利', image: 'm053', entry: 'https://benelli.hu/', publisher: 'Benelli 匈牙利', scope: '匈牙利品牌网站展示，参与门店未公示' },
  Zontes: { color: '#604694', label: 'Zontes', image: 'm020', entry: 'https://www.zontes.hu/modellek.php', publisher: 'Zontes 匈牙利进口商', scope: '进口商车型页，参与门店未公示' }
};

const hondaPriceList = 'https://www.honda.hu/content/dam/local/hungary/motorcylces/Arlista/MC_%C3%A1rlista_20261012.pdf';
const suzukiPriceList = 'https://motor.suzuki.hu/arlista/';
const hondaStock = { brand: 'Honda', type: '现金优惠', start: '2026-10-12', end: '2026-12-31', timing: '或售完即止', url: hondaPriceList };
const offers = [
  { ...hondaStock, model: 'NX500', title: 'NX500 库存车优惠', image: 'm043.webp', imageCaption: '车型参考图', original: 2739000, price: 2599000, summary: '标准版降价 140,000 HUF。E-Clutch 版另列，优惠后为 2,799,000 HUF。' },
  { ...hondaStock, model: 'ADV350', title: 'ADV350 标准版优惠', image: 'm019.webp', imageCaption: '车型参考图', original: 2699000, price: 2499000, summary: '标准版降价 200,000 HUF。带尾箱版本另列，优惠后为 2,659,000 HUF。' },
  { ...hondaStock, model: 'CB500 Hornet', title: 'CB500 Hornet 库存车优惠', image: 'm096.webp', imageCaption: '车型参考图', original: 2499000, price: 2359000, summary: '标准版优惠 140,000 HUF。E-Clutch 版另列，优惠后为 2,559,000 HUF。' },
  { ...hondaStock, model: 'CBR500R', title: 'CBR500R 库存车优惠', image: 'm145.webp', imageCaption: '车型参考图', original: 2779000, price: 2639000, summary: '标准版优惠 140,000 HUF。E-Clutch 版另列，优惠后为 2,839,000 HUF。' },
  { ...hondaStock, model: 'CB650R / CB650R E-Clutch', title: 'CB650R 随车赠 Sport 套件', image: 'm109.webp', imageCaption: 'CB650R 车型参考图', type: '配件优惠', original: 3559000, price: 3559000, summary: 'CB650R 标准版车价为 3,559,000 HUF，E-Clutch 版为 3,759,000 HUF，两版本都列有赠 Sport 套件。', terms: '配件安装费另计，套件详情向授权经销商确认。表中金额为标准版。' },
  { brand: 'Honda', type: '分期优惠', model: '摩托车 / 大踏板', title: 'Honda 摩托车及大踏板融资', image: 'honda-finance.jpg', imageCaption: 'Honda 活动页配图', summary: '官网列示的一个融资方案，THM（综合年成本率）8.1%–17.9%，最低首付 30%，期限 24–84 个月。', terms: '费率和适用条件因方案而异，全文列有保险和费用条款，以经销商正式报价为准。', url: 'https://www.honda.hu/motorcycles/range/offers/finanszirozasi-akcio.html' },
  { brand: 'Kawasaki', type: '现金优惠', model: 'Ninja 500 SE（2027）', title: 'Ninja 500 SE 经销商优惠', image: 'ninja500se.webp', imageCaption: '经销商活动页配图', original: 2854000, price: 2749000, summary: 'Bajnok Motor 将 Ninja 500 SE 降价 105,000 HUF。', url: 'https://www.bajnokmotor.hu/kawasaki/aktualis_ajanlataink/kawasaki-ninja500-se-1.html' },
  { brand: 'Kawasaki', type: '现金优惠', model: 'ZX-4R', title: 'ZX-4R 经销商优惠', image: 'zx4r.webp', imageCaption: '经销商活动页配图', original: 3438000, price: 3329000, summary: 'Bajnok Motor 将 ZX-4R 降价 109,000 HUF。', url: 'https://www.bajnokmotor.hu/kawasaki/aktualis_ajanlataink/kawasaki-zx-4r.html' },
  { brand: 'Suzuki', type: '现金优惠', model: 'V-Strom 800（2026）', title: 'V-Strom 800 官方价目表优惠', image: 'm064.webp', imageCaption: '车型参考图', original: 3999000, price: 3599000, summary: '匈牙利 Suzuki 价目表列出 2026 款标准版优惠 400,000 HUF。', url: suzukiPriceList },
  { brand: 'Suzuki', type: '现金优惠', model: 'GSX-8S（2026）', title: 'GSX-8S 官方价目表优惠', image: 'm118.webp', imageCaption: '车型参考图', original: 3499000, price: 3199000, summary: '2026 款降价 300,000 HUF。车型页提示经销商暂无库存，可向授权店查询进口商库存。', url: 'https://motor.suzuki.hu/motorok/gsx-8s-m6', priceUrl: suzukiPriceList },
  { brand: 'Suzuki', type: '分期优惠', model: 'Burgman 400 / DR-Z4SM / V-Strom 800DE / Katana / GSX-S1000GX / GT', title: '指定车型 5.99% THM 融资', image: 'suzuki-finance.webp', imageCaption: 'Suzuki 活动原图', end: '2026-09-30', timing: '或提前撤回', summary: '指定车型可申请固定利率融资租赁，期限 12–60 个月，最低首付 20%。个人及企业均可申请。', terms: '原文要求全险，另列付费免全险选项。已过原公告截止日。', url: 'https://motor.suzuki.hu/hirek/kedvezo-feltetelekkel-a-nyeregbe' },
  { brand: 'Benelli', type: '现金优惠', model: 'TRK 702', title: 'TRK 702 车型降价', image: 'm053.webp', imageCaption: '车型参考图', original: 2909000, price: 2299000, summary: '匈牙利品牌页列出原价和优惠价，差额 610,000 HUF。', url: 'https://benelli.hu/termek/trk-702' },
  { brand: 'Benelli', type: '现金优惠', model: 'TRK 702 X', title: 'TRK 702 X 车型降价', image: 'trk702x.webp', imageCaption: '匈牙利官网车型图', original: 3099000, price: 2389000, summary: '匈牙利品牌页列出原价和优惠价，差额 710,000 HUF。', url: 'https://benelli.hu/termek/trk-702-x' },
  { brand: 'Benelli', type: '现金优惠', model: 'Tornado 550', title: 'Tornado 550 车型降价', image: 'tornado550.webp', imageCaption: '匈牙利官网车型图', original: 2589000, price: 2379000, summary: '匈牙利品牌页列出原价和优惠价，差额 210,000 HUF。', url: 'https://benelli.hu/termek/tornado-550' },
  { brand: 'Zontes', type: '配件优惠', model: '368G High-Seat（2026）', title: '368G 高座版原厂配件方案', image: 'm020.webp', imageCaption: '368G 车型参考图', price: 2349900, timing: '有效至撤回', summary: '含税车价含护杠、发动机护板和雾灯。原厂铝尾箱加支架为 50,000 HUF。', terms: '车价另计 200,000 HUF 注册及过户税费，合计 2,549,900 HUF。官网未公布可比原价。', url: 'https://www.zontes.hu/368g_h.php' }
];
