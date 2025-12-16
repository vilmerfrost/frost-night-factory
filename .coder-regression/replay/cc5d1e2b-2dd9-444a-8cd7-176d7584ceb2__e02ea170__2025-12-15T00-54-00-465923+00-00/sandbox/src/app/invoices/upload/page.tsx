'use client'

import { useState } from 'react'
import FileUpload from '@/components/upload/FileUpload'
import InvoiceResults from '@/components/invoice/InvoiceResults'
import { processInvoiceFiles } from '@/actions/invoiceActions'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface InvoiceData {
  id: string
  fileName: string
  invoiceNumber: string
  date: string
  vendor: string
  amount: number
  status: 'success' | 'error'
}

export default function UploadPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const result = await processInvoiceFiles(formData)

      if (result.success && result.data) {
        setInvoices(result.data)
      } else {
        setError(result.error || 'Failed to process invoices')
      }
    } catch (err) {
      setError('An unexpected error occurred')
      console.error(err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Upload Invoices</h1>
        <p className="text-slate-600">
          Upload your invoice files to extract and process information automatically
        </p>
      </div>

      <Card className="p-6">
        <FileUpload onFilesSelected={handleFilesSelected} disabled={isProcessing} />
      </Card>

      {isProcessing && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-slate-600">Processing invoices...</span>
        </div>
      )}

      {error && (
        <Card className="p-4 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Card>
      )}

      {invoices.length > 0 && !isProcessing && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Processed Invoices</h2>
          <InvoiceResults invoices={invoices} />
        </div>
      )}
    </div>
  )
}