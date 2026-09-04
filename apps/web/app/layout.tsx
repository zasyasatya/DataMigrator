import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sapa AI — Platform AI Agent untuk Customer Service",
  description:
    "Training, atur behaviour, simulasikan, dan embed AI agent chatbot ke website Anda dengan satu baris script.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
