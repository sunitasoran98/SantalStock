import type { Asset, LangCode, SiteConfig } from '../types';

export const LANGS: { k: LangCode; n: string; v: string; short: string }[] = [
  { k: 'satr', n: 'Santali (Roman)', v: 'en-IN', short: 'Sa' },
  { k: 'satd', n: 'संताली (देवनागरी)', v: 'hi-IN', short: 'सं' },
  { k: 'hi', n: 'हिन्दी', v: 'hi-IN', short: 'हिं' },
  { k: 'en', n: 'English', v: 'en-IN', short: 'EN' },
];

export const LIDX: Record<LangCode, number> = { en: 0, hi: 1, satr: 2, satd: 3 };

export const TX: Record<string, [string, string, string, string]> = {
  aiT: ['AI search', 'AI सर्च', 'AI sendra', 'AI सेंदरा'],
  aiS: [
    'Ask in your own words: English, Hindi, Hinglish or Santali.',
    'अपनी भाषा में सीधे पूछिए: हिन्दी, हिंग्लिश, अंग्रेज़ी या संताली।',
    "Am reak' paṛsi te kulime: Santali, Hindi se English.",
    'आम रेयाक् पारसि ते कुलिमे: संताली, हिन्दी से इंग्लिश।',
  ],
  aiAsk: ['Ask', 'पूछो', 'Kulime', 'कुलिमे'],
  aiPh: [
    'e.g. village festival photos for a news article',
    'जैसे: न्यूज़ के लिए गाँव के पर्व की फोटो',
    "jemon: news lagit' ato parab photo",
    'जेमोन: न्यूज़ लागित् आतो परब फोटो',
  ],
  aiGot: ['Understood', 'समझा', 'Bujhaúena', 'बुझाउ एना'],
  aiOpen: ['Open in Advance search', 'Advance search में खोलें', "Advance search re jhic'", 'Advance search रे झिच्'],
  aiNone: [
    'Nothing matched. Try other words, or browse all photos.',
    'कुछ नहीं मिला। दूसरे शब्द आज़माइए या सारी फोटो देखिए।',
    "Nitok' do ban ńam ena. Eṭak' kaṭha olme.",
    'नितोक् दो बान ञाम एना। एटाक् काथा ओलमे।',
  ],
  aiNote: [
    'This smart search runs on your device and understands Hindi, Hinglish, Santali and spelling mistakes.',
    'यह स्मार्ट सर्च आपके डिवाइस पर चलता है और हिन्दी, हिंग्लिश, संताली व गलत स्पेलिंग भी समझता है।',
    "Noa smart sendra am reak' device re calak'a, Santali, Hindi ar bhul spelling hõ bujhaua.",
    'नोआ स्मार्ट सेंदरा आम रेयाक् डिवाइस रे चालाक्आ, संताली, हिन्दी आर भुल स्पेलिंग हों बुझाउआ।',
  ],
  aiMic: ['Speak', 'बोलिए', 'Roṛme', 'रोड़मे'],
  eg: ['e.g.', 'जैसे', 'Jemon', 'जेमोन'],
  allLang: ['all photos', 'सभी तस्वीरें', 'joto photo', 'जोतो फोटो'],
  search: ['Search photos, e.g. village, festival, forest', 'फोटो खोजें', 'Photo sẽndra me', 'फोटो सेँन्दरा मे'],
  home: ['Home', 'होम', "Orak'", 'ओड़ाक्'],
  browse: ['Browse', 'ब्राउज़', 'Ńel me', 'ञेल मे'],
  pricing: ['Pricing', 'कीमत', 'Gonoṅ', 'गोनोङ'],
  licenses: ['Licenses', 'लाइसेंस', 'License', 'लाइसेंस'],
  sell: ['Sell', 'बेचें', 'Akriń', 'आकरिञ'],
  lightbox: ['Lightbox', 'लाइटबॉक्स', 'Lightbox', 'लाइटबॉक्स'],
  cart: ['Cart', 'कार्ट', 'Cart', 'कार्ट'],
  login: ['Sign in', 'साइन इन', 'Bolo me', 'बोलो मे'],
  logout: ['Sign out', 'साइन आउट', "Oḍok' me", 'ओडोक् मे'],
  account: ['My account', 'मेरा अकाउंट', "Ińak' account", 'इञाक् अकाउंट'],
  orders: ['My downloads', 'मेरे डाउनलोड', "Ińak' download", 'इञाक् डाउनलोड'],
  admin: ['Admin', 'एडमिन', 'Admin', 'एडमिन'],
  lang: ['Language', 'भाषा', 'Părsi', 'पारसि'],
  heroT: [
    'Authentic stock photos from Santal country',
    'संताल अंचल की असली स्टॉक तस्वीरें',
    "Santal disom reak' sări stock photo",
    'संताल दिसोम रेयाक् सारि स्टॉक फोटो',
  ],
  heroS: [
    'Royalty-Free and Editorial licenses. Affordable minimum prices, instant downloads, GST invoice.',
    'Royalty-Free और Editorial लाइसेंस। सबसे किफायती कीमतें, तुरंत डाउनलोड, GST इनवॉइस।',
    'Royalty-Free ar Editorial license. Kom gonoṅ, jhạṭpaṭ download, GST bill.',
    'रॉयल्टी-फ्री आर एडिटोरियल लाइसेंस। कोम गोनोङ, झटपट डाउनलोड, GST बिल।',
  ],
  trending: ['Trending now', 'ट्रेंडिंग', 'Ạḍi ńeloḱ kana', 'आडि ञेलोक् काना'],
  newest: ['Newest uploads', 'नई तस्वीरें', 'Nãwã photo', 'नावां फोटो'],
  cats: ['Browse by category', 'कैटेगरी से देखें', 'Rokom lekate ńel me', 'रोकोम लेकाते ञेल मे'],
  addcart: ['Add to cart', 'कार्ट में डालें', 'Cart re dohoe me', 'कार्ट रे दोहोय मे'],
  buynow: ['Buy now', 'अभी खरीदें', 'Nitoge kiriń me', 'नितोगे किरिञ मे'],
  rf: ['Royalty-Free', 'Royalty-Free', 'Royalty-Free', 'रॉयल्टी-फ्री'],
  ed: ['Editorial', 'Editorial', 'Editorial', 'एडिटोरियल'],
  edonly: ['Editorial use only', 'सिर्फ़ Editorial उपयोग', 'Editorial babot ge', 'एडिटोरियल बाबोत गे'],
  all: ['All', 'सभी', 'Joto', 'जोतो'],
  lic: ['License', 'लाइसेंस', 'License', 'लाइसेंस'],
  cat: ['Category', 'कैटेगरी', 'Rokom', 'रोकोम'],
  orient: ['Orientation', 'ओरिएंटेशन', 'Gaṭhon', 'गाठोन'],
  sort: ['Sort by', 'क्रम', 'Thar', 'थार'],
  rel: ['Relevance', 'प्रासंगिक', 'Jog', 'जोग'],
  new: ['Newest', 'नया', 'Nãwã', 'नावां'],
  pop: ['Most popular', 'लोकप्रिय', 'Ạḍi ńeloḱ', 'आडि ञेलोक'],
  land: ['Landscape', 'लैंडस्केप', "Gitic'", 'गितिच्'],
  port: ['Portrait', 'पोर्ट्रेट', 'Tengo', 'तेंगो'],
  sq: ['Square', 'स्क्वेयर', 'Car kona', 'चार कोना'],
  results: ['results', 'नतीजे', 'photo', 'फोटो'],
  loadmore: ['Load more', 'और दिखाएँ', 'Arhõ ńel me', 'आरहों ञेल मे'],
  filters: ['Filters', 'फ़िल्टर', 'Filter', 'फ़िल्टर'],
  reset: ['Reset', 'रीसेट', 'Nãwã ate', 'नावां आते'],
  size: ['Size', 'साइज़', 'Mạp', 'माप'],
  checkout: ['Checkout', 'चेकआउट', 'Checkout', 'चेकआउट'],
  total: ['Total', 'कुल', 'Gut', 'गुट'],
  subtotal: ['Subtotal', 'उप-योग', 'Subtotal', 'सबटोटल'],
  empty: ['Nothing here yet.', 'अभी यहाँ कुछ नहीं है।', "Nitoḱ do noa re cet' ho banuk'a.", 'नितोक् दो नोवा रे चेत् हो बानुक्आ।'],
  free: ['Free comp (watermarked)', 'मुफ़्त प्रीव्यू (वॉटरमार्क)', 'Gonoṅ baṅ comp (watermark)', 'गोनोङ बाङ कम्प (वाटरमार्क)'],
  price: ['Price (+GST)', 'कीमत (+GST)', 'Gonoṅ (+GST)', 'गोनोङ (+GST)'],
  similar: ['Similar photos', 'मिलती-जुलती तस्वीरें', "Mit' leka photo", 'मित् लेका फोटो'],
  saved: ['♥ Saved', '♥ सेव हुआ', '♥ Dohoakan', '♥ दोहोआकान'],
  listen: ['Listen', 'सुनें', 'Ańjom me', 'आञजोम मे'],
  by: ['by', 'द्वारा', 'hoṛ', 'होड़'],
  downloads: ['downloads', 'डाउनलोड', 'download', 'डाउनलोड'],
  ctaT: ['Sell your photos', 'अपनी तस्वीरें बेचिए', "Amak' photo akriń me", 'आमाक् फोटो आकरिञ मे'],
  ctaS: ['Earn royalty on every sale.', 'हर बिक्री पर रॉयल्टी कमाइए।', 'Joto akriń re royalty ńam me.', 'जोतो आकरिञ रे रॉयल्टी ञाम मे।'],
  ctaB: ['Become a contributor', 'कॉन्ट्रिब्यूटर बनिए', "Contributor hoyok' me", 'कॉन्ट्रिब्यूटर होयोक् मे'],
  billing: ['Billing details', 'बिलिंग विवरण', "Bill reak' khobor", 'बिल रेयाक् खोबोर'],
  fullname: ['Full name', 'पूरा नाम', 'Purạu ńutum', 'पुराउ ञुतुम'],
  email: ['Email', 'ईमेल', 'Email', 'ईमेल'],
  password: ['Password', 'पासवर्ड', 'Password', 'पासवर्ड'],
  company: ['Company / Organisation (optional)', 'कंपनी / संस्था (वैकल्पिक)', 'Company / Sanstha (ban hõ)', 'कंपनी / संस्था (बान हों)'],
  state: ['State', 'राज्य', 'Raj', 'राज'],
  pin: ['PIN code', 'पिन कोड', 'PIN code', 'पिन कोड'],
  licensee: ['Licensee (name on the license)', 'लाइसेंसी (जिस नाम पर लाइसेंस होगा)', "Licensee (license reak' ńutum)", 'लाइसेंसी (लाइसेंस रेयाक् ञुतुम)'],
  use: ['Intended use / project', 'उपयोग / प्रोजेक्ट', 'Okare bebhar', 'ओकारे बेभार'],
  payment: ['Payment', 'भुगतान', "Taka emok'", 'टाका एमोक्'],
  demo: ['Demo checkout: no real money is charged in preview mode.', 'डेमो चेकआउट: प्रीव्यू मोड में असली पैसा नहीं कटेगा।', "Demo checkout: sări taka baṅ hoyoḱa.", 'डेमो चेकआउट: सारि टाका बाङ होयोक्आ।'],
  agree: [
    'I have read the SantalStock License Agreement and will not use Editorial photos commercially.',
    'मैंने SantalStock License Agreement पढ़ लिया है। Editorial तस्वीरों का commercial उपयोग नहीं करूँगा।',
    "SantalStock License Agreement iń porhao akat'a. Editorial photo do commercial re baṅ bebhara.",
    'सानतालस्टॉक लाइसेंस एग्रीमेंट इञ पोरहाव आकात्आ। एडिटोरियल फोटो दो कमर्शियल रे बाङ बेभारआ।',
  ],
  pay: ['Pay & get license', 'भुगतान करें और लाइसेंस पाएँ', 'Taka em ar license ńam me', 'टाका एम आर लाइसेंस ञाम मे'],
  download: ['Download', 'डाउनलोड', 'Download', 'डाउनलोड'],
  cert: ['Certificate', 'सर्टिफ़िकेट', 'Certificate', 'सर्टिफिकेट'],
  invoice: ['GST Invoice', 'GST इनवॉइस', 'GST bill', 'GST बिल'],
  newcol: ['+ New collection', '+ नया कलेक्शन', '+ Nãwã collection', '+ नावां कलेक्शन'],
  plans: ['Subscription plans', 'सब्सक्रिप्शन प्लान', 'Subscription plan', 'सब्सक्रिप्शन प्लान'],
  ondemand: ['On-demand (per photo)', 'प्रति फोटो', "Mit' photo lekate", 'मित् फोटो लेकाते'],
  upload: ['Upload', 'अपलोड', 'Upload', 'अपलोड'],
  portfolio: ['Portfolio', 'पोर्टफ़ोलियो', 'Portfolio', 'पोर्टफ़ोलियो'],
  earnings: ['Earnings', 'कमाई', 'Ńam taka', 'ञाम टाका'],
  dashboard: ['Dashboard', 'डैशबोर्ड', 'Dashboard', 'डैशबोर्ड'],
  reader: ['Text reader', 'टेक्स्ट रीडर', 'Ol porhao', 'ओल पोरहाव'],
  upiPayTitle: ['Pay with UPI', 'UPI से भुगतान करें', 'UPI te taka em me', 'UPI ते टाका एम मे'],
  upiScan: ['Scan the QR with any UPI app, or tap the button on your phone.', 'किसी भी UPI ऐप से QR स्कैन करें, या फ़ोन पर बटन दबाएँ।', 'Jahan UPI app te QR scan me, se phone re button tipić me.', 'जाहान UPI ऐप ते QR स्कैन मे, से फ़ोन रे बटन टिपिच् मे।'],
  upiOpen: ['Open UPI app', 'UPI ऐप खोलें', 'UPI app jhici me', 'UPI ऐप झिचि मे'],
  utrLabel: ['UPI transaction ID / UTR (12 digits)', 'UPI ट्रांज़ैक्शन ID / UTR (12 अंक)', 'UPI transaction ID / UTR (12 ank)', 'UPI ट्रांज़ैक्शन ID / UTR (12 अंक)'],
  utrHelp: ['Find it in your UPI app under payment details after paying.', 'भुगतान के बाद UPI ऐप में payment details में मिलेगा।', 'Taka em tayom UPI app re payment details re ńamoḱa.', 'टाका एम तायोम UPI ऐप रे payment details रे ञामोक्आ।'],
  waSend: ['Send screenshot on WhatsApp', 'WhatsApp पर स्क्रीनशॉट भेजें', 'WhatsApp re screenshot kul me', 'WhatsApp रे स्क्रीनशॉट कुल मे'],
  submitUtr: ['I have paid, submit', 'भुगतान कर दिया, जमा करें', 'Taka em keda, jama me', 'टाका एम केदा, जमा मे'],
  pendingMsg: ['Payment received for verification. Your license/credits will activate after we confirm the UTR (usually within a few hours).', 'भुगतान जाँच के लिए मिल गया। UTR पक्का होते ही लाइसेंस/क्रेडिट चालू हो जाएँगे (आमतौर पर कुछ घंटों में)।', 'Taka jãc lagit́ ńam akana. UTR thik hoeten license/credit calaḱa.', 'टाका जाँच लागित् ञाम आकाना। UTR ठिक होयेतेन लाइसेंस/क्रेडिट चालाक्आ।'],
  stPending: ['Verifying', 'जाँच जारी', 'Jãc', 'जाँच'],
  stPaid: ['Paid', 'भुगतान हुआ', 'Taka em', 'टाका एम'],
  stRejected: ['Not found', 'नहीं मिला', 'Bań ńam', 'बाङ ञाम'],
  readPage: ['Read page', 'पेज पढ़ें', 'Sahṭa porhao', 'साहटा पोरहाव'],
  readSel: ['Select text to read only that part', 'सिर्फ़ चुना हुआ हिस्सा पढ़ने के लिए टेक्स्ट चुनें', 'Bachao ol ge porhaoḱa', 'बाछाव ओल गे पोरहावोक्आ'],
  pause: ['Pause', 'रोकें', 'Thir', 'थिर'],
  resume: ['Resume', 'जारी रखें', 'Arhõ', 'आरहों'],
  stop: ['Stop', 'बंद करें', 'Bonḍo', 'बोंडो'],
  rdFirst: ['Start (Home)', 'शुरू से (Home)', 'Eteḱ khon (Home)', 'एटेक् खोन (Home)'],
  rdPrev: ['Previous line', 'पिछली लाइन', 'Laha ol', 'लाहा ओल'],
  rdNext: ['Next line', 'अगली लाइन', 'Tayom ol', 'तायोम ओल'],
  rdLast: ['Last line (End)', 'आख़िरी लाइन (End)', 'Mucạt ol (End)', 'मुचात् ओल (End)'],
  pgTop: ['Go to top of page', 'पेज के ऊपर जाएँ', 'Sahṭa cetan sen', 'साहटा चेतान सेन'],
  pgEnd: ['Go to end of page', 'पेज के नीचे जाएँ', 'Sahṭa latar sen', 'साहटा लातार सेन'],
  speed: ['Speed', 'गति', 'Gati', 'गाति'],
  noVoice: ['Your browser has no voice for reading.', 'आपके ब्राउज़र में पढ़ने की आवाज़ नहीं है।', "Amak' browser re aṛaṅ banuk'a.", 'आमाक् ब्राउज़र रे आड़ाङ बानुक्आ।'],
  ftag: ['A marketplace for photos of Santal life, culture and nature.', 'संताल जीवन, संस्कृति और प्रकृति की तस्वीरों का बाज़ार।', "Santal jiwi, lakcar ar prokriti reak' photo hạṭ.", 'संताल जिवि, लाकचार आर प्रोकृति रेयाक् फोटो हाट।'],
  about: ['About us', 'हमारे बारे में', 'Ale babot', 'आले बाबोत'],
  contact: ['Contact', 'संपर्क', 'Joṛao', 'जोड़ाव'],
  privacy: ['Privacy Policy', 'प्राइवेसी पॉलिसी', 'Privacy Policy', 'प्राइवेसी पॉलिसी'],
  refund: ['Refund Policy', 'रिफ़ंड पॉलिसी', 'Refund Policy', 'रिफंड पॉलिसी'],
  terms: ['License Agreement', 'लाइसेंस एग्रीमेंट', 'License Agreement', 'लाइसेंस एग्रीमेंट'],
  verify: ['Verify License', 'लाइसेंस जाँचें', 'License sări ńel', 'लाइसेंस सारि ञेल'],
  faq: ['FAQ', 'सवाल-जवाब', 'Kukli-Roṛ', 'कुकलि-रोड़'],
  guide: ['License Guide', 'लाइसेंस गाइड', 'License guide', 'लाइसेंस गाइड'],
  sellPhotos: ['Sell your photos', 'अपनी फोटो बेचें', 'Photo akriń me', 'फोटो आकरिञ मे'],
  subscribe: ['Subscribe', 'सब्सक्राइब', 'Subscribe', 'सब्सक्राइब'],
  subscribed: ['Subscribed. Thank you!', 'सब्सक्राइब हो गया। धन्यवाद!', 'Subscribe hoyena. Sarhao!', 'सब्सक्राइब होयेना। सारहाव!'],
  secure: ['Secure payments', 'सुरक्षित भुगतान', "Bachao taka emok'", 'बाचाव टाका एमोक्'],
  send: ['Send', 'भेजें', 'Kul me', 'कुल मे'],
  message: ['Message', 'संदेश', 'Khobor', 'खोबोर'],
  sent: ['Message sent. We will reply soon.', 'संदेश भेजा गया। हम जल्द जवाब देंगे।', 'Khobor kulena. Ale jhạṭ roṛ ruạṛa.', 'खोबोर कुलेना। आले झाट रोड़ रुवाड़आ।'],
};

