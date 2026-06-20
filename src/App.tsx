import { useState, useEffect } from "react";
import { Camera, Image as ImageIcon, Mail, ShieldAlert, Sparkles, Sliders, History, Heart, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import CameraView from "./components/CameraView";
import GalleryView from "./components/GalleryView";
import EmailModal from "./components/EmailModal";
import { Photo } from "./types";

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emailPhoto, setEmailPhoto] = useState<Photo | null>(null);
  const [showEmailConfigModal, setShowEmailConfigModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Load photos on start
  useEffect(() => {
    fetchPhotos();
  }, []);

  async function fetchPhotos() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/photos");
      const json = await res.json();
      if (json.success) {
        setPhotos(json.photos);
      }
    } catch (err) {
      console.error("Erro ao buscar fotos:", err);
      showStatus("Erro de conexão ao buscar galeria.", true);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle saving captured photo to Backend Server
  const handlePhotoCaptured = async ({ dataUrl }: { dataUrl: string }) => {
    showStatus("Salvando foto no servidor...");

    try {
      const res = await fetch("/api/photos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base64Data: dataUrl,
          name: `Foto_${Date.now()}`,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Soft refresh gallery
        setPhotos((prev) => [json.photo, ...prev]);
        showStatus("Foto salva na galeria com sucesso!");
      } else {
        showStatus(json.error || "Erro ao salvar foto.", true);
      }
    } catch (err: any) {
      console.error(err);
      showStatus("Erro de rede ao salvar foto.", true);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        showStatus("Foto removida!");
      } else {
        showStatus(json.error || "Erro ao deletar foto.", true);
      }
    } catch (err) {
      console.error(err);
      showStatus("Erro ao conectar ao servidor para deletar.", true);
    }
  };

  // Status message manager
  function showStatus(text: string, isError = false) {
    setStatusMessage({ text, isError });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4000);
  }

  return (
    <div id="app-wrapper" className="min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-emerald-950/80 selection:text-emerald-400 flex flex-col justify-between relative overflow-hidden">
      
      {/* Decorative top grid banner accent */}
      <div className="absolute top-0 inset-x-0 h-44 bg-gradient-to-b from-emerald-950/20 to-transparent pointer-events-none -z-10" />

      {/* Real-time Status Banner Toast */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            id="status-banner"
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-5 inset-x-0 mx-auto w-fit z-50 px-4 py-2.5 rounded-full shadow-xl border text-xs max-w-sm font-medium flex items-center gap-2 bg-zinc-90 w bg-zinc-900 border-zinc-800 text-zinc-100"
          >
            <div className={`h-2 w-2 rounded-full ${statusMessage.isError ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"}`} />
            <span className={`${statusMessage.isError ? "text-red-450 text-red-400" : "text-emerald-400"}`}>
              {statusMessage.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-screen-2xl mx-auto w-full px-2 sm:px-6 md:px-8 pt-4 sm:pt-6 pb-12 flex flex-col gap-6 md:gap-8">
        
        {/* Brand Header */}
        <header id="app-header" className="flex items-center justify-between gap-3 text-left border-b border-zinc-850 border-zinc-800 pb-5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Cam<span className="text-emerald-500 font-light">&</span>Email
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 select-none">
            <button
              id="header-send-email-btn"
              onClick={() => {
                setEmailPhoto(photos[0] || null);
                setShowEmailConfigModal(true);
              }}
              className="px-3 py-2 sm:px-4 sm:py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all flex items-center gap-1.5 text-xs shadow-lg hover:shadow-emerald-500/20 active:scale-95 cursor-pointer"
            >
              <Mail className="w-4 h-4 text-zinc-950" />
              <span className="hidden sm:inline">Enviar por E-mail</span>
              <span className="sm:hidden">Enviar</span>
            </button>
            <button
              id="header-smtp-btn"
              onClick={() => {
                setEmailPhoto(photos[0] || null); // fallback to pass some photo context
                setShowEmailConfigModal(true);
              }}
              className="p-2 sm:p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all border border-zinc-800 hover:border-zinc-700 flex items-center gap-1.5 text-xs font-semibold shadow-md cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </button>
          </div>
        </header>


        {/* Viewfinder Module Grid */}
        <section id="camera-section">
          <CameraView onPhotoCaptured={handlePhotoCaptured} />
        </section>

        {/* Saved Gallery grid */}
        <section id="gallery-section" className="border-t border-zinc-800 pt-8">
          <GalleryView
            photos={photos}
            isLoading={isLoading}
            onDeletePhoto={handleDeletePhoto}
            onSelectSendEmail={(photo) => {
              setEmailPhoto(photo);
              setShowEmailConfigModal(true);
            }}
          />
        </section>
      </main>

      <footer id="app-footer" className="py-6 border-t border-zinc-800 mx-2 sm:mx-6 md:mx-8 text-center text-xs text-zinc-500 select-none">
        <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-left">
          <p className="flex items-center gap-1">
            Produzido em React 19 & Express com <Heart className="w-3.5 h-3.5 text-zinc-600 fill-zinc-650" />
          </p>
        </div>
      </footer>

      {/* Central Email Delivery Overlay Screen */}
      <AnimatePresence>
        {showEmailConfigModal && (
          <EmailModal
            photo={emailPhoto}
            onClose={() => {
              setShowEmailConfigModal(false);
              setEmailPhoto(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
