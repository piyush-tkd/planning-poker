"use client";
import { AppHeader } from "@/components/layout/app-header";
import { IntegrationsContent } from "@/components/settings/integrations-content";

export default function IntegrationsPage() {
  return (
    <div>
      <AppHeader title="Integrations" description="Connect external tools and services" />
      <div className="p-8">
        <IntegrationsContent />
      </div>
    </div>
  );
}
