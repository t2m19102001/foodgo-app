// Phan tich y dinh tim kiem tu cau tieng Viet tu nhien thanh bo loc co cau
// truc (AI Search, module 4 trong spec). Rule-based TRUOC (re, nhanh, mien
// phi), chi bao needsLlmFallback=true de controller goi LLM lam fallback
// khi cau con lai qua phuc tap sau khi da tru cac phan rule nhan dien duoc.
//
// Ham nay THUAN: khong goi DB/API, test duoc bang node --test khong can
// TEST_DATABASE_URL (xem test/searchIntent.test.js).

// Mo phong vn_unaccent ben Postgres (foodController.js) de so khop category
// va nhan dien tu khoa khong phan biet dau/hoa-thuong.
const stripAccents = (text) => text
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[đĐ]/g, (m) => (m === "Đ" ? "D" : "d"));

const normalize = (text) => stripAccents(String(text || "")).toLowerCase().trim();

const PRICE_UNIT = { k: 1000, nghin: 1000, ngan: 1000, dong: 1, d: 1 };

// So + don vi tien te. So <1000 va KHONG co don vi ro rang duoc hieu la "k"
// (nghin dong) - cach noi gia mon an thong thuong cua nguoi Viet ("50" nghia
// la 50 nghin, khong ai noi mon 50 dong).
const toAmount = (numStr, unit) => {
  const digits = numStr.replace(/[.,]/g, "");
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (unit) return n * (PRICE_UNIT[unit] || 1);
  return n < 1000 ? n * 1000 : n;
};

const MAX_PRICE_RE = /(duoi|khong qua|toi da|re hon)\s*([\d.,]+)\s*(k|nghin|ngan|dong|d)?/;
const MIN_PRICE_RE = /(tren|hon|toi thieu|dat hon)\s*([\d.,]+)\s*(k|nghin|ngan|dong|d)?/;

// Cac tieu chi spec co liet ke nhung he thong CHUA co du lieu (khong Maps,
// khong khuyen mai, khong gio mo cua) - nhan dien de tra loi minh bach thay
// vi am tham bo qua (chong "bia" ket qua).
const UNSUPPORTED_PATTERNS = [
  { key: "promotion", re: /giam gia|khuyen mai|uu dai|sale|flash sale/ },
  { key: "distance", re: /gan toi|gan day|gan vi tri|khoang cach|gan nha/ },
  { key: "openStatus", re: /dang mo cua|con mo khong|gio mo cua|gio hoat dong/ },
  { key: "deliveryTime", re: /giao nhanh|giao nhanh nhat|giao trong bao lau|thoi gian giao hang/ },
  { key: "groupSize", re: /cho\s*\d+\s*nguoi|an\s*\d+\s*nguoi|danh cho \d+/ },
];

const MIN_RATING_RE = /danh gia cao|ngon|duoc yeu thich|rating cao/;

// Tu dem/noi tu khong mang nghia tim kiem - PHAI loai truoc khi dung remainder
// lam keyword, neu khong cau nhu "Co mon nao duoi 50k khong" se de lai keyword
// "co mon nao khong" va LIKE se khong khop bat ky mon nao (da bat qua bang
// test DB thuc te - khong phai suy doan).
//
// Han che da biet: "khong" cung bi loai nen phu dinh nhu "khong cay" se bi
// hieu nham thanh "cay". Chap nhan duoc o rule-based v1 vi khi do remainder
// thuong con du dai de needsLlmFallback=true, va luc goi LLM thi dung
// CAU GOC (con nguyen "khong cay"), khong dung remainder da loc.
const STOPWORDS = new Set([
  "toi", "minh", "ban", "muon", "can", "thich", "an", "uong", "mon", "do", "gi",
  "nao", "khong", "co", "la", "va", "thi", "ma", "nhe", "thoi", "oi", "a", "roi",
  "day", "nay", "kia", "duoc", "hay", "voi", "cho", "tim", "kiem", "quan", "dang",
  "con", "hoac", "neu", "de", "tu", "tren", "trong", "ngoai", "o", "tai", "theo",
  "nen", "chu", "khi", "sau", "truoc", "mot", "nhung", "rat", "qua", "hon", "sao",
  "cac", "nguoi", "viec", "cai", "lam",
]);

const meaningfulWords = (text) => text
  .split(/\s+/)
  .map((w) => w.replace(/[^a-z0-9]/g, ""))
  .filter((w) => w.length > 0 && !STOPWORDS.has(w));

// Nguong so TU CO NGHIA (sau khi loai stopword) con lai - vuot nguong nay
// nghia la cau con nhieu ngu nghia tu do, nen nho LLM dien giai lai thay
// vi LIKE nguyen keyword (de qua, co the khong khop gi).
const FALLBACK_WORD_THRESHOLD = 4;

export const parseSearchIntent = (text, categoryNames = []) => {
  const original = String(text || "").trim();
  let remainder = normalize(original);
  const unsupported = [];

  let maxPrice;
  const maxMatch = remainder.match(MAX_PRICE_RE);
  if (maxMatch) {
    maxPrice = toAmount(maxMatch[2], maxMatch[3]);
    remainder = remainder.replace(maxMatch[0], " ");
  }

  let minPrice;
  const minMatch = remainder.match(MIN_PRICE_RE);
  if (minMatch) {
    minPrice = toAmount(minMatch[2], minMatch[3]);
    remainder = remainder.replace(minMatch[0], " ");
  }

  for (const { key, re } of UNSUPPORTED_PATTERNS) {
    const match = remainder.match(re);
    if (match) {
      unsupported.push(key);
      remainder = remainder.replace(match[0], " ");
    }
  }

  let minRating;
  const ratingMatch = remainder.match(MIN_RATING_RE);
  if (ratingMatch) {
    minRating = 4;
    remainder = remainder.replace(ratingMatch[0], " ");
  }

  let categoryName;
  for (const name of categoryNames) {
    const normalizedName = normalize(name);
    if (normalizedName && remainder.includes(normalizedName)) {
      categoryName = name;
      remainder = remainder.replace(normalizedName, " ");
      break;
    }
  }

  const significantWords = meaningfulWords(remainder);
  const keyword = significantWords.length > 0 ? significantWords.join(" ") : undefined;
  const needsLlmFallback = significantWords.length > FALLBACK_WORD_THRESHOLD;

  return { keyword, minPrice, maxPrice, categoryName, minRating, unsupported, needsLlmFallback };
};
