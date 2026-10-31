"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Eye, EyeOff, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function LoginPageClient({
  next,
  login,
}: {
  next: string | null
  login: (email: string, password: string) => Promise<{ status: number }>
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const response = await login(nextEmail, password)

      if (response.status === 201) {
        window.location.href = next ?? "/auctioneer"
        return
      }

      if (response.status === 401) {
        setError("E-mail ou senha inválidos.")
        return
      }

      setError("Não foi possível entrar.")
    } catch {
      setError("Não foi possível entrar.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit}>
      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          Credencial de e-mail
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[4px] border border-input bg-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            id="login-email"
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
            aria-describedby={error ? "login-message" : undefined}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
            onChange={(event) => {
              setEmail(event.target.value)
              setError(null)
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="login-password" className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
          Chave de acesso / senha
        </label>
        <div className="flex h-11 items-center gap-2 rounded-[4px] border border-input bg-input px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-message" : undefined}
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
            className="rounded-[4px]"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      {error ? (
        <p id="login-message" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-12 w-full rounded-[4px] tracking-[0.14em] uppercase">
        {pending ? "Entrando…" : "Entrar"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não possui credencial?{" "}
        <Link
          href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
          className="text-primary underline-offset-4 hover:underline"
        >
          Criar conta
        </Link>
      </p>
    </form>
  )
}
