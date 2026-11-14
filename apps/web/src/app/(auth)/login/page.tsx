import { cookies } from "next/headers"
import type { Metadata } from "next"

import { API, type SessionRole } from "@/api/server"

import LoginPageClient from "./page-client"

export const metadata: Metadata = {
  title: "Entrar — Arremata",
}

function internalPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null
  return value
}

async function login(
  email: string,
  password: string,
): Promise<{ status: number; role: SessionRole | null }> {
  "use server"

  const response = await API.post("/login", { email, password })

  if (response.status !== 201) return { status: response.status, role: null }

  let accessToken = ""

  try {
    const data = (await response.json()) as { access_token?: string }
    accessToken = data.access_token ?? ""
  } catch {
    accessToken = ""
  }

  const jar = await cookies()

  if (accessToken) {
    jar.set("TOKEN", accessToken, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    })
  }

  jar.set("ISAUTH", "true", {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
  })

  let role: SessionRole | null = null

  if (accessToken) {
    try {
      role = await API.sessionRole(accessToken)
    } catch {
      role = null
    }
  }

  return { status: response.status, role }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.next) ? params.next[0] : (params.next ?? null)

  return <LoginPageClient next={internalPath(raw)} login={login} />
}
