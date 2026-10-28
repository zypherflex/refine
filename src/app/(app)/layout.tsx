import { requireUser } from "@/server/auth";
import { unreadCount } from "@/server/services/alerts";
import { unreadThreadCount } from "@/server/hub/messages";
import { Shell } from "@/components/Shell";
import { PushBootstrap } from "@/components/native/Push";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, hubUnread] = await Promise.all([unreadCount(user.id), unreadThreadCount(user)]);
  return (
    <Shell user={user} unread={unread} hubUnread={hubUnread}>
      <PushBootstrap />
      {children}
    </Shell>
  );
}