export const SLIDES: Record<LangCode, string[]> = {
  en: ['village', 'festival', 'forest', 'dance', 'harvest', 'market'],
  hi: ['गाँव', 'पर्व', 'जंगल', 'नाच', 'फसल', 'हाट'],
  satr: ['ato', 'pihạr', 'bir', "enec'", 'jom-jondra', 'hạṭ'],
  satd: ['आतो', 'पिहार', 'बिर', 'एनेच्', 'जोम-जोन्दरा', 'हाट'],
};

export function tr(lang: LangCode, key: string): string {
  const row = TX[key];
  if (!row) return key;
  return row[LIDX[lang]] ?? row[0];
}

export const SDAY: [string, string][] = [
  ['Singi', 'सिंगि'],
  ['Ote', 'ओते'],
  ['Bale', 'बाले'],
  ['Sagun', 'सागुन'],
  ['Sardi', 'सारदी'],
  ['Jarub', 'जारुब'],
  ['Ñuhum', 'ञुहुम'],
];
export const SMON = ['जानुवारी', 'फेब्रुवारी', 'मार्च', 'एप्रिल', 'मे', 'जुन', 'जुलाई', 'आगोस्ट', 'सेप्टेम्बर', 'ओक्टोबर', 'नोभेम्बर', 'डिसेम्बर'];
export const SMONR = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function getSantaliDateTime(lang: LangCode) {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const dv = lang === 'satd' || lang === 'hi';
  const ap =
    h < 12
      ? dv ? 'सिञ (सुबह)' : 'Siñ (morning)'
      : h < 17
      ? dv ? 'तिकिन (दिन)' : 'Tikin (day)'
      : h < 20
      ? dv ? 'आयुप (शाम)' : 'Ayup (evening)'
      : dv ? 'ञिदा (रात)' : 'Ñinda (night)';
  return {
    time: `${String(h % 12 || 12).padStart(2, '0')}:${m}`,
    day: SDAY[d.getDay()][dv ? 1 : 0],
    dateText: `${d.getDate()} ${(dv ? SMON : SMONR)[d.getMonth()]} ${d.getFullYear()} · ${ap}`,
  };
}

