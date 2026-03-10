"use client";

import { useState, useCallback, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LoginRegion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegionTabs } from "@/components/auth/region-tabs";
import { OAuthButton } from "@/components/auth/oauth-button";
import { PasswordStrength } from "@/components/auth/password-strength";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (!/[a-z]/.test(pw)) return "Password must contain a lowercase letter";
  if (!/[A-Z]/.test(pw)) return "Password must contain an uppercase letter";
  if (!/[0-9]/.test(pw)) return "Password must contain a number";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const [region, setRegion] = useState<LoginRegion>("international");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const emailError = useMemo(
    () => (email && !validateEmail(email) ? "Invalid email format" : null),
    [email]
  );
  const passwordError = useMemo(
    () => (password ? validatePassword(password) : null),
    [password]
  );
  const confirmError = useMemo(
    () =>
      confirmPassword && confirmPassword !== password
        ? "Passwords do not match"
        : null,
    [password, confirmPassword]
  );

  const handleEmailRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (emailError || passwordError || confirmError) return;
      setError("");
      setLoading(true);
      try {
        const regRes = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!regRes.ok) {
          const data = await regRes.json();
          setError(data.error || "Registration failed. Please try again.");
          return;
        }

        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Account created but login failed. Try signing in.");
        } else {
          router.push("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, emailError, passwordError, confirmError, router]
  );

  const fieldError = (msg: string | null) =>
    msg ? <p className="text-[12px] text-danger">{msg}</p> : null;

  const emailForm = (
    <form onSubmit={handleEmailRegister} className="space-y-3">
      <div>
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {fieldError(emailError)}
      </div>
      <div>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="mt-1">
          <PasswordStrength password={password} />
        </div>
        {fieldError(passwordError)}
      </div>
      <div>
        <Input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {fieldError(confirmError)}
      </div>
      <Button
        type="submit"
        disabled={
          loading ||
          !!emailError ||
          !!passwordError ||
          !!confirmError ||
          !email ||
          !password ||
          !confirmPassword
        }
        className="w-full"
      >
        {loading ? "Creating account..." : "Sign Up"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-[24px] font-bold text-text tracking-[-0.6px]">
          Create your account
        </h1>
        <p className="mt-2 text-[14px] text-text-dim">
          Join the AI agent ecosystem
        </p>
      </div>

      <RegionTabs value={region} onChange={setRegion} />

      {error && (
        <p className="text-[13px] text-danger text-center">{error}</p>
      )}

      {/* International: OAuth + email */}
      {region === "international" && (
        <div className="space-y-4">
          <OAuthButton brand="github" onClick={() => signIn("github", { callbackUrl: "/dashboard" })} disabled={loading} />
          <OAuthButton brand="google" onClick={() => signIn("google", { callbackUrl: "/dashboard" })} disabled={loading} />

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[12px] text-text-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {emailForm}
        </div>
      )}

      {/* China: email only */}
      {region === "china" && (
        <div className="space-y-4">
          {emailForm}
        </div>
      )}

      <p className="text-center text-[13px] text-text-dim">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-text hover:text-primary transition-[color] duration-[--motion-base]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
