// Tinh Smart ETA rule-based (KHONG ML, KHONG GPS). Cong thuc:
//   ETA_tong = T_xac_nhan + T_chuan_bi + T_giao_hang
// T_giao_hang la MOT hang so trung binh (gop ca cho tai xe) vi he thong chua
// co GPS/khoang cach thuc - xem migration 006.
//
// Module nay thuan (khong doc DB, khong req/res) de test duoc bang
// `node --test` khong can TEST_DATABASE_URL - xem test/eta.test.js.

const intFromEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};
const floatFromEnv = (name, fallback) => {
  const value = Number.parseFloat(process.env[name] || "");
  return Number.isFinite(value) && value >= 1 ? value : fallback;
};

export const loadEtaConfig = () => ({
  confirmMinutes: intFromEnv("ETA_CONFIRM_MINUTES", 5),
  prepExtraItemMinutes: intFromEnv("ETA_PREP_EXTRA_ITEM_MINUTES", 2),
  prepMaxMinutes: intFromEnv("ETA_PREP_MAX_MINUTES", 60),
  deliveryMinutes: intFromEnv("ETA_DELIVERY_MINUTES", 20),
  loadLowThreshold: intFromEnv("ETA_LOAD_LOW_THRESHOLD", 5),
  loadMediumThreshold: intFromEnv("ETA_LOAD_MEDIUM_THRESHOLD", 15),
  loadMediumFactor: floatFromEnv("ETA_LOAD_MEDIUM_FACTOR", 1.2),
  loadHighFactor: floatFromEnv("ETA_LOAD_HIGH_FACTOR", 1.5),
  significantChangeMinutes: intFromEnv("ETA_SIGNIFICANT_CHANGE_MINUTES", 10),
});

// So don dang pending/confirmed cung luc -> he so tre do dong don
export const loadFactorFor = (activeOrdersCount, config) => {
  if (activeOrdersCount <= config.loadLowThreshold) return 1;
  if (activeOrdersCount <= config.loadMediumThreshold) return config.loadMediumFactor;
  return config.loadHighFactor;
};

// items: [{ prepTimeMinutes }] - MOI dong la mot MON KHAC NHAU trong don (da
// gop so luong trung mon o controller). Tra ve phan "chuan bi" TRUOC khi
// nhan he so tai - luu rieng lam prep_base_minutes de tinh lai sau.
export const calcPrepBaseMinutes = (items, config) => {
  const maxPrep = Math.max(...items.map((item) => item.prepTimeMinutes));
  const extra = (items.length - 1) * config.prepExtraItemMinutes;
  return maxPrep + extra;
};

export const calcEta = (items, activeOrdersCount, config = loadEtaConfig()) => {
  const prepBaseMinutes = calcPrepBaseMinutes(items, config);
  const loadFactor = loadFactorFor(activeOrdersCount, config);
  const prepMinutes = Math.min(Math.ceil(prepBaseMinutes * loadFactor), config.prepMaxMinutes);
  const confirmMinutes = config.confirmMinutes;
  const deliveryMinutes = config.deliveryMinutes;
  return {
    distinctItemsCount: items.length,
    activeOrdersCount,
    prepBaseMinutes,
    loadFactor,
    confirmMinutes,
    prepMinutes,
    deliveryMinutes,
    totalMinutes: confirmMinutes + prepMinutes + deliveryMinutes,
  };
};

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60000);

// Tinh lai PHAN CHUAN BI voi tai HIEN TAI tu prepBaseMinutes da luu (khong
// can doc lai bang foods). Dung khi don con 'pending' de phat hien do lech.
export const recalcPrepMinutes = (prepBaseMinutes, freshActiveOrdersCount, config = loadEtaConfig()) => {
  const loadFactor = loadFactorFor(freshActiveOrdersCount, config);
  return Math.min(Math.ceil(prepBaseMinutes * loadFactor), config.prepMaxMinutes);
};

// So sanh moc "du kien giao xong" GOC (luu luc dat hang) voi moc tinh lai tu
// tai HIEN TAI. diffMinutes > 0 nghia la dang CHAM hon du kien ban dau.
export const detectEtaDelay = (
  baselineDeliveredAt,
  { prepBaseMinutes, freshActiveOrdersCount, confirmMinutes, deliveryMinutes, createdAt },
  config = loadEtaConfig()
) => {
  const freshPrepMinutes = recalcPrepMinutes(prepBaseMinutes, freshActiveOrdersCount, config);
  const freshTotalMinutes = confirmMinutes + freshPrepMinutes + deliveryMinutes;
  const freshDeliveredAt = addMinutes(new Date(createdAt), freshTotalMinutes);
  const diffMinutes = Math.round(
    (freshDeliveredAt.getTime() - new Date(baselineDeliveredAt).getTime()) / 60000
  );
  return { delayed: diffMinutes >= config.significantChangeMinutes, diffMinutes };
};
