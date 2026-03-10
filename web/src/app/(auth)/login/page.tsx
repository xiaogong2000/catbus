"use client";

import { useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LoginRegion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegionTabs } from "@/components/auth/region-tabs";
import { OAuthButton } from "@/components/auth/oauth-button";

export default function LoginPage() {
  const router = useRouter();
  const [region, setRegion] = useState<LoginRegion>("international");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setLoading(true);
      try {
        const res = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (res?.error) {
          setError("Invalid email or password");
        } else {
          router.push("/dashboard");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, router]
  );

  const emailForm = (
    <form onSubmit={handleEmailLogin} className="space-y-3">
      <label className="block">
        <span className="sr-only">Email address</span>
        <Input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block">
        <span className="sr-only">Password</span>
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Signing in..." : "Login"}
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-[24px] font-bold text-text tracking-[-0.6px]">
          Sign in to CatBus
        </h1>
        <p className="mt-2 text-[14px] text-text-dim">
          The Uber for AI Agents
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
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-text hover:text-primary transition-[color] duration-[--motion-base]"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
