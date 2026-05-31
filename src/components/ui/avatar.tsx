"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, User } from "lucide-react";
import { toast } from "@/components/ui/toaster";

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  telegramChatId?: string | null;
  size?: "sm" | "md" | "lg";
  editable?: boolean;
  userId?: string;
  onUpdated?: (url: string) => void;
}

const SIZE = { sm: 40, md: 48, lg: 72 };
const ICON = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-9 w-9" };
const RADIUS = { sm: "rounded-xl", md: "rounded-2xl", lg: "rounded-2xl" };

export function Avatar({ name, avatarUrl, telegramChatId, size = "md", editable = false, userId, onUpdated }: AvatarProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const px = SIZE[size];
  const currentUrl = preview || avatarUrl;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800_000) {
      toast({ title: "Imagen demasiado grande (máx 800 KB)", variant: "error" });
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreview(base64);

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, userId }),
      });

      if (res.ok) {
        toast({ title: "Foto actualizada ✓", variant: "success" });
        onUpdated?.(base64);
      } else {
        const d = await res.json();
        toast({ title: d.error || "Error al subir", variant: "error" });
        setPreview(null);
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      className="relative inline-block flex-shrink-0"
      style={{ width: px, height: px }}
    >
      {/* Avatar image or placeholder */}
      {currentUrl ? (
        <Image
          src={currentUrl}
          alt={name}
          width={px}
          height={px}
          className={`w-full h-full object-cover ${RADIUS[size]}`}
        />
      ) : (
        <div className={`w-full h-full ${RADIUS[size]} bg-orange-100 flex items-center justify-center`}>
          <User className={`${ICON[size]} text-orange-400`} aria-hidden="true" />
        </div>
      )}

      {/* Telegram LED */}
      {telegramChatId && (
        <span
          title="Telegram conectado"
          aria-label="Telegram conectado"
          className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"
        />
      )}

      {/* Upload overlay */}
      {editable && (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Cambiar foto de perfil"
            className={`absolute inset-0 ${RADIUS[size]} flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer`}
          >
            <Camera className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </>
      )}

      {/* Upload spinner */}
      {uploading && (
        <div className={`absolute inset-0 ${RADIUS[size]} flex items-center justify-center bg-white/70`}>
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
