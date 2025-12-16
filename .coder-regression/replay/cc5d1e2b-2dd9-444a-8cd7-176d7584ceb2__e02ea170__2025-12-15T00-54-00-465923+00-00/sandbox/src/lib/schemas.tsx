import { z } from 'zod'

export const lineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.string().min(1, 'Quantity is required'),
  unitPrice: z.string().min(1, 'Unit price is required'),
  amount: z.string().min(1, 'Amount is required'),
})

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  date: z.string().min(1, 'Date is required'),
  vendor: z.string().min(1, 'Vendor is required'),
  totalAmount: z.string().min(1, 'Total amount is required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  currency: z.string().optional(),
  dueDate: z.string().optional(),
  taxAmount: z.string().optional(),
  subtotal: z.string().optional(),
})

export const uploadSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.type === 'application/pdf',
    'File must be a PDF'
  ).refine(
    (file) => file.size <= 10 * 1024 * 1024,
    'File size must be less than 10MB'
  ),
})

export type InvoiceSchemaType = z.infer<typeof invoiceSchema>
export type LineItemSchemaType = z.infer<typeof lineItemSchema>
export type UploadSchemaType = z.infer<typeof uploadSchema>
