import type { TemplateContent } from "@/lib/map-template";

/** Sample content. Replace these places with your own; keep coordinates in longitude/latitude order. */
export const businessLocatorData: TemplateContent = {
  center: [-114.069, 51.042],
  zoom: 13,
  style: "muted",
  content: {
    en: {
      title: "Fieldwork Supply",
      lead: "Everyday goods. Around the corner.",
      categories: ["Shops", "Pickup points"],
    },
    fr: {
      title: "Fieldwork Supply",
      lead: "Des essentiels du quotidien, tout près de vous.",
      categories: ["Boutiques", "Points de retrait"],
    },
  },
  places: [
    {
      id: "downtown",
      coordinates: [-114.0695, 51.0457],
      category: 0,
      content: {
        en: {
          name: "Downtown shop",
          detail:
            "Our sample flagship, with the full collection and a place to try things out.",
          meta: "Sample hours: Mon–Sat, 10–18",
        },
        fr: {
          name: "Boutique du centre-ville",
          detail:
            "Notre boutique principale fictive, avec toute la collection et un espace pour essayer les produits.",
          meta: "Horaire fictif : lun.–sam., 10–18 h",
        },
      },
    },
    {
      id: "kensington",
      coordinates: [-114.0865, 51.0526],
      category: 0,
      content: {
        en: {
          name: "Kensington shop",
          detail:
            "A smaller neighbourhood shop with a focused selection of everyday essentials.",
          meta: "Sample hours: Tue–Sun, 11–18",
        },
        fr: {
          name: "Boutique de Kensington",
          detail:
            "Une petite boutique de quartier avec une sélection ciblée d’essentiels du quotidien.",
          meta: "Horaire fictif : mar.–dim., 11–18 h",
        },
      },
    },
    {
      id: "inglewood",
      coordinates: [-114.0335, 51.0398],
      category: 1,
      content: {
        en: {
          name: "Inglewood pickup",
          detail:
            "Collect an online order here. This sample location offers pickup only.",
          meta: "Sample hours: Mon–Fri, 9–17",
        },
        fr: {
          name: "Retrait à Inglewood",
          detail:
            "Récupérez une commande en ligne ici. Ce lieu fictif offre uniquement le retrait.",
          meta: "Horaire fictif : lun.–ven., 9–17 h",
        },
      },
    },
    {
      id: "mission",
      coordinates: [-114.0713, 51.028],
      category: 1,
      content: {
        en: {
          name: "Mission pickup",
          detail:
            "A convenient sample pickup point south of downtown. Choose it when you place an order.",
          meta: "Sample hours: Mon–Fri, 10–18",
        },
        fr: {
          name: "Retrait à Mission",
          detail:
            "Un point de retrait fictif au sud du centre-ville. Choisissez-le au moment de commander.",
          meta: "Horaire fictif : lun.–ven., 10–18 h",
        },
      },
    },
  ],
};
