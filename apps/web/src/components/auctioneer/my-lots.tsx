"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Clock, Table2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { reaisToCents } from "@/lib/money"
import { cn } from "@/lib/utils"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import {
  canCancelLot,
  formatCollectorNumber,
  formatMoney,
  minimumBidTotal,
  receivedTotal,
  statusLabel,
  type AuctionLot,
  type LotStatus,
} from "@/components/auctioneer/model"
import { auctioneerLogin } from "@/components/auctioneer/requests"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const maxCents = 999999999999

type LotsState = "loading" | "error" | "empty" | "ready"

type LotsPayload = { status: number; lots: AuctionLot[] }

export type LotPatch = {
  title: string
  starts_at: string
  ends_at: string
  minimum_bid: number
  increment: number
}

type FormErrors = {
  title?: string
  starts?: string
  ends?: string
  minimum?: string
  increment?: string
  form?: string
}

function viewOf(payload: LotsPayload): { lots: AuctionLot[]; state: LotsState } {
  if (payload.status < 200 || payload.status >= 300) return { lots: [], state: "error" }
  if (payload.lots.length === 0) return { lots: [], state: "empty" }
  return { lots: payload.lots, state: "ready" }
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function toDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function isoToLocalInput(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return toDatetimeLocal(date)
}

function toIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function centsToInput(cents: number | null): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}

