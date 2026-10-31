"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { depositCents } from "@/components/site/deposit"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { reaisToCents } from "@/lib/money"

function parseReais(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const normalized = trimmed.includes(",") && !trimmed.includes(".") ? trimmed.replace(",", ".") : trimmed
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null

  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

export function DepositDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function onOpenChange(next: boolean) {
    if (pending) return
    setOpen(next)
    if (!next) {
      setAmount("")
      setError(null)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const reais = parseReais(amount)
    const cents = reais == null ? null : reaisToCents(reais)

    if (cents == null) {
      setError("Informe um valor maior que zero.")
      return
    }

    setPending(true)
    setError(null)

    try {
      const result = await depositCents(cents)

      if (result.status === 401) {
        window.location.href = "/login"
        return
      }

      if (result.status < 200 || result.status >= 300) {
        setError(result.message ?? "Não foi possível depositar.")
        return
      }

      setOpen(false)
      setAmount("")
      setError(null)
      toast.success("Depósito realizado.")
      router.refresh()
    } catch {
      setError("Não foi possível depositar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button">Depositar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Depositar</DialogTitle>
          <DialogDescription>Informe o valor em reais. O saldo total é creditado na hora.</DialogDescription>
        </DialogHeader>
        <form id="deposit-form" onSubmit={onSubmit}>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="deposit-amount">Valor</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>R$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="deposit-amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="10,00"
                value={amount}
                aria-invalid={error ? true : undefined}
                disabled={pending}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setError(null)
                }}
              />
            </InputGroup>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </form>
        <DialogFooter>
          <Button type="submit" form="deposit-form" disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
