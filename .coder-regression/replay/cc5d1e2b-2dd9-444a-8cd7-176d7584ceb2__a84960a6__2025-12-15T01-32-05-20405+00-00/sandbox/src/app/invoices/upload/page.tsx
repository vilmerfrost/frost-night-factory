'use client'

import { useState } from 'react'
import FileUpload from '@/components/upload/FileUpload'
import InvoiceResults from '@/components/invoice/InvoiceResults'
import { processInvoiceFiles } from '@/actions/invoiceActions'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function UploadPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true)
    setError(null)
    setResults([])

    try {
      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const processedResults = await processInvoiceFiles(formData)
      setResults(processedResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process invoices')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Upload Invoices</h1>
        <p className="text-slate-600">Upload one or more invoice files to extract data automatically</p>
      </div>

      <Card className="p-6">
        <FileUpload onFilesSelected={handleFilesSelected} disabled={isProcessing} />
      </Card>

      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-600 font-medium">Processing invoices...</p>
        </div>
      )}

      {error && (
        <Card className="p-6 border-red-200 bg-red-50">
          <p className="text-red-800 font-medium">Error: {error}</p>
        </Card>
      )}

      {results.length > 0 && !isProcessing && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">Extracted Results</h2>
          <InvoiceResults results={results} />
        </div>
      )}
    </div>
  )
}