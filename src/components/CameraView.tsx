import { useState, useRef, useEffect } from "react";
import { Camera, RefreshCw, AlertCircle, Sparkles, Check, Video } from "lucide-react";
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

  // Video recording states
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recTime, setRecTime] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recIntervalRef = useRef<any>(null);

  // Initialize and clean up stream
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  // Safely bind stream to the video element after it has mounted
  useEffect(() => {
    if (stream && videoRef.current) {
      try {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((playErr) => {
          console.warn("Retrying play on user interaction or next frame:", playErr);
        });
      } catch (err) {
        console.error("Error setting video srcObject:", err);
      }
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (recIntervalRef.current) {
        clearInterval(recIntervalRef.current);
      }
    };
  }, []);

  async function startCamera() {
    setErrorMsg(null);
    stopCamera();

    // Cascaded constraints to maximize device and browser compatibility (PC, iOS, Android, etc.)
    const constraintsSet = [
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false,
      },
      {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      },
      {
        video: {
          facingMode: facingMode,
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      }
    ];

    let mediaStream: MediaStream | null = null;
    let lastError: any = null;

    for (const constraints of constraintsSet) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) break;
      } catch (err: any) {
        console.warn(`getUserMedia attempt failed with constraints:`, constraints, err);
        lastError = err;
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      setPermissionState("granted");
    }

    if (!mediaStream) {
      console.error("Erro ao acessar a câmera no dispositivo:", lastError);
      setPermissionState("denied");

      if (lastError) {
        if (lastError.name === "NotAllowedError" || lastError.name === "PermissionDeniedError") {
          setErrorMsg("Permissão da câmera negada. Ative as permissões nas configurações do navegador ou do celular.");
        } else if (lastError.name === "NotFoundError" || lastError.name === "DevicesNotFoundError") {
          setErrorMsg("Nenhuma câmera encontrada no seu dispositivo.");
        } else if (lastError.name === "NotReadableError" || lastError.name === "TrackStartError") {
          setErrorMsg("A câmera já está em uso por outro aplicativo ou aba do navegador.");
        } else {
          setErrorMsg(`Não foi possível iniciar a câmera: ${lastError.message || "Erro desconhecido"}`);
        }
      } else {
        setErrorMsg("Não foi possível acessar a câmera do dispositivo.");
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
      
      // Scale down high-resolution images slightly to ensure fast and reliable network transmission while maintaining great clarity
      let targetWidth = video.videoWidth || 640;
      let targetHeight = video.videoHeight || 480;
      const MAX_DIMENSION = 1024;
      
      if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
        if (targetWidth > targetHeight) {
          targetHeight = Math.round((targetHeight * MAX_DIMENSION) / targetWidth);
          targetWidth = MAX_DIMENSION;
        } else {
          targetWidth = Math.round((targetWidth * MAX_DIMENSION) / targetHeight);
          targetHeight = MAX_DIMENSION;
        }
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Handle horizontal flipping for selfie (front) camera to feel natural
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Use 0.8 quality instead of 0.9 (virtually identical visually, but generates vastly smaller files)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.80);
        onPhotoCaptured({ dataUrl });
      }
    } catch (err) {
      console.error("Erro ao capturar foto:", err);
    } finally {
      setIsCapturing(false);
    }
  };

  const startRecording = () => {
    if (!stream) return;
    chunksRef.current = [];
    
    try {
      let mimeType = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
      }

      const options = mimeType ? { mimeType } : undefined;
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          onPhotoCaptured({ dataUrl: base64Data });
        };
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(200);
      setIsRecording(true);
      setRecTime(0);

      recIntervalRef.current = setInterval(() => {
        setRecTime((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao iniciar gravação de vídeo:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recIntervalRef.current) {
        clearInterval(recIntervalRef.current);
        recIntervalRef.current = null;
      }
    }
  };

  return (
    <div id="camera-container" className="relative w-full aspect-[2/3] sm:aspect-[8/9] md:max-h-[640px] rounded-3xl overflow-hidden bg-black border border-zinc-800 shadow-2xl flex flex-col justify-center items-center">
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
        <>
          {/* Recording Time Overlay */}
          {isRecording && (
            <div className="absolute top-4 left-4 z-20 pointer-events-none flex items-center gap-2 bg-black/70 px-3 py-1.5 rounded-full border border-red-500/30 text-white font-mono text-xs select-none">
              <div className="h-2.5 w-2.5 rounded-full bg-red-600 animate-ping" />
              <span className="font-bold uppercase text-[10px] tracking-wider text-red-400">REC</span>
              <span className="text-zinc-300 font-medium">
                {Math.floor(recTime / 60).toString().padStart(2, "0")}:{(recTime % 60).toString().padStart(2, "0")}
              </span>
            </div>
          )}

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
            {mode === "photo" ? (
              <button
                id="camera-shutter-btn"
                disabled={isCapturing}
                onClick={capturePhoto}
                className="pointer-events-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent hover:bg-white/10 transition-all cursor-pointer active:scale-95"
                title="Tirar Foto"
              >
                <div className="h-full w-full rounded-full bg-white shadow-md hover:scale-95 transition-transform" />
              </button>
            ) : (
              <button
                id="camera-video-record-btn"
                onClick={isRecording ? stopRecording : startRecording}
                className="pointer-events-auto h-16 w-16 sm:h-20 sm:w-20 rounded-full border-4 border-white flex items-center justify-center p-1 bg-transparent hover:bg-white/10 transition-all cursor-pointer active:scale-95 relative"
                title={isRecording ? "Parar Gravação" : "Gravar Vídeo"}
              >
                {isRecording ? (
                  <div className="h-8 w-8 sm:h-10 sm:w-10 bg-red-600 rounded-lg shadow-md" />
                ) : (
                  <div className="h-full w-full rounded-full bg-red-600 shadow-md hover:scale-95 transition-transform animate-pulse" />
                )}
              </button>
            )}

            {/* Photo / Video Option - Right Side of Shutter Button */}
            <div className="pointer-events-auto flex items-center bg-zinc-900/90 p-1 rounded-full border border-white/15 backdrop-blur-md select-none shadow-lg">
              <button
                id="camera-mode-photo-btn"
                type="button"
                onClick={() => {
                  if (isRecording) stopRecording();
                  setMode("photo");
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  mode === "photo"
                    ? "bg-emerald-500 text-zinc-950 font-extrabold shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Foto
              </button>
              <button
                id="camera-mode-video-btn"
                type="button"
                onClick={() => {
                  setMode("video");
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  mode === "video"
                    ? "bg-red-600 text-white font-extrabold shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Vídeo
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
