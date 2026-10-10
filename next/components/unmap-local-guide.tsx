"use client";

import { MapTemplate } from "@/components/unmap-map-template";
import { localGuideData } from "@/lib/local-guide-01-data";
import type { TemplateBlockProps } from "@/lib/map-template";

export function LocalGuide({
  data = localGuideData,
  ...props
}: TemplateBlockProps) {
  return <MapTemplate {...props} data={data} guided />;
}
