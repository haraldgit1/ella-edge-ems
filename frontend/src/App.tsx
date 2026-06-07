import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardOperator from './pages/DashboardOperator'
import ResidentDashboard from './pages/ResidentDashboard'
import Participants from './pages/Participants'
import Meters from './pages/Meters'
import Devices from './pages/Devices'
import Alarms from './pages/Alarms'
import Settlement from './pages/Settlement'
import OpsRules from './pages/OpsRules'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/operator/dashboard" replace />} />
        <Route path="operator/dashboard"    element={<DashboardOperator />} />
        <Route path="operator/participants" element={<Participants />} />
        <Route path="operator/devices"      element={<Devices />} />
        <Route path="operator/meters"       element={<Meters />} />
        <Route path="operator/alarms"       element={<Alarms />} />
        <Route path="operator/settlement"   element={<Settlement />} />
        <Route path="resident/dashboard"    element={<ResidentDashboard />} />
        <Route path="ops/rules"             element={<OpsRules />} />
      </Route>
    </Routes>
  )
}