export const SEED_ASSETS: Asset[] = [
  { id: 'SS1040', pid: '40', w: 4106, h: 2806, by: 'Ryan Mcguire', contributor: 'Ryan Mcguire', owner: 'seed', cat: 'Nature', lic: 'rf', title: 'Nature landscape #01', kw: ['nature', 'landscape', 'outdoor', 'green', 'scenic'], dl: 85, date: '2026-03-13', status: 'approved', src: 'seed' },
  { id: 'SS1041', pid: '41', w: 1280, h: 805, by: 'Nithya Ramanujam', contributor: 'Nithya Ramanujam', owner: 'seed', cat: 'Village', lic: 'rf', title: 'Rural village life #02', kw: ['village', 'rural', 'india', 'countryside', 'life'], dl: 169, date: '2026-01-03', status: 'approved', src: 'seed' },
  { id: 'SS1042', pid: '42', w: 3456, h: 2304, by: 'Luke Chesser', contributor: 'Luke Chesser', owner: 'seed', cat: 'People', lic: 'rf', title: 'People lifestyle #03', kw: ['people', 'lifestyle', 'portrait', 'human', 'daily life'], dl: 213, date: '2026-09-04', status: 'approved', src: 'seed' },
  { id: 'SS1043', pid: '43', w: 1280, h: 831, by: 'Oleg Chursin', contributor: 'Oleg Chursin', owner: 'seed', cat: 'Food', lic: 'editorial', title: 'Food and drink #04', kw: ['food', 'drink', 'table', 'cooking', 'meal'], dl: 96, date: '2026-10-02', caption: 'Editorial photograph, food story. Recorded for news & documentary use.', place: 'Mayurbhanj, Odisha', status: 'approved', src: 'seed' },
  { id: 'SS1044', pid: '44', w: 4272, h: 2848, by: 'Christopher Sardegna', contributor: 'Christopher Sardegna', owner: 'seed', cat: 'Culture', lic: 'rf', title: 'Culture and tradition #05', kw: ['culture', 'tradition', 'heritage', 'art', 'festival'], dl: 12, date: '2026-02-14', status: 'approved', src: 'seed' },
  { id: 'SS1045', pid: '45', w: 4592, h: 2576, by: 'Alan Haverty', contributor: 'Alan Haverty', owner: 'seed', cat: 'Travel', lic: 'rf', title: 'Travel destination #06', kw: ['travel', 'tourism', 'journey', 'road', 'destination'], dl: 110, date: '2026-02-08', status: 'approved', src: 'seed' },
  { id: 'SS1046', pid: '46', w: 3264, h: 2448, by: 'Jeffrey Kam', contributor: 'Jeffrey Kam', owner: 'seed', cat: 'Business', lic: 'rf', title: 'Work and business #07', kw: ['business', 'office', 'work', 'technology', 'desk'], dl: 26, date: '2026-09-14', status: 'approved', src: 'seed' },
  { id: 'SS1047', pid: '47', w: 4272, h: 2848, by: 'Christopher Sardegna', contributor: 'Christopher Sardegna', owner: 'seed', cat: 'Architecture', lic: 'rf', title: 'Architecture and city #08', kw: ['architecture', 'building', 'city', 'urban', 'structure'], dl: 18, date: '2026-10-04', status: 'approved', src: 'seed' },
  { id: 'SS1048', pid: '48', w: 5000, h: 3333, by: 'Luke Chesser', contributor: 'Luke Chesser', owner: 'seed', cat: 'Nature', lic: 'editorial', title: 'Nature landscape #09', kw: ['nature', 'landscape', 'outdoor', 'green', 'scenic'], dl: 60, date: '2026-10-02', caption: 'Editorial photograph, nature story. Recorded for news & documentary use.', place: 'Banka, Bihar', status: 'approved', src: 'seed' },
  { id: 'SS1049', pid: '49', w: 1280, h: 792, by: 'Margaret Barley', contributor: 'Margaret Barley', owner: 'seed', cat: 'Village', lic: 'rf', title: 'Rural village life #10', kw: ['village', 'rural', 'india', 'countryside', 'life'], dl: 15, date: '2026-04-02', status: 'approved', src: 'seed' },
  { id: 'SS1050', pid: '50', w: 4608, h: 3072, by: 'Tyler Wanlass', contributor: 'Tyler Wanlass', owner: 'seed', cat: 'People', lic: 'rf', title: 'People lifestyle #11', kw: ['people', 'lifestyle', 'portrait', 'human', 'daily life'], dl: 145, date: '2026-03-10', status: 'approved', src: 'seed' },
  { id: 'SS1051', pid: '51', w: 5000, h: 3333, by: 'Ireneuilia', contributor: 'Ireneuilia', owner: 'seed', cat: 'Food', lic: 'rf', title: 'Food and drink #12', kw: ['food', 'drink', 'table', 'cooking', 'meal'], dl: 110, date: '2026-03-18', status: 'approved', src: 'seed' },
  { id: 'SS1052', pid: '52', w: 1280, h: 853, by: 'Cierra', contributor: 'Cierra', owner: 'seed', cat: 'Culture', lic: 'rf', title: 'Culture and tradition #13', kw: ['culture', 'tradition', 'heritage', 'art', 'festival'], dl: 33, date: '2026-10-10', status: 'approved', src: 'seed' },
  { id: 'SS1053', pid: '53', w: 1280, h: 1280, by: 'J Duclos', contributor: 'J Duclos', owner: 'seed', cat: 'Travel', lic: 'editorial', title: 'Travel destination #14', kw: ['travel', 'tourism', 'journey', 'road', 'destination'], dl: 146, date: '2026-03-04', caption: 'Editorial photograph, travel story. Recorded for news & documentary use.', place: 'Mayurbhanj, Odisha', status: 'approved', src: 'seed' },
  { id: 'SS1054', pid: '54', w: 3264, h: 2176, by: 'Nicholas Swanson', contributor: 'Nicholas Swanson', owner: 'seed', cat: 'Business', lic: 'rf', title: 'Work and business #15', kw: ['business', 'office', 'work', 'technology', 'desk'], dl: 98, date: '2026-02-18', status: 'approved', src: 'seed' },
  { id: 'SS1055', pid: '55', w: 4608, h: 3072, by: 'Tyler Wanlass', contributor: 'Tyler Wanlass', owner: 'seed', cat: 'Architecture', lic: 'rf', title: 'Architecture and city #16', kw: ['architecture', 'building', 'city', 'urban', 'structure'], dl: 185, date: '2026-02-19', status: 'approved', src: 'seed' },
  { id: 'SS1056', pid: '56', w: 2880, h: 1920, by: 'Sebastian Muller', contributor: 'Sebastian Muller', owner: 'seed', cat: 'Nature', lic: 'rf', title: 'Nature landscape #17', kw: ['nature', 'landscape', 'outdoor', 'green', 'scenic'], dl: 18, date: '2026-10-07', status: 'approved', src: 'seed' },
  { id: 'SS1057', pid: '57', w: 2448, h: 3264, by: 'Nicholas Swanson', contributor: 'Nicholas Swanson', owner: 'seed', cat: 'Village', lic: 'rf', title: 'Rural village life #18', kw: ['village', 'rural', 'india', 'countryside', 'life'], dl: 130, date: '2026-09-14', status: 'approved', src: 'seed' },
  { id: 'SS1058', pid: '58', w: 1280, h: 853, by: 'Tony Naccarato', contributor: 'Tony Naccarato', owner: 'seed', cat: 'People', lic: 'editorial', title: 'People lifestyle #19', kw: ['people', 'lifestyle', 'portrait', 'human', 'daily life'], dl: 201, date: '2026-06-15', caption: 'Editorial photograph, people story. Recorded for news & documentary use.', place: 'Banka, Bihar', status: 'approved', src: 'seed' },
  { id: 'SS1059', pid: '59', w: 2464, h: 1632, by: 'Art Wave', contributor: 'Art Wave', owner: 'seed', cat: 'Food', lic: 'rf', title: 'Food and drink #20', kw: ['food', 'drink', 'table', 'cooking', 'meal'], dl: 95, date: '2026-05-08', status: 'approved', src: 'seed' },
  { id: 'SS1060', pid: '60', w: 1920, h: 1200, by: 'Vadim Sherbakov', contributor: 'Vadim Sherbakov', owner: 'seed', cat: 'Culture', lic: 'rf', title: 'Culture and tradition #21', kw: ['culture', 'tradition', 'heritage', 'art', 'festival'], dl: 206, date: '2026-03-23', status: 'approved', src: 'seed' },
  { id: 'SS1061', pid: '61', w: 3264, h: 2448, by: 'Alex', contributor: 'Alex', owner: 'seed', cat: 'Travel', lic: 'rf', title: 'Travel destination #22', kw: ['travel', 'tourism', 'journey', 'road', 'destination'], dl: 202, date: '2026-04-03', status: 'approved', src: 'seed' },
  { id: 'SS1062', pid: '62', w: 2000, h: 1333, by: 'Daniel Genser', contributor: 'Daniel Genser', owner: 'seed', cat: 'Business', lic: 'rf', title: 'Work and business #23', kw: ['business', 'office', 'work', 'technology', 'desk'], dl: 150, date: '2026-05-17', status: 'approved', src: 'seed' },
  { id: 'SS1063', pid: '63', w: 5000, h: 2813, by: 'Justin Leibow', contributor: 'Justin Leibow', owner: 'seed', cat: 'Architecture', lic: 'editorial', title: 'Architecture and city #24', kw: ['architecture', 'building', 'city', 'urban', 'structure'], dl: 129, date: '2026-06-24', caption: 'Editorial photograph, architecture story. Recorded for news & documentary use.', place: 'Banka, Bihar', status: 'approved', src: 'seed' },
  { id: 'SS1064', pid: '64', w: 4326, h: 2884, by: 'Alexander Shustov', contributor: 'Alexander Shustov', owner: 'seed', cat: 'Nature', lic: 'rf', title: 'Nature landscape #25', kw: ['nature', 'landscape', 'outdoor', 'green', 'scenic'], dl: 76, date: '2026-10-03', status: 'approved', src: 'seed' },
  { id: 'SS1065', pid: '65', w: 4912, h: 3264, by: 'Alexander Shustov', contributor: 'Alexander Shustov', owner: 'seed', cat: 'Village', lic: 'rf', title: 'Rural village life #26', kw: ['village', 'rural', 'india', 'countryside', 'life'], dl: 33, date: '2026-09-14', status: 'approved', src: 'seed' },
  { id: 'SS1066', pid: '66', w: 3264, h: 2448, by: 'Nicholas Swanson', contributor: 'Nicholas Swanson', owner: 'seed', cat: 'People', lic: 'rf', title: 'People lifestyle #27', kw: ['people', 'lifestyle', 'portrait', 'human', 'daily life'], dl: 45, date: '2026-06-05', status: 'approved', src: 'seed' },
  { id: 'SS1067', pid: '67', w: 2848, h: 4288, by: 'Rula Sibai', contributor: 'Rula Sibai', owner: 'seed', cat: 'Food', lic: 'rf', title: 'Food and drink #28', kw: ['food', 'drink', 'table', 'cooking', 'meal'], dl: 128, date: '2026-07-02', status: 'approved', src: 'seed' },
  { id: 'SS1068', pid: '68', w: 4608, h: 3072, by: 'Cristian Moscoso', contributor: 'Cristian Moscoso', owner: 'seed', cat: 'Culture', lic: 'editorial', title: 'Culture and tradition #29', kw: ['culture', 'tradition', 'heritage', 'art', 'festival'], dl: 174, date: '2026-02-25', caption: 'Editorial photograph, culture story. Recorded for news & documentary use.', place: 'Jhargram, West Bengal', status: 'approved', src: 'seed' },
  { id: 'SS1069', pid: '69', w: 4912, h: 3264, by: 'Alexander Shustov', contributor: 'Alexander Shustov', owner: 'seed', cat: 'Travel', lic: 'rf', title: 'Travel destination #30', kw: ['travel', 'tourism', 'journey', 'road', 'destination'], dl: 90, date: '2026-06-20', status: 'approved', src: 'seed' },
  { id: 'SS1070', pid: '70', w: 3011, h: 2000, by: 'Dorothy Lin', contributor: 'Dorothy Lin', owner: 'seed', cat: 'Business', lic: 'rf', title: 'Work and business #31', kw: ['business', 'office', 'work', 'technology', 'desk'], dl: 130, date: '2026-10-26', status: 'approved', src: 'seed' },
  { id: 'SS1071', pid: '71', w: 5000, h: 3333, by: 'Jon Eckert', contributor: 'Jon Eckert', owner: 'seed', cat: 'Architecture', lic: 'rf', title: 'Architecture and city #32', kw: ['architecture', 'building', 'city', 'urban', 'structure'], dl: 119, date: '2026-02-27', status: 'approved', src: 'seed' },
  { id: 'SS1072', pid: '72', w: 3000, h: 2000, by: 'Tyler Finck', contributor: 'Tyler Finck', owner: 'seed', cat: 'Nature', lic: 'rf', title: 'Nature landscape #33', kw: ['nature', 'landscape', 'outdoor', 'green', 'scenic'], dl: 26, date: '2026-05-16', status: 'approved', src: 'seed' },
  { id: 'SS1073', pid: '73', w: 5000, h: 3333, by: 'Jon Eckert', contributor: 'Jon Eckert', owner: 'seed', cat: 'Village', lic: 'editorial', title: 'Rural village life #34', kw: ['village', 'rural', 'india', 'countryside', 'life'], dl: 181, date: '2026-02-02', caption: 'Editorial photograph, village story. Recorded for news & documentary use.', place: 'Jhargram, West Bengal', status: 'approved', src: 'seed' },
  { id: 'SS1074', pid: '74', w: 4288, h: 2848, by: 'Isaak Dury', contributor: 'Isaak Dury', owner: 'seed', cat: 'People', lic: 'rf', title: 'People lifestyle #35', kw: ['people', 'lifestyle', 'portrait', 'human', 'daily life'], dl: 168, date: '2026-10-22', status: 'approved', src: 'seed' },
  { id: 'SS1075', pid: '75', w: 1999, h: 2998, by: 'Jassy Onyae', contributor: 'Jassy Onyae', owner: 'seed', cat: 'Food', lic: 'rf', title: 'Food and drink #36', kw: ['food', 'drink', 'table', 'cooking', 'meal'], dl: 213, date: '2026-08-10', status: 'approved', src: 'seed' },
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  brand: {
    // Distinct colors for every yellow/black marked part in user's screenshot
    logoPart1: { text: 'SANTAL', color: '#d6262f' },   // Crimson Red
    logoPart2: { text: 'STOCK', color: '#0f766e' },    // Emerald Teal
    heroAbbr: [
      { text: 'S', color: '#d6262f' },                 // Crimson Red
      { text: 'S', color: '#2563eb' },                 // Royal Blue
      { text: 'P', color: '#059669' },                 // Emerald Green
    ],
    heroDividerColor: '#f59e0b',                       // Warm Gold Divider
    heroFull: [
      { text: 'Santal', color: '#ea580c' },            // Saffron Orange
      { text: 'Stock', color: '#7c3aed' },             // Royal Violet
      { text: 'Photos', color: '#0284c7' },            // Ocean Blue
    ],
    searchBtnBg: '#ea580c',                            // Vibrant Saffron Search Button
    searchBtnIcon: '#ffffff',                          // Crisp White Search Icon
    searchPlaceholderCustom: '',
  },
  hero: {
    headingCustom: '',
    subtitleCustom: '',
    chips: [
      { id: 'c1', label: 'village', href: '#/search?q=village' },
      { id: 'c2', label: 'festival', href: '#/search?q=festival' },
      { id: 'c3', label: 'forest', href: '#/search?q=forest' },
      { id: 'c4', label: 'people', href: '#/search?q=people' },
      { id: 'c5', label: 'food', href: '#/search?q=food' },
      { id: 'c6', label: 'travel', href: '#/search?q=travel' },
      { id: 'c7', label: '✓ Royalty-Free', href: '#/search?lic=rf' },
      { id: 'c8', label: '📰 Editorial', href: '#/search?lic=editorial' },
    ],
  },
  subnav: [
    { id: 'n1', label: 'Browse', href: '#/search', i18nKey: 'browse' },
    { id: 'n2', label: 'Pricing', href: '#/pricing', i18nKey: 'pricing' },
    { id: 'n3', label: 'Licenses', href: '#/licenses', i18nKey: 'licenses' },
    { id: 'n4', label: 'Sell', href: '#/contributor', i18nKey: 'sell' },
    { id: 'n5', label: 'Verify License', href: '#/verify', i18nKey: 'verify' },
  ],
  featureCards: [
    {
      id: 'fc-rf',
      badge: 'Royalty-Free',
      badgeType: 'rf',
      title: 'Buy once, use again and again',
      description: 'Ads, websites, social media, packaging, print. Standard and Extended licenses starting at just ₹19, with model/property releases.',
      buttonText: 'See Royalty-Free',
      buttonLink: '#/search?lic=rf',
      buttonStyle: 'primary',
    },
    {
      id: 'fc-ed',
      badge: 'Editorial',
      badgeType: 'ed',
      title: 'For news, blogs and documentaries',
      description: 'Real events, people and places. Editorial / non-commercial use starting at just ₹15, with caption, date and location.',
      buttonText: 'See Editorial',
      buttonLink: '#/search?lic=editorial',
      buttonStyle: 'alt',
    },
  ],
  customSections: [],
  ctaBanner: {
    visible: true,
    titleCustom: '',
    subtitleCustom: '',
    buttonTextCustom: '',
    buttonLink: '#/contributor',
    bgColor: '#011f43',
    textColor: '#ffffff',
  },
  // Ultra-affordable minimum Indian pricing
  payment: {
    upiId: '9110977117@ybl',
    payeeName: 'BOSC Tech and Edu',
    whatsapp: '919110977117',
  },
  pricing: {
    currency: '₹',
    gst: 0.18,
    payoutMin: 100,
    royalty: { rf: 0.4, editorial: 0.3 },
    sizes: [
      { k: 'S', n: 'Small', px: 800 },
      { k: 'M', n: 'Medium', px: 1600 },
      { k: 'L', n: 'Large / Original', px: 0 },
    ],
    matrix: {
      std: { S: 19, M: 29, L: 49 },
      ext: { S: 79, M: 129, L: 199 },
      ed: { S: 15, M: 25, L: 39 },
    },
    licMeta: {
      std: {
        n: 'Royalty-Free Standard',
        cr: 1,
        type: 'rf',
        desc: 'Web, social media, ads, presentations, print up to 5,00,000 copies.',
      },
      ext: {
        n: 'Royalty-Free Extended',
        cr: 5,
        type: 'rf',
        desc: 'Unlimited print, merchandise for resale, templates, product packaging.',
      },
      ed: {
        n: 'Editorial',
        cr: 1,
        type: 'editorial',
        desc: 'News, blogs, education, documentaries. No ads, promotion or merchandise.',
      },
    },
    plans: [
      { id: 'starter', n: 'Starter', cr: 10, p: 99, d: '10 downloads / month' },
      { id: 'pro', n: 'Pro', cr: 50, p: 349, d: '50 downloads / month', hot: true },
      { id: 'team', n: 'Team', cr: 200, p: 999, d: '200 downloads / month, 5 seats' },
    ],
    packs: [
      { id: 'pk-5', cr: 5, p: 69 },
      { id: 'pk-25', cr: 25, p: 249 },
    ],
  },
  licenseRows: [
    { id: 'lr1', use: 'Website, blog, social media', std: '✓', ext: '✓', ed: '✓ (sirf news/info)' },
    { id: 'lr2', use: 'Online / TV advertising', std: '✓', ext: '✓', ed: '✕' },
    { id: 'lr3', use: 'Print (magazine, book, brochure)', std: '5 lakh copies tak', ext: 'Unlimited', ed: '✓ editorial context' },
    { id: 'lr4', use: 'Merchandise for resale (T-shirt, mug)', std: '✕', ext: '✓', ed: '✕' },
    { id: 'lr5', use: 'Templates, product packaging', std: '✕', ext: '✓', ed: '✕' },
    { id: 'lr6', use: 'News, documentary, education', std: '✓', ext: '✓', ed: '✓' },
    { id: 'lr7', use: 'Model / property release', std: '✓ zaroori', ext: '✓ zaroori', ed: 'Nahi hota' },
    { id: 'lr8', use: 'Image edit / manipulate', std: '✓', ext: '✓', ed: 'Sirf crop/resize' },
    { id: 'lr9', use: 'Credit line', std: 'Optional', ext: 'Optional', ed: 'Zaroori' },
    { id: 'lr10', use: 'Term', std: 'Perpetual', ext: 'Perpetual', ed: 'Perpetual' },
  ],
  faqs: [
    { id: 'fq1', q: 'Royalty-Free ka matlab free hai?', a: 'Nahi. Ek baar bahut kam minimum fees (₹19 se shuru) deni hoti hai, phir har use par alag royalty nahi deni padti.' },
    { id: 'fq2', q: 'Editorial photo ad me laga sakte hain?', a: 'Nahi. Editorial sirf news/info, blog aur documentary context ke liye hai.' },
    { id: 'fq3', q: 'License kitne samay ka hai?', a: 'Perpetual (hamesha ke liye), license ki shartein ke andar.' },
    { id: 'fq4', q: 'Invoice milega?', a: 'Haan, har order par GST invoice (CGST/SGST ya IGST) milta hai.' },
    { id: 'fq5', q: 'Contributor ko paisa kab milta hai?', a: 'Balance sirf ₹100 hone par payout request karein; UPI/bank me bheja jaata hai.' },
  ],
  pages: {
    about: {
      title: 'About SantalStock',
      body: 'SantalStock is a stock photo marketplace for the life, culture and nature of Santal country, run by BOSC (BASKI ONLINE SERVICE CENTER) from Godda, Jharkhand. We help local photographers earn from their work and help publishers, brands and educators find authentic images with affordable minimum pricing and clear licenses.',
    },
    privacy: {
      title: 'Privacy Policy',
      body: 'We collect only what we need to run your account and orders: name, verified email, billing details and order history. We never sell your data. Payments are processed securely; we do not store card numbers. You can ask us to delete your account at any time by writing to support@santalstock.in.',
    },
    refund: {
      title: 'Refund Policy',
      body: 'If you have not downloaded the full-resolution file, you can request a full refund within 7 days of purchase. Once a license is refunded, you must stop using the image. Subscription plans can be cancelled anytime; unused credits stay valid until the end of the period. Write to support@santalstock.in with your order number.',
    },
    terms: {
      title: 'SantalStock License Agreement',
      sections: [
        { id: 't1', heading: '1. Grant', content: 'SantalStock aapko (Licensee) chuni gayi image ka non-exclusive, non-transferable, perpetual, worldwide license deta hai, chune gaye license type ki shartein ke anusaar.' },
        { id: 't2', heading: '2. Royalty-Free Standard', content: 'Digital use unlimited; print 5,00,000 copies tak; advertising aur marketing allowed. Merchandise for resale aur templates allowed nahi.' },
        { id: 't3', heading: '3. Royalty-Free Extended', content: 'Standard ke sab adhikar, plus unlimited print, resale ke liye merchandise, templates aur packaging.' },
        { id: 't4', heading: '4. Editorial', content: 'Sirf editorial use: news, commentary, education, documentary. Koi commercial, advertising, promotional, endorsement ya merchandise use nahi. Credit line "Contributor / SantalStock" zaroori.' },
        { id: 't5', heading: '5. Prohibited (sab licenses)', content: 'Image ko standalone file ki tarah bechna/share karna, logo/trademark me use, apmanjanak ya gair-kanooni sandarbh, ya AI/ML model training dataset me use mana hai.' },
        { id: 't6', heading: '6. Contributor Terms & Law', content: 'Copyright contributor ke paas rehta hai. Bharat ka kanoon laagu; jurisdiction: Godda, Jharkhand.' },
      ],
    },
  },
  contact: {
    email: 'support@santalstock.in',
    location: 'Godda, Jharkhand, India',
    venture: 'A BOSC (BASKI ONLINE SERVICE CENTER) venture',
  },
  footer: {
    newsletterTitle: 'SantalStock',
    newsletterSubtitle: 'Get new photos & offers by email',
    taglineCustom: '',
    paymentMethods: ['UPI', 'RuPay', 'VISA', 'Mastercard', 'Net Banking'],
    columns: [
      {
        id: 'col1',
        heading: 'Explore',
        links: [
          { id: 'l1', label: 'Browse', href: '#/search' },
          { id: 'l2', label: 'Royalty-Free', href: '#/search?lic=rf' },
          { id: 'l3', label: 'Editorial', href: '#/search?lic=editorial' },
          { id: 'l4', label: 'Pricing', href: '#/pricing' },
          { id: 'l5', label: 'Lightbox', href: '#/lightbox' },
        ],
      },
      {
        id: 'col2',
        heading: 'Licensing',
        links: [
          { id: 'l6', label: 'License Guide', href: '#/licenses' },
          { id: 'l7', label: 'License Agreement', href: '#/terms' },
          { id: 'l8', label: 'Verify License', href: '#/verify' },
          { id: 'l9', label: 'FAQ', href: '#/faq' },
        ],
      },
      {
        id: 'col3',
        heading: 'Contributors',
        links: [
          { id: 'l10', label: 'Sell your photos', href: '#/contributor' },
          { id: 'l11', label: 'Upload', href: '#/contributor/upload' },
          { id: 'l12', label: 'Earnings', href: '#/contributor/earnings' },
          { id: 'l13', label: 'Admin', href: '#/admin' },
        ],
      },
      {
        id: 'col4',
        heading: 'Company',
        links: [
          { id: 'l14', label: 'About us', href: '#/about' },
          { id: 'l15', label: 'Contact', href: '#/contact' },
          { id: 'l16', label: 'Privacy Policy', href: '#/privacy' },
          { id: 'l17', label: 'Refund Policy', href: '#/refund' },
        ],
      },
    ],
    madeWith: 'Made with ♥ in Godda, Jharkhand, India',
    rights: 'All rights reserved.',
  },
  settings: {
    gstin: 'YOUR-GSTIN',
    customCategories: [],
  },
};

