// src/app/(admin)/promotions/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState, useCallback } from "react";
import type { Promotion } from "@/types/referral";
import { Plus, Pencil, Trash2, BarChart2, ToggleLeft, ToggleRight } from "lucide-react";
import { PromotionFormModal } from "./PromotionFormModal";

const PLACEMENT_LABELS: Record<string, string> = {
  HOME: "Home",
  BOOKING: "Booking",
  PAYMENT: "Payment",
  EARNINGS: "Earnings",
  PROFILE: "Profile",
};

const TARGET_LABELS: Record<string, string> = {
  ALL: "Everyone",
  CLIENT: "Clients",
  RIDER: "Riders",
};

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/promotions/admin");
      const data = await res.json();
      setPromotions(data.promotions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // TODO: toast
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(p: Promotion) {
    await fetch(`/api/promotions/admin/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function remove(p: Promotion) {
    if (!confirm(`Deactivate "${p.title}"?`)) return;
    await fetch(`/api/promotions/admin/${p.id}`, { method: "DELETE" });
    load();
  }

  function openCreate() { setEditing(null); setShowForm(true); }
  function openEdit(p: Promotion) { setEditing(p); setShowForm(true); }

  return (
    <div className="ap-wrap">
      {/* Header */}
      <div className="ap-header">
        <div>
          <h1 className="ap-title">Promotions</h1>
          <p className="ap-sub">{total} total banners</p>
        </div>
        <button className="ap-create-btn" onClick={openCreate}>
          <Plus size={16} />
          New Promotion
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="ap-loading">Loading…</div>
      ) : promotions.length === 0 ? (
        <div className="ap-empty">No promotions yet. Create one above.</div>
      ) : (
        <div className="ap-table-wrap">
          <table className="ap-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Placement</th>
                <th>Target</th>
                <th>Dates</th>
                <th>Stats</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "ap-row--inactive"}>
                  <td>
                    <div className="ap-promo-title">{p.title}</div>
                    {p.promoCode && (
                      <span className="ap-code-tag">🏷 {p.promoCode.code}</span>
                    )}
                  </td>
                  <td>
                    <span className="ap-badge ap-badge--placement">
                      {PLACEMENT_LABELS[p.placement] ?? p.placement}
                    </span>
                  </td>
                  <td>
                    <span className="ap-badge">{TARGET_LABELS[p.targetRole] ?? p.targetRole}</span>
                  </td>
                  <td className="ap-dates">
                    <span>{new Date(p.startsAt).toLocaleDateString("en-KE")}</span>
                    <span className="ap-date-sep">→</span>
                    <span>{new Date(p.endsAt).toLocaleDateString("en-KE")}</span>
                  </td>
                  <td>
                    <div className="ap-stats">
                      <span title="Impressions">👁 {p.impressions.toLocaleString()}</span>
                      <span title="Clicks">🖱 {p.clicks.toLocaleString()}</span>
                      {p.impressions > 0 && (
                        <span className="ap-ctr" title="Click-through rate">
                          <BarChart2 size={11} />
                          {((p.clicks / p.impressions) * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`ap-toggle ${p.isActive ? "ap-toggle--on" : "ap-toggle--off"}`}
                      onClick={() => toggleActive(p)}
                      aria-label={p.isActive ? "Deactivate promotion" : "Activate promotion"}
                    >
                      {p.isActive ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      {p.isActive ? "Live" : "Off"}
                    </button>
                  </td>
                  <td>
                    <div className="ap-actions">
                      <button
                        className="ap-icon-btn"
                        onClick={() => openEdit(p)}
                        aria-label="Edit promotion"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="ap-icon-btn ap-icon-btn--danger"
                        onClick={() => remove(p)}
                        aria-label="Delete promotion"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <PromotionFormModal
          existing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .ap-wrap { padding: 28px 24px; max-width: 1100px; }
  .ap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .ap-title { font-size: 1.4rem; font-weight: 800; color: var(--color-text,#111827); margin:0 0 2px; }
  .ap-sub { font-size: 0.82rem; color: var(--color-text-muted,#6b7280); margin: 0; }
  .ap-create-btn {
    display: flex; align-items: center; gap: 6px;
    background: var(--color-accent, #f97316);
    color: #fff; border: none; border-radius: 10px;
    padding: 9px 18px; font-size: 0.875rem; font-weight: 700;
    cursor: pointer; transition: opacity 0.15s;
  }
  .ap-create-btn:hover { opacity: 0.9; }
  .ap-loading, .ap-empty {
    text-align: center; padding: 60px 20px;
    color: var(--color-text-muted, #6b7280); font-size: 0.9rem;
  }
  .ap-table-wrap { overflow-x: auto; }
  .ap-table {
    width: 100%; border-collapse: collapse; font-size: 0.85rem;
    color: var(--color-text, #111827);
  }
  .ap-table th {
    text-align: left; padding: 10px 12px;
    font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--color-text-muted,#6b7280);
    border-bottom: 2px solid var(--color-border, #e5e7eb);
  }
  .ap-table td {
    padding: 12px 12px; border-bottom: 1px solid var(--color-border, #e5e7eb);
    vertical-align: middle;
  }
  .ap-row--inactive td { opacity: 0.5; }
  .ap-promo-title { font-weight: 600; }
  .ap-code-tag { font-size: 0.72rem; color: var(--color-text-muted,#6b7280); }
  .ap-badge {
    background: var(--color-surface-alt,#f3f4f6);
    border-radius: 6px; padding: 2px 8px;
    font-size: 0.72rem; font-weight: 600;
    color: var(--color-text,#111827);
  }
  .ap-badge--placement { background: #eff6ff; color: #1d4ed8; }
  .ap-dates { display: flex; align-items: center; gap: 4px; white-space: nowrap; font-size: 0.78rem; }
  .ap-date-sep { color: var(--color-text-muted, #9ca3af); }
  .ap-stats { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; }
  .ap-ctr { display: flex; align-items: center; gap: 3px; color: #6b7280; }
  .ap-toggle {
    display: flex; align-items: center; gap: 4px;
    background: none; border: none; cursor: pointer;
    font-size: 0.78rem; font-weight: 700;
    border-radius: 6px; padding: 4px 8px;
    transition: background 0.15s;
  }
  .ap-toggle--on { color: #10b981; }
  .ap-toggle--off { color: #9ca3af; }
  .ap-toggle:hover { background: var(--color-surface-alt, #f3f4f6); }
  .ap-actions { display: flex; gap: 4px; }
  .ap-icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--color-text-muted, #6b7280); padding: 6px;
    border-radius: 6px; display: flex; align-items: center;
    transition: background 0.15s, color 0.15s;
  }
  .ap-icon-btn:hover { background: var(--color-surface-alt,#f3f4f6); color: var(--color-text,#111827); }
  .ap-icon-btn--danger:hover { background: #fef2f2; color: #ef4444; }
`;
