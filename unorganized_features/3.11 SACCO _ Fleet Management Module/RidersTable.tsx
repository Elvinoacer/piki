// src/components/sacco/RidersTable.tsx
"use client";

import { useState, useTransition } from "react";
import type { SaccoRiderDTO, ZoneDTO } from "@/types/sacco";
import {
  setCommissionRule,
  assignRidersToZone,
  removeRiderFromSacco,
} from "@/lib/sacco/actions";
import {
  MapPin,
  Percent,
  UserMinus,
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

interface Props {
  initialRiders: SaccoRiderDTO[];
  zones: ZoneDTO[];
  saccoId: string;
}

type ModalType = "commission" | "zone" | "remove" | null;

export default function RidersTable({ initialRiders, zones, saccoId }: Props) {
  const [riders] = useState(initialRiders);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalType>(null);
  const [activeRider, setActiveRider] = useState<SaccoRiderDTO | null>(null);
  const [isPending, startTransition] = useTransition();

  // Commission form state
  const [platformPct, setPlatformPct] = useState("10");
  const [saccoPct, setSaccoPct] = useState("5");
  const [commNote, setCommNote] = useState("");

  // Zone form state
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id ?? "");

  const filtered = riders.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.phone.includes(search) ||
      r.vehiclePlate?.toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCommission(rider: SaccoRiderDTO) {
    setActiveRider(rider);
    setPlatformPct(rider.commissionOverride?.platformCommissionPct ?? "10");
    setSaccoPct(rider.commissionOverride?.saccoCommissionPct ?? "5");
    setCommNote("");
    setModal("commission");
  }

  function openZone(rider: SaccoRiderDTO) {
    setActiveRider(rider);
    setSelectedZoneId(zones[0]?.id ?? "");
    setModal("zone");
  }

  function openRemove(rider: SaccoRiderDTO) {
    setActiveRider(rider);
    setModal("remove");
  }

  function closeModal() {
    setModal(null);
    setActiveRider(null);
  }

  function handleSetCommission() {
    if (!activeRider) return;
    startTransition(async () => {
      await setCommissionRule(saccoId, {
        riderProfileId: activeRider.id,
        platformCommissionPct: parseFloat(platformPct),
        saccoCommissionPct: parseFloat(saccoPct),
        note: commNote || null,
      });
      closeModal();
    });
  }

  function handleBulkCommission() {
    startTransition(async () => {
      await setCommissionRule(saccoId, {
        riderProfileId: null, // fleet-wide
        platformCommissionPct: parseFloat(platformPct),
        saccoCommissionPct: parseFloat(saccoPct),
        note: commNote || null,
      });
      closeModal();
    });
  }

  function handleAssignZone() {
    if (!activeRider) return;
    startTransition(async () => {
      await assignRidersToZone(saccoId, {
        riderProfileIds: [activeRider.id],
        zoneId: selectedZoneId,
      });
      closeModal();
    });
  }

  function handleBulkAssignZone() {
    startTransition(async () => {
      await assignRidersToZone(saccoId, {
        riderProfileIds: Array.from(selected),
        zoneId: selectedZoneId,
      });
      setSelected(new Set());
      closeModal();
    });
  }

  function handleRemove() {
    if (!activeRider) return;
    startTransition(async () => {
      await removeRiderFromSacco(saccoId, { riderProfileId: activeRider.id });
      closeModal();
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 flex flex-wrap gap-3 items-center border-b border-gray-50">
          <input
            type="text"
            placeholder="Search rider, phone, plate…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px] text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {selected.size > 0 && (
            <>
              <button
                onClick={() => setModal("commission")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition"
              >
                <Percent size={14} />
                Set Commission ({selected.size})
              </button>
              <button
                onClick={() => setModal("zone")}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 transition"
              >
                <MapPin size={14} />
                Assign Zone ({selected.size})
              </button>
            </>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                <th className="px-5 py-3 w-8">
                  <input
                    type="checkbox"
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? new Set(filtered.map((r) => r.id))
                          : new Set()
                      )
                    }
                    checked={
                      filtered.length > 0 && selected.size === filtered.length
                    }
                    className="rounded"
                  />
                </th>
                <th className="px-5 py-3">Rider</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Trips</th>
                <th className="px-5 py-3">Zones</th>
                <th className="px-5 py-3">Commission</th>
                <th className="px-5 py-3">Docs</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((rider) => (
                <tr key={rider.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(rider.id)}
                      onChange={() => toggleSelect(rider.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center overflow-hidden">
                        {rider.avatarUrl ? (
                          <img
                            src={rider.avatarUrl}
                            alt={rider.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-indigo-600">
                            {rider.fullName[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{rider.fullName}</p>
                        <p className="text-xs text-gray-400">
                          {rider.phone} · {rider.vehiclePlate ?? "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        rider.onlineStatus
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {rider.onlineStatus ? (
                        <Wifi size={10} />
                      ) : (
                        <WifiOff size={10} />
                      )}
                      {rider.onlineStatus ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700">{rider.tripCount}</td>
                  <td className="px-5 py-3">
                    {rider.activeZones.length === 0 ? (
                      <span className="text-gray-300 text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {rider.activeZones.slice(0, 2).map((z) => (
                          <span
                            key={z}
                            className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium"
                          >
                            {z}
                          </span>
                        ))}
                        {rider.activeZones.length > 2 && (
                          <span className="text-xs text-gray-400">
                            +{rider.activeZones.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {rider.commissionOverride ? (
                      <span className="text-indigo-600 font-medium">
                        P:{rider.commissionOverride.platformCommissionPct}% S:
                        {rider.commissionOverride.saccoCommissionPct}%
                      </span>
                    ) : (
                      <span className="text-gray-300">Default</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {rider.documentsExpiringSoon > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <AlertTriangle size={11} />
                        {rider.documentsExpiringSoon} expiring
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-500">✓ OK</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCommission(rider)}
                        title="Set commission"
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
                      >
                        <Percent size={14} />
                      </button>
                      <button
                        onClick={() => openZone(rider)}
                        title="Assign zone"
                        className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition"
                      >
                        <MapPin size={14} />
                      </button>
                      <button
                        onClick={() => openRemove(rider)}
                        title="Remove from SACCO"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">
                    No riders match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commission modal */}
      {modal === "commission" && (
        <Modal
          title={
            activeRider
              ? `Commission for ${activeRider.fullName}`
              : `Fleet-wide Commission (${selected.size} riders)`
          }
          onClose={closeModal}
        >
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Platform commission %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={platformPct}
            onChange={(e) => setPlatformPct(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1">
            SACCO commission %
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={saccoPct}
            onChange={(e) => setSaccoPct(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            value={commNote}
            onChange={(e) => setCommNote(e.target.value)}
            placeholder="e.g. Q3 promo rate"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <button
            disabled={isPending}
            onClick={activeRider ? handleSetCommission : handleBulkCommission}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save Commission"}
          </button>
        </Modal>
      )}

      {/* Zone modal */}
      {modal === "zone" && (
        <Modal
          title={
            activeRider
              ? `Assign zone to ${activeRider.fullName}`
              : `Assign zone to ${selected.size} riders`
          }
          onClose={closeModal}
        >
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Zone / Stage
          </label>
          <select
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.riderCount} riders)
              </option>
            ))}
          </select>
          <button
            disabled={isPending}
            onClick={activeRider ? handleAssignZone : handleBulkAssignZone}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {isPending ? "Assigning…" : "Assign Zone"}
          </button>
        </Modal>
      )}

      {/* Remove modal */}
      {modal === "remove" && activeRider && (
        <Modal title={`Remove ${activeRider.fullName}?`} onClose={closeModal}>
          <p className="text-sm text-gray-600 mb-6">
            This will remove the rider from your SACCO and clear all zone
            assignments. Their trip history and earnings remain intact.
          </p>
          <div className="flex gap-3">
            <button
              onClick={closeModal}
              className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={handleRemove}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {isPending ? "Removing…" : "Remove Rider"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Shared modal wrapper ──────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
