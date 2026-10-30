"use client"

import { useRef, useState } from "react"
import { LogOut, Shield } from "lucide-react"

import { CardSearch, type SearchState } from "@/components/auctioneer/card-search"
import { LotForm } from "@/components/auctioneer/lot-form"
import { MyLots } from "@/components/auctioneer/my-lots"
import { auctioneerLogin } from "@/components/auctioneer/requests"
import type { AuctionLot, CatalogCard } from "@/components/auctioneer/model"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

type LotsPayload = { status: number; lots: AuctionLot[] }
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
}

export default function AuctioneerPageClient({
  initialLots,
  listLots,
  searchCards,
  createLot,
  cancelLot,
  logout,
}: {
  initialLots: LotsPayload
  listLots: () => Promise<LotsPayload>
  searchCards: (query: string) => Promise<{ status: number; cards: CatalogCard[] }>
  createLot: (body: LotDraft) => Promise<{ status: number }>
  cancelLot: (id: string) => Promise<{ status: number }>
  logout: () => Promise<void>
}) {
  const [query, setQuery] = useState("")
  const [queryError, setQueryError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [searchState, setSearchState] = useState<SearchState>("idle")
  const [cards, setCards] = useState<CatalogCard[]>([])
  const [selected, setSelected] = useState<CatalogCard | null>(null)
  const [revision, setRevision] = useState(0)
  const requestId = useRef(0)

  async function search() {
    const term = query.trim()
    if (!term) {
      setQueryError("Informe o nome da carta.")
      return
    }

    const id = requestId.current + 1
    requestId.current = id
    setPending(true)
    setQueryError(null)
    setSearchState("loading")

    try {
      const response = await searchCards(term)
      if (requestId.current !== id) return

      if (response.status === 401) {
        window.location.href = auctioneerLogin
        return
      }

      if (response.status < 200 || response.status >= 300) {
        setCards([])
        setSearchState("error")
        return
      }

      if (requestId.current !== id) return
      setCards(response.cards)
      setSelected((current) => (current && response.cards.some((card) => card.id === current.id) ? current : null))
      setSearchState(response.cards.length === 0 ? "empty" : "ready")
    } catch {
      if (requestId.current !== id) return
      setCards([])
      setSearchState("error")
    } finally {
      if (requestId.current === id) setPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-12">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col">
              <h1 className={cn(displayFont, "text-2xl tracking-tight text-primary uppercase")}>Arremata</h1>
              <p className="text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase">Painel do leiloeiro</p>
            </div>
            <Separator orientation="vertical" className="hidden h-6 w-px md:block" />
            <Badge variant="outline" className="hidden lg:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
              Custódia blindada
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">Leiloeiro oficial</Badge>
            <ThemeToggle />
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void logout().then(() => {
                  window.location.href = "/login"
                })
              }}
            >
              <LogOut data-icon="inline-start" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-6 py-8 lg:px-12">
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          <CardSearch
            query={query}
            queryError={queryError}
            onQueryChange={(value) => {
              setQuery(value)
              setQueryError(null)
            }}
            onSearch={() => void search()}
            pending={pending}
            state={searchState}
            cards={cards}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
          <LotForm card={selected} createLot={createLot} onCreated={() => setRevision((current) => current + 1)} />
        </div>
        <MyLots revision={revision} initialLots={initialLots} listLots={listLots} cancelLot={cancelLot} />
      </main>

      <footer className="relative mt-auto flex flex-col items-center gap-3 border-t border-border px-6 py-8 text-center">
        <p className="inline-flex items-center gap-2 text-sm">
          <Shield className="size-4 text-primary" aria-hidden />
          Casa de leilões de cartas raras e TCG.
        </p>
        <p className="text-[0.65rem] tracking-[0.14em] text-muted-foreground uppercase">
          © 2026 Arremata — autenticidade arquivística e alta custódia Pokémon TCG.
        </p>
      </footer>
    </div>
  )
}
