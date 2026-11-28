/**
 * Flexible, typo-tolerant & format-agnostic search utility for material catalogs.
 * Handles:
 * - Missing/extra spaces & punctuation: "80mil" <-> "80 MIL", "re520" <-> "RE 520", "polyflex" <-> "POLY-FLEX"
 * - Common spelling variations: "80 mill" / "80mill" / "80mils" <-> "80 MIL", "geotekstil" <-> "geotextile"
 * - Decimal & trailing zero normalization: "2mm" <-> "2,0mm" <-> "2.00 MM", "3.8x75" <-> "3,8x75"
 * - Multi-word cross-column search: "huitex 80mil", "tensar 50m", "hdpe thailand"
 * - Minor typos on words (Levenshtein distance <= 1 for 4-6 chars, <= 2 for 7+ chars; numbers stay exact)
 */

const UNIT_ALIASES = [
  [/\bmill+s?\b/g, 'mil'],
  [/(\d)mill+s?\b/g, '$1mil'],
  [/\bmils\b/g, 'mil'],
  [/(\d)mils\b/g, '$1mil'],
  [/\bgeotekstil\w*/g, 'geotextile'],
  [/\bflodrain\b/g, 'floordrain']
];

export function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize casing, decimal separators, trailing decimal zeros, and unit aliases.
 */
export function normalizeText(raw) {
  let s = String(raw ?? '').toLowerCase();

  // Decimal comma between digits -> dot ("3,8" -> "3.8", "2,0" -> "2.0")
  s = s.replace(/(\d),(\d)/g, '$1.$2');

  // Remove unnecessary trailing zeros after decimal point ("2.00" -> "2", "1.50" -> "1.5")
  s = s.replace(/(\d+)\.0+(?=\D|$)/g, '$1');
  s = s.replace(/(\d+\.\d*?[1-9])0+(?=\D|$)/g, '$1');

  // Apply unit & domain spelling aliases
  for (const [pattern, replacement] of UNIT_ALIASES) {
    s = s.replace(pattern, replacement);
  }

  return s;
}

/**
 * Strip all non-alphanumeric chars (keeping decimal dot inside numbers) for compact matching.
 */
export function compactText(raw) {
  return normalizeText(raw).replace(/[^a-z0-9.]+/g, '').replace(/\.(?!\d)/g, '');
}

/**
 * Split normalized text into clean alphanumeric tokens, separating letter<->number boundaries
 * while keeping decimals like "3.8" or "0.5" together.
 */
export function tokenize(raw) {
  const norm = normalizeText(raw);
  const matches = norm.match(/\d+(?:\.\d+)?|[a-z]+/g);
  return matches ? matches.slice(0, 12) : [];
}

function isNumericToken(token) {
  return /^\d+(?:\.\d+)?$/.test(token);
}

/**
 * Fast bounded Levenshtein distance (early exits when > maxDist).
 */
function levenshteinWithin(a, b, maxDist) {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;

  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= b.length; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
      curr[j] = val;
      if (val < rowMin) rowMin = val;
    }

    if (rowMin > maxDist) return false;
    [prev, curr] = [curr, prev];
  }

  return prev[b.length] <= maxDist;
}

/**
 * Score how well a single query token matches a row's tokens/text.
 * Returns 0 if no match, or higher positive score for stronger match.
 */
function scoreTokenMatch(qToken, rowTokens, rowNormText, rowCompactText) {
  if (isNumericToken(qToken)) {
    // Exact numeric token match (e.g. "80" matches "80", NOT "580" or "280")
    for (const rt of rowTokens) {
      if (rt === qToken) return 10;
    }
    // Numeric prefix match for decimal or multi-digit codes (e.g. "30" matches "3030", "3.8" matches "3.8")
    for (const rt of rowTokens) {
      if (isNumericToken(rt) && rt.startsWith(qToken)) return 6;
    }
    return 0;
  }

  // Alphabetic token
  // 1. Exact token match
  for (const rt of rowTokens) {
    if (rt === qToken) return 10;
  }

  // 2. Prefix token match ("ten" -> "tensar", "geo" -> "geogrid")
  for (const rt of rowTokens) {
    if (!isNumericToken(rt) && rt.startsWith(qToken)) return 8;
  }

  // 3. Substring match inside normalized or compact text (handles joined words like "polyflex" -> "poly-flex")
  if (qToken.length >= 2 && (rowNormText.includes(qToken) || rowCompactText.includes(qToken))) {
    return 6;
  }

  // 4. Typo tolerance (fuzzy Levenshtein) for words >= 4 chars
  if (qToken.length >= 4) {
    const maxDist = qToken.length >= 7 ? 2 : 1;
    for (const rt of rowTokens) {
      if (isNumericToken(rt)) continue;
      if (levenshteinWithin(qToken, rt, maxDist)) return 4;
      // Also allow fuzzy match against prefix of longer words (e.g. "geotex" -> "geotextiles")
      if (rt.length > qToken.length && levenshteinWithin(qToken, rt.slice(0, qToken.length), 1)) {
        return 3;
      }
    }
  }

  return 0;
}

/**
 * Filter and rank rows by flexible relevance score.
 */
