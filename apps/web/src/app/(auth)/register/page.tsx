import type { Metadata } from "next"

import { API } from "@/api/server"

import RegisterPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Criar conta — Arremata",
}

function internalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null
  return value
}

async function register(email: string, password: string): Promise<{ status: number }> {
  "use server"

  const response = await API.post("/register", { email, password })
  return { status: response.status }
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.next) ? params.next[0] : (params.next ?? null)

  return <RegisterPageClient next={internalPath(raw)} register={register} />
}
