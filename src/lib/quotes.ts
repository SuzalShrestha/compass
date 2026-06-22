import { dayNumber } from './dates.ts'

export interface Quote {
  text: string
  source: string
}

// A mix of canonical lines from Marcus Aurelius's *Meditations* and Sujal's own
// takeaways from reading it. One is shown per day, rotating deterministically.
export const QUOTES: Quote[] = [
  {
    text: 'You have power over your mind — not outside events. Realize this, and you will find strength.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'The happiness of your life depends upon the quality of your thoughts.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Waste no more time arguing about what a good man should be. Be one.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Never let the future disturb you. You will meet it with the same weapons of reason which today arm you against the present.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'The impediment to action advances action. What stands in the way becomes the way.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'If it is not right, do not do it. If it is not true, do not say it.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Confine yourself to the present.',
    source: 'Marcus Aurelius, Meditations',
  },
  // Sujal's own notes from reading Meditations:
  {
    text: 'You are going to die — think, read, and make decisions accordingly.',
    source: 'Your notes on Meditations',
  },
  {
    text: 'Your nature is doing work aligned with your values and morals.',
    source: 'Your notes on Meditations',
  },
  {
    text: "Don't be thirsty for books; be wary of consumption instead of living.",
    source: 'Your notes on Meditations',
  },
  {
    text: 'For everyone time is equal — and so is their wasted time.',
    source: 'Your notes on Meditations',
  },
  {
    text: 'Observe your thoughts. Know where they come from. You are going for justice and to be a good man.',
    source: 'Your notes on Meditations',
  },
  {
    text: "Don't use busyness as an excuse to neglect your duties and responsibilities.",
    source: 'Your notes on Meditations',
  },
]

export function quoteForDay(dateKey?: string): Quote {
  const n = dayNumber(dateKey)
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length]
}
