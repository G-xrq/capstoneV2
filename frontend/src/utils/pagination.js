/**
 * Smart Pagination Range Generator
 * Generates an array of at most maxVisible (default 7) page items with clean ellipsis indicators.
 * Example outputs for totalPages = 17:
 *   Page 1:  [1, 2, 3, 4, 5, '...', 17]
 *   Page 5:  [1, '...', 4, 5, 6, '...', 17]
 *   Page 16: [1, '...', 13, 14, 15, 16, 17]
 */
export function getPaginationItems(currentPage, totalPages, maxVisible = 7) {
  const current = Math.max(1, Math.min(Number(currentPage) || 1, totalPages || 1));
  const total = Math.max(1, Number(totalPages) || 1);

  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  // Near the beginning: show first 5, ellipsis, and last page
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }

  // Near the end: show first page, ellipsis, and last 5 pages
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }

  // Middle range: show first page, ellipsis, current - 1, current, current + 1, ellipsis, last page
  return [1, '...', current - 1, current, current + 1, '...', total];
}
