interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-10">
      <p className="uppercase text-[12px] font-semibold tracking-[2.4px] text-text-muted mb-3">
        {eyebrow}
      </p>
      <h1 className="text-[36px] font-bold leading-[1.1] tracking-[-1.2px] text-text">
        {title}
      </h1>
      {description && (
        <p className="mt-3 text-[16px] text-text-dim max-w-[640px]">
          {description}
        </p>
      )}
    </div>
  );
}
