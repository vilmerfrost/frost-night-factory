"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Rocket, 
  Activity, 
  FolderKanban, 
  Settings, 
  CreditCard 
} from "lucide-react";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Pipelines', href: '/pipelines', icon: Rocket },
  { name: 'Monitor', href: '/monitor', icon: Activity },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
];

const bottomNavigation = [
  { name: 'Billing', href: '/billing', icon: CreditCard },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-lg font-bold">F</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Frost Night</div>
            <div className="text-[10px] text-gray-500">Factory</div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-gray-900 text-white shadow-lg' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="p-3 space-y-1 border-t border-gray-200">
        {bottomNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? 'bg-gray-100 text-gray-900' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* User Profile */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">Your Name</div>
            <div className="text-xs text-gray-500">Pro Plan</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

