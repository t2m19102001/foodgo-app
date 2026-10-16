// Tran cung khi client khong gui page/limit: giu nguyen hanh vi cu cho app Android nhung khong con query khong gioi han
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

export const findWithOptionalPagination = async (model, filter, pagination) => {
  const limit = pagination.paginated ? pagination.limit : MAX_ITEMS_WITHOUT_PAGINATION;
  const skip = pagination.paginated ? pagination.skip : 0;

  const [items, totalItems] = await Promise.all([
    model.find(filter).sort({ _id: 1 }).skip(skip).limit(limit),
    model.countDocuments(filter),
  ]);

  return {
    items,
    meta: {
      currentPage: pagination.paginated ? pagination.page : 1,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      totalItems,
      limit,
    },
  };
};
