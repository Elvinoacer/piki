"use client";

// components/compliance/KraExportPanel.tsx
// Lets riders download KRA-ready transaction records.
// Supports monthly / quarterly / annual periods in CSV or PDF.

import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { Download, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExportPeriod, ExportFormat } from "@/lib/compliance/kra";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const QUARTERS = ["Q1 (Jan–Mar)", "Q2 (Apr–Jun)", "Q3 (Jul–Sep)", "Q4 (Oct–Dec)"];

export function KraExportPanel() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<ExportPeriod>("monthly");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleExport = async () => {
    setStatus("loading");
    try {
      const body = {
        period,
        year,
        month: period === "monthly" ? month : undefined,
        quarter: period === "quarterly" ? quarter : undefined,
        format,
      };
      const res = await fetch("/api/compliance/kra-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      if (format === "csv") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pikii-kra-${period}-${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // PDF: pass data to print/PDF generation
        const data = await res.json();
        console.info("[KRA PDF] data ready:", data);
        // TODO: send to react-pdf or server-side PDF endpoint
      }
      setStatus("success");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <section aria-label={t("kra_title")} className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">{t("kra_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("kra_subtitle")}</p>
      </div>

      {/* Period selector */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">{t("kra_period_label")}</legend>
        <div className="flex gap-2">
          {(["monthly", "quarterly", "annual"] as ExportPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                period === p
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {t(`kra_period_${p}` as any)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Year */}
      <div className="space-y-1.5">
        <label htmlFor="kra-year" className="text-sm font-medium text-foreground">
          Year
        </label>
        <select
          id="kra-year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Month (monthly only) */}
      {period === "monthly" && (
        <div className="space-y-1.5">
          <label htmlFor="kra-month" className="text-sm font-medium text-foreground">
            Month
          </label>
          <select
            id="kra-month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      )}

      {/* Quarter (quarterly only) */}
      {period === "quarterly" && (
        <div className="space-y-1.5">
          <label htmlFor="kra-quarter" className="text-sm font-medium text-foreground">
            Quarter
          </label>
          <select
            id="kra-quarter"
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {QUARTERS.map((q, i) => (
              <option key={q} value={i + 1}>{q}</option>
            ))}
          </select>
        </div>
      )}

      {/* Format */}
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium text-foreground">{t("kra_format_label")}</legend>
        <div className="flex gap-2">
          {(["csv", "pdf"] as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                format === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              {t(`kra_format_${f}` as any)}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Export CTA */}
      <button
        onClick={handleExport}
        disabled={status === "loading"}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium",
          "bg-primary text-primary-foreground transition-colors hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-wait disabled:opacity-60"
        )}
      >
        <Download className="h-4 w-4" />
        {status === "loading" ? t("loading") : t("kra_export_cta")}
      </button>

      {/* Status messages */}
      {status === "success" && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <Download className="h-4 w-4" />
          {t("kra_export_success")}
        </p>
      )}
      {status === "error" && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {t("kra_export_error")}
        </p>
      )}

      {/* Legal disclaimer */}
      <p className="text-xs text-muted-foreground">{t("kra_disclaimer")}</p>
    </section>
  );
}
