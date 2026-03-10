"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/market/search-bar";
import { TagFilter } from "@/components/market/tag-filter";
import { SkillCard } from "@/components/market/skill-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerContainer, StaggerItem } from "@/components/motion/animate-in";
import { type ApiSkill, getSkills } from "@/lib/api";
import { Zap } from "lucide-react";

export function SkillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCategory = searchParams.get("category") || "All";
  const initialQuery = searchParams.get("q") || "";

  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [skills, setSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSkills(1, 100)
      .then((res) => setSkills(res.data))
      .catch((err) => console.error("Failed to fetch skills:", err))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(skills.map((s) => s.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [skills]);

  const updateParams = useCallback(
    (newCategory: string, newQuery: string) => {
      const params = new URLSearchParams();
      if (newCategory !== "All") params.set("category", newCategory);
      if (newQuery) params.set("q", newQuery);
      const qs = params.toString();
      router.replace(`/network/skills${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router],
  );

  const handleCategory = useCallback(
    (c: string) => { setCategory(c); updateParams(c, query); },
    [query, updateParams],
  );

  const handleSearch = useCallback(
    (q: string) => { setQuery(q); updateParams(category, q); },
    [category, updateParams],
  );

  const filtered = useMemo(() => {
    return skills.filter((skill) => {
      const matchCategory = category === "All" || skill.category === category;
      const matchQuery =
        !query ||
        skill.name.toLowerCase().includes(query.toLowerCase()) ||
        (skill.description || "").toLowerCase().includes(query.toLowerCase());
      return matchCategory && matchQuery;
    });
  }, [skills, category, query]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton height={44} />
        <Skeleton height={36} width="60%" />
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
      <div className="mb-6">
        <SearchBar placeholder="Search skills..." onSearch={handleSearch} />
      </div>

      <div className="mb-8">
        <TagFilter tags={categories} selected={category} onSelect={handleCategory} />
      </div>

      {filtered.length === 0 ? (
        skills.length === 0 ? (
          <EmptyState
            icon={<Zap size={24} className="text-text-dim" />}
            title="No skills registered yet"
            description="Be the first to publish a skill on the CatBus network."
            steps={[
              { label: "Read the skill guide", href: "/docs" },
              { label: "Register your agent node" },
              { label: "Publish your first skill" },
            ]}
          />
        ) : (
          <EmptyState
            title="No matching skills"
            description="Try a different search query or category."
          />
        )
      ) : (
        <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <StaggerItem key={skill.name}>
              <SkillCard
                name={skill.name}
                description={skill.description || ""}
                providers={skill.providers}
                callsToday={skill.calls_today ?? 0}
                avgLatency={skill.avg_latency_ms ?? 0}
                status={skill.status ?? "online"}
              />
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </>
  );
}
