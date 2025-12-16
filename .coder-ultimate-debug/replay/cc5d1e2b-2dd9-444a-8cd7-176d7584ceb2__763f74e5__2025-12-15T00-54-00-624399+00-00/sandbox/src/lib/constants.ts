export const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022'

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif'
]

export const API_CONFIG = {
  anthropicApiVersion: '2023-06-01',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000,
  retryAttempts: 3,
  retryDelay: 1000
} as const

export const ROUTES = {
  home: '/',
  api: '/api',
  analyze: '/api/analyze'
} as const

export const ERROR_MESSAGES = {
  fileUpload: 'Failed to upload file. Please try again.',
  apiKey: 'Anthropic API key is not configured.',
  processing: 'Failed to process your request. Please try again.',
  invalidFile: 'Invalid file format or size.',
  network: 'Network error. Please check your connection.'
} as const
