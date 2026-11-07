import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sous — Your next move, simulated.",
  description:
    "NOVA hackathon restaurant operations simulator. Explore staffing, demand and pricing with deterministic synthetic data.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
