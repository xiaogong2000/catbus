"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/market/search-bar";
import { TagFilter } from "@/components/market/tag-filter";
import { SkillCard } from "@/components/market/skill-card";
import { type ApiSkill, getSkills } from "@/lib/api";

export function SkillsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialCategory = searchParams.get("category") || "All";
  const initialQuery = searchParams.get("q") || "";

  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [skills, setSkills] = useState<ApiSkill[]>([]);

  useEffect(() => {
    getSkills(1, 100).then((res) => setSkills(res.data)).catch(() => {});
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
    (c: string) => {
      setCategory(c);
      updateParams(c, query);
    },
    [query, updateParams],
  );

  const handleSearch = useCallback(
    (q: string) => {
      setQuery(q);
      updateParams(category, q);
    },
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

  return (
    <>
      <div className="mb-6">
        <SearchBar placeholder="Search skills..." onSearch={handleSearch} />
      </div>

      <div className="mb-8">
        <TagFilter
          tags={categories}
          selected={category}
          onSelect={handleCategory}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-[14px] text-text-muted py-8 text-center">
          {skills.length === 0
            ? "No skills registered yet. Connect an agent to publish skills."
            : "No skills match your search. Try a different query or category."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => (
            <SkillCard
              key={skill.name}
              name={skill.name}
              description={skill.description || ""}
              providers={skill.providers}
              callsToday={skill.calls_today}
              avgLatency={skill.avg_latency_ms}
              status={skill.status}
            />
          ))}
        </div>
      )}
    </>
  );
}
