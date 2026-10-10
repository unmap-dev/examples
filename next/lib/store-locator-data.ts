/**
 * Ottawa Public Library branches: the sample locations of the store-locator block.
 *
 * From the City of Ottawa open data item "Library Locations and Hours (Ottawa Public Libraries)
 * API" (d64cd889fa7d4852845d9d9e208fe1ea): the English and French branch feeds, retrieved
 * 2026-09-29, joined on postal code. Hours are the regular weekly hours on that date (null is
 * closed); holiday exceptions are not included and the hours will go stale. Licensed under the
 * Open Government Licence, City of Ottawa, version 2.0.
 *
 * Replace STORES with your own points: any FeatureCollection with these properties works.
 */

export type StoreDay = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export interface StoreProperties {
  id: string;
  name: string;
  name_fr: string;
  address: string;
  hours: Record<StoreDay, string | null>;
}

export interface StoreFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: StoreProperties;
}

export interface StoreCollection {
  type: "FeatureCollection";
  features: StoreFeature[];
}

/**
 * Credit line the block prints under the list. The licence asks for this wording; the French line
 * keeps the licence's official name.
 */
export const STORES_SOURCE = {
  name: "Ottawa Public Library branches, City of Ottawa open data",
  name_fr: "Succursales de la Bibliothèque publique d'Ottawa, données ouvertes de la Ville d'Ottawa",
  url: "https://open.ottawa.ca/datasets/d64cd889fa7d4852845d9d9e208fe1ea",
  licence: "Contains information licensed under the Open Government Licence – City of Ottawa.",
  licence_fr: "Contient de l'information visée par l'Open Government Licence – City of Ottawa.",
  licenceUrl: "https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data/open-data-licence-version-20",
};

