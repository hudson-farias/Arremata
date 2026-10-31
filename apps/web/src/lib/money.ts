const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

/** Inteiro da API em centavos. Recusa decimal e texto de moeda. */
export function parseCents(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null
    return value
  }

  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null

  const parsed = Number(value.trim())
  if (!Number.isSafeInteger(parsed)) return null
  return parsed
}

/** R$ 24.500,00 = 2450000 centavos. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100)
}

/** Reais digitados viram centavos inteiros positivos, arredondados. */
export function reaisToCents(reais: number): number | null {
  if (!Number.isFinite(reais) || reais <= 0) return null

  const cents = Math.round(reais * 100)
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}
