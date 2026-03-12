"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

interface PromptCopyBoxProps {
  text: string;
  className?: string;
}

export function PromptCopyBox({ text, className }: PromptCopyBoxProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "relative bg-[hsl(0_0%_4%)] border border-border rounded-lg p-4",
        className,
      )}
    >
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 flex items-center gap-1.5 text-[12px] text-text-dim hover:text-text transition-[color] duration-[--motion-base] cursor-pointer"
      >
        {copied ? (
          <Check size={14} className="text-success" />
        ) : (
          <Copy size={14} />
        )}
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre className="font-mono text-[13px] text-text-dim whitespace-pre-wrap pr-16 leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
