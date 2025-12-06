"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

const PROMPT_TYPES = [
  { id: 'planner', label: 'Planner', description: 'Architecture and planning prompts' },
  { id: 'coder', label: 'Coder', description: 'Code generation prompts' },
  { id: 'tester', label: 'Tester', description: 'Testing and validation prompts' },
  { id: 'reviewer', label: 'Reviewer', description: 'Code review prompts' },
  { id: 'fixer', label: 'Fixer', description: 'Error fixing prompts' },
]

export default function PromptsPage() {
  const [activeType, setActiveType] = useState('planner')
  const [prompts, setPrompts] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load prompts from API
    Promise.all(
      PROMPT_TYPES.map(async (type) => {
        try {
          const res = await fetch(`/api/dev/prompts/${type.id}`)
          if (res.ok) {
            const data = await res.json()
            return { type: type.id, content: data.content || '' }
          }
        } catch (error) {
          console.error(`Failed to load ${type.id} prompt:`, error)
        }
        return { type: type.id, content: '' }
      })
    ).then((results) => {
      const loaded: Record<string, string> = {}
      results.forEach((r) => {
        loaded[r.type] = r.content
      })
      setPrompts(loaded)
      setPreview(loaded[activeType] || '')
    })
  }, [])

  useEffect(() => {
    // Update preview when active type changes
    setPreview(prompts[activeType] || '')
    setSaved(false)
  }, [activeType, prompts])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch(`/api/dev/prompts/${activeType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: preview }),
      })

      if (res.ok) {
        setPrompts((p) => ({ ...p, [activeType]: preview }))
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        throw new Error('Failed to save prompt')
      }
    } catch (error) {
      console.error('Failed to save prompt:', error)
      alert('Failed to save prompt. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('Reset to saved version?')) {
      setPreview(prompts[activeType] || '')
    }
  }

  const hasChanges = preview !== (prompts[activeType] || '')

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Prompt Editor</h1>
          <p className="text-muted-foreground">
            Edit and preview system prompts for each pipeline phase
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Editor</CardTitle>
                  <CardDescription>
                    {PROMPT_TYPES.find((t) => t.id === activeType)?.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {hasChanges && (
                    <Badge variant="outline" className="text-xs">
                      Unsaved changes
                    </Badge>
                  )}
                  {saved && (
                    <Badge variant="default" className="text-xs bg-green-600">
                      Saved
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={activeType} onValueChange={setActiveType}>
                <TabsList className="grid w-full grid-cols-5">
                  {PROMPT_TYPES.map((t) => (
                    <TabsTrigger key={t.id} value={t.id} className="text-xs">
                      {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {PROMPT_TYPES.map((type) => (
                  <TabsContent key={type.id} value={type.id} className="mt-4">
                    <textarea
                      className="w-full h-96 p-4 bg-slate-900 text-white font-mono text-sm rounded-lg border border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                      value={preview}
                      onChange={(e) => setPreview(e.target.value)}
                      placeholder={`Enter ${type.label.toLowerCase()} prompt...`}
                    />
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs text-muted-foreground">
                        {preview.length} characters
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReset}
                          disabled={!hasChanges}
                        >
                          Reset
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSave}
                          disabled={saving || !hasChanges}
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="bg-slate-950 border-slate-700">
            <CardHeader>
              <CardTitle className="text-cyan-400">Live Preview</CardTitle>
              <CardDescription className="text-slate-400">
                See how the prompt will appear to the AI model
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-auto p-4 bg-[#0a0e27] rounded-lg border border-slate-700">
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">
                  {preview || (
                    <span className="text-slate-600 italic">
                      Start typing to see preview...
                    </span>
                  )}
                </pre>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>Preview mode: Raw text</span>
                <span>{preview.split('\n').length} lines</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

