export function parsePagination(params: { page?: string; limit?: string }) {
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '25', 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
