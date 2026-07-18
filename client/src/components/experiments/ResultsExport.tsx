import { Button } from "@/components/ui/button"

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ResultsExport({ experimentId, data }: { experimentId: string; data?: any }) {
  if (!data) return null
  return (
    <div className="flex gap-2 mt-4">
      <Button variant="outline" size="sm" onClick={() => {
        try {
          const csv = JSON.stringify(data, null, 2)
          downloadFile(csv, `${experimentId}-results.json`, 'application/json')
        } catch {}
      }}>
        Export JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => {
        try {
          const csv = JSON.stringify(data, null, 2)
          downloadFile(csv, `${experimentId}-results.csv`, 'text/csv')
        } catch {}
      }}>
        Export CSV
      </Button>
    </div>
  )
}
