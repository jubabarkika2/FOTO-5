import React, { useState } from "react";
import { Image as ImageIcon, Trash2, Mail, ExternalLink, Calendar, HardDrive, Sparkles, Video, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Photo } from "../types";

interface GalleryViewProps {
  photos: Photo[];
  isLoading: boolean;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onSelectSendEmail: (photo: Photo) => void;
  sentPhotoIds?: string[];
}

export default function GalleryView({ photos, isLoading, onDeletePhoto, onSelectSendEmail, sentPhotoIds = [] }: GalleryViewProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Helper to format bytes to human readable sizes
  const formatSize = (bytes?: number) => {
    if (!bytes) return "N/A";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  const checkIfVideo = (photo: Photo) => {
    return !!(
      photo.fileName?.endsWith(".webm") ||
      photo.fileName?.endsWith(".mp4") ||
      photo.dataUrl?.includes("video") ||
      photo.name?.toLowerCase().includes("vídeo") ||
      photo.name?.toLowerCase().includes("video")
    );
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Tem certeza de que deseja deletar permanentemente esta foto?")) return;
    try {
      setIsDeletingId(id);
      await onDeletePhoto(id);
      if (selectedPhoto?.id === id) {
        setSelectedPhoto(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div id="gallery-root-container" className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-emerald-500" />
          <h2 className="text-xl font-bold tracking-tight text-white">
            Galeria Salva ({photos.length})
          </h2>
        </div>
        <p className="text-xs text-zinc-500 font-mono">
          Salvas no Servidor local
        </p>
      </div>

      {isLoading ? (
        <div id="gallery-loading" className="flex flex-col items-center justify-center p-16 bg-[#121214] rounded-2xl border border-dashed border-zinc-800">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-medium text-zinc-400">Carregando fotos registradas...</p>
        </div>
      ) : photos.length === 0 ? (
        <div id="gallery-empty" className="flex flex-col items-center justify-center text-center p-12 bg-[#121214] rounded-3xl border border-dashed border-zinc-800">
          <div className="p-4 bg-zinc-900 shadow-inner border border-zinc-800 rounded-full text-zinc-500 mb-4">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">Sua galeria está vazia</h3>
          <p className="text-xs text-zinc-500 max-w-xs mt-1 leading-relaxed">
            As fotos capturadas pela câmera serão salvas automaticamente aqui no servidor do aplicativo.
          </p>
        </div>
      ) : (
        <div id="gallery-grid" className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {photos.map((photo) => (
              <motion.div
                id={`gallery-item-${photo.id}`}
                key={photo.id}
                layoutId={`photo-card-${photo.id}`}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                onClick={() => setSelectedPhoto(photo)}
                className="group relative aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all flex flex-col justify-end"
              >
                {/* Image or Video layer */}
                {checkIfVideo(photo) ? (
                  <div className="absolute inset-0 w-full h-full overflow-hidden bg-black flex items-center justify-center">
                    <video
                      src={photo.dataUrl}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                      muted
                      loop
                      playsInline
                      autoPlay
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 border border-white/20 text-white z-10 transition-transform group-hover:scale-110">
                      <Video className="w-4 h-4 fill-white/10" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={photo.dataUrl}
                    alt={photo.name}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                )}

                {/* Dark Vignette Overlay on Hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent opacity-75 group-hover:opacity-90 transition-opacity" />

                {/* Sent indicator badge */}
                {sentPhotoIds.includes(photo.id) && (
                  <div className="absolute top-2.5 left-2.5 z-10 flex items-center justify-center bg-emerald-500 text-zinc-950 p-1 rounded-full shadow-md border border-emerald-450/20" title="E-mail Enviado">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}

                {/* Action Buttons top right (appear on hover) */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    id={`gallery-item-email-btn-${photo.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSendEmail(photo);
                    }}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-emerald-950/80 text-zinc-300 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-900 transition-all shadow-sm cursor-pointer"
                    title="Enviar por E-mail"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                  <button
                    id={`gallery-item-delete-btn-${photo.id}`}
                    disabled={isDeletingId === photo.id}
                    onClick={(e) => handleDelete(photo.id, e)}
                    className="p-2 rounded-xl bg-zinc-900 hover:bg-red-950/80 text-zinc-300 hover:text-red-400 border border-zinc-800 hover:border-red-900 transition-all shadow-sm cursor-pointer"
                    title="Excluir Foto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Bottom title info */}
                <div className="relative p-3 text-left w-full select-none">
                  <div className="flex items-center gap-1.5 justify-between">
                    <p className="text-white font-medium text-xs truncate max-w-[85%]">{photo.name}</p>
                    {sentPhotoIds.includes(photo.id) && (
                      <span className="shrink-0 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" title="Enviado por E-mail">
                        <Check className="w-2.5 h-2.5 stroke-[3.5]" />
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 font-mono text-[9px] mt-0.5">
                    {new Date(photo.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Full screen single view modal */}
      <AnimatePresence>
        {selectedPhoto && (
          <motion.div
            id="gallery-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              id="gallery-modal-content"
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row border border-zinc-800"
            >
              {/* Photo or Video Side */}
              <div id="gallery-modal-image-panel" className="relative flex-1 bg-black aspect-video md:aspect-auto flex items-center justify-center group min-h-[300px]">
                {checkIfVideo(selectedPhoto) ? (
                  <video
                    src={selectedPhoto.dataUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-[70vh] md:max-h-[80vh] w-full object-contain"
                  />
                ) : (
                  <img
                    src={selectedPhoto.dataUrl}
                    alt={selectedPhoto.name}
                    referrerPolicy="no-referrer"
                    className="max-h-[70vh] md:max-h-[80vh] w-full object-contain"
                  />
                )}
                
                {/* Visual Accent */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none md:hidden" />
              </div>

              {/* Sidebar Info & Action Controls */}
              <div id="gallery-modal-sidebar" className="w-full md:w-80 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 select-none">
                <div className="flex flex-col gap-5 text-left">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
                        <Sparkles className="w-3 h-3" /> {checkIfVideo(selectedPhoto) ? "Vídeo Gravado" : "Foto Registrada"}
                      </span>
                      {sentPhotoIds.includes(selectedPhoto.id) && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 w-fit px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3 stroke-[3]" /> Enviado por E-mail
                        </div>
                      )}
                      <h3 className="text-lg font-bold text-zinc-100 mt-2 tracking-tight break-all">
                        {selectedPhoto.name}
                      </h3>
                    </div>
                    <button
                      id="gallery-modal-close-btn"
                      onClick={() => setSelectedPhoto(null)}
                      className="p-1 rounded-lg bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4 rotate-45" />
                    </button>
                  </div>

                  <div className="space-y-4 border-y border-zinc-805 border-zinc-800 py-4 font-sans text-sm text-zinc-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-zinc-500" />
                      <div>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Data</p>
                        <p className="text-zinc-200 font-mono text-xs">
                          {new Date(selectedPhoto.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-zinc-500" />
                      <div>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Tamanho</p>
                        <p className="text-zinc-200 font-mono text-xs">
                          {formatSize(selectedPhoto.size)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-6">
                  <button
                    id="gallery-modal-send-btn"
                    onClick={() => {
                      onSelectSendEmail(selectedPhoto);
                      setSelectedPhoto(null);
                    }}
                    className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-zinc-950 font-semibold rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar por E-mail
                  </button>
                  
                  <button
                    id="gallery-modal-delete-btn"
                    disabled={isDeletingId === selectedPhoto.id}
                    onClick={(e) => handleDelete(selectedPhoto.id, e)}
                    className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-red-950/40 text-red-400 hover:text-red-300 font-medium rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer border border-zinc-800 hover:border-red-950"
                  >
                    <Trash2 className="w-4 h-4" />
                    Deletar {checkIfVideo(selectedPhoto) ? "Vídeo" : "Foto"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
