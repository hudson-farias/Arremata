"use client"

import { Landmark, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

import { CardPortrait } from "@/components/auctioneer/card-portrait"
import { cardImage, formatCollectorNumber, type CatalogCard } from "@/components/auctioneer/model"

export type SearchState = "idle" | "loading" | "error" | "empty" | "ready"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

type CardSearchProps = {
  query: string
  queryError: string | null
  onQueryChange: (value: string) => void
  onSearch: () => void
  pending: boolean
  state: SearchState
  cards: CatalogCard[]
  selectedId: string | null
  onSelect: (card: CatalogCard) => void
}

export function CardSearch({
  query,
  queryError,
  onQueryChange,
  onSearch,
  pending,
  state,
  cards,
  selectedId,
  onSelect,
}: CardSearchProps) {
  return (
    <Card className="relative isolate z-0 min-w-0 lg:col-span-5">
      <CardHeader className="border-b">
        <div className="flex items-center gap-3">
          <Landmark className="size-5 text-primary" aria-hidden />
          <div className="flex flex-col gap-1">
            <CardTitle>
              <h2 className={cn(displayFont, "text-2xl tracking-tight text-primary")}>Buscar carta</h2>
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSearch()
          }}
        >
          <FieldGroup>
            <Field data-invalid={queryError ? true : undefined}>
              <FieldLabel htmlFor="card-query" className="gap-0">
                Nome da carta <span className="text-destructive">*</span>
              </FieldLabel>
              <div className="flex items-center gap-2">
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="card-query"
                    value={query}
                    placeholder="Charizard"
                    aria-invalid={queryError ? true : undefined}
                    onChange={(event) => onQueryChange(event.target.value)}
                  />
                </InputGroup>
                <Button type="submit" className="h-11" disabled={pending}>
                  {pending ? <Spinner data-icon="inline-start" /> : null}
                  Buscar
                </Button>
              </div>
              {queryError ? <FieldError>{queryError}</FieldError> : null}
            </Field>
          </FieldGroup>
        </form>

        {state === "loading" ? (
          <div className="flex flex-col gap-3" role="status" aria-live="polite">
            <span className="sr-only">Buscando cartas</span>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}

        {state === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível buscar cartas</AlertTitle>
            <AlertDescription>O acervo não respondeu. Tente de novo em instantes.</AlertDescription>
          </Alert>
        ) : null}

        {state === "idle" ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>Nenhuma carta por aqui</EmptyTitle>
              <EmptyDescription>Busque pelo nome para escolher a carta do lote.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "empty" ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Search />
              </EmptyMedia>
              <EmptyTitle>Nenhuma carta encontrada</EmptyTitle>
              <EmptyDescription>Tente outro nome. Essa consulta não trouxe cartas do acervo.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {state === "ready" ? (
          <div className="relative z-10 flex min-w-0 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
                Resultados encontrados ({cards.length})
              </p>
              {selectedId ? <Badge variant="outline">1 selecionada</Badge> : null}
            </div>
            <ul className="flex max-h-96 min-w-0 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain">
              {cards.map((card) => {
                const selected = card.id === selectedId
                const image = cardImage(card)
                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-lg border bg-card p-3 text-left transition-colors",
                        selected ? "border-primary" : "border-border hover:bg-muted/40",
                      )}
                      onClick={() => onSelect(card)}
                    >
                      <div className="w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                        <CardPortrait key={image ?? card.id} src={image} alt="" className="aspect-[3/4] w-full" />
                      </div>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn("truncate text-base", selected ? "text-primary" : "text-foreground")}>
                            {card.name}
                          </span>
                          {selected ? <span className="text-xs text-primary">Selecionada</span> : null}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[card.setName, card.rarity].filter(Boolean).join(", ") || "Sem edição"}
                        </span>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{formatCollectorNumber(card.number)}</Badge>
                          {card.rarity ? <Badge variant="outline">{card.rarity}</Badge> : null}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </CardContent>

    </Card>
  )
}
