# Map data and routing

The local MapLibre GeoJSON schematic is original synthetic geometry supplied with this repository. Its lines are fictional; landmark coordinates are plausible public Osogbo coordinates, not a routing network or real unit deployment. No external imagery is necessary for the credential-free demo. Companion lists remain fully functional when map rendering is disabled, unavailable, or WebGL fails.

For geographically accurate vector tiles, configure `MAP_STYLE_URL` with a licensed self-hosted MapLibre style URL (including correctly licensed sources, glyphs, sprites and attribution). External style/tile/sprite/glyph hosts must be allowed by the environment's network policy. Do not expose secret map keys in a public bundle. Respect provider terms and OpenStreetMap attribution/ODbL obligations for OSM-derived maps.

No routing provider is bundled. Candidate distance uses PostGIS geography in metres; longitude precedes latitude. Road travel time and traffic are not inferred. ETA is explicitly unavailable. Integrating an optional provider must retain timestamp/provider/uncertainty and tested failure fallback; never divide straight-line distance by a made-up driving speed and present it as measured ETA.
