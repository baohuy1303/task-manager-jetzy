const encodeCursor = (data) => {
  return Buffer.from(JSON.stringify(data)).toString('base64');
};

const decodeCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const data = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
    return data;
  } catch (error) {
    return null;
  }
};

const buildPaginationResponse = (data, limit, getCursorData) => {
  const hasMore = data.length > limit;
  const pageData = hasMore ? data.slice(0, limit) : data;
  
  let nextCursor = null;
  if (hasMore) {
    const lastItem = pageData[pageData.length - 1];
    nextCursor = encodeCursor(getCursorData(lastItem));
  }

  return {
    success: true,
    count: pageData.length,
    data: pageData,
    meta: {
      has_more: hasMore,
      next_cursor: nextCursor
    }
  };
};

module.exports = {
  encodeCursor,
  decodeCursor,
  buildPaginationResponse
};
