import type { StoryContent } from "@/lib/map-template";

const CALGARY: [number, number] = [-114.0719, 51.0447];
const BANFF: [number, number] = [-115.5708, 51.1784];

/** Sample story. Replace the chapters with your own; coordinates are [longitude, latitude]. */
export const mapStoryData: StoryContent = {
  style: "outdoor",
  content: {
    en: {
      title: "Calgary to the Rockies",
      lead: "Scroll to drive west: one route and two travel-time maps, answered live by the routing API.",
    },
    fr: {
      title: "De Calgary aux Rocheuses",
      lead: "Faites défiler pour rouler vers l'ouest : un itinéraire et deux cartes de temps de parcours, calculés en direct par l'API d'itinéraires.",
    },
  },
  chapters: [
    {
      id: "calgary",
      camera: { center: CALGARY, zoom: 11.5 },
      content: {
        en: {
          title: "Calgary",
          body: "The story starts downtown, where the Bow and the Elbow meet. Scroll to follow the Trans-Canada Highway west.",
        },
        fr: {
          title: "Calgary",
          body: "L'histoire commence au centre-ville, au confluent de la Bow et de l'Elbow. Faites défiler pour suivre la Transcanadienne vers l'ouest.",
        },
      },
    },
    {
      id: "drive",
      camera: { center: [-114.82, 51.12], zoom: 8.6, bearing: -12, pitch: 40 },
      reveal: { kind: "route", from: CALGARY, to: BANFF, mode: "auto" },
      content: {
        en: {
          title: "Into the Rockies",
          body: "About 130 km on Highway 1 to Banff. The route comes from the routing API and draws in as the chapter opens.",
        },
        fr: {
          title: "Vers les Rocheuses",
          body: "Environ 130 km sur l'autoroute 1 jusqu'à Banff. L'itinéraire vient de l'API d'itinéraires et se trace à l'ouverture du chapitre.",
        },
      },
    },
    {
      id: "banff",
      camera: { center: BANFF, zoom: 13, pitch: 45 },
      reveal: { kind: "isochrone", center: BANFF, minutes: [10, 20, 30], mode: "pedestrian" },
      content: {
        en: {
          title: "Banff on foot",
          body: "How far 10, 20 and 30 minutes of walking reach from Banff Avenue, from the routing API's travel-time areas.",
        },
        fr: {
          title: "Banff à pied",
          body: "Jusqu'où mènent 10, 20 et 30 minutes de marche depuis l'avenue Banff, selon les zones de temps de parcours de l'API d'itinéraires.",
        },
      },
    },
    {
      id: "lake-louise",
      camera: { center: [-116.18, 51.41], zoom: 11, bearing: -5, pitch: 50 },
      reveal: { kind: "isochrone", center: [-116.1773, 51.4254], minutes: [15, 30], mode: "bicycle" },
      content: {
        en: {
          title: "Lake Louise by bike",
          body: "Fifteen and thirty minutes by bike from the village. Cycling times account for the grade of every road, so the climb to the lake takes longer.",
        },
        fr: {
          title: "Lake Louise à vélo",
          body: "Quinze et trente minutes à vélo depuis le village. Les temps à vélo tiennent compte de la pente de chaque route, alors la montée vers le lac prend plus de temps.",
        },
      },
    },
  ],
};
