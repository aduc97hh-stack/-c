import { Pwa } from "@/features/operations/pwa";
import type { Metadata, Viewport } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "GAMI OS",
  description: "Hệ thống vận hành nội bộ Anh ngữ Gami",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "GAMI OS", statusBarStyle: "default" },
  icons: { apple: "/icons/gami-192.png" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#006c59",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <Pwa />
        {children}
      </body>
    </html>
  );
}
