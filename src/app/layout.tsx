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
  title: "SmartLab // College Component Lending & Lab Operations Platform",
  description:
    "Precision inventory tracking, borrowing workflows, serialized asset control, lab bookings, and maintenance operations for college engineering laboratories.",
  keywords: [
    "component lending",
    "engineering lab inventory",
    "college hardware checkout",
    "laboratory booking",
    "smartlab",
  ],
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
