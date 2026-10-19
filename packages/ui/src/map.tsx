"use client";
import { useEffect, useRef, useState } from "react";
import { Maximize2, MapPin, Layers, Plus, Minus } from "lucide-react";
import { t } from "../../i18n/src/index";
export function GeoMap({
  incidents = [],
  units = [],
  selected,
  onSelect,
  unavailable = false,
  onPick,
}: {
  incidents?: any[];
  units?: any[];
  selected?: string;
  onSelect?: (id: string) => void;
  unavailable?: boolean;
  onPick?: (longitude: number, latitude: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    mapRef = useRef<any>(null),
    [failed, setFailed] = useState(false),
    [styleUrl, setStyleUrl] = useState<string | null>(null);
  useEffect(() => {
    void fetch("/api/v1/demo/reference-data")
      .then((r) => r.json())
      .then((r) => setStyleUrl(r.mapStyleUrl || null))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!container.current || unavailable) return;
    let cancelled = false;
    let map: any;
    setFailed(false);
    void import("maplibre-gl").then(({ default: lib }) => {
      if (cancelled || !container.current) return;
      const features: any[] = [];
      for (let x = 0; x < 12; x++) {
        const longitude = 4.532 + x * 0.004;
        features.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [longitude, 7.749],
              [longitude + 0.009, 7.807],
            ],
          },
        });
      }
      for (let y = 0; y < 14; y++) {
        const latitude = 7.751 + y * 0.004;
        features.push({
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [4.527, latitude],
              [4.588, latitude + 0.008],
            ],
          },
        });
      }
      try {
        map = new lib.Map({
          container: container.current,
          center: [4.556, 7.779],
          zoom: 13.8,
          attributionControl: styleUrl ? { compact: true } : false,
          style: styleUrl || {
            version: 8,
            sources: {
              schematic: {
                type: "geojson",
                data: { type: "FeatureCollection", features },
              },
              arterial: {
                type: "geojson",
                data: {
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "LineString",
                        coordinates: [
                          [4.531, 7.754],
                          [4.551, 7.769],
                          [4.5557, 7.7738],
                          [4.566, 7.789],
                          [4.58, 7.806],
                        ],
                      },
                    },
                    {
                      type: "Feature",
                      properties: {},
                      geometry: {
                        type: "LineString",
                        coordinates: [
                          [4.53, 7.784],
                          [4.553, 7.779],
                          [4.575, 7.768],
                        ],
                      },
                    },
                  ],
                },
              },
            },
            layers: [
              {
                id: "background",
                type: "background",
                paint: { "background-color": "#0c1b2a" },
              },
              {
                id: "streets",
                type: "line",
                source: "schematic",
                paint: { "line-color": "#1c3346", "line-width": 2 },
              },
              {
                id: "arterial-casing",
                type: "line",
                source: "arterial",
                paint: { "line-color": "#30495b", "line-width": 8 },
              },
              {
                id: "arterial",
                type: "line",
                source: "arterial",
                paint: { "line-color": "#20394a", "line-width": 5 },
              },
            ],
          },
        });
      } catch {
        setFailed(true);
        return;
      }
      mapRef.current = map;
      map.on("click", (e: any) => onPick?.(e.lngLat.lng, e.lngLat.lat));
      map.on("error", () => setFailed(true));
      for (const i of incidents) {
        if (i.longitude == null || i.latitude == null) continue;
        const el = document.createElement("button");
        el.className = "map-marker " + (selected === i.id ? "selected" : "");
        el.textContent = "";
        el.setAttribute(
          "aria-label",
          t("accessibility.incident", { reference: i.public_reference }),
        );
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelect?.(i.id);
        });
        const marker = new lib.Marker({ element: el, draggable: !!onPick })
          .setLngLat([i.longitude, i.latitude])
          .addTo(map);
        marker.on("dragend", () => {
          const point = marker.getLngLat();
          if (
            point.lng >= 4.45 &&
            point.lng <= 4.7 &&
            point.lat >= 7.65 &&
            point.lat <= 7.9
          )
            onPick?.(point.lng, point.lat);
          else marker.setLngLat([i.longitude, i.latitude]);
        });
      }
      for (const u of units) {
        if (u.longitude == null || u.latitude == null) continue;
        const el = document.createElement("span");
        el.className = "unit-marker " + (u.fresh ? "" : "stale");
        el.textContent = "⌁";
        new lib.Marker({ element: el })
          .setLngLat([u.longitude, u.latitude])
          .addTo(map);
      }
    });
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [
    JSON.stringify(incidents.map((i) => [i.id, i.longitude, i.latitude])),
    JSON.stringify(units),
    selected,
    styleUrl,
    unavailable,
  ]);
  return (
    <div className="geo-map">
      <div
        ref={container}
        className="map-canvas"
        role="region"
        aria-label={t("accessibility.map")}
      />
      <div className="map-label">
        <Layers size={14} />
        <span>{t(styleUrl ? "cad.providerMap" : "cad.map")}</span>
      </div>
      <div className="map-place place-one">
        OSOGBO<span>7.7738° N · 4.5557° E</span>
      </div>
      <div className="map-place place-two">OLAIYA</div>
      <div className="map-place place-three">FREEDOM PARK</div>
      <div className="map-controls">
        <button
          disabled={failed || unavailable}
          aria-label={t("accessibility.zoomIn")}
          onClick={() => mapRef.current?.zoomIn()}
        >
          <Plus size={17} />
        </button>
        <button
          disabled={failed || unavailable}
          aria-label={t("accessibility.zoomOut")}
          onClick={() => mapRef.current?.zoomOut()}
        >
          <Minus size={17} />
        </button>
        <button
          disabled={failed || unavailable}
          aria-label={t("common.refresh")}
          onClick={() =>
            mapRef.current?.flyTo({ center: [4.556, 7.779], zoom: 13.8 })
          }
        >
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="map-attribution">
        <MapPin size={12} />
        {t(styleUrl ? "cad.providerMapNote" : "cad.mapNote")}
      </div>
      {(failed || unavailable) && (
        <div className="map-failure">{t("cad.mapUnavailable")}</div>
      )}
    </div>
  );
}
