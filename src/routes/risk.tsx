import { createFileRoute } from "@tanstack/react-router";
import RentBurdenCalculator from "@/components/urbanshield/Component1.jsx";

export const Route = createFileRoute("/risk")({
  head: () => ({
    meta: [
      { title: "Early Warning: Rent Guard" },
      {
        name: "description",
        content: "See your risk score and how long your savings will last.",
      },
      { property: "og:title", content: "Early Warning: Rent Guard" },
      {
        property: "og:description",
        content: "A risk score and savings timeline for any household.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RiskPage,
});

function RiskPage() {
  return <RentBurdenCalculator />;
}
