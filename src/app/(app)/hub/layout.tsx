import { HubTabs } from "@/components/hub/HubTabs";

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HubTabs />
      {children}
    </>
  );
}
