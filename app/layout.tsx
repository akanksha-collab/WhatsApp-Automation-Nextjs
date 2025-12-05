import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "whatsapp-automation",
  description: "WhatsApp Automation - Schedule & Manage Posts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="min-h-screen bg-whatsapp-beige flex">
            {/* Sidebar */}
            <Sidebar />

            {/* Main content area */}
            <main className="flex-1 overflow-auto bg-white">
              <div className="max-w-7xl mx-auto p-8">
                {children}
              </div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
