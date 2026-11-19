import type { Metadata } from "next";
import { TutorialCinema } from "@/components/tutorial-cinema";

export const metadata: Metadata = {
  title: "See KYVERA in action",
  description:
    "The two-minute KYVERA v5 product film, plus the previous overview and technical demonstration.",
};

export default function TutorialPage() {
  return <TutorialCinema />;
}
