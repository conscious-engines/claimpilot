import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimPilot",
  description: "AI-powered insurance claim management for vehicle financing",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ minHeight: "100vh", background: "#f8fafc" }}>{children}</body>
    </html>
  );
}
