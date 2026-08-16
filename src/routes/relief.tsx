import { createFileRoute } from "@tanstack/react-router";
import EmergencyTransferConsole from "@/components/urbanshield/Component2.jsx";

export const Route = createFileRoute("/relief")({
  head: () => ({
    meta: [
      { title: "Relief Console: Rent Guard" },
      {
        name: "description",
        content: "Watch a relief request get verified and sent to the landlord.",
      },
      { property: "og:title", content: "Relief Console: Rent Guard" },
      {
        property: "og:description",
        content: "Verified transfers sent straight to the landlord.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReliefPage,
});

function ReliefPage() {
  return <EmergencyTransferConsole />;
}
