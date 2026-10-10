import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Butter — a little clarity from your notes",
  description: "Your local notes assistant, with a thoughtful team of three agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WorkspaceProvider><AppShell>{children}</AppShell></WorkspaceProvider></body></html>;
}
