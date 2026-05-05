"use client";

import { useEffect } from 'react';
import { useState } from 'react';

import Header from './components/Header';
import LiveTiming from './components/LiveTiming';
import SessionInfo from './components/SessionInfo';
import MaxTracker from './components/MaxTracker';
import PredictionStudio from './components/PredictionStudio';
import TelemetryRibbon from './components/TelemetryRibbon';
import TrackBackdrop from './components/TrackBackdrop';
import DraggableWidget from './components/DraggableWidget';
import NextRaceIntelligence from './components/NextRaceIntelligence';
import LiveRaceTelemetryPanel from './components/LiveRaceTelemetryPanel';
import NewsView from './components/NewsView';
import ChatView from './components/chat/ChatView';
import { AlertCircle } from 'lucide-react';
import { useDashboardData } from './hooks/useDashboardData';
import { DASHBOARD_TITLE } from './constants';
import { LeaderboardSkeleton } from './components/Skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import { fetchHistoricalData } from './services/jolpica';
import type { DashboardSession } from './types/f1';

const BACKDROP_REFRESH_MS = 30 * 60 * 1000;

const FALLBACK_BACKDROP_SESSION: DashboardSession = {
  session_key: 'miami-gp-fallback',
  session_name: 'Miami Grand Prix',
  session_type: 'Race',
  country_name: 'United States',
  location: 'Miami Gardens',
  circuit_short_name: 'Miami',
  date_start: '2026-05-03T20:00:00Z',
  current_lap: 'SCHEDULED',
};

const HUD_VISIBILITY_STORAGE_KEY = 'hud_widget_visibility_f1-hud-v4';
const HUD_LAYOUT_STORAGE_PREFIX = 'hud_widget_f1-hud-v4_';

const HUD_WIDGET_OPTIONS = [
  { id: 'leaderboard', label: 'Live timing' },
  { id: 'live_race_telemetry', label: 'Live race telemetry' },
  { id: 'next_race_intelligence', label: 'Previous winners + prediction' },
  { id: 'focused_driver', label: 'Driver focus' },
  { id: 'session_info', label: 'Session info' },
  { id: 'data_pipeline', label: 'Pipeline' },
] as const;

type HudWidgetId = typeof HUD_WIDGET_OPTIONS[number]['id'];
type HudVisibility = Record<HudWidgetId, boolean>;

const DEFAULT_HUD_VISIBILITY: HudVisibility = {
  leaderboard: true,
  live_race_telemetry: true,
  next_race_intelligence: true,
  focused_driver: false,
  session_info: false,
  data_pipeline: false,
};

function readHudVisibility(): HudVisibility {
  if (typeof window === 'undefined') return DEFAULT_HUD_VISIBILITY;

  const saved = window.localStorage.getItem(HUD_VISIBILITY_STORAGE_KEY);
  if (!saved) return DEFAULT_HUD_VISIBILITY;

  try {
    const parsed = JSON.parse(saved) as Partial<Record<HudWidgetId, boolean>>;
    return HUD_WIDGET_OPTIONS.reduce((current, option) => ({
      ...current,
      [option.id]: typeof parsed[option.id] === 'boolean' ? parsed[option.id] : DEFAULT_HUD_VISIBILITY[option.id],
    }), DEFAULT_HUD_VISIBILITY);
  } catch {
    return DEFAULT_HUD_VISIBILITY;
  }
}

