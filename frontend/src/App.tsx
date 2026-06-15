import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardOperator from './pages/DashboardOperator'
import ResidentDashboard from './pages/ResidentDashboard'
import Participants from './pages/Participants'
import Meters from './pages/Meters'
import Devices from './pages/Devices'
import Alarms from './pages/Alarms'
import Settlement from './pages/Settlement'
import Reports from './pages/Reports'
import OpsRules from './pages/OpsRules'
import SimDashboard from './pages/SimDashboard'
import MdmLayout from './mdm/MdmLayout'
import MdmParticipants from './mdm/pages/MdmParticipants'
import MdmDevices from './mdm/pages/MdmDevices'
import MdmSmartmeterLog from './mdm/pages/MdmSmartmeterLog'
import DocumentsOverview from './pages/documents/DocumentsOverview'
import EllaEmsDoc1 from './pages/documents/EllaEmsDoc1'

export default function App() {
  return (
    <Routes>
      {/* MDM — standalone shell, outside EMS layout */}
      <Route path="/mdm" element={<MdmLayout />}>
        <Route index element={<Navigate to="/mdm/participants" replace />} />
        <Route path="participants"   element={<MdmParticipants />} />
        <Route path="devices"        element={<MdmDevices />} />
        <Route path="smartmeter-log" element={<MdmSmartmeterLog />} />
      </Route>

      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/operator/dashboard" replace />} />
        <Route path="operator/dashboard"    element={<DashboardOperator />} />
        <Route path="operator/participants" element={<Participants />} />
        <Route path="operator/devices"      element={<Devices />} />
        <Route path="operator/meters"       element={<Meters />} />
        <Route path="operator/alarms"       element={<Alarms />} />
        <Route path="operator/settlement"   element={<Settlement />} />
        <Route path="operator/reports"      element={<Reports />} />
        <Route path="resident/dashboard"    element={<ResidentDashboard />} />
        <Route path="ops/rules"             element={<OpsRules />} />
        <Route path="simulation"            element={<SimDashboard />} />
        <Route path="documents"             element={<DocumentsOverview />} />
        <Route path="documents/ella-ems-doc1" element={<EllaEmsDoc1 />} />
      </Route>
    </Routes>
  )
}