/* ================= OFFLINE SMART AI SEARCH ================= */
const AISYN: Record<string, string[]> = {
  village: ['village', 'gaon', 'gaanv', 'gav', 'गाँव', 'गांव', 'ग्राम', 'ato', 'आतो', 'gram', 'rural', 'dehat', 'देहात'],
  festival: ['festival', 'parv', 'parab', 'पर्व', 'परब', 'त्योहार', 'tyohar', 'sohrae', 'सोहराय', 'baha', 'बाहा', 'karam', 'करम', 'utsav', 'उत्सव', 'celebration', 'puja', 'पूजा'],
  forest: ['forest', 'jungle', 'jangal', 'जंगल', 'बन', 'van', 'bir', 'बिर', 'tree', 'trees', 'पेड़', 'ped', 'darẹ', 'dare', 'दारे', 'wood', 'woods'],
  nature: ['nature', 'prakriti', 'प्रकृति', 'landscape', 'scenery', 'hill', 'pahar', 'पहाड़', 'buru', 'बुरू', 'river', 'nadi', 'नदी', 'gada', 'गाडा', 'sky', 'aakash', 'sunset', 'sunrise', 'water', 'pani', 'पानी', 'dak', 'दाक्', 'mountain', 'lake', 'flower', 'phool', 'फूल', 'baha'],
  dance: ['dance', 'nach', 'naach', 'नाच', 'नृत्य', 'enec', 'एनेच्', 'music', 'gana', 'गाना', 'drum', 'tamak', 'तामाक्', 'tumdak', 'तुमदाक्', 'sereń', 'song'],
  people: ['people', 'log', 'लोग', 'hor', 'होड़', 'hoṛ', 'person', 'man', 'woman', 'aurat', 'औरत', 'admi', 'आदमी', 'child', 'bachcha', 'बच्चा', 'gidi', 'portrait', 'face', 'family', 'parivar', 'परिवार'],
  food: ['food', 'khana', 'खाना', 'jom', 'जोम', 'bhojan', 'भोजन', 'meal', 'dish', 'rice', 'chawal', 'चावल', 'daka', 'दाका', 'cook', 'kitchen', 'fruit', 'phal'],
  market: ['market', 'haat', 'haṭ', 'hat', 'हाट', 'bazar', 'bazaar', 'बाज़ार', 'बाजार', 'shop', 'dukan', 'दुकान'],
  harvest: ['harvest', 'fasal', 'फसल', 'farm', 'kheti', 'खेती', 'field', 'khet', 'खेत', 'agriculture', 'paddy', 'dhan', 'धान', 'gẹ', 'krishi'],
  travel: ['travel', 'yatra', 'यात्रा', 'trip', 'tour', 'ghumna', 'road', 'sadak', 'सड़क', 'journey', 'train', 'station'],
  architecture: ['architecture', 'building', 'imarat', 'इमारत', 'house', 'ghar', 'घर', 'orak', 'ओड़ाक्', 'oṛak', 'city', 'shahar', 'शहर', 'temple', 'mandir', 'मंदिर', 'bridge'],
  business: ['business', 'office', 'vyapar', 'व्यापार', 'work', 'kaam', 'काम', 'laptop', 'computer', 'meeting', 'startup', 'money', 'paisa'],
  culture: ['culture', 'sanskriti', 'संस्कृति', 'tradition', 'parampara', 'परंपरा', 'santal', 'santali', 'संताल', 'adivasi', 'आदिवासी', 'tribal', 'jaher', 'जाहेर', 'dress', 'saree', 'art', 'kala', 'कला'],
};
const AICAT: Record<string, string> = {
  village: 'Village', nature: 'Nature', forest: 'Nature', people: 'People', food: 'Food',
  travel: 'Travel', architecture: 'Architecture', business: 'Business', culture: 'Culture',
  festival: 'Culture', dance: 'Culture', market: 'Village', harvest: 'Village',
};
const AIW: Record<string, string[]> = {
  ed: ['editorial', 'news', 'khabar', 'खबर', 'ख़बर', 'न्यूज़', 'न्यूज', 'akhbar', 'अखबार', 'blog', 'ब्लॉग', 'documentary', 'डॉक्यूमेंट्री', 'article', 'report', 'reportage', 'patrika', 'पत्रिका', 'journalism', 'press'],
  rf: ['commercial', 'ad', 'ads', 'advert', 'advertisement', 'vigyapan', 'विज्ञापन', 'marketing', 'website', 'packaging', 'print', 'banner', 'poster', 'social', 'instagram', 'youtube', 'thumbnail', 'product', 'brand', 'royalty', 'free', 'rf', 'business use'],
  land: ['landscape', 'horizontal', 'wide', 'chauda', 'चौड़ा', 'चौड़ी', 'banner', 'cover', '16:9', 'desktop'],
  port: ['portrait', 'vertical', 'khada', 'खड़ा', 'खड़ी', 'lambi', 'लंबी', 'story', 'reel', 'mobile', 'phone', '9:16'],
  sq: ['square', 'chaukor', 'चौकोर', 'instagram post', '1:1'],
  new: ['new', 'latest', 'naya', 'nayi', 'नया', 'नई', 'नयी', 'recent', 'taza', 'ताज़ा', 'nawa', 'नावा'],
  pop: ['popular', 'trending', 'best', 'top', 'mashhoor', 'मशहूर', 'लोकप्रिय', 'famous', 'most downloaded'],
};
const AISTOP = new Set(
  'photo photos image images picture pictures pic pics tasveer tasvir तस्वीर तस्वीरें फोटो चित्र chahiye चाहिए do dikhao दिखाओ dikhaiye दिखाइए mujhe मुझे ke के ki की ka का ko को liye लिए lagit लागित् for of the a an with me में mein and aur और ya या se से par पर wala wali वाला वाली some kuch कुछ show find give need want please plz koi कोई ek एक hai है hain हैं jemon'.split(/\s+/)
);

