import type { ReactNode } from "react"

import { API } from "@/api/server"
import { parseOpenLots, type OpenLotsPayload } from "@/components/auth/live-lot"

import AuthLayoutClient from "./layout-client"

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

async function fetchOpenLots(): Promise<OpenLotsPayload> {
  try {
    const response = await API.get("/lots", { status: "live" })
    if (!response.ok) return { ok: false, lots: [] }

    const lots = parseOpenLots(await readPayload(response))
    if (!lots) return { ok: false, lots: [] }

    return { ok: true, lots }
  } catch {
    return { ok: false, lots: [] }
  }
}

async function loadOpenLots(): Promise<OpenLotsPayload> {
  "use server"
  return fetchOpenLots()
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const initialLots = await fetchOpenLots()

  return (
    <AuthLayoutClient initialLots={initialLots} loadOpenLots={loadOpenLots}>
      {children}
    </AuthLayoutClient>
  )
}
