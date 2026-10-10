"use client";

import { MapTemplate } from "@/components/unmap-map-template";
import { publicNoticesData } from "@/lib/public-notices-01-data";
import type { TemplateBlockProps } from "@/lib/map-template";

export function PublicNotices({
  data = publicNoticesData,
  ...props
}: TemplateBlockProps) {
  return <MapTemplate {...props} data={data} />;
}
