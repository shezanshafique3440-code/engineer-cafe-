"use client";
import { useEffect, useState } from "react";
import { Download, Bell } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { T } from "@/context/language-context";
import { toast } from "sonner";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function AppTools({ admin = false }: { admin?: boolean }) {
  const [install, setInstall] = useState<InstallEvent | null>(null),
    [supported, setSupported] = useState(false),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [configured, setConfigured] = useState(false),
    [publicKey, setPublicKey] = useState<string | null>(null),
    [ios, setIos] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    setIos(
      /iphone|ipad/i.test(navigator.userAgent) &&
        !window.matchMedia("(display-mode: standalone)").matches,
    );
    if ("serviceWorker" in navigator && window.isSecureContext) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then(async (reg) => {
          if (admin && "PushManager" in window) {
            setSupported(true);
            const subscription = await reg.pushManager.getSubscription();
            setEnabled(Boolean(subscription));
            if (subscription)
              await apiPost("/api/admin/push", subscription.toJSON()).catch(
                () => undefined,
              );
          }
        })
        .catch(() => undefined);
    }
    if (admin)
      void apiGet<{ configured: boolean; publicKey: string | null }>(
        "/api/admin/push",
      )
        .then((d) => {
          setConfigured(d.configured);
          setPublicKey(d.publicKey);
        })
        .catch(() => undefined);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [admin]);
  const toggle = async () => {
    setBusy(true);
    try {
      if (!enabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw new Error(
            "Allow notifications in browser settings to receive new orders.",
          );
      }
      const reg = await navigator.serviceWorker.ready;
      const old = await reg.pushManager.getSubscription();
      if (old) {
        await apiDelete("/api/admin/push", { endpoint: old.endpoint });
        await old.unsubscribe();
        setEnabled(false);
        return;
      }
      if (!publicKey)
        throw new Error("Server setup is required for background alerts.");
      const raw = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      try {
        await apiPost("/api/admin/push", sub.toJSON());
      } catch (e) {
        await sub.unsubscribe();
        throw e;
      }
      setEnabled(true);
      toast.success("Background order alerts enabled.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not enable notifications.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      {install && (
        <Button
          variant="secondary"
          onClick={async () => {
            await install.prompt();
            await install.userChoice;
            setInstall(null);
          }}
        >
          <Download className="h-4 w-4" />
          <T text="Install cafe app" />
        </Button>
      )}
      {ios && (
        <p className="text-xs text-charcoal-500">
          <T text="On iPhone: Share → Add to Home Screen." />
        </p>
      )}
      {admin &&
        (supported ? (
          <>
            <Button
              variant="secondary"
              disabled={!configured || !publicKey}
              loading={busy}
              onClick={() => void toggle()}
            >
              <Bell className="h-4 w-4" />
              {enabled
                ? "Disable background alerts"
                : "Enable background alerts"}
            </Button>
            {!configured && (
              <p className="text-xs text-charcoal-500">
                Background alerts need server setup.
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-charcoal-500">
            Background alerts require a supported browser over HTTPS. On iPhone,
            install the app first.
          </p>
        ))}
    </div>
  );
}
