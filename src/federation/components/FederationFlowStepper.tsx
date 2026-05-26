import { Link, useLocation } from 'react-router-dom';
import { FEDERATION_STEPS } from '../utils/navigation';
import { stepByPath } from '../utils/navigation';

export default function FederationFlowStepper() {
  const { pathname } = useLocation();
  const current = stepByPath(pathname);

  return (
    <div className="border-b border-slate-200 bg-white px-4 py-3 overflow-x-auto">
      <div className="flex min-w-max items-center gap-1 text-xs">
        {FEDERATION_STEPS.map((step, i) => {
          const active = current?.id === step.id;
          return (
            <span key={step.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300 px-1">→</span>}
              <Link
                to={step.path}
                className={`rounded-md px-2 py-1 font-semibold whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {step.label}
              </Link>
            </span>
          );
        })}
      </div>
    </div>
  );
}
