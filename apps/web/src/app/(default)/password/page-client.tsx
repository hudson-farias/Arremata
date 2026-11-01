"use client"

import { useState, type FormEvent } from "react"
import { Eye, EyeOff, KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

const displayFont = "[font-family:Georgia,Palatino,'Times_New_Roman',serif]"

type FormErrors = {
  current?: string
  next?: string
  confirm?: string
  form?: string
}

type ChangePassword = (
  currentPassword: string,
  password: string,
) => Promise<{ status: number; detail: string | null }>

function SecretField({
  id,
  name,
  label,
  autoComplete,
  value,
  error,
  onChange,
}: {
  id: string
  name: string
  label: string
  autoComplete: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const messageId = error ? `${id}-error` : undefined

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          onChange={(event) => onChange(event.target.value)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? <FieldError id={messageId}>{error}</FieldError> : null}
    </Field>
  )
}

export default function PasswordPageClient({ changePassword }: { changePassword: ChangePassword }) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  function edit(field: "current" | "next" | "confirm", value: string) {
    if (field === "current") setCurrentPassword(value)
    if (field === "next") setPassword(value)
    if (field === "confirm") setConfirmation(value)
    setSaved(false)
    setErrors((current) => ({ ...current, [field]: undefined, form: undefined }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const nextErrors: FormErrors = {}
    if (!currentPassword.trim()) nextErrors.current = "Informe a senha atual."
    if (!password.trim()) nextErrors.next = "Informe a nova senha."
    else if (password === currentPassword) nextErrors.next = "A nova senha precisa ser diferente da atual."
    if (!confirmation.trim()) nextErrors.confirm = "Confirme a nova senha."
    else if (password !== confirmation) nextErrors.confirm = "A confirmação não confere com a nova senha."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSaved(false)
      return
    }

    setPending(true)
    setErrors({})
    setSaved(false)

    try {
      const response = await changePassword(currentPassword, password)

      if (response.status === 401) {
        window.location.href = "/login?next=/password"
        return
      }

      if (response.status === 400 && response.detail === "senha atual inválida") {
        setErrors({ current: "A senha atual não confere." })
        return
      }

      if (response.status === 400 && response.detail === "senha igual") {
        setErrors({ next: "A nova senha precisa ser diferente da atual." })
        return
      }

      if (response.status !== 204) {
        setErrors({ form: "Não foi possível atualizar a senha." })
        return
      }

      setCurrentPassword("")
      setPassword("")
      setConfirmation("")
      setSaved(true)
      toast.success("Senha atualizada.")
    } catch {
      setErrors({ form: "Não foi possível atualizar a senha." })
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--primary),transparent_55%)] opacity-[0.07]"
      />

      <main className="relative mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-8 px-6 py-8 lg:px-12">
        <header className="flex max-w-xl flex-col gap-2">
          <p className="text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">Conta</p>
          <h1 className={cn(displayFont, "text-4xl tracking-tight text-primary")}>Mudar senha</h1>
          <p className="text-sm text-muted-foreground">
            Informe a senha atual e escolha uma nova. A sessão permanece aberta.
          </p>
        </header>

        <Card className="w-full max-w-xl rounded-[4px]">
          <CardHeader className="border-b">
            <div className="flex items-center gap-3">
              <KeyRound className="size-5 text-primary" aria-hidden />
              <div className="flex flex-col gap-1">
                <CardTitle>
                  <h2 className={cn(displayFont, "text-2xl tracking-tight")}>Nova chave de acesso</h2>
                </CardTitle>
                <CardDescription>A senha atual confirma que a troca é sua.</CardDescription>
              </div>
            </div>
          </CardHeader>

          <form className="flex flex-col" onSubmit={onSubmit}>
            <CardContent>
              <FieldGroup>
                {errors.form ? (
                  <Alert variant="destructive" className="rounded-[4px]">
                    <AlertTitle>Não foi possível atualizar a senha</AlertTitle>
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                ) : null}

                {saved ? (
                  <p role="status" className="text-sm text-primary">
                    Senha atualizada. A sessão permanece aberta.
                  </p>
                ) : null}

                <SecretField
                  id="current-password"
                  name="current-password"
                  label="Senha atual"
                  autoComplete="current-password"
                  value={currentPassword}
                  error={errors.current}
                  onChange={(value) => edit("current", value)}
                />
                <SecretField
                  id="new-password"
                  name="new-password"
                  label="Nova senha"
                  autoComplete="new-password"
                  value={password}
                  error={errors.next}
                  onChange={(value) => edit("next", value)}
                />
                <SecretField
                  id="confirm-password"
                  name="confirm-password"
                  label="Confirmar nova senha"
                  autoComplete="new-password"
                  value={confirmation}
                  error={errors.confirm}
                  onChange={(value) => edit("confirm", value)}
                />
              </FieldGroup>
            </CardContent>

            <CardFooter className="justify-end">
              <Button type="submit" disabled={pending} className="rounded-[4px] tracking-[0.12em] uppercase">
                {pending ? "Atualizando…" : "Atualizar senha"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}
