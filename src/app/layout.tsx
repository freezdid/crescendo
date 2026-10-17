import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Crescendo Quantum IA | Laboratoire d'Analyse Probabiliste & Prédictive",
  description: "Moteur quantique d'optimisation probabiliste et réseaux neuronaux d'analyse des tirages Crescendo.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSans.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
