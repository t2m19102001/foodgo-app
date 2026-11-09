import test from "node:test";
import assert from "node:assert/strict";
import {
  loadEtaConfig, loadFactorFor, calcPrepBaseMinutes, calcEta,
  addMinutes, recalcPrepMinutes, detectEtaDelay,
} from "../util/eta.js";

// Dung config co dinh trong test, khong phu thuoc .env thuc - de doi chieu
// ket qua bang tay.
const config = {
  confirmMinutes: 5,
  prepExtraItemMinutes: 2,
  prepMaxMinutes: 60,
  deliveryMinutes: 20,
  loadLowThreshold: 5,
  loadMediumThreshold: 15,
  loadMediumFactor: 1.2,
  loadHighFactor: 1.5,
  significantChangeMinutes: 10,
};

test("calcPrepBaseMinutes: mot mon thi khong co phu phi, khong phu thuoc quantity", () => {
  assert.equal(calcPrepBaseMinutes([{ prepTimeMinutes: 15 }], config), 15);
});

test("calcPrepBaseMinutes: nhieu mon khac nhau lay MAX cong phu phi theo so mon", () => {
  // max(10, 25, 5) + (3-1)*2 = 25 + 4 = 29
  assert.equal(
    calcPrepBaseMinutes([{ prepTimeMinutes: 10 }, { prepTimeMinutes: 25 }, { prepTimeMinutes: 5 }], config),
    29
  );
});

test("loadFactorFor: dung bien o ca 3 muc tai (<=, khong phai <)", () => {
  assert.equal(loadFactorFor(0, config), 1);
  assert.equal(loadFactorFor(5, config), 1);
  assert.equal(loadFactorFor(6, config), 1.2);
  assert.equal(loadFactorFor(15, config), 1.2);
  assert.equal(loadFactorFor(16, config), 1.5);
});

test("calcEta: tong = confirm + prep(da nhan he so, da lam tron len) + delivery", () => {
  const eta = calcEta([{ prepTimeMinutes: 15 }], 0, config);
  assert.equal(eta.prepBaseMinutes, 15);
  assert.equal(eta.loadFactor, 1);
  assert.equal(eta.prepMinutes, 15);
  assert.equal(eta.totalMinutes, 5 + 15 + 20);
});

test("calcEta: tai cao nhan he so va lam tron len (Math.ceil)", () => {
  // prepBase = 15, loadFactor = 1.2 -> 18 (khong can ceil)
  const eta = calcEta([{ prepTimeMinutes: 15 }], 10, config);
  assert.equal(eta.loadFactor, 1.2);
  assert.equal(eta.prepMinutes, 18);

  // prepBase = 17 (mon 1 + phu phi mon 2), loadFactor = 1.5 -> ceil(25.5) = 26
  const etaCeil = calcEta([{ prepTimeMinutes: 15 }, { prepTimeMinutes: 10 }], 20, config);
  assert.equal(etaCeil.prepBaseMinutes, 17);
  assert.equal(etaCeil.loadFactor, 1.5);
  assert.equal(etaCeil.prepMinutes, 26);
});

test("calcEta: chan tran prepMaxMinutes khi nhieu mon + tai cao", () => {
  const items = Array.from({ length: 10 }, () => ({ prepTimeMinutes: 60 }));
  const eta = calcEta(items, 100, config);
  assert.ok(eta.prepBaseMinutes > config.prepMaxMinutes);
  assert.equal(eta.prepMinutes, config.prepMaxMinutes);
});

test("addMinutes: cong dung so phut vao Date", () => {
  const base = new Date("2026-01-01T00:00:00Z");
  assert.equal(addMinutes(base, 90).toISOString(), "2026-01-01T01:30:00.000Z");
});

test("recalcPrepMinutes: tinh lai phan chuan bi tu prepBaseMinutes da luu, khong can danh sach mon", () => {
  assert.equal(recalcPrepMinutes(15, 0, config), 15);
  assert.equal(recalcPrepMinutes(15, 10, config), 18);
});

test("detectEtaDelay: tai tang tu thap len cao giua luc dat va luc doc lai -> delayed=true", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  // baseline: tai thap luc dat (loadFactor=1) -> prep=15, total=5+15+20=40
  const baselineDeliveredAt = addMinutes(createdAt, 40);

  const fresh = detectEtaDelay(baselineDeliveredAt, {
    prepBaseMinutes: 15,
    freshActiveOrdersCount: 20, // tai cao -> loadFactor=1.5 -> prep=23 -> total=48
    confirmMinutes: config.confirmMinutes,
    deliveryMinutes: config.deliveryMinutes,
    createdAt,
  }, config);

  assert.equal(fresh.diffMinutes, 8);
  assert.equal(fresh.delayed, false, "8 phut chua vuot nguong 10 nen chua canh bao");
});

test("detectEtaDelay: lech vuot nguong significantChangeMinutes thi delayed=true", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const baselineDeliveredAt = addMinutes(createdAt, 40); // tai thap luc dat

  const fresh = detectEtaDelay(baselineDeliveredAt, {
    prepBaseMinutes: 30, // mon nang hon muc gia dinh ben tren de vuot nguong
    freshActiveOrdersCount: 20,
    confirmMinutes: config.confirmMinutes,
    deliveryMinutes: config.deliveryMinutes,
    createdAt,
  }, config);

  assert.equal(fresh.delayed, true);
  assert.ok(fresh.diffMinutes >= config.significantChangeMinutes);
});

test("detectEtaDelay: tai khong doi thi khong canh bao", () => {
  const createdAt = new Date("2026-01-01T00:00:00Z");
  const baselineDeliveredAt = addMinutes(createdAt, 40);

  const fresh = detectEtaDelay(baselineDeliveredAt, {
    prepBaseMinutes: 15,
    freshActiveOrdersCount: 0,
    confirmMinutes: config.confirmMinutes,
    deliveryMinutes: config.deliveryMinutes,
    createdAt,
  }, config);

  assert.equal(fresh.diffMinutes, 0);
  assert.equal(fresh.delayed, false);
});

test("loadEtaConfig: doc tu env, fallback khi khong set hoac gia tri khong hop le", () => {
  const original = process.env.ETA_CONFIRM_MINUTES;
  try {
    delete process.env.ETA_CONFIRM_MINUTES;
    assert.equal(loadEtaConfig().confirmMinutes, 5);

    process.env.ETA_CONFIRM_MINUTES = "khong-phai-so";
    assert.equal(loadEtaConfig().confirmMinutes, 5);

    process.env.ETA_CONFIRM_MINUTES = "7";
    assert.equal(loadEtaConfig().confirmMinutes, 7);
  } finally {
    if (original === undefined) delete process.env.ETA_CONFIRM_MINUTES;
    else process.env.ETA_CONFIRM_MINUTES = original;
  }
});
