"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@sapa.ai");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const res = await api<{ token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      router.replace("/");
    } catch (e: any) {
      setErr(e.message || "Login gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-bg flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-700 text-white shadow-[0_10px_28px_-8px_rgba(124,92,246,.8)]">
            <Sparkles size={20} />
          </div>
          <div className="text-[22px] font-bold tracking-tight">Sapa AI</div>
        </div>
        <form onSubmit={submit} className="glass rounded-[24px] p-7 shadow-pop">
          <h1 className="text-[19px] font-bold tracking-tight">Masuk ke workspace</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            Kelola, training, dan embed AI agent Anda.
          </p>
          <div className="mt-6 space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@sapa.ai"
                autoComplete="email"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </Field>
            {err && (
              <p className="rounded-xl bg-danger-soft px-3 py-2 text-[12.5px] font-semibold text-danger">
                {err}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Memeriksa…" : "Masuk"}
            </Button>
          </div>
          <p className="mt-5 text-center text-[11.5px] text-ink-3">
            Default seed: admin@sapa.ai / admin123 — ganti lewat env{" "}
            <code className="font-semibold">ADMIN_PASSWORD</code>.
          </p>
        </form>
      </div>
    </div>
  );
}
