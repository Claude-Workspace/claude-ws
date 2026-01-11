/**
 * Lightweight fuzzy matching algorithm
 * Scores based on: consecutive matches, word boundary matches, exact prefix matches
 */

export interface FuzzyMatch {
  score: number;
  matches: number[]; // Indices of matched characters for highlighting
}

/**
 * Performs fuzzy matching of query against target string
 * Returns null if no match, otherwise returns score and matched indices
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatch | null {
  if (!query) return { score: 0, matches: [] };

  const queryLower = query.toLowerCase();
  const targetLower = target.toLowerCase();

  // Quick check: all query chars must exist in target
  let checkIndex = 0;
  for (const char of queryLower) {
    const found = targetLower.indexOf(char, checkIndex);
    if (found === -1) return null;
    checkIndex = found + 1;
  }

  // Find best match with scoring
  const matches: number[] = [];
  let score = 0;
  let queryIndex = 0;
  let lastMatchIndex = -1;
  let consecutiveBonus = 0;

  for (let i = 0; i < targetLower.length && queryIndex < queryLower.length; i++) {
    if (targetLower[i] === queryLower[queryIndex]) {
      matches.push(i);

      // Base score for match
      let matchScore = 1;

      // Bonus for consecutive matches
      if (lastMatchIndex === i - 1) {
        consecutiveBonus += 1;
        matchScore += consecutiveBonus * 2;
      } else {
        consecutiveBonus = 0;
      }

      // Bonus for word boundary match (start, after separator)
      if (i === 0) {
        matchScore += 10; // Start of string
      } else {
        const prevChar = target[i - 1];
        if (prevChar === '/' || prevChar === '\\' || prevChar === '.' || prevChar === '-' || prevChar === '_' || prevChar === ' ') {
          matchScore += 5; // Word boundary
        } else if (target[i] === target[i].toUpperCase() && prevChar === prevChar.toLowerCase()) {
          matchScore += 3; // camelCase boundary
        }
      }

      // Bonus for exact case match
      if (query[queryIndex] === target[i]) {
        matchScore += 1;
      }

      score += matchScore;
      lastMatchIndex = i;
      queryIndex++;
    }
  }

  // All query chars must be matched
  if (queryIndex !== queryLower.length) return null;

  // Bonus for shorter targets (prefer exact matches)
  score += Math.max(0, 50 - target.length);

  // Bonus for match at start
  if (matches[0] === 0) {
    score += 15;
  }

  return { score, matches };
}

/**
 * Highlights matched characters in text
 * Returns array of segments with isMatch flag
 */
export function highlightMatches(
  text: string,
  matches: number[]
): { text: string; isMatch: boolean }[] {
  if (!matches.length) {
    return [{ text, isMatch: false }];
  }

  const result: { text: string; isMatch: boolean }[] = [];
  const matchSet = new Set(matches);
  let currentSegment = '';
  let currentIsMatch = matchSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const isMatch = matchSet.has(i);

    if (isMatch !== currentIsMatch) {
      if (currentSegment) {
        result.push({ text: currentSegment, isMatch: currentIsMatch });
      }
      currentSegment = text[i];
      currentIsMatch = isMatch;
    } else {
      currentSegment += text[i];
    }
  }

  if (currentSegment) {
    result.push({ text: currentSegment, isMatch: currentIsMatch });
  }

  return result;
}
