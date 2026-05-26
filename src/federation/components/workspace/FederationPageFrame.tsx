import type { ReactNode } from 'react';
import type { FederationStepId } from '../../types/federation';
import { stepById } from '../../utils/navigation';

type Props = {
  stepId: FederationStepId;
  children?: ReactNode;
};

export default function FederationPageFrame({ stepId, children }: Props) {
  const step = stepById(stepId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{step.label}</h1>
        {step.legacyLabels?.length ? (
          <p className="mt-1 text-xs text-slate-500">
            旧: {step.legacyLabels.join(' · ')}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {step.features.map((f) => (
          <div
            key={f}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm"
          >
            {f}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}
