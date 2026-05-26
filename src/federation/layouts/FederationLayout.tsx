import { Outlet, useLocation } from 'react-router-dom';
import FederationSidebar from '../components/FederationSidebar';
import FederationTopStatusBar from '../components/FederationTopStatusBar';
import FederationFlowStepper from '../components/FederationFlowStepper';
import FederationSummaryPanel from '../components/FederationSummaryPanel';
import FederationWorkspaceDrawer from '../components/FederationWorkspaceDrawer';
import { stepByPath } from '../utils/navigation';

export default function FederationLayout() {
  const { pathname } = useLocation();
  const step = stepByPath(pathname);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <FederationSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <FederationTopStatusBar />
        <FederationFlowStepper />
        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          {step ? <FederationSummaryPanel stepId={step.id} /> : null}
        </div>
      </div>
      <FederationWorkspaceDrawer />
    </div>
  );
}
