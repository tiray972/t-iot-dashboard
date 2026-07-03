import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "T-IOT-77 Dashboard",
  description: "Dashboard temps reel pour les donnees LoRa stockees dans Firebase"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
