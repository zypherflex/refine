"use client";
import { logoutAction } from "@/app/actions/auth";
import { clearOfflinePages } from "./AppInstall";

/** Signs out and clears pages the app stored for offline use on this device. */
export function SignOut({ className }: { className: string }) {
  return (
    <form action={logoutAction} onSubmit={() => clearOfflinePages()}>
      <button className={className}>Sign out</button>
    </form>
  );
}
