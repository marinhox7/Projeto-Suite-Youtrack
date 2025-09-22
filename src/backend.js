// Token e configuração baseados no Power BI
const YOUTRACK_TOKEN = "perm:cGF1bG8uY2FybW8=.NTQtMjE=.xa5rEHDbhR4wC7oVKOQiTWFwohmtWc";
const BASE_URL = "https://braiphub.youtrack.cloud/api/issues";

async function fetchYouTrackData(query = '') {
  try {
    // Construir URL similar ao Power BI
    const fields = "id,created,resolved,idReadable,customFields(name,value(name,id,presentation))";
    const encodedQuery = query ? `&query=${encodeURIComponent(query)}` : '';
    const url = `${BASE_URL}?fields=${fields}${encodedQuery}&$top=1000`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${YOUTRACK_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`YouTrack API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados do YouTrack:', error);
    throw error;
  }
}

function getCustomFieldValue(customFields, fieldName) {
  if (!customFields || !Array.isArray(customFields)) return null;

  const field = customFields.find(f => f.name === fieldName);
  if (!field || !field.value) return null;

  if (fieldName === "State") {
    return field.value.name || field.value;
  }

  return field.value.name || field.value.presentation || field.value;
}

function categorizeState(state) {
  if (!state) return 'unknown';

  const stateUpper = state.toUpperCase();

  // Estados resolvidos/fechados
  if (['DONE', 'PRODUCTION', 'CLOSED', 'PAUSED', 'FIXED', 'RESOLVED'].includes(stateUpper)) {
    return 'resolved';
  }

  // Estados em progresso
  if (['IN DEVELOPMENT', 'DEVELOPMENT', 'REVIEWING', 'READY TO REVIEW', 'TESTING', 'UNDER REVIEW', 'CORRECTION'].includes(stateUpper)) {
    return 'in_progress';
  }

  // Estados abertos
  if (['OPEN', 'NEW', 'SUBMITTED', 'TO DO', 'BACKLOG', 'APPROVED'].includes(stateUpper)) {
    return 'open';
  }

  return 'other';
}

async function calculateStats(ctx) {
  try {
    console.log('Buscando dados do YouTrack...');

    // Buscar todas as issues (similar ao Power BI)
    const allIssues = await fetchYouTrackData();

    console.log(`Total de issues encontradas: ${allIssues.length}`);

    // Categorizar issues por estado
    const categorized = {
      resolved: 0,
      open: 0,
      in_progress: 0,
      other: 0
    };

    allIssues.forEach(issue => {
      const state = getCustomFieldValue(issue.customFields, "State");
      const category = categorizeState(state);
      categorized[category]++;
    });

    const totalIssues = allIssues.length;
    const resolvedCount = categorized.resolved;
    const openCount = categorized.open;
    const progressCount = categorized.in_progress;
    const activeIssues = totalIssues - resolvedCount;
    const completionRate = totalIssues > 0 ? (resolvedCount / totalIssues) * 100 : 0;

    return {
      totalIssues,
      resolvedIssues: resolvedCount,
      activeIssues,
      openIssues: openCount,
      inProgressIssues: progressCount,
      completionRate
    };
  } catch (error) {
    console.error('Erro ao calcular estatísticas:', error);

    // Fallback para dados mock se a API falhar
    return {
      totalIssues: 0,
      resolvedIssues: 0,
      activeIssues: 0,
      openIssues: 0,
      inProgressIssues: 0,
      completionRate: 0,
      error: 'Erro ao conectar com API: ' + error.message
    };
  }
}

exports.httpHandler = {
  endpoints: [
    {
      method: 'GET',
      path: 'debug',
      handle: function handle(ctx) {
        // See https://www.jetbrains.com/help/youtrack/devportal-apps/apps-reference-http-handlers.html#request
        const requestParam = ctx.request.getParameter('test');
        // See https://www.jetbrains.com/help/youtrack/devportal-apps/apps-reference-http-handlers.html#response
        ctx.response.json({test: requestParam});
      }
    },
    {
      method: 'GET',
      path: 'stats',
      handle: async function handle(ctx) {
        try {
          const stats = await calculateStats(ctx);
          ctx.response.json(stats);
        } catch (error) {
          ctx.response.setStatus(500);
          ctx.response.json({
            error: 'Erro ao buscar estatísticas do YouTrack',
            message: error.message
          });
        }
      }
    }
  ]
};