const aiNorm = (x: string) =>
  x.toLowerCase().normalize('NFC').replace(/[\u0323\u0300-\u036f]/g, (m) => (m === '\u0323' ? '' : '')).replace(/[''`’]/g, '');

function aiLev(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let p = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1));
      p = tmp;
    }
  }
  return d[b.length];
}

function aiHit(tok: string, list: string[]) {
  const n = aiNorm(tok);
  return list.some((w) => {
    const m = aiNorm(w);
    return m === n || (n.length >= 5 && !/[\u0900-\u097f]/.test(n) && aiLev(n, m) <= 1);
  });
}

export function orientOf(a: { w: number; h: number }): 'land' | 'port' | 'sq' {
  const r = a.w / (a.h || 1);
  return r > 1.1 ? 'land' : r < 0.9 ? 'port' : 'sq';
}

export function thumbUrl(a: Asset, w = 600): string {
  if (a.prevUrl) return a.prevUrl;
  if (a.pid) {
    const h = Math.round((a.h * w) / (a.w || 1));
    return `https://picsum.photos/id/${a.pid}/${w}/${h}`;
  }
  return '';
}

export function fullAssetUrl(a: Asset, px = 0): string {
  if (a.fullUrl) return a.fullUrl;
  if (a.prevUrl) return a.prevUrl;
  if (a.pid) {
    const w = px || a.w;
    const h = Math.round((a.h * w) / (a.w || 1));
    return `https://picsum.photos/id/${a.pid}/${w}/${h}`;
  }
  return '';
}

