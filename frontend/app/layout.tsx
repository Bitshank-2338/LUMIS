import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMIS — AI Bias Audit Platform",
  description:
    "Plug-and-play AI bias auditing. EU AI Act, EEOC, ECOA, GDPR compliance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-grid-pattern bg-[size:48px_48px] opacity-30" />
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-accent-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-accent-secondary/10 blur-[120px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
