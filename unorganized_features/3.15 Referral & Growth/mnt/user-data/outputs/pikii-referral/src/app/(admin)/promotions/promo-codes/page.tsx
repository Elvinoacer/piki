// src/app/(admin)/promotions/promo-codes/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback } from "react";
import type { PromoCode } from "@/types/referral";
import { Plus } from "lucide-react";
import { PromoCodeFormModal } from "./PromoCodeFormModal";

export default function AdminPromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promotions/promo-codes");
      const data = await res.json();
      setCodes(data.codes ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // TODO: toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();

  return (
    <div className="apc-wrap">
      <div className="apc-header">
        <div>
          <h1 className="apc-title">Promo Codes</h1>
          <p className="apc-sub">{total} codes created</p>
        </div>
        <button className="apc-create-btn" onClick={() => setShowForm(true)}>
          <Plus size={16} /> New Code
        </button>
      </div>

      {loading ? (
        <div className="apc-loading">Loading…</div>
      ) : codes.length === 0 ? (
        <div className="apc-empty">No promo codes yet.</div>
      ) : (
        <div className="apc-table-wrap">
          <table className="apc-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Uses</th>
                <th>Valid period</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const expired = new Date(c.endsAt) < now;
                const notStarted = new Date(c.startsAt) > now;
                const live = !expired && !notStarted && c.isActive;

                return (
                  <tr key={c.id}>
                    <td>
                      <span className="apc-code">{c.code}</span>
                      {c.description && <div className="apc-desc">{c.description}</div>}
                    </td>
                    <td>
                      {c.discountType === "PERCENTAGE"
                        ? `${c.discountValue}%`
                        : `KES ${Number(c.discountValue).toLocaleString()}`}
                      {c.maxDiscount && (
                        <div className="apc-note">max KES {Number(c.maxDiscount).toLocaleString()}</div>
                      )}
                      {c.minFare && (
                        <div className="apc-note">min fare KES {Number(c.minFare).toLocaleString()}</div>
                      )}
                    </td>
                    <td>
                      {c.usedCount}
                      {c.maxUses ? ` / ${c.maxUses}` : ""}
                      <div className="apc-note">{c.perUserLimit}× per user</div>
                    </td>
                    <td className="apc-dates">
                      <span>{new Date(c.startsAt).toLocaleDateString("en-KE")}</span>
                      <span>→</span>
                      <span>{new Date(c.endsAt).toLocaleDateString("en-KE")}</span>
                    </td>
                    <td>
                      <span className="apc-badge">{c.targetRole}</span>
                    </td>
                    <td>
                      <span className={`apc-status ${live ? "apc-status--live" : "apc-status--off"}`}>
                        {expired ? "Expired" : notStarted ? "Scheduled" : live ? "Live" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PromoCodeFormModal
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .apc-wrap { padding: 28px 24px; max-width: 1000px; }
  .apc-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
  .apc-title { font-size:1.4rem; font-weight:800; color:var(--color-text,#111827); margin:0 0 2px; }
  .apc-sub { font-size:0.82rem; color:var(--color-text-muted,#6b7280); margin:0; }
  .apc-create-btn {
    display:flex; align-items:center; gap:6px;
    background:var(--color-accent,#f97316); color:#fff;
    border:none; border-radius:10px; padding:9px 18px;
    font-size:0.875rem; font-weight:700; cursor:pointer; transition:opacity 0.15s;
  }
  .apc-create-btn:hover { opacity:0.9; }
  .apc-loading, .apc-empty { text-align:center; padding:60px; color:var(--color-text-muted,#6b7280); font-size:0.9rem; }
  .apc-table-wrap { overflow-x:auto; }
  .apc-table { width:100%; border-collapse:collapse; font-size:0.85rem; color:var(--color-text,#111827); }
  .apc-table th {
    text-align:left; padding:10px 12px;
    font-size:0.72rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em;
    color:var(--color-text-muted,#6b7280); border-bottom:2px solid var(--color-border,#e5e7eb);
  }
  .apc-table td { padding:12px; border-bottom:1px solid var(--color-border,#e5e7eb); vertical-align:middle; }
  .apc-code { font-family:ui-monospace,monospace; font-weight:700; font-size:0.92rem; letter-spacing:0.05em; }
  .apc-desc, .apc-note { font-size:0.72rem; color:var(--color-text-muted,#6b7280); margin-top:2px; }
  .apc-dates { display:flex; align-items:center; gap:4px; font-size:0.78rem; white-space:nowrap; }
  .apc-badge {
    background:var(--color-surface-alt,#f3f4f6); border-radius:6px;
    padding:2px 8px; font-size:0.72rem; font-weight:600;
  }
  .apc-status {
    display:inline-block; border-radius:6px; padding:2px 10px;
    font-size:0.78rem; font-weight:700;
  }
  .apc-status--live { background:#dcfce7; color:#16a34a; }
  .apc-status--off { background:#f3f4f6; color:#6b7280; }
`;
