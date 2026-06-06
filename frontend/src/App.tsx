import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardOperator from './pages/DashboardOperator'
import Participants from './pages/Participants'
import Meters from './pages/Meters'
import Alarms from './pages/Alarms'
import OpsRules from './pages/OpsRules'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/operator/dashboard" replace />} />
        <Route path="operator/dashboard" element={<DashboardOperator />} />
        <Route path="operator/participants" element={<Participants />} />
        <Route path="operator/meters" element={<Meters />} />
        <Route path="operator/alarms" element={<Alarms />} />
        <Route path="ops/rules" element={<OpsRules />} />
      </Route>
    </Routes>
  )
}
