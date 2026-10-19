import type { ReactNode } from "react";
import "../../../packages/ui/src/styles.css";
export const metadata = {
  title: "NEXUS — Response Intelligence | Operations",
  description:
    "Independent research simulation. This application cannot summon help.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG">
      <body>{children}</body>
    </html>
  );
}
