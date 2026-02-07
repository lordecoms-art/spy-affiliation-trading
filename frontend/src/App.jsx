import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ChannelsDiscovery from './pages/ChannelsDiscovery';
import ChannelsTracking from './pages/ChannelsTracking';
import ChannelDetail from './pages/ChannelDetail';
import MessagesAnalysis from './pages/MessagesAnalysis';
import Insights from './pages/Insights';
import ChannelPersona from './pages/ChannelPersona';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/channels/discovery" element={<ChannelsDiscovery />} />
          <Route path="/channels" element={<ChannelsTracking />} />
          <Route path="/channels/:id" element={<ChannelDetail />} />
          <Route path="/channels/:id/persona" element={<ChannelPersona />} />
          <Route path="/analysis" element={<MessagesAnalysis />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
