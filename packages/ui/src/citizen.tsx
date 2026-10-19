"use client";
import { useState, useEffect } from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ChevronLeft,
  Clipboard,
  Compass,
  Eye,
  MapPin,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { LocaleProvider, t, date } from "../../i18n/src/index";
import { categories, landmarks } from "../../contracts/src/index";
import { api, client, useLive } from "./api";
import {
  Brand,
  Warning,
  ErrorBox,
  Status,
  Connectivity,
  EventTimeline,
  Loading,
} from "./atoms";
import { GeoMap } from "./map";
export function CitizenApp() {
  return (
    <LocaleProvider>
      <QueryClientProvider client={client}>
        <Citizen />
      </QueryClientProvider>
    </LocaleProvider>
  );
}
function Citizen() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  function navigate(url: string) {
    history.pushState({}, "", url);
    setPath(url);
    window.scrollTo(0, 0);
  }
  return (
    <div className="light citizen-app">
      <a href="#main" className="skip-link">
        {t("accessibility.skip")}
      </a>
      <Warning />
      <header className="citizen-header">
        <Brand />
        <nav>
          <a href="/about">{t("common.about")}</a>
          <a href="/help">
            {t("common.help")}
            <ArrowUpRight size={14} />
          </a>
        </nav>
      </header>
      <main id="main">
        {path === "/" ? (
          <CitizenHome start={() => navigate("/demo/new/category")} />
        ) : path.startsWith("/demo/new/") ? (
          <CitizenWizard path={path} navigate={navigate} />
        ) : path.startsWith("/demo/receipt/") ? (
          <Receipt reference={path.split("/").at(-1)!} navigate={navigate} />
        ) : path.startsWith("/demo/track/") ? (
          <Tracking reference={path.split("/").at(-1)!} navigate={navigate} />
        ) : path.startsWith("/demo/feedback/") ? (
          <Feedback reference={path.split("/").at(-1)!} />
        ) : (
          <section className="citizen-container legal-copy">
            <h1>
              {t(
                path === "/help"
                  ? "common.help"
                  : path === "/privacy"
                    ? "common.privacy"
                    : path === "/about"
                      ? "common.about"
                      : "common.notFound",
              )}
            </h1>
            <p>
              {t(
                path === "/help"
                  ? "legal.guidance"
                  : path === "/privacy"
                    ? "legal.privacy"
                    : "legal.about",
              )}
            </p>
            <p>{t("legal.retention")}</p>
            <a href="/" className="secondary">
              {t("common.back")}
            </a>
          </section>
        )}
      </main>
      <footer className="citizen-footer">
        <span>{t("common.independent")}</span>
        <div>
          <a href="/privacy">{t("common.privacy")}</a>
          <a href="/help">{t("common.help")}</a>
        </div>
      </footer>
    </div>
  );
}
function CitizenHome({ start }: { start: () => void }) {
  const [ack, setAck] = useState(false),
    [how, setHow] = useState(false);
  return (
    <section className="citizen-hero">
      <div className="citizen-hero-copy">
        <span className="pill">
          <span className="tiny-dot" />
          {t("common.independent")}
        </span>
        <p className="eyebrow">{t("citizen.eyebrow")}</p>
        <h1>{t("citizen.headline")}</h1>
        <p className="hero-intro">{t("citizen.intro")}</p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <span>{t("citizen.ack")}</span>
        </label>
        <div className="hero-actions">
          <button className="primary" disabled={!ack} onClick={start}>
            {t("citizen.start")}
            <ArrowRight size={18} />
          </button>
          <button className="text-link" onClick={() => setHow(!how)}>
            {t("citizen.how")}
            <ArrowUpRight size={15} />
          </button>
        </div>
        {how && <div className="how-explanation">{t("citizen.howBody")}</div>}
        <div className="trust-row">
          <span>
            <ShieldCheck size={16} />
            {t("legal.short")}
          </span>
          <span>
            <Eye size={16} />
            {t("citizen.private")}
          </span>
        </div>
      </div>
      <div className="citizen-visual" aria-hidden="true">
        <div className="citizen-orbit orbit-1" />
        <div className="citizen-orbit orbit-2" />
        <div className="citizen-orbit orbit-3" />
        <div className="journey-symbol">
          <Compass size={60} strokeWidth={1.2} />
        </div>
        <div className="visual-caption">
          <span>{t("common.wordmark")}</span>
          <small>{t("common.independent")}</small>
        </div>
        <span className="orbit-point point-a">
          <MapPin size={20} />
        </span>
        <span className="orbit-point point-b">
          <Radio size={20} />
        </span>
        <span className="orbit-point point-c">
          <CheckCheck size={20} />
        </span>
      </div>
    </section>
  );
}
type Draft = {
  category: string;
  landmark: string;
  longitude: number;
  latitude: number;
  description: string;
  client_request_id: string;
};
function loadDraft(): Draft {
  try {
    const old = sessionStorage.getItem("nexus-draft");
    if (old) return JSON.parse(old);
  } catch {}
  return {
    category: "TRAFFIC",
    landmark: landmarks[0].name,
    longitude: landmarks[0].longitude,
    latitude: landmarks[0].latitude,
    description: "",
    client_request_id: crypto.randomUUID(),
  };
}
function CitizenWizard({
  path,
  navigate,
}: {
  path: string;
  navigate: (url: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(loadDraft),
    [error, setError] = useState<any>(),
    [confirmed, setConfirmed] = useState(false),
    [gps, setGps] = useState(""),
    [gpsPreview, setGpsPreview] = useState<{
      latitude: number;
      longitude: number;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const steps = ["category", "location", "details", "review"];
  const current = Math.max(0, steps.indexOf(path.split("/").at(-1)!));
  useEffect(() => {
    sessionStorage.setItem("nexus-draft", JSON.stringify(draft));
  }, [draft]);
  function change(value: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...value }));
  }
  async function submit(e: any) {
    e.preventDefault();
    if (current !== 3) {
      navigate("/demo/new/" + steps[current + 1]);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const report = await api(
        "/demo/incidents",
        { ...draft, simulation: true, location_confidence: "LANDMARK" },
        { key: draft.client_request_id },
      );
      sessionStorage.setItem(
        "receipt:" + report.reference,
        report.receiptToken,
      );
      sessionStorage.removeItem("nexus-draft");
      navigate("/demo/receipt/" + report.reference);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="citizen-container wizard">
      <div className="wizard-progress">
        <button
          className="icon-button"
          aria-label={t("common.back")}
          onClick={() =>
            navigate(current ? "/demo/new/" + steps[current - 1] : "/")
          }
        >
          <ChevronLeft size={20} />
        </button>
        <span>{t("citizen.step", { step: current + 1 })}</span>
        <div>
          {steps.map((s, i) => (
            <span key={s} className={i <= current ? "active" : ""} />
          ))}
        </div>
      </div>
      <p className="eyebrow">{t("legal.short")}</p>
      <h1>{t("citizen." + steps[current] + "Title")}</h1>
      <p className="subtle">{t("citizen." + steps[current] + "Intro")}</p>
      <form onSubmit={submit}>
        {current === 0 && (
          <fieldset className="category-options">
            <legend className="sr-only">{t("common.category")}</legend>
            {categories.map((category, index) => (
              <label
                key={category}
                className={draft.category === category ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="category"
                  value={category}
                  checked={draft.category === category}
                  onChange={() => change({ category })}
                />
                <span className="category-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{t("category." + category)}</strong>
                <ArrowRight size={18} />
              </label>
            ))}
          </fieldset>
        )}
        {current === 1 && (
          <>
            <label>
              {t("common.landmark")}
              <select
                value={
                  landmarks.find((l) => l.name === draft.landmark)?.id || ""
                }
                onChange={(e) => {
                  const l = landmarks.find((x) => x.id === e.target.value);
                  if (l)
                    change({
                      landmark: l.name,
                      longitude: l.longitude,
                      latitude: l.latitude,
                    });
                }}
              >
                <option value="">{t("citizen.manual")}</option>
                {landmarks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("citizen.manual")}
              <input
                value={draft.landmark}
                required
                minLength={2}
                maxLength={120}
                onChange={(e) => change({ landmark: e.target.value })}
              />
            </label>
            <GeoMap
              incidents={[
                {
                  id: "draft",
                  public_reference: "DEMO",
                  longitude: draft.longitude,
                  latitude: draft.latitude,
                },
              ]}
              onPick={(longitude, latitude) => {
                if (
                  longitude >= 4.45 &&
                  longitude <= 4.7 &&
                  latitude >= 7.65 &&
                  latitude <= 7.9
                )
                  change({ longitude, latitude });
              }}
            />
            <p className="fine-print">{t("citizen.gpsNote")}</p>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  setGps("citizen.gpsDenied");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setGpsPreview({
                      latitude:
                        Math.round(position.coords.latitude * 100) / 100,
                      longitude:
                        Math.round(position.coords.longitude * 100) / 100,
                    });
                    setGps("citizen.gpsShown");
                  },
                  () => setGps("citizen.gpsDenied"),
                  { timeout: 6000, enableHighAccuracy: false },
                );
              }}
            >
              <Compass size={16} />
              {t("citizen.gps")}
            </button>
            {gps && <p role="status">{t(gps, gpsPreview || {})}</p>}
          </>
        )}
        {current === 2 && (
          <>
            <label>
              {t("common.description")}
              <textarea
                autoFocus
                value={draft.description}
                required
                minLength={8}
                maxLength={500}
                rows={6}
                onChange={(e) => change({ description: e.target.value })}
              />
            </label>
            <p className="character-count">
              {t("citizen.characters", { count: draft.description.length })}
            </p>
            <p className="privacy-card">
              <ShieldCheck size={20} />
              {t("legal.privacy")}
            </p>
            {/real emergency|dying|help me now|actual emergency/i.test(
              draft.description,
            ) && (
              <div role="alert" className="error-box">
                {t("legal.urgent")}
              </div>
            )}
          </>
        )}
        {current === 3 && (
          <>
            <div className="review-card">
              {[
                [
                  "common.category",
                  t("category." + draft.category),
                  "category",
                ],
                ["common.landmark", draft.landmark, "location"],
                ["common.description", draft.description, "details"],
              ].map(([label, value, step]) => (
                <div key={step}>
                  <div>
                    <span>{t(label)}</span>
                    <p>{value}</p>
                  </div>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => navigate("/demo/new/" + step)}
                  >
                    {t("citizen.edit")}
                  </button>
                </div>
              ))}
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                required
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>{t("citizen.confirm")}</span>
            </label>
          </>
        )}
        <ErrorBox error={error} />
        <button
          className="primary wizard-submit"
          disabled={busy || (current === 3 && !confirmed)}
        >
          {t(current === 3 ? "citizen.submit" : "common.continue")}
          <ArrowRight size={18} />
        </button>
      </form>
    </section>
  );
}
function getReceipt(reference: string) {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get("token");
  if (token) {
    sessionStorage.setItem("receipt:" + reference, token);
    history.replaceState({}, "", location.pathname);
  }
  return sessionStorage.getItem("receipt:" + reference) || "";
}
function Receipt({
  reference,
  navigate,
}: {
  reference: string;
  navigate: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const token = getReceipt(reference);
  const data = useQuery({
    queryKey: ["receipt", reference],
    queryFn: () =>
      api("/demo/incidents/" + reference + "/status", undefined, { token }),
  });
  return (
    <section className="citizen-container receipt-page">
      <span className="receipt-check">
        <CheckCheck size={35} />
      </span>
      <p className="eyebrow">{t("common.serverConfirmed")}</p>
      <h1>{data.data ? t("citizen.received") : t("citizen.receipt")}</h1>
      <p>{t("citizen.receiptIntro")}</p>
      <ErrorBox error={data.error} />
      <div className="receipt-code">
        <span>{t("citizen.receipt")}</span>
        <strong>{reference}</strong>
      </div>
      <button
        className="primary"
        disabled={!data.data}
        onClick={() => navigate("/demo/track/" + reference)}
      >
        {t("citizen.track")}
        <ArrowRight size={18} />
      </button>
      <button
        className="secondary"
        onClick={async () => {
          await navigator.clipboard.writeText(
            location.origin + "/demo/track/" + reference + "#token=" + token,
          );
          setCopied(true);
        }}
      >
        <Clipboard size={16} />
        {t(copied ? "common.copied" : "common.copy")}
      </button>
      <p className="fine-print">{t("citizen.private")}</p>
    </section>
  );
}
function Tracking({
  reference,
  navigate,
}: {
  reference: string;
  navigate: (url: string) => void;
}) {
  const token = getReceipt(reference);
  const data = useQuery({
    queryKey: ["tracking", reference],
    queryFn: () =>
      api("/demo/incidents/" + reference + "/status", undefined, { token }),
    refetchInterval: 4000,
  });
  const { connected } = useLive({ reference, receiptToken: token });
  return (
    <section className="citizen-container tracking">
      <div className="tracking-header">
        <span className="reference">{reference}</span>
        <Connectivity online={connected} />
      </div>
      <h1>{t("citizen.tracking")}</h1>
      <p className="subtle">{t("citizen.trackingIntro")}</p>
      {data.error ? (
        <>
          <p>{t("citizen.invalid")}</p>
          <ErrorBox error={data.error} retry={() => data.refetch()} />
        </>
      ) : data.data ? (
        <>
          <div className="tracking-state">
            <Status value={data.data.status} />
            <p>
              {t("citizen.last")}
              <time>{date(data.data.updated_at)}</time>
            </p>
          </div>
          <EventTimeline events={data.data.timeline} />
          {data.data.status === "CLOSED" && (
            <button
              className="primary"
              onClick={() => navigate("/demo/feedback/" + reference)}
            >
              {t("citizen.feedback")}
            </button>
          )}
        </>
      ) : (
        <Loading />
      )}
      <p className="privacy-card">
        <ShieldCheck size={20} />
        {t("citizen.private")}
      </p>
    </section>
  );
}
function Feedback({ reference }: { reference: string }) {
  const token = getReceipt(reference);
  const data = useQuery({
    queryKey: ["feedback-state", reference],
    queryFn: () =>
      api("/demo/incidents/" + reference + "/status", undefined, { token }),
  });
  const [error, setError] = useState<any>(),
    [saved, setSaved] = useState(false);
  return (
    <section className="citizen-container">
      <h1>{t("citizen.feedback")}</h1>
      <p>{t("legal.privacy")}</p>
      {saved ? (
        <p role="status">{t("citizen.feedbackSaved")}</p>
      ) : data.data?.status === "CLOSED" ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const body = new FormData(e.currentTarget);
            try {
              await api(
                "/demo/incidents/" + reference + "/feedback",
                {
                  response_clarity_score: Number(body.get("score")),
                  free_text: body.get("text"),
                },
                { token, key: "feedback-" + reference },
              );
              setSaved(true);
            } catch (e) {
              setError(e);
            }
          }}
        >
          <label>
            {t("citizen.clarity")}
            <select name="score">
              {[1, 2, 3, 4, 5].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            {t("citizen.feedbackText")}
            <textarea name="text" maxLength={500} />
          </label>
          <ErrorBox error={error} />
          <button className="primary">{t("common.submit")}</button>
        </form>
      ) : (
        <ErrorBox error={data.error || { code: "FEEDBACK_REQUIRES_CLOSURE" }} />
      )}
    </section>
  );
}
