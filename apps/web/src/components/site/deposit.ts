"use server"

import { API } from "@/api/server"

const maxCents = 999999999999

type DepositResult = {
  status: number
  message?: string
}

export async function depositCents(amount: number): Promise<DepositResult> {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > maxCents) {
    return { status: 400, message: "Informe um valor maior que zero." }
  }

  let response: Response

  try {
    response = await API.post("/wallet/deposits", { amount })
  } catch {
    return { status: 0, message: "Não foi possível depositar." }
  }

  if (response.ok) return { status: response.status }
  if (response.status === 401) return { status: 401 }

  let message = "Não foi possível depositar."

  try {
    const payload: unknown = await response.json()

    if (
      typeof payload === "object" &&
      payload !== null &&
      "detail" in payload &&
      typeof payload.detail === "string" &&
      payload.detail
    ) {
      message = payload.detail
    }
  } catch {
    // corpo vazio ou inválido
  }

  return { status: response.status, message }
}
