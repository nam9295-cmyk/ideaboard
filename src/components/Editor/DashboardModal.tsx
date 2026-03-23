"use client";

import { useEffect, useState } from "react";
import { Query } from "appwrite";
import { FolderOpen, Loader2, X } from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { APPWRITE_BOARDS_COLLECTION_ID, APPWRITE_DATABASE_ID, tablesDB } from "@/lib/appwrite";

type ProjectSummary = {
    id: string;
    title: string;
    updatedAt: string;
};

export default function DashboardModal({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const { openCloudBoard, currentCloudBoardId, isAdmin, adminEmail } = useEditor();
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpening, setIsOpening] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (!isAdmin) {
            setProjects([]);
            setError(null);
            setIsLoading(false);
            return;
        }
        let isCancelled = false;

        const loadProjects = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const queries = [Query.orderDesc("$updatedAt")];
                if (adminEmail) {
                    queries.unshift(Query.equal("ownerEmail", [adminEmail]));
                }
                const snapshot = await tablesDB.listRows(
                    APPWRITE_DATABASE_ID,
                    APPWRITE_BOARDS_COLLECTION_ID,
                    queries,
                );
                const nextProjects = snapshot.rows
                    .map((item) => {
                        const data = item as typeof item & { title?: string };
                        return {
                            id: item.$id,
                            title: typeof data.title === "string" && data.title.trim() ? data.title : "Untitled",
                            updatedAt: item.$updatedAt || "",
                        };
                    })
                    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

                if (!isCancelled) {
                    setProjects(nextProjects);
                }
            } catch (loadError) {
                console.error("Failed to load dashboard projects", loadError);
                if (!isCancelled) {
                    setError("프로젝트 목록을 불러오지 못했습니다.");
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadProjects();

        return () => {
            isCancelled = true;
        };
    }, [isOpen, isAdmin, adminEmail]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-sm">
            <div
                className="w-full max-w-4xl border-2 border-[#E2E8F0] bg-[#181A20] text-[#E2E8F0] shadow-[8px_8px_0px_0px_#000]"
                style={{ borderRadius: 0 }}
            >
                <div className="flex items-center justify-between border-b-2 border-[#E2E8F0] px-5 py-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">Projects</div>
                        <div className="mt-1 text-lg font-semibold">{isAdmin ? "Cloud Dashboard" : "Guest Dashboard"}</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-2 border-[#E2E8F0] bg-[#232734] p-2 text-[#E2E8F0] shadow-[4px_4px_0px_0px_#000] hover:bg-[#2D3340]"
                        style={{ borderRadius: 0 }}
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
                    {!isAdmin && (
                        <div className="border border-[#3B4252] bg-[#1E2129] px-4 py-6 text-sm text-[#CBD5E1]">
                            게스트 모드에서는 현재 브라우저의 로컬 저장소만 사용합니다. 클라우드 프로젝트 목록은 관리자 로그인 후 사용할 수 있습니다.
                        </div>
                    )}

                    {isAdmin && isLoading && (
                        <div className="flex items-center gap-3 border border-[#3B4252] bg-[#1E2129] px-4 py-6 text-sm text-[#CBD5E1]">
                            <Loader2 size={16} className="animate-spin" />
                            프로젝트 목록을 불러오는 중입니다.
                        </div>
                    )}

                    {isAdmin && !isLoading && error && (
                        <div className="border border-[#7F1D1D] bg-[#3A1F24] px-4 py-4 text-sm text-red-200">
                            {error}
                        </div>
                    )}

                    {isAdmin && !isLoading && !error && projects.length === 0 && (
                        <div className="border border-[#3B4252] bg-[#1E2129] px-4 py-8 text-center text-sm text-[#94A3B8]">
                            저장된 프로젝트가 없습니다.
                        </div>
                    )}

                    {isAdmin && !isLoading && !error && projects.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {projects.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={async () => {
                                        setIsOpening(project.id);
                                        const opened = await openCloudBoard(project.id);
                                        setIsOpening(null);
                                        if (opened) {
                                            onClose();
                                        }
                                    }}
                                    className={`border-2 px-4 py-4 text-left shadow-[4px_4px_0px_0px_#000] transition-colors hover:bg-[#2D3340] ${currentCloudBoardId === project.id
                                        ? "border-blue-500 bg-[#232734]"
                                        : "border-[#E2E8F0] bg-[#1E2129]"
                                        }`}
                                    style={{ borderRadius: 0 }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#94A3B8]">
                                                <FolderOpen size={14} />
                                                Project
                                            </div>
                                            <div className="mt-3 truncate text-base font-semibold text-[#E2E8F0]">
                                                {project.title}
                                            </div>
                                        </div>
                                        {isOpening === project.id && <Loader2 size={16} className="animate-spin text-[#94A3B8]" />}
                                    </div>
                                    <div className="mt-4 text-xs text-[#94A3B8]">
                                        {project.updatedAt ? new Date(project.updatedAt).toLocaleString("ko-KR") : "시간 정보 없음"}
                                    </div>
                                    <div className="mt-1 text-[11px] text-[#64748B]">
                                        ID: {project.id}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
