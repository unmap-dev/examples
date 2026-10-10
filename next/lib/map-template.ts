/** Editable content supplied by each map block. Coordinates are [longitude, latitude]. */
export type TemplateLang = "en" | "fr";

export interface TemplatePlace {
  id: string;
  coordinates: [number, number];
  category: number;
  content: Record<
    TemplateLang,
    { name: string; detail: string; meta: string }
  >;
}

export interface TemplateContent {
  center: [number, number];
  zoom: number;
  style: "base" | "muted" | "canopy";
  content: Record<
    TemplateLang,
    { title: string; lead: string; categories: string[] }
  >;
  places: TemplatePlace[];
}

export interface TemplateBlockProps {
  /** Your Unmap browser key. Allow your site's origin in the key settings. */
  apiKey: string;
  /** Language of the copy and the map labels: "en" (default) or "fr". */
  lang?: TemplateLang;
  /** Replace the fictional/sample content with your own locations. */
  data?: TemplateContent;
  /** An optional ut1. theme preset; UI controls still inherit your shadcn tokens. */
  theme?: string;
  className?: string;
}

export const templateLabels = {
  en: {
    all: "All",
    search: "Search locations",
    filters: "Filter locations",
    empty: "No matching locations",
    emptyHint: "Try another search or category.",
    locations: "locations",
    location: "location",
    details: "Selected location",
    previous: "Previous stop",
    next: "Next stop",
    stop: "Stop",
    of: "of",
    reset: "Show all locations",
    map: "Map",
    loading: "Loading the map…",
    unavailable:
      "The map could not load. Check your browser key and allowed origin, then reload. You can still explore the locations.",
    sample:
      "Sample content. Replace the places and descriptions with your own.",
  },
  fr: {
    all: "Tous",
    search: "Rechercher des lieux",
    filters: "Filtrer les lieux",
    empty: "Aucun lieu correspondant",
    emptyHint: "Essayez une autre recherche ou catégorie.",
    locations: "lieux",
    location: "lieu",
    details: "Lieu sélectionné",
    previous: "Arrêt précédent",
    next: "Arrêt suivant",
    stop: "Arrêt",
    of: "sur",
    reset: "Afficher tous les lieux",
    map: "Carte",
    loading: "Chargement de la carte…",
    unavailable:
      "La carte n'a pas pu charger. Vérifiez votre clé navigateur et l'origine autorisée, puis rechargez. Les lieux restent accessibles.",
    sample:
      "Contenu de démonstration. Remplacez les lieux et descriptions par les vôtres.",
  },
};

/** A chapter's camera. Coordinates are [longitude, latitude]. */
export interface StoryCamera {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
}

/** What a chapter draws when it opens: a route, or travel-time areas around a point. */
export type StoryReveal =
  | {
      kind: "route";
      from: [number, number];
      to: [number, number];
      mode: "auto" | "bicycle" | "pedestrian";
    }
  | {
      kind: "isochrone";
      center: [number, number];
      minutes: number[];
      mode: "auto" | "bicycle" | "pedestrian";
    };

export interface StoryChapter {
  /** Stable id you choose; it keys the reveal cache and the chapter's anchor. */
  id: string;
  camera: StoryCamera;
  reveal?: StoryReveal;
  content: Record<TemplateLang, { title: string; body: string }>;
}

export interface StoryContent {
  style: "base" | "muted" | "canopy" | "outdoor";
  content: Record<
    TemplateLang,
    { title: string; lead: string }
  >;
  chapters: StoryChapter[];
}

export const storyLabels = {
  en: {
    chapter: "Chapter {n} of {total}",
    announce: "Chapter {n} of {total}: {title}",
    modes: { auto: "by car", bicycle: "by bike", pedestrian: "on foot" },
    hours: "h",
    minutes: "min",
    revealing: "Loading this chapter's map...",
    creditLead: "Routes and travel times:",
    osm: "OpenStreetMap contributors",
    mapUnavailable:
      "The map could not load. Check your browser key and allowed origin, then reload. The story still reads without it.",
    keyRefused: "The API key was refused. Check it and try again.",
    busy: "Too many requests. Try again in a moment.",
    outside:
      "This chapter is outside routing coverage. Routing covers Canada.",
    noRoute: "No road or path connects this chapter's places.",
    unavailable: "The service didn't answer. Try again in a moment.",
    failed: "The request failed. Try again.",
    retry: "Try again",
  },
  fr: {
    chapter: "Chapitre {n} sur {total}",
    announce: "Chapitre {n} sur {total} : {title}",
    modes: { auto: "en voiture", bicycle: "à vélo", pedestrian: "à pied" },
    hours: "h",
    minutes: "min",
    revealing: "Chargement de la carte de ce chapitre...",
    creditLead: "Itinéraires et temps de trajet :",
    osm: "contributeurs d'OpenStreetMap",
    mapUnavailable:
      "La carte n'a pas pu charger. Vérifiez votre clé navigateur et l'origine autorisée, puis rechargez. L'histoire reste lisible sans elle.",
    keyRefused: "La clé API a été refusée. Vérifiez-la et réessayez.",
    busy: "Trop de requêtes. Réessayez dans un instant.",
    outside:
      "Ce chapitre est hors de la couverture des itinéraires. Les itinéraires couvrent le Canada.",
    noRoute: "Aucune route ni aucun chemin ne relie les lieux de ce chapitre.",
    unavailable: "Le service n'a pas répondu. Réessayez dans un instant.",
    failed: "La requête a échoué. Réessayez.",
    retry: "Réessayer",
  },
};
