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
  route,
}: {
  route?: any;
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
    [mapConfig, setMapConfig] = useState<any>(null);
  useEffect(() => {
    void fetch("/api/v1/demo/reference-data")
      .then((r) => r.json())
      .then((r) => setMapConfig(r))
      .catch(() => setMapConfig({ mapMode: "CONTEXT_ONLY" }));
  }, []);
  useEffect(() => {
    if (!container.current || unavailable || !mapConfig) return;
    let cancelled = false;
    let map: any;
    setFailed(false);
    void import("maplibre-gl").then(({ default: lib }) => {
      if (cancelled || !container.current) return;
      try {
        map = new lib.Map({
          container: container.current,
          center: [4.556, 7.779],
          zoom: 13.8,
          attributionControl: { compact: true },
          style: mapConfig.mapStyleUrl || {
            version: 8,
            sources: {},
            layers: [
              {
                id: "background",
                type: "background",
                paint: { "background-color": "#0c1b2a" },
              },
            ],
          },
        });
      } catch {
        setFailed(true);
        return;
      }
      mapRef.current = map;
      if (route)
        map.on("load", () => {
          map.addSource("estimated-route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: route },
          });
          map.addLayer({
            id: "estimated-route",
            type: "line",
            source: "estimated-route",
            paint: {
              "line-color": "#3ee5c0",
              "line-width": 4,
              "line-dasharray": [2, 1],
            },
          });
          const bounds = new lib.LngLatBounds();
          route.coordinates.forEach((p: [number, number]) => bounds.extend(p));
          map.fitBounds(bounds, { padding: 35, maxZoom: 15 });
        });
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
    mapConfig,
    JSON.stringify(route),
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
        <span>
          {t(
            mapConfig?.mapMode === "OSM_LOCAL"
              ? "cad.osmMap"
              : mapConfig?.mapMode === "PROVIDER"
                ? "cad.providerMap"
                : "cad.map",
          )}
        </span>
      </div>
      <div className="map-place place-one">
        OSOGBO<span>7.7738° N · 4.5557° E</span>
      </div>
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
        {t(
          mapConfig?.mapMode === "CONTEXT_ONLY"
            ? "cad.mapNote"
            : "cad.providerMapNote",
        )}
      </div>
      {(failed || unavailable) && (
        <div className="map-failure">{t("cad.mapUnavailable")}</div>
      )}
    </div>
  );
}
