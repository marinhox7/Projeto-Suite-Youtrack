const {YouTrackClient} = require('../utils/youtrack-client');

const RESOLVED_STATES = new Set([
  'done',
  'fixed',
  'closed',
  'resolved',
  'complete',
  'completed',
  'released',
  'production',
  'archived'
]);

const IN_PROGRESS_STATES = new Set([
  'in progress',
  'in development',
  'development',
  'reviewing',
  'ready to review',
  'testing',
  'under review',
  'qa',
  'verification',
  'correction'
]);

function getConfig() {
  const token = process.env.YOUTRACK_API_TOKEN || process.env.YOUTRACK_TOKEN;
  const host = process.env.YOUTRACK_API_URL || process.env.YOUTRACK_BASE_URL || process.env.YOUTRACK_HOST;

  if (!token) {
    throw new Error('YouTrack token (YOUTRACK_API_TOKEN or YOUTRACK_TOKEN) is required');
  }
  if (!host) {
    throw new Error('YouTrack host (YOUTRACK_HOST) is required');
  }

  return {token, host};
}

function getClient() {
  const {token, host} = getConfig();
  return new YouTrackClient({host, token});
}

function extractState(issue) {
  if (!issue || typeof issue !== 'object') {
    return null;
  }

  if (issue.state) {
    const state = issue.state;
    if (typeof state === 'string') {
      return state;
    }
    if (typeof state === 'object') {
      return state.name || state.presentation || state.localizedName || null;
    }
  }

  if (Array.isArray(issue.customFields)) {
    const stateField = issue.customFields.find(field => field && field.name === 'State');
    if (stateField && stateField.value) {
      if (typeof stateField.value === 'string') {
        return stateField.value;
      }
      if (typeof stateField.value === 'object') {
        return stateField.value.name || stateField.value.presentation || null;
      }
    }
  }

  return null;
}

function categorizeState(stateName) {
  if (!stateName) {
    return 'other';
  }
  const normalized = stateName.toLowerCase();
  if (RESOLVED_STATES.has(normalized)) {
    return 'resolved';
  }
  if (IN_PROGRESS_STATES.has(normalized)) {
    return 'in_progress';
  }
  return 'open';
}

function filterProjects(projects, requestedProject) {
  if (!requestedProject) {
    return projects;
  }
  const searched = requestedProject.trim().toLowerCase();
  const filtered = projects.filter(project => {
    const candidates = [project.id, project.name, project.shortName];
    return candidates.filter(Boolean).some(value => value.toLowerCase() === searched);
  });

  if (filtered.length === 0) {
    throw new Error(`Project "${requestedProject}" not found or not accessible with current permissions`);
  }

  return filtered;
}

async function collectIssuesForProject(client, project) {
  const query = `project: {${project.shortName || project.id}}`;
  return client.getAllIssues({
    query,
    fields: 'id,customFields(name,value(name,presentation)),state(name,presentation)'
  });
}

async function computeStats({project}) {
  const client = getClient();
  const projects = await client.getAllProjects();
  const scopedProjects = filterProjects(projects, project);

  let totalIssues = 0;
  let resolvedIssues = 0;
  let inProgressIssues = 0;

  for (const current of scopedProjects) {
    const issues = await collectIssuesForProject(client, current);
    totalIssues += issues.length;

    issues.forEach(issue => {
      const category = categorizeState(extractState(issue));
      if (category === 'resolved') {
        resolvedIssues += 1;
      } else if (category === 'in_progress') {
        inProgressIssues += 1;
      }
    });
  }

  const activeIssues = totalIssues - resolvedIssues;
  const openIssues = Math.max(0, activeIssues - inProgressIssues);
  const completionRate = totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0;

  return {
    totalIssues,
    resolvedIssues,
    activeIssues,
    openIssues,
    inProgressIssues,
    completionRate,
    projects: scopedProjects.map(project => project.shortName || project.name)
  };
}

exports.httpHandler = {
  endpoints: [
    {
      method: 'GET',
      path: 'debug',
      handle: function handle(ctx) {
        const testParam = ctx.request && ctx.request.getParameter ? ctx.request.getParameter('test') : undefined;
        ctx.response.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          test: testParam || null
        });
      }
    },
    {
      method: 'GET',
      path: 'stats',
      handle: async function handle(ctx) {
        try {
          const project = ctx.request && ctx.request.getParameter ? ctx.request.getParameter('project') : undefined;
          const stats = await computeStats({project});
          ctx.response.json(stats);
        } catch (error) {
          console.error('Failed to compute YouTrack stats:', error);
          ctx.response.setStatus(500);
          ctx.response.json({
            error: 'Erro ao buscar estatisticas do YouTrack',
            message: error.message
          });
        }
      }
    }
  ]
};
