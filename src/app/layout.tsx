import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { NavBar } from "@/components/nav-bar";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Coeo COGS",
  description: "Coeo COGS & profitability mapping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans antialiased bg-cream text-text-primary`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
