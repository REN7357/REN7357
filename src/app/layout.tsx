import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BD Influencer Outreach System",
  description: "BD达人建联自动化管理系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.className}>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
