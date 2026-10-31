import type { Metadata } from "next"

import { API } from "@/api/server"
import { isShowcaseStatus, parseShowcaseLots, type LotsPayload, type ShowcaseStatus } from "@/components/lots/model"

import LotsPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Lotes — Arremata",
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

async function fetchLots(status: ShowcaseStatus): Promise<LotsPayload> {
  try {
    const response = await API.get("/lots", { status })
    if (!response.ok) return { status: response.status, lots: [] }

    const lots = parseShowcaseLots(await readPayload(response))
    if (!lots) return { status: 502, lots: [] }

    return { status: response.status, lots }
  } catch {
    return { status: 0, lots: [] }
  }
}

async function listLots(status: string): Promise<LotsPayload> {
  "use server"
  if (!isShowcaseStatus(status)) return { status: 400, lots: [] }
  return fetchLots(status)
}

export default async function LotsPage() {
  const initialLots = await fetchLots("live")

  return <LotsPageClient initialLots={initialLots} listLots={listLots} />
}
