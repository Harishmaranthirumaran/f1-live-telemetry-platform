"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Activity, CalendarRange, Flag, Gauge, RefreshCw, Trophy } from 'lucide-react';
import { fetchPredictionForecast, getPredictionSourceLabel, type PredictionForecastResponse } from '../services/predictionsApi';
import { formatSessionScheduleWithWeekday, formatUpdatedAt } from '../utils/dateFormat';

type PredictionFormState = {
  grandPrix: string;
  year: string;
};

type WeekendPrediction = NonNullable<PredictionForecastResponse['weekend']>[number];

const DEFAULT_GP = 'Canadian Grand Prix';

const buttonStyle: CSSProperties = {
  borderRadius: 999,
  border: '1px solid var(--border-light)',
  background: 'rgba(255,255,255,0.06)',
  color: 'var(--text-primary)',
  padding: '0.7rem 1rem',
  fontWeight: 800,
  cursor: 'pointer',
};

function formatSchedule(value: string | null) {
  return formatSessionScheduleWithWeekday(value, value ? 'Schedule pending' : 'Not scheduled');
}

function sourceTone(source: WeekendPrediction['resultSource']) {
  if (source === 'actual') return { label: 'Result published', color: 'var(--accent-success)' };
  if (source === 'partial') return { label: 'Live adjusted', color: 'var(--accent-cyan)' };
  if (source === 'not_scheduled') return { label: 'Not scheduled', color: 'var(--text-muted)' };
  if (source === 'unavailable') return { label: 'Waiting for data', color: '#f4b400' };
  return { label: 'Pre-session', color: 'var(--accent-f1)' };
}

