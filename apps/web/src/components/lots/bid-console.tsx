import type { FormEvent } from "react"
import { Clock, Gavel } from "lucide-react"

import {
  bidCountLabel,
  formatLotDate,
  formatLotMoney,
  statusLabel,
  type ShowcaseLot,
  type ShowcaseStatus,
} from "@/components/lots/model"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"

function StatusBadge({ status }: { status: ShowcaseStatus }) {
  const variant = status === "live" ? "default" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant}>
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function ClockReadout({ lot, remaining }: { lot: ShowcaseLot; remaining: string | null }) {
  if (lot.status === "closed" || remaining === "Encerrado") {
    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Pregão</span>
        <span className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
          <Clock className="size-3.5 text-primary" aria-hidden />
          Encerrado
        </span>
      </p>
    )
  }

  if (lot.status === "scheduled") {
    return (
      <p className="flex flex-col items-end gap-0.5 text-right">
        <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Início</span>
        <span className="inline-flex items-center gap-1.5 text-right font-mono text-sm text-foreground">
          <Clock className="size-3.5 shrink-0 text-primary" aria-hidden />
          {formatLotDate(lot.startsAt) ?? "—"}
        </span>
      </p>
    )
  }

  return (
    <p className="flex flex-col items-end gap-0.5 text-right">
      <span className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">Encerramento</span>
      <span role="timer" className="inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
        <Clock className="size-3.5 text-primary" aria-hidden />
        {remaining ?? "—"}
      </span>
    </p>
  )
}

export function BidConsole({
  lot,
  remaining,
  open,
  amount,
  error,
  onAmountChange,
  onSubmit,
}: {
  lot: ShowcaseLot
  remaining: string | null
  open: boolean
  amount: string
  error: string | null
  onAmountChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const hasCurrent = lot.currentBid != null
  const shown = hasCurrent ? lot.currentBid : lot.minimumBid
  const reference = lot.currentBid ?? lot.minimumBid
  const hintId = !open || reference != null ? "lot-bid-hint" : undefined
  const describedBy = [error ? "lot-bid-error" : null, hintId].filter(Boolean).join(" ") || undefined

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <StatusBadge status={lot.status} />
          <ClockReadout lot={lot} remaining={remaining} />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
          <span className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
            {hasCurrent ? "Lance atual" : "Lance mínimo"}
          </span>
          <p className="font-mono text-3xl text-primary">{formatLotMoney(shown)}</p>
          <p className="text-sm text-muted-foreground">{bidCountLabel(lot.bidCount)}</p>
        </div>

        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="lot-bid">Seu lance</FieldLabel>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <InputGroupText>R$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="lot-bid"
                name="bid"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                disabled={!open}
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </InputGroup>
            {open && reference != null ? (
              <FieldDescription id="lot-bid-hint">Precisa ser maior que {formatLotMoney(reference)}.</FieldDescription>
            ) : null}
            {error ? <FieldError id="lot-bid-error">{error}</FieldError> : null}
          </Field>

          <Button type="submit" className="h-11 w-full" disabled={!open}>
            <Gavel data-icon="inline-start" />
            Dar lance
          </Button>

          {open ? null : (
            <p id="lot-bid-hint" className="text-center text-sm text-muted-foreground">
              O pregão não está aberto.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