function App() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = useDashboardData();
  const {
    viewMode,
    session,
    leaderboard,
    maxStats,
    loading,
    errorMsg,
    dataState,
    warnings,
    selectedYear,
    selectedRound,
    seasonRaces,
    liveStatus,
    nextSession,
  } = state;
  const isLive = liveStatus === 'LIVE';
  const [latestCompletedSession, setLatestCompletedSession] = useState<DashboardSession | null>(null);
  const [upcomingRaceSession, setUpcomingRaceSession] = useState<DashboardSession | null>(null);
  const [visibleHudWidgets, setVisibleHudWidgets] = useState<HudVisibility>(DEFAULT_HUD_VISIBILITY);
  const [layoutResetKey, setLayoutResetKey] = useState(0);
  const nextSchedule = nextSession ?? (session?.status === 'NO_RACE' ? session : null);
  const nextRaceSchedule = upcomingRaceSession ?? (nextSchedule?.session_type === 'Race' ? nextSchedule : FALLBACK_BACKDROP_SESSION);
  const backdropSession = nextRaceSchedule ?? session ?? latestCompletedSession ?? FALLBACK_BACKDROP_SESSION;
  const [viewportWidth, setViewportWidth] = useState(1440);
  const rightRailX = Math.max(20, viewportWidth - 380);
  const isNarrowViewport = viewportWidth < 1100;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const frameId = window.requestAnimationFrame(() => setVisibleHudWidgets(readHudVisibility()));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const updateHudVisibility = (id: HudWidgetId, checked: boolean) => {
    setVisibleHudWidgets((current) => {
      const next = { ...current, [id]: checked };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HUD_VISIBILITY_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const resetHudLayout = () => {
    if (typeof window !== 'undefined') {
      HUD_WIDGET_OPTIONS.forEach((option) => window.localStorage.removeItem(`${HUD_LAYOUT_STORAGE_PREFIX}${option.id}`));
      window.localStorage.setItem(HUD_VISIBILITY_STORAGE_KEY, JSON.stringify(DEFAULT_HUD_VISIBILITY));
    }
    setVisibleHudWidgets(DEFAULT_HUD_VISIBILITY);
    setLayoutResetKey((current) => current + 1);
  };

  const hudControls = viewMode === 'LIVE' || viewMode === 'HISTORICAL' ? (
    <div
      className="glass-panel"
      style={{
        position: isNarrowViewport ? 'relative' : 'fixed',
        top: isNarrowViewport ? undefined : '18.25rem',
        left: isNarrowViewport ? undefined : '1.5rem',
        zIndex: 90,
        width: isNarrowViewport ? '100%' : 300,
        padding: '0.8rem',
        pointerEvents: 'auto',
        display: 'grid',
        gap: '0.65rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
        <strong style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>HUD Controls</strong>
        <button
          type="button"
          onClick={resetHudLayout}
          style={{
            border: '1px solid var(--border-light)',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-secondary)',
            padding: '0.25rem 0.55rem',
            fontSize: '0.7rem',
            cursor: 'pointer',
          }}
        >
          Reset
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isNarrowViewport ? 'repeat(2, minmax(0, 1fr))' : '1fr', gap: '0.45rem' }}>
        {HUD_WIDGET_OPTIONS.map((option) => (
          <label
            key={option.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              lineHeight: 1.25,
            }}
          >
            <input
              type="checkbox"
              checked={visibleHudWidgets[option.id]}
              onChange={(event) => updateHudVisibility(option.id, event.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)' }}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  ) : null;

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode) return;
    if (mode === 'live') dispatch({ type: 'SET_VIEW_MODE', payload: 'LIVE' });
    if (mode === 'historical') dispatch({ type: 'SET_VIEW_MODE', payload: 'HISTORICAL' });
    if (mode === 'addons') dispatch({ type: 'SET_VIEW_MODE', payload: 'LIVE' });
    if (mode === 'chat') dispatch({ type: 'SET_VIEW_MODE', payload: 'CHAT' });
    if (mode === 'predictions') dispatch({ type: 'SET_VIEW_MODE', payload: 'PREDICTIONS' });
    if (mode === 'news') dispatch({ type: 'SET_VIEW_MODE', payload: 'NEWS' });
  }, [searchParams, dispatch]);

  useEffect(() => {
    let ignore = false;

    const loadBackdropContext = async () => {
      try {
        const [latestRace, nextRaceResponse] = await Promise.all([
          fetchHistoricalData().catch(() => null),
          fetch('/api/schedule/next-race', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).catch(() => null),
        ]);
        if (ignore) return;
        if (latestRace?.session) setLatestCompletedSession(latestRace.session);
        if (nextRaceResponse?.next_race) {
          setUpcomingRaceSession({
            ...nextRaceResponse.next_race,
            date_start: nextRaceResponse.next_race.date_start ?? FALLBACK_BACKDROP_SESSION.date_start,
            current_lap: 'SCHEDULED',
            status: 'NO_RACE',
          });
        }
      } catch {
        if (!ignore) {
          setLatestCompletedSession((current) => current ?? FALLBACK_BACKDROP_SESSION);
        }
      }
    };

    loadBackdropContext();
    const intervalId = window.setInterval(loadBackdropContext, BACKDROP_REFRESH_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="app-container" style={{ position: 'relative', minHeight: '100vh' }}>
      
      {/* BACKGROUND LAYER: TRACK MAP (FIXED) - Current/upcoming race circuit */}
      {backdropSession && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1 }}>
          <TrackBackdrop session={backdropSession} />
        </div>
      )}

      {/* FOREGROUND CONTENT */}
      <div style={{ position: 'relative', zIndex: 300, pointerEvents: 'none', width: '100%' }}>
        <div style={{ pointerEvents: 'auto' }}>
          {/* Top Placeholder: Primary Mode Switch */}
          <div className="top-placeholder">
            <div className="mode-toggle">
              <button 
                className={`toggle-btn ${viewMode === 'LIVE' ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'LIVE' })}
              >
                Live Telemetry
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'HISTORICAL' ? 'active-hist' : ''}`}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'HISTORICAL' })}
              >
                Historical Archive
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'REPLAY' ? 'active-hist' : ''}`}
                onClick={() => router.push('/replay')}
              >
                Race Replay
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'CHAT' ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'CHAT' })}
              >
                Chatbot
              </button>
              <button 
                className={`toggle-btn ${viewMode === 'PREDICTIONS' ? 'active-hist' : ''}`}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'PREDICTIONS' })}
              >
                Predictions
              </button>
              <button
                className={`toggle-btn ${viewMode === 'NEWS' ? 'active-hist' : ''}`}
                onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'NEWS' })}
              >
                News
              </button>
            </div>
          </div>

          <Header
            sessionName={DASHBOARD_TITLE}
            isLive={viewMode === 'LIVE' && isLive}
          />
          <TelemetryRibbon session={session} viewMode={viewMode} live={viewMode === 'LIVE' && isLive} signalLabel={viewMode === 'LIVE' ? 'SIGNAL: LIVE PACKET' : 'SIGNAL: STABLE'} />

          {/* Historical Race Selectors */}
          {viewMode === 'HISTORICAL' && (
            <div className="historical-controls">
              <select 
                className="race-selector"
                value={selectedYear}
                onChange={(e) => dispatch({ type: 'SET_YEAR', payload: e.target.value })}
              >
                <option value="2026">2026 Season</option>
                <option value="2025">2025 Season</option>
                <option value="2024">2024 Season</option>
              </select>

              {seasonRaces.length > 0 && (
                <select 
                  className="race-selector"
                  value={selectedRound || ""}
                  onChange={(e) => dispatch({ type: 'SET_ROUND', payload: e.target.value })}
                >
                  {selectedYear === new Date().getFullYear().toString() && (
                    <option value="">Latest Completed Race</option>
                  )}
                  {seasonRaces.map((race) => (
                    <option key={race.round} value={race.round}>
                      R{race.round} - {race.raceName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 100, width: '100%' }}>
        {viewMode === 'CHAT' ? (
          <ChatView />
        ) : viewMode === 'PREDICTIONS' ? (
          <PredictionStudio />
        ) : viewMode === 'NEWS' ? (
          <NewsView />
        ) : loading ? (
          <div className="dashboard-grid">
            <div className="dashboard-column">
                <LeaderboardSkeleton />
            </div>
            <div className="dashboard-column center-column" style={{ opacity: 0.3 }}>
                <div className="glass-panel" style={{ height: '600px' }} />
            </div>
            <div className="dashboard-column right-sidebar" style={{ opacity: 0.3 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="glass-panel" style={{ height: '240px' }} />
                  <div className="glass-panel" style={{ height: '180px' }} />
                </div>
            </div>
          </div>
        ) : dataState === 'offline' && !session ? (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', borderColor: 'var(--accent-f1)' }}>
            <AlertCircle size={48} color="var(--accent-f1)" style={{ margin: '0 auto 1rem auto' }} />
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>DATA UNAVAILABLE</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
              {errorMsg ?? 'Telemetry backend is offline. Showing limited UI until recovery.'}
            </p>
          </div>
        ) : (
          <main style={{ position: 'relative', width: '100%', minHeight: '100vh', pointerEvents: 'none' }}>
            {(dataState === 'degraded' || dataState === 'offline') && (
              <div style={{ pointerEvents: 'auto', padding: '0 1rem' }}>
                <div className="glass-panel" style={{ borderColor: 'rgba(244, 180, 0, 0.45)', marginBottom: '1rem', padding: '0.85rem 1rem' }}>
                  <strong style={{ color: '#f4b400', fontSize: '0.85rem', letterSpacing: '0.08em' }}>DATA MODE: {dataState.toUpperCase()}</strong>
                  {warnings.length > 0 && (
                    <p style={{ marginTop: '0.45rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {warnings[0]}
                    </p>
                  )}
                </div>
              </div>
            )}
            {/* HUD WIDGETS LAYER */}
            <div style={{ pointerEvents: 'auto' }}>
              {!isNarrowViewport && (
                <div style={{ position: 'fixed', top: '1rem', right: '1rem', pointerEvents: 'none', zIndex: 50 }}>
                  <div className="live-indicator" style={{ backdropFilter: 'blur(8px)' }}>
                    <div className="pulsing-dot" />
                    <span className="live-text">SIGNAL: NOMINAL</span>
                  </div>
                </div>
              )}

              {isNarrowViewport ? (
                <div className="mobile-hud-stack">
                  {hudControls}

                  {visibleHudWidgets.leaderboard && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    {leaderboard && (
                      <LiveTiming
                        data={leaderboard}
                        title=""
                        liveStatus={viewMode === 'LIVE' ? liveStatus : 'LIVE'}
                        nextSession={viewMode === 'LIVE' ? nextSchedule : null}
                      />
                    )}
                  </div>
                  )}

                  {visibleHudWidgets.next_race_intelligence && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    <NextRaceIntelligence nextSession={nextRaceSchedule} compact />
                  </div>
                  )}

                  {visibleHudWidgets.live_race_telemetry && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    <LiveRaceTelemetryPanel nextSession={nextSchedule} compact />
                  </div>
                  )}

                  {visibleHudWidgets.focused_driver && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    {session && (
                      <MaxTracker
                        currentPos={leaderboard?.find((d) => d.name_acronym === 'VER')?.position || null}
                        gap={leaderboard?.find((d) => d.name_acronym === 'VER')?.date || null}
                        stats={maxStats}
                      />
                    )}
                  </div>
                  )}

                  {visibleHudWidgets.session_info && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    {session && <SessionInfo session={session} />}
                  </div>
                  )}

                  {visibleHudWidgets.data_pipeline && (
                  <div className="glass-panel" style={{ padding: '0.9rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {viewMode === 'LIVE' ? 'SYNCHRONIZED' : 'ARCHIVED'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>LATENCY: 42MS</span>
                    </div>
                  </div>
                  )}
                </div>
              ) : (
                <>
                  {hudControls}

                  {visibleHudWidgets.leaderboard && (
                  <DraggableWidget key={`leaderboard-${layoutResetKey}`} id="leaderboard" title={viewMode === 'LIVE' ? 'LIVE TIMING & INTERVALS' : 'RACE CLASSIFICATION'} defaultX={340} defaultY={80} width={400} defaultHeight={620} minHeight={300} onClose={() => updateHudVisibility('leaderboard', false)}>
                    {leaderboard && (
                      <LiveTiming
                        data={leaderboard}
                        title=""
                        liveStatus={viewMode === 'LIVE' ? liveStatus : 'LIVE'}
                        nextSession={viewMode === 'LIVE' ? nextSchedule : null}
                      />
                    )}
                  </DraggableWidget>
                  )}

                  {visibleHudWidgets.live_race_telemetry && (
                  <DraggableWidget key={`live_race_telemetry-${layoutResetKey}`} id="live_race_telemetry" title="LIVE RACE TELEMETRY" defaultX={760} defaultY={80} width={560} defaultHeight={620} minWidth={400} minHeight={360} onClose={() => updateHudVisibility('live_race_telemetry', false)}>
                    <LiveRaceTelemetryPanel nextSession={nextSchedule} />
                  </DraggableWidget>
                  )}

                  {visibleHudWidgets.next_race_intelligence && (
                  <DraggableWidget key={`next_race_intelligence-${layoutResetKey}`} id="next_race_intelligence" title="NEXT RACE INTELLIGENCE" defaultX={760} defaultY={720} width={560} defaultHeight={480} minWidth={400} minHeight={320} onClose={() => updateHudVisibility('next_race_intelligence', false)}>
                    <NextRaceIntelligence nextSession={nextRaceSchedule} />
                  </DraggableWidget>
                  )}

                  {visibleHudWidgets.focused_driver && (
                  <DraggableWidget key={`focused_driver-${layoutResetKey}`} id="focused_driver" title="DRIVER FOCUS" defaultX={rightRailX} defaultY={80} width={340} defaultHeight={330} minHeight={240} onClose={() => updateHudVisibility('focused_driver', false)}>
                    {session && (
                      <MaxTracker
                        currentPos={leaderboard?.find((d) => d.name_acronym === 'VER')?.position || null}
                        gap={leaderboard?.find((d) => d.name_acronym === 'VER')?.date || null}
                        stats={maxStats}
                      />
                    )}
                  </DraggableWidget>
                  )}

                  {visibleHudWidgets.session_info && (
                  <DraggableWidget key={`session_info-${layoutResetKey}`} id="session_info" title="SESSION" defaultX={rightRailX} defaultY={430} width={340} defaultHeight={260} minHeight={220} onClose={() => updateHudVisibility('session_info', false)}>
                    {session && <SessionInfo session={session} />}
                  </DraggableWidget>
                  )}

                  {visibleHudWidgets.data_pipeline && (
                  <DraggableWidget key={`data_pipeline-${layoutResetKey}`} id="data_pipeline" title="PIPELINE" defaultX={rightRailX} defaultY={710} width={340} defaultHeight={120} minHeight={100} onClose={() => updateHudVisibility('data_pipeline', false)}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {viewMode === 'LIVE' ? 'SYNCHRONIZED' : 'ARCHIVED'}
                      </span>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        LATENCY: 42MS
                      </span>
                    </div>
                  </DraggableWidget>
                  )}
                </>
              )}
            </div>
          </main>
        )}
      </div>

      {/* STICKY BOTTOM TELEMETRY BAR */}
      {viewMode !== 'CHAT' && (
      <footer className="telemetry-footer">
         <div className="telemetry-status">
            <div className="status-item">
               <div className={`status-indicator ${viewMode === 'LIVE' ? 'pulse' : ''}`} />
               <span>{session?.session_name || 'INITIALIZING...'}</span>
            </div>
            <div className="status-item">
               <span>{isLive ? `LAP ${session?.current_lap || '--'}/71` : 'NO LIVE LAPS'}</span>
            </div>
            <div className="status-item">
               <span>LOC: {session?.location || 'TRACKSIDE'}</span>
            </div>
            <div className="status-item">
               <span style={{ color: isLive ? 'var(--accent-success)' : 'var(--accent-f1)' }}>
                {isLive ? 'LIVE' : 'TRACK CLEAR'}
               </span>
            </div>
         </div>
         <div className="pipeline-info" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <span>EXPORT TELEMETRY</span>
         </div>
      </footer>
      )}
    </div>
  );
}

export default App;