function StatusBadge({ status }: { status: LotStatus | null }) {
  const variant =
    status === "live" ? "default" : status === "cancelled" ? "destructive" : status === "closed" ? "secondary" : "outline"

  return (
    <Badge variant={variant}>
      {status === "live" ? <span className="size-1.5 animate-pulse rounded-full bg-primary-foreground" aria-hidden /> : null}
      {status === "scheduled" ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
      {statusLabel(status)}
    </Badge>
  )
}

function ClosedOutcome({ lot }: { lot: AuctionLot }) {
  const winner = lot.result?.winner
  if (winner == null) {
    return <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Sem arremate</span>
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Arrematado</span>
      <span className="font-mono text-sm text-primary">{formatMoney(lot.result?.amount ?? null)}</span>
      <span className="text-xs text-foreground">Licitante #{winner}</span>
    </span>
  )
}

function ViewLotLink({ id }: { id: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/lots/${id}`}>Visualizar lote</Link>
    </Button>
  )
}

function LotActions({
  lot,
  onCancel,
  onEdit,
}: {
  lot: AuctionLot
  onCancel: (lot: AuctionLot) => void
  onEdit: (lot: AuctionLot) => void
}) {
  const scheduled = lot.status === "scheduled"
  const closed = lot.status === "closed"
  const view = scheduled || lot.status === "live" || closed
  const cancel = canCancelLot(lot)

  if (!view && !cancel) return null

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {closed ? <ClosedOutcome lot={lot} /> : null}
      {view ? <ViewLotLink id={lot.id} /> : null}
      {scheduled ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onEdit(lot)}>
          Editar
        </Button>
      ) : null}
      {cancel ? (
        <Button type="button" variant="outline" size="sm" onClick={() => onCancel(lot)}>
          Cancelar
        </Button>
      ) : null}
    </div>
  )
}

export function MyLots({
  revision,
  initialLots,
  listLots,
  cancelLot,
  updateLot,
}: {
  revision: number
  initialLots: LotsPayload
  listLots: () => Promise<LotsPayload>
  cancelLot: (id: string) => Promise<{ status: number }>
  updateLot: (id: string, body: LotPatch) => Promise<{ status: number }>
}) {
  const initial = viewOf(initialLots)
  const [lots, setLots] = useState<AuctionLot[]>(initial.lots)
  const [state, setState] = useState<LotsState>(initial.state)
  const [target, setTarget] = useState<AuctionLot | null>(null)
  const [editing, setEditing] = useState<AuctionLot | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [minimum, setMinimum] = useState("")
  const [increment, setIncrement] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [reload, setReload] = useState(0)
  const skipReload = useRef(true)

  useEffect(() => {
    if (!editing) return
    setTitle(editing.title)
    setStartsAt(isoToLocalInput(editing.startsAt))
    setEndsAt(isoToLocalInput(editing.endsAt))
    setMinimum(centsToInput(editing.minimumBid))
    setIncrement(centsToInput(editing.increment))
    setErrors({})
  }, [editing])

  useEffect(() => {
    if (skipReload.current) {
      skipReload.current = false
      return
    }

    let active = true

    async function load() {
      setState("loading")
      try {
        const payload = await listLots()
        if (!active) return
        if (payload.status === 401) {
          window.location.href = auctioneerLogin
          return
        }

        const next = viewOf(payload)
        setLots(next.lots)
        setState(next.state)
      } catch {
        if (!active) return
        setLots([])
        setState("error")
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [revision, reload, listLots])

  async function confirmCancel() {
    if (!target || cancelling) return
    setCancelling(true)

    try {
      const response = await cancelLot(target.id)
      if (response.status === 401) {
        window.location.href = auctioneerLogin
        return
      }

      if (response.status < 200 || response.status >= 300) {
        toast.error("Não foi possível cancelar o lote.")
        return
      }

      toast.success("Lote cancelado.")
      setTarget(null)
      setReload((current) => current + 1)
    } catch {
      toast.error("Não foi possível cancelar o lote.")
    } finally {
      setCancelling(false)
    }
  }

  async function saveLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || saving) return

    const nextErrors: FormErrors = {}
    const trimmedTitle = title.trim()
    const startIso = toIso(startsAt)
    const endIso = toIso(endsAt)
    const minimumBid = reaisToCents(Number(minimum))
    const incrementCents = increment.trim() ? reaisToCents(Number(increment)) : null

    if (!trimmedTitle) nextErrors.title = "Informe o título do lote."
    if (!startIso) nextErrors.starts = "Informe o início do pregão."
    if (!endIso) nextErrors.ends = "Informe o fim do pregão."
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
      nextErrors.ends = "O fim precisa ser depois do início."
    }
    if (minimumBid == null) {
      nextErrors.minimum = "Informe um lance mínimo maior que zero."
    }
    if (incrementCents == null) nextErrors.increment = "Informe um incremento maior que zero."
    else if (incrementCents > maxCents) nextErrors.increment = "O incremento passa do teto."

    if (Object.keys(nextErrors).length > 0 || !startIso || !endIso || minimumBid == null || incrementCents == null) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      const response = await updateLot(editing.id, {
        title: trimmedTitle,
        starts_at: startIso,
        ends_at: endIso,
        minimum_bid: minimumBid,
        increment: incrementCents,
      })

      if (response.status === 401) {
        window.location.href = auctioneerLogin
        return
      }

      if (response.status === 409) {
        const message = "O lote já começou e não pode mais ser editado."
        setErrors({ form: message })
        toast.error(message)
        return
      }

      if (response.status < 200 || response.status >= 300) {
        const message = "Não foi possível editar o lote."
        setErrors({ form: message })
        toast.error(message)
        return
      }

      toast.success("Lote atualizado.")
      setEditing(null)
      setReload((current) => current + 1)
    } catch {
      const message = "Não foi possível editar o lote."
      setErrors({ form: message })
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const listed = state === "ready" ? lots : []
  const total = minimumBidTotal(listed)
  const received = receivedTotal(listed)

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Table2 className="size-5 text-primary" aria-hidden />
            <div className="flex flex-col gap-1">
              <CardTitle>
                <h2 className={cn(displayFont, "text-2xl tracking-tight text-primary")}>Meus lotes</h2>
              </CardTitle>
            </div>
          </div>
          {state === "ready" ? (
            <div className="flex flex-col gap-1 sm:items-end">
              <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
                Lances mínimos
                <span className="font-mono text-sm text-primary">{formatMoney(total)}</span>
              </p>
              <p className="flex items-center gap-2 text-xs tracking-[0.12em] text-muted-foreground uppercase">
                Recebido
                <span className="font-mono text-sm text-primary">{formatMoney(received)}</span>
              </p>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent>
        {state === "loading" ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <span className="sr-only">Carregando lotes</span>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : null}

        {state === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os lotes</AlertTitle>
            <AlertDescription>A lista fica vazia até a API responder. O restante do painel continua disponível.</AlertDescription>
          </Alert>
        ) : null}

        {state === "empty" ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Table2 />
              </EmptyMedia>
              <EmptyTitle>Nenhum lote</EmptyTitle>
              <EmptyDescription>Os lotes que você criar aparecem aqui, com o selo de status.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "ready" ? (
          <Table containerClassName="max-h-96 overflow-y-auto overscroll-y-contain">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="bg-card">Lote</TableHead>
                <TableHead className="bg-card">Edição</TableHead>
                <TableHead className="bg-card">Lance mínimo</TableHead>
                <TableHead className="bg-card">Status</TableHead>
                <TableHead className="bg-card text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => (
                <TableRow key={lot.id} className={cn(lot.status === "closed" && "opacity-75")}>
                  <TableCell className="whitespace-normal">
                    <div className="flex items-center gap-3">
                      <div className="w-10 shrink-0 overflow-hidden rounded-md border border-border bg-background">
                        <CardPortrait key={lot.imageUrl ?? lot.id} src={lot.imageUrl} alt="" className="aspect-[3/4] w-full" />
                      </div>
                      <span className="font-medium">{lot.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="block">{lot.setName || "—"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[lot.rarity, formatCollectorNumber(lot.number)].filter((item) => item && item !== "—").join(" · ") || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-primary">{formatMoney(lot.minimumBid)}</TableCell>
                  <TableCell>
                    <StatusBadge status={lot.status} />
                  </TableCell>
                  <TableCell className="text-right whitespace-normal">
                    <LotActions lot={lot} onCancel={setTarget} onEdit={setEditing} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>

      <Dialog
        open={target != null}
        onOpenChange={(open) => {
          if (!open && !cancelling) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar lote</DialogTitle>
            <DialogDescription>
              {target
                ? `${target.title} sai do pregão. Se houver líder, o valor comprometido volta ao disponível na hora.`
                : "Confirme o cancelamento do lote."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={cancelling} onClick={() => setTarget(null)}>
              Voltar
            </Button>
            <Button type="button" variant="destructive" disabled={cancelling} onClick={() => void confirmCancel()}>
              {cancelling ? <Spinner data-icon="inline-start" /> : null}
              Cancelar lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing != null}
        onOpenChange={(open) => {
          if (!open && !saving) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <form className="contents" onSubmit={(event) => void saveLot(event)}>
            <DialogHeader>
              <DialogTitle>Editar lote</DialogTitle>
              <DialogDescription>A carta não se troca. Ajuste o título, o cronograma, o lance mínimo e o incremento.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              {errors.form ? (
                <Alert variant="destructive">
                  <AlertTitle>Não foi possível editar o lote</AlertTitle>
                  <AlertDescription>{errors.form}</AlertDescription>
                </Alert>
              ) : null}

              <FieldGroup>
                <Field data-invalid={errors.title ? true : undefined}>
                  <FieldLabel htmlFor="edit-lot-title">Título do lote</FieldLabel>
                  <Input
                    id="edit-lot-title"
                    value={title}
                    maxLength={120}
                    aria-invalid={errors.title ? true : undefined}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                  {errors.title ? <FieldError>{errors.title}</FieldError> : null}
                </Field>
              </FieldGroup>

              <FieldSet className="rounded-lg border border-border bg-muted/40 p-3">
                <FieldLegend className="text-xs tracking-[0.14em] text-primary uppercase">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5" aria-hidden />
                    Cronograma do pregão
                  </span>
                </FieldLegend>
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={errors.starts ? true : undefined}>
                    <FieldLabel htmlFor="edit-lot-start">Início</FieldLabel>
                    <Input
                      id="edit-lot-start"
                      type="datetime-local"
                      value={startsAt}
                      aria-invalid={errors.starts ? true : undefined}
                      onChange={(event) => setStartsAt(event.target.value)}
                    />
                    {errors.starts ? <FieldError>{errors.starts}</FieldError> : null}
                  </Field>
                  <Field data-invalid={errors.ends ? true : undefined}>
                    <FieldLabel htmlFor="edit-lot-end">Fim</FieldLabel>
                    <Input
                      id="edit-lot-end"
                      type="datetime-local"
                      value={endsAt}
                      aria-invalid={errors.ends ? true : undefined}
                      onChange={(event) => setEndsAt(event.target.value)}
                    />
                    {errors.ends ? <FieldError>{errors.ends}</FieldError> : null}
                  </Field>
                </FieldGroup>
              </FieldSet>

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.minimum ? true : undefined}>
                  <FieldLabel htmlFor="edit-lot-minimum">Lance mínimo</FieldLabel>
                  <InputGroup className="h-11">
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="edit-lot-minimum"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={minimum}
                      placeholder="1500.00"
                      aria-invalid={errors.minimum ? true : undefined}
                      onChange={(event) => setMinimum(event.target.value)}
                    />
                  </InputGroup>
                  {errors.minimum ? <FieldError>{errors.minimum}</FieldError> : null}
                </Field>
                <Field data-invalid={errors.increment ? true : undefined}>
                  <FieldLabel htmlFor="edit-lot-increment">Incremento</FieldLabel>
                  <InputGroup className="h-11">
                    <InputGroupAddon>
                      <InputGroupText>R$</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="edit-lot-increment"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={increment}
                      placeholder="100.00"
                      aria-invalid={errors.increment ? true : undefined}
                      onChange={(event) => setIncrement(event.target.value)}
                    />
                  </InputGroup>
                  {errors.increment ? <FieldError>{errors.increment}</FieldError> : null}
                </Field>
              </FieldGroup>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>
                Voltar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
