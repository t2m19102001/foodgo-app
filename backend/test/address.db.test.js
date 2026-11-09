// addressController truoc day khong co mot test nao (5/5 ham trang), trong khi
// no la noi co race: hai request them dia chi dau tien cung luc tao ra hai dia
// chi cung isDefault, va setDefault/delete ghi hai lan khong atomic.
import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  hasDb, dbMissingReason, getDb, migrate, resetDb, closeDb, makeResponse,
  makeUser, countRows,
} from "./helpers/db.mjs";

const skip = hasDb ? false : dbMissingReason;
let address;
let db;

before(async () => {
  if (!hasDb) return;
  db = await getDb();
  await migrate();
  address = await import("../controllers/addressController.js");
});
beforeEach(async () => { if (hasDb) await resetDb(); });
after(async () => { if (hasDb) await closeDb(); });

const body = (extra = {}) => ({
  fullName: "Tran Minh Man", phone: "0900000001", address: "1 Duong ABC", ...extra,
});

const defaultCount = (userId) =>
  countRows("addresses", "WHERE user_id = $1 AND is_default", [userId]);

test("dia chi dau tien tu dong thanh mac dinh", { skip }, async () => {
  const userId = await makeUser();
  const response = makeResponse();
  await address.addAddress({ userId, body: body() }, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.address.isDefault, true);
  assert.equal(await defaultCount(userId), 1);
});

test("hai request them dia chi dau tien SONG SONG chi tao mot mac dinh", { skip }, async () => {
  const userId = await makeUser();

  const responses = [makeResponse(), makeResponse(), makeResponse()];
  await Promise.all(responses.map((response, i) =>
    address.addAddress({ userId, body: body({ address: `Dia chi ${i}` }) }, response)));

  assert.equal(await countRows("addresses", "WHERE user_id = $1", [userId]), 3);
  // Ban Mongo dem roi quyet dinh ngoai transaction nen tao ra hai dia chi cung
  // isDefault; gio hang users bi khoa nen chi mot cai thang.
  assert.equal(await defaultCount(userId), 1, "chi duoc dung mot dia chi mac dinh");
});

test("them dia chi voi isDefault = true thi go mac dinh cu", { skip }, async () => {
  const userId = await makeUser();
  const first = makeResponse();
  await address.addAddress({ userId, body: body({ address: "Cu" }) }, first);

  const second = makeResponse();
  await address.addAddress({ userId, body: body({ address: "Moi", isDefault: true }) }, second);

  assert.equal(second.body.address.isDefault, true);
  assert.equal(await defaultCount(userId), 1);
  const { rows } = await db.query(
    "SELECT address FROM addresses WHERE user_id = $1 AND is_default", [userId]);
  assert.equal(rows[0].address, "Moi");
});

