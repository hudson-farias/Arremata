"use client"

import { useState } from "react"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"

export function CardPortrait({
  src,
  alt,
  className,
}: {
  src: string | null
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="size-4" aria-hidden />
      </div>
    )
  }

  return <img src={src} alt={alt} className={cn("object-cover", className)} onError={() => setFailed(true)} />
}
