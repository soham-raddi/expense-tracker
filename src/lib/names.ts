// How a payee's name is shown and matched. The bank's name is kept; your own name wins when set.

/** What to show in lists: your name for the payee, or else the bank's. */
export function shownName(original: string | null, custom: string | null): string | null {
  const own = custom?.trim();
  return own ? own : original;
}

/** Text that keyword rules search, so a rule can match the bank's name or your name for the payee. */
export function matchText(original: string | null, custom: string | null): string | null {
  const parts = [original, custom?.trim()].filter((p): p is string => !!p);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Empty or blank input means "use the bank's name again". */
export function cleanCustomName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  return name === '' ? null : name.slice(0, 40);
}

/** A note you write on a payment. Blank means "no note". */
export function cleanNote(input: string): string | null {
  const note = input.trim().replace(/[ \t]+/g, ' ');
  return note === '' ? null : note.slice(0, 200);
}