export function aiRunSearch(raw: string, assets: Asset[], dlCountFn: (a: Asset) => number) {
  const txt = (raw || '').toLowerCase().replace(/[?!.,"“”‘’()]/g, ' ');
  const toks = txt.split(/\s+/).filter(Boolean);
  const P: { lic: string; o: string; sort: string; topics: string[]; free: string[]; oMiss?: boolean } = {
    lic: '', o: '', sort: '', topics: [], free: [],
  };
  for (const k of ['ed', 'rf']) {
    if (toks.some((tk) => aiHit(tk, AIW[k])) || AIW[k].some((w) => w.includes(' ') && txt.includes(w))) {
      P.lic = k === 'ed' ? 'editorial' : 'rf';
      break;
    }
  }
  for (const k of ['land', 'port', 'sq']) {
    if (toks.some((tk) => aiHit(tk, AIW[k]))) {
      P.o = k;
      break;
    }
  }
  for (const k of ['new', 'pop']) {
    if (toks.some((tk) => aiHit(tk, AIW[k]))) {
      P.sort = k;
      break;
    }
  }
  for (const tk of toks) {
    let hit = false;
    const isMeta = Object.values(AIW).some((l) => aiHit(tk, l));
    if (!isMeta) {
      for (const k in AISYN) {
        if (aiHit(tk, AISYN[k])) {
          if (!P.topics.includes(k)) P.topics.push(k);
          hit = true;
        }
      }
    }
    if (!hit && !isMeta && !AISTOP.has(tk) && tk.length > 2) P.free.push(tk);
  }

  let res = assets
    .map((a) => {
      const hay = aiNorm([a.title, a.cat, (a.kw || []).join(' '), a.desc || '', a.caption || '', a.place || '', a.contributor || ''].join(' '));
      let s = 0;
      for (const k of P.topics) {
        if (AICAT[k] === a.cat) s += 6;
        if (AISYN[k].some((w) => !/[\u0900-\u097f]/.test(w) && w.length > 2 && hay.includes(aiNorm(w)))) s += 4;
      }
      for (const f of P.free) {
        const n = aiNorm(f);
        if (a.id.toLowerCase() === n) s += 20;
        if (hay.includes(n)) s += 5;
        else if (n.length >= 5 && hay.split(/\s+/).some((w) => aiLev(n, w) <= 1)) s += 3;
      }
      if (!P.topics.length && !P.free.length) s = 1;
      return { a, s };
    })
    .filter((x) => x.s > 0);

  if (P.lic) res = res.filter((x) => x.a.lic === P.lic);
  if (P.o) {
    const r2 = res.filter((x) => orientOf(x.a) === P.o);
    if (r2.length) res = r2;
    else P.oMiss = true;
  }
  if (P.sort === 'new') res.sort((x, y) => (y.a.date || '').localeCompare(x.a.date || ''));
  else if (P.sort === 'pop') res.sort((x, y) => dlCountFn(y.a) - dlCountFn(x.a));
  else res.sort((x, y) => y.s - x.s);

  return { P, results: res.slice(0, 24).map((r) => r.a) };
}
