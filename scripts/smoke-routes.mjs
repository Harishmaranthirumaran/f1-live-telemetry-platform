const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

async function assertOk(path, expectedContentType) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${path} failed with ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (expectedContentType && !contentType.includes(expectedContentType)) {
    throw new Error(`${path} returned unexpected content-type: ${contentType}`);
  }

  const body = await res.text();
  if (!body) {
    throw new Error(`${path} returned empty body`);
  }

  if (expectedContentType === 'application/json') {
    try {
      JSON.parse(body);
    } catch {
      throw new Error(`${path} returned invalid JSON`);
    }
  } else if (body.length < 20) {
    throw new Error(`${path} returned unexpectedly short HTML`);
  }

  return { path, status: res.status, contentType };
}

async function main() {
  const checks = [
    ['/', 'text/html'],
    ['/replay', 'text/html'],
    ['/pitwall', 'text/html'],
    ['/api/sessions?year=2025', 'application/json'],
    ['/api/replay/2025/1', 'application/json'],
    ['/api/telemetry', 'application/json'],
    ['/api/standings', 'application/json'],
  ];

  for (const [path, contentType] of checks) {
    const result = await assertOk(path, contentType);
    console.log(`OK ${result.path} (${result.status})`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
