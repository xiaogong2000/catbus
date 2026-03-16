"use client";

import { useState, useCallback, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButton } from "@/components/auth/oauth-button";
import { PasswordStrength } from "@/components/auth/password-strength";
import { useLocale } from "@/components/locale-provider";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pw: string, t: (key: string) => string): string | null {
  if (pw.length < 8) return t("auth.validate.minLength");
  if (!/[a-z]/.test(pw)) return t("auth.validate.lowercase");
  if (!/[A-Z]/.test(pw)) return t("auth.validate.uppercase");
  if (!/[0-9]/.test(pw)) return t("auth.validate.number");
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailError = useMemo(
    () => (email && !validateEmail(email) ? t("auth.register.error") : null),
    [email, t],
  );
  const passwordError = useMemo(
    () => (mode === "register" && password ? validatePassword(password, t) : null),
    [mode, password, t],
  );
  const confirmError = useMemo(
    () =>
      mode === "register" && confirmPassword && confirmPassword !== password
        ? t("auth.validate.mismatch")
        : null,
    [mode, password, confirmPassword],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        if (mode === "register") {
          if (emailError || passwordError || confirmError) return;
          const regRes = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          if (!regRes.ok) {
            const data = await regRes.json();
            setError(data.error || t("auth.register.error"));
            return;
          }
        }
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError(mode === "register" ? t("auth.register.loginError") : t("auth.login.error"));
        } else {
          router.push("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, emailError, passwordError, confirmError, router, t],
  );

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
    setConfirmPassword("");
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-[24px] font-bold text-text tracking-[-0.6px]">
          {mode === "login" ? t("auth.login.title") : t("auth.register.title")}
        </h1>
        <p className="mt-2 text-[14px] text-text-dim">
          {mode === "login" ? t("auth.login.subtitle") : t("auth.register.subtitle")}
        </p>
      </div>

      {error && (
        <p className="text-[13px] text-danger text-center">{error}</p>
      )}

      <div className="space-y-4">
        <OAuthButton brand="github" onClick={() => signIn("github", { callbackUrl: "/dashboard" })} disabled={loading} />
        <OAuthButton brand="google" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} disabled={loading} />

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[12px] text-text-muted uppercase tracking-wider">{t("auth.login.or")}</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="sr-only">{t("auth.login.email")}</span>
            <Input
              type="email"
              placeholder={t("auth.login.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="sr-only">{t("auth.login.password")}</span>
            <Input
              type="password"
              placeholder={t("auth.login.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {mode === "register" && (
              <div className="mt-1">
                <PasswordStrength password={password} />
              </div>
            )}
            {passwordError && <p className="text-[12px] text-danger mt-1">{passwordError}</p>}
          </label>
          {mode === "register" && (
            <label className="block">
              <span className="sr-only">{t("auth.register.confirm")}</span>
              <Input
                type="password"
                placeholder={t("auth.register.confirm")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmError && <p className="text-[12px] text-danger mt-1">{confirmError}</p>}
            </label>
          )}
          <Button
            type="submit"
            disabled={
              loading ||
              !email ||
              !password ||
              (mode === "register" && (!!passwordError || !!confirmError || !confirmPassword))
            }
            className="w-full"
          >
            {loading
              ? (mode === "login" ? t("auth.login.loading") : t("auth.register.loading"))
              : (mode === "login" ? t("auth.login.submit") : t("auth.register.submit"))
            }
          </Button>
        </form>
      </div>

      <p className="text-center text-[13px] text-text-dim">
        {mode === "login" ? t("auth.login.noAccount") : t("auth.register.hasAccount")}{" "}
        <button
          type="button"
          onClick={switchMode}
          className="text-text hover:text-primary transition-[color] duration-[--motion-base] cursor-pointer"
        >
          {mode === "login" ? t("auth.login.signUp") : t("auth.register.signIn")}
        </button>
      </p>
    </div>
  );
}
