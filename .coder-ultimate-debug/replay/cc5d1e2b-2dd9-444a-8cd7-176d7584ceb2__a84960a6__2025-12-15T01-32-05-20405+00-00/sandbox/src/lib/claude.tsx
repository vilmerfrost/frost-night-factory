import Anthropic from '@anthropic-ai/sdk'
import { InvoiceData } from './types'
import { invoiceSchema } from './schemas'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
})

export async function processPDFWithClaude(pdfBase64: string): Promise<InvoiceData> {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          },
          {
            type: 'text',
            text: `Extract invoice data from this PDF and return it as JSON with the following structure:
{
  "invoiceNumber": "string",
  "date": "string",
  "vendor": "string",
  "totalAmount": "string",
  "currency": "string (optional)",
  "dueDate": "string (optional)",
  "taxAmount": "string (optional)",
  "subtotal": "string (optional)",
  "lineItems": [
    {
      "description": "string",
      "quantity": "string",
      "unitPrice": "string",
      "amount": "string"
    }
  ]
}

Return ONLY valid JSON, no additional text or explanation.`
          }
        ]
      }
    ]
  })

  const textContent = message.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response')
  }

  return extractInvoiceData(textContent.text)
}

export function extractInvoiceData(responseText: string): InvoiceData {
  let jsonText = responseText.trim()
  
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonText = jsonMatch[0]
  }
  
  const parsed = JSON.parse(jsonText)
  
  const validated = invoiceSchema.parse(parsed)
  
  return validated as InvoiceData
}
