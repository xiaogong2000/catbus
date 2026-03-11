"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchBar } from "@/components/market/search-bar";
import { SkillCard } from "@/components/market/skill-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/components/motion/animate-in";
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
      .then((res) => setSkills(res.data))
      .catch((err) => console.error("Failed to fetch skills:", err))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = useCallback(
    (q: string) => { setQuery(q); },
    [],
  );

  const filtered = useMemo(() => {
    return skills.filter((skill) => {
      const matchQuery =
        !query ||
        skill.name.toLowerCase().includes(query.toLowerCase()) ||
        (skill.description || "").toLowerCase().includes(query.toLowerCase());
      return matchQuery;
    });
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
      <div className="mb-8">
        <SearchBar placeholder={t("skills.search")} onSearch={handleSearch} />
      </div>

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
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <StaggerItem key={skill.name}>
              <Link href={`/network/skills/${encodeURIComponent(skill.name)}`}>
                <SkillCard
                  name={skill.name}
                  description={skill.description || ""}
                  providers={skill.providers}
                  callsToday={0}
                  avgLatency={0}
                />
              </Link>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </>
  );
}
