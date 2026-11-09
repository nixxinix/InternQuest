import type { Metadata } from "next";
import { GameModeProvider } from "@/components/providers/GameModeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { Styleguide } from "./Styleguide";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

export default function StyleguidePage() {
  return (
    <GameModeProvider>
      <ToastProvider>
        <Styleguide />
      </ToastProvider>
    </GameModeProvider>
  );
}
