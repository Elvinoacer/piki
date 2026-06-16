// src/components/sacco/SaccoSettingsForm.tsx
"use client";

import { useState, useTransition } from "react";
import { updateSaccoSettings } from "@/lib/sacco/actions";
import type { PayoutManager } from "@/types/sacco";

interface InitialValues {
  name: string;
  registrationNo: string;
  contactPhone: string;
  contactEmail: string;
  platformCommissionPct: string;
  saccoCommissionPct: string;
  payoutManagedBy: PayoutManager;
}

interface Props {
  saccoId: string;
  initialValues: InitialValues;
}

export default function SaccoSettingsForm({ saccoId, initialValues }: Props) {
  const [values, setValues] = useState(initialValues);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(k: keyof InitialValues, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateSaccoSettings(saccoId, {
          name: values.name,
          contactPhone: values.contactPhone,
          contactEmail: values.contactEmail,
          platformCommissionPct: parseFloat(values.platformCommissionPct),
          saccoCommissionPct: parseFloat(values.saccoCommissionPct),
          payoutManagedBy: values.payoutManagedBy,
        });
        setSaved(true);
      } catch (e: any) {
        setError(e.message ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Organisation info */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Organisation Info</h2>

        <Field label="SACCO Name">
          <input
            type="text"
            value={values.name}
            onChange={(e) => update("name", e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Registration Number (optional)">
          <input
            type="text"
            value={values.registrationNo}
            disabled
            className={`${INPUT} bg-gray-50 text-gray-400 cursor-not-allowed`}
          />
        </Field>

        <Field label="Contact Phone">
          <input
            type="tel"
            value={values.contactPhone}
            onChange={(e) => update("contactPhone", e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="Contact Email">
          <input
            type="email"
            value={values.contactEmail}
            onChange={(e) => update("contactEmail", e.target.value)}
            className={INPUT}
          />
        </Field>
      </section>

      {/* Commission defaults */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            Default Commission
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Applied fleet-wide unless a per-rider override is set.
          </p>
        </div>

        <Field label="Platform commission %">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={values.platformCommissionPct}
            onChange={(e) => update("platformCommissionPct", e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label="SACCO commission %">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={values.saccoCommissionPct}
            onChange={(e) => update("saccoCommissionPct", e.target.value)}
            className={INPUT}
          />
        </Field>

        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
          Rider takes home{" "}
          <strong className="text-gray-800">
            {Math.max(
              0,
              100 -
                parseFloat(values.platformCommissionPct || "0") -
                parseFloat(values.saccoCommissionPct || "0")
            ).toFixed(1)}
            %
          </strong>{" "}
          of each completed fare.
        </div>
      </section>

      {/* Payout model */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <h2 className="text-sm font-semibold text-gray-800">Payout Management</h2>
        {(["PLATFORM", "SACCO"] as const).map((opt) => (
          <label
            key={opt}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
              values.payoutManagedBy === opt
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-100 hover:border-gray-200"
            }`}
          >
            <input
              type="radio"
              value={opt}
              checked={values.payoutManagedBy === opt}
              onChange={() => update("payoutManagedBy", opt)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {opt === "PLATFORM" ? "Pikii handles payouts" : "SACCO manages payouts"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {opt === "PLATFORM"
                  ? "Pikii automatically disburses to riders via M-Pesa B2C based on your commission config."
                  : "Your SACCO admin initiates batch disbursements manually from this dashboard."}
              </p>
            </div>
          </label>
        ))}
      </section>

      {/* Save */}
      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}
      {saved && (
        <p className="text-sm text-emerald-600 font-medium">
          ✓ Settings saved.
        </p>
      )}
      <button
        disabled={isPending}
        onClick={handleSave}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl transition disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save Settings"}
      </button>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

const INPUT =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
