import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import { abbreviateHash, formatLotDate, formatLotMoney } from "@/components/lots/model"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"
const labelClass = "text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase"

export type LotReceipt = {
  lotId: string
  title: string
  imageUrl: string | null
  amount: number
  winner: number | null
  settledAt: string
  chainHead: string | null
}

export function ReceiptReport({ receipt }: { receipt: LotReceipt }) {
  const won = receipt.winner != null
  const settledAt = formatLotDate(receipt.settledAt)

  return (
    <main className="flex flex-1 flex-col bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/lots/${receipt.lotId}`}
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Voltar ao lote
          </Link>
          <p className="font-mono text-[13px] tracking-wider text-primary">Lote #{receipt.lotId}</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[0.7rem] tracking-[0.16em] text-primary uppercase">Comprovante de arremate</p>
            <Badge variant={won ? "default" : "secondary"}>{won ? "Arrematado" : "Sem vencedor"}</Badge>
          </div>
          <h1 className={cn(displayFont, "text-3xl leading-tight tracking-tight text-foreground sm:text-4xl")}>
            {receipt.title}
          </h1>
        </div>

        <Card className="overflow-hidden pt-0">
          <div className="overflow-hidden border-b border-border bg-muted">
            <CardPortrait
              src={receipt.imageUrl}
              alt={receipt.title}
              className="mx-auto aspect-[3/4] w-full max-w-sm object-contain"
            />
          </div>
          <CardContent className="pt-(--card-spacing)">
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <dt className={labelClass}>Valor arrematado</dt>
                <dd className="font-mono text-3xl text-primary">{formatLotMoney(receipt.amount)}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className={labelClass}>Licitante</dt>
                <dd className="text-base text-foreground">{won ? `#${receipt.winner}` : "Nenhum"}</dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className={labelClass}>Data da liquidação</dt>
                <dd className="font-mono text-base text-foreground">{settledAt ?? "—"}</dd>
              </div>
              {receipt.chainHead ? (
                <div className="flex flex-col gap-2 sm:col-span-3">
                  <dt className={labelClass}>Cabeça da cadeia</dt>
                  <dd className="font-mono text-base text-foreground" title={receipt.chainHead}>
                    {abbreviateHash(receipt.chainHead)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
          {won ? null : (
            <CardFooter>
              <p className="text-sm text-muted-foreground">O pregão encerrou sem lances e sem débito.</p>
            </CardFooter>
          )}
        </Card>
      </div>
    </main>
  )
}