export function filterAndRankRows(rows, query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const normQuery = normalizeText(trimmed);
  const compactQuery = compactText(trimmed);
  const queryTokens = tokenize(trimmed);

  // Also check if user typed raw punctuation/symbol only (no alnum tokens)
  if (queryTokens.length === 0) {
    const rawLower = trimmed.toLowerCase();
    return rows.filter((cells) =>
      cells.some((c) => String(c ?? '').toLowerCase().includes(rawLower))
    );
  }

  const scored = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const cells = rows[idx];
    const joined = cells.map((c) => String(c ?? '')).join(' ');
    const rowNorm = normalizeText(joined);
    const rowCompact = compactText(joined);
    const rowTokens = tokenize(joined);

    let totalScore = 0;
    let allTokensMatched = true;

    for (const qt of queryTokens) {
      const tokenScore = scoreTokenMatch(qt, rowTokens, rowNorm, rowCompact);
      if (tokenScore === 0) {
        allTokensMatched = false;
        break;
      }
      totalScore += tokenScore;
    }

    if (!allTokensMatched) {
      // Fallback: compact phrase match (e.g. "polyflex" vs "POLY-FLEX", "nonwoven" vs "Non-Woven")
      if (compactQuery.length >= 3 && rowCompact.includes(compactQuery)) {
        totalScore = 12;
      } else {
        continue;
      }
    }

    // Relevance boosts so closest matches appear first
    const rawLower = trimmed.toLowerCase();
    if (joined.toLowerCase().includes(rawLower)) {
      totalScore += 25;
    } else if (rowNorm.includes(normQuery)) {
      totalScore += 18;
    } else if (compactQuery.length >= 2 && rowCompact.includes(compactQuery)) {
      totalScore += 14;
    }

    // Extra boost if match is in Brand (col 0) or Material (col 1)
    const primaryCompact = compactText(`${cells[0] ?? ''} ${cells[1] ?? ''}`);
    if (compactQuery.length >= 2 && primaryCompact.includes(compactQuery)) {
      totalScore += 8;
    }

    scored.push({ cells, score: totalScore, originalIndex: idx });
  }

  // Fallback for single numeric substring (e.g. user types "80" expecting "580" only if no exact "80" exists)
  if (scored.length === 0 && queryTokens.length === 1 && isNumericToken(queryTokens[0])) {
    const rawNum = queryTokens[0];
    return rows.filter((cells) =>
      cells.some((c) => normalizeText(c).includes(rawNum))
    );
  }

  scored.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.originalIndex - b.originalIndex));
  return scored.map((item) => item.cells);
}

/**
 * Convert a single normalized token into a flexible regex fragment for highlighting in raw display text.
 */
function tokenToHighlightPattern(token) {
  if (isNumericToken(token)) {
    if (token.includes('.')) {
      const [intPart, decPart] = token.split('.');
      return `${escapeRegex(intPart)}[.,]${escapeRegex(decPart)}0*`;
    }
    return `${escapeRegex(token)}(?:[.,]0+)?`;
  }

  if (token === 'mil') {
    return 'mill*s?';
  }
  if (token === 'geotextile') {
    return 'geo(?:textil|tekstil)[a-z]*';
  }
  if (token === 'floordrain') {
    return 'floo?r?drain';
  }

  // Allow optional separator inside joined words (e.g. "polyflex" highlighting "POLY-FLEX")
  return escapeRegex(token);
}

/**
 * Build a safe, linear-time RegExp to highlight matching segments in display text.
 */
export function buildHighlightRegex(query) {
  const trimmed = String(query || '').trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  const patterns = [];

  // 1. Phrase pattern with flexible separators between tokens (e.g. "80mil" highlights "80 MIL" as one span)
  if (tokens.length >= 2 && tokens.length <= 5) {
    const phrasePattern = tokens.map(tokenToHighlightPattern).join('[\\s\\-_/()]*');
    patterns.push(phrasePattern);
  }

  // 2. Individual token patterns (longest first so fuller matches win)
  const uniqueTokens = [...new Set(tokens)].sort((a, b) => b.length - a.length);
  for (const token of uniqueTokens) {
    if (token.length === 1 && !isNumericToken(token)) continue;
    patterns.push(tokenToHighlightPattern(token));
  }

  // 3. Raw trimmed fallback if no patterns generated (e.g. single letter or symbol)
  if (patterns.length === 0) {
    patterns.push(escapeRegex(trimmed));
  }

  try {
    return new RegExp(`(${patterns.join('|')})`, 'gi');
  } catch {
    return new RegExp(`(${escapeRegex(trimmed)})`, 'gi');
  }
}

/**
 * Split raw display text into [{ text, match }] segments for React rendering.
 */
export function getHighlightSegments(text, highlightRegex) {
  if (text === null || text === undefined || text === '') {
    return [{ text: '-', match: false }];
  }
  const str = String(text);
  if (!highlightRegex) {
    return [{ text: str, match: false }];
  }

  const segments = [];
  const regex = new RegExp(highlightRegex.source, 'gi');
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match[0].length === 0) {
      regex.lastIndex += 1;
      continue;
    }
    // Avoid highlighting mid-number digits (e.g. "80" inside "580") without relying on regex lookbehind (Safari compat)
    const startsWithDigit = /^\d/.test(match[0]);
    const prevCharIsDigit = match.index > 0 && /\d/.test(str[match.index - 1]);
    if (startsWithDigit && prevCharIsDigit) {
      continue;
    }
    if (match.index > lastIndex) {
      segments.push({ text: str.slice(lastIndex, match.index), match: false });
    }
    segments.push({ text: match[0], match: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < str.length) {
    segments.push({ text: str.slice(lastIndex), match: false });
  }

  return segments.length > 0 ? segments : [{ text: str, match: false }];
}
