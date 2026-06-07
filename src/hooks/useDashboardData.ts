import { useEffect, useReducer } from 'react';
import { getLiveDashboardData } from '../data-access/telemetryClient';
import { fetchHistoricalData, fetchSeasonRaces } from '../services/jolpica';
import { POLLING_INTERVAL, DEFAULT_YEAR, FALLBACK_YEAR } from '../constants';
import type { DashboardSession, DriverPosition, MaxStats, SeasonRace, WeekendSession } from '../types/f1';

export type ViewMode = 'LIVE' | 'HISTORICAL' | 'REPLAY' | 'CHAT' | 'PREDICTIONS' | 'NEWS';

interface DashboardState {
  viewMode: ViewMode;
  session: DashboardSession | null;
  leaderboard: DriverPosition[];
  maxStats: MaxStats | null;
  liveStatus: 'LIVE' | 'NO_RACE';
  nextSession: DashboardSession | null;
  loading: boolean;
  errorMsg: string | null;
  dataState: 'loading' | 'healthy' | 'degraded' | 'offline';
  warnings: string[];
  selectedYear: string;
  selectedRound: string | null;
  seasonRaces: SeasonRace[];
  weekendSchedule: WeekendSession[];
  apiLocked: boolean;
}

type DashboardAction =
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SET_YEAR'; payload: string }
  | { type: 'SET_ROUND'; payload: string | null }
  | { type: 'FETCH_START' }
  | {
      type: 'FETCH_SUCCESS';
      payload: {
        session: DashboardSession;
        leaderboard: DriverPosition[];
        max_stats: MaxStats | null;
        live_status: 'LIVE' | 'NO_RACE';
        next_session?: DashboardSession | null;
        data_health?: 'healthy' | 'degraded' | 'offline';
        warnings?: string[];
        weekend_schedule?: WeekendSession[];
        api_locked?: boolean;
      };
    }
  | { type: 'FETCH_ERROR'; payload: string }
  | { type: 'LOAD_CALENDAR'; payload: SeasonRace[] }
  | { type: 'RESET_HISTORICAL'; payload: { year: string; round: string | null; races: SeasonRace[] } };

const dashboardReducer = (state: DashboardState, action: DashboardAction): DashboardState => {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload, errorMsg: null };
    case 'SET_YEAR':
      return { ...state, selectedYear: action.payload, seasonRaces: [], selectedRound: null };
    case 'SET_ROUND':
      return { ...state, selectedRound: action.payload };
    case 'FETCH_START':
      return { ...state, loading: !state.session, errorMsg: null, dataState: state.session ? state.dataState : 'loading' };
    case 'FETCH_SUCCESS':
      return {
        ...state,
        loading: false,
        session: action.payload.session,
        leaderboard: action.payload.leaderboard,
        maxStats: action.payload.max_stats,
        liveStatus: action.payload.live_status,
        nextSession: action.payload.next_session ?? null,
        dataState: action.payload.data_health ?? 'healthy',
        warnings: action.payload.warnings ?? [],
        errorMsg: action.payload.data_health === 'offline' ? 'Live telemetry is currently unavailable.' : null,
        weekendSchedule: action.payload.weekend_schedule ?? [],
        apiLocked: action.payload.api_locked ?? false,
      };
    case 'FETCH_ERROR':
      return {
        ...state,
        loading: false,
        errorMsg: action.payload,
        dataState: state.session ? 'degraded' : 'offline',
        warnings: [action.payload],
      };
    case 'LOAD_CALENDAR':
      return { ...state, seasonRaces: action.payload };
    case 'RESET_HISTORICAL':
      return {
        ...state,
        selectedYear: action.payload.year,
        selectedRound: action.payload.round,
        seasonRaces: action.payload.races,
      };
    default:
      return state;
  }
};

const standbySession: DashboardSession = {
  session_key: 'miami-standby',
  session_name: 'Miami Grand Prix',
  session_type: 'Race',
  country_name: 'United States',
  location: 'Miami Gardens',
  circuit_short_name: 'Miami',
  date_start: '2026-05-03T20:00:00Z',
  current_lap: 'SCHEDULED',
  status: 'NO_RACE',
};

const standbyMaxStats: MaxStats = {
  best_lap: '--:--.---',
  top_speed: '--',
  started: 'STANDBY',
  tyres: 'WAITING FOR LIVE FEED',
};

const initialState: DashboardState = {
  viewMode: 'LIVE',
  session: standbySession,
  leaderboard: [],
  maxStats: standbyMaxStats,
  liveStatus: 'NO_RACE',
  nextSession: standbySession,
  loading: false,
  errorMsg: null,
  dataState: 'degraded',
  warnings: ['Showing scheduled Miami standby while the live telemetry feed warms up.'],
  selectedYear: DEFAULT_YEAR,
  selectedRound: null,
  seasonRaces: [],
  weekendSchedule: [],
  apiLocked: false,
};

export function useDashboardData() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // Effect to load calendar whenever the year changes
  useEffect(() => {
    if (state.viewMode === 'HISTORICAL') {
      const fetchCalendar = async () => {
        try {
          const races = await fetchSeasonRaces(state.selectedYear);
          if (races.length === 0 && state.selectedYear === DEFAULT_YEAR) {
            console.log(`No ${DEFAULT_YEAR} season data available yet, switching focus to ${FALLBACK_YEAR} archive.`);
            const fallbackRaces = await fetchSeasonRaces(FALLBACK_YEAR);
            dispatch({
              type: 'RESET_HISTORICAL',
              payload: { year: FALLBACK_YEAR, round: fallbackRaces[0]?.round || null, races: fallbackRaces }
            });
            return;
          }
          dispatch({ type: 'LOAD_CALENDAR', payload: races });
          
          if (state.selectedYear === new Date().getFullYear().toString()) {
            dispatch({ type: 'SET_ROUND', payload: null });
          } else if (races.length > 0) {
            dispatch({ type: 'SET_ROUND', payload: races[0].round });
          }
        } catch (err) {
          console.error("Failed to fetch calendar:", err);
        }
      };
      fetchCalendar();
    }
  }, [state.selectedYear, state.viewMode]);

  // Unified data loader depending on mode and selections
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let inFlight = false;

    if (state.viewMode !== 'LIVE' && state.viewMode !== 'HISTORICAL') {
      return undefined;
    }

    const loadData = async (isPolling = false) => {
      if (isPolling && inFlight) {
        return;
      }
      if (!isPolling) dispatch({ type: 'FETCH_START' });
      inFlight = true;
      try {
        let data;
        if (state.viewMode === 'LIVE') {
          data = await getLiveDashboardData();
        } else {
          data = await fetchHistoricalData(state.selectedYear, state.selectedRound || undefined);
        }
        dispatch({ type: 'FETCH_SUCCESS', payload: data });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load OpenF1 data.";
        const transient = /aborted|failed to fetch|network/i.test(message.toLowerCase());
        if (!isPolling || !transient) {
          console.error("Dashboard failed to load data:", err);
        }
        if (!isPolling) {
          dispatch({ type: 'FETCH_ERROR', payload: message });
        }
      } finally {
        inFlight = false;
      }
    };

    if (state.viewMode === 'HISTORICAL' && !state.selectedRound && state.selectedYear !== new Date().getFullYear().toString() && state.seasonRaces.length === 0) {
      // WAIT FOR CALENDAR
    } else {
      loadData();
    }

    if (state.viewMode === 'LIVE') {
      intervalId = setInterval(() => loadData(true), POLLING_INTERVAL);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [state.viewMode, state.selectedYear, state.selectedRound, state.seasonRaces.length]);

  return { state, dispatch };
}
