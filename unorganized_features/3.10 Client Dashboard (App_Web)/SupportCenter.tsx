"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Plus, Loader2, MessageSquare } from "lucide-react";
import type { SupportTicket, CreateTicketPayload } from "@/types/client-dashboard";
import { createSupportTicket } from "@/app/(client)/dashboard/actions";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: CreateTicketPayload["category"]; label: string }[] = [
  { value: "PAYMENT", label: "Payment issue" },
  { value: "RIDER", label: "Rider conduct" },
  { value: "TRIP", label: "Trip problem" },
  { value: "ACCOUNT", label: "Account help" },
  { value: "OTHER", label: "Other" },
];

const STATUS_COLORS: Record<SupportTicket["status"], string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
};

interface Props {
  tickets: SupportTicket[];
}

export function SupportCenter({ tickets }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CreateTicketPayload["category"]>("OTHER");
  const [localTickets, setLocalTickets] = useState(tickets);
  const [isSubmitting, startSubmit] = useTransition();

  const handleSubmit = () => {
    if (!subject.trim() || !description.trim()) return;
    startSubmit(async () => {
      const { ticketId } = await createSupportTicket({ subject, description, category });
      setLocalTickets((prev) => [
        {
          id: ticketId,
          subject,
          status: "OPEN",
          createdAt: new Date().toISOString(),
          lastReplyAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSubject("");
      setDescription("");
      setShowForm(false);
    });
  };

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso)
    );

  return (
    <div className="space-y-6">
      {/* New ticket CTA */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-4 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Plus size={16} />
          Submit a new request
        </span>
        <ChevronRight size={16} className={cn("transition-transform", showForm && "rotate-90")} />
      </button>

      {/* New ticket form */}
      {showForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-900">New support request</h3>

          {/* Category */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                  category === value
                    ? "border-orange-400 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <input
              placeholder="Subject"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <textarea
              rows={4}
              placeholder="Describe your issue in detail…"
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!subject.trim() || !description.trim() || isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Submit"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Your tickets</h3>

        {localTickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquare size={28} className="text-gray-200" />
            <p className="text-sm text-gray-500">No tickets yet</p>
          </div>
        ) : (
          localTickets.map((ticket) => (
            <div
              key={ticket.id}
              className="flex items-start justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex-1 min-w-0 pr-3">
                <p className="truncate text-sm font-semibold text-gray-900">{ticket.subject}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Opened {formatDate(ticket.createdAt)}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  STATUS_COLORS[ticket.status]
                )}
              >
                {ticket.status.replace("_", " ")}
              </span>
            </div>
          ))
        )}
      </div>

      {/* FAQ quick links */}
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-2.5">
        <p className="text-sm font-semibold text-gray-900">Common questions</p>
        {[
          "How do I cancel a ride?",
          "When will I get my M-Pesa refund?",
          "How do I report a rider?",
          "How does the wallet work?",
        ].map((q) => (
          <button
            key={q}
            className="flex w-full items-center justify-between text-left text-sm text-gray-600 hover:text-orange-600 transition-colors"
          >
            <span>{q}</span>
            <ChevronRight size={14} className="text-gray-300" />
          </button>
        ))}
      </div>
    </div>
  );
}
