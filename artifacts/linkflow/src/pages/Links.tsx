import { useState, useEffect, useRef } from "react";
import { 
  useGetLinks, 
  useCreateLink, 
  useUpdateLink, 
  useDeleteLink,
  useGetCampaigns,
  useGetLinkQr,
  getGetLinksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, MoreHorizontal, Trash2, Edit2, Copy, CheckCircle2, QrCode, Link2, ExternalLink, Calendar, ChevronDown, ChevronUp, MousePointerClick, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isPast } from "date-fns";
import { generateShortUrl, getWorkingShortUrl, cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const linkSchema = z.object({
  title: z.string().min(1, "Title is required"),
  destinationUrl: z.string().url("Must be a valid URL"),
  campaignId: z.coerce.number().optional().nullable(),
  slug: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  utmSource: z.string().optional().nullable(),
  utmMedium: z.string().optional().nullable(),
  utmCampaign: z.string().optional().nullable(),
  utmTerm: z.string().optional().nullable(),
  utmContent: z.string().optional().nullable(),
  isActive: z.boolean().default(true).optional(),
});

type LinkFormData = z.infer<typeof linkSchema>;

const COLORS = ["#4f8ef7", "#f97316", "#10b981", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899"];
function getFaviconColor(str: string) {
  if (!str) return COLORS[0];
  const charCode = str.charCodeAt(0);
  return COLORS[charCode % COLORS.length];
}

export default function Links() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: links, isLoading: loadingLinks } = useGetLinks({ campaignId: selectedCampaignId });
  const { data: campaigns } = useGetCampaigns();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useCreateLink();
  const updateMutation = useUpdateLink();
  const deleteMutation = useDeleteLink();

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [qrModalId, setQrModalId] = useState<number | null>(null);
  const [qrLogo, setQrLogo] = useState<string | null>(null);
  const [compositeQrUrl, setCompositeQrUrl] = useState<string | null>(null);
  const qrLogoInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: qrData, isLoading: loadingQr } = useGetLinkQr(qrModalId as number, { query: { enabled: !!qrModalId } });

  // Composite QR + logo using Canvas API
  useEffect(() => {
    if (!qrData?.svgDataUrl || !qrLogo) {
      setCompositeQrUrl(null);
      return;
    }
    const qrImg = new Image();
    const logoImg = new Image();
    let cancelled = false;
    const doComposite = () => {
      const canvas = document.createElement("canvas");
      canvas.width = qrImg.naturalWidth || 300;
      canvas.height = qrImg.naturalHeight || 300;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
      const logoSize = Math.floor(canvas.width * 0.25);
      const pad = Math.floor(logoSize * 0.12);
      const x = Math.floor((canvas.width - logoSize) / 2);
      const y = Math.floor((canvas.height - logoSize) / 2);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      const r = 6;
      ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, r);
      ctx.fill();
      ctx.drawImage(logoImg, x, y, logoSize, logoSize);
      if (!cancelled) setCompositeQrUrl(canvas.toDataURL("image/png"));
    };
    let loadedCount = 0;
    const onLoad = () => { loadedCount++; if (loadedCount === 2) doComposite(); };
    qrImg.onload = onLoad;
    logoImg.onload = onLoad;
    qrImg.src = qrData.svgDataUrl;
    logoImg.src = qrLogo;
    return () => { cancelled = true; };
  }, [qrData?.svgDataUrl, qrLogo]);

  // Reset logo when QR modal closes
  useEffect(() => {
    if (!qrModalId) { setQrLogo(null); setCompositeQrUrl(null); }
  }, [qrModalId]);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: { isActive: true }
  });

  const openCreateModal = () => {
    setEditingId(null);
    reset({ 
      title: "", destinationUrl: "", slug: "", campaignId: undefined, 
      expiresAt: "", utmSource: "", utmMedium: "", utmCampaign: "", 
      utmTerm: "", utmContent: "", isActive: true 
    });
    setShowAdvanced(false);
    setIsModalOpen(true);
  };

  const openEditModal = (link: any) => {
    setEditingId(link.id);
    reset({
      title: link.title,
      destinationUrl: link.destinationUrl,
      slug: link.slug || "",
      campaignId: link.campaignId,
      expiresAt: link.expiresAt ? link.expiresAt.substring(0, 16) : "",
      utmSource: link.utmSource || "",
      utmMedium: link.utmMedium || "",
      utmCampaign: link.utmCampaign || "",
      utmTerm: link.utmTerm || "",
      utmContent: link.utmContent || "",
      isActive: link.isActive,
    });
    setShowAdvanced(!!(link.utmSource || link.utmMedium || link.expiresAt));
    setIsModalOpen(true);
  };

  const onSubmit = (data: LinkFormData) => {
    const cleanedData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === "" ? null : v])
    ) as any;

    if (cleanedData.expiresAt) {
      cleanedData.expiresAt = new Date(cleanedData.expiresAt).toISOString();
    }

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: cleanedData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
            toast({ title: "Link updated successfully" });
            setIsModalOpen(false);
          }
        }
      );
    } else {
      createMutation.mutate(
        { data: cleanedData },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
            toast({ title: "Link created successfully" });
            setIsModalOpen(false);
          }
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this link? This action cannot be undone.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
            toast({ title: "Link deleted" });
          }
        }
      );
    }
  };

  const handleCopy = (slug: string, id: number) => {
    const url = getWorkingShortUrl(slug);
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard!" });
  };

  const toggleStatus = (id: number, currentStatus: boolean) => {
    updateMutation.mutate(
      { id, data: { isActive: !currentStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLinksQueryKey() });
          toast({ title: `Link ${!currentStatus ? 'activated' : 'paused'}` });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Links</h1>
          <p className="text-muted-foreground mt-2">Create, manage, and track all your shortened URLs.</p>
        </div>
        
        <button
          onClick={openCreateModal}
          className="h-11 bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white px-6 rounded-xl font-semibold shadow-[0_4px_12px_rgba(79,142,247,0.3)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>Create Link</span>
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
        {/* Filter Bar */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 bg-white/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search links..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-11 rounded-xl border-slate-200 focus:ring-[#4f8ef7]/20 bg-white"
            />
          </div>
          <select 
            className="h-11 px-4 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#4f8ef7]/20 text-sm md:w-56 appearance-none font-medium cursor-pointer"
            value={selectedCampaignId || ""}
            onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Campaigns</option>
            {campaigns?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/95 backdrop-blur sticky top-0 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-[0.05em]">
                <th className="px-6 py-4">Link Details</th>
                <th className="px-6 py-4 hidden md:table-cell">Campaign</th>
                <th className="px-6 py-4 text-right">Total / Unique</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loadingLinks ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-5"><div className="h-12 bg-muted rounded-lg w-3/4"></div></td>
                    <td className="px-6 py-5 hidden md:table-cell"><div className="h-6 bg-muted rounded-full w-24"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-muted rounded w-12 ml-auto"></div></td>
                    <td className="px-6 py-5"><div className="h-6 bg-muted rounded-full w-16 mx-auto"></div></td>
                    <td className="px-6 py-5"><div className="h-8 bg-muted rounded w-8 ml-auto"></div></td>
                  </tr>
                ))
              ) : links && links.length > 0 ? (
                links.map((link, idx) => {
                  const isExpired = link.expiresAt && isPast(parseISO(link.expiresAt));
                  const shortUrl = generateShortUrl(link.slug);
                  const cmp = campaigns?.find(c => c.id === link.campaignId);
                  const rowClass = idx % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]';
                  const favColor = getFaviconColor(link.slug);
                  
                  return (
                    <tr key={link.id} className={cn(
                      rowClass,
                      "hover:shadow-[inset_0_0_0_1px_rgba(79,142,247,0.3)] transition-all group relative z-0 hover:z-10"
                    )}>
                      <td className="px-6 py-5 max-w-xs sm:max-w-md">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold font-display shadow-sm flex-shrink-0 mt-1 uppercase" style={{ backgroundColor: favColor }}>
                            {link.slug ? link.slug.charAt(0) : 'L'}
                          </div>
                          <div className="flex flex-col gap-1.5 min-w-0">
                            <span className="font-bold text-foreground text-base truncate flex items-center gap-2 font-display">
                              {link.title}
                              {isExpired && <span className="text-[10px] font-bold uppercase bg-[#ef4444]/10 text-[#ef4444] px-2 py-0.5 rounded-md">Expired</span>}
                            </span>
                            
                            <div className="flex items-center gap-2">
                              <a href={shortUrl} target="_blank" rel="noreferrer" className="text-[#4f8ef7] font-mono font-medium text-sm hover:underline flex items-center gap-1">
                                {shortUrl.replace(/^https?:\/\//, '')}
                              </a>
                            </div>
                            <span className="text-xs text-muted-foreground truncate w-full flex items-center gap-1 mt-0.5">
                              <span className="opacity-50">→</span> {link.destinationUrl}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        {cmp ? (
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-white text-[11px] font-bold uppercase tracking-wide shadow-sm">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cmp.color }}></div>
                            {cmp.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 text-sm font-bold text-[#f97316]">
                            {((link as any).totalClicks ?? link.clickCount).toLocaleString()}
                            <MousePointerClick className="w-3.5 h-3.5 opacity-50" />
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4f8ef7] inline-block"></span>
                            {((link as any).uniqueClicks ?? link.clickCount).toLocaleString()} unique
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Switch 
                            checked={link.isActive && !isExpired} 
                            onCheckedChange={() => toggleStatus(link.id, link.isActive)}
                            disabled={!!isExpired}
                            className="data-[state=checked]:bg-[#10b981]"
                          />
                          {link.isActive && !isExpired ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#10b981] uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> Live
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground"></span> Paused
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleCopy(link.slug, link.id)}
                            className="p-2 rounded-lg hover:bg-[#4f8ef7]/10 text-muted-foreground hover:text-[#4f8ef7] transition-colors cursor-pointer"
                            title="Copy URL"
                          >
                            {copiedId === link.id ? <CheckCircle2 className="w-4 h-4 text-[#10b981]" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => setQrModalId(link.id)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="View QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(link)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            title="Edit Link"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <div className="w-px h-4 bg-border mx-1"></div>
                          <button 
                            onClick={() => handleDelete(link.id)}
                            className="p-2 rounded-lg hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] transition-colors cursor-pointer"
                            title="Delete Link"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {/* Fallback for mobile where hover doesn't work */}
                        <div className="md:hidden">
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer">
                                <MoreHorizontal className="w-5 h-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-[0_10px_40px_rgba(0,0,0,0.1)] border-none">
                              <DropdownMenuItem onClick={() => handleCopy(link.slug, link.id)} className="cursor-pointer py-2 px-3 rounded-lg font-medium">
                                <Copy className="w-4 h-4 mr-2" /> Copy Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setQrModalId(link.id)} className="cursor-pointer py-2 px-3 rounded-lg font-medium">
                                <QrCode className="w-4 h-4 mr-2" /> View QR Code
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditModal(link)} className="cursor-pointer py-2 px-3 rounded-lg font-medium">
                                <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border" />
                              <DropdownMenuItem onClick={() => handleDelete(link.id)} className="cursor-pointer py-2 px-3 rounded-lg text-[#ef4444] focus:text-[#ef4444] focus:bg-[#ef4444]/10 font-medium">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Link2 className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-display font-bold text-foreground mb-1">No links found</p>
                      <p className="text-sm max-w-sm mx-auto">
                        {selectedCampaignId ? "This campaign doesn't have any links yet." : "You haven't created any shortened links. Create your first one to start tracking."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden border-0 shadow-[0_10px_40px_rgba(0,0,0,0.1)] max-h-[90vh] flex flex-col">
          <div className="bg-white p-6 border-b border-border flex-shrink-0">
            <DialogTitle className="text-2xl font-display font-bold text-foreground">
              {editingId ? "Edit Link" : "Create Link"}
            </DialogTitle>
          </div>
          
          <div className="overflow-y-auto p-6 bg-[#f8fafc]">
            <form id="link-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-[0.05em]">Destination URL <span className="text-[#ef4444]">*</span></label>
                  <Input 
                    {...register("destinationUrl")} 
                    placeholder="https://example.com/very/long/path?param=value" 
                    className="rounded-xl h-11 bg-white border-slate-200 focus:ring-2 focus:ring-[#4f8ef7]/20 font-mono text-sm shadow-sm"
                  />
                  {errors.destinationUrl && <p className="text-sm text-[#ef4444]">{errors.destinationUrl.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-[0.05em]">Title <span className="text-[#ef4444]">*</span></label>
                    <Input 
                      {...register("title")} 
                      placeholder="Summer Promo Banner" 
                      className="rounded-xl h-11 bg-white border-slate-200 focus:ring-2 focus:ring-[#4f8ef7]/20 shadow-sm"
                    />
                    {errors.title && <p className="text-sm text-[#ef4444]">{errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground uppercase tracking-[0.05em]">Campaign (Optional)</label>
                    <select 
                      {...register("campaignId")}
                      className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-[#4f8ef7]/20 text-sm appearance-none shadow-sm cursor-pointer"
                    >
                      <option value="">None</option>
                      {campaigns?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground uppercase tracking-[0.05em]">Custom Slug (Optional)</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-slate-200 focus-within:ring-2 focus-within:ring-[#4f8ef7]/20 bg-white">
                    <div className="bg-muted/50 px-4 py-3 text-muted-foreground text-sm font-mono border-r border-slate-200 flex items-center justify-center">
                      linkflow.to/
                    </div>
                    <input 
                      {...register("slug")} 
                      placeholder="custom-name" 
                      className="flex-1 bg-transparent px-4 font-mono text-sm focus:outline-none"
                    />
                  </div>
                  {errors.slug && <p className="text-sm text-[#ef4444]">{errors.slug.message}</p>}
                </div>
              </div>

              {/* Advanced Section */}
              <div className="pt-4 border-t border-border">
                <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-sm font-bold text-foreground hover:text-[#4f8ef7] transition-colors py-2 cursor-pointer uppercase tracking-wide"
                >
                  Advanced Options
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-foreground uppercase tracking-[0.05em] flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        Expiration Date
                      </label>
                      <Input 
                        type="datetime-local" 
                        {...register("expiresAt")} 
                        className="rounded-xl h-11 bg-white border-slate-200 shadow-sm"
                      />
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <h4 className="font-bold text-sm mb-2 text-foreground font-display">UTM Parameters</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em]">Source</label>
                          <Input {...register("utmSource")} placeholder="e.g. google" className="h-10 text-sm bg-[#f8fafc] border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em]">Medium</label>
                          <Input {...register("utmMedium")} placeholder="e.g. cpc" className="h-10 text-sm bg-[#f8fafc] border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em]">Campaign</label>
                          <Input {...register("utmCampaign")} placeholder="e.g. summer" className="h-10 text-sm bg-[#f8fafc] border-slate-200" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em]">Term</label>
                          <Input {...register("utmTerm")} placeholder="e.g. running" className="h-10 text-sm bg-[#f8fafc] border-slate-200" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="p-5 bg-white border-t border-border flex justify-end gap-3 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-semibold cursor-pointer">
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="link-form"
              className="rounded-xl px-8 bg-[#4f8ef7] text-white shadow-md hover:shadow-lg hover:bg-[#4f8ef7]/90 transition-all hover:-translate-y-0.5 font-semibold cursor-pointer"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrModalId} onOpenChange={(open) => !open && setQrModalId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-8 text-center border-0 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-display font-bold text-foreground">QR Code</DialogTitle>
            <DialogDescription>Scan to visit the link</DialogDescription>
          </DialogHeader>
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-h-[250px] relative">
            {loadingQr ? (
              <div className="animate-pulse w-48 h-48 bg-muted rounded-xl"></div>
            ) : qrData ? (
              <>
                <img
                  src={compositeQrUrl ?? qrData.svgDataUrl}
                  alt="QR Code"
                  className="w-full max-w-[200px] h-auto"
                />
                <p className="mt-4 font-mono text-xs text-muted-foreground bg-[#f8fafc] px-3 py-1.5 rounded-md border border-slate-100">{qrData.shortUrl}</p>

                {/* Logo upload controls */}
                <div className="mt-4 flex items-center gap-2">
                  <input
                    ref={qrLogoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => setQrLogo(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {qrLogo ? (
                    <div className="flex items-center gap-2">
                      <img src={qrLogo} alt="Logo" className="w-7 h-7 rounded object-contain border border-slate-200" />
                      <button
                        onClick={() => { setQrLogo(null); if (qrLogoInputRef.current) qrLogoInputRef.current.value = ""; }}
                        className="text-xs text-muted-foreground hover:text-[#ef4444] underline cursor-pointer transition-colors"
                      >
                        Remove logo
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => qrLogoInputRef.current?.click()}
                      className="text-xs text-[#4f8ef7] hover:text-[#3a7ae8] underline cursor-pointer transition-colors flex items-center gap-1"
                    >
                      + Add logo to center
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[#ef4444] font-medium">Failed to load QR code</p>
            )}
          </div>
          
          <Button 
            className="w-full mt-6 rounded-xl h-12 bg-[#f97316] text-white hover:bg-[#f97316]/90 shadow-md font-bold text-base cursor-pointer"
            onClick={() => {
              const url = compositeQrUrl ?? qrData?.svgDataUrl;
              if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `qrcode-${qrModalId}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            }}
            disabled={!qrData}
          >
            Download PNG
          </Button>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
