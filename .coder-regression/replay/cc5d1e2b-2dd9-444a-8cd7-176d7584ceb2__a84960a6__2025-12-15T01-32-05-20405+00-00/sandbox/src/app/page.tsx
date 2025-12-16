import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FileUp, BarChart3 } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center space-y-4 py-12">
        <h1 className="text-5xl font-bold text-slate-900">
          Process Invoices with AI
        </h1>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto">
          Upload your invoices and extract key information automatically using advanced AI technology
        </p>
        <div className="pt-6">
          <Link href="/invoices/upload">
            <Button size="lg" className="gap-2">
              <FileUp className="w-5 h-5" />
              Start Processing
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileUp className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Easy Upload</h3>
          <p className="text-slate-600">
            Drag and drop multiple invoice files or click to browse. Supports PDF, images, and common document formats.
          </p>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Instant Results</h3>
          <p className="text-slate-600">
            Get extracted data including invoice numbers, dates, amounts, and vendor information in seconds.
          </p>
        </Card>
      </div>
    </div>
  )
}