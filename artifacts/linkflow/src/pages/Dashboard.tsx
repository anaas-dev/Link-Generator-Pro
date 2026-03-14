import { 
  useGetAnalyticsSummary, 
  useGetClicksOverTime, 
  useGetTopLinks,
  useGetCampaigns
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MousePointerClick, Link as LinkIcon, Megaphone, TrendingUp, Trophy, ArrowUpRight, Activity } from "lucide-react";
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
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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
        {trend && trend > 0 && (
          <span className="flex items-center text-xs font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend}%
          </span>
        )}
      </div>
      {trendLabel && <p className="text-sm text-muted-foreground mt-2">{trendLabel}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetAnalyticsSummary();
  const { data: clicksData, isLoading: loadingClicks } = useGetClicksOverTime();
  const { data: topLinks, isLoading: loadingTopLinks } = useGetTopLinks({ query: { limit: 5 } });
  const { data: campaigns } = useGetCampaigns();

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

  const trend = summary?.clicksLastMonth 
    ? Math.round(((summary.clicksThisMonth - summary.clicksLastMonth) / summary.clicksLastMonth) * 100)
    : 0;

  // Prepare dummy data for the mini bar chart card
  const monthComparisonData = [
    { name: "Last Month", clicks: summary?.clicksLastMonth || 0 },
    { name: "This Month", clicks: summary?.clicksThisMonth || 0 }
  ];

  // Maximum clicks for progress bar
  const maxClicks = topLinks && topLinks.length > 0 ? Math.max(...topLinks.map(l => l.clickCount)) : 1;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1 font-medium">Good morning 👋</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl text-sm font-semibold text-primary border border-border shadow-[0_1px_3px_rgba(0,0,0,0.06)] cursor-pointer hover:shadow-[0_4px_12px_rgba(0,0,0,0.04)] transition-all">
          <Activity className="w-4 h-4" />
          Live Metrics
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Clicks (30d)" 
          value={summary?.totalClicks?.toLocaleString() || "0"} 
          icon={MousePointerClick}
          trend={trend}
          colorClass="bg-[#4f8ef7]/10 text-[#4f8ef7]"
          gradientClass="bg-gradient-to-r from-[#4f8ef7] to-[#4f8ef7]/60"
        />
        <StatCard 
          title="Active Links" 
          value={summary?.totalLinks?.toLocaleString() || "0"} 
          icon={LinkIcon}
          colorClass="bg-[#f97316]/10 text-[#f97316]"
          gradientClass="bg-gradient-to-r from-[#f97316] to-[#f97316]/60"
        />
        <StatCard 
          title="Total Campaigns" 
          value={summary?.totalCampaigns?.toLocaleString() || "0"} 
          icon={Megaphone}
          colorClass="bg-purple-500/10 text-purple-600"
          gradientClass="bg-gradient-to-r from-purple-500 to-purple-400"
        />
        
        {/* 4th row mini bar chart */}
        <div className="bg-card rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
             <h3 className="font-medium text-muted-foreground uppercase tracking-[0.05em] text-xs">Vs Last Month</h3>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-card rounded-2xl p-6 md:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] border border-border flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">Clicks Over Time</h2>
              <p className="text-sm text-muted-foreground mt-1">Performance over the last 30 days</p>
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
                    
                    <div className="w-full h-1 bg-muted rounded-full mt-2 mb-3 overflow-hidden">
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
    </AppLayout>
  );
}
