'use client'

import { useState, useCallback } from 'react'
import { Upload, X, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export interface FileUploadProps {
  onFileSelect?: (file: File | null) => void
  accept?: string
  maxSize?: number
  className?: string
}

export function FileUpload({
  onFileSelect,
  accept = '*/*',
  maxSize = 10 * 1024 * 1024,
  className,
}: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(
    (selectedFile: File) => {
      setError(null)
      if (selectedFile.size > maxSize) {
        setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`)
        return
      }
      setFile(selectedFile)
      onFileSelect?.(selectedFile)
    },
    [maxSize, onFileSelect]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile) {
        handleFile(droppedFile)
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFile(selectedFile)
      }
    },
    [handleFile]
  )

  const handleRemove = useCallback(() => {
    setFile(null)
    setError(null)
    onFileSelect?.(null)
  }, [onFileSelect])

  return (
    <div className={cn('w-full', className)}>
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-12 transition-colors hover:border-gray-400 hover:bg-gray-100',
            isDragging && 'border-blue-500 bg-blue-50',
            error && 'border-red-300 bg-red-50'
          )}
        >
          <Upload className="mb-4 h-12 w-12 text-gray-400" />
          <p className="mb-2 text-sm text-gray-600">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            Max file size: {maxSize / 1024 / 1024}MB
          </p>
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white p-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="text-gray-500 hover:text-red-600"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  )
}