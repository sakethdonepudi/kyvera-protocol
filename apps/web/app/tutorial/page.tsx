import type { Metadata } from "next";
import { TutorialCinema } from "@/components/tutorial-cinema";

export const metadata: Metadata = {
  title: "See KYVERA in action",
  description:
    "The 90-second overview and three-minute technical demo of the KYVERA identity-continuity protocol.",
};

export default function TutorialPage() {
  return <TutorialCinema />;
}
