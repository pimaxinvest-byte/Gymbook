import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GymBook — Gestión de Reservas",
  description: "Sistema de reservas para gimnasios. Creado por Pietro.",
  manifest: "/manifest.json",
  authors: [{ name: "Pietro" }],
  creator: "Pietro",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GymBook",
    startupImage: "/logo.svg",
  },
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "GymBook",
    description: "Sistema de reservas para gimnasios",
    type: "website",
    images: ["/logo.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <a href="#main-content" className="skip-link">Saltar al contenido</a>
        <Providers>
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
