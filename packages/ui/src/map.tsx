"use client";
import { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  MapPin,
  Layers,
  Plus,
  Minus,
  Map,
  ArrowUpRight,
  Truck,
} from "lucide-react";
import { t, number } from "../../i18n/src/index";
import { Status } from "./atoms";
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
  const contextOnly =
    mapConfig && !["OSM_LOCAL", "PROVIDER"].includes(mapConfig.mapMode);
  const fallback = failed || unavailable || (contextOnly && !route);
  const located = incidents.filter(
    (i) => i.longitude != null && i.latitude != null,
  );
  const freshUnits = units.filter(
    (u) => u.fresh && u.longitude != null && u.latitude != null,
  );
  useEffect(() => {
    void fetch("/api/v1/demo/reference-data")
      .then((r) => {
        if (!r.ok) throw new Error("MAP_CONFIG_UNAVAILABLE");
        return r.json();
      })
      .then((r) => setMapConfig(r))
      .catch(() => setMapConfig({ mapMode: "CONTEXT_ONLY" }));
  }, []);
  useEffect(() => {
    if (
      !container.current ||
      unavailable ||
      !mapConfig ||
      (contextOnly && !onPick && !route)
    )
      return;
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
        el.className =
          "unit-marker " +
          (u.fresh ? u.dispatch_status.toLowerCase() : "stale");
        el.textContent = !u.fresh
          ? "!"
          : u.dispatch_status === "AVAILABLE"
            ? "A"
            : u.dispatch_status === "BUSY"
              ? "B"
              : "O";
        el.title = `${u.callsign} · ${t("status." + u.dispatch_status)} · ${t(u.fresh ? "cad.fresh" : "cad.stale")}`;
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
    <div className={"geo-map " + (fallback && !onPick ? "location-mode" : "")}>
      {(!fallback || onPick) && (
        <div
          ref={container}
          className="map-canvas"
          role="region"
          aria-label={t("accessibility.map")}
        />
      )}
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
      {!fallback && (
        <div className="map-place place-one">
          OSOGBO<span>7.7738° N · 4.5557° E</span>
        </div>
      )}
      {(!fallback || onPick) && (
        <div className="map-controls">
          <button
            disabled={failed || unavailable || !mapConfig}
            aria-label={t("accessibility.zoomIn")}
            onClick={() => mapRef.current?.zoomIn()}
          >
            <Plus size={17} />
          </button>
          <button
            disabled={failed || unavailable || !mapConfig}
            aria-label={t("accessibility.zoomOut")}
            onClick={() => mapRef.current?.zoomOut()}
          >
            <Minus size={17} />
          </button>
          <button
            disabled={failed || unavailable || !mapConfig}
            aria-label={t("common.refresh")}
            onClick={() =>
              mapRef.current?.flyTo({ center: [4.556, 7.779], zoom: 13.8 })
            }
          >
            <Maximize2 size={16} />
          </button>
        </div>
      )}
      {!mapConfig && !unavailable && (
        <p className="map-loading" role="status">
          {t("cad.loadingMap")}
        </p>
      )}
      {fallback && !onPick && (
        <section
          className="location-board"
          aria-label={t("cad.locationBoard")}
          tabIndex={0}
        >
          <header className="location-heading">
            <span className="location-icon">
              <Map size={25} />
            </span>
            <div>
              <p className="eyebrow">{t("cad.researchArea")}</p>
              <h2>{t("cad.locationFallback")}</h2>
            </div>
          </header>
          <span className="map-mode-badge">
            <Layers size={14} />
            {t("cad.roadLayerMissing")}
          </span>
          <p className="location-explanation">
            {t("cad.locationFallbackInfo")}
          </p>
          <dl className="location-counts">
            <div>
              <dt>{t("cad.viewRecords")}</dt>
              <dd>{number(incidents.length)}</dd>
            </div>
            <div>
              <dt>{t("cad.located")}</dt>
              <dd>{number(located.length)}</dd>
            </div>
            <div>
              <dt>{t("cad.freshUnits")}</dt>
              <dd>
                {number(freshUnits.length)}
                <small> / {number(units.length)}</small>
              </dd>
            </div>
          </dl>
          <h3 className="location-list-title">
            <MapPin size={15} />
            {t("cad.locationList")}
          </h3>
          <div className="location-list">
            {incidents.slice(0, 8).map((i) => (
              <button
                key={i.id}
                className={
                  "location-record " + (selected === i.id ? "selected" : "")
                }
                aria-pressed={selected === i.id}
                onClick={() => onSelect?.(i.id)}
                disabled={!onSelect}
              >
                <div>
                  <span className="reference">{i.public_reference}</span>
                  <Status value={i.status} />
                </div>
                <strong>{i.landmark}</strong>
                <small>
                  {i.latitude != null && i.longitude != null
                    ? t("cad.coordinateLabel", {
                        latitude: number(Number(i.latitude), {
                          maximumFractionDigits: 4,
                        }),
                        longitude: number(Number(i.longitude), {
                          maximumFractionDigits: 4,
                        }),
                      })
                    : t("cad.coordinateMissing")}
                  <ArrowUpRight size={15} />
                </small>
              </button>
            ))}
            {!incidents.length && (
              <p className="location-empty">{t("cad.emptyQueue")}</p>
            )}
          </div>
          {incidents.length > 8 && (
            <p className="location-caution">
              {t("cad.locationMore", { shown: 8, total: incidents.length })}
            </p>
          )}
          <div className="location-unit-key" aria-label={t("cad.unitLegend")}>
            <Truck size={15} />
            <span>
              {t("cad.fresh")}: {number(freshUnits.length)}
            </span>
            <span>
              {t("cad.unavailablePositions")}:{" "}
              {number(units.length - freshUnits.length)}
            </span>
          </div>
          <p className="location-caution">{t("cad.positionOnly")}</p>
        </section>
      )}
      <div className="map-attribution">
        <MapPin size={12} />
        {t(
          mapConfig?.mapMode === "CONTEXT_ONLY"
            ? "cad.mapNote"
            : "cad.providerMapNote",
        )}
      </div>
      {fallback && onPick && (
        <div className="map-failure map-picker-note">
          {t("cad.mapUnavailable")}
        </div>
      )}
    </div>
  );
}
