// Loi nghiep vu nem ra tu TRONG transaction.
//
// Quan trong: trong withTransaction, `return` mot object loi se COMMIT
// transaction - moi thay doi truoc do van duoc ghi. Vi du don hang: ta INSERT
// don truoc de chiem khoa idempotency roi moi tru ton kho, nen neu het hang ma
// chi return thi don mo coi van nam lai trong DB. Phai THROW de ROLLBACK.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

// Tra 400 kem thong diep tu util/validate.js. Gom lai mot cho de hinh dang
// body loi ({ success, message }) chi duoc viet o mot noi.
export const badRequest = (res, message) => res.status(400).json({ success: false, message });

// Dung o cuoi moi catch cua controller: neu la loi nghiep vu thi tra dung ma,
// con lai moi la 500 that.
export const sendHttpError = (res, error, fallbackMessage, logFn) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  logFn(error);
  return res.status(500).json({ success: false, message: fallbackMessage });
};

export default { HttpError, badRequest, sendHttpError };
