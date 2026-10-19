"use client";
import { useState, useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  ChevronRight,
  Clock,
  Command,
  FileClock,
  Filter,
  LayoutDashboard,
  ListFilter,
  LogOut,
  MapPin,
  Menu,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { LocaleProvider, t, date, number } from "../../i18n/src/index";
import { client, useApi, api, invalidate, useLive } from "./api";
import {
  Brand,
  Warning,
  Status,
  ErrorBox,
  Loading,
  Empty,
  Connectivity,
  PageHeading,
  ActionDialog,
  EventTimeline,
} from "./atoms";
import { GeoMap } from "./map";
import { categories } from "../../contracts/src/index";
const links = [
  ["/cad", "nav.cad", LayoutDashboard],
  ["/cad/live", "nav.live", Command],
  ["/cad/history", "nav.history", FileClock],
  ["/cad/units", "nav.units", Truck],
  ["/cad/network", "nav.network", Radio],
  ["/assurance", "nav.assurance", ShieldCheck],
  ["/assurance/incidents", "nav.replay", Activity],
  ["/assurance/audit", "nav.audit", CheckCheck],
  ["/assurance/reports", "nav.reports", FileClock],
  ["/assurance/reviews", "nav.reviews", Users],
  ["/simulator", "nav.simulator", SlidersHorizontal],
  ["/settings", "nav.settings", Settings],
] as const;
export function OperationsApp() {
  return (
    <LocaleProvider>
      <QueryClientProvider client={client}>
        <Operations />
      </QueryClientProvider>
    </LocaleProvider>
  );
}
function Operations() {
  const [path, setPath] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => setPath(window.location.pathname), []);
  const me = useApi("/auth/me");
  if (!path) return <Loading />;
  if (path === "/help" || path === "/privacy" || path === "/about")
    return (
      <div className="dark legal-page">
        <Warning />
        <Brand />
        <h1>{t("common." + path.slice(1))}</h1>
        <p>{t("legal." + (path === "/help" ? "guidance" : path.slice(1)))}</p>
        <a href="/cad">{t("nav.cad")}</a>
      </div>
    );
  if (path === "/login" || (me.error && !me.data)) return <Login />;
  if (!me.data)
    return (
      <div className="dark">
        <Loading />
      </div>
    );
  const user = me.data;
  const allowed =
    user.role === "dispatcher"
      ? links.filter((l) => l[0].startsWith("/cad"))
      : user.role === "supervisor"
        ? links.filter((l) => l[0].startsWith("/assurance"))
        : user.role === "admin"
          ? links.filter(
              (l) => l[0].startsWith("/simulator") || l[0] === "/settings",
            )
          : [];
  if (user.role === "responder")
    return (
      <div className="dark legal-page">
        <Warning />
        <Brand />
        <p>{t("common.noPermission")}</p>
        <a href="http://localhost:5174/responder">{t("nav.responder")}</a>
      </div>
    );
  const first =
    user.role === "supervisor"
      ? "/assurance"
      : user.role === "admin"
        ? "/simulator"
        : "/cad";
  const actual = path === "/" ? first : path;
  return (
    <div className="dark app-shell">
      <a className="skip-link" href="#main">
        {t("accessibility.skip")}
      </a>
      <Warning />
      <aside className={"sidebar " + (menu ? "show" : "")}>
        <Brand />
        <div className="workspace-switch">
          <span className="workspace-glyph">O</span>
          <div>
            <strong>Osogbo</strong>
            <small>{t("common.independent")}</small>
          </div>
          <ChevronRight size={16} />
        </div>
        <p className="nav-section">
          {t(
            user.role === "supervisor"
              ? "nav.oversight"
              : user.role === "admin"
                ? "nav.simulation"
                : "nav.workspace",
          )}
        </p>
        <nav aria-label={t("accessibility.navigation")}>
          {allowed.map(([href, label, Icon]) => (
            <a
              key={href}
              className={actual === href ? "active" : ""}
              href={href}
            >
              <Icon size={18} />
              <span>{t(label)}</span>
              {actual === href && <i />}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <a href="http://localhost:5173">
            <ArrowUpRight size={16} />
            {t("nav.citizen")}
          </a>
          <a href="http://localhost:5174/responder">
            <ArrowUpRight size={16} />
            {t("nav.responder")}
          </a>
          <div className="research-note">
            <ShieldCheck size={20} />
            <p>
              {t("common.independent")}
              <small>{t("legal.short")}</small>
            </p>
          </div>
          <button
            className="profile-button"
            onClick={async () => {
              await api("/auth/logout", {});
              client.clear();
              location.href = "/login";
            }}
          >
            <span className="avatar">{user.demo_name.slice(0, 1)}</span>
            <span>
              <strong>{user.demo_name}</strong>
              <small>{t("auth." + user.role)}</small>
            </span>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="command-header">
          <button
            className="icon-button mobile-menu"
            aria-label={t("accessibility.menu")}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            <span>{t("common.wordmark")}</span>
            <ChevronRight size={13} />
            <strong>
              {t(links.find((l) => l[0] === actual)?.[1] || "cad.detailsTitle")}
            </strong>
          </div>
          <div className="header-right">
            <span className="environment-dot" />
            {t("legal.short")}
            <span className="header-divider" />
            <Clock size={14} />
            <ClockDisplay />
            <span className="avatar small">{user.demo_name.slice(0, 1)}</span>
          </div>
        </header>
        <main
          id="main"
          className={actual === "/cad/live" ? "main live-main" : "main"}
        >
          <OperationalContent path={actual} user={user} />
        </main>
        <footer className="app-footer">
          <span>{t("common.independent")}</span>
          <a href="/help">
            {t("common.help")}
            <ArrowUpRight size={12} />
          </a>
        </footer>
      </div>
    </div>
  );
}
function ClockDisplay() {
  const [now, setNow] = useState("");
  useEffect(() => {
    setNow(date(new Date()));
    const id = setInterval(() => setNow(date(new Date())), 1000);
    return () => clearInterval(id);
  }, []);
  return <time>{now}</time>;
}
export function Login({ responder = false }: { responder?: boolean }) {
  const [error, setError] = useState<any>(),
    [busy, setBusy] = useState(false);
  return (
    <div className="dark login-page">
      <Warning />
      <div className="login-main">
        <section className="login-story">
          <Brand />
          <div>
            <p className="eyebrow">{t("cad.eyebrow")}</p>
            <h1>{t("auth.title")}</h1>
            <p>{t("auth.subtitle")}</p>
            <div className="login-network">
              <div className="network-ring" />
              <div className="network-ring inner" />
              <span className="network-node one" />
              <span className="network-node two" />
              <span className="network-node three" />
              <Command size={48} />
            </div>
          </div>
          <small>{t("common.independent")}</small>
        </section>
        <section className="login-form">
          <div className="login-form-inner">
            <span className="icon-tile">
              <ShieldCheck />
            </span>
            <p className="eyebrow">{t("auth.session")}</p>
            <h2>{t("common.welcome")}</h2>
            <p className="subtle">{t("auth.hint")}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setBusy(true);
                setError(null);
                try {
                  const user = await api("/auth/login", {
                    username: data.get("username"),
                    password: data.get("password"),
                  });
                  location.href = responder
                    ? "/responder"
                    : user.role === "admin"
                      ? "/simulator"
                      : user.role === "supervisor"
                        ? "/assurance"
                        : "/cad";
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                {t("auth.username")}
                <input
                  name="username"
                  autoComplete="username"
                  defaultValue={responder ? "responder" : "dispatcher"}
                  required
                />
              </label>
              <label>
                {t("auth.password")}
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <ErrorBox error={error} />
              <button className="primary" disabled={busy}>
                {t("auth.signIn")}
                <ArrowRight size={17} />
              </button>
            </form>
            <div className="login-hint">
              <span>{t("auth.demo")}</span>
              <div>
                {["dispatcher", "responder", "supervisor", "admin"].map(
                  (role) => (
                    <code key={role}>{role}</code>
                  ),
                )}
              </div>
            </div>
            <p className="fine-print">{t("legal.about")}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
function OperationalContent({ path, user }: { path: string; user: any }) {
  if (path === "/cad") return <Overview />;
  if (path === "/cad/live") return <LiveWorkspace />;
  if (path === "/cad/units") return <Units />;
  if (path === "/cad/history" || path === "/cad/incidents") return <History />;
  if (path === "/cad/network") return <Network />;
  if (path.startsWith("/cad/incidents/") || path.startsWith("/cad/dispatch/"))
    return <IncidentWorkspace id={path.split("/").at(-1)!} user={user} />;
  if (path === "/assurance") return <Assurance />;
  if (path === "/assurance/incidents") return <History assurance />;
  if (path.includes("/replay")) return <Replay id={path.split("/")[3]} />;
  if (path === "/assurance/audit") return <Audit />;
  if (path === "/assurance/reports") return <Reports />;
  if (path === "/assurance/reviews") return <Reviews />;
  if (path === "/simulator" || path.startsWith("/simulator/scenarios"))
    return <Simulator slug={path.split("/")[3]} />;
  if (path === "/settings") return <SimulationSettings />;
  return <Empty text="common.notFound" />;
}
function Stat({
  label,
  value,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: any;
  icon: any;
  accent?: boolean;
}) {
  return (
    <div className={"stat-card " + (accent ? "accent" : "")}>
      <div>
        <span>{t(label)}</span>
        <Icon size={17} />
      </div>
      <strong>{typeof value === "number" ? number(value) : value}</strong>
      <small>
        <span className="tiny-dot" />
        {t("common.serverConfirmed")}
      </small>
    </div>
  );
}
function Overview() {
  const overview = useApi("/cad/overview"),
    incidents = useApi("/cad/incidents?limit=6"),
    units = useApi("/cad/units");
  const activity = useApi("/cad/activity");
  const { connected } = useLive();
  if (!overview.data)
    return overview.error ? <ErrorBox error={overview.error} /> : <Loading />;
  const count = (...states: string[]) =>
    overview.data.counts
      .filter((r: any) => states.includes(r.status))
      .reduce((n: number, r: any) => n + r.count, 0);
  return (
    <>
      <PageHeading title="cad.title" subtitle="cad.subtitle">
        <a href="/cad/live" className="primary">
          {t("cad.liveTitle")}
          <ArrowUpRight size={16} />
        </a>
      </PageHeading>
      <div className="stats-grid">
        <Stat
          label="cad.active"
          value={count(
            "RECEIVED",
            "TRIAGED",
            "WAITING_FOR_UNIT",
            "OFFERED",
            "ACCEPTED",
            "EN_ROUTE_REPORTED",
            "ARRIVAL_REPORTED",
          )}
          icon={Activity}
          accent
        />
        <Stat
          label="cad.needsTriage"
          value={count("RECEIVED")}
          icon={ListFilter}
        />
        <Stat label="cad.awaitingAck" value={count("OFFERED")} icon={Clock} />
        <Stat
          label="cad.closed"
          value={overview.data.metrics.closed_24h}
          icon={CheckCheck}
        />
      </div>
      <div className="overview-grid">
        <section className="panel overview-map">
          <div className="panel-heading">
            <h2>{t("cad.liveTitle")}</h2>
            <Connectivity online={connected} />
          </div>
          <GeoMap
            incidents={incidents.data?.items || []}
            units={units.data?.items || []}
            onSelect={(id) => (location.href = "/cad/incidents/" + id)}
          />
        </section>
        <section className="panel readiness">
          <div className="panel-heading">
            <h2>{t("cad.units")}</h2>
            <a href="/cad/units">
              <ArrowUpRight size={17} />
              <span className="sr-only">{t("nav.units")}</span>
            </a>
          </div>
          {units.data?.items.map((u: any) => (
            <div className="readiness-row" key={u.id}>
              <span className="unit-icon">
                <Truck size={18} />
              </span>
              <div>
                <strong>{u.callsign}</strong>
                <small>
                  {u.capability_tags
                    .map((c: string) => t("category." + c))
                    .join(" · ")}
                </small>
              </div>
              <div>
                <Status value={u.dispatch_status} />
                <small className={u.fresh ? "" : "amber"}>
                  {t(u.fresh ? "cad.fresh" : "cad.stale")}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("cad.recent")}</h2>
          <a className="text-link" href="/cad/history">
            {t("common.view")}
            <ArrowRight size={14} />
          </a>
        </div>
        <IncidentTable items={incidents.data?.items || []} />
      </section>
      <section className="panel info-panel">
        <h2>{t("cad.confirmed")}</h2>
        <EventTimeline events={activity.data?.items || []} />
      </section>
    </>
  );
}
function Filters({
  query,
  setQuery,
  status,
  setStatus,
  category,
  setCategory,
  priority,
  setPriority,
}: {
  query: string;
  setQuery: (s: string) => void;
  status: string;
  setStatus: (s: string) => void;
  category: string;
  setCategory: (s: string) => void;
  priority?: string;
  setPriority?: (s: string) => void;
}) {
  return (
    <div className="filters" role="search">
      <label className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("common.search")}
          aria-label={t("accessibility.search")}
        />
      </label>
      <select
        aria-label={t("common.status")}
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">
          {t("common.status")}: {t("common.all")}
        </option>
        {[
          "RECEIVED",
          "TRIAGED",
          "WAITING_FOR_UNIT",
          "OFFERED",
          "ACCEPTED",
          "EN_ROUTE_REPORTED",
          "ARRIVAL_REPORTED",
          "RESOLVED",
          "CLOSED",
          "CANCELLED",
        ].map((s) => (
          <option key={s} value={s}>
            {t("status." + s)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("common.category")}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="">
          {t("common.category")}: {t("common.all")}
        </option>
        {categories.map((s) => (
          <option key={s} value={s}>
            {t("category." + s)}
          </option>
        ))}
      </select>
      {setPriority && (
        <select
          aria-label={t("common.priority")}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">
            {t("common.priority")}: {t("common.all")}
          </option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
            <option key={s} value={s}>
              {t("priority." + s)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
function IncidentTable({
  items,
  assurance = false,
}: {
  items: any[];
  assurance?: boolean;
}) {
  if (!items.length) return <Empty text="cad.emptyQueue" />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {[
              "common.reference",
              "common.category",
              "common.landmark",
              "common.status",
              "common.created",
              "common.details",
            ].map((k) => (
              <th key={k}>{t(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <a
                  className="reference"
                  href={
                    assurance
                      ? `/assurance/incidents/${i.id}/replay`
                      : `/cad/incidents/${i.id}`
                  }
                >
                  {i.public_reference}
                </a>
                <small>{t("priority." + i.priority)}</small>
              </td>
              <td>{t("category." + i.category)}</td>
              <td>{i.landmark}</td>
              <td>
                <Status value={i.status} />
              </td>
              <td className="mono">{date(i.created_at)}</td>
              <td>
                <a
                  className="icon-button"
                  aria-label={t("accessibility.incident", {
                    reference: i.public_reference,
                  })}
                  href={
                    assurance
                      ? `/assurance/incidents/${i.id}/replay`
                      : `/cad/incidents/${i.id}`
                  }
                >
                  <ArrowUpRight size={17} />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function History({ assurance = false }: { assurance?: boolean }) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [priority, setPriority] = useState(""),
    [page, setPage] = useState(0),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const params = new URLSearchParams({
    q,
    status,
    category,
    priority,
    limit: "25",
    offset: String(page * 25),
    ...(from ? { from } : {}),
    ...(to ? { to: to + "T23:59:59Z" } : {}),
  });
  const data = useApi(
    (assurance ? "/assurance/incidents" : "/cad/incidents") + "?" + params,
  );
  return (
    <>
      <PageHeading
        title={assurance ? "nav.replay" : "cad.history"}
        subtitle={assurance ? "assurance.subtitle" : "cad.subtitle"}
      />
      <section className="panel">
        <Filters
          query={q}
          setQuery={(v) => {
            setQ(v);
            setPage(0);
          }}
          status={status}
          setStatus={setStatus}
          category={category}
          setCategory={setCategory}
          priority={priority}
          setPriority={setPriority}
        />
        <div className="date-filter">
          <label>
            {t("common.from")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("common.to")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <ErrorBox error={data.error} />
        {data.data ? (
          <IncidentTable items={data.data.items} assurance={assurance} />
        ) : (
          <Loading />
        )}
        <div className="pagination">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            {t("common.previous")}
          </button>
          <span>
            {t("common.pagination", { page: page + 1 })} ·{" "}
            {t("common.count", { count: data.data?.total || 0 })}
          </span>
          <button
            disabled={(page + 1) * 25 >= (data.data?.total || 0)}
            onClick={() => setPage(page + 1)}
          >
            {t("common.next")}
          </button>
        </div>
      </section>
    </>
  );
}
function LiveWorkspace() {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [priority, setPriority] = useState(""),
    [from, setFrom] = useState(""),
    [selected, setSelected] = useState<string>(),
    [panel, setPanel] = useState(380);
  const incidents = useApi(
      "/cad/incidents?" +
        new URLSearchParams({
          q,
          status,
          category,
          priority,
          ...(from ? { from } : {}),
          limit: "100",
        }),
    ),
    units = useApi("/cad/units"),
    network = useApi("/cad/network");
  const { connected } = useLive();
  return (
    <>
      <div className="live-toolbar">
        <div>
          <h1>{t("cad.liveTitle")}</h1>
          <span>{t("cad.liveSubtitle")}</span>
        </div>
        <Connectivity online={connected} />
        <a className="secondary" href="/cad/history">
          <Filter size={15} />
          {t("nav.history")}
        </a>
      </div>
      <div
        className="live-workspace"
        style={{ "--detail-width": `${panel}px` } as any}
      >
        <section className="incident-queue">
          <div className="queue-heading">
            <h2>{t("cad.queue")}</h2>
            <span>{incidents.data?.total || 0}</span>
          </div>
          <Filters
            query={q}
            setQuery={setQ}
            status={status}
            setStatus={setStatus}
            category={category}
            setCategory={setCategory}
            priority={priority}
            setPriority={setPriority}
          />
          <div className="queue-date">
            <label>
              {t("common.from")}
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
          </div>
          <ErrorBox error={incidents.error} />
          <div className="queue-list">
            {incidents.data?.items.map((i: any) => (
              <button
                key={i.id}
                className={
                  "incident-card " + (selected === i.id ? "selected" : "")
                }
                onClick={() => setSelected(i.id)}
              >
                <div>
                  <span className="reference">{i.public_reference}</span>
                  <span
                    className={"priority priority-" + i.priority.toLowerCase()}
                  >
                    {t("priority." + i.priority)}
                  </span>
                </div>
                <h3>{t("category." + i.category)}</h3>
                <p>
                  <MapPin size={13} />
                  {i.landmark}
                </p>
                <div>
                  <Status value={i.status} />
                  <time>{date(i.created_at)}</time>
                </div>
              </button>
            ))}
            {incidents.data?.items.length === 0 && (
              <Empty text="cad.emptyQueue" />
            )}
          </div>
        </section>
        <GeoMap
          incidents={incidents.data?.items || []}
          units={units.data?.items || []}
          selected={selected}
          onSelect={setSelected}
          unavailable={network.data?.settings?.map_unavailable}
        />
        <section className="incident-detail">
          <label className="panel-resizer">
            <span className="sr-only">{t("cad.resize")}</span>
            <input
              aria-label={t("cad.resize")}
              type="range"
              min="320"
              max="430"
              value={panel}
              onChange={(e) => setPanel(Number(e.target.value))}
            />
          </label>
          {selected ? (
            <IncidentDetails id={selected} compact />
          ) : (
            <div className="select-incident">
              <span className="icon-tile">
                <MapPin size={25} />
              </span>
              <h2>{t("cad.detailsTitle")}</h2>
              <p>{t("cad.select")}</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function IncidentWorkspace({ id, user }: { id: string; user: any }) {
  return (
    <>
      <PageHeading title="cad.detailsTitle" subtitle="cad.timing">
        <a className="secondary" href="/cad/live">
          {t("nav.live")}
          <ArrowUpRight size={16} />
        </a>
      </PageHeading>
      <section className="panel incident-full">
        <IncidentDetails id={id} supervisor={user.role === "supervisor"} />
      </section>
    </>
  );
}
function IncidentDetails({
  id,
  compact = false,
  supervisor = false,
}: {
  id: string;
  compact?: boolean;
  supervisor?: boolean;
}) {
  const data = useApi("/cad/incidents/" + id),
    events = useApi("/cad/incidents/" + id + "/events"),
    candidateData = useApi(
      !supervisor ? "/cad/incidents/" + id + "/candidates" : null,
    );
  const duplicates = useApi("/cad/incidents/" + id + "/duplicates");
  const [tab, setTab] = useState("overview"),
    [priority, setPriority] = useState("MEDIUM"),
    [needsInformation, setNeedsInformation] = useState(false),
    [related, setRelated] = useState(""),
    [correction, setCorrection] = useState(""),
    [routeUnit, setRouteUnit] = useState("");
  const i = data.data;
  async function act(action: string, reason: string, extra: any = {}) {
    const result = await api("/cad/incidents/" + id + "/" + action, {
      expected_version: i.version,
      reason,
      ...extra,
    });
    invalidate();
    return result;
  }
  if (!i)
    return (
      <>
        <ErrorBox error={data.error} />
        {!data.error && <Loading />}
      </>
    );
  const current = i.assignments.find((a: any) =>
    ["OFFERED", "ACCEPTED", "ACTIVE"].includes(a.status),
  );
  return (
    <div className={compact ? "incident-content compact" : "incident-content"}>
      <div className="incident-top">
        <div>
          <span className="reference">{i.public_reference}</span>
          <h2>{t("category." + i.category)}</h2>
        </div>
        <span className={"priority priority-" + i.priority.toLowerCase()}>
          {t("priority." + i.priority)}
        </span>
      </div>
      <Status value={i.status} />
      {i.reason_flags?.map((flag: string) => (
        <p key={flag} className="amber fine-print">
          {t("flags." + flag)}
        </p>
      ))}
      <p className="incident-description">{i.description_sanitised}</p>
      <div className="location-card">
        <MapPin size={18} />
        <div>
          <strong>{i.landmark}</strong>
          <small>
            {t("cad.location")}: {i.location_confidence} · ±
            {i.location_accuracy_m} m
          </small>
        </div>
      </div>
      <dl className="incident-metadata">
        <div>
          <dt>{t("common.created")}</dt>
          <dd>{date(i.created_at)}</dd>
        </div>
        <div>
          <dt>{t("cad.version")}</dt>
          <dd className="mono">{i.version}</dd>
        </div>
      </dl>
      <div className="tab-bar">
        {[
          "overview",
          "assignments",
          "timeline",
          "communications",
          "corrections",
        ].map((key) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {t("cad." + key)}
          </button>
        ))}
      </div>
      {tab === "overview" && (
        <>
          <div className="action-stack">
            {i.status === "RECEIVED" && !supervisor && (
              <ActionDialog
                label="cad.triage"
                onConfirm={(reason) =>
                  act("triage", reason, {
                    priority,
                    reason_flags: needsInformation ? ["NEEDS_INFORMATION"] : [],
                  })
                }
              >
                <label>
                  {t("common.priority")}
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => (
                      <option key={p} value={p}>
                        {t("priority." + p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={needsInformation}
                    onChange={(e) => setNeedsInformation(e.target.checked)}
                  />
                  <span>{t("cad.needsInformation")}</span>
                </label>
              </ActionDialog>
            )}
            {i.status === "TRIAGED" && !supervisor && (
              <ActionDialog
                label="cad.ready"
                onConfirm={(reason) => act("ready", reason)}
              />
            )}
            <h3>{t("cad.candidates")}</h3>
            <p className="fine-print">{t("cad.etaInfo")}</p>
            {candidateData.data?.items.find((u: any) => u.id === routeUnit)
              ?.route_geometry && (
              <GeoMap
                incidents={[i]}
                units={candidateData.data.items.filter(
                  (u: any) => u.id === routeUnit,
                )}
                route={
                  candidateData.data.items.find((u: any) => u.id === routeUnit)
                    .route_geometry
                }
              />
            )}
            {candidateData.data?.items.map((u: any) => (
              <div
                className={"candidate-card " + (u.eligible ? "eligible" : "")}
                key={u.id}
              >
                <div>
                  <strong>
                    <Truck size={15} />
                    {u.callsign}
                  </strong>
                  <span className="mono">{number(u.distance_m / 1000)} km</span>
                </div>
                <p>
                  {u.eligible
                    ? t("cad.available")
                    : u.excluded_reasons
                        .map((r: string) => t("status." + r))
                        .join(" · ")}
                </p>
                <small>
                  {u.eta_seconds != null
                    ? t("cad.roadEstimate", {
                        minutes: number(Math.ceil(u.eta_seconds / 60)),
                        distance: number(u.route_distance_m / 1000),
                      })
                    : t("cad.eta")}{" "}
                  · {date(u.estimate_at || u.recorded_at)}
                </small>
                {u.route_geometry && (
                  <button
                    className="text-link"
                    onClick={() => setRouteUnit(u.id)}
                  >
                    {t("cad.showRoute")}
                  </button>
                )}
                {u.eta_seconds != null && (
                  <small>
                    {t("cad.routeSource", { version: u.routing_data_version })}
                  </small>
                )}
                {u.eligible && i.status === "WAITING_FOR_UNIT" && (
                  <ActionDialog
                    label="cad.offer"
                    onConfirm={(reason) =>
                      act("assignments", reason, { unit_id: u.id })
                    }
                  />
                )}
              </div>
            ))}
            {candidateData.data &&
              !candidateData.data.items.some((u: any) => u.eligible) && (
                <p className="amber">{t("cad.noEligible")}</p>
              )}
            {i.status === "OFFERED" && current && !supervisor && (
              <ActionDialog
                label="cad.withdraw"
                onConfirm={async (reason) => {
                  const r = await api(
                    "/cad/assignments/" + current.id + "/withdraw",
                    { expected_version: i.version, reason },
                  );
                  invalidate();
                  return r;
                }}
              />
            )}
            {["ACCEPTED", "EN_ROUTE_REPORTED", "ARRIVAL_REPORTED"].includes(
              i.status,
            ) &&
              !supervisor && (
                <ActionDialog
                  label="cad.reassign"
                  onConfirm={(reason) => act("reassign", reason)}
                />
              )}
            {i.status === "ARRIVAL_REPORTED" && (
              <ActionDialog
                label="cad.resolve"
                onConfirm={(reason) => act("resolve", reason)}
              />
            )}
            {i.status === "RESOLVED" && (
              <ActionDialog
                label="cad.close"
                onConfirm={(reason) => act("close", reason)}
              />
            )}
            {["RECEIVED", "TRIAGED", "WAITING_FOR_UNIT", "OFFERED"].includes(
              i.status,
            ) && (
              <ActionDialog
                label="cad.cancel"
                danger
                onConfirm={(reason) => act("cancel", reason)}
              />
            )}
          </div>
        </>
      )}
      {tab === "assignments" && (
        <div>
          <h3>{t("cad.assignmentHistory")}</h3>
          {i.assignments.map((a: any) => (
            <div className="lineage-card" key={a.id}>
              <strong>{a.callsign}</strong>
              <Status value={a.status} />
              <p>
                {t("cad.offerExpiry")}: {date(a.expires_at)}
              </p>
              <small>{date(a.offered_at)}</small>
              {a.decline_reason && <p>{a.decline_reason}</p>}
            </div>
          ))}
          {!i.assignments.length && <Empty />}
        </div>
      )}
      {tab === "timeline" && (
        <EventTimeline events={events.data?.items || []} />
      )}
      {tab === "communications" && (
        <>
          <ActionDialog
            label="cad.note"
            onConfirm={(reason) => act("note", reason)}
          />
          <ActionDialog
            label="cad.link"
            onConfirm={(reason) => act("link", reason, { related_id: related })}
          >
            <label>
              {t("common.reference")}
              <input
                value={related}
                onChange={(e) => setRelated(e.target.value)}
                required
                placeholder="UUID"
              />
            </label>
          </ActionDialog>
          <p className="fine-print">{t("cad.related")}</p>
          {duplicates.data?.items.map((d: any) => (
            <button
              key={d.id}
              className="text-link"
              onClick={() => setRelated(d.id)}
            >
              {d.public_reference} · {t("cad.duplicateSuggestion")}
            </button>
          ))}
          {i.notes.length ? (
            i.notes.map((n: any) => (
              <article className="note" key={n.id}>
                <p>{n.sanitized_text}</p>
                <small>
                  {n.role} · {date(n.created_at)}
                </small>
              </article>
            ))
          ) : (
            <Empty text="cad.notesEmpty" />
          )}
          {i.links.map((l: any) => (
            <p key={l.id} className="mono">
              {l.a_id} ↔ {l.b_id}
            </p>
          ))}
        </>
      )}
      {tab === "corrections" && (
        <>
          <p className="fine-print">{t("legal.integrity")}</p>
          {supervisor ? (
            <ActionDialog
              label="cad.correction"
              onConfirm={async (reason) => {
                await api("/assurance/incidents/" + id + "/corrections", {
                  expected_version: i.version,
                  reason,
                  correction_of: correction,
                });
                invalidate();
              }}
            >
              <label>
                {t("assurance.event")}
                <select
                  required
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                >
                  <option value="">{t("common.all")}</option>
                  {events.data?.items.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.sequence} · {e.event_type}
                    </option>
                  ))}
                </select>
              </label>
            </ActionDialog>
          ) : (
            <p>{t("auth.supervisor")}</p>
          )}
          <EventTimeline
            events={(events.data?.items || []).filter(
              (e: any) => e.event_type === "incident.correction",
            )}
          />
        </>
      )}
    </div>
  );
}
function Units() {
  const data = useApi("/cad/units"),
    [q, setQ] = useState(""),
    [state, setState] = useState(""),
    [sort, setSort] = useState("callsign");
  const items = (data.data?.items || [])
    .filter(
      (u: any) =>
        u.callsign.toLowerCase().includes(q.toLowerCase()) &&
        (!state || u.dispatch_status === state),
    )
    .sort((a: any, b: any) => String(a[sort]).localeCompare(String(b[sort])));
  return (
    <>
      <PageHeading title="nav.units" subtitle="cad.timing" />
      <section className="panel">
        <div className="filters">
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label={t("common.search")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("common.search")}
            />
          </label>
          <select
            aria-label={t("common.status")}
            value={state}
            onChange={(e) => setState(e.target.value)}
          >
            <option value="">{t("common.all")}</option>
            {["AVAILABLE", "BUSY", "OFFLINE"].map((s) => (
              <option key={s} value={s}>
                {t("status." + s)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("cad.unit")}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="callsign">{t("cad.unit")}</option>
            <option value="dispatch_status">{t("common.status")}</option>
          </select>
        </div>
        <GeoMap units={items} />
        <ErrorBox error={data.error} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "cad.unit",
                  "cad.capability",
                  "common.status",
                  "cad.position",
                  "common.timestamp",
                ].map((k) => (
                  <th key={k}>{t(k)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.callsign}</strong>
                  </td>
                  <td>
                    {u.capability_tags
                      .map((c: string) => t("category." + c))
                      .join(" · ")}
                  </td>
                  <td>
                    <Status value={u.dispatch_status} />
                  </td>
                  <td>
                    <span className={u.fresh ? "teal" : "amber"}>
                      {t(u.fresh ? "cad.fresh" : "cad.stale")}
                    </span>
                    <small className="mono">
                      {number(u.latitude)}, {number(u.longitude)}
                    </small>
                  </td>
                  <td>{date(u.recorded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Network() {
  const data = useApi("/cad/network");
  const { connected, cursor } = useLive();
  return (
    <>
      <PageHeading title="cad.connection" subtitle="cad.reconcile" />
      <ErrorBox error={data.error} />
      <div className="stats-grid">
        <Stat
          label="cad.socket"
          value={t(connected ? "common.online" : "common.offline")}
          icon={Wifi}
        />
        <Stat
          label="cad.pendingOutbox"
          value={data.data?.outbox.pending ?? "—"}
          icon={Activity}
        />
        <Stat label="cad.cursor" value={cursor} icon={FileClock} />
      </div>
      <section className="panel info-panel">
        <h2>{t("cad.lastDelivery")}</h2>
        <p className="mono">{date(data.data?.outbox.last_delivery)}</p>
        <p>{t("cad.reconcile")}</p>
      </section>
    </>
  );
}
function Assurance() {
  const data = useApi("/assurance/metrics");
  const fields = [
    ["triaged_at", "assurance.triage"],
    ["offered_at", "assurance.offer"],
    ["accepted_at", "assurance.ack"],
    ["arrived_at", "assurance.arrival"],
  ];
  return (
    <>
      <PageHeading title="assurance.title" subtitle="assurance.subtitle" />
      <div className="stats-grid">
        {fields.map(([field, label]) => {
          const measurements =
            data.data?.items
              .filter(
                (i: any) =>
                  i[field] && (field !== "accepted_at" || i.offered_at),
              )
              .map(
                (i: any) =>
                  (new Date(i[field]).getTime() -
                    new Date(
                      field === "accepted_at" ? i.offered_at : i.created_at,
                    ).getTime()) /
                  1000,
              ) || [];
          return (
            <Stat
              key={field}
              label={label}
              value={
                measurements.length
                  ? number(
                      measurements.reduce((a: number, b: number) => a + b, 0) /
                        measurements.length,
                    ) + " s"
                  : t("common.unknown")
              }
              icon={Clock}
            />
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <h2>{t("assurance.coverage")}</h2>
          <span>
            {t("common.count", { count: data.data?.sampleSize || 0 })}
          </span>
        </div>
        <p className="panel-copy">{t("assurance.missing")}</p>
        <ErrorBox error={data.error} />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("common.reference")}</th>
                {fields.map(([key, label]) => (
                  <th key={key}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data?.items.map((i: any) => (
                <tr key={i.id}>
                  <td>
                    <a
                      className="reference"
                      href={"/assurance/incidents/" + i.id + "/replay"}
                    >
                      {i.public_reference}
                    </a>
                  </td>
                  {fields.map(([field]) => (
                    <td key={field}>
                      {i[field] ? date(i[field]) : t("common.unknown")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-copy fine-print">{t("cad.timing")}</p>
      </section>
    </>
  );
}
function Replay({ id }: { id: string }) {
  const data = useApi("/assurance/incidents/" + id + "/replay"),
    [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    [correction, setCorrection] = useState("");
  const events = data.data?.items || [];
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((i) => {
          if (i >= events.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        }),
      1000,
    );
    return () => clearInterval(timer);
  }, [playing, events.length]);
  const event = events[index];
  return (
    <>
      <PageHeading title="assurance.replay" subtitle="assurance.subtitle" />
      <ErrorBox error={data.error} />
      {data.data && (
        <section className="panel replay-panel">
          <div className="panel-heading">
            <h2 className="reference">{data.data.incident.public_reference}</h2>
            <Status value={data.data.incident.status} />
          </div>
          <div className="replay-controls">
            <button className="primary" onClick={() => setPlaying(!playing)}>
              {t(playing ? "assurance.pause" : "assurance.play")}
            </button>
            <input
              aria-label={t("assurance.event")}
              type="range"
              min="0"
              max={Math.max(0, events.length - 1)}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
            />
            <span className="mono">
              {index + 1} / {events.length}
            </span>
          </div>
          {event && (
            <div className="replay-detail">
              <EventTimeline events={events.slice(0, index + 1)} />
              <dl>
                <dt>{t("assurance.event")}</dt>
                <dd>{event.event_type}</dd>
                <dt>{t("assurance.origin")}</dt>
                <dd>{event.metadata.origin || event.actor_type}</dd>
                <dt>{t("assurance.actor")}</dt>
                <dd>{event.actor_type}</dd>
                <dt>{t("assurance.committed")}</dt>
                <dd>{date(event.server_occurred_at, true)}</dd>
                <dt>{t("assurance.claimed")}</dt>
                <dd>{date(event.client_occurred_at, true)}</dd>
                <dt>{t("assurance.causation")}</dt>
                <dd className="mono">{event.correlation_id}</dd>
                <dt>{t("assurance.hash")}</dt>
                <dd className="mono hash">{event.event_hash}</dd>
              </dl>
            </div>
          )}
          <div className="action-row">
            <ActionDialog
              label="cad.review"
              onConfirm={async (reason) => {
                await api("/assurance/incidents/" + id + "/reviews", {
                  expected_version: data.data.incident.version,
                  reason,
                });
                invalidate();
              }}
            />
            <ActionDialog
              label="cad.correction"
              onConfirm={async (reason) => {
                await api("/assurance/incidents/" + id + "/corrections", {
                  expected_version: data.data.incident.version,
                  reason,
                  correction_of: correction,
                });
                invalidate();
              }}
            >
              <label>
                {t("assurance.event")}
                <select
                  required
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                >
                  <option value="">{t("common.all")}</option>
                  {events.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.sequence} · {e.event_type}
                    </option>
                  ))}
                </select>
              </label>
            </ActionDialog>
            {data.data.incident.status === "RESOLVED" && (
              <ActionDialog
                label="cad.close"
                onConfirm={async (reason) => {
                  await api("/cad/incidents/" + id + "/close", {
                    expected_version: data.data.incident.version,
                    reason,
                  });
                  invalidate();
                }}
              />
            )}
          </div>
        </section>
      )}
    </>
  );
}
function Audit() {
  const data = useApi("/assurance/audit/verify"),
    checkpoints = useApi("/assurance/audit/checkpoints");
  return (
    <>
      <PageHeading title="assurance.audit" subtitle="legal.integrity">
        <button className="secondary" onClick={() => data.refetch()}>
          {t("assurance.verify")}
        </button>
        <ActionDialog
          label="assurance.checkpoint"
          onConfirm={async (reason) => {
            await api("/assurance/audit/checkpoint", { reason });
            invalidate();
          }}
        />
      </PageHeading>
      <ErrorBox error={data.error} />
      <section className="panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("common.reference")}</th>
                <th>{t("common.status")}</th>
                <th>{t("assurance.event")}</th>
                <th>{t("assurance.hash")}</th>
              </tr>
            </thead>
            <tbody>
              {data.data?.results.map((r: any) => (
                <tr key={r.incidentId}>
                  <td>
                    <a
                      className="mono"
                      href={"/assurance/incidents/" + r.incidentId + "/replay"}
                    >
                      {r.incidentId.slice(0, 8)}
                    </a>
                  </td>
                  <td>
                    <span className={r.valid ? "teal" : "coral"}>
                      {t(r.valid ? "assurance.valid" : "assurance.invalid")}
                    </span>
                  </td>
                  <td>{r.count}</td>
                  <td className="mono hash">
                    {r.rootHash || r.failedSequence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel info-panel">
        <h2>{t("assurance.checkpointLabel")}</h2>
        {checkpoints.data?.items.map((c: any) => (
          <p key={c.id} className="mono hash">
            {date(c.checkpoint_at)} ·{" "}
            {t("assurance.signatureStatus." + c.signatureVerification)} ·{" "}
            {c.signer_key_id} · {c.root_hash}
            {c.signed_payload && (
              <a
                className="text-link"
                href={"/api/v1/assurance/audit/checkpoints/" + c.id + "/bundle"}
              >
                {t("assurance.downloadCheckpoint")}
              </a>
            )}
          </p>
        ))}
      </section>
    </>
  );
}
function Reports() {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const params = new URLSearchParams({
    limit: "100",
    ...(from ? { from } : {}),
    ...(to ? { to: to + "T23:59:59Z" } : {}),
  });
  return (
    <>
      <PageHeading title="assurance.reports" subtitle="assurance.reportInfo" />
      <section className="panel info-panel">
        <div className="date-filter">
          <label>
            {t("common.from")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            {t("common.to")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        <div className="action-row">
          <a
            className="primary"
            href={"/api/v1/assurance/reports/export?" + params + "&format=csv"}
          >
            {t("common.exportCsv")}
            <ArrowUpRight size={16} />
          </a>
          <a
            className="secondary"
            href={"/api/v1/assurance/reports/export?" + params + "&format=pdf"}
          >
            {t("common.exportPdf")}
            <ArrowUpRight size={16} />
          </a>
        </div>
        <p>{t("legal.warning")}</p>
      </section>
    </>
  );
}
function Reviews() {
  const data = useApi("/assurance/reviews");
  return (
    <>
      <PageHeading title="assurance.reviews" subtitle="assurance.reviewText" />
      <section className="panel info-panel">
        {data.data?.items.length ? (
          data.data.items.map((r: any) => (
            <article className="note" key={r.id}>
              <a
                className="reference"
                href={"/assurance/incidents/" + r.incident_id + "/replay"}
              >
                {r.public_reference}
              </a>
              <p>{r.finding_text}</p>
              <small>{date(r.created_at)}</small>
            </article>
          ))
        ) : (
          <Empty />
        )}
      </section>
    </>
  );
}
function Simulator({ slug }: { slug?: string }) {
  const data = useApi("/simulator/scenarios"),
    network = useApi("/cad/network"),
    [seed, setSeed] = useState(2026),
    [error, setError] = useState<any>(),
    [tamper, setTamper] = useState<any>();
  async function run(slug: string) {
    try {
      setError(null);
      await api("/simulator/scenarios/" + slug + "/run", { seed });
      invalidate();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <>
      <PageHeading title="simulation.title" subtitle="simulation.subtitle">
        <ActionDialog
          label="simulation.reset"
          danger
          onConfirm={async (reason) => {
            if (reason !== t("simulation.resetConfirm"))
              throw new Error("CONFIRMATION_REQUIRED");
            await api("/simulator/reset", { confirmation: reason });
            invalidate();
          }}
          initialReason=""
        >
          <p>{t("simulation.resetPrompt")}</p>
        </ActionDialog>
      </PageHeading>
      <ErrorBox error={error} />
      <section className="panel scenario-seed">
        <label>
          {t("simulation.seed")}
          <input
            type="number"
            min="0"
            max="2147483647"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <span>{t("simulation.advance")}</span>
      </section>
      <div className="scenario-grid">
        {data.data?.items
          .filter((s: any) => !slug || s.slug === slug)
          .map((s: any, index: number) => (
            <article key={s.id} className="panel scenario-card">
              <span className="scenario-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <a href={"/simulator/scenarios/" + s.slug}>
                  <h2>{s.title}</h2>
                </a>
                <p className="fine-print mono">
                  {s.slug} · {t("legal.short")}
                </p>
                <p className="fine-print">{s.seed_json.description}</p>
                <ul className="scenario-goals">
                  {s.expected_results_json.assertions.map((g: string) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
              <button className="secondary" onClick={() => run(s.slug)}>
                {t("simulation.run")}
                <ArrowRight size={15} />
              </button>
            </article>
          ))}
      </div>
      <section className="panel info-panel">
        <h2>{t("simulation.runs")}</h2>
        <button
          className="secondary"
          disabled={!data.data}
          onClick={() => {
            const content = {
              application: "NEXUS — Response Intelligence",
              simulation: true,
              warning: t("legal.warning"),
              generatedAt: new Date().toISOString(),
              selectedSeed: seed,
              scenarios: data.data.items,
              runs: data.data.runs,
            };
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(content, null, 2)], {
                type: "application/json",
              }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "nexus-fictional-scenario-seeds.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("simulation.exportSeeds")}
        </button>
        {data.data?.runs.map((r: any) => (
          <div key={r.id} className="scenario-run">
            <div>
              <strong>{r.results_json?.slug}</strong>
              <small>
                {r.results_json?.reference} · {t("simulation.seed")}: {r.seed} ·{" "}
                {r.results_json?.step || 0}/{r.results_json?.steps?.length || 8}
              </small>
            </div>
            <button
              disabled={!!r.completed_at}
              onClick={async () => {
                try {
                  await api("/simulator/scenarios/" + r.id + "/step", {});
                  invalidate();
                } catch (e) {
                  setError(e);
                }
              }}
            >
              {t("simulation.step")}
            </button>
          </div>
        ))}
      </section>
      <section className="panel info-panel">
        <h2>{t("simulation.faults")}</h2>
        <div className="fault-grid">
          {[
            "worker_paused",
            "drop_notifications",
            "map_unavailable",
            "stale_locations",
            "unit_unavailable",
            "ack_delay_ms",
          ].map((fault) => (
            <div className="fault-control" key={fault}>
              <div>
                <strong>{t("simulation." + fault)}</strong>
                <small>
                  {network.data?.settings[fault] === undefined
                    ? "—"
                    : t(
                        network.data.settings[fault]
                          ? "simulation.enabled"
                          : "simulation.disabled",
                      )}
                </small>
              </div>
              <button
                onClick={async () => {
                  try {
                    await api("/simulator/faults", { fault, enabled: true });
                    invalidate();
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                {t("simulation.enable")}
              </button>
              <button
                onClick={async () => {
                  try {
                    await api("/simulator/faults", { fault, enabled: false });
                    invalidate();
                  } catch (e) {
                    setError(e);
                  }
                }}
              >
                {t("simulation.disable")}
              </button>
            </div>
          ))}
        </div>
        <button
          className="secondary"
          onClick={async () => {
            try {
              setTamper(await api("/simulator/tamper-demo"));
            } catch (e) {
              setError(e);
            }
          }}
        >
          {t("assurance.tamper")}
        </button>
        {tamper && (
          <p className="teal">
            {t("assurance.tamperInfo")} · {String(tamper.original?.valid)} →{" "}
            {String(tamper.tamperedCopy?.valid)}
          </p>
        )}
      </section>
    </>
  );
}
function SimulationSettings() {
  const data = useApi("/simulator/settings"),
    [error, setError] = useState<any>(),
    [saved, setSaved] = useState(false);
  return (
    <>
      <PageHeading title="simulation.settings" subtitle="simulation.subtitle" />
      <section className="panel info-panel">
        {data.data && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              try {
                await api("/simulator/settings", {
                  agency_name: form.get("agency_name"),
                  retention_days: Number(form.get("retention_days")),
                });
                setSaved(true);
                invalidate();
              } catch (e) {
                setError(e);
              }
            }}
          >
            <label>
              {t("simulation.agency")}
              <input
                name="agency_name"
                required
                minLength={5}
                maxLength={80}
                defaultValue={data.data.agency.demo_name}
              />
            </label>
            <label>
              {t("simulation.retention")}
              <input
                name="retention_days"
                type="number"
                min={1}
                max={30}
                defaultValue={
                  data.data.items.find((r: any) => r.key === "retention_days")
                    ?.value || 7
                }
              />
            </label>
            <ErrorBox error={error} />
            <button className="primary">{t("common.save")}</button>
            {saved && <p className="teal">{t("common.serverConfirmed")}</p>}
          </form>
        )}
      </section>
    </>
  );
}
