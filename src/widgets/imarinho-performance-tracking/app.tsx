import React, {memo, useCallback, useEffect, useState} from 'react';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

interface IssueStats {
  totalIssues: number;
  resolvedIssues: number;
  activeIssues: number;
  completionRate: number;
  openIssues: number;
  inProgressIssues: number;
  error?: string;
  projects?: string[];
}

const API_ERROR_MESSAGE = 'Dados de demonstracao (falha na API do YouTrack)';
const BACKEND_ERROR_MESSAGE = 'Dados de demonstracao (backend indisponivel)';

function generateMockStats(): IssueStats {
  const baseTotal = 120 + Math.floor(Math.random() * 60);
  const resolvedCount = Math.floor(baseTotal * (0.55 + Math.random() * 0.25));
  const openCount = Math.floor((baseTotal - resolvedCount) * (0.4 + Math.random() * 0.3));
  const progressCount = Math.max(0, (baseTotal - resolvedCount) - openCount);

  return {
    totalIssues: baseTotal,
    resolvedIssues: resolvedCount,
    activeIssues: baseTotal - resolvedCount,
    openIssues: openCount,
    inProgressIssues: progressCount,
    completionRate: Math.round((resolvedCount / baseTotal) * 1000) / 10
  };
}

const AppComponent: React.FunctionComponent = () => {
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Fetching real data from YouTrack...');
      const result = await host.fetchApp('backend/stats', {scope: true}) as IssueStats;

      if (!result) {
        throw new Error('Backend returned empty payload');
      }

      if (result.error) {
        console.warn('Backend reported error:', result.error);
        setStats(generateMockStats());
        setError(result.error || API_ERROR_MESSAGE);
        return;
      }

      const normalized: IssueStats = {
        totalIssues: result.totalIssues ?? 0,
        resolvedIssues: result.resolvedIssues ?? 0,
        activeIssues: result.activeIssues ?? 0,
        openIssues: result.openIssues ?? 0,
        inProgressIssues: result.inProgressIssues ?? 0,
        completionRate: typeof result.completionRate === 'number' ? result.completionRate : 0,
        projects: result.projects
      };

      console.log('YouTrack stats loaded:', normalized);
      setStats(normalized);
      setError(null);
    } catch (err) {
      console.warn('Falling back to mock data:', err);
      setStats(generateMockStats());
      const message = err instanceof Error ? err.message : BACKEND_ERROR_MESSAGE;
      setError(message || BACKEND_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="widget">
        <LoaderInline />
        <span>Carregando estatisticas...</span>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="widget">
        <div className="error">{error}</div>
        <Button onClick={fetchStats}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="widget">
      <h2>Dashboard YouTrack - Estatisticas</h2>
      {error && stats && (
        <div className="info-banner" style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          color: '#856404',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Atencao: {error}
        </div>
      )}
      {!error && stats && (
        <div className="success-banner" style={{
          background: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          color: '#155724',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          Tudo certo. Dados reais do YouTrack carregados.
          {stats.projects && stats.projects.length > 0 && (
            <div style={{marginTop: '8px', fontSize: '12px'}}>
              Projetos processados: {stats.projects.join(', ')}
            </div>
          )}
        </div>
      )}
      {stats && (
        <div className="stats-container">
          <div className="stat-card">
            <h3>Total de Issues</h3>
            <div className="stat-value">{stats.totalIssues}</div>
          </div>
          <div className="stat-card">
            <h3>Issues Resolvidas</h3>
            <div className="stat-value resolved">{stats.resolvedIssues}</div>
          </div>
          <div className="stat-card">
            <h3>Issues Ativas</h3>
            <div className="stat-value active">{stats.activeIssues}</div>
          </div>
          <div className="stat-card">
            <h3>Issues Abertas</h3>
            <div className="stat-value open">{stats.openIssues}</div>
          </div>
          <div className="stat-card">
            <h3>Issues em Progresso</h3>
            <div className="stat-value progress">{stats.inProgressIssues}</div>
          </div>
          <div className="stat-card">
            <h3>Taxa de Conclusao</h3>
            <div className="stat-value completion">{stats.completionRate.toFixed(1)}%</div>
          </div>
        </div>
      )}
      <div className="actions">
        <Button primary onClick={fetchStats}>Atualizar Dados</Button>
        <Button onClick={async () => {
          setTestResult(null);
          try {
            console.log('Checking backend connectivity...');
            const result = await host.fetchApp('backend/debug', {query: {test: 'connection'}, scope: true});
            console.log('Debug endpoint result:', result);
            setTestResult('Sucesso: ' + JSON.stringify(result));
            setTimeout(() => setTestResult(null), 5000);
          } catch (err) {
            console.error('Backend test failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
            setTestResult('Falha: ' + errorMessage);
            setTimeout(() => setTestResult(null), 5000);
          }
        }}>Testar Backend</Button>
      </div>
      {testResult && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '14px',
          textAlign: 'center',
          background: testResult.startsWith('Sucesso') ? '#d4edda' : '#f8d7da',
          border: testResult.startsWith('Sucesso') ? '1px solid #c3e6cb' : '1px solid #f5c6cb',
          color: testResult.startsWith('Sucesso') ? '#155724' : '#721c24'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
