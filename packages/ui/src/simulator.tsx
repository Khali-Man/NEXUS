"use client";
import { useState, useRef } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  FileClock,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { t, date, number } from "../../i18n/src/index";
import { api, invalidate, useApi } from "./api";
import { ActionDialog, Empty, ErrorBox, Loading, PageHeading } from "./atoms";

const purposeFor = (slug: string) =>
  ["audit-tamper", "duplicate-alerts"].includes(slug)
    ? "integrity"
    : [
          "medical-low-network",
          "map-unavailable",
          "late-arrival-conflict",
        ].includes(slug)
      ? "continuity"
      : "coordination";

export function Simulator({ slug }: { slug?: string }) {
  const [seed, setSeed] = useState(2026),
    [query, setQuery] = useState(""),
    [purpose, setPurpose] = useState(""),
    [cataloguePage, setCataloguePage] = useState(0),
    [runPage, setRunPage] = useState(0),
    [runStatus, setRunStatus] = useState(""),
    [scenario, setScenario] = useState(""),
    [selectedId, setSelectedId] = useState(""),
    [createdRun, setCreatedRun] = useState<any>(),
    [pending, setPending] = useState(""),
    [error, setError] = useState<any>(),
    [tamper, setTamper] = useState<any>();
  const data = useApi(
    "/simulator/scenarios?" +
      new URLSearchParams({
        limit: "6",
        offset: String(runPage * 6),
        runStatus,
        scenario,
      }),
  );
  const selected = useApi(selectedId ? "/simulator/runs/" + selectedId : null);
  const network = useApi("/cad/network");
  const runHeading = useRef<HTMLHeadingElement>(null);
  const current =
    selected.data ||
    (createdRun?.id === selectedId ? createdRun : null) ||
    (!selectedId ? data.data?.runs[0] : null);
  const fixtures = data.data?.items || [];
  const matches = fixtures.filter(
    (s: any) =>
      (!slug || s.slug === slug) &&
      (!purpose || purposeFor(s.slug) === purpose) &&
      `${s.title} ${s.seed_json.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const fixturePage = Math.min(
    cataloguePage,
    Math.max(0, Math.ceil(matches.length / 4) - 1),
  );
  async function change(key: string, action: () => Promise<any>) {
    setPending(key);
    setError(null);
    try {
      await action();
      invalidate();
    } catch (e) {
      setError(e);
    } finally {
      setPending("");
    }
  }
  async function exportSeeds() {
    // Preserve the previous thirty-run export bound independently of UI paging.
    const exported = await api(
      "/simulator/scenarios?" +
        new URLSearchParams({ limit: "30", offset: "0", scenario, runStatus }),
    );
    const content = {
      application: t("common.brand"),
      simulation: true,
      warning: t("legal.warning"),
      generatedAt: new Date().toISOString(),
      selectedSeed: seed,
      scenarios: fixtures,
      runs: exported.runs,
      runScope: {
        totalMatching: exported.totalRuns,
        offset: 0,
        limit: 30,
        scenario,
        runStatus,
      },
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
  }
  return (
    <>
      <PageHeading title="simulation.title" subtitle="simulation.subtitle">
        <ActionDialog
          label="simulation.reset"
          danger
          initialReason=""
          onConfirm={async (reason) => {
            if (reason !== t("simulation.resetConfirm"))
              throw new Error("CONFIRMATION_REQUIRED");
            await api("/simulator/reset", { confirmation: reason });
            invalidate();
          }}
        >
          <p>{t("simulation.resetPrompt")}</p>
        </ActionDialog>
      </PageHeading>
      <ErrorBox error={error || data.error || selected.error} />
      <section className="panel scenario-seed">
        <SlidersHorizontal size={23} />
        <label>
          {t("simulation.seed")}
          <input
            type="number"
            min={0}
            max={2147483647}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <span>{t("simulation.advance")}</span>
      </section>
      <div className="simulator-layout">
        <section
          className="scenario-catalogue"
          aria-labelledby="scenario-catalogue-heading"
        >
          <h2 id="scenario-catalogue-heading">{t("simulation.catalogue")}</h2>
          <p className="catalogue-intro">{t("simulation.catalogueNote")}</p>
          {slug && (
            <a className="text-link" href="/simulator">
              {t("simulation.allScenarios")}
              <ArrowUpRight size={16} />
            </a>
          )}
          <label className="search-box scenario-search">
            <Search size={17} />
            <input
              aria-label={t("simulation.search")}
              placeholder={t("simulation.search")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCataloguePage(0);
              }}
            />
          </label>
          <div
            className="purpose-filters"
            role="group"
            aria-label={t("simulation.purpose")}
          >
            {["", "coordination", "continuity", "integrity"].map((p) => (
              <button
                key={p}
                aria-pressed={purpose === p}
                onClick={() => {
                  setPurpose(p);
                  setCataloguePage(0);
                }}
              >
                {t("simulation." + (p || "allPurposes"))}
                <span>
                  {number(
                    fixtures.filter(
                      (s: any) =>
                        (!slug || s.slug === slug) &&
                        (!p || purposeFor(s.slug) === p),
                    ).length,
                  )}
                </span>
              </button>
            ))}
          </div>
          {data.isPending && <Loading />}
          <div className="scenario-grid">
            {matches
              .slice(fixturePage * 4, (fixturePage + 1) * 4)
              .map((s: any) => (
                <article key={s.id} className="panel scenario-card">
                  <div className="scenario-card-top">
                    <span className="scenario-purpose">
                      {t("simulation." + purposeFor(s.slug))}
                    </span>
                    <span className="scenario-step-count">
                      {t("simulation.fixtureSteps", {
                        count: s.seed_json.steps.length,
                      })}
                    </span>
                  </div>
                  <a href={"/simulator/scenarios/" + s.slug}>
                    <h2>{s.title}</h2>
                  </a>
                  <p>{s.seed_json.description}</p>
                  <details className="scenario-checks">
                    <summary>{t("simulation.inspectGoals")}</summary>
                    <ul className="scenario-goals">
                      {s.expected_results_json.assertions.map(
                        (goal: string) => (
                          <li key={goal}>{goal}</li>
                        ),
                      )}
                    </ul>
                  </details>
                  <button
                    className="secondary"
                    disabled={
                      !!pending ||
                      !Number.isInteger(seed) ||
                      seed < 0 ||
                      seed > 2147483647
                    }
                    onClick={() =>
                      change(s.slug, async () => {
                        const run = await api(
                          "/simulator/scenarios/" + s.slug + "/run",
                          { seed },
                        );
                        setCreatedRun(run);
                        setSelectedId(run.id);
                        setRunPage(0);
                        setRunStatus("");
                        setScenario("");
                        runHeading.current?.focus();
                      })
                    }
                  >
                    {pending === s.slug
                      ? t("common.loading")
                      : t("simulation.run")}
                    <ArrowRight size={16} />
                  </button>
                </article>
              ))}
          </div>
          {matches.length > 4 && (
            <nav
              className="pagination catalogue-pagination"
              aria-label={t("simulation.catalogue")}
            >
              <button
                disabled={!fixturePage}
                onClick={() => setCataloguePage(fixturePage - 1)}
              >
                {t("common.previous")}
              </button>
              <span>
                {t("common.showing", {
                  from: fixturePage * 4 + 1,
                  to: Math.min((fixturePage + 1) * 4, matches.length),
                  total: matches.length,
                })}
              </span>
              <button
                disabled={(fixturePage + 1) * 4 >= matches.length}
                onClick={() => setCataloguePage(fixturePage + 1)}
              >
                {t("common.next")}
              </button>
            </nav>
          )}
          {data.data && !matches.length && <Empty text="common.noMatches" />}
        </section>
        <aside className="run-sidebar">
          <section
            className="panel selected-run"
            aria-labelledby="selected-run-heading"
          >
            <div className="panel-heading">
              <h2 id="selected-run-heading" ref={runHeading} tabIndex={-1}>
                {t("simulation.selectedRun")}
              </h2>
              <FileClock size={18} />
            </div>
            {current ? (
              <div className="selected-run-body">
                <span
                  className={
                    "run-state " + (current.completed_at ? "complete" : "")
                  }
                >
                  <CheckCheck size={15} />
                  {t(
                    current.stopped_at
                      ? "simulation.stoppedRuns"
                      : current.completed_at
                        ? "simulation.completed"
                        : "simulation.activeRuns",
                  )}
                </span>
                <h3>
                  {fixtures.find((s: any) => s.id === current.scenario_id)
                    ?.title || current.results_json?.slug}
                </h3>
                <span className="reference">
                  {current.results_json?.reference}
                </span>
                <dl>
                  <div>
                    <dt>{t("simulation.seed")}</dt>
                    <dd>{number(current.seed)}</dd>
                  </div>
                  <div>
                    <dt>{t("simulation.started")}</dt>
                    <dd>{date(current.started_at)}</dd>
                  </div>
                </dl>
                {!current.results_json?.steps?.length && (
                  <p>{t("simulation.fixtureIncomplete")}</p>
                )}
                <p className="run-progress-label">
                  {t("simulation.runProgress", {
                    step: current.results_json?.step || 0,
                    total: current.results_json?.steps?.length || 0,
                  })}
                </p>
                <progress
                  max={Math.max(1, current.results_json?.steps?.length || 0)}
                  value={current.results_json?.step || 0}
                  aria-label={t("simulation.runProgress", {
                    step: current.results_json?.step || 0,
                    total: current.results_json?.steps?.length || 0,
                  })}
                />
                {!current.completed_at && !current.stopped_at && (
                  <p className="run-next-step">
                    {t("simulation.nextStep")}
                    <strong className="mono">
                      {
                        current.results_json?.steps?.[
                          current.results_json?.step || 0
                        ]
                      }
                    </strong>
                  </p>
                )}
                <button
                  className="primary"
                  disabled={
                    !!pending ||
                    !!current.completed_at ||
                    !!current.stopped_at ||
                    !current.results_json?.steps?.length
                  }
                  onClick={() =>
                    change("step", async () => {
                      await api(
                        "/simulator/scenarios/" + current.id + "/step",
                        {},
                      );
                      setSelectedId(current.id);
                    })
                  }
                >
                  {t("simulation.step")}
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : selected.isFetching ? (
              <Loading />
            ) : (
              <p className="panel-copy">{t("simulation.selectRun")}</p>
            )}
          </section>
          <section
            className="panel run-history"
            aria-labelledby="run-history-heading"
          >
            <div className="panel-heading">
              <h2 id="run-history-heading">{t("simulation.runHistory")}</h2>
              <span>{number(data.data?.totalRuns || 0)}</span>
            </div>
            <div className="run-history-filters">
              <label>
                {t("simulation.runState")}
                <select
                  value={runStatus}
                  onChange={(e) => {
                    setRunStatus(e.target.value);
                    setRunPage(0);
                  }}
                >
                  <option value="">{t("common.all")}</option>
                  <option value="active">{t("simulation.activeRuns")}</option>
                  <option value="stopped">{t("simulation.stoppedRuns")}</option>
                  <option value="completed">
                    {t("simulation.completedRuns")}
                  </option>
                </select>
              </label>
              <label>
                {t("simulation.scenarioFilter")}
                <select
                  value={scenario}
                  onChange={(e) => {
                    setScenario(e.target.value);
                    setRunPage(0);
                  }}
                >
                  <option value="">{t("common.all")}</option>
                  {fixtures.map((s: any) => (
                    <option key={s.slug} value={s.slug}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div
              className="run-history-list"
              role="region"
              aria-label={t("simulation.runHistory")}
              tabIndex={0}
            >
              {data.data?.runs.map((r: any) => (
                <div
                  key={r.id}
                  className={
                    "scenario-run " + (current?.id === r.id ? "selected" : "")
                  }
                >
                  <button
                    className="run-select"
                    aria-label={
                      t("simulation.inspectRun") +
                      ": " +
                      (r.results_json?.reference || r.id)
                    }
                    aria-pressed={current?.id === r.id}
                    onClick={() => {
                      setSelectedId(r.id);
                      runHeading.current?.focus();
                    }}
                  >
                    <strong>
                      {fixtures.find((s: any) => s.id === r.scenario_id)
                        ?.title || r.results_json?.slug}
                    </strong>
                    <span className="reference">
                      {r.results_json?.reference || r.id}
                    </span>
                    <small>
                      {t("simulation.seed")}: {number(r.seed)} ·{" "}
                      {r.results_json?.step || 0}/
                      {r.results_json?.steps?.length || 0} ·{" "}
                      {t(
                        r.stopped_at
                          ? "simulation.stoppedRuns"
                          : r.completed_at
                            ? "simulation.completedRuns"
                            : "simulation.activeRuns",
                      )}
                    </small>
                    <time>{date(r.started_at)}</time>
                  </button>
                </div>
              ))}
            </div>
            {data.data && !data.data.runs.length && (
              <Empty text="common.noMatches" />
            )}
            <div className="pagination">
              <button
                disabled={!runPage}
                onClick={() => setRunPage(runPage - 1)}
              >
                {t("common.previous")}
              </button>
              <span>{t("common.pagination", { page: runPage + 1 })}</span>
              <button
                disabled={(runPage + 1) * 6 >= (data.data?.totalRuns || 0)}
                onClick={() => setRunPage(runPage + 1)}
              >
                {t("common.next")}
              </button>
            </div>
          </section>
        </aside>
      </div>
      <section className="panel info-panel export-scenarios">
        <h2>{t("simulation.exportSeeds")}</h2>
        <p>{t("simulation.runScope")}</p>
        <button
          className="secondary"
          disabled={!data.data || !!pending}
          onClick={() => change("export", exportSeeds)}
        >
          {t("simulation.exportSeeds")}
          <ArrowUpRight size={16} />
        </button>
      </section>
      <section className="panel info-panel fault-laboratory">
        <h2>{t("simulation.faults")}</h2>
        <p>{t("simulation.faultInfo")}</p>
        <ErrorBox error={network.error} />
        <div className="fault-grid">
          {[
            "worker_paused",
            "drop_notifications",
            "map_unavailable",
            "stale_locations",
            "unit_unavailable",
            "ack_delay_ms",
          ].map((fault) => {
            const value = network.data?.settings?.[fault],
              enabled = !!value;
            return (
              <div
                className={"fault-control " + (enabled ? "fault-enabled" : "")}
                key={fault}
              >
                <div>
                  <strong>{t("simulation." + fault)}</strong>
                  <small role="status">
                    {value === undefined
                      ? t("simulation.faultLoading")
                      : t(
                          enabled
                            ? "simulation.enabled"
                            : "simulation.disabled",
                        )}
                  </small>
                  {["stale_locations", "unit_unavailable"].includes(fault) && (
                    <p>{t("simulation." + fault + "Info")}</p>
                  )}
                  {fault === "ack_delay_ms" && value !== undefined && (
                    <p>
                      {t("simulation.acknowledgementDelay", {
                        milliseconds: number(value),
                      })}
                    </p>
                  )}
                </div>
                <div className="fault-actions">
                  {[true, false].map((next) => (
                    <button
                      key={String(next)}
                      disabled={
                        !!pending || value === undefined || enabled === next
                      }
                      onClick={() =>
                        change(fault, () =>
                          api("/simulator/faults", { fault, enabled: next }),
                        )
                      }
                    >
                      {t(next ? "simulation.enable" : "simulation.disable")}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {pending && pending !== "export" && (
          <p role="status">{t("simulation.faultSaving")}</p>
        )}
        <button
          className="secondary"
          disabled={!!pending}
          onClick={() =>
            change("tamper", async () =>
              setTamper(await api("/simulator/tamper-demo")),
            )
          }
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
