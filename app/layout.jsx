import "./globals.css";

export const metadata = {
  title: "Pay3 — Your gateway to Web3 finance",
  description:
    "Pay3 is a self-custody multi-chain wallet. Manage multiple wallets, import any coin, send and receive across 9 chains, connect to sites with WalletConnect — by mecozx.",
  metadataBase: new URL("https://pay3.space"),
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "Pay3 — Your gateway to Web3 finance",
    description: "Self-custody multi-chain wallet by mecozx.",
    url: "https://pay3.space",
    siteName: "Pay3",
    images: ["/logo.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c14",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
