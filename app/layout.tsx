import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "KN商品 | KNレジ用QRコード作成";
  const description = "メーカー名・品番・金額から、KNレジで読み取れる商品QRコードを作成します。";

  return {
    title,
    description,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/kn-logo.png?v=2", type: "image/png", sizes: "256x256" }],
      shortcut: "/kn-logo.png?v=2",
      apple: "/kn-logo.png?v=2",
    },
    openGraph: { title, description, type: "website", images: [{ url: `${origin}/og.png`, width: 1536, height: 1024, alt: "KN商品の紹介画像" }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0c382f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
