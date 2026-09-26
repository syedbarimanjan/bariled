import { Grid3x3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter} from "@/components/ui/dialog";
import { useState } from "react";

function timeAgo(timestamp) {
    const secPassed = Math.floor((Date.now() - timestamp) / 1000)
    if (secPassed < 60 ) return "just now"
    const minPassed = Math.floor(secPassed / 60)
    if (minPassed < 60 ) return `${minPassed} minutes${minPassed > 1 ? "s" : ""} ago`
    const hrsPassed = Math.floor(minPassed / 60)
    if (hrsPassed < 24) return `${hrsPassed} hour${hrsPassed > 1 ? "s" : ""} ago`
    const daysPassed = Math.floor(hrsPassed / 24)
    return `${daysPassed} day${daysPassed > 1 ? "s" : ""} ago`
}

export default function ProjectSelect({projects, onCreate, onOpen, onDelete}) {
    const [deleteTarget, setDeleteTarget] = useState(null)

    const confirmDelete = ()=> {
        if (deleteTarget) {
            onDelete(deleteTarget)
            setDeleteTarget(null)
        }
    }

    return(
        <div className="min-h-screen bg-[#0a0a0e] p-10 text-slate-200">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-100">
                    Create or select a project below to get started
                </h1>
            </div>
            <div className="flex flex-wrap gap-6">
                {projects.map((project) => (
                    <div 
                        key={project.id}
                        className="w-[260px]"
                    >
                        <div className="group relative">
                            <button
                                onClick={()=> onOpen(project.id)}
                                className="flex h-[160px] w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800"
                            >
                                <Grid3x3 size={28} className="text-slate-400" />
                            </button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e)=>{
                                    e.stopPropagation()
                                    setDeleteTarget(project.id)
                                }}
                                className="absolute right-2 top-2 h-7 w-7 rounded-full bg-slate-900/80 text-slate-300 opacity-0 hover:bg-red-500 hover:text-white group-hover:opacity-100"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>

                        <div className="mt-2">
                            <div className="text-sm font-semibold text-slate-100">{project.name}</div>
                            <div className="text-sm text-slate-500">Last edited {timeAgo(project.lastEdited)}</div>
                        </div>
                    </div>
                ))}

                <button
                    onClick={onCreate}
                    className="flex h-[160px] w-[260px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-900"
                >
                    <div className="relative">
                        <Grid3x3 size={28} />
                        <Plus size={14} className="absolute -right-1 -bottom-1 rounded-full bg-slate-200 text-black" />
                    </div>
                    <span className="text-sm font-semibold">Create a new project</span>
                </button>
            </div>

            <Dialog 
                open={!!deleteTarget} 
                onOpenChange={(open)=> !open && setDeleteTarget(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project</DialogTitle>
                        <DialogDescription>Are you sure? You'll lose this project and all its data permanently</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button 
                            variant="ghost" 
                            onClick={() => setDeleteTarget(null)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            variant="destructive" 
                            onClick={confirmDelete}
                        >
                            Delete Forever
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}