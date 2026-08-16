import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import TractMap3D from "@/components/urbanshield/TractMap3D";



export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Risk Map: Rent Guard" },
      {
        name: "description",
        content: "See eviction risk and rising costs across the map.",
      },
      { property: "og:title", content: "Risk Map: Rent Guard" },
      {
        property: "og:description",
        content: "A 3D map showing where housing risk is highest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  return (
    <ClientOnly fallback={<div className="h-screen w-full bg-[#0f1214]" />}>
      <TractMap3D />
    </ClientOnly>
  );
}

