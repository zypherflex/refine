"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { isNativeApp } from "./NativeBridge";

/** Shares a page: the phone's share sheet in the apps and on mobile browsers, otherwise copies the link. */
export function ShareButton({ title, text, path }: { title: string; text: string; path: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary btn-sm"
      onClick={async () => {
        const url = new URL(path, window.location.origin).toString();
        try {
          if (isNativeApp()) {
            const { Share } = await import("@capacitor/share");
            await Share.share({ title, text, url, dialogTitle: "Share" });
            return;
          }
          if (navigator.share) {
            await navigator.share({ title, text, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* the person closed the share sheet */
        }
      }}
    >
      <Share2 aria-hidden size={14} /> {copied ? "Link copied" : "Share"}
    </button>
  );
}
