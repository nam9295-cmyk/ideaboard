import Toolbar from "@/components/Editor/Toolbar";
import LayersPanel from "@/components/Editor/LayersPanel";
import Sidebar from "@/components/Editor/Sidebar";
import Inspector from "@/components/Editor/Inspector";
import Canvas from "@/components/Editor/Canvas";
import { EditorProvider } from "@/context/EditorContext";

export default function Home() {
  return (
    <EditorProvider>
      <div className="flex flex-col h-screen w-screen bg-[#181A20] text-[#E2E8F0] overflow-hidden">
        {/* Top Toolbar */}
        <Toolbar />

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar (Layers) */}
          <LayersPanel />

          {/* Middle Sidebar (Tools) */}
          <Sidebar />

          {/* Main Canvas Area */}
          <main className="flex-1 relative overflow-hidden bg-[#22242B]">
            <Canvas />
          </main>

          {/* Right Inspector */}
          <Inspector />
        </div>
      </div>
    </EditorProvider>
  );
}
