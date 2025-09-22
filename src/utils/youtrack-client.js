// YouTrack REST client helpers for backend handlers.

const DEFAULT_PAGE_SIZE = 200;

function normalizeBaseUrl(hostOrUrl) {
  if (!hostOrUrl || typeof hostOrUrl !== 'string') {
    throw new Error('YouTrack host or base URL must be provided');
  }
  let normalized = hostOrUrl.trim();
  if (!normalized) {
    throw new Error('YouTrack host or base URL must be provided');
  }
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  normalized = normalized.replace(/\/$/, '');
  if (!normalized.endsWith('/api')) {
    normalized = `${normalized}/api`;
  }
  return normalized;
}

function buildHeaders(token, extraHeaders = {}) {
  if (!token) {
    throw new Error('YouTrack permanent token must be provided');
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...extraHeaders
  };
}

function toSearchParams(searchParams = {}) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    params.append(key, String(value));
  });
  return params;
}

class YouTrackClient {
  constructor({host, baseUrl, token}) {
    this.baseUrl = normalizeBaseUrl(baseUrl || host);
    this.token = token;
  }

  buildUrl(endpoint) {
    if (!endpoint) {
      throw new Error('Endpoint is required');
    }
    if (/^https?:/i.test(endpoint)) {
      return endpoint;
    }
    const suffix = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${suffix}`;
  }

  async request(endpoint, {method = 'GET', headers, body, searchParams} = {}) {
    const url = new URL(this.buildUrl(endpoint));
    if (searchParams) {
      const params = toSearchParams(searchParams);
      if ([...params.keys()].length > 0) {
        url.search = params.toString();
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: buildHeaders(this.token, headers),
      body
    });

    if (!response.ok) {
      let details = '';
      try {
        details = await response.text();
      } catch (error) {
        details = '';
      }
      const message = details ? `${response.status} ${response.statusText}: ${details}` : `${response.status} ${response.statusText}`;
      throw new Error(`YouTrack API error (${url.pathname}): ${message}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async getProjects({fields = 'id,name,shortName', top = DEFAULT_PAGE_SIZE, skip = 0} = {}) {
    return this.request('/admin/projects', {
      searchParams: {
        fields,
        '$top': top,
        '$skip': skip
      }
    });
  }

  async getAllProjects(fields = 'id,name,shortName') {
    const projects = [];
    let skip = 0;
    while (true) {
      const batch = await this.getProjects({fields, skip});
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }
      projects.push(...batch);
      if (batch.length < DEFAULT_PAGE_SIZE) {
        break;
      }
      skip += batch.length;
    }
    return projects;
  }

  async getIssues({fields = 'id,summary,customFields(name,value(name,presentation))', query, top = DEFAULT_PAGE_SIZE, skip = 0} = {}) {
    return this.request('/issues', {
      searchParams: {
        fields,
        query,
        '$top': top,
        '$skip': skip
      }
    });
  }

  async getAllIssues(params = {}) {
    const issues = [];
    let skip = 0;
    while (true) {
      const batch = await this.getIssues({...params, skip});
      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }
      issues.push(...batch);
      if (batch.length < DEFAULT_PAGE_SIZE) {
        break;
      }
      skip += batch.length;
    }
    return issues;
  }
}

module.exports = {
  YouTrackClient,
  normalizeBaseUrl
};
