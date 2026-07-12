export function remainingPageBatches(totalItems: number, pageSize = 20, concurrency = 3): number[][] {
  const totalPages = Math.ceil(Math.max(0, totalItems) / pageSize);
  const batches: number[][] = [];
  for (let page = 2; page <= totalPages; page += concurrency) {
    batches.push(Array.from(
      { length: Math.min(concurrency, totalPages - page + 1) },
      (_, index) => page + index,
    ));
  }
  return batches;
}
