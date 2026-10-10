import type { TemplateContent } from "@/lib/map-template";

/** Sample content. Replace these places with your own; keep coordinates in longitude/latitude order. */
export const publicNoticesData: TemplateContent = {
  center: [-114.069, 51.048],
  zoom: 13,
  style: "base",
  content: {
    en: {
      title: "Neighbourhood updates",
      lead: "A sample board for work in public spaces.",
      categories: ["In progress", "Planned", "Complete"],
    },
    fr: {
      title: "Nouvelles du quartier",
      lead: "Un tableau fictif de travaux dans les espaces publics.",
      categories: ["En cours", "Prévus", "Terminés"],
    },
  },
  places: [
    {
      id: "path",
      coordinates: [-114.0838, 51.0547],
      category: 0,
      content: {
        en: {
          name: "Path maintenance",
          detail:
            "Sample notice: a short section of pathway is being resurfaced. Add a verified detour and contact details to your own notice.",
          meta: "Sample timing: 5–9 October",
        },
        fr: {
          name: "Entretien du sentier",
          detail:
            "Avis fictif : une courte section de sentier est en réfection. Ajoutez un détour vérifié et des coordonnées à votre propre avis.",
          meta: "Dates fictives : du 5 au 9 octobre",
        },
      },
    },
    {
      id: "crossing",
      coordinates: [-114.0653, 51.0488],
      category: 0,
      content: {
        en: {
          name: "Crossing improvements",
          detail:
            "Sample notice: crews are updating a pedestrian crossing. Describe the affected area and how people can get around it.",
          meta: "Sample timing: 1–7 October",
        },
        fr: {
          name: "Amélioration d’une traversée",
          detail:
            "Avis fictif : une équipe améliore une traversée piétonne. Décrivez la zone touchée et les façons de la contourner.",
          meta: "Dates fictives : du 1er au 7 octobre",
        },
      },
    },
    {
      id: "planting",
      coordinates: [-114.0474, 51.0517],
      category: 1,
      content: {
        en: {
          name: "New tree planting",
          detail:
            "Sample notice: planting is scheduled for a neighbourhood green space. Use this space to explain the work and expected access.",
          meta: "Sample timing: 12–16 October",
        },
        fr: {
          name: "Plantation d’arbres",
          detail:
            "Avis fictif : une plantation est prévue dans un espace vert du quartier. Expliquez les travaux et l’accès prévu.",
          meta: "Dates fictives : du 12 au 16 octobre",
        },
      },
    },
    {
      id: "lighting",
      coordinates: [-114.0779, 51.0387],
      category: 2,
      content: {
        en: {
          name: "Lighting repairs",
          detail:
            "Sample notice: repairs have been completed. Keep resolved notices available so residents can see what changed.",
          meta: "Sample timing: completed 28 September",
        },
        fr: {
          name: "Réparation de l’éclairage",
          detail:
            "Avis fictif : les réparations sont terminées. Conservez les avis résolus pour montrer aux résidents ce qui a changé.",
          meta: "Date fictive : terminé le 28 septembre",
        },
      },
    },
  ],
};
