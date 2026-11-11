import type { Metadata } from "next";
import {
  Plus_Jakarta_Sans,
  JetBrains_Mono,
  Space_Grotesk,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { MotionProvider } from "@/components/ui/motion-provider";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "PSG iTech SmartLab — Engineering Lab Equipment Portal",
  description:
    "Browse laboratory components, submit project borrow requests, reserve lab benches, and manage equipment returns at PSG Institute of Technology and Applied Research (PSG iTech).",
  keywords: [
    "PSG iTech",
    "PSG Institute of Technology and Applied Research",
    "component lending",
    "engineering lab inventory",
    "college hardware checkout",
    "laboratory booking",
    "smartlab",
  ],
  icons: {
    icon: "/images/psgitech-crest.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${playfair.variable}`}
    >
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
