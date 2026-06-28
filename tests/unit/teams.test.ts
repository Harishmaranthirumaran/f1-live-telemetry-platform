import test from 'node:test';
import assert from 'node:assert/strict';

test('teams: resolveTeam matches canonical Jolpica name', async () => {
  const { resolveTeam } = await import('../../lib/constants/teams');
  const ferrari = resolveTeam('Ferrari');
  assert.ok(ferrari);
  assert.equal(ferrari?.id, 'ferrari');
  assert.equal(ferrari?.primary, '#E8002D');
});

test('teams: resolveTeam matches sponsored long form', async () => {
  const { resolveTeam } = await import('../../lib/constants/teams');
  const redBull = resolveTeam('Oracle Red Bull Racing');
  assert.equal(redBull?.id, 'red_bull');
});

test('teams: resolveTeam handles partial substring match', async () => {
  const { resolveTeam } = await import('../../lib/constants/teams');
  const rb = resolveTeam('Visa Cash App RB');
  assert.equal(rb?.id, 'racing_bulls');
});

test('teams: resolveTeam returns null for unknown team', async () => {
  const { resolveTeam } = await import('../../lib/constants/teams');
  assert.equal(resolveTeam('NotARealTeam'), null);
  assert.equal(resolveTeam(null), null);
  assert.equal(resolveTeam(''), null);
});

test('teams: every team has primary + secondary hex colors', async () => {
  const { ALL_TEAMS } = await import('../../lib/constants/teams');
  for (const team of ALL_TEAMS) {
    assert.match(team.primary, /^#[0-9A-F]{6}$/i, `${team.id} primary`);
    assert.match(team.secondary, /^#[0-9A-F]{6}$/i, `${team.id} secondary`);
    assert.ok(team.drivers.length >= 1, `${team.id} drivers`);
  }
});

test('teams: monogram is single uppercase character', async () => {
  const { ALL_TEAMS, teamMonogram } = await import('../../lib/constants/teams');
  for (const team of ALL_TEAMS) {
    const m = teamMonogram(team);
    assert.equal(m.length, 1);
    assert.equal(m, m.toUpperCase());
  }
});
