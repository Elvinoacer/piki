"use client";
// components/safety/HelmetChecklist.tsx
// Compliance nudge shown at rider onboarding. Not hardware-enforced.

import { useState } from "react";

const CHECKLIST_ITEMS = [
  { id: "own-helmet", label: "I own a helmet in good condition" },
  { id: "client-helmet", label: "I carry a passenger helmet for clients" },
  { id: "reflective", label: "My jacket has reflective strips or I own a reflective vest" },
  { id: "understand", label: "I understand wearing a helmet is required by Kenyan law (Traffic Act Cap 403)" },
] as const;

interface HelmetChecklistProps {
  onComplete: () => void;
}

export function HelmetChecklist({ onComplete }: HelmetChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allChecked = CHECKLIST_ITEMS.every((item) => checked.has(item.id));

  return (
    <section className="helmet-checklist" aria-label="Helmet and safety compliance">
      <div className="helmet-checklist__icon" aria-hidden="true">🪖</div>
      <h2 className="helmet-checklist__title">Safety gear check</h2>
      <p className="helmet-checklist__desc">
        Confirm your gear before you go live. This keeps you, and your clients, safe.
      </p>

      <ul className="helmet-checklist__list" role="group">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.id} className="helmet-checklist__item">
            <label className="helmet-checklist__label">
              <input
                type="checkbox"
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
                aria-label={item.label}
              />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        className="helmet-checklist__confirm"
        onClick={onComplete}
        disabled={!allChecked}
        aria-disabled={!allChecked}
      >
        Confirm & continue
      </button>

      {!allChecked && (
        <p className="helmet-checklist__hint" aria-live="polite">
          Check all boxes to continue.
        </p>
      )}
    </section>
  );
}
