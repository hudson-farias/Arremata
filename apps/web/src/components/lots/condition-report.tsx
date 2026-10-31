import { ClipboardList } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ConditionReport({ text }: { text: string | null }) {
  if (!text) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="inline-flex items-center gap-1.5 text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          <ClipboardList className="size-3.5 text-primary" aria-hidden />
          Relatório de condição
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{text}</p>
      </CardContent>
    </Card>
  )
}
