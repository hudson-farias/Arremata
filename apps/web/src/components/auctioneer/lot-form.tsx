"use client"

import { useEffect, useState, type FormEvent } from "react"
import { CirclePlus, Clock, Gavel } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import { cardImage, defaultLotTitle, formatCollectorNumber, type CatalogCard } from "@/components/auctioneer/model"
import { auctioneerLogin } from "@/components/auctioneer/requests"
import { reaisToCents } from "@/lib/money"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

const defaultIncrementCents = 10000
const maxCents = 999999999999

type FormErrors = {
  title?: string
  starts?: string
  ends?: string
  minimum?: string
  increment?: string
  form?: string
}

type LotDraft = {
  card_id: string
  title: string
  image_url: string
  attributes: {
    set_name: string
    rarity: string
    number: string
  }
  starts_at: string
  ends_at: string
  minimum_bid: number
  increment: number
}

type LotFormProps = {
  card: CatalogCard | null
  onCreated: () => void
  createLot: (body: LotDraft) => Promise<{ status: number }>
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

function toDatetimeLocal(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function upcomingWindow() {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() + 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 2)
  return { start: toDatetimeLocal(start), end: toDatetimeLocal(end) }
}

function toIso(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function LotForm({ card, onCreated, createLot }: LotFormProps) {
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [endsAt, setEndsAt] = useState("")
  const [minimum, setMinimum] = useState("")
  const [increment, setIncrement] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!card) return
    const schedule = upcomingWindow()
    setTitle(defaultLotTitle(card))
    setStartsAt(schedule.start)
    setEndsAt(schedule.end)
    setMinimum("")
    setIncrement("")
    setErrors({})
  }, [card])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!card || pending) return

    const nextErrors: FormErrors = {}
    const trimmedTitle = title.trim()
    const startIso = toIso(startsAt)
    const endIso = toIso(endsAt)
    const minimumBid = reaisToCents(Number(minimum))
    let incrementCents = defaultIncrementCents
    const imageUrl = cardImage(card)

    if (!trimmedTitle) nextErrors.title = "Informe o título do lote."
    if (!startIso) nextErrors.starts = "Informe o início do pregão."
    if (!endIso) nextErrors.ends = "Informe o fim do pregão."
    if (startIso && endIso && Date.parse(endIso) <= Date.parse(startIso)) {
      nextErrors.ends = "O fim precisa ser depois do início."
    }
    if (minimumBid == null) {
      nextErrors.minimum = "Informe um lance mínimo maior que zero."
    }
    if (increment.trim()) {
      const parsed = reaisToCents(Number(increment))
      if (parsed == null) nextErrors.increment = "Informe um incremento maior que zero."
      else if (parsed > maxCents) nextErrors.increment = "O incremento passa do teto."
      else incrementCents = parsed
    }
    if (!imageUrl) nextErrors.form = "Esta carta não tem imagem no catálogo."

    if (Object.keys(nextErrors).length > 0 || !startIso || !endIso || !imageUrl || minimumBid == null) {
      setErrors(nextErrors)
      return
    }

    setPending(true)
    setErrors({})

    try {
      const response = await createLot({
        card_id: card.id,
        title: trimmedTitle,
        image_url: imageUrl,
        attributes: {
          set_name: card.setName,
          rarity: card.rarity,
          number: card.number,
        },
        starts_at: startIso,
        ends_at: endIso,
        minimum_bid: minimumBid,
        increment: incrementCents,
      })

      if (response.status === 401) {
        window.location.href = auctioneerLogin
        return
      }

      if (response.status < 200 || response.status >= 300) {
        const message = "Não foi possível criar o lote."
        setErrors({ form: message })
        toast.error(message)
        return
      }

      toast.success("Lote criado.")
      onCreated()
    } catch {
      const message = "Não foi possível criar o lote."
      setErrors({ form: message })
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className="relative isolate z-0 min-w-0 lg:col-span-7">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <Gavel className="size-5 text-primary" aria-hidden />
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2 className={cn(displayFont, "text-2xl tracking-tight text-primary")}>Novo lote</h2>
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      {card ? (
        <form onSubmit={onSubmit}>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-12">
              <figure className="flex flex-col gap-2 md:col-span-5">
                <div className="overflow-hidden rounded-lg border border-border bg-background p-2">
                  <CardPortrait
                    key={cardImage(card) ?? card.id}
                    src={cardImage(card)}
                    alt={card.name}
                    className="aspect-[63/88] w-full rounded-lg"
                  />
                </div>
              </figure>

              <div className="flex flex-col gap-4 md:col-span-7">
                {errors.form ? (
                  <Alert variant="destructive">
                    <AlertTitle>Não foi possível criar o lote</AlertTitle>
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                ) : null}

                <FieldGroup>
                  <Field data-invalid={errors.title ? true : undefined}>
                    <FieldLabel htmlFor="lot-title" className="gap-0">
                      Título do lote <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      id="lot-title"
                      value={title}
                      maxLength={120}
                      aria-invalid={errors.title ? true : undefined}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                    {errors.title ? <FieldError>{errors.title}</FieldError> : null}
                  </Field>
                </FieldGroup>

                <div className="flex flex-col gap-2">
                  <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">Atributos</p>
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2.5">
                      <dt className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                        Edição <span className="tracking-normal normal-case">(opcional)</span>
                      </dt>
                      <dd className="truncate text-sm">{card.setName || "—"}</dd>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2.5">
                      <dt className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                        Raridade <span className="tracking-normal normal-case">(opcional)</span>
                      </dt>
                      <dd className="truncate text-sm text-primary">{card.rarity || "—"}</dd>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-2.5">
                      <dt className="text-[0.65rem] tracking-[0.12em] text-muted-foreground uppercase">
                        Número <span className="tracking-normal normal-case">(opcional)</span>
                      </dt>
                      <dd className="truncate text-sm">{formatCollectorNumber(card.number)}</dd>
                    </div>
                  </dl>
                </div>

                <FieldSet className="rounded-lg border border-border bg-muted/40 p-3">
                  <FieldLegend className="text-xs tracking-[0.14em] text-primary uppercase">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-3.5" aria-hidden />
                      Cronograma do pregão
                    </span>
                  </FieldLegend>
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field data-invalid={errors.starts ? true : undefined}>
                      <FieldLabel htmlFor="lot-start" className="gap-0">
                        Início <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="lot-start"
                        type="datetime-local"
                        value={startsAt}
                        aria-invalid={errors.starts ? true : undefined}
                        onChange={(event) => setStartsAt(event.target.value)}
                      />
                      {errors.starts ? <FieldError>{errors.starts}</FieldError> : null}
                    </Field>
                    <Field data-invalid={errors.ends ? true : undefined}>
                      <FieldLabel htmlFor="lot-end" className="gap-0">
                        Fim <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="lot-end"
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
                    <FieldLabel htmlFor="lot-minimum" className="gap-0">
                      Lance mínimo <span className="text-destructive">*</span>
                    </FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupAddon>
                        <InputGroupText>R$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="lot-minimum"
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
                    <FieldLabel htmlFor="lot-increment" className="gap-1">
                      Incremento <span className="font-normal text-muted-foreground">(opcional)</span>
                    </FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupAddon>
                        <InputGroupText>R$</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        id="lot-increment"
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
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Spinner data-icon="inline-start" /> : <CirclePlus data-icon="inline-start" />}
              Criar lote
            </Button>
          </CardFooter>
        </form>
      ) : (
        <CardContent>
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Gavel />
              </EmptyMedia>
              <EmptyTitle>Nenhuma carta selecionada</EmptyTitle>
              <EmptyDescription>Escolha uma carta na busca. A imagem do lote é a da carta.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      )}
    </Card>
  )
}
