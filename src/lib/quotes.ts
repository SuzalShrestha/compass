import { dayNumber } from './dates.ts'

export interface Quote {
  text: string
  source: string
}

// Canonical lines from Marcus Aurelius's *Meditations* (public domain). One is
// shown per day, rotating deterministically. Fork and edit this list freely —
// it's just the default set.
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
  {
    text: 'When you arise in the morning, think of what a precious privilege it is to be alive — to breathe, to think, to enjoy, to love.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Very little is needed to make a happy life; it is all within yourself, in your way of thinking.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'The best revenge is not to be like your enemy.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Dwell on the beauty of life. Watch the stars, and see yourself running with them.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Everything we hear is an opinion, not a fact. Everything we see is a perspective, not the truth.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'How much more grievous are the consequences of anger than the causes of it.',
    source: 'Marcus Aurelius, Meditations',
  },
  {
    text: 'Loss is nothing else but change, and change is Nature’s delight.',
    source: 'Marcus Aurelius, Meditations',
  },
]

export function quoteForDay(dateKey?: string): Quote {
  const n = dayNumber(dateKey)
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length]
}
