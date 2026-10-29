"use client";
import { logoutAction } from "@/app/actions/auth";
import { clearOfflinePages } from "./AppInstall";
import { forgetDevice } from "./native/Push";

/** Signs out and clears pages the app stored for offline use on this device. */
export function SignOut({ className }: { className: string }) {
  return (
    <form
      action={async () => {
        clearOfflinePages();
        await forgetDevice();
        await logoutAction();
      }}
    >
      <button className={className}>Sign out</button>
    </form>
  );
}
