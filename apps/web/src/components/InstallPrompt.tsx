import { Share, SquarePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { useDialog } from "@/lib/useDialog";
import { useT } from "@/lib/i18n";
import { INSTALL_EVENT, canInstall, dismissInstall, installDismissed } from "@/lib/install";

const AUTO_DELAY = 20_000;

/**
 * iOS install guide — on iPhone, installing is the gate to push notifications.
 * Auto-opens once on iOS-in-a-tab (unless dismissed for good) and can be opened
 * from Settings via INSTALL_EVENT.
 */
export function InstallPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(INSTALL_EVENT, show);
    let id: number | undefined;
    if (canInstall() && !installDismissed()) id = window.setTimeout(show, AUTO_DELAY);
    return () => {
      window.removeEventListener(INSTALL_EVENT, show);
      if (id) window.clearTimeout(id);
    };
  }, []);

  if (!open) return null;
  return <InstallDialog onClose={() => setOpen(false)} />;
}

function InstallDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useDialog(box, onClose);

  const steps = [
    { icon: <Share className="size-4" />, text: t.install.step1 },
    { icon: <SquarePlus className="size-4" />, text: t.install.step2 },
    { icon: <Logo size={18} />, text: t.install.step3 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={t.install.title}
      onClick={onClose}
    >
      <div ref={box} className="wow-frame w-full max-w-sm px-5 pt-5 pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Logo size={32} />
          <h2 className="title-display flex-1 text-lg text-gold">{t.install.title}</h2>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label={t.update.close}>
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-3 text-sm text-ink-dim">{t.install.why}</p>
        <ol className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded border border-[#3a3a3a] bg-black/50 px-3 py-2.5 text-sm">
              <span className="font-display text-gold">{i + 1}</span>
              <span className="flex-1">{s.text}</span>
              <span className="text-blue">{s.icon}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex justify-end">
          <button
            className="wow-btn wow-btn-dark"
            onClick={() => {
              dismissInstall();
              onClose();
            }}
          >
            {t.install.later}
          </button>
        </div>
      </div>
    </div>
  );
}
