"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Eye, EyeOff, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function loginHref(next: string | null): string {
  return `/login?next=${encodeURIComponent(next ?? "/auctioneer")}`
}

export default function RegisterPageClient({
  next,
  register,
}: {
  next: string | null
  register: (email: string, password: string) => Promise<{ status: number }>
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const nextEmail = email.trim()
    if (!nextEmail || !password) {
      setError("Informe e-mail e senha.")
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await register(nextEmail, password)

      if (response.status === 201) {
        setPassword("")
        setSuccess(true)
        window.location.href = loginHref(next)
        return
      }

      if (response.status === 409) {
        setError("Este e-mail já está cadastrado.")
        return
      }

      setError("Não foi possível criar a conta.")
    } catch {
      setError("Não foi possível criar a conta.")
    } finally {
      setPending(false)
    }
  }

  if (success) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-foreground">Conta criada.</p>
        <Link href={loginHref(next)} className="text-sm text-primary underline-offset-4 hover:underline">
          Entrar
        </Link>
      </div>
    )
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <label htmlFor="register-email" className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          Credencial de e-mail
        </label>
        <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            id="register-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            placeholder="investidor@arremata.com.br"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "register-message" : undefined}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="register-password" className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          Chave de acesso / senha
        </label>
        <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Input
            id="register-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "register-message" : undefined}
            className="h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => {
              setPassword(event.target.value)
              setError(null)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      {error ? (
        <p id="register-message" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-12 w-full tracking-[0.14em] uppercase">
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Já possui credencial?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </form>
  )
}