export const STORES: StoreCollection = {
  type: "FeatureCollection",
  features: [
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.66172,45.378111]},"properties":{"id":"alta-vista","name":"Alta Vista","name_fr":"Alta Vista","address":"2516 Alta Vista, Ottawa, ON K1V 7T1","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.895303,45.321871]},"properties":{"id":"beaverbrook","name":"Beaverbrook","name_fr":"Beaverbrook","address":"2500 Campeau, Ottawa, ON K2K 2W3","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.564533,45.43091]},"properties":{"id":"blackburn-hamlet","name":"Blackburn Hamlet","name_fr":"Blackburn Hamlet","address":"199 Glen Park, Ottawa, ON K1B 5B8","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.77204,45.3732]},"properties":{"id":"carlingwood","name":"Carlingwood","name_fr":"Carlingwood","address":"281 Woodroffe, Ottawa, ON K2A 3W4","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-76.047203,45.351002]},"properties":{"id":"carp","name":"Carp","name_fr":"Carp","address":"3911 Carp, Ottawa, ON K0A 1L0","hours":{"sun":null,"mon":"10:00-18:00","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.826202,45.320702]},"properties":{"id":"centennial","name":"Centennial","name_fr":"Centennial","address":"3870 Old Richmond, Ottawa, ON K2H 5C4","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-76.093498,45.499001]},"properties":{"id":"constance-bay","name":"Constance Bay","name_fr":"Constance Bay","address":"262 Len Purcell, Ottawa, ON K0A 3M0","hours":{"sun":null,"mon":null,"tue":"10:00-17:00","wed":"16:00-20:00","thu":"16:00-20:00","fri":"15:00-18:00","sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.493202,45.471199]},"properties":{"id":"cumberland","name":"Cumberland","name_fr":"Cumberland","address":"1599 Tenth Line, Ottawa, ON K1E 3E8","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.624702,45.399899]},"properties":{"id":"elmvale-acres","name":"Elmvale Acres","name_fr":"Elmvale Acres","address":"1910 St-Laurent, Ottawa, ON K1G 1A4","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.733398,45.354698]},"properties":{"id":"emerald-plaza","name":"Emerald Plaza","name_fr":"Emerald Plaza","address":"1547 Merivale, Ottawa, ON K2G 4V3","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-76.206299,45.4701]},"properties":{"id":"fitzroy-harbour","name":"Fitzroy Harbour","name_fr":"Fitzroy Harbour","address":"100 Clifford Campbell, Ottawa, ON K0A 1X0","hours":{"sun":null,"mon":"17:00-20:00","tue":null,"wed":"17:00-20:00","thu":"10:00-13:00","fri":null,"sat":"10:00-13:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.557198,45.2612]},"properties":{"id":"greely","name":"Greely","name_fr":"Greely","address":"1448 Meadow Drive, Ottawa, ON K4P 1B1","hours":{"sun":null,"mon":"10:00-18:00","tue":"10:00-20:00","wed":"10:00-20:00","thu":"10:00-18:00","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.635399,45.3634]},"properties":{"id":"greenboro","name":"Greenboro","name_fr":"Greenboro","address":"363 Lorry Greenberg, Ottawa, ON K1T 3P8","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.885902,45.295399]},"properties":{"id":"hazeldean","name":"Hazeldean","name_fr":"Hazeldean","address":"50 Castlefrank, Ottawa, ON K2L 2N5","hours":{"sun":"10:00-17:00","mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.695396,45.4203]},"properties":{"id":"main","name":"Main","name_fr":"Centrale","address":"120 Metcalfe, Ottawa, ON K1P 5M2","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.679604,45.230301]},"properties":{"id":"manotick","name":"Manotick","name_fr":"Manotick","address":"5499 South River, Ottawa, ON K4M 1J3","hours":{"sun":null,"mon":null,"tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.471778,45.236744]},"properties":{"id":"metcalfe-village","name":"Metcalfe village","name_fr":"Metcalfe","address":"8243 Victoria St, Ottawa, ON K0A 2P0","hours":{"sun":null,"mon":null,"tue":"10:00-20:00","wed":"10:00-14:00","thu":"10:00-20:00","fri":"13:00-17:00","sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.939102,45.165199]},"properties":{"id":"munster","name":"Munster","name_fr":"Munster","address":"7749 Bleeks, Ottawa, ON K0A 3P0","hours":{"sun":null,"mon":"10:00-14:00","tue":"15:00-20:00","wed":"10:00-14:00","thu":"15:00-20:00","fri":null,"sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.762703,45.3442]},"properties":{"id":"nepean-centrepointe","name":"Nepean Centrepointe","name_fr":"Nepean Centrepointe","address":"101 Centrepointe, Ottawa, ON K2G 5K7","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.600899,45.438301]},"properties":{"id":"north-gloucester","name":"North Gloucester","name_fr":"Gloucester Nord","address":"2036 Ogilvie, Ottawa, ON K1J 7N8","hours":{"sun":"10:00-17:00","mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.717598,45.132801]},"properties":{"id":"north-gower","name":"North Gower","name_fr":"North Gower","address":"6579 Fourth Line, Ottawa, ON K0A 2T0","hours":{"sun":null,"mon":"10:00-16:00","tue":"13:00-20:00","wed":"10:00-18:00","thu":"13:00-20:00","fri":null,"sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.5242,45.4566]},"properties":{"id":"orleans","name":"Orléans","name_fr":"Orléans","address":"1705 Orléans, Ottawa, ON K1C 4W2","hours":{"sun":"10:00-17:00","mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.603203,45.1474]},"properties":{"id":"osgoode","name":"Osgoode","name_fr":"Osgoode","address":"5630 Osgoode Main, Ottawa, ON K0A 2W0","hours":{"sun":null,"mon":"10:00-17:00","tue":"10:00-20:00","wed":"13:00-17:00","thu":"13:00-20:00","fri":null,"sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.843903,45.190899]},"properties":{"id":"richmond","name":"Richmond","name_fr":"Richmond","address":"6240 Perth Street, Ottawa, ON K0A 2Z0","hours":{"sun":null,"mon":"10:00-20:00","tue":"10:00-18:00","wed":"10:00-20:00","thu":"10:00-18:00","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.683098,45.430099]},"properties":{"id":"rideau","name":"Rideau","name_fr":"Rideau","address":"377 Rideau, Ottawa, ON K1N 5Y6","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.6791,45.451]},"properties":{"id":"rockcliffe-park","name":"Rockcliffe Park","name_fr":"Rockcliffe Park","address":"380 Springfield, Ottawa, ON K1M 0L7","hours":{"sun":null,"mon":"10:00-17:00","tue":"13:00-20:00","wed":"10:00-17:00","thu":"13:00-20:00","fri":"13:00-18:00","sat":"10:00-14:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.726315,45.401637]},"properties":{"id":"rosemount","name":"Rosemount","name_fr":"Rosemount","address":"18 Rosemount, Ottawa, ON K1Y 1P4","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.761497,45.2799]},"properties":{"id":"ruth-e-dickinson","name":"Ruth E. Dickinson","name_fr":"Ruth E. Dickinson","address":"100 Malvern, Ottawa, ON K2J 2G5","hours":{"sun":"10:00-17:00","mon":"10:00-21:00","tue":"10:00-21:00","wed":"10:00-21:00","thu":"10:00-21:00","fri":"10:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.647903,45.436199]},"properties":{"id":"st-laurent","name":"St-Laurent","name_fr":"St-Laurent","address":"515 Côté, Ottawa, ON K1K 0Z8","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.915497,45.2542]},"properties":{"id":"stittsville","name":"Stittsville","name_fr":"Stittsville","address":"1637 Stittsville Main, Ottawa, ON K2S 1A9","hours":{"sun":"10:00-17:00","mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.683899,45.3955]},"properties":{"id":"sunnyside","name":"Sunnyside","name_fr":"Sunnyside","address":"1049 Bank, Ottawa, ON K1S 3W9","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"10:00-20:30","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.6604,45.444302]},"properties":{"id":"vanier","name":"Vanier","name_fr":"Vanier","address":"310 Pères Blancs, Ottawa, ON K1L 7L5","hours":{"sun":null,"mon":"10:00-20:30","tue":"10:00-20:30","wed":"10:00-20:30","thu":"13:00-18:00","fri":"13:00-18:00","sat":"10:00-17:00"}}},
    {"type":"Feature","geometry":{"type":"Point","coordinates":[-75.463799,45.1633]},"properties":{"id":"vernon","name":"Vernon","name_fr":"Vernon","address":"8682 Bank, Ottawa, ON K0A 3J0","hours":{"sun":null,"mon":null,"tue":"10:00-17:00","wed":"16:00-20:00","thu":"13:00-20:00","fri":null,"sat":"10:00-14:00"}}},
  ],
};
