// Keyword matching used by rules.

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Case-insensitive. Keywords of 3 letters or fewer ("vi", "ola", "jio") must match a whole word,
 * otherwise "vi" would match "Vivek". Longer keywords match anywhere, so "swiggy" also matches
 * "SWIGGYINSTAMART" and "swiggy@icici".
 */
export function keywordMatches(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const k = keyword.trim().toLowerCase();
  if (k === '') {
    return false;
  }
  if (k.length > 3) {
    return t.includes(k);
  }
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(k)}($|[^a-z0-9])`).test(t);
}
