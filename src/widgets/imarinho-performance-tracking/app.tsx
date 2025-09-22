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
      console.log('Buscando dados reais do YouTrack...');
      // Agora que sabemos que o backend funciona, vamos buscar dados reais
      const result = await host.fetchApp('backend/stats', {scope: true}) as IssueStats;

      if (result.error) {
        console.warn('Backend retornou erro:', result.error);

        // Fallback para dados mock se houver erro na API
        const baseTotal = 120 + Math.floor(Math.random() * 60);
        const resolvedCount = Math.floor(baseTotal * (0.55 + Math.random() * 0.25));
        const openCount = Math.floor((baseTotal - resolvedCount) * (0.4 + Math.random() * 0.3));
        const progressCount = Math.max(0, (baseTotal - resolvedCount) - openCount);

        const mockStats: IssueStats = {
          totalIssues: baseTotal,
          resolvedIssues: resolvedCount,
          activeIssues: baseTotal - resolvedCount,
          openIssues: openCount,
          inProgressIssues: progressCount,
          completionRate: Math.round((resolvedCount / baseTotal) * 100 * 10) / 10
        };

        setStats(mockStats);
        setError('Dados de demonstração (Erro na API do YouTrack)');
      } else {
        console.log('Dados reais obtidos com sucesso:', result);
        setStats(result);
        setError(null); // Sem erro = dados reais
      }
    } catch (err) {
      console.warn('Erro ao conectar com backend, usando dados mock:', err);

      // Fallback para dados mock se fetchApp falhar
      const baseTotal = 120 + Math.floor(Math.random() * 60);
      const resolvedCount = Math.floor(baseTotal * (0.55 + Math.random() * 0.25));
      const openCount = Math.floor((baseTotal - resolvedCount) * (0.4 + Math.random() * 0.3));
      const progressCount = Math.max(0, (baseTotal - resolvedCount) - openCount);

      const mockStats: IssueStats = {
        totalIssues: baseTotal,
        resolvedIssues: resolvedCount,
        activeIssues: baseTotal - resolvedCount,
        openIssues: openCount,
        inProgressIssues: progressCount,
        completionRate: Math.round((resolvedCount / baseTotal) * 100 * 10) / 10
      };

      setStats(mockStats);
      setError('Dados de demonstração (Backend não disponível)');
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
        <span>Carregando estatísticas...</span>
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
      <h2>Dashboard YouTrack - Estatísticas</h2>
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
          ⚠️ {error}
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
          ✅ Dados reais do YouTrack
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
            <h3>Taxa de Conclusão</h3>
            <div className="stat-value completion">{stats.completionRate.toFixed(1)}%</div>
          </div>
        </div>
      )}
      <div className="actions">
        <Button primary onClick={fetchStats}>Atualizar Dados</Button>
        <Button onClick={async () => {
          setTestResult(null);
          try {
            console.log('Testando conexão com backend...');
            const result = await host.fetchApp('backend/debug', {query: {test: 'connection'}, scope: true});
            console.log('Resultado do teste:', result);
            setTestResult('✅ Backend funcionando: ' + JSON.stringify(result));
            setTimeout(() => setTestResult(null), 5000);
          } catch (err) {
            console.error('Erro na conexão:', err);
            const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
            setTestResult('❌ Erro: ' + errorMessage);
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
          background: testResult.startsWith('✅') ? '#d4edda' : '#f8d7da',
          border: testResult.startsWith('✅') ? '1px solid #c3e6cb' : '1px solid #f5c6cb',
          color: testResult.startsWith('✅') ? '#155724' : '#721c24'
        }}>
          {testResult}
        </div>
      )}
    </div>
  );
};

export const App = memo(AppComponent);
