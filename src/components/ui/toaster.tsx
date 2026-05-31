"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

type ToastType = { id: string; title: string; description?: string; variant?: "success" | "error" | "default" };

const toastQueue: ToastType[] = [];
let setToasts: ((toasts: ToastType[]) => void) | null = null;

export function toast({ title, description, variant = "default" }: Omit<ToastType, "id">) {
  const id = Math.random().toString(36).slice(2);
  const t = { id, title, description, variant };
  toastQueue.push(t);
  setToasts?.([...toastQueue]);
  setTimeout(() => {
    const idx = toastQueue.findIndex((x) => x.id === id);
    if (idx !== -1) toastQueue.splice(idx, 1);
    setToasts?.([...toastQueue]);
  }, 3500);
}

export function Toaster() {
  const [toasts, _setToasts] = React.useState<ToastType[]>([]);

  React.useEffect(() => {
    setToasts = _setToasts;
    return () => { setToasts = null; };
  }, []);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          className={cn(
            "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
            t.variant === "success" && "bg-emerald-50 border-emerald-200",
            t.variant === "error" && "bg-red-50 border-red-200",
            t.variant === "default" && "bg-white border-gray-100"
          )}
        >
          <div className="flex items-start gap-3">
            {t.variant === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />}
            {t.variant === "error" && <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
            <div>
              <ToastPrimitive.Title className="text-sm font-semibold text-gray-900">{t.title}</ToastPrimitive.Title>
              {t.description && <ToastPrimitive.Description className="text-xs text-gray-500 mt-0.5">{t.description}</ToastPrimitive.Description>}
            </div>
          </div>
          <ToastPrimitive.Close className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4" />
    </ToastProvider>
  );
}
