// Read-only smoke test. It never creates, edits or deletes MongoDB data.
const baseUrl = process.env.API_URL || 'http://localhost:5000/api';

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status} ${body.message || ''}`);
  return body;
}

async function testPublicApi() {
  const health = await getJson('/health');
  console.log(`Health: ${health.status}`);

  const chalets = await getJson('/chalets');
  console.log(`Chalets disponibles: ${chalets.count}`);

  const departments = await getJson('/chalets/meta/departments');
  console.log(`Departamentos: ${departments.data.length}`);

  const destinations = await getJson('/chalets/meta/destinations');
  console.log(`Destinos: ${destinations.data.length}`);

  const hosts = await getJson('/hosts');
  console.log(`Anfitriones: ${hosts.count}`);

  if (chalets.data?.length) {
    const chaletId = chalets.data[0]._id;
    const detail = await getJson(`/chalets/${chaletId}`);
    const reviews = await getJson(`/chalets/${chaletId}/reviews`);
    console.log(`Detalle correcto: ${detail.data.title}`);
    console.log(`Reseñas del primer chalet: ${reviews.count}`);
  }

  console.log('SMOKE TEST SUPERADO');
}

testPublicApi().catch((error) => {
  console.error('SMOKE TEST FALLÓ:', error.message);
  process.exitCode = 1;
});
