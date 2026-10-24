// Khoa chinh la uuid thay cho ObjectId. Dung de chan id sai ngay o tang
// controller: ban Mongo nem CastError roi roi vao catch nen tra 500, khien
// client khong phan biet duoc "id sai" voi "server chet".
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value) => typeof value === "string" && UUID_PATTERN.test(value);

export default { isUuid };