test("validate thieu field va field qua dai", { skip }, async () => {
  const userId = await makeUser();
  for (const bad of [
    {}, { fullName: "A" }, body({ fullName: "" }),
    body({ fullName: "x".repeat(101) }),
    body({ phone: "9".repeat(31) }),
    body({ address: "x".repeat(301) }),
    body({ note: "x".repeat(501) }),
  ]) {
    const response = makeResponse();
    await address.addAddress({ userId, body: bad }, response);
    assert.equal(response.statusCode, 400, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(await countRows("addresses"), 0);
});

test("danh sach dia chi: mac dinh len dau, chi cua minh", { skip }, async () => {
  const me = await makeUser({ email: "toi@test.local" });
  const other = await makeUser({ email: "nguoikhac@test.local" });

  await address.addAddress({ userId: me, body: body({ address: "A" }) }, makeResponse());
  await address.addAddress({ userId: me, body: body({ address: "B" }) }, makeResponse());
  await address.addAddress({ userId: me, body: body({ address: "C", isDefault: true }) }, makeResponse());
  await address.addAddress({ userId: other, body: body({ address: "Cua nguoi khac" }) }, makeResponse());

  const response = makeResponse();
  await address.getMyAddresses({ userId: me }, response);
  assert.equal(response.body.addresses.length, 3, "khong thay dia chi nguoi khac");
  assert.equal(response.body.addresses[0].address, "C", "dia chi mac dinh phai len dau");
  assert.equal(response.body.addresses[0].isDefault, true);
});

test("nguoi khac khong sua / khong dat mac dinh / khong xoa duoc dia chi cua toi", { skip }, async () => {
  const owner = await makeUser({ email: "chu@test.local" });
  const outsider = await makeUser({ email: "nguoila@test.local" });
  const created = makeResponse();
  await address.addAddress({ userId: owner, body: body() }, created);
  const id = created.body.address._id;

  for (const [name, call] of [
    ["sua", () => address.updateAddress({ userId: outsider, params: { id }, body: body({ address: "Doi" }) }, makeResponse())],
    ["dat mac dinh", () => address.setDefaultAddress({ userId: outsider, params: { id } }, makeResponse())],
    ["xoa", () => address.deleteAddress({ userId: outsider, params: { id } }, makeResponse())],
  ]) {
    const response = makeResponse();
    const handler = {
      "sua": () => address.updateAddress({ userId: outsider, params: { id }, body: body({ address: "Doi" }) }, response),
      "dat mac dinh": () => address.setDefaultAddress({ userId: outsider, params: { id } }, response),
      "xoa": () => address.deleteAddress({ userId: outsider, params: { id } }, response),
    }[name];
    await handler();
    assert.equal(response.statusCode, 403, name);
  }

  assert.equal(await countRows("addresses"), 1, "dia chi khong bi xoa");
  const { rows } = await db.query("SELECT address FROM addresses WHERE id = $1", [id]);
  assert.equal(rows[0].address, "1 Duong ABC", "dia chi khong bi sua");
});

test("dat mac dinh: luon con dung mot mac dinh, ke ca khi doi qua lai", { skip }, async () => {
  const userId = await makeUser();
  const a = makeResponse();
  await address.addAddress({ userId, body: body({ address: "A" }) }, a);
  const b = makeResponse();
  await address.addAddress({ userId, body: body({ address: "B" }) }, b);

  for (const target of [b.body.address._id, a.body.address._id, b.body.address._id]) {
    const response = makeResponse();
    await address.setDefaultAddress({ userId, params: { id: target } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(await defaultCount(userId), 1);
    const { rows } = await db.query(
      "SELECT id FROM addresses WHERE user_id = $1 AND is_default", [userId]);
    assert.equal(rows[0].id, target);
  }
});

test("xoa dia chi mac dinh thi tu dong dua dia chi khac len lam mac dinh", { skip }, async () => {
  const userId = await makeUser();
  const a = makeResponse();
  await address.addAddress({ userId, body: body({ address: "A" }) }, a);
  const b = makeResponse();
  await address.addAddress({ userId, body: body({ address: "B" }) }, b);
  // A dang la mac dinh (dia chi dau tien)
  assert.equal(a.body.address.isDefault, true);

  const response = makeResponse();
  await address.deleteAddress({ userId, params: { id: a.body.address._id } }, response);
  assert.equal(response.statusCode, 200);

  // Ban Mongo xoa roi moi promote bang hai lenh ghi roi nhau: crash giua hai
  // lenh la user khong con dia chi mac dinh nao.
  assert.equal(await defaultCount(userId), 1, "phai con dung mot dia chi mac dinh");
  const { rows } = await db.query(
    "SELECT address FROM addresses WHERE user_id = $1 AND is_default", [userId]);
  assert.equal(rows[0].address, "B");
});

test("xoa dia chi cuoi cung thi khong con dia chi nao", { skip }, async () => {
  const userId = await makeUser();
  const only = makeResponse();
  await address.addAddress({ userId, body: body() }, only);

  const response = makeResponse();
  await address.deleteAddress({ userId, params: { id: only.body.address._id } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(await countRows("addresses", "WHERE user_id = $1", [userId]), 0);
});

test("id sai dinh dang tra 400 chu khong phai 500", { skip }, async () => {
  const userId = await makeUser();
  for (const handler of [address.updateAddress, address.setDefaultAddress, address.deleteAddress]) {
    const response = makeResponse();
    await handler({ userId, params: { id: "khong-phai-uuid" }, body: body() }, response);
    assert.equal(response.statusCode, 400);
  }
});

test("dia chi tra ve dung hinh JSON ma app cho doi", { skip }, async () => {
  const userId = await makeUser();
  const response = makeResponse();
  await address.addAddress({ userId, body: body({ note: "Giao gio trua" }) }, response);

  const got = response.body.address;
  // App doc SavedAddress{_id, fullName, phone, address, note, isDefault}
  assert.ok(got._id);
  assert.equal(got.fullName, "Tran Minh Man");
  assert.equal(got.phone, "0900000001");
  assert.equal(got.note, "Giao gio trua");
  assert.equal(got.isDefault, true);
});

test("addAddress luu dung lat/lng khi chon tren ban do, null khi khong chon", { skip }, async () => {
  const userId = await makeUser();

  const withCoords = makeResponse();
  await address.addAddress({ userId, body: body({ lat: 10.7769, lng: 106.7009 }) }, withCoords);
  assert.equal(withCoords.statusCode, 201);
  assert.equal(withCoords.body.address.lat, 10.7769);
  assert.equal(withCoords.body.address.lng, 106.7009);

  const withoutCoords = makeResponse();
  await address.addAddress({ userId, body: body({ address: "2 Duong XYZ" }) }, withoutCoords);
  assert.equal(withoutCoords.body.address.lat, null);
  assert.equal(withoutCoords.body.address.lng, null);
});

test("addAddress/updateAddress tu choi lat/lng ngoai pham vi toa do thuc", { skip }, async () => {
  const userId = await makeUser();

  for (const bad of [{ lat: 91 }, { lat: -91 }, { lng: 181 }, { lng: -181 }]) {
    const response = makeResponse();
    await address.addAddress({ userId, body: body(bad) }, response);
    assert.equal(response.statusCode, 400, JSON.stringify(bad));
  }

  const created = makeResponse();
  await address.addAddress({ userId, body: body() }, created);
  const addressId = created.body.address._id;

  const updateResponse = makeResponse();
  await address.updateAddress(
    { userId, params: { id: addressId }, body: body({ lat: 999 }) }, updateResponse);
  assert.equal(updateResponse.statusCode, 400);
});

test("updateAddress cap nhat dung lat/lng moi", { skip }, async () => {
  const userId = await makeUser();
  const created = makeResponse();
  await address.addAddress({ userId, body: body({ lat: 10.7, lng: 106.7 }) }, created);
  const addressId = created.body.address._id;

  const updated = makeResponse();
  await address.updateAddress(
    { userId, params: { id: addressId }, body: body({ address: "Dia chi moi", lat: 21.0, lng: 105.8 }) },
    updated);
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.address.lat, 21.0);
  assert.equal(updated.body.address.lng, 105.8);
});
