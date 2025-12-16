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
  anthropicVersion: '2023-06-01',
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000,
  retryAttempts: 3,
  retryDelay: 1000
} as const

export const ROUTES = {
  home: '/',
  api: '/api/analyze',
  dashboard: '/dashboard'
} as const

export const ERROR_MESSAGES = {
  fileUpload: 'Failed to upload file. Please try again.',
  apiError: 'An error occurred while processing your request.',
  invalidFile: 'Invalid file format or size.',
  networkError: 'Network error. Please check your connection.'
} as const
