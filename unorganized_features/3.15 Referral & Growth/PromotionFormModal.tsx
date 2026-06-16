// src/app/(admin)/promotions/PromotionFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect } from "react";
import type { Promotion } from "@/types/referral";
import { X } from "lucide-react";

interface Props {
  existing: Promotion | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PromotionFormModal({ existing, onClose, onSaved }: Props) {
  const isEdit = !!existing;

  const [form, setForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    ctaLabel: "",
    ctaUrl: "",
    targetRole: "ALL",
    placement: "HOME",
    priority: "0",
    startsAt: "",
    endsAt: "",
    promoCodeId: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title,
        description: existing.description ?? "",
        imageUrl: existing.imageUrl ?? "",
        ctaLabel: existing.ctaLabel ?? "",
        ctaUrl: existing.ctaUrl ?? "",
        targetRole: existing.targetRole,
        placement: existing.placement,
        priority: String(existing.priority),
        startsAt: existing.startsAt.slice(0, 16),
        endsAt: existing.endsAt.slice(0, 16),
        promoCodeId: existing.promoCodeId ?? "",
      });
    }
  }, [existing]);

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.title.trim() || !form.startsAt || !form.endsAt) {
      setError("Title, start date, and end date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        priority: Number(form.priority) || 0,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        promoCodeId: form.promoCodeId || undefined,
        description: form.description || undefined,
        imageUrl: form.imageUrl || undefined,
        ctaLabel: form.ctaLabel || undefined,
        ctaUrl: form.ctaUrl || undefined,
      };

      const res = await fetch(
        isEdit ? `/api/promotions/admin/${existing.id}` : "/api/promotions/admin",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.formErrors?.[0] ?? "Failed to save. Please try again.");
        return;
      }

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-label={isEdit ? "Edit promotion" : "New promotion"}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Edit Promotion" : "New Promotion"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <Field label="Title *">
            <input className="f-input" value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} />
          </Field>
          <Field label="Description">
            <textarea className="f-input f-textarea" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={500} rows={2} />
          </Field>
          <Field label="Image URL">
            <input className="f-input" type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." />
          </Field>
          <div className="f-row">
            <Field label="CTA button label">
              <input className="f-input" value={form.ctaLabel} onChange={(e) => set("ctaLabel", e.target.value)} maxLength={50} placeholder="Claim now" />
            </Field>
            <Field label="CTA URL">
              <input className="f-input" type="url" value={form.ctaUrl} onChange={(e) => set("ctaUrl", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
          <div className="f-row">
            <Field label="Target audience">
              <select className="f-input" value={form.targetRole} onChange={(e) => set("targetRole", e.target.value)}>
                <option value="ALL">Everyone</option>
                <option value="CLIENT">Clients only</option>
                <option value="RIDER">Riders only</option>
              </select>
            </Field>
            <Field label="Placement">
              <select className="f-input" value={form.placement} onChange={(e) => set("placement", e.target.value)}>
                <option value="HOME">Home</option>
                <option value="BOOKING">Booking</option>
                <option value="PAYMENT">Payment</option>
                <option value="EARNINGS">Earnings</option>
                <option value="PROFILE">Profile</option>
              </select>
            </Field>
            <Field label="Priority">
              <input className="f-input" type="number" min={0} value={form.priority} onChange={(e) => set("priority", e.target.value)} />
            </Field>
          </div>
          <div className="f-row">
            <Field label="Starts at *">
              <input className="f-input" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
            </Field>
            <Field label="Ends at *">
              <input className="f-input" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
            </Field>
          </div>
          <Field label="Linked promo code ID (optional)">
            <input className="f-input" value={form.promoCodeId} onChange={(e) => set("promoCodeId", e.target.value)} placeholder="Leave blank to skip" />
          </Field>

          {error && <p className="f-error" role="alert">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="f-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="f-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create promotion"}
          </button>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="f-field">
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

const css = `
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 16px;
  }
  .modal {
    background: var(--color-surface, #fff);
    border-radius: 16px; width: 100%; max-width: 600px;
    max-height: 90vh; display: flex; flex-direction: column;
    box-shadow: 0 25px 50px rgba(0,0,0,0.15);
  }
  .modal-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 20px 24px 0; flex-shrink: 0;
  }
  .modal-title { font-size: 1.1rem; font-weight: 800; margin: 0; color: var(--color-text,#111827); }
  .modal-close {
    background: none; border: none; cursor: pointer; padding: 6px;
    color: var(--color-text-muted, #6b7280); border-radius: 6px;
    display: flex; align-items: center; transition: background 0.15s;
  }
  .modal-close:hover { background: var(--color-surface-alt, #f3f4f6); }
  .modal-body { padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
  .modal-footer {
    display: flex; justify-content: flex-end; gap: 10px;
    padding: 16px 24px; border-top: 1px solid var(--color-border,#e5e7eb);
    flex-shrink: 0;
  }
  .f-row { display: flex; gap: 12px; }
  .f-row .f-field { flex: 1; min-width: 0; }
  .f-field { display: flex; flex-direction: column; gap: 5px; }
  .f-label { font-size: 0.78rem; font-weight: 600; color: var(--color-text,#111827); }
  .f-input {
    border: 1.5px solid var(--color-border, #e5e7eb);
    border-radius: 8px; padding: 8px 10px;
    font-size: 0.875rem; color: var(--color-text, #111827);
    background: var(--color-surface, #fff);
    width: 100%; box-sizing: border-box;
    transition: border-color 0.15s; outline: none;
  }
  .f-input:focus { border-color: var(--color-accent, #f97316); }
  .f-textarea { resize: vertical; font-family: inherit; }
  .f-error {
    background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px;
    padding: 10px 14px; font-size: 0.82rem; color: #dc2626; margin: 0;
  }
  .f-cancel-btn {
    background: var(--color-surface-alt, #f3f4f6);
    color: var(--color-text, #111827); border: none; border-radius: 10px;
    padding: 9px 20px; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; transition: background 0.15s;
  }
  .f-cancel-btn:hover { background: #e5e7eb; }
  .f-save-btn {
    background: var(--color-accent, #f97316);
    color: #fff; border: none; border-radius: 10px;
    padding: 9px 20px; font-size: 0.875rem; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s;
  }
  .f-save-btn:disabled { opacity: 0.5; cursor: default; }
  .f-save-btn:hover:not(:disabled) { opacity: 0.9; }
`;
