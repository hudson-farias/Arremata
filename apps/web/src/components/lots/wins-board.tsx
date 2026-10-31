import Link from "next/link"
import { Gavel, Receipt } from "lucide-react"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import {
  collectorLine,
  formatLotDate,
  formatLotMoney,
  statusLabel,
  type ShowcaseStatus,
} from "@/components/lots/model"
import { positionLabel, type BidLot, type BidPosition, type WinLot } from "@/components/lots/wins"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"
const labelClass = "text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase"

function StatusBadge({ status }: { status: ShowcaseStatus }) {
  const variant = status === "live" ? "default" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant} className="rounded-[4px]">
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function PositionBadge({ position }: { position: BidPosition }) {
  const variant = position === "winning" ? "default" : position === "lost" ? "secondary" : "outline"

  return (
    <Badge variant={variant} className="rounded-[4px]">
      {positionLabel(position)}
    </Badge>
  )
}

function SectionHeading({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <h2 id={id} className={cn(displayFont, "flex items-baseline gap-3 text-2xl tracking-tight text-foreground")}>
      {title}
      <span className="font-mono text-base text-muted-foreground">{count}</span>
    </h2>
  )
}

function WonCard({ lot }: { lot: WinLot }) {
  const specs = collectorLine(lot)
  const settledAt = formatLotDate(lot.settledAt)

  return (
    <li className="h-full">
      <Card className="h-full rounded-[4px] pt-0">
        <div className="overflow-hidden bg-muted">
          <CardPortrait
            key={lot.imageUrl ?? lot.id}
            src={lot.imageUrl}
            alt=""
            className="aspect-[3/4] w-full object-contain"
          />
        </div>
        <CardHeader>
          <CardTitle>
            <h3 className={cn(displayFont, "text-xl leading-tight break-words")}>{lot.title}</h3>
          </CardTitle>
          {specs ? <CardDescription>{specs}</CardDescription> : null}
          <CardAction>
            <Badge className="rounded-[4px]">Arrematado</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="mt-auto flex-col items-stretch gap-3">
          <div className="flex items-end justify-between gap-3">
            <p className="flex min-w-0 flex-col gap-0.5">
              <span className={labelClass}>Valor do martelo</span>
              <span className="font-mono text-lg text-primary">{formatLotMoney(lot.amount)}</span>
            </p>
            <p className="flex flex-col items-end gap-0.5 text-right">
              <span className={labelClass}>Data da liquidação</span>
              <span className="font-mono text-sm text-foreground">{settledAt ?? "—"}</span>
            </p>
          </div>
          <p className="text-sm text-foreground">Licitante #{lot.winner}</p>
          <Button variant="outline" size="sm" className="w-full rounded-[4px]" asChild>
            <Link href={`/lots/${lot.id}/receipt`}>
              <Receipt data-icon="inline-start" aria-hidden />
              Comprovante
              <span className="sr-only"> de {lot.title}</span>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </li>
  )
}

function BidCard({ lot }: { lot: BidLot }) {
  const specs = collectorLine(lot)
  const amountLabel = lot.status === "closed" ? "Lance final" : "Lance atual"

  return (
    <li className="h-full">
      <Link
        href={`/lots/${lot.id}`}
        className="block h-full rounded-[4px] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Card className="h-full rounded-[4px] pt-0">
          <div className="overflow-hidden bg-muted">
            <CardPortrait
              key={lot.imageUrl ?? lot.id}
              src={lot.imageUrl}
              alt=""
              className="aspect-[3/4] w-full object-contain"
            />
          </div>
          <CardHeader>
            <CardTitle>
              <h3 className={cn(displayFont, "text-xl leading-tight break-words")}>{lot.title}</h3>
            </CardTitle>
            {specs ? <CardDescription>{specs}</CardDescription> : null}
            <CardAction>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={lot.status} />
                <PositionBadge position={lot.position} />
              </div>
            </CardAction>
          </CardHeader>
          <CardFooter className="mt-auto flex-col items-stretch gap-3">
            <div className="flex items-end justify-between gap-3">
              <p className="flex min-w-0 flex-col gap-0.5">
                <span className={labelClass}>{amountLabel}</span>
                <span className="font-mono text-lg text-primary">{formatLotMoney(lot.currentBid)}</span>
              </p>
              {lot.userBid != null ? (
                <p className="flex flex-col items-end gap-0.5 text-right">
                  <span className={labelClass}>Seu lance</span>
                  <span className="font-mono text-lg text-primary">{formatLotMoney(lot.userBid)}</span>
                </p>
              ) : null}
            </div>
          </CardFooter>
        </Card>
      </Link>
    </li>
  )
}

function EmptySection({ icon, title, description }: { icon: "won" | "bids"; title: string; description: string }) {
  return (
    <Empty className="rounded-[4px] border">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="rounded-[4px]">
          {icon === "won" ? <Receipt /> : <Gavel />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

export function WinsBoard({ won, bids }: { won: WinLot[]; bids: BidLot[] }) {
  return (
    <>
      <section aria-labelledby="wins-won-heading" className="flex flex-col gap-4">
        <SectionHeading id="wins-won-heading" title="Arrematados" count={won.length} />
        {won.length === 0 ? (
          <EmptySection
            icon="won"
            title="Nenhum arremate"
            description="Quando você vencer um lote, ele aparece aqui com o comprovante."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {won.map((lot) => (
              <WonCard key={lot.id} lot={lot} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="wins-bids-heading" className="flex flex-col gap-4">
        <SectionHeading id="wins-bids-heading" title="Lances" count={bids.length} />
        {bids.length === 0 ? (
          <EmptySection
            icon="bids"
            title="Nenhum lance"
            description="Os lotes em que você der lance aparecem aqui."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {bids.map((lot) => (
              <BidCard key={lot.id} lot={lot} />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
