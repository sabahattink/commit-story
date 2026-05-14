import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  metadataBase: new URL("https://commitstory.dev"),
  title: "commitstory — Your GitHub, Wrapped",
  description:
    "See your GitHub stats at a glance — commits, stars, languages, top repos. Share your Wrapped card.",
  openGraph: {
    title: "commitstory — Your GitHub, Wrapped",
    description: "See your GitHub stats: commits, stars, languages, and more.",
    url: "https://commitstory.dev",
    siteName: "commitstory",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "commitstory — Your GitHub, Wrapped",
    description: "See your GitHub stats at a glance.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark")document.documentElement.classList.add("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="antialiased" style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}>
        {children}
      </body>
    </html>
  );
}
