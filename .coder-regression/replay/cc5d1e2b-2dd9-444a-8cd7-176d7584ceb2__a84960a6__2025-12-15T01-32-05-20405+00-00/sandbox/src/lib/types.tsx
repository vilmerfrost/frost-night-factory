export interface InvoiceLineItem {
  description: string
  quantity: string
  unitPrice: string
  amount: string
}

export interface InvoiceData {
  invoiceNumber: string
  date: string
  vendor: string
  totalAmount: string
  lineItems: InvoiceLineItem[]
  currency?: string
  dueDate?: string
  taxAmount?: string
  subtotal?: string
}

export interface ClaudeResponse {
  content: Array<{
    type: string
    text?: string
  }>
  id: string
  model: string
  role: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

export interface UploadState {
  status: UploadStatus
  progress: number
  error?: string
  data?: InvoiceData
}

export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
