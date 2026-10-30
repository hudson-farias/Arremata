import { cookies } from "next/headers"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { API } from "@/api/server"
import { parseCards, parseLots, type AuctionLot, type CatalogCard } from "@/components/auctioneer/model"

import AuctioneerPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Painel do leiloeiro — Arremata",
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
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function fetchLots(): Promise<{ status: number; lots: AuctionLot[] }> {
  const response = await API.get("/auctioneer/lots")
  if (!response.ok) return { status: response.status, lots: [] }
  return { status: response.status, lots: parseLots(await readPayload(response)) }
}

async function listLots(): Promise<{ status: number; lots: AuctionLot[] }> {
  "use server"
  return fetchLots()
}

async function searchCards(query: string): Promise<{ status: number; cards: CatalogCard[] }> {
  "use server"
  const response = await API.get("/cards", { q: query })
  if (!response.ok) return { status: response.status, cards: [] }
  return { status: response.status, cards: parseCards(await readPayload(response)) }
}

async function createLot(body: LotDraft): Promise<{ status: number }> {
  "use server"
  const response = await API.post("/auctioneer/lots", body)
  return { status: response.status }
}

async function cancelLot(id: string): Promise<{ status: number }> {
  "use server"
  const response = await API.delete(`/auctioneer/lots/${encodeURIComponent(id)}`)
  return { status: response.status }
}

async function logout() {
  "use server"
  const jar = await cookies()
  jar.set("TOKEN", "", { path: "/", maxAge: 0 })
  jar.set("ISAUTH", "", { path: "/", maxAge: 0 })
}

export default async function AuctioneerPage() {
  const initialLots = await fetchLots()

  if (initialLots.status === 401) {
    redirect("/login?next=/auctioneer")
  }

  return (
    <AuctioneerPageClient
      initialLots={initialLots}
      listLots={listLots}
      searchCards={searchCards}
      createLot={createLot}
      cancelLot={cancelLot}
      logout={logout}
    />
  )
}
