import { useState } from "react";
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
import { Plus, MoreHorizontal, Trash2, Edit2, Copy, CheckCircle2, QrCode, Link2, ExternalLink, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isPast } from "date-fns";
import { generateShortUrl, cn } from "@/lib/utils";

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

export default function Links() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | undefined>(undefined);
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
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: qrData, isLoading: loadingQr } = useGetLinkQr(qrModalId as number, { query: { enabled: !!qrModalId } });

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
      expiresAt: link.expiresAt ? link.expiresAt.substring(0, 16) : "", // Format for datetime-local input
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
    // clean empty strings to null
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
    const url = generateShortUrl(slug);
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
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            className="h-12 px-4 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 text-sm flex-1 md:w-48 appearance-none"
            value={selectedCampaignId || ""}
            onChange={(e) => setSelectedCampaignId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">All Campaigns</option>
            {campaigns?.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <button
            onClick={openCreateModal}
            className="h-12 bg-primary hover:bg-primary/90 text-primary-foreground px-6 rounded-xl font-medium shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Create Link</span>
          </button>
        </div>
      </div>

      {/* Table/List View */}
      <div className="bg-card border border-border/60 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-5">Link Details</th>
                <th className="px-6 py-5 hidden md:table-cell">Campaign</th>
                <th className="px-6 py-5 text-right">Clicks</th>
                <th className="px-6 py-5 text-center">Status</th>
                <th className="px-6 py-5 text-right">Actions</th>
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
                links.map((link) => {
                  const isExpired = link.expiresAt && isPast(parseISO(link.expiresAt));
                  const shortUrl = generateShortUrl(link.slug);
                  const cmp = campaigns?.find(c => c.id === link.campaignId);
                  
                  return (
                    <tr key={link.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-6 py-5 max-w-xs sm:max-w-md">
                        <div className="flex flex-col gap-1.5">
                          <span className="font-bold text-foreground text-base truncate flex items-center gap-2">
                            {link.title}
                            {isExpired && <span className="text-[10px] uppercase bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-sm">Expired</span>}
                          </span>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <a href={shortUrl} target="_blank" rel="noreferrer" className="text-primary font-medium text-sm hover:underline flex items-center gap-1">
                              {shortUrl.replace(/^https?:\/\//, '')}
                              <ExternalLink className="w-3 h-3 opacity-50" />
                            </a>
                            <button 
                              onClick={() => handleCopy(link.slug, link.id)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copy URL"
                            >
                              {copiedId === link.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <span className="text-xs text-muted-foreground truncate w-full flex items-center gap-1">
                            <span className="opacity-50">→</span> {link.destinationUrl}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 hidden md:table-cell">
                        {cmp ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/50 bg-background text-sm font-medium">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cmp.color }}></div>
                            {cmp.name}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-right font-display font-bold text-lg">
                        {link.clickCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center">
                          <Switch 
                            checked={link.isActive && !isExpired} 
                            onCheckedChange={() => toggleStatus(link.id, link.isActive)}
                            disabled={!!isExpired}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors">
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl p-1 shadow-xl">
                            <DropdownMenuItem onClick={() => handleCopy(link.slug, link.id)} className="cursor-pointer py-2 px-3 rounded-lg">
                              <Copy className="w-4 h-4 mr-2" /> Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setQrModalId(link.id)} className="cursor-pointer py-2 px-3 rounded-lg">
                              <QrCode className="w-4 h-4 mr-2" /> View QR Code
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/50" />
                            <DropdownMenuItem onClick={() => openEditModal(link)} className="cursor-pointer py-2 px-3 rounded-lg">
                              <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(link.id)} className="cursor-pointer py-2 px-3 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="w-4 h-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Link2 className="w-12 h-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-foreground mb-1">No links found</p>
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
        <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden border-0 max-h-[90vh] flex flex-col">
          <div className="bg-muted/30 p-6 border-b border-border/50 flex-shrink-0">
            <DialogTitle className="text-2xl font-display font-bold">
              {editingId ? "Edit Link" : "Create Link"}
            </DialogTitle>
          </div>
          
          <div className="overflow-y-auto p-6">
            <form id="link-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Destination URL <span className="text-destructive">*</span></label>
                  <Input 
                    {...register("destinationUrl")} 
                    placeholder="https://example.com/very/long/path?param=value" 
                    className="rounded-xl h-12 bg-background border-border/60 focus:ring-primary/20 font-mono text-sm"
                  />
                  {errors.destinationUrl && <p className="text-sm text-destructive">{errors.destinationUrl.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Title <span className="text-destructive">*</span></label>
                    <Input 
                      {...register("title")} 
                      placeholder="Summer Promo Banner" 
                      className="rounded-xl h-12 bg-background border-border/60"
                    />
                    {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground">Campaign (Optional)</label>
                    <select 
                      {...register("campaignId")}
                      className="w-full h-12 px-4 rounded-xl border border-border/60 bg-background focus:ring-2 focus:ring-primary/20 text-sm appearance-none"
                    >
                      <option value="">None</option>
                      {campaigns?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Custom Slug (Optional)</label>
                  <div className="flex shadow-sm rounded-xl overflow-hidden border border-border/60 focus-within:ring-2 focus-within:ring-primary/20">
                    <div className="bg-muted px-4 py-3 text-muted-foreground text-sm font-mono border-r border-border/60 flex items-center justify-center">
                      linkflow.to/
                    </div>
                    <input 
                      {...register("slug")} 
                      placeholder="custom-name" 
                      className="flex-1 bg-background px-4 font-mono text-sm focus:outline-none"
                    />
                  </div>
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
                </div>
              </div>

              {/* Advanced Section */}
              <div className="pt-4 border-t border-border/50">
                <button 
                  type="button" 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-foreground hover:text-primary transition-colors py-2"
                >
                  Advanced Options (UTMs & Expiry)
                  {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        Expiration Date
                      </label>
                      <Input 
                        type="datetime-local" 
                        {...register("expiresAt")} 
                        className="rounded-xl h-12 bg-background border-border/60"
                      />
                    </div>

                    <div className="bg-muted/40 p-4 rounded-xl border border-border/50 space-y-4">
                      <h4 className="font-semibold text-sm mb-2">UTM Parameters</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Source</label>
                          <Input {...register("utmSource")} placeholder="e.g. google, newsletter" className="h-10 text-sm bg-background" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Medium</label>
                          <Input {...register("utmMedium")} placeholder="e.g. cpc, email" className="h-10 text-sm bg-background" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Campaign</label>
                          <Input {...register("utmCampaign")} placeholder="e.g. summer_sale" className="h-10 text-sm bg-background" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Term</label>
                          <Input {...register("utmTerm")} placeholder="e.g. running+shoes" className="h-10 text-sm bg-background" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>

          <div className="p-6 bg-background border-t border-border/50 flex justify-end gap-3 flex-shrink-0">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="link-form"
              className="rounded-xl px-8 bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all hover:-translate-y-0.5"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={!!qrModalId} onOpenChange={(open) => !open && setQrModalId(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-8 text-center border-0 shadow-2xl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-display font-bold">QR Code</DialogTitle>
            <DialogDescription>Scan to visit the link</DialogDescription>
          </DialogHeader>
          
          <div className="bg-white p-6 rounded-2xl border border-border/50 shadow-inner flex flex-col items-center justify-center min-h-[250px] relative">
            {loadingQr ? (
              <div className="animate-pulse w-48 h-48 bg-muted rounded-xl"></div>
            ) : qrData ? (
              <>
                <img src={qrData.svgDataUrl} alt="QR Code" className="w-full max-w-[200px] h-auto" />
                <p className="mt-4 font-mono text-xs text-muted-foreground bg-muted px-3 py-1 rounded-md">{qrData.shortUrl}</p>
              </>
            ) : (
              <p className="text-destructive">Failed to load QR code</p>
            )}
          </div>
          
          <Button 
            className="w-full mt-6 rounded-xl h-12 bg-accent text-accent-foreground hover:bg-accent/90 shadow-md font-bold text-lg"
            onClick={() => {
              if (qrData) {
                const a = document.createElement('a');
                a.href = qrData.svgDataUrl;
                a.download = `qrcode-${qrModalId}.svg`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            }}
            disabled={!qrData}
          >
            Download SVG
          </Button>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
