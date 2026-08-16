import { createFileRoute, Link } from "@tanstack/react-router";
import { Banknote, Landmark, Layers, MapPinned, ShieldCheck, Zap } from "lucide-react";
import { Kicker, Panel } from "@/components/urbanshield/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rent Guard: Stop Evictions Before They Happen" },
      {
        name: "description",
        content:
          "Rent Guard maps housing risk and sends verified relief directly to renters and landlords.",
      },
      { property: "og:title", content: "Rent Guard: Housing Risk, Mapped and Answered" },
      {
        property: "og:description",
        content: "Verified relief that reaches a household before an eviction filing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: MapPinned, t: "Risk map", d: "Shows where eviction risk is rising." },
  { icon: ShieldCheck, t: "No middleman", d: "We never hold or touch your money." },
  { icon: Banknote, t: "Direct landlord relief", d: "Pays landlords before an eviction is filed." },
  { icon: Landmark, t: "Local bank support", d: "Savings fund local housing loans." },
  { icon: Layers, t: "Land trust funding", d: "Helps trusts buy property and keep rent low." },
  { icon: Zap, t: "Fast payments", d: "Funds arrive within hours." },
];

function Home() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <section className="max-w-3xl">
        <Kicker>Renter protection technology</Kicker>
        <h1 className="mt-3 font-display text-5xl leading-[1.05] sm:text-6xl">
          Stop evictions before they happen.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Rent Guard tracks rising risk in a neighborhood. When a household needs
          help, verified relief goes straight to them, fast.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/map"
            className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Open the risk map
          </Link>
          <Link
            to="/risk"
            className="rounded-full border border-border px-5 py-3 text-sm font-semibold"
          >
            Check a household
          </Link>
        </div>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Panel key={f.t}>
            <f.icon className="size-5 text-primary" />
            <h2 className="mt-3 font-display text-xl">{f.t}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
          </Panel>
        ))}
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-3">
        <StepCard
          n="01"
          to="/risk"
          title="Early warning"
          body="Turns your income and rent into a simple risk score and timeline."
        />
        <StepCard
          n="02"
          to="/relief"
          title="Verified relief"
          body="Once risk is high enough, verification clears a transfer to the landlord."
        />
        <StepCard
          n="03"
          to="/map"
          title="City intelligence"
          body="Highlights the blocks where funding would help the most."
        />
      </section>
    </div>
  );
}

function StepCard({
  n,
  title,
  body,
  to,
}: {
  n: string;
  title: string;
  body: string;
  to: "/risk" | "/relief" | "/map";
}) {
  return (
    <Link to={to} className="block">
      <Panel className="h-full transition-colors hover:border-primary/50">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <h3 className="mt-2 font-display text-2xl">{title}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </Panel>
    </Link>
  );
}
