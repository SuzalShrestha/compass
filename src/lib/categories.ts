import type { Category, CategoryRule } from './types.ts'

// ---------------------------------------------------------------------------
// Domain → category classifier.
//
// A bundled, editable ruleset. Matching is by suffix so "x.com" covers
// "x.com", "mobile.x.com", etc. Unmatched domains fall through to "other".
// ---------------------------------------------------------------------------

const CATEGORY_ORDER: Category[] = [
  'social',
  'entertainment',
  'work',
  'reading',
  'learning',
  'other',
]

export const CATEGORY_LABELS: Record<Category, string> = {
  social: 'Social',
  entertainment: 'Entertainment',
  work: 'Work',
  reading: 'Reading',
  learning: 'Learning',
  other: 'Other',
}

export function categoryOrder(): Category[] {
  return CATEGORY_ORDER
}

/** Classify a single bare hostname. Suffix match, longest rule wins. */
export function classify(domain: string, rules: CategoryRule[]): Category {
  let best: CategoryRule | undefined
  let bestLen = -1
  for (const r of rules) {
    if (!r.domain) continue
    if (domain === r.domain || domain.endsWith(`.${r.domain}`)) {
      if (r.domain.length > bestLen) {
        best = r
        bestLen = r.domain.length
      }
    }
  }
  return best?.category ?? 'other'
}

export interface CategoryTotal {
  category: Category
  label: string
  seconds: number
  share: number // 0–1 of the total
}

/** Sum seconds per category across many days' usage, sorted by total desc. */
export function categorize(
  domainsBySeconds: Record<string, number>,
  rules: CategoryRule[],
): CategoryTotal[] {
  const totals = new Map<Category, number>()
  for (const [domain, seconds] of Object.entries(domainsBySeconds)) {
    const cat = classify(domain, rules)
    totals.set(cat, (totals.get(cat) ?? 0) + seconds)
  }
  const grand = [...totals.values()].reduce((s, v) => s + v, 0)
  return categoryOrder()
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      seconds: totals.get(category) ?? 0,
      share: grand > 0 ? (totals.get(category) ?? 0) / grand : 0,
    }))
    .filter((c) => c.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
}
