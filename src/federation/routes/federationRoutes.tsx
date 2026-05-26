import { Navigate, Route, Routes } from 'react-router-dom';
import FederationLayout from '../layouts/FederationLayout';
import IntakePage from '../pages/IntakePage';
import IntentPage from '../pages/IntentPage';
import ResponsibilityPage from '../pages/ResponsibilityPage';
import ImpactPage from '../pages/ImpactPage';
import SyncPlanPage from '../pages/SyncPlanPage';
import SyncApplyPage from '../pages/SyncApplyPage';
import ValidationPage from '../pages/ValidationPage';

/** All federation governance routes — connected on first load (no orphan pages). */
export function FederationRoutes() {
  return (
    <Routes>
      <Route path="/runtime_discovery" element={<Navigate to="/federation/intake" replace />} />
      <Route path="/need_impact" element={<Navigate to="/federation/intent" replace />} />
      <Route path="/" element={<Navigate to="/federation/intake" replace />} />
      <Route path="/federation" element={<FederationLayout />}>
        <Route index element={<Navigate to="intake" replace />} />
        <Route path="intake" element={<IntakePage />} />
        <Route path="intent" element={<IntentPage />} />
        <Route path="responsibility" element={<ResponsibilityPage />} />
        <Route path="impact" element={<ImpactPage />} />
        <Route path="sync-plan" element={<SyncPlanPage />} />
        <Route path="sync-apply" element={<SyncApplyPage />} />
        <Route path="validation" element={<ValidationPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/federation/intake" replace />} />
    </Routes>
  );
}
