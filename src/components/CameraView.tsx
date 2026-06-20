import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, AlertCircle, Sparkles, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CameraViewProps {
  onPhotoCaptured: (photo: { dataUrl: string }) => void;
}

export default function CameraView({ onPhotoCaptured }: CameraViewProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [isCapturing, setIsCapturing] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Initialize and clean up stream
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  async function startCamera() {
    setErrorMsg(null);
    stopCamera();

    const constraints = {
      video: {
        facingMode: facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false,
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setPermissionState("granted");
    } catch (err: any) {
      console.error("Erro ao acessar a câmera:", err);
      setPermissionState("denied");

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setErrorMsg("Permissão da câmera negada. Ative as permissões nas configurações do navegador.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setErrorMsg("Nenhuma câmera encontrada no dispositivo.");
      } else {
        setErrorMsg(`Não foi possível iniciar a câmera: ${err.message || "Erro desconhecido"}`);
      }
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !stream) return;

    setIsCapturing(true);
    setShowFlash(true);

    // Dynamic Flash effect timing
    setTimeout(() => {
      setShowFlash(false);
    }, 150);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      
      // Use the actual intrinsic video stream dimensions for maximum photograph clarity
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Handle horizontal flipping for selfie (front) camera to feel natural
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        onPhotoCaptured({ dataUrl });
      }
    } catch (err) {
      console.error("Erro ao capturar foto:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div id="camera-container" className="relative w-full aspect-[4/3] sm:aspect-video rounded-3xl overflow-hidden bg-black border border-zinc-800 shadow-2xl flex flex-col justify-center items-center">
      {/* Live Stream Viewfinder */}
      {permissionState === "granted" && stream && (
        <video
          id="camera-viewfinder"
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />
      )}

      {/* Alignment Grid Overlay */}
      {permissionState === "granted" && stream && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
          <div className="flex justify-between w-full opacity-40">
            <div className="border-t-2 border-l-2 border-white w-6 h-6 rounded-tl-sm" />
            <div className="border-t-2 border-r-2 border-white w-6 h-6 rounded-tr-sm" />
          </div>
          
          {/* Central Target Focus Ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white/40" />
            </div>
          </div>

          <div className="flex justify-between w-full opacity-40">
            <div className="border-b-2 border-l-2 border-white w-6 h-6 rounded-bl-sm" />
            <div className="border-b-2 border-r-2 border-white w-6 h-6 rounded-br-sm" />
          </div>
        </div>
      )}

      {/* Visual Flash effect */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            id="camera-flash"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-white z-20 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Error / Instruction State */}
      {permissionState !== "granted" && (
        <div id="camera-msg-container" className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-zinc-950 text-white z-10 select-none">
          {permissionState === "prompt" ? (
            <div className="flex flex-col items-center max-w-sm">
              <div className="p-4 bg-zinc-800 rounded-2xl mb-4 text-emerald-400">
                <Camera className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-zinc-100">Permissão de Câmera</h3>
              <p className="text-zinc-400 text-sm mt-2 text-balance leading-relaxed">
                Este aplicativo precisa acessar a câmera do seu celular para registrar as fotos.
              </p>
              <button
                id="camera-auth-btn"
                onClick={startCamera}
                className="mt-6 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-zinc-950 font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                Ativar Câmera
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center max-w-sm">
              <div className="p-4 bg-red-950 text-red-400 rounded-2xl mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold tracking-tight text-red-200">Acesso Negado</h3>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                {errorMsg}
              </p>
              <button
                id="camera-retry-btn"
                onClick={startCamera}
                className="mt-6 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 font-medium rounded-xl text-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Controls inside the viewfinder box */}
      {permissionState === "granted" && stream && (
        <div className="absolute bottom-4 inset-x-0 flex items-center justify-between px-6 z-10 pointer-events-none">
          {/* Switch Camera Button */}
          <button
            id="camera-toggle-lens-btn"
            onClick={toggleFacingMode}
            className="pointer-events-auto p-3 rounded-full bg-zinc-900/80 hover:bg-zinc-800 active:scale-90 text-white transition-all backdrop-blur-md cursor-pointer border border-white/10 hover:border-white/30"
            title="Inverter Câmera (Frontal / Traseira)"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          {/* Capture Trigger Button */}
          <button
            id="camera-shutter-btn"
            disabled={isCapturing}
            onClick={capturePhoto}
            className="pointer-events-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent hover:bg-white/10 transition-all cursor-pointer active:scale-95"
          >
            <div className="h-full w-full rounded-full bg-white shadow-md hover:scale-95 transition-transform" />
          </button>

          {/* Indicator Light */}
          <div className="p-2.5 rounded-full bg-zinc-900/80 text-emerald-400 backdrop-blur-md border border-white/10">
            <Sparkles className="w-5 h-5 animate-spin-slow" />
          </div>
        </div>
      )}
    </div>
  );
}
