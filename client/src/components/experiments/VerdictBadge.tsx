import { Badge } from "@/components/ui/badge"

const styles: Record<string, string> = {
  justified: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50",
  suspicious: "bg-red-50 text-red-700 border-red-200 hover:bg-red-50",
  unclear: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50",
}

export function VerdictBadge({ verdict }: { verdict: string }) {
  return <Badge variant="outline" className={styles[verdict] || ""}>{verdict}</Badge>
}
