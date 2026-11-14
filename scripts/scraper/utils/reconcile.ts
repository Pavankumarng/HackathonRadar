/**
 * Return URLs that were previously active but are absent from a verified,
 * complete source snapshot. This helper is intentionally pure so the
 * reconciliation rule can be regression-tested without a database.
 */
export function getStaleSourceUrls(
  existingActiveUrls: readonly string[],
  currentActiveUrls: ReadonlySet<string>,
): string[] {
  return existingActiveUrls.filter((url) => !currentActiveUrls.has(url));
}
