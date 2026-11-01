import Link from "next/link"
import { ArrowLeft, Receipt, Shield } from "lucide-react"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import { collectorLine, type ShowcaseLot } from "@/components/lots/model"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

export function LotShowcase({ lot, cancelled = false }: { lot: ShowcaseLot; cancelled?: boolean }) {
  const specs = collectorLine(lot)

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Voltar à vitrine
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.7rem] tracking-[0.16em] text-primary uppercase">Lote #{lot.id}</p>
          {cancelled ? null : (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/lots/${lot.id}/audit`}>
                <Shield data-icon="inline-start" aria-hidden />
                Auditoria
              </Link>
            </Button>
          )}
          {lot.status === "closed" && !cancelled ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/lots/${lot.id}/receipt`}>
                <Receipt data-icon="inline-start" aria-hidden />
                Comprovante
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted">
          <CardPortrait
            key={lot.imageUrl ?? lot.id}
            src={lot.imageUrl}
            alt={lot.title}
            className="aspect-[3/4] w-full object-contain"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className={cn(displayFont, "text-3xl leading-tight tracking-tight text-foreground sm:text-4xl")}>
          {lot.title}
        </h1>
        {specs ? <p className="text-sm text-muted-foreground">{specs}</p> : null}
        {cancelled ? <p className="text-sm text-muted-foreground">Este lote foi cancelado.</p> : null}
      </div>
    </section>
  )
}
