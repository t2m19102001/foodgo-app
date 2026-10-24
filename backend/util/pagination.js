// Tran cung khi client khong gui page/limit: giu nguyen hanh vi cu cho app
// Android nhung khong con query khong gioi han
const MAX_ITEMS_WITHOUT_PAGINATION = 200;

export const parseOptionalPagination = (query = {}) => {
  if (query.page === undefined && query.limit === undefined) {
    return { paginated: false };
  }
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    return { invalid: true };
  }
  return { paginated: true, page, limit, skip: (page - 1) * limit };
};

export const resolveLimits = (pagination) => ({
  limit: pagination.paginated ? pagination.limit : MAX_ITEMS_WITHOUT_PAGINATION,
  skip: pagination.paginated ? pagination.skip : 0,
});

export const buildMeta = (totalItems, pagination, limit) => ({
  currentPage: pagination.paginated ? pagination.page : 1,
  totalPages: Math.max(1, Math.ceil(totalItems / limit)),
  totalItems,
  limit,
});

// Phan trang rieng cho don hang: ban Mongo dung mac dinh/tran khac han
// (limit 10, toi da 50) va tra key "totalOrders" thay vi "totalItems".
// Giu nguyen de khong vo hop dong voi app va voi 88 check e2e.
export const parseOrderPagination = (query = {}) => {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 10 : Number(query.limit);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000
      || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) return null;
  return { page, limit, skip: (page - 1) * limit };
};
