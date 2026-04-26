import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Download,
  Calendar,
  Filter,
  Loader2,
  TrendingDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Incident } from '../types';
import { SOS_TYPES, mapOldIncidentType } from '../constants';

export default function Analytics() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [frequencyRange, setFrequencyRange] = useState(7);
  const [distributionMode, setDistributionMode] = useState<'type' | 'severity' | 'status'>('type');
  const [stats, setStats] = useState({
    total: 0,
    avgResponse: 0,
    resolutionRate: 0,
    frequency: [] as any[],
    distribution: [] as any[],
    trend: [] as any[],
    totalChange: 0,
    responseTimeChange: 0,
    resolutionChange: 0
  });

  useEffect(() => {
    if (!profile?.organizationId) return;

    const q = query(
      collection(db, 'incidents'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      
      // 1. Core Metrics
      const total = data.length;
      const resolved = data.filter(i => i.status === 'resolved' || i.status === 'closed').length;
      const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

      // 2. Average Response Time
      const respondedIncidents = data.filter(i => 
        i.status !== 'reported' && 
        i.updatedAt && 
        i.createdAt && 
        i.updatedAt.toMillis() > i.createdAt.toMillis()
      );
      
      let avgResponse = 0;
      if (respondedIncidents.length > 0) {
        const totalResponseTime = respondedIncidents.reduce((acc, curr) => {
          return acc + (curr.updatedAt.toMillis() - curr.createdAt.toMillis());
        }, 0);
        avgResponse = totalResponseTime / respondedIncidents.length / 60000; // in minutes
      }

      // 3. Frequency (Dynamic Range)
      const rangeLabels = Array.from({ length: frequencyRange }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (frequencyRange - 1 - i));
        return {
          full: d.toLocaleDateString(),
          label: d.toLocaleDateString('en-US', { weekday: frequencyRange > 14 ? undefined : 'short', day: 'numeric', month: 'short' })
        };
      });

      const frequency = rangeLabels.map(day => {
        const count = data.filter(i => {
          if (!i.createdAt) return false;
          const incidentDate = i.createdAt.toDate().toLocaleDateString();
          return incidentDate === day.full;
        }).length;
        return { name: day.label, incidents: count };
      });

      // 4. Distribution (Dynamic Mode)
      let distribution: any[] = [];
      if (distributionMode === 'type') {
        distribution = SOS_TYPES.map(type => {
          const count = data.filter(i => mapOldIncidentType(i.type) === type.id).length;
          return {
            name: type.label,
            value: count,
            color: type.id === 'fire' ? '#ef4444' : 
                   type.id === 'medical' ? '#3b82f6' : 
                   type.id === 'theft' ? '#f97316' : '#64748b'
          };
        });
      } else if (distributionMode === 'severity') {
        const severities = [
          { id: 'low', label: 'Low', color: '#3b82f6' },
          { id: 'medium', label: 'Medium', color: '#f59e0b' },
          { id: 'high', label: 'High', color: '#ef4444' },
          { id: 'critical', label: 'Critical', color: '#7f1d1d' }
        ];
        distribution = severities.map(s => ({
          name: s.label,
          value: data.filter(i => i.severity === s.id).length,
          color: s.color
        }));
      } else {
        const statuses = [
          { id: 'reported', label: 'Reported', color: '#94a3b8' },
          { id: 'assigned', label: 'Assigned', color: '#3b82f6' },
          { id: 'responding', label: 'Responding', color: '#8b5cf6' },
          { id: 'escalated', label: 'Escalated', color: '#ef4444' },
          { id: 'resolved', label: 'Resolved', color: '#22c55e' }
        ];
        distribution = statuses.map(s => ({
          name: s.label,
          value: data.filter(i => i.status === s.id).length,
          color: s.color
        }));
      }

      // 5. Response Trend (Last 7 Days Fixed for Trend)
      const last7DaysLabels = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          full: d.toLocaleDateString(),
          label: d.toLocaleDateString('en-US', { weekday: 'short' })
        };
      });
      const trend = last7DaysLabels.map(day => {
        const dayIncidents = respondedIncidents.filter(i => 
          i.createdAt.toDate().toLocaleDateString() === day.full
        );
        
        let dayAvg = 0;
        if (dayIncidents.length > 0) {
          const total = dayIncidents.reduce((acc, curr) => 
            acc + (curr.updatedAt.toMillis() - curr.createdAt.toMillis()), 0
          );
          dayAvg = total / dayIncidents.length / 60000;
        }

        return {
          name: day.label,
          response: Number(dayAvg.toFixed(1))
        };
      });

      // 6. Calculate Real Trends (Current Week vs Previous Week)
      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(now.getDate() - 14);

      const currentWeekIncidents = data.filter(i => {
        if (!i.createdAt) return false;
        const d = i.createdAt.toDate();
        return d >= oneWeekAgo && d <= now;
      });

      const previousWeekIncidents = data.filter(i => {
        if (!i.createdAt) return false;
        const d = i.createdAt.toDate();
        return d >= twoWeeksAgo && d < oneWeekAgo;
      });

      const totalChange = previousWeekIncidents.length > 0 
        ? Math.round(((currentWeekIncidents.length - previousWeekIncidents.length) / previousWeekIncidents.length) * 100)
        : currentWeekIncidents.length > 0 ? 100 : 0;

      // Response Time Trend
      const calcAvgResp = (incidents: Incident[]) => {
        const resp = incidents.filter(i => i.status !== 'reported' && i.updatedAt && i.createdAt);
        if (resp.length === 0) return 0;
        return resp.reduce((acc, curr) => acc + (curr.updatedAt.toMillis() - curr.createdAt.toMillis()), 0) / resp.length / 60000;
      };

      const currentAvg = calcAvgResp(currentWeekIncidents);
      const prevAvg = calcAvgResp(previousWeekIncidents);
      const responseTimeChange = prevAvg > 0 ? Number(((currentAvg - prevAvg) / prevAvg * 100).toFixed(1)) : 0;

      // Resolution Rate Trend
      const calcResRate = (incidents: Incident[]) => {
        if (incidents.length === 0) return 0;
        const res = incidents.filter(i => i.status === 'resolved' || i.status === 'closed').length;
        return (res / incidents.length) * 100;
      };

      const currentRes = calcResRate(currentWeekIncidents);
      const prevRes = calcResRate(previousWeekIncidents);
      const resolutionChange = Number((currentRes - prevRes).toFixed(1));

      setStats({
        total,
        avgResponse: Number(avgResponse.toFixed(1)),
        resolutionRate,
        frequency,
        distribution,
        trend,
        totalChange,
        responseTimeChange,
        resolutionChange
      });
      setLoading(false);
    }, (err) => {
      console.error('Error syncing analytics:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.organizationId, frequencyRange, distributionMode]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 transition-colors duration-500">
        <Loader2 className="w-10 h-10 text-accent-emergency animate-spin" />
        <p className="text-text-secondary font-medium tracking-tight">Syncing real-time intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 transition-colors duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary mb-2 transition-colors">Crisis Analytics</h1>
          <p className="text-text-secondary font-medium tracking-tight transition-colors">Live situational awareness and performance telemetry.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Sync Active
          </div>
        </div>
      </div>

      {/* High Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
        <div className="bg-bg-secondary p-6 lg:p-8 rounded-3xl border border-card-border shadow-sm relative overflow-hidden group transition-colors">
          <div className="absolute -right-4 -top-4 w-20 lg:w-24 h-20 lg:h-24 bg-accent-emergency/5 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="bg-accent-emergency/10 p-2.5 lg:p-3 rounded-2xl">
                <AlertTriangle className="text-accent-emergency w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] lg:text-xs font-black uppercase tracking-widest",
                stats.totalChange >= 0 ? "text-accent-emergency" : "text-green-500"
              )}>
                {stats.totalChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(stats.totalChange)}%
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-black text-text-primary mb-1 transition-colors">{stats.total}</p>
            <p className="text-[10px] lg:text-xs font-bold text-text-secondary uppercase tracking-widest transition-colors">Total Incidents</p>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 lg:p-8 rounded-3xl border border-card-border shadow-sm relative overflow-hidden group transition-colors">
          <div className="absolute -right-4 -top-4 w-20 lg:w-24 h-20 lg:h-24 bg-blue-500/5 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="bg-blue-500/10 p-2.5 lg:p-3 rounded-2xl">
                <Clock className="text-blue-500 w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] lg:text-xs font-black uppercase tracking-widest",
                stats.responseTimeChange <= 0 ? "text-green-500" : "text-accent-emergency"
              )}>
                {stats.responseTimeChange <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {Math.abs(stats.responseTimeChange)}%
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-black text-text-primary mb-1 transition-colors">{stats.avgResponse}m</p>
            <p className="text-[10px] lg:text-xs font-bold text-text-secondary uppercase tracking-widest transition-colors">Avg Response Time</p>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 lg:p-8 rounded-3xl border border-card-border shadow-sm relative overflow-hidden group transition-colors">
          <div className="absolute -right-4 -top-4 w-20 lg:w-24 h-20 lg:h-24 bg-green-500/5 rounded-full opacity-50 group-hover:scale-110 transition-transform" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <div className="bg-green-500/10 p-2.5 lg:p-3 rounded-2xl">
                <CheckCircle2 className="text-green-500 w-5 h-5 lg:w-6 lg:h-6" />
              </div>
              <div className={cn(
                "flex items-center gap-1 text-[10px] lg:text-xs font-black uppercase tracking-widest",
                stats.resolutionChange >= 0 ? "text-green-500" : "text-accent-emergency"
              )}>
                {stats.resolutionChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(stats.resolutionChange)}%
              </div>
            </div>
            <p className="text-3xl lg:text-4xl font-black text-text-primary mb-1 transition-colors">{stats.resolutionRate}%</p>
            <p className="text-[10px] lg:text-xs font-bold text-text-secondary uppercase tracking-widest transition-colors">Resolution Rate</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
        <div className="bg-bg-secondary p-6 lg:p-8 rounded-3xl border border-card-border shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
            <h3 className="text-base lg:text-lg font-black text-text-primary tracking-tight transition-colors">Last {frequencyRange} Days Frequency</h3>
            <div className="flex items-center gap-2">
              <select 
                value={frequencyRange}
                onChange={(e) => setFrequencyRange(Number(e.target.value))}
                className="bg-bg-primary border-none rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary py-1.5 focus:ring-0 cursor-pointer appearance-none transition-colors"
              >
                <option value={7}>7 Days</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
              <Calendar className="text-text-secondary w-5 h-5 ml-1 opacity-50 transition-colors" />
            </div>
          </div>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.frequency}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10, opacity: 0.6 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10, opacity: 0.6 }} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  cursor={{ fill: 'var(--bg-primary)', opacity: 0.4 }}
                />
                <Bar dataKey="incidents" fill="var(--accent-emergency)" radius={[6, 6, 0, 0]} barSize={24} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 lg:p-8 rounded-3xl border border-card-border shadow-sm transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 lg:mb-8 gap-4">
            <h3 className="text-base lg:text-lg font-black text-text-primary tracking-tight transition-colors">Resource Distribution</h3>
            <div className="flex items-center gap-2">
              <select 
                value={distributionMode}
                onChange={(e) => setDistributionMode(e.target.value as any)}
                className="bg-bg-primary border-none rounded-xl text-[10px] font-black uppercase tracking-widest text-text-secondary py-1.5 focus:ring-0 cursor-pointer appearance-none transition-colors"
              >
                <option value="type">By Type</option>
                <option value="severity">By Severity</option>
                <option value="status">By Status</option>
              </select>
              <Filter className="text-text-secondary w-5 h-5 ml-1 opacity-50 transition-colors" />
            </div>
          </div>
          <div className="h-64 lg:h-80 flex flex-col sm:flex-row items-center justify-center gap-6">
            {stats.total > 0 ? (
              <>
                <div className="w-full h-full sm:flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.distribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={8}
                        dataKey="value"
                        animationDuration={1000}
                        stroke="none"
                      >
                        {stats.distribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}
                        itemStyle={{ color: 'var(--text-primary)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 lg:space-y-3 w-full sm:w-auto sm:min-w-[140px] px-4">
                  {stats.distribution.filter(d => d.value > 0).map((item) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-[10px] lg:text-xs font-bold text-text-primary transition-colors">{item.name}</span>
                      <span className="text-[10px] lg:text-xs text-text-secondary ml-auto font-black opacity-60 transition-colors">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-text-secondary opacity-30">
                <AlertTriangle className="w-12 h-12" />
                <p className="text-xs font-bold uppercase tracking-widest">No Incident Data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Response Time Trend */}
      <div className="bg-bg-secondary p-8 rounded-3xl border border-card-border shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-black text-text-primary tracking-tight transition-colors">Response Time Trend (Minutes)</h3>
          <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50 transition-colors">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Lower is better
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, opacity: 0.6 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12, opacity: 0.6 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--card-border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.2)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Line 
                type="monotone" 
                dataKey="response" 
                stroke="var(--accent-emergency)" 
                strokeWidth={4} 
                dot={{ r: 6, fill: 'var(--accent-emergency)', strokeWidth: 2, stroke: '#fff' }} 
                activeDot={{ r: 8 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
