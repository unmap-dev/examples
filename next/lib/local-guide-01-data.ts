import type { TemplateContent } from "@/lib/map-template";

/** Sample content. Replace these places with your own; keep coordinates in longitude/latitude order. */
export const localGuideData: TemplateContent = {
  center: [-73.568, 45.511],
  zoom: 12,
  style: "canopy",
  content: {
    en: {
      title: "A different pace in Montréal",
      lead: "Four places to pause, from the canal to the mountain.",
      categories: ["By the water", "City + green space"],
    },
    fr: {
      title: "Montréal à un autre rythme",
      lead: "Quatre lieux où faire une pause, du canal à la montagne.",
      categories: ["Au bord de l’eau", "Ville + espaces verts"],
    },
  },
  places: [
    {
      id: "canal",
      coordinates: [-73.5684, 45.4885],
      category: 0,
      content: {
        en: {
          name: "Lachine Canal",
          detail:
            "Begin beside the water. The canal gives this guide its first change of pace: a long view through a city usually seen block by block.",
          meta: "Waterfront",
        },
        fr: {
          name: "Canal de Lachine",
          detail:
            "Commencez au bord de l’eau. Le canal donne au guide son premier changement de rythme : une longue perspective sur une ville souvent découverte un îlot à la fois.",
          meta: "Au bord du canal",
        },
      },
    },
    {
      id: "old-port",
      coordinates: [-73.5508, 45.5057],
      category: 0,
      content: {
        en: {
          name: "Old Port",
          detail:
            "Stay with the water a little longer. Here the scale opens up, with the river on one side and the older city on the other.",
          meta: "Riverfront",
        },
        fr: {
          name: "Vieux-Port",
          detail:
            "Restez encore un peu près de l’eau. L’espace s’ouvre ici, avec le fleuve d’un côté et la vieille ville de l’autre.",
          meta: "Au bord du fleuve",
        },
      },
    },
    {
      id: "square",
      coordinates: [-73.5688, 45.5084],
      category: 1,
      content: {
        en: {
          name: "Place des Arts",
          detail:
            "Move into the centre of the city. Use this stop for your own photographs, recommendations, or a story about what brought you here.",
          meta: "Arts + public space",
        },
        fr: {
          name: "Place des Arts",
          detail:
            "Entrez au cœur de la ville. Ajoutez à cette étape vos photos, vos recommandations ou le récit de ce qui vous a amené ici.",
          meta: "Arts + espace public",
        },
      },
    },
    {
      id: "mount-royal",
      coordinates: [-73.5878, 45.5039],
      category: 1,
      content: {
        en: {
          name: "Mount Royal",
          detail:
            "Finish above the street grid. The mountain offers a different perspective on the places you have just explored.",
          meta: "Park + viewpoint",
        },
        fr: {
          name: "Mont Royal",
          detail:
            "Terminez au-dessus du réseau de rues. La montagne offre une autre perspective sur les lieux que vous venez d’explorer.",
          meta: "Parc + point de vue",
        },
      },
    },
  ],
};
