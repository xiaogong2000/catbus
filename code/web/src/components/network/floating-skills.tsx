"use client";

import Link from "next/link";
import type { ApiSkill } from "@/lib/api";
import { useLocale } from "@/components/locale-provider";
import { Bot, Zap } from "lucide-react";

interface Props {
  skills: ApiSkill[];
}

const glassPanel = "bg-black/55 backdrop-blur-[16px] border border-white/[0.06] rounded-[10px]";

export function FloatingSkills({ skills }: Props) {
  const { t } = useLocale();

  return (
    <div className={`absolute bottom-5 left-6 z-10 w-[220px] p-3.5 hidden md:block ${glassPanel}`}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-white/35 font-semibold mb-2.5">
        {t("network.globe.topSkills")}
      </div>
      <div className="flex flex-col gap-1.5">
        {skills.slice(0, 5).map((skill) => {
          const isModel = (skill as unknown as { type?: string }).type === "model" || skill.name.startsWith("model/");
          return (
            <div key={skill.name} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0 mr-2">
                {isModel ? (
                  <Bot size={10} className="text-[#a78bfa]/60 shrink-0" />
                ) : (
                  <Zap size={10} className="text-[#fbbf24]/60 shrink-0" />
                )}
                <span className="text-[11px] text-white/65 font-mono truncate">
                  {skill.name}
                </span>
              </div>
              <span className="text-[10px] text-white/35 shrink-0">
                {skill.providers} {t("network.globe.providers")}
              </span>
            </div>
          );
        })}
      </div>
      <Link
        href="/network/skills"
        className="block text-[10px] text-white/35 hover:text-white/60 transition-colors mt-3 pt-2 border-t border-white/[0.06]"
      >
        {t("network.globe.viewAll")}
      </Link>
    </div>
  );
}
