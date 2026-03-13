"use client";

import { Button } from "@/components/ui/button";

interface TagFilterSingleProps {
  tags: string[];
  selected: string;
  onSelect: (tag: string) => void;
  multiple?: false;
}

interface TagFilterMultiProps {
  tags: string[];
  selected: string[];
  onSelect: (tags: string[]) => void;
  multiple: true;
}

type TagFilterProps = TagFilterSingleProps | TagFilterMultiProps;

export function TagFilter(props: TagFilterProps) {
  const { tags, multiple } = props;

  function handleClick(tag: string) {
    if (multiple) {
      const current = props.selected as string[];
      const onSelect = props.onSelect as (tags: string[]) => void;
      if (current.includes(tag)) {
        onSelect(current.filter((t) => t !== tag));
      } else {
        onSelect([...current, tag]);
      }
    } else {
      const onSelect = props.onSelect as (tag: string) => void;
      onSelect(tag);
    }
  }

  function isActive(tag: string): boolean {
    if (multiple) {
      return (props.selected as string[]).includes(tag);
    }
    return props.selected === tag;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <Button
          key={tag}
          variant="tag"
          size="md"
          active={isActive(tag)}
          onClick={() => handleClick(tag)}
        >
          {tag}
        </Button>
      ))}
    </div>
  );
}
