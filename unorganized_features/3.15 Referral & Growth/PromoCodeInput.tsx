// src/components/promotions/PromoCodeInput.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState } from "react";
import { Tag, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface Props {
  fareAmount: number;
  onApply: (discount: number, code: string) => void;
  onRemove: () => void;
}

type State = "idle" | "loading" | "valid" | "error";

export function PromoCodeInput({ fareAmount, onApply, onRemove }: Props) {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);

  async function validate() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setState("loading");
    setMessage("");
    try {
      const res = await fetch("/api/referral/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, fareAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setState("error");
        setMessage(data.error ?? "Invalid code.");
        return;
      }
      setState("valid");
      setMessage(`-KES ${data.discount.toLocaleString()} off!`);
      setAppliedCode(trimmed);
      setDiscount(data.discount);
      onApply(data.discount, trimmed);
    } catch {
      setState("error");
      setMessage("Could not check code. Try again.");
    }
  }

  function remove() {
    setCode("");
    setState("idle");
    setMessage("");
    setAppliedCode(null);
    setDiscount(0);
    onRemove();
  }

  if (state === "valid" && appliedCode) {
    return (
      <div className="pci-applied" role="status" aria-live="polite">
        <CheckCircle2 size={16} className="pci-ok-icon" aria-hidden />
        <span className="pci-applied-text">
          <strong>{appliedCode}</strong> applied — KES {discount.toLocaleString()} off
        </span>
        <button className="pci-remove-btn" onClick={remove} aria-label="Remove promo code">
          ✕
        </button>
        <style>{css}</style>
      </div>
    );
  }

  return (
    <div className="pci-wrap">
      <div className="pci-row">
        <Tag size={16} className="pci-tag-icon" aria-hidden />
        <input
          className="pci-input"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (state !== "idle") { setState("idle"); setMessage(""); }
          }}
          onKeyDown={(e) => e.key === "Enter" && validate()}
          placeholder="Promo code"
          aria-label="Enter a promo code"
          maxLength={20}
          disabled={state === "loading"}
        />
        <button
          className="pci-apply-btn"
          onClick={validate}
          disabled={!code.trim() || state === "loading"}
          aria-label="Apply promo code"
        >
          {state === "loading" ? <Loader2 size={14} className="pci-spin" /> : "Apply"}
        </button>
      </div>
      {message && (
        <p
          className={`pci-msg ${state === "error" ? "pci-msg--error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {state === "error" && <XCircle size={13} aria-hidden />}
          {message}
        </p>
      )}
      <style>{css}</style>
    </div>
  );
}

const css = `
  .pci-wrap { display: flex; flex-direction: column; gap: 6px; }
  .pci-row {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1.5px solid var(--color-border, #e5e7eb);
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-surface, #fff);
    transition: border-color 0.15s;
  }
  .pci-row:focus-within { border-color: var(--color-accent, #f97316); }
  .pci-tag-icon { color: var(--color-text-muted, #9ca3af); margin: 0 10px; flex-shrink: 0; }
  .pci-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--color-text, #111827);
    padding: 10px 4px;
    min-width: 0;
  }
  .pci-input::placeholder { font-weight: 400; letter-spacing: 0; color: var(--color-text-muted, #9ca3af); }
  .pci-apply-btn {
    background: var(--color-accent, #f97316);
    color: #fff;
    border: none;
    padding: 0 16px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    height: 100%;
    min-height: 42px;
    transition: opacity 0.15s;
    display: flex;
    align-items: center;
  }
  .pci-apply-btn:disabled { opacity: 0.5; cursor: default; }
  .pci-apply-btn:hover:not(:disabled) { opacity: 0.88; }
  .pci-spin { animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pci-msg {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.78rem;
    color: #10b981;
    padding: 0 4px;
  }
  .pci-msg--error { color: #ef4444; }
  .pci-applied {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f0fdf4;
    border: 1.5px solid #bbf7d0;
    border-radius: 10px;
    padding: 10px 14px;
  }
  .pci-ok-icon { color: #10b981; flex-shrink: 0; }
  .pci-applied-text { flex: 1; font-size: 0.85rem; color: #111827; }
  .pci-remove-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    font-size: 0.8rem;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .pci-remove-btn:hover { background: #dcfce7; color: #111827; }
`;
