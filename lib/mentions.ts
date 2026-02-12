export interface MentionMatch {
  /** Canonical name from the provided candidates list. */
  name: string
  /** Index of the leading '@' in the source text. */
  start: number
  /** Index immediately after the end of the mention name (does not include trailing whitespace/punctuation). */
  end: number
}

function isWhitespace(ch: string) {
  return /\s/.test(ch)
}
function isMentionBoundaryBefore(ch: string) {
  // Start-of-string always counts as a boundary.
  if (!ch) return true
  // Whitespace counts as a boundary.
  if (isWhitespace(ch)) return true
  // Allow common delimiters and markdown markers (e.g. "**@name**", "(@name)", "\"@name\"").
  // Keep this list intentionally small to avoid surprising matches in places like inline code or URLs.
  return /[()[\]{}<>"'.,:;!?*_~]/.test(ch)
}

/**
 * Finds @mentions for the provided candidate names, including names with spaces.
 *
 * Matching rules:
 * - Mention must start at string start or be preceded by a boundary character (whitespace/punctuation).
 * - Match is case-insensitive.
 * - Mentions are matched against known names (not a generic "@token" regex).
 * - The character after the name must be a boundary (end/whitespace/punctuation),
 *   not a word-ish continuation char ([A-Za-z0-9_-]) to avoid prefix matches
 *   like "@Ann" matching "@Ann-Marie".
 */
export function findMentionMatches(text: string, candidateNames: string[]): MentionMatch[] {
  if (!text || candidateNames.length === 0) return []

  // De-dupe candidates case-insensitively and prefer longer names first.
  const candidates = Array.from(
    new Map(
      candidateNames
        .map((n) => n.trim())
        .filter((n) => n.length > 0)
        .map((name) => [name.toLowerCase(), name] as const)
    ).values()
  )
    .map((name) => ({ name, lower: name.toLowerCase() }))
    .sort((a, b) => b.lower.length - a.lower.length)

  if (candidates.length === 0) return []

  const lowerText = text.toLowerCase()
  const matches: MentionMatch[] = []

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "@") continue

    const prev = i > 0 ? text[i - 1] : ""
    if (!isMentionBoundaryBefore(prev)) continue

    const nameStart = i + 1
    for (const cand of candidates) {
      if (!lowerText.startsWith(cand.lower, nameStart)) continue

      const afterIndex = nameStart + cand.lower.length
      const afterChar = text[afterIndex]

      // If the next character continues an identifier-ish token, treat as no match.
      if (afterChar !== undefined && /[A-Za-z0-9_-]/.test(afterChar)) continue

      matches.push({ name: cand.name, start: i, end: afterIndex })
      i = afterIndex - 1
      break
    }
  }

  return matches
}

export function extractMentionedNames(text: string, candidateNames: string[]): string[] {
  const matches = findMentionMatches(text, candidateNames)
  const seen = new Set<string>()
  const result: string[] = []

  for (const m of matches) {
    const key = m.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(m.name)
  }

  return result
}