function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        padding: '0.35rem 0.65rem',
        borderRadius: 999,
        border: '1px solid var(--border-light)',
        background: color ? `${color}22` : 'rgba(255,255,255,0.05)',
        color: color ?? 'var(--text-secondary)',
        fontSize: '0.74rem',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function SessionCard({ prediction }: { prediction: WeekendPrediction }) {
  const tone = sourceTone(prediction.resultSource);

  return (
    <article
      className="glass-panel"
      style={{
        padding: '1rem',
        display: 'grid',
        gap: '0.85rem',
        background: prediction.status === 'live' ? 'rgba(21, 209, 204, 0.08)' : 'rgba(255,255,255,0.035)',
        borderColor: prediction.status === 'live' ? 'rgba(21, 209, 204, 0.35)' : 'var(--border-light)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: tone.color, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <Flag size={14} />
            <span>{tone.label}</span>
          </div>
          <h3 style={{ margin: '0.35rem 0 0', fontSize: '1.2rem' }}>{prediction.label}</h3>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {formatSchedule(prediction.scheduledAt)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong style={{ color: prediction.confidence ? 'var(--accent-cyan)' : 'var(--text-muted)', fontSize: '1.25rem' }}>
            {prediction.confidence ? `${prediction.confidence}%` : '--'}
          </strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase' }}>confidence</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase' }}>Prediction</div>
          <div style={{ marginTop: '0.25rem', fontSize: '1.7rem', fontWeight: 900, color: prediction.winner === 'N/A' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {prediction.winner}
          </div>
        </div>
        <Chip color={tone.color}>{prediction.status.replace('_', ' ')}</Chip>
      </div>

      {prediction.podium.length ? (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          {prediction.podium.map((driver, index) => (
            <Chip key={`${prediction.id}-${driver}`} color={index === 0 ? 'var(--accent-f1)' : undefined}>
              {index + 1}. {driver}
            </Chip>
          ))}
        </div>
      ) : null}

      <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: '0.84rem' }}>
        {prediction.unavailableReason ?? prediction.basis}
      </p>

      {prediction.liveSignals.length ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {prediction.liveSignals.slice(0, 2).map((signal) => (
            <div key={signal} style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.35 }}>
              {signal}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function PredictionStudio() {
  const [form, setForm] = useState<PredictionFormState>({
    grandPrix: DEFAULT_GP,
    year: String(new Date().getUTCFullYear()),
  });
  const [forecast, setForecast] = useState<PredictionForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debouncedForm, setDebouncedForm] = useState(form);

  const sourceLabel = useMemo(() => getPredictionSourceLabel(), []);
  const weekend = forecast?.weekend ?? [];
  const racePrediction = weekend.find((entry) => entry.id === 'race');

  // Auto-detect the next race from the API on mount
  useEffect(() => {
    fetch('/api/schedule/next-race', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { next_race?: { session_name?: string } } | null) => {
        const name = data?.next_race?.session_name;
        if (name) {
          setForm((current) => ({ ...current, grandPrix: name }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedForm(form), 250);
    return () => window.clearTimeout(handle);
  }, [form]);

  useEffect(() => {
    let cancelled = false;

    async function loadForecast() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPredictionForecast({
          grandPrix: debouncedForm.grandPrix || DEFAULT_GP,
          year: debouncedForm.year ? Number(debouncedForm.year) : undefined,
        });
        if (!cancelled) setForecast(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load forecast');
          setForecast(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadForecast();
    const intervalId = window.setInterval(loadForecast, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [debouncedForm]);

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <p style={{ margin: 0, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.4px', fontSize: '0.75rem' }}>
            Prediction Studio
          </p>
          <h2 style={{ margin: '0.4rem 0 0', fontSize: '1.9rem' }}>
            {forecast?.title ?? `${form.grandPrix} Forecast`}
          </h2>
          <p style={{ margin: '0.6rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 850 }}>
            Session-by-session predictions for practice, sprint qualifying, qualifying, and the race. During a live session, OpenF1 lap data and race-control signals reweight the cards automatically.
          </p>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'end' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Live Source</span>
          <strong>{sourceLabel}</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'minmax(260px, 1fr) 120px auto', alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: '0.4rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Grand Prix</span>
          <input
            value={form.grandPrix}
            onChange={(e) => setForm((current) => ({ ...current, grandPrix: e.target.value }))}
            placeholder="e.g. Canadian Grand Prix"
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.4rem' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Year</span>
          <input
            value={form.year}
            onChange={(e) => setForm((current) => ({ ...current, year: e.target.value }))}
            inputMode="numeric"
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" style={buttonStyle} onClick={() => setForm((current) => ({ ...current, grandPrix: DEFAULT_GP }))}>
            <CalendarRange size={16} style={{ display: 'inline', marginRight: '0.45rem' }} />
            Next GP
          </button>
          <button type="button" style={buttonStyle} onClick={() => setDebouncedForm({ ...form })}>
            <RefreshCw size={16} style={{ display: 'inline', marginRight: '0.45rem' }} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? <div style={{ padding: '0.75rem 0', color: 'var(--text-secondary)' }}>Building live weekend forecast...</div> : null}

      {error ? (
        <div style={{ padding: '0.9rem 1rem', borderRadius: 8, border: '1px solid rgba(234, 51, 35, 0.35)', background: 'rgba(234, 51, 35, 0.08)' }}>
          {error}
        </div>
      ) : null}

      {forecast ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <section className="glass-panel" style={{ padding: '1.3rem', background: 'rgba(0, 147, 204, 0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1rem', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                  <Chip color="var(--accent-cyan)">{forecast.weekendStatus?.circuit ?? 'Miami'}</Chip>
                  <Chip>{forecast.weekendStatus?.location ?? 'Miami Gardens'}</Chip>
                  <Chip>{forecast.matchedBy}</Chip>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.8rem' }}>{forecast.raceName}</h3>
                <p style={{ margin: '0.55rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{forecast.narrative}</p>
              </div>
              <div style={{ minWidth: 220 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>Race winner model</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.35rem' }}>
                  <Trophy size={24} color="var(--accent-f1)" />
                  <strong style={{ fontSize: '2rem' }}>{racePrediction?.winner ?? forecast.winner}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.45rem', color: 'var(--text-secondary)' }}>
                  <Gauge size={14} />
                  <span>{racePrediction?.confidence ?? forecast.confidence}% confidence</span>
                </div>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {weekend.map((prediction) => (
              <SessionCard key={prediction.id} prediction={prediction} />
            ))}
          </div>

          <section className="glass-panel" style={{ padding: '1.1rem', display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
              <Activity size={14} />
              <span>Model inputs</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {forecast.factors.map((factor) => <Chip key={factor}>{factor}</Chip>)}
              {forecast.sources.map((source) => <Chip key={source}>{source}</Chip>)}
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Data signals: {forecast.dataSignals.latestRaceWinner ? `latest race winner ${forecast.dataSignals.latestRaceWinner}` : 'no latest race'}{' '}
              {forecast.dataSignals.sameRoundWinner ? `- race history ${forecast.dataSignals.sameRoundWinner}` : ''}
              {forecast.dataSignals.liveLeader ? `- live leader ${forecast.dataSignals.liveLeader}` : '- no live leader yet'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Updated {formatUpdatedAt(forecast.updatedAt)}. The cards refresh every 30 seconds while this tab is open.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
