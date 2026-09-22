import { useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { exportBackup, importBackup } from "../lib/db";
import { IconDownload, IconUpload, IconTrash } from "../components/Icons";
import type { SwipeDirectionMode, ThemeMode } from "../types/settings";

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="mb-2 px-1 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
      {children}
    </h3>
  );
}

function Row({
  title,
  subtitle,
  right,
  onClick,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="flex w-full items-center justify-between px-5 py-4 text-left"
    >
      <div>
        <p className="m-0 text-[15px] font-medium">{title}</p>
        {subtitle && (
          <p className="m-0 mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </Comp>
  );
}

function Switch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className="relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--accent)" : "var(--line)" }}
    >
      <span
        className="absolute top-[3px] h-[24px] w-[24px] rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? "translateX(23px)" : "translateX(3px)" }}
      />
    </button>
  );
}

export function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const resetAllData = useAppStore((s) => s.resetAllData);
  const decisionsCount = useAppStore((s) => s.decisions.size);

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [surnameDraft, setSurnameDraft] = useState(settings.surname);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  async function handleExport() {
    const json = await exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nameswipe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      await importBackup(text);
      setImportMessage("Backup restored. Reloading…");
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setImportMessage("Couldn't read that file — make sure it's a NameSwipe backup.");
    }
  }

  function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setTimeout(() => setConfirmingReset(false), 3000);
      return;
    }
    void resetAllData();
    setConfirmingReset(false);
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        paddingTop: "calc(82px + env(safe-area-inset-top))",
        paddingLeft: 18,
        paddingRight: 18,
        paddingBottom: "calc(100px + env(safe-area-inset-bottom))",
      }}
    >
      <h1 className="font-serif" style={{ fontSize: 42, letterSpacing: "-0.04em", fontWeight: 500, margin: "4px 0 20px" }}>
        Settings
      </h1>

      <SectionLabel>Swipe setup</SectionLabel>
      <div className="mb-6 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
        {(
          [
            { id: "right-yes" as SwipeDirectionMode, label: "Swipe right = Yes", subtitle: "Left = No · Up = Maybe" },
            { id: "right-no" as SwipeDirectionMode, label: "Swipe right = No", subtitle: "Left = Yes · Up = Maybe" },
          ]
        ).map((opt, i) => (
          <div key={opt.id} style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
            <Row
              title={opt.label}
              subtitle={opt.subtitle}
              onClick={() => updateSettings({ swipeDirection: opt.id })}
              right={
                <span
                  className="grid h-6 w-6 place-items-center rounded-full border-2"
                  style={{ borderColor: settings.swipeDirection === opt.id ? "var(--accent)" : "var(--line)" }}
                >
                  {settings.swipeDirection === opt.id && (
                    <span className="h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />
                  )}
                </span>
              }
            />
          </div>
        ))}
      </div>

      <SectionLabel>Appearance</SectionLabel>
      <div className="mb-6 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
        {(["system", "light", "dark"] as ThemeMode[]).map((mode, i) => (
          <div key={mode} style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}>
            <Row
              title={mode === "system" ? "Match system" : mode === "light" ? "Light" : "Dark"}
              onClick={() => updateSettings({ theme: mode })}
              right={
                <span
                  className="grid h-6 w-6 place-items-center rounded-full border-2"
                  style={{ borderColor: settings.theme === mode ? "var(--accent)" : "var(--line)" }}
                >
                  {settings.theme === mode && <span className="h-3 w-3 rounded-full" style={{ background: "var(--accent)" }} />}
                </span>
              }
            />
          </div>
        ))}
      </div>

      <SectionLabel>Feel</SectionLabel>
      <div className="mb-6 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
        <Row
          title="Haptics"
          subtitle="Subtle vibration on swipe"
          right={<Switch on={settings.haptics} onChange={() => updateSettings({ haptics: !settings.haptics })} />}
        />
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <Row
            title="Reduce motion"
            subtitle="Skip card animations"
            right={<Switch on={settings.reducedMotion} onChange={() => updateSettings({ reducedMotion: !settings.reducedMotion })} />}
          />
        </div>
      </div>

      <SectionLabel>Surname preview</SectionLabel>
      <div className="mb-6 overflow-hidden rounded-[22px] border px-5 py-4" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
        <input
          value={surnameDraft}
          onChange={(e) => setSurnameDraft(e.target.value)}
          onBlur={() => updateSettings({ surname: surnameDraft.trim() })}
          placeholder="e.g. Reynolds"
          className="w-full bg-transparent text-[15px] outline-none"
        />
        <p className="m-0 mt-2 text-[12.5px]" style={{ color: "var(--muted)" }}>
          Shown on name detail sheets. Stays on this device only.
        </p>
      </div>

      <SectionLabel>Your data</SectionLabel>
      <div className="mb-6 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--line)", background: "var(--surface-solid)" }}>
        <Row title="Names reviewed" right={<span className="text-[15px] font-semibold">{decisionsCount}</span>} />
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <Row
            title="Export backup"
            subtitle="Save your decisions as a JSON file"
            onClick={handleExport}
            right={<IconDownload width={18} height={18} style={{ color: "var(--muted)" }} />}
          />
        </div>
        <div style={{ borderTop: "1px solid var(--line)" }}>
          <Row
            title="Import backup"
            subtitle="Restore from a previous export"
            onClick={() => fileInputRef.current?.click()}
            right={<IconUpload width={18} height={18} style={{ color: "var(--muted)" }} />}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
            }}
          />
        </div>
      </div>

      {importMessage && (
        <p className="mb-4 text-[13px]" style={{ color: "var(--muted)" }}>
          {importMessage}
        </p>
      )}

      <div className="mb-10 overflow-hidden rounded-[22px] border" style={{ borderColor: "var(--no)" }}>
        <Row
          title={confirmingReset ? "Tap again to confirm" : "Reset all data"}
          subtitle={confirmingReset ? "This clears every decision permanently" : "Start over from scratch"}
          onClick={handleReset}
          right={<IconTrash width={18} height={18} style={{ color: "var(--no)" }} />}
        />
      </div>

      <p className="mb-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>
        NameSwipe · everything stays on this device
      </p>
    </div>
  );
}
