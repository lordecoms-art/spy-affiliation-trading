import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ChannelsDiscovery from './pages/ChannelsDiscovery';
import ChannelsTracking from './pages/ChannelsTracking';
import ChannelDetail from './pages/ChannelDetail';
import MessagesAnalysis from './pages/MessagesAnalysis';
import Insights from './pages/Insights';
import SwipeFile from './pages/SwipeFile';
import Comparator from './pages/Comparator';
import Generator from './pages/Generator';
import ChannelPersona from './pages/ChannelPersona';
import ChannelPreview from './pages/ChannelPreview';
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
          <Route path="/channels/:id/preview" element={<ChannelPreview />} />
          <Route path="/analysis" element={<MessagesAnalysis />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/swipe-file" element={<SwipeFile />} />
          <Route path="/compare" element={<Comparator />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
