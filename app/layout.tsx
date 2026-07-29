import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SwiftWash POS", template: "%s · SwiftWash" },
  description: "Secure car wash point of sale and operations management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
