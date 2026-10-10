"use client";

import { MapTemplate } from "@/components/unmap-map-template";
import { businessLocatorData } from "@/lib/business-locator-01-data";
import type { TemplateBlockProps } from "@/lib/map-template";

export function BusinessLocator({
  data = businessLocatorData,
  ...props
}: TemplateBlockProps) {
  return <MapTemplate {...props} data={data} />;
}
