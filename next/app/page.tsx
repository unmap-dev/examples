import Link from "next/link";
export default function Page() { return <main className="mx-auto max-w-3xl p-6"><h1 className="text-3xl font-bold">Unmap examples</h1><p className="my-4">Set NEXT_PUBLIC_UNMAP_KEY in next/.env.local. Choose a docs example, template, or block.</p><ul><li className="my-3"><Link href="/business-locator/">Business locator</Link> — template</li>
<li className="my-3"><Link href="/local-guide/">Local guide</Link> — template</li>
<li className="my-3"><Link href="/public-notices/">Public notices</Link> — template</li>
<li className="my-3"><Link href="/map-story/">Map story</Link> — template</li>
<li className="my-3"><Link href="/store-locator/">Store Locator</Link> — block</li>
<li className="my-3"><Link href="/directions/">Directions</Link> — block</li>
<li className="my-3"><Link href="/flow-map/">Migration Flow Map</Link> — block</li>
<li className="my-3"><Link href="/elevation-explorer/">Elevation Explorer</Link> — block</li>
<li className="my-3"><Link href="/delivery-tracker/">Delivery Tracker</Link> — block</li>
<li className="my-3"><Link href="/census-choropleth/">Census Choropleth</Link> — block</li>
<li className="my-3"><Link href="/land-treaty-inspector/">Legal Land and Treaty Inspector</Link> — block</li>
<li className="my-3"><Link href="/address-playground/">Address Playground</Link> — block</li>
<li className="my-3"><Link href="/energy-explorer/">Energy Explorer</Link> — block</li>
<li className="my-3"><Link href="/map-markers/">Marker and popup example</Link> — example</li>
<li className="my-3"><Link href="/map-measure/">Measure a distance example</Link> — example</li>
<li className="my-3"><Link href="/map-inspect/">Inspect map features example</Link> — example</li>
<li className="my-3"><Link href="/map-timeline/">Play a timeline example</Link> — example</li>
<li className="my-3"><Link href="/map-draw/">Draw on the map example</Link> — example</li>
<li className="my-3"><Link href="/map-compare/">Compare two styles example</Link> — example</li>
<li className="my-3"><Link href="/map-elevation/">Trail elevation profile example</Link> — example</li>
<li className="my-3"><Link href="/map-geojson/">Service zones example</Link> — example</li>
<li className="my-3"><Link href="/map-clusters/">Clustered points example</Link> — example</li>
<li className="my-3"><Link href="/map-heatmap/">Weighted heatmap example</Link> — example</li>
<li className="my-3"><Link href="/map-arcs/">Arcs from Winnipeg example</Link> — example</li>
<li className="my-3"><Link href="/map-flows/">Migration flows example</Link> — example</li></ul></main>; }
