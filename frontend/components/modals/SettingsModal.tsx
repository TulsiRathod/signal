"use client";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import {
  Bell,
  Camera,
  LogOut,
  Moon,
  Monitor,
  Shield,
  Smartphone,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const me = useStore((s) => s.currentUser)!;
  const logout = useStore((s) => s.logout);
  const pushToast = useStore((s) => s.pushToast);
  const { theme, toggle } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(me.display_name);
  const [about, setAbout] = useState(me.about);
  const [avatar, setAvatar] = useState(me.avatar_url);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(me.display_name);
      setAbout(me.about);
      setAvatar(me.avatar_url);
    }
  }, [open, me]);

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const res = await api.uploadAttachment(file);
      const updated = await api.updateMe({ avatar_url: res.url });
      setAvatar(updated.avatar_url);
      useStore.setState({ currentUser: updated });
      pushToast("Photo updated");
    } catch {
      pushToast("Upload failed");
    }
  }

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateMe({ display_name: name, about });
      useStore.setState({ currentUser: updated });
      pushToast("Profile saved");
    } catch (e: any) {
      pushToast(e.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  function doLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      {/* Profile */}
      <div className="mb-5 flex flex-col items-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="group relative"
        >
          <Avatar name={name || "?"} src={avatar} seed={me.id} size={84} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition group-hover:opacity-100">
            <Camera size={22} />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={uploadAvatar}
        />
        <p className="mt-2 text-xs text-muted">{me.phone}</p>
      </div>

      <label className="mb-1 block text-xs font-medium text-muted">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-txt outline-none focus:border-signal-blue"
      />
      <label className="mb-1 block text-xs font-medium text-muted">About</label>
      <input
        value={about}
        onChange={(e) => setAbout(e.target.value)}
        className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-txt outline-none focus:border-signal-blue"
      />
      <button
        onClick={save}
        disabled={saving}
        className="mb-5 w-full rounded-lg bg-signal-blue py-2 text-sm font-medium text-white hover:bg-signal-bluedark disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save profile"}
      </button>

      {/* Appearance */}
      <SettingRow
        icon={theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
        label="Appearance"
        right={
          <button
            onClick={toggle}
            className="flex items-center gap-2 rounded-full bg-surface2 px-3 py-1 text-sm text-txt"
          >
            {theme === "dark" ? "Dark" : "Light"} mode
          </button>
        }
      />

      {/* Placeholder settings */}
      <SettingRow icon={<Shield size={18} />} label="Privacy" hint="Coming soon" />
      <SettingRow
        icon={<Bell size={18} />}
        label="Notifications"
        hint="Coming soon"
      />
      <SettingRow
        icon={<Smartphone size={18} />}
        label="Linked devices"
        hint="Coming soon"
      />
      <SettingRow icon={<Monitor size={18} />} label="Stories" hint="Coming soon" />

      <button
        onClick={doLogout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
      >
        <LogOut size={16} /> Log out
      </button>
    </Modal>
  );
}

function SettingRow({
  icon,
  label,
  hint,
  right,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-3 text-txt">
        <span className="text-muted">{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      {right || (hint && <span className="text-xs text-muted">{hint}</span>)}
    </div>
  );
}
