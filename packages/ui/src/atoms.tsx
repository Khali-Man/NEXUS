"use client";
import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  Check,
  Link2,
  LoaderCircle,
  X,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";
import { t, date } from "../../i18n/src/index";
import { ApiError } from "./api";
export function Brand() {
  return (
    <a href="/" className="brand">
      <span className="brand-icon">
        <Link2 size={25} />
      </span>
      <span>
        <strong>{t("common.wordmark")}</strong>
        <small>{t("common.strapline")}</small>
      </span>
    </a>
  );
}
export function Warning() {
  return (
    <div className="simulation-banner">
      <ShieldCheck size={15} />
      <span>{t("legal.warning")}</span>
      <a href="/help">
        {t("legal.understand")}
        <ArrowUpRight size={12} />
      </a>
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>
      <i />
      {t("status." + value)}
    </span>
  );
}
export function ErrorBox({ error, retry }: { error: any; retry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="error-box">
      {t("common.error", {
        code: error instanceof ApiError ? error.code : "CONNECTION_UNAVAILABLE",
      })}
      {retry && <button onClick={retry}>{t("common.retry")}</button>}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={20} />
      {t("common.loading")}
    </div>
  );
}
export function Empty({ text = "common.none" }: { text?: string }) {
  return (
    <div className="empty">
      <span className="empty-orbit">
        <Check size={22} />
      </span>
      <p>{t(text)}</p>
    </div>
  );
}
export function Connectivity({ online }: { online: boolean }) {
  return (
    <span
      role="status"
      className={"connection " + (online ? "connected" : "disconnected")}
    >
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}{" "}
      {t(online ? "common.online" : "common.offline")}
    </span>
  );
}
export function PageHeading({
  eyebrow = "cad.eyebrow",
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{t(eyebrow)}</p>
        <h1>{t(title)}</h1>
        {subtitle && <p className="subtle">{t(subtitle)}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function ActionDialog({
  label,
  onConfirm,
  children,
  danger = false,
  initialReason = "",
}: {
  label: string;
  onConfirm: (reason: string) => Promise<any>;
  children?: ReactNode;
  danger?: boolean;
  initialReason?: string;
}) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(initialReason),
    [error, setError] = useState<any>(),
    [busy, setBusy] = useState(false);
  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason);
      setOpen(false);
      setReason("");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className={danger ? "danger" : "secondary"}>{t(label)}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title>{t(label)}</Dialog.Title>
          <Dialog.Description>{t("common.reasonRequired")}</Dialog.Description>
          <Dialog.Close
            className="icon-button modal-close"
            aria-label={t("accessibility.close")}
          >
            <X size={18} />
          </Dialog.Close>
          <form onSubmit={submit}>
            {children}
            <label>
              {t("common.reason")}
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <ErrorBox error={error} />
            <button className={danger ? "danger" : "primary"} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : null}
              {t("common.confirm")}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function EventTimeline({ events }: { events: any[] }) {
  return (
    <ol className="event-timeline" aria-label={t("accessibility.timeline")}>
      {events.map((e, index) => (
        <li key={e.id || e.sequence || index}>
          <span className="event-dot" />
          <div>
            <strong>
              {e.metadata?.status || e.status ? (
                <Status value={e.metadata?.status || e.status} />
              ) : (
                e.event_type
              )}
            </strong>
            <time>{date(e.server_occurred_at)}</time>
            {e.reason_code && <p>{e.reason_code}</p>}
            {e.client_occurred_at && (
              <small>
                {t("assurance.claimed")}: {date(e.client_occurred_at, true)}
              </small>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
