export interface DocPage {
  slug: string;
  titleKey: string;
  descKey: string;
  contentKey: string;
}

export interface DocCategory {
  id: string;
  titleKey: string;
  descKey: string;
  icon: string;
  accent?: string;
  pages: DocPage[];
  comingSoon?: boolean;
}

export const docCategories: DocCategory[] = [
  {
    id: "getting-started",
    titleKey: "docs.cat.gettingStarted",
    descKey: "docs.cat.gettingStartedDesc",
    icon: "🚀",
    accent: "primary",
    pages: [
      { slug: "introduction", titleKey: "docs.introduction.title", descKey: "docs.introduction.desc", contentKey: "docs.introduction.content" },
      { slug: "installation", titleKey: "docs.installation.title", descKey: "docs.installation.desc", contentKey: "docs.installation.content" },
      { slug: "quick-start", titleKey: "docs.quickStart.title", descKey: "docs.quickStart.desc", contentKey: "docs.quickStart.content" },
    ],
  },
  {
    id: "agents",
    titleKey: "docs.cat.agents",
    descKey: "docs.cat.agentsDesc",
    icon: "🤖",
    accent: "hsl(260 80% 60%)",
    pages: [
      { slug: "create-agent", titleKey: "docs.createAgent.title", descKey: "docs.createAgent.desc", contentKey: "docs.createAgent.content" },
      { slug: "bind-dashboard", titleKey: "docs.bindDashboard.title", descKey: "docs.bindDashboard.desc", contentKey: "docs.bindDashboard.content" },
      { slug: "monitor", titleKey: "docs.monitor.title", descKey: "docs.monitor.desc", contentKey: "docs.monitor.content" },
    ],
  },
  {
    id: "skills",
    titleKey: "docs.cat.skills",
    descKey: "docs.cat.skillsDesc",
    icon: "⚡",
    accent: "warning",
    pages: [
      { slug: "what-is-skill", titleKey: "docs.whatIsSkill.title", descKey: "docs.whatIsSkill.desc", contentKey: "docs.whatIsSkill.content" },
      { slug: "publish-skill", titleKey: "docs.publishSkill.title", descKey: "docs.publishSkill.desc", contentKey: "docs.publishSkill.content" },
      { slug: "call-skill", titleKey: "docs.callSkill.title", descKey: "docs.callSkill.desc", contentKey: "docs.callSkill.content" },
    ],
  },
  {
    id: "network",
    titleKey: "docs.cat.network",
    descKey: "docs.cat.networkDesc",
    icon: "🌐",
    accent: "success",
    pages: [
      { slug: "how-it-works", titleKey: "docs.howItWorks.title", descKey: "docs.howItWorks.desc", contentKey: "docs.howItWorks.content" },
      { slug: "nodes", titleKey: "docs.nodes.title", descKey: "docs.nodes.desc", contentKey: "docs.nodes.content" },
      { slug: "routing", titleKey: "docs.routing.title", descKey: "docs.routing.desc", contentKey: "docs.routing.content" },
    ],
  },
  {
    id: "dashboard",
    titleKey: "docs.cat.dashboard",
    descKey: "docs.cat.dashboardDesc",
    icon: "📊",
    accent: "hsl(330 80% 55%)",
    pages: [],
    comingSoon: true,
  },
  {
    id: "api-reference",
    titleKey: "docs.cat.apiRef",
    descKey: "docs.cat.apiRefDesc",
    icon: "📡",
    accent: "hsl(187 85% 53%)",
    pages: [],
    comingSoon: true,
  },
];

// Flat list of all pages with category context for prev/next navigation
export interface DocPageWithContext extends DocPage {
  categoryId: string;
  categoryTitleKey: string;
}

export function getAllPages(): DocPageWithContext[] {
  return docCategories
    .filter((c) => !c.comingSoon)
    .flatMap((c) =>
      c.pages.map((p) => ({
        ...p,
        categoryId: c.id,
        categoryTitleKey: c.titleKey,
      }))
    );
}

export function getPageBySlug(slug: string): DocPageWithContext | undefined {
  return getAllPages().find((p) => p.slug === slug);
}

export function getAdjacentPages(slug: string): { prev?: DocPageWithContext; next?: DocPageWithContext } {
  const pages = getAllPages();
  const idx = pages.findIndex((p) => p.slug === slug);
  return {
    prev: idx > 0 ? pages[idx - 1] : undefined,
    next: idx < pages.length - 1 ? pages[idx + 1] : undefined,
  };
}
