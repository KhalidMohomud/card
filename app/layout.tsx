import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CarWash POS", template: "%s · CarWash" },
  description: "Secure car wash point of sale and operations management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
