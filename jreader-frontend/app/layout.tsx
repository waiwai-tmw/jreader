import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { cookies } from 'next/headers'
import PlausibleProvider from 'next-plausible'

import ClientRoot from './client-root'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "JReader",
  description: "Japanese reading companion",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read sidebar state from cookie on server side
  const cookieStore = await cookies()
  const sidebarCookie = cookieStore.get('sidebar:state')
  const defaultOpen = sidebarCookie ? sidebarCookie.value === 'true' : true

  return (
    <html lang="en" className="overflow-hidden h-[100dvh]" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-hidden h-full`}
      >
        <PlausibleProvider domain="jreader.moe">
          <ClientRoot defaultOpen={defaultOpen}>
            {children}
          </ClientRoot>
        </PlausibleProvider>
      </body>
    </html>
  );
}
