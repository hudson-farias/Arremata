"use client"

import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { BidConsole } from "@/components/lots/bid-console"
import { ConditionReport } from "@/components/lots/condition-report"
import { LotShowcase } from "@/components/lots/lot-showcase"
import { formatLotMoney, type ShowcaseLot } from "@/components/lots/model"
import { reaisToCents } from "@/lib/money"

function reaisInput(cents: number | null): string {
  if (cents == null) return ""
  return (cents / 100).toFixed(2)
}

function parseReais(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed.includes(",") && !trimmed.includes(".") ? trimmed.replace(",", ".") : trimmed
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

function formatRemaining(endsAt: string, now: number): string | null {
  const end = Date.parse(endsAt)
  if (Number.isNaN(end)) return null

  const diff = end - now
  if (diff <= 0) return "Encerrado"

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`
}

export default function LotPageClient({ lot, condition }: { lot: ShowcaseLot; condition: string | null }) {
  const reference = lot.currentBid ?? lot.minimumBid
  const [amount, setAmount] = useState(() => reaisInput(reference))
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number | null>(null)

  const ticking = lot.status === "live" && Boolean(lot.endsAt)

  useEffect(() => {
    setNow(Date.now())
    if (!ticking) return

    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [ticking])

  const remaining = ticking && now != null && lot.endsAt ? formatRemaining(lot.endsAt, now) : null
  const open = lot.status === "live" && remaining !== "Encerrado"

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open) return

    const reais = parseReais(amount)
    const cents = reais == null ? null : reaisToCents(reais)

    if (cents == null) {
      setError("Informe um valor numérico.")
      return
    }

    if (reference == null) {
      setError("Não há lance de referência para este lote.")
      return
    }

    if (cents <= reference) {
      setError(`O lance precisa ser maior que ${formatLotMoney(reference)}.`)
      return
    }

    setError(null)
    toast.info("O envio do lance ainda não está disponível.")
  }

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <main className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-8 px-6 py-8 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <LotShowcase lot={lot} />
          <ConditionReport text={condition} />
        </div>
        <div className="lg:col-span-5">
          <BidConsole
            lot={lot}
            remaining={remaining}
            open={open}
            amount={amount}
            error={error}
            onAmountChange={(value) => {
              setAmount(value)
              setError(null)
            }}
            onSubmit={onSubmit}
          />
        </div>
      </main>
    </div>
  )
}
