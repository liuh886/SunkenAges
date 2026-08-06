import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function ReloadPrompt(): React.JSX.Element | null {
  const [message, setMessage] = useState<"offline" | "update" | null>(null);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onOfflineReady() {
        setMessage("offline");
      },
      onNeedRefresh() {
        setMessage("update");
      },
      onRegisteredSW(_scriptUrl, registration) {
        if (!registration) return;
        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      },
    });
    setUpdateServiceWorker(() => update);
  }, []);

  if (!message) return null;

  return (
    <aside className="pwa-toast" role="status" aria-live="polite">
      <span>{message === "offline" ? "离线模式已就绪" : "发现新版本"}</span>
      {message === "update" ? (
        <button type="button" onClick={() => void updateServiceWorker?.(true)}>
          立即更新
        </button>
      ) : null}
      <button type="button" aria-label="关闭提示" onClick={() => setMessage(null)}>
        ×
      </button>
    </aside>
  );
}
