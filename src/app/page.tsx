"use client";

import { useState } from "react";
import Header from "@/components/Header";
import ClaimantView from "@/components/ClaimantView";
import OperationsView from "@/components/OperationsView";
import ManagementView from "@/components/ManagementView";

export type ViewRole = "claimant" | "operations" | "management";

export default function Home() {
  const [role, setRole] = useState<ViewRole>("claimant");

  return (
    <div className="min-h-screen flex flex-col">
      <Header role={role} setRole={setRole} />
      <main className="flex-1">
        {role === "claimant" && <ClaimantView />}
        {role === "operations" && <OperationsView />}
        {role === "management" && <ManagementView />}
      </main>
    </div>
  );
}
