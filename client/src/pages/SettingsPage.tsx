import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { useSettings } from "@/hooks/useSettings"
import { useAnnotations } from "@/hooks/useAnnotations"

export default function SettingsPage() {
  const { settings, setSettings, apiKey, setApiKey, hasApiKey } = useSettings()
  const { stats, refreshStats, clearAll } = useAnnotations()
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => { refreshStats() }, [refreshStats])

  const handleSave = async () => {
    setIsSaving(true)
    await setSettings(settings)
    setIsSaving(false)
    setTestResult('Settings saved')
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResult(null)
    setTestError(null)
    try {
      const res = await api.testConnection(settings.model)
      if (res.ok) {
        setTestResult(`Connected — model replied: "${res.response}"`)
      } else {
        setTestError(res.error || 'Connection failed')
      }
    } catch (e: any) {
      setTestError(e.message)
    }
    setIsTesting(false)
  }

  const handleClearAll = async () => {
    if (!confirm('Delete all annotations and uploaded receipts? This cannot be undone.')) return
    setIsClearing(true)
    try {
      await clearAll()
      setTestResult('All data cleared')
    } catch (e: any) {
      setTestError(e.message)
    }
    setIsClearing(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">ST: Research Configuration</h1>
        <p className="text-sm text-ink-soft mt-1">
          Configure the API key and models used across experiments E1-E6.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={hasApiKey ? "default" : "destructive"}>
            {hasApiKey ? 'Active (server key)' : 'No key on server'}
          </Badge>
        </CardContent>
      </Card>

      {/* API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">OpenRouter API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
            />
          </div>
          <p className="text-xs text-ink-mute">
            Key stays in browser memory only. Re-enter after page refresh.
          </p>
        </CardContent>
      </Card>

      {/* Model Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Model Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="vision-model">Vision Model (Layer 1 - OCR)</Label>
            <Input
              id="vision-model"
              value={settings.visionModel}
              onChange={e => setSettings({ ...settings, visionModel: e.target.value })}
              placeholder="google/gemini-2.5-flash"
            />
          </div>
          <div>
            <Label htmlFor="reasoning-model">Reasoning Model (Layer 3 - Verdict)</Label>
            <Input
              id="reasoning-model"
              value={settings.model}
              onChange={e => setSettings({ ...settings, model: e.target.value })}
              placeholder="google/gemini-2.5-flash"
            />
          </div>
          <div>
            <Label htmlFor="currency">Currency Override</Label>
            <Select
              value={settings.currency}
              onValueChange={v => setSettings({ ...settings, currency: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Any">Any (use receipt currency)</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="AUD">AUD</SelectItem>
                <SelectItem value="SGD">SGD</SelectItem>
                <SelectItem value="NZD">NZD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={handleTestConnection} disabled={isTesting}>
          {isTesting ? 'Testing...' : 'Test Connection'}
        </Button>
        <Button
          variant="destructive"
          onClick={handleClearAll}
          disabled={isClearing}
          className="ml-auto"
        >
          {isClearing ? 'Clearing...' : 'Delete All Data'}
        </Button>
      </div>

      {/* Feedback */}
      {testResult && (
        <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          {testResult}
        </div>
      )}
      {testError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
          {testError}
        </div>
      )}

      <Separator />

      {/* Annotation Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annotation Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-ink">{stats.pending}</div>
              <div className="text-xs text-ink-mute">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
              <div className="text-xs text-ink-mute">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{stats.skipped}</div>
              <div className="text-xs text-ink-mute">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-ink">{stats.total}</div>
              <div className="text-xs text-ink-mute">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
