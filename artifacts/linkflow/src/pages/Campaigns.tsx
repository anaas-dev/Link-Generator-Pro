import { useState } from "react";
import { 
  useGetCampaigns, 
  useCreateCampaign, 
  useUpdateCampaign, 
  useDeleteCampaign,
  getGetCampaignsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Plus, MoreVertical, Trash2, Edit2, Megaphone, FolderKanban } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

// Components
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Must be a valid hex color"),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

const PRESET_COLORS = [
  "#4f8ef7", "#FFD600", "#10B981", "#EF4444", "#8B5CF6", "#3B82F6", "#EC4899", "#F97316"
];

export default function Campaigns() {
  const { data: campaigns, isLoading } = useGetCampaigns();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMutation = useCreateCampaign();
  const updateMutation = useUpdateCampaign();
  const deleteMutation = useDeleteCampaign();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { color: PRESET_COLORS[0] }
  });

  const selectedColor = watch("color");

  const openCreateModal = () => {
    setEditingId(null);
    reset({ color: PRESET_COLORS[0], name: "", description: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (campaign: any) => {
    setEditingId(campaign.id);
    reset({
      name: campaign.name,
      description: campaign.description,
      color: campaign.color,
    });
    setIsModalOpen(true);
  };

  const onSubmit = (data: CampaignFormData) => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
            toast({ title: "Campaign updated successfully" });
            setIsModalOpen(false);
          }
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
            toast({ title: "Campaign created successfully" });
            setIsModalOpen(false);
          }
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this campaign? All associated links will remain but lose their campaign assignment.")) {
      deleteMutation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetCampaignsQueryKey() });
            toast({ title: "Campaign deleted" });
          }
        }
      );
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground mt-2">Group and track your links by marketing initiatives.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white px-6 py-3 rounded-xl font-semibold shadow-[0_4px_12px_rgba(79,142,247,0.3)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-muted rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-card border border-border rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 group flex flex-col h-full relative overflow-hidden cursor-pointer">
              <div 
                className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
                style={{ backgroundColor: campaign.color }}
              />
              <div className="flex justify-between items-start mb-4 pl-2">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                  style={{ backgroundColor: campaign.color }}
                >
                  <Megaphone className="w-6 h-6" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                    <DropdownMenuItem onClick={() => openEditModal(campaign)} className="cursor-pointer font-medium">
                      <Edit2 className="w-4 h-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(campaign.id)} className="cursor-pointer text-[#ef4444] focus:text-[#ef4444] focus:bg-[#ef4444]/10 font-medium">
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="pl-2 flex-1 flex flex-col">
                <h3 className="text-xl font-bold font-display text-foreground mb-2 line-clamp-1">{campaign.name}</h3>
                <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">
                  {campaign.description || "No description provided."}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-1">Links</p>
                    <p className="text-lg font-bold text-foreground">{campaign.linkCount}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.05em] mb-1">Clicks</p>
                    <p className="text-2xl font-bold text-[#f97316]">{campaign.totalClicks.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center max-w-2xl mx-auto mt-12 shadow-sm">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <FolderKanban className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">No campaigns yet</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Create your first campaign to group related links together and track their collective performance.
          </p>
          <button
            onClick={openCreateModal}
            className="bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white px-6 py-3 rounded-xl font-semibold shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Create Campaign
          </button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl p-0 overflow-hidden border-0 shadow-[0_10px_40px_rgba(0,0,0,0.1)]">
          <div className="bg-muted/30 p-6 border-b border-border">
            <DialogTitle className="text-2xl font-display font-bold">
              {editingId ? "Edit Campaign" : "New Campaign"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-muted-foreground">
              {editingId ? "Update your campaign details." : "Create a new campaign to organize your links."}
            </DialogDescription>
          </div>
          
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Campaign Name</label>
              <Input 
                {...register("name")} 
                placeholder="e.g. Summer Sale 2024" 
                className="rounded-xl h-11 bg-white border-slate-200 focus:ring-2 focus:ring-[#4f8ef7]/20"
              />
              {errors.name && <p className="text-sm text-[#ef4444]">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Description (Optional)</label>
              <Textarea 
                {...register("description")} 
                placeholder="What is this campaign for?"
                className="rounded-xl resize-none bg-white border-slate-200 focus:ring-2 focus:ring-[#4f8ef7]/20 min-h-[100px]"
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-foreground uppercase tracking-[0.05em]">Theme Color</label>
              <div className="flex flex-wrap gap-3">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue("color", c)}
                    className={`w-10 h-10 rounded-full transition-all flex items-center justify-center cursor-pointer ${selectedColor === c ? 'ring-2 ring-offset-2 ring-foreground scale-110 shadow-md' : 'hover:scale-110 opacity-80 hover:opacity-100 hover:shadow-sm'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input type="hidden" {...register("color")} />
              {errors.color && <p className="text-sm text-[#ef4444]">{errors.color.message}</p>}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl cursor-pointer font-semibold">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="rounded-xl px-6 bg-[#4f8ef7] hover:bg-[#4f8ef7]/90 text-white shadow-md cursor-pointer font-semibold"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Campaign"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
