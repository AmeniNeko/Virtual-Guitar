/**
 * App.tsx — 应用入口
 *
 * 新布局：
 * Header
 * ┌──────────┬──────────────────────────┐
 * │ Sidebar  │  ControlBar               │
 * │ (25%)    ├──────────────────────────┤
 * │          │  GuitarContainer          │
 * │ ModeBar  │                          │
 * │          │                          │
 * └──────────┴──────────────────────────┘
 * BottomPanel
 * StatusPanel
 */

import { AppProvider } from './State/AppContext';
import { Header } from './components/Layout/Header';
import { ControlBar } from './components/Layout/ControlBar';
import { GuitarContainer } from './components/Layout/GuitarContainer';
import { ModeBar } from './components/Layout/ModeBar';
import { BottomPanel } from './components/Layout/BottomPanel';
import { StatusPanel } from './components/Layout/StatusPanel';
import './App.css';

function AppLayout() {
  return (
    <div className="app">
      <Header />
      <div className="appBody">
        <aside className="appSidebar">
          <ModeBar />
        </aside>
        <main className="appMain">
          <ControlBar />
          <GuitarContainer />
        </main>
      </div>
      <BottomPanel />
      <StatusPanel />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}
