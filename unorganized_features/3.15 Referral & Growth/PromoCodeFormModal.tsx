// src/app/(admin)/promotions/PromoCodeFormModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function PromoCodeFormModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FLAT",
    discountValue: "",
    minFare: "",
    maxDiscount: "",
    maxUses: "",
    perUserLimit: "1",
    targetRole: "CLIENT",
    startsAt: "",
    endsAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.code.trim() || !form.discountValue || !form.startsAt || !form.endsAt) {
      setError("Code, discount, start date, and end date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minFare: form.minFare ? Number(form.minFare) : undefined,
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        perUserLimit: Number(form.perUserLimit) || 1,
        targetRole: form.targetRole,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      };
      const res = await fetch("/api/promotions/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error ?? "Failed to create code.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal aria-label="Create promo code">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">New Promo Code</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="f-row">
            <Field label="Code *">
              <input
                className="f-input f-mono"
                value={form.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="PIKII20"
                maxLength={20}
              />
            </Field>
            <Field label="Target">
              <select className="f-input" value={form.targetRole} onChange={(e) => set("targetRole", e.target.value)}>
                <option value="CLIENT">Clients</option>
                <option value="RIDER">Riders</option>
                <option value="ALL">Everyone</option>
              </select>
            </Field>
          </div>
          <Field label="Description (optional)">
            <input className="f-input" value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={200} />
          </Field>
          <div className="f-row">
            <Field label="Discount type *">
              <select className="f-input" value={form.discountType} onChange={(e) => set("discountType", e.target.value as "PERCENTAGE" | "FLAT")}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FLAT">Flat (KES)</option>
              </select>
            </Field>
            <Field label="Discount value *">
              <input className="f-input" type="number" min={0} step={0.01} value={form.discountValue} onChange={(e) => set("discountValue", e.target.value)}
                placeholder={form.discountType === "PERCENTAGE" ? "20" : "50"} />
            </Field>
          </div>
          <div className="f-row">
            <Field label="Min fare (KES)">
              <input className="f-input" type="number" min={0} value={form.minFare} onChange={(e) => set("minFare", e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Max discount (KES)">
              <input className="f-input" type="number" min={0} value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} placeholder="Optional" />
            </Field>
          </div>
          <div className="f-row">
            <Field label="Total uses limit">
              <input className="f-input" type="number" min={1} value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} placeholder="Unlimited" />
            </Field>
            <Field label="Per-user limit">
              <input className="f-input" type="number" min={1} value={form.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} />
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
          {error && <p className="f-error" role="alert">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="f-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="f-save-btn" onClick={save} disabled={saving}>
            {saving ? "Creating…" : "Create code"}
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
  .modal-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:16px; }
  .modal { background:var(--color-surface,#fff); border-radius:16px; width:100%; max-width:560px; max-height:90vh; display:flex; flex-direction:column; box-shadow:0 25px 50px rgba(0,0,0,0.15); }
  .modal-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px 0; flex-shrink:0; }
  .modal-title { font-size:1.1rem; font-weight:800; margin:0; color:var(--color-text,#111827); }
  .modal-close { background:none; border:none; cursor:pointer; padding:6px; color:var(--color-text-muted,#6b7280); border-radius:6px; display:flex; }
  .modal-close:hover { background:var(--color-surface-alt,#f3f4f6); }
  .modal-body { padding:20px 24px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
  .modal-footer { display:flex; justify-content:flex-end; gap:10px; padding:16px 24px; border-top:1px solid var(--color-border,#e5e7eb); flex-shrink:0; }
  .f-row { display:flex; gap:12px; }
  .f-row .f-field { flex:1; min-width:0; }
  .f-field { display:flex; flex-direction:column; gap:5px; }
  .f-label { font-size:0.78rem; font-weight:600; color:var(--color-text,#111827); }
  .f-input { border:1.5px solid var(--color-border,#e5e7eb); border-radius:8px; padding:8px 10px; font-size:0.875rem; color:var(--color-text,#111827); background:var(--color-surface,#fff); width:100%; box-sizing:border-box; outline:none; transition:border-color 0.15s; }
  .f-input:focus { border-color:var(--color-accent,#f97316); }
  .f-mono { font-family:ui-monospace,monospace; font-weight:700; letter-spacing:0.06em; }
  .f-error { background:#fef2f2; border:1px solid #fca5a5; border-radius:8px; padding:10px 14px; font-size:0.82rem; color:#dc2626; margin:0; }
  .f-cancel-btn { background:var(--color-surface-alt,#f3f4f6); color:var(--color-text,#111827); border:none; border-radius:10px; padding:9px 20px; font-size:0.875rem; font-weight:600; cursor:pointer; }
  .f-cancel-btn:hover { background:#e5e7eb; }
  .f-save-btn { background:var(--color-accent,#f97316); color:#fff; border:none; border-radius:10px; padding:9px 20px; font-size:0.875rem; font-weight:700; cursor:pointer; transition:opacity 0.15s; }
  .f-save-btn:disabled { opacity:0.5; cursor:default; }
  .f-save-btn:hover:not(:disabled) { opacity:0.9; }
`;
