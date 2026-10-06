/**
 * Test importing real ES modules from assets/js/
 */

// Setup basic global window / localStorage before importing modules
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.window = globalThis;

async function run() {
  const {
    createResource,
    getAllResources,
    getResourceById,
    getAvailableResourcesByType,
    updateResource,
    deleteResource,
    assignResource,
    releaseResource,
    setMaintenance,
    clearMaintenance,
    repairOrphans,
    searchResources,
    filterResources,
    sortResources
  } = await import('../assets/js/services/resourceService.js');

  const {
    createIncident,
    getAllIncidents,
    getIncidentById,
    updateIncidentStatus,
    registerReleaseHook
  } = await import('../assets/js/services/incidentService.js');

  console.log('Successfully imported resourceService and incidentService dynamically!');

  registerReleaseHook(releaseResource);

  // Run a quick test
  const r1 = createResource({ name: 'Test Ambulance 1', type: 'Ambulance', location: 'Gate 1' });
  console.log('Create resource result:', r1);

  const i1 = createIncident({ title: 'Test Incident Title', description: 'Test Incident Description length', type: 'Fire', priority: 'High', location: 'Gate 1', reportedBy: 'Dispatcher' });
  console.log('Create incident result:', i1);

  updateIncidentStatus(i1.incident.id, 'Active');

  const assignRes = assignResource(r1.resource.id, i1.incident.id);
  console.log('Assign resource result:', assignRes);

  updateIncidentStatus(i1.incident.id, 'In Progress');
  const resolveRes = updateIncidentStatus(i1.incident.id, 'Resolved');
  console.log('Resolve incident result:', resolveRes);

  const r1After = getResourceById(r1.resource.id);
  console.log('Resource status after incident resolve:', r1After.status, 'assignedTo:', r1After.assignedTo);
}

run().catch(console.error);
