import { NavLink } from "react-router";
import {
  HomeIcon,
  RectangleStackIcon,
  QrCodeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  glowClass: string;
  activeColor: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: HomeIcon,
    glowClass: "binder-tab-glow-green",
    activeColor: "text-neon-green",
  },
  {
    label: "Collection",
    path: "/managing-inventory",
    icon: RectangleStackIcon,
    glowClass: "binder-tab-glow-blue",
    activeColor: "text-neon-blue",
  },
  {
    label: "QR Code",
    path: "/qr-code",
    icon: QrCodeIcon,
    glowClass: "binder-tab-glow-pink",
    activeColor: "text-neon-pink",
  },
  {
    label: "Profile",
    path: "/profile",
    icon: UserIcon,
    glowClass: "binder-tab-glow-purple",
    activeColor: "text-neon-purple",
  },
];

const STAGGER_OFFSETS = [0, 6, 12, 18];

export default function BinderTabs() {
  return (
    <nav className="fixed right-0 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col gap-2">
      {NAV_ITEMS.map((item, index) => (
        <NavLink
          key={item.path}
          to={item.path}
          viewTransition
          className={({ isActive }) =>
            `binder-tab flex items-center gap-3 rounded-l-xl cursor-pointer
            transition-all duration-200 ease-out
            py-4 pl-4 pr-5 w-[160px]
            ${isActive
              ? `${item.glowClass} ${item.activeColor} bg-gray-900 w-[170px]`
              : "bg-gray-800/80 text-gray-400 hover:w-[166px] hover:bg-gray-800"
            }`
          }
          style={{ marginRight: `-${STAGGER_OFFSETS[index] ?? 0}px` }}
        >
          <item.icon className="w-6 h-6 shrink-0" />
          <span className="text-base font-medium">
            {item.label}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
