// src/components/sacco/SaccoSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Users,
  MapPin,
  FileCheck,
  Wallet,
  Settings,
  ChevronRight,
} from "lucide-react";
import type { SaccoRole } from "@/types/sacco";

const NAV_ITEMS = [
  { label: "Analytics", href: "analytics", icon: BarChart2 },
  { label: "Riders", href: "riders", icon: Users },
  { label: "Zones", href: "zones", icon: MapPin },
  { label: "Compliance", href: "compliance", icon: FileCheck },
  { label: "Payouts", href: "payouts", icon: Wallet },
  { label: "Settings", href: "settings", icon: Settings },
];

interface Props {
  saccoId: string;
  saccoName: string;
  adminRole: SaccoRole;
}

export default function SaccoSidebar({ saccoId, saccoName, adminRole }: Props) {
  const pathname = usePathname();
  const base = `/sacco/${saccoId}`;

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-gray-100 min-h-screen px-4 py-6">
      {/* Branding */}
      <div className="mb-8 px-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
          Fleet Console
        </p>
        <h2 className="text-base font-bold text-gray-900 truncate">{saccoName}</h2>
        <span className="text-xs text-indigo-600 font-medium">{adminRole}</span>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const fullPath = `${base}/${href}`;
          const isActive = pathname.startsWith(fullPath);
          return (
            <Link
              key={href}
              href={fullPath}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
              {isActive && (
                <ChevronRight size={12} className="ml-auto text-indigo-400" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-100 px-2">
        <p className="text-xs text-gray-400">Pikii Fleet v1.0</p>
      </div>
    </aside>
  );
}
