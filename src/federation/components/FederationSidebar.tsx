import { NavLink } from 'react-router-dom';
import {
  AlertTriangle,
  Brain,
  Inbox,
  Network,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { FEDERATION_STEPS } from '../utils/navigation';

const ICONS = {
  Inbox,
  Brain,
  Network,
  AlertTriangle,
  Workflow,
  RefreshCw,
  ShieldCheck,
} as const;

export default function FederationSidebar() {
  return (
    <aside className="flex w-52 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Federated Operational Governance
        </div>
        <div className="mt-1 text-sm font-bold text-slate-900">7工程ワークスペース</div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {FEDERATION_STEPS.map((step) => {
          const Icon = ICONS[step.icon as keyof typeof ICONS];
          return (
            <NavLink
              key={step.id}
              to={step.path}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{step.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
