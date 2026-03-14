import { useState } from "react";
import { 
  useGetAnalyticsSummary, 
  useGetClicksOverTime, 
  useGetTopLinks,
  useGetCampaigns
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MousePointerClick, Link as LinkIcon, Megaphone, TrendingUp, Trophy, ArrowUpRight, Activity, Download, Calendar, Users } from "lucide-react";
import { 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  Cell
} from "recharts";
import { format, parseISO, subDays } from "date-fns";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

function StatCard({ title, value, icon: Icon, trend, trendLabel, colorClass, gradientClass }: any) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border transition-all duration-200 hover:-translate-y-1 relative overflow-hidden group">
      <div className={cn("absolute top-0 left-0 right-0 h-[3px]", gradientClass)} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-muted-foreground uppercase tracking-[0.05em] text-xs">{title}</h3>
        <div className={cn("p-2.5 rounded-xl", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-4xl font-display font-bold text-foreground">{value}</p>
        {trend !== undefined && trend !== null && !isNaN(trend) && (
          <span className={cn(
            "flex items-center text-xs font-semibold px-2 py-1 rounded-full",
            trend >= 0 ? "text-[#10b981] bg-[#10b981]/10" : "text-red-500 bg-red-50"
          )}>
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      {trendLabel && <p className="text-sm text-muted-foreground mt-2">{trendLabel}</p>}
    </div>
  );
}

function downloadReport(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.click();
}

export default function Dashboard() {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [showCustom, setShowCustom] = useState(false);

  const queryParams = showCustom && customStart && customEnd
    ? { startDate: customStart, endDate: customEnd }
    : { days: selectedDays };

  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary({ query: queryParams });
  const { data: clicksData, isLoading: loadingClicks } = useGetClicksOverTime({ query: queryParams });
  const { data: topLinks, isLoading: loadingTopLinks } = useGetTopLinks({ query: { limit: 5 } });
  const { data: campaigns } = useGetCampaigns();

  const baseUrl = import.meta.env.BASE_URL?.replace(/\/$/, "");
  const apiBase = `${window.location.origin}${baseUrl}/api`;

  const buildReportUrl = (path: string) => {
    const params = new URLSearchParams();
    if (showCustom && customStart && customEnd) {
      params.set("startDate", customStart);
      params.set("endDate", customEnd);
    } else {
      params.set("days", String(selectedDays));
    }
    return `${apiBase}${path}?${params.toString()}`;
  };

  if (loadingSummary || loadingClicks || loadingTopLinks) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-10 w-48 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-2xl"></div>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-muted rounded-2xl"></div>
            <div className="h-96 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const uniqueTrend = summary?.uniqueClicksLastPeriod
    ? Math.round(((summary.uniqueClicksThisPeriod - summary.uniqueClicksLastPeriod) / summary.uniqueClicksLastPeriod) * 100)
    : null;

  const periodLabel = showCustom && customStart && customEnd
    ? `${customStart} → ${customEnd}`
    : `last ${selectedDays} days`;

  const monthComparisonData = [
    { name: "Prev Period", clicks: summary?.uniqueClicksLastPeriod || 0 },
    { name: "This Period", clicks: summary?.uniqueClicksThisPeriod || 0 }
  ];

  const maxClicks = topLinks && topLinks.length > 0 ? Math.max(...topLinks.map(l => l.clickCount)) : 1;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1 font-medium">Welcome back 👋</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadReport(buildReportUrl("/reports/all"))}
            className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl text-sm font-semibold text-foreground border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer hover:bg-[#4f8ef7] hover:text-white hover:border-[#4f8ef7] transition-all"
          >
            <Download className="w-4 h-4" />
            Full Report
          </button>
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl text-sm font-semibold text-primary border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <Activity className="w-4 h-4" />
            Live Metrics
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white px-4 py-3 rounded-2xl border border-border shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium mr-1">Filter:</span>
        {DATE_PRESETS.map(p => (
          <button
            key={p.days}
            onClick={() => { setSelectedDays(p.days); setShowCustom(false); }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              !showCustom && selectedDays === p.days
                ? "bg-[#4f8ef7] text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
            showCustom ? "bg-[#f97316] text-white shadow-sm" : "text-muted-foreground hover:bg-muted/60"
          )}
        >
          Custom
        </button>
        {showCustom && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]/30"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#4f8ef7]/30"
            />
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground hidden sm:block">{periodLabel}</span>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Unique Clicks" 
          value={summary?.uniqueClicksThisPeriod?.toLocaleString() || "0"} 
          icon={Users}
          trend={uniqueTrend}
          trendLabel={`vs previous ${showCustom ? "period" : selectedDays + "d"}`}
          colorClass="bg-[#4f8ef7]/10 text-[#4f8ef7]"
          gradientClass="bg-gradient-to-r from-[#4f8ef7] to-[#4f8ef7]/60"
        />
        <StatCard 
          title="Total Clicks (all time)" 
          value={summary?.totalClicks?.toLocaleString() || "0"} 
          icon={MousePointerClick}
          colorClass="bg-[#f97316]/10 text-[#f97316]"
          gradientClass="bg-gradient-to-r from-[#f97316] to-[#f97316]/60"
        />
        <StatCard 
          title="Active Links" 
          value={summary?.totalLinks?.toLocaleString() || "0"} 
          icon={LinkIcon}
          colorClass="bg-purple-500/10 text-purple-600"
          gradientClass="bg-gradient-to-r from-purple-500 to-purple-400"
        />
        
        {/* 4th card: mini bar chart comparison */}
        <div className="bg-card rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-muted-foreground uppercase tracking-[0.05em] text-xs">Unique Clicks Comparison</h3>
          </div>
          <div className="h-[60px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthComparisonData}>
                <RechartsTooltip 
                  cursor={{fill: 'transparent'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)', padding: '4px 8px', fontSize: '12px' }}
                />
                <Bar dataKey="clicks" radius={[4, 4, 4, 4]}>
                  {monthComparisonData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 1 ? '#4f8ef7' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {summary?.uniqueClicksLastPeriod || 0} → {summary?.uniqueClicksThisPeriod || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">Unique Clicks Over Time</h2>
              <p className="text-sm text-muted-foreground mt-1">One click per visitor per link · {periodLabel}</p>
            </div>
          </div>
          
          <div className="flex-1 min-h-[300px] w-full">
            {clicksData && clicksData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clicksData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f8ef7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#4f8ef7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontWeight: 500 }}
                  />
                  <RechartsTooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                      backgroundColor: '#ffffff'
                    }}
                    labelFormatter={(val) => format(parseISO(val as string), 'MMM d, yyyy')}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="#4f8ef7" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorClicks)" 
                    activeDot={{ r: 6, fill: "#f97316", stroke: "#ffffff", strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Not enough data yet.
              </div>
            )}
          </div>
        </div>

        {/* Top Links Sidebar */}
        <div className="bg-card rounded-2xl p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#f97316]" />
              Top Links
            </h2>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {topLinks && topLinks.length > 0 ? (
              topLinks.map((link, i) => {
                const cmp = campaigns?.find(c => c.name === link.campaignName);
                const rank = i + 1;
                const isFirst = rank === 1;
                const progressWidth = `${Math.max(5, (link.clickCount / maxClicks) * 100)}%`;
                const shortUrl = `${window.location.origin}/api/r/${link.slug}`;
                
                return (
                  <div key={link.id} className={cn(
                    "group p-4 rounded-2xl bg-muted/20 hover:bg-white transition-all border border-transparent hover:border-border hover:shadow-sm cursor-pointer relative overflow-hidden",
                    isFirst ? "border-l-4 border-l-[#f59e0b] pl-3" : ""
                  )}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className={cn(
                          "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                          isFirst ? "bg-[#f59e0b]" : "bg-muted-foreground/40"
                        )}>
                          {rank}
                        </span>
                        <h3 className="font-semibold text-sm text-foreground truncate" title={link.title}>{link.title}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-bold text-[#f97316]">
                        {link.clickCount.toLocaleString()}
                        <MousePointerClick className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    {/* Short link preview */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-[10px] font-mono text-[#4f8ef7] bg-[#4f8ef7]/8 px-2 py-0.5 rounded-md truncate max-w-[160px]" title={shortUrl}>
                        /r/{link.slug}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(shortUrl); }}
                        className="text-muted-foreground hover:text-[#4f8ef7] transition-colors"
                        title="Copy short link"
                      >
                        <LinkIcon className="w-3 h-3" />
                      </button>
                    </div>
                    
                    <div className="w-full h-1 bg-muted rounded-full mb-3 overflow-hidden">
                      <div className="h-full bg-[#4f8ef7] rounded-full transition-all duration-500" style={{ width: progressWidth }} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {link.campaignName ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md border border-border bg-white flex items-center gap-1.5 uppercase tracking-wide">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cmp?.color || '#ccc' }}></span>
                            {link.campaignName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">No campaign</span>
                        )}
                      </div>
                      <a href={link.destinationUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-[#4f8ef7] transition-colors">
                        <ArrowUpRight className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <LinkIcon className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p>No links created yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Campaign Reports Section */}
      {campaigns && campaigns.length > 0 && (
        <div className="mt-6 bg-card rounded-2xl p-6 border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold flex items-center gap-2">
              <Download className="w-5 h-5 text-[#4f8ef7]" />
              Campaign Reports
            </h2>
            <span className="text-xs text-muted-foreground">{periodLabel}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {campaigns.map(campaign => (
              <button
                key={campaign.id}
                onClick={() => downloadReport(buildReportUrl(`/reports/campaign/${campaign.id}`))}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-medium text-foreground hover:bg-[#f97316] hover:text-white hover:border-[#f97316] transition-all shadow-sm"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: campaign.color || '#4f8ef7' }}
                />
                {campaign.name}
                <Download className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
