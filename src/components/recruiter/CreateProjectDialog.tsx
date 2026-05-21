"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/server/actions/recruiter";

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsLoading(true);
    try {
      const project = await createProject(formData.name, formData.description);
      toast.success("Project created successfully!");
      setOpen(false);
      setFormData({ name: "", description: "" });
      // Redirect to the new project board
      // router.push(`/en/talent-pool/projects/${project.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-sm rounded-lg">
          <Plus className="size-4" />
          <span>New Project</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] overflow-hidden p-0 border-0 shadow-2xl rounded-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white relative">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <FolderPlus className="size-24" />
          </div>
          <DialogHeader className="relative z-10">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FolderPlus className="size-6" />
              Create Project
            </DialogTitle>
            <DialogDescription className="text-blue-100 mt-1.5">
              Set up a new pipeline to organize candidates for an open role.
            </DialogDescription>
          </DialogHeader>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6 bg-white">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-neutral-700 font-medium">Project Name <span className="text-red-500">*</span></Label>
              <Input
                id="name"
                placeholder="e.g. Senior Frontend Engineer - Q3"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                autoFocus
                className="h-11 rounded-xl bg-neutral-50/50 border-neutral-200 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-neutral-700 font-medium">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Notes about the role, hiring manager, or specific requirements..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="resize-none rounded-xl bg-neutral-50/50 border-neutral-200 focus:ring-blue-500/20 focus:border-blue-500 min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl" disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
