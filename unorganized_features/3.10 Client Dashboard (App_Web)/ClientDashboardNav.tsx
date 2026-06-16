"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  Clock,
  Heart,
  Tag,
  LifeBuoy,
  Home,
  LogOut,
  User,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Book", icon: Home },
  { href: "/dashboard/history", label: "Trips", icon: Clock },
  { href: "/dashboard/places", label: "Places", icon: MapPin },
  { href: "/dashboard/favorites", label: "Favourites", icon: Heart },
  { href: "/dashboard/promos", label: "Promos", icon: Tag },
  { href: "/dashboard/support", label: "Help", icon: LifeBuoy },
];

interface Props {
  user: { name?: string | null; image?: string | null };
}

export function ClientDashboardNav({ user }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
        {/* Brand */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-5">
          <span className="text-2xl font-extrabold tracking-tight text-orange-500">
            pikii
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-orange-50 text-orange-600"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3 rounded-lg p-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "User"}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                <User size={16} className="text-orange-600" />
              </div>
            )}
            <span className="flex-1 truncate text-sm font-medium text-gray-700">
              {user.name ?? "My Account"}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded p-1 text-gray-400 hover:text-gray-700"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-200 bg-white lg:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              isActive(href) ? "text-orange-500" : "text-gray-500"
            )}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
