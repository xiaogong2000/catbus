"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchBar } from "@/components/market/search-bar";
import { SkillCard } from "@/components/market/skill-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { type ApiSkill, getSkills } from "@/lib/api";
import { Zap } from "lucide-react";
import { useLocale } from "@/components/locale-provider";

export function SkillsContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();

  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSkills(1, 100)
      .then((res) => {
        // Sort by providers (usage frequency) desc, then alphabetical
        const sorted = [...res.data].sort((a, b) => {
          if (b.providers !== a.providers) return b.providers - a.providers;
          return a.name.localeCompare(b.name);
        });
        setSkills(sorted);
      })
      .catch((err) => console.error("Failed to fetch skills:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = useCallback(
    (q: string) => { setQuery(q); },
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;

    // Score-based search: name exact > name starts > name contains > description contains
    type Scored = { skill: ApiSkill; score: number };
    const scored: Scored[] = [];
    for (const skill of skills) {
      const name = skill.name.toLowerCase();
      const desc = (skill.description || "").toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else if (desc.includes(q)) score = 30;
      if (score > 0) scored.push({ skill, score });
    }
    return scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.skill.providers !== a.skill.providers) return b.skill.providers - a.skill.providers;
      return a.skill.name.localeCompare(b.skill.name);
    }).map((s) => s.skill);
  }, [skills, query]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height={44} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={140} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-2">
        <SearchBar placeholder={t("skills.search")} onSearch={handleSearch} />
      </div>

      {query.trim() && (
        <p className="text-[13px] text-text-muted mb-6">
          {filtered.length} {filtered.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
        </p>
      )}
      {!query.trim() && <div className="mb-6" />}

      {filtered.length === 0 ? (
        skills.length === 0 ? (
          <EmptyState
            icon={<Zap size={24} className="text-text-dim" />}
            title={t("skills.empty.title")}
            description={t("skills.empty.desc")}
            steps={[
              { label: t("skills.empty.step1"), href: "/docs" },
              { label: t("skills.empty.step2") },
              { label: t("skills.empty.step3") },
            ]}
          />
        ) : (
          <EmptyState
            title={t("skills.noMatch.title")}
            description={t("skills.noMatch.desc")}
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <Link key={skill.name} href={`/network/skills/${encodeURIComponent(skill.name)}`}>
              <SkillCard
                name={skill.name}
                description={skill.description || ""}
                providers={skill.providers}
                callsToday={0}
                avgLatency={0}
                searchQuery={query}
              />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
