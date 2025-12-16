export const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]

export const API_CONFIG = {
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 30000,
  retries: 3,
  baseUrl: 'https://api.anthropic.com/v1',
  version: '2023-06-01'
}

export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Travel',
  'Other'
] as const

export const DATE_FORMAT = 'MMMM dd, yyyy'

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$'
}
