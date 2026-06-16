// src/components/sacco/ZonesManager.tsx
"use client";

import { useState, useTransition } from "react";
import type { ZoneDTO, SaccoRiderDTO } from "@/types/sacco";
import { assignRidersToZone, removeRiderFromZone } from "@/lib/sacco/actions";
import { MapPin, Plus, X } from "lucide-react";

interface Props {
  zones: ZoneDTO[];
  riders: SaccoRiderDTO[];
  saccoId: string;
}

export default function ZonesManager({ zones, riders, saccoId }: Props) {
  const [selectedZone, setSelectedZone] = useState<ZoneDTO | null>(
    zones[0] ?? null
  );
  const [isPending, startTransition] = useTransition();

  // Riders in the selected zone
  const assignedRiders = riders.filter((r) =>
    r.activeZones.includes(selectedZone?.name ?? "")
  );
  const unassignedRiders = riders.filter(
    (r) => !r.activeZones.includes(selectedZone?.name ?? "")
  );

  function handleAssign(riderId: string) {
    if (!selectedZone) return;
    startTransition(async () => {
      await assignRidersToZone(saccoId, {
        riderProfileIds: [riderId],
        zoneId: selectedZone.id,
      });
    });
  }

  function handleRemove(riderId: string) {
    if (!selectedZone) return;
    startTransition(async () => {
      await removeRiderFromZone(saccoId, {
        riderProfileId: riderId,
        zoneId: selectedZone.id,
      });
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Zone list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">All Zones</h2>
        <div className="space-y-1">
          {zones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setSelectedZone(zone)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition ${
                selectedZone?.id === zone.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <MapPin size={14} className="shrink-0" />
              <span className="flex-1 font-medium truncate">{zone.name}</span>
              <span className="text-xs text-gray-400">{zone.riderCount}</span>
            </button>
          ))}
          {zones.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-4 text-center">
              No zones configured. Ask a platform admin to add zones.
            </p>
          )}
        </div>
      </div>

      {/* Assigned riders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          {selectedZone ? `Riders in ${selectedZone.name}` : "Select a zone"}
        </h2>
        {selectedZone ? (
          <div className="space-y-1">
            {assignedRiders.map((rider) => (
              <div
                key={rider.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 group"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center overflow-hidden text-xs font-bold text-indigo-600">
                  {rider.avatarUrl ? (
                    <img src={rider.avatarUrl} alt={rider.fullName} className="w-full h-full object-cover" />
                  ) : (
                    rider.fullName[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{rider.fullName}</p>
                  <p className="text-xs text-gray-400">{rider.vehiclePlate ?? rider.phone}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => handleRemove(rider.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                  title="Remove from zone"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {assignedRiders.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">
                No riders assigned to this zone.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">
            Choose a zone on the left to see its riders.
          </p>
        )}
      </div>

      {/* Unassigned / add riders */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Riders not in this zone
        </h2>
        {selectedZone ? (
          <div className="space-y-1">
            {unassignedRiders.map((rider) => (
              <div
                key={rider.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 group"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0 flex items-center justify-center overflow-hidden text-xs font-bold text-gray-500">
                  {rider.avatarUrl ? (
                    <img src={rider.avatarUrl} alt={rider.fullName} className="w-full h-full object-cover" />
                  ) : (
                    rider.fullName[0]
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{rider.fullName}</p>
                  <p className="text-xs text-gray-400">{rider.vehiclePlate ?? rider.phone}</p>
                </div>
                <button
                  disabled={isPending}
                  onClick={() => handleAssign(rider.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  title={`Add to ${selectedZone.name}`}
                >
                  <Plus size={14} />
                </button>
              </div>
            ))}
            {unassignedRiders.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-4 text-center">
                All riders are assigned to this zone.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 px-3 py-4 text-center">
            Select a zone first.
          </p>
        )}
      </div>
    </div>
  );
}
