import { Grid3x3, Plus } from "lucide-react";

export default function ProjectSelect() {
    return(
        <div className="min-h-screen bg-[#0a0a0e] p-10 text-slate-200">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-100">
                    Create or select a project below to get started
                </h1>
            </div>
            <div className="flex flex-wrap gap-6">
                <div className="w-[260px]">
                    <div className="relative flex h-[160px] items-center justify-center rounded-lg border border-slate-700 bg-slate-800/60">
                        <Grid3x3 size={28} className="text-slate-400"/>
                    </div>
                    <div className="mt-2 flex items-start justify-between">
                        <div>
                            <div className="text-sm font-semibold text-slate-100">My First Map</div>
                            <div className="text-sm text-slate-500">Last edited 12 hours ago</div>
                        </div>
                    </div>
                </div>

                <button className="flex h-[160px] flex-col items-center justify-center gap-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-900">
                    <div className="relative">
                        <Grid3x3 size={28} />
                        <Plus size={14} className="absolute -right-1 -bottom-1 rounded-full bg-slate-200 text-black" />
                    </div>
                    <span className="text-sm font-semibold">Create a new project</span>
                </button>
            </div>
        </div>
    )
}