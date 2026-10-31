"use client"

import { useRef, useState } from "react"

import { CardSearch, type SearchState } from "@/components/auctioneer/card-search"
import { LotForm } from "@/components/auctioneer/lot-form"
import { MyLots } from "@/components/auctioneer/my-lots"
import { auctioneerLogin } from "@/components/auctioneer/requests"
import type { AuctionLot, CatalogCard } from "@/components/auctioneer/model"

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
}: {
  initialLots: LotsPayload
  listLots: () => Promise<LotsPayload>
  searchCards: (query: string) => Promise<{ status: number; cards: CatalogCard[] }>
  createLot: (body: LotDraft) => Promise<{ status: number }>
  cancelLot: (id: string) => Promise<{ status: number }>
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
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

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
    </div>
  )
}
