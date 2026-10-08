import type { Metadata } from "next";
import { DeployPanel } from "@/components/onchain/DeployPanel";

export const metadata: Metadata = {
  title: "Deploy contracts",
  description: "Owner tool: deploy the CONNEX contracts from your own wallet.",
  robots: { index: false, follow: false },
};

export default function DeployPage() {
  return (
    <main className="wrap-md grid gap-5 pb-16 pt-10">
      <DeployPanel />
    </main>
  );
}
