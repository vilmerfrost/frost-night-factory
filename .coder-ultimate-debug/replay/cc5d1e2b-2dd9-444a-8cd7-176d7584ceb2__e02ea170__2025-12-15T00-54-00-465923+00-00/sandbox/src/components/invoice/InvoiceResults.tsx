'use client'

import { useState } from 'react'
import { InvoiceData } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Save, Edit, Eye } from 'lucide-react'

interface InvoiceResultsProps {
  data: InvoiceData
  onSave?: (data: InvoiceData) => void
}

export function InvoiceResults({ data, onSave }: InvoiceResultsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState<InvoiceData>(data)

  const handleSave = () => {
    if (onSave) {
      onSave(editedData)
    }
    setIsEditing(false)
  }

  const updateLineItem = (index: number, field: string, value: string) => {
    const newLineItems = [...editedData.lineItems]
    newLineItems[index] = { ...newLineItems[index], [field]: value }
    setEditedData({ ...editedData, lineItems: newLineItems })
  }

  const updateField = (field: keyof InvoiceData, value: string) => {
    setEditedData({ ...editedData, [field]: value })
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Invoice Data</h2>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSave} className="flex items-center gap-2">
                <Save className="w-4 h-4" /> Save
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline">
                Cancel
              </Button>
            </>
          ) : (
            <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2">
              <Edit className="w-4 h-4" /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
          <Input
            value={editedData.invoiceNumber}
            onChange={(e) => updateField('invoiceNumber', e.target.value)}
            disabled={!isEditing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <Input
            value={editedData.date}
            onChange={(e) => updateField('date', e.target.value)}
            disabled={!isEditing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
          <Input
            value={editedData.vendor}
            onChange={(e) => updateField('vendor', e.target.value)}
            disabled={!isEditing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
          <Input
            value={editedData.totalAmount}
            onChange={(e) => updateField('totalAmount', e.target.value)}
            disabled={!isEditing}
          />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Line Items</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {editedData.lineItems.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <Input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                      disabled={!isEditing}
                      className="min-w-[200px]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                      disabled={!isEditing}
                      className="w-20"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={item.unitPrice}
                      onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                      disabled={!isEditing}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      value={item.amount}
                      onChange={(e) => updateLineItem(index, 'amount', e.target.value)}
                      disabled={!isEditing}
                      className="w-24"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
