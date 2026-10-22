"use client";
import { useState, useEffect, useRef } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Inbox,
  ListChecks,
  LogOut,
  MapPin,
  Truck,
  UserRound,
} from "lucide-react";
import { LocaleProvider, t, date } from "../../i18n/src/index";
import { client, api, useApi, invalidate, useLive, ApiError } from "./api";
import {
  Brand,
  Warning,
  Status,
  ErrorBox,
  Loading,
  Empty,
  Connectivity,
  ActionDialog,
} from "./atoms";
import { Login } from "./operations";
import { loadQueue, saveQueue, clearQueue, type QueuedCommand } from "./queue";
export function ResponderApp() {
  return (
    <LocaleProvider>
      <QueryClientProvider client={client}>
        <Responder />
      </QueryClientProvider>
    </LocaleProvider>
  );
}
function Responder() {
  const me = useApi("/auth/me"),
    [queue, setQueue] = useState<QueuedCommand[]>([]),
    [online, setOnline] = useState(navigator.onLine);
  const [identity, setIdentity] = useState<any>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("nexus-field-identity") || "null",
      );
      return value?.expiresAt > Date.now() ? value : null;
    } catch {
      return null;
    }
  });
  const user = me.data || (!online ? identity : null);
  useEffect(() => {
    if (me.data?.role === "responder") {
      const value = {
        role: "responder",
        demo_name: me.data.demo_name,
        expiresAt: Date.now() + 8 * 3600000,
      };
      localStorage.setItem("nexus-field-identity", JSON.stringify(value));
      setIdentity(value);
    }
  }, [me.data?.id]);
  const busy = useRef(false);
  useEffect(() => {
    setQueue(loadQueue());
    const update = () => setQueue(loadQueue());
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener("nexus-queue", update);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("nexus-queue", update);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  const { connected } = useLive();
  const path = location.pathname;
  async function flush() {
    if (busy.current || !navigator.onLine) return;
    busy.current = true;
    try {
      let entries = loadQueue();
      for (const entry of entries) {
        if (entry.state === "REJECTED_CONFLICT") continue;
        entry.state = "SENT_UNCONFIRMED";
        saveQueue(entries);
        try {
          await api(
            "/responder/assignments/" + entry.assignmentId + "/" + entry.action,
            {
              expected_version: entry.expected_version,
              reason: entry.reason,
              client_occurred_at: entry.client_occurred_at,
            },
            { key: entry.id },
          );
          entries = entries.filter((x) => x.id !== entry.id);
          saveQueue(entries);
          invalidate();
        } catch (e) {
          entry.state =
            e instanceof ApiError && [400, 403, 404, 409].includes(e.status)
              ? "REJECTED_CONFLICT"
              : "FAILED_RETRYABLE";
          entry.error = e instanceof ApiError ? e.code : "NETWORK_UNAVAILABLE";
          saveQueue(entries);
          if (entry.state === "FAILED_RETRYABLE") break;
        }
      }
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    if (online && me.data?.role === "responder") {
      void api(
        "/responder/sync?cursor=" +
          encodeURIComponent(
            sessionStorage.getItem("nexus-sync-cursor") ||
              "1970-01-01T00:00:00.000Z",
          ),
      )
        .then((result) => {
          sessionStorage.setItem("nexus-sync-cursor", result.cursor);
          invalidate();
        })
        .catch(() => {});
      void api("/responder/heartbeat", {}).catch(() => {});
      void flush();
      const timer = setInterval(() => {
        void flush();
        void api("/responder/heartbeat", {}).catch(() => {});
      }, 15000);
      return () => clearInterval(timer);
    }
  }, [online, me.data?.role]);
  if (path === "/help" || path === "/privacy")
    return (
      <div className="dark legal-page">
        <Warning />
        <Brand />
        <h1>{t(path === "/help" ? "common.help" : "common.privacy")}</h1>
        <p>{t(path === "/help" ? "legal.guidance" : "legal.privacy")}</p>
        <a href="/responder">{t("common.back")}</a>
      </div>
    );
  if (path.endsWith("/login") || (me.error && !user))
    return <Login responder />;
  if (!user)
    return (
      <div className="dark">
        <Loading />
      </div>
    );
  if (user.role !== "responder")
    return (
      <div className="dark legal-page">
        <Warning />
        <p>{t("common.noPermission")}</p>
        <button
          onClick={async () => {
            clearQueue();
            await api("/auth/logout", {});
            location.href = "/responder/login";
          }}
        >
          {t("common.logout")}
        </button>
      </div>
    );
  return (
    <div className="dark responder-app">
      <Warning />
      <header className="responder-header">
        <Brand />
        <Connectivity online={online && connected} />
      </header>
      <div
        className={
          "field-connectivity " + (!online || queue.length ? "attention" : "")
        }
      >
        <span>{t("responder.pendingCount", { count: queue.length })}</span>
        <a href="/responder/outbox">
          {t("responder.outbox")}
          <ArrowRight size={14} />
        </a>
      </div>
      <main id="main" className="field-main">
        {path === "/responder/outbox" ? (
          <>
            <h1>{t("responder.outbox")}</h1>
            <p className="subtle">{t("legal.storage")}</p>
            <button className="primary" onClick={() => void flush()}>
              {t("responder.retry")}
            </button>
            {queue.map((entry) => (
              <article className="panel field-queue" key={entry.id}>
                <div>
                  <strong>
                    {t(
                      "responder." +
                        (
                          {
                            accept: "accept",
                            decline: "decline",
                            "en-route": "enRoute",
                            arrived: "arrived",
                            outcome: "outcome",
                          } as any
                        )[entry.action],
                    )}
                  </strong>
                  <span
                    className={
                      entry.state === "REJECTED_CONFLICT" ? "coral" : "amber"
                    }
                  >
                    {t(
                      entry.state === "REJECTED_CONFLICT"
                        ? "responder.conflicted"
                        : entry.state === "FAILED_RETRYABLE"
                          ? "responder.retryable"
                          : "common.pending",
                    )}
                  </span>
                </div>
                <small>
                  {t("responder.clientTime")}: {date(entry.client_occurred_at)}
                </small>
                <small className="mono">{entry.id}</small>
                <ActionDialog
                  label="responder.discard"
                  danger
                  onConfirm={async () =>
                    saveQueue(loadQueue().filter((c) => c.id !== entry.id))
                  }
                >
                  <p>{t("responder.discardConfirm")}</p>
                </ActionDialog>
              </article>
            ))}
            {!queue.length && <Empty text="responder.outboxEmpty" />}
          </>
        ) : path === "/responder/profile" ? (
          <Profile
            logout={async () => {
              clearQueue();
              await api("/auth/logout", {});
              client.clear();
              location.href = "/responder/login";
            }}
          />
        ) : path.startsWith("/responder/assignments/") ? (
          <Mission
            id={path.split("/").at(-1)!}
            queued={queue}
            onCommand={async (entry) => {
              saveQueue([...loadQueue(), entry]);
              await flush();
            }}
          />
        ) : (
          <InboxView />
        )}
      </main>
      <nav className="field-nav" aria-label={t("accessibility.navigation")}>
        {[
          ["/responder", "responder.inbox", Inbox],
          ["/responder/outbox", "responder.outbox", ListChecks],
          ["/responder/profile", "responder.profile", UserRound],
        ].map(([href, label, Icon]: any) => (
          <a href={href} key={href} className={path === href ? "active" : ""}>
            <Icon size={20} />
            {t(label)}
          </a>
        ))}
      </nav>
    </div>
  );
}
function InboxView() {
  const data = useApi("/responder/assignments");
  const [historyPage, setHistoryPage] = useState(0);
  const items = data.data?.items || [];
  const current = items.filter((i: any) =>
    ["ACCEPTED", "ACTIVE"].includes(i.assignment_status),
  );
  const incoming = items.filter((i: any) => i.assignment_status === "OFFERED");
  const history = items.filter(
    (i: any) =>
      !["OFFERED", "ACCEPTED", "ACTIVE"].includes(i.assignment_status),
  );
  function card(i: any, historical = false) {
    return (
      <a
        className={
          "panel mission-card " +
          (historical
            ? "history-mission"
            : i.assignment_status === "OFFERED"
              ? "incoming-mission"
              : "active-mission")
        }
        key={i.assignment_id}
        href={"/responder/assignments/" + i.assignment_id}
      >
        <div>
          <span className="reference">{i.public_reference}</span>
          <Status
            value={
              i.assignment_status === "ACTIVE" ? i.status : i.assignment_status
            }
          />
        </div>
        <h2>{t("category." + i.category)}</h2>
        <p>
          <MapPin size={15} />
          {i.landmark}
        </p>
        {i.updated_at && (
          <small className="mission-updated">
            {t("common.timestamp")}: {date(i.updated_at)}
          </small>
        )}
        <div className="mission-footer">
          <span>
            <Truck size={15} />
            {i.callsign}
          </span>
          <ArrowUpRight size={20} />
        </div>
        {i.assignment_status === "OFFERED" && (
          <small>
            {t("cad.offerExpiry")}: {date(i.expires_at)}
          </small>
        )}
      </a>
    );
  }
  return (
    <>
      <p className="eyebrow">{t("legal.short")}</p>
      <h1>{t("responder.title")}</h1>
      <p className="subtle">{t("responder.subtitle")}</p>
      <ErrorBox error={data.error} />
      {data.isPending && <Loading />}
      {data.data && (
        <>
          <section className="mission-group" aria-labelledby="current-missions">
            <div className="field-section-heading">
              <h2 id="current-missions">{t("responder.active")}</h2>
              <span>{current.length}</span>
            </div>
            <p className="field-group-note">{t("responder.currentNote")}</p>
            {current.length ? (
              current.map((i: any) => card(i))
            ) : (
              <p className="field-empty">
                <Truck size={19} />
                {t("responder.noCurrent")}
              </p>
            )}
          </section>
          <section
            className="mission-group"
            aria-labelledby="incoming-missions"
          >
            <div className="field-section-heading">
              <h2 id="incoming-missions">{t("responder.incoming")}</h2>
              <span>{incoming.length}</span>
            </div>
            <p className="field-group-note">{t("responder.incomingNote")}</p>
            {incoming.length ? (
              incoming.map((i: any) => card(i))
            ) : (
              <p className="field-empty">
                <Inbox size={19} />
                {t("responder.noIncoming")}
              </p>
            )}
          </section>
          <details className="mission-history">
            <summary>
              {t("responder.historyCount", { count: history.length })}
            </summary>
            <p className="field-group-note">{t("responder.historyNote")}</p>
            {history
              .slice(historyPage * 8, (historyPage + 1) * 8)
              .map((i: any) => card(i, true))}
            {history.length > 8 && (
              <div className="pagination">
                <button
                  disabled={!historyPage}
                  onClick={() => setHistoryPage(historyPage - 1)}
                >
                  {t("common.previous")}
                </button>
                <span>{t("common.pagination", { page: historyPage + 1 })}</span>
                <button
                  disabled={(historyPage + 1) * 8 >= history.length}
                  onClick={() => setHistoryPage(historyPage + 1)}
                >
                  {t("common.next")}
                </button>
              </div>
            )}
          </details>
          <p className="field-group-note">{t("responder.historyLimit")}</p>
        </>
      )}
    </>
  );
}
function Mission({
  id,
  queued,
  onCommand,
}: {
  id: string;
  queued: QueuedCommand[];
  onCommand: (entry: QueuedCommand) => Promise<any>;
}) {
  const data = useApi("/responder/assignments/" + id);
  const [notice, setNotice] = useState("");
  const i = data.data;
  if (!i)
    return (
      <>
        <ErrorBox error={data.error} />
        {!data.error && <Loading />}
      </>
    );
  const actions =
    i.status === "OFFERED"
      ? ["accept", "decline"]
      : i.status === "ACCEPTED"
        ? ["en-route"]
        : i.status === "EN_ROUTE_REPORTED"
          ? ["arrived"]
          : i.status === "ARRIVAL_REPORTED"
            ? ["outcome"]
            : [];
  const hasPending = queued.some((q) => q.assignmentId === id);
  const keys: any = {
    accept: "accept",
    decline: "decline",
    "en-route": "enRoute",
    arrived: "arrived",
    outcome: "outcome",
  };
  return (
    <>
      <a className="text-link" href="/responder">
        {t("responder.inbox")}
      </a>
      <p className="reference">{i.public_reference}</p>
      <h1>{t("category." + i.category)}</h1>
      <Status value={i.status} />
      <p className="mission-description">{i.description_sanitised}</p>
      <div className="panel info-panel">
        <h2>
          <MapPin size={18} />
          {i.landmark}
        </h2>
        <p>
          {t("cad.location")}: {i.location_confidence} ±{i.location_accuracy_m}{" "}
          m
        </p>
        <p>
          {t("cad.offerExpiry")}: {date(i.expires_at)}
        </p>
        <small>
          {t("common.timestamp")}: {date(i.updated_at)}
        </small>
      </div>
      {notice && (
        <p role="status" className="notice">
          {t(notice)}
        </p>
      )}
      {hasPending ? (
        <div className="error-box">
          {t("common.pending")}
          <a href="/responder/outbox">{t("responder.outbox")}</a>
        </div>
      ) : (
        <div className="field-actions">
          {actions.map((action) => (
            <ActionDialog
              key={action}
              label={"responder." + keys[action]}
              danger={action === "decline"}
              onConfirm={async (reason) => {
                const entry: QueuedCommand = {
                  id: crypto.randomUUID(),
                  assignmentId: id,
                  action,
                  expected_version: i.version,
                  reason,
                  client_occurred_at: new Date().toISOString(),
                  state: "QUEUED",
                };
                await onCommand(entry);
                const pending = loadQueue().find((q) => q.id === entry.id);
                setNotice(
                  pending
                    ? pending.state === "REJECTED_CONFLICT"
                      ? "responder.conflicted"
                      : "responder.queued"
                    : "responder.confirmed",
                );
              }}
            />
          ))}
        </div>
      )}
      <p className="fine-print">{t("legal.storage")}</p>
    </>
  );
}
function Profile({ logout }: { logout: () => Promise<void> }) {
  const data = useApi("/responder/profile");
  return (
    <>
      <p className="eyebrow">{t("legal.short")}</p>
      <h1>{t("responder.profile")}</h1>
      <p>{data.data?.user.demo_name}</p>
      <p className="subtle">
        {t("simulation.agency")}: {data.data?.agency.demo_name}
      </p>
      <h2>{t("responder.membership")}</h2>
      {data.data?.units.map((u: any) => (
        <div className="panel info-panel" key={u.id}>
          <Truck size={24} />
          <h2>{u.callsign}</h2>
          <p>
            {u.capability_tags
              .map((c: string) => t("category." + c))
              .join(" · ")}
          </p>
          <Status value={u.dispatch_status} />
        </div>
      ))}
      <p>{t("responder.session")}</p>
      <button className="secondary" onClick={logout}>
        <LogOut size={18} />
        {t("common.logout")}
      </button>
    </>
  );
}
