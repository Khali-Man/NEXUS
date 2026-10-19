import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
export const roadsFile = () =>
  resolve(process.env.OSM_ROADS_FILE || ".nexus/maps/osogbo-roads.geojson");
export function mapConfig() {
  const local = existsSync(roadsFile());
  let metadata = null;
  try {
    metadata = JSON.parse(
      readFileSync(resolve(".nexus/maps/metadata.json"), "utf8"),
    );
  } catch {}
  return {
    mapStyleUrl: process.env.MAP_STYLE_URL || "/api/v1/demo/map-style",
    mapMode: process.env.MAP_STYLE_URL
      ? "PROVIDER"
      : local
        ? "OSM_LOCAL"
        : "CONTEXT_ONLY",
    mapData: metadata,
  };
}
export function mapStyle() {
  const available = existsSync(roadsFile());
  return {
    version: 8,
    sources: available
      ? {
          roads: {
            type: "geojson",
            data: "/api/v1/demo/roads",
            attribution:
              '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · ODbL',
          },
        }
      : {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#0c1b2a" },
      },
      ...(available
        ? [
            {
              id: "roads-casing",
              type: "line",
              source: "roads",
              paint: {
                "line-color": "#345067",
                "line-width": [
                  "match",
                  ["get", "highway"],
                  ["primary", "secondary", "trunk"],
                  6,
                  3,
                ],
              },
            },
            {
              id: "roads",
              type: "line",
              source: "roads",
              paint: {
                "line-color": "#21394b",
                "line-width": [
                  "match",
                  ["get", "highway"],
                  ["primary", "secondary", "trunk"],
                  4,
                  1,
                ],
              },
            },
          ]
        : []),
    ],
  };
}
