import Toolbar from "@/components/Editor/Toolbar";
import LayersPanel from "@/components/Editor/LayersPanel";
import Sidebar from "@/components/Editor/Sidebar";
import Inspector from "@/components/Editor/Inspector";
import Canvas from "@/components/Editor/Canvas";
import { EditorProvider } from "@/context/EditorContext";

export default function Home() {
  return (
    <EditorProvider>
      <div className="flex flex-col h-screen w-screen bg-gray-50 overflow-hidden">
        {/* Top Toolbar */}
        <Toolbar />

        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar (Layers) */}
          <LayersPanel />

          {/* Middle Sidebar (Tools) */}
          <Sidebar />

          {/* Main Canvas Area */}
          <main className="flex-1 relative overflow-hidden bg-gray-100">
            <Canvas />
          </main>

          {/* Right Inspector */}
          <Inspector />
        </div>
      </div>
    </EditorProvider>
  );
}
