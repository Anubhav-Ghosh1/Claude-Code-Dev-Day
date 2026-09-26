import type { Metadata } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const ui = Schibsted_Grotesk({ variable: "--font-ui", subsets: ["latin"] });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgentVault — least-privilege credentials for AI agents",
  description: "Scoped, time-bound credentials for AI agents with a hash-chained audit trail.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${code.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#222220", border: "1px solid #383835" } }} />
      </body>
    </html>
  );
}
