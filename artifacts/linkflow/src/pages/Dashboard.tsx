import { 
  useGetAnalyticsSummary, 
  useGetClicksOverTime, 
  useGetTopLinks,
  useGetCampaigns
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MousePointerClick, Link as LinkIcon, Megaphone, TrendingUp, Trophy, ArrowUpRight, Activity } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

function StatCard({ title, value, icon: Icon, trend, trendLabel, colorClass }: any) {
  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60 hover:shadow-md transition-shadow relative overflow-hidden group">
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-5 bg-gradient-to-br from-current to-transparent transition-transform group-hover:scale-110" style={{ color: colorClass }} />
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <div className={cn("p-3 rounded-xl", colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <p className="text-4xl font-display font-bold text-foreground">{value}</p>
        {trend && (
          <span className="flex items-center text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
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
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted rounded-2xl"></div>)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-muted rounded-2xl"></div>
            <div className="h-96 bg-muted rounded-2xl"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Calculate percentage change simply for demonstration
  const trend = summary?.clicksLastMonth 
    ? Math.round(((summary.clicksThisMonth - summary.clicksLastMonth) / summary.clicksLastMonth) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-lg">Here's what's happening with your links today.</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl text-sm font-medium text-primary border border-primary/10">
          <Activity className="w-4 h-4" />
          Live Metrics
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard 
          title="Total Clicks (30d)" 
          value={summary?.totalClicks?.toLocaleString() || "0"} 
          icon={MousePointerClick}
          trend={trend > 0 ? trend : null}
          trendLabel="vs previous 30 days"
          colorClass="bg-accent/20 text-accent-foreground"
        />
        <StatCard 
          title="Active Links" 
          value={summary?.totalLinks?.toLocaleString() || "0"} 
          icon={LinkIcon}
          colorClass="bg-blue-100 text-blue-700"
        />
        <StatCard 
          title="Total Campaigns" 
          value={summary?.totalCampaigns?.toLocaleString() || "0"} 
          icon={Megaphone}
          colorClass="bg-purple-100 text-purple-700"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-card rounded-3xl p-6 md:p-8 shadow-sm border border-border/60">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-display font-bold text-foreground">Clicks Overview</h2>
              <p className="text-sm text-muted-foreground mt-1">Performance over the last 30 days</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            {clicksData && clicksData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={clicksData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(parseISO(val), 'MMM d')}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                    labelFormatter={(val) => format(parseISO(val as string), 'MMM d, yyyy')}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clicks" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorClicks)" 
                    activeDot={{ r: 6, fill: "hsl(var(--accent))", stroke: "hsl(var(--primary))", strokeWidth: 3 }}
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
        <div className="bg-card rounded-3xl p-6 md:p-8 shadow-sm border border-border/60 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-display font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Top Links
            </h2>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2">
            {topLinks && topLinks.length > 0 ? (
              topLinks.map((link, i) => {
                const cmp = campaigns?.find(c => c.name === link.campaignName);
                return (
                  <div key={link.id} className="group p-4 rounded-2xl bg-muted/30 hover:bg-muted/60 transition-colors border border-transparent hover:border-border">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-sm truncate pr-2" title={link.title}>{link.title}</h3>
                      <div className="flex items-center gap-1 text-xs font-bold bg-background shadow-sm px-2 py-1 rounded-md">
                        <MousePointerClick className="w-3 h-3 text-muted-foreground" />
                        {link.clickCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        {link.campaignName ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-border/50 bg-background flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cmp?.color || '#ccc' }}></span>
                            {link.campaignName}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No campaign</span>
                        )}
                      </div>
                      <a href={link.destinationUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
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
