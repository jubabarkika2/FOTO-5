import React, { useState, useEffect } from "react";
import { Mail, Settings, History, Info, HelpCircle, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, X, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Photo, SMTPSettings, EmailLog } from "../types";

interface EmailModalProps {
  photo: Photo | null;
  onClose: () => void;
}

export default function EmailModal({ photo, onClose }: EmailModalProps) {
  const [activeTab, setActiveTab] = useState<"send" | "sender" | "history">("send");
  
  // Recipient setup (persisted in localStorage)
  const [recipient, setRecipient] = useState<string>(() => {
    return localStorage.getItem("photo_app_recipient") || "";
  });

  // Mail details
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Sender SMTP settings (persisted in localStorage)
  const [smtp, setSmtp] = useState<SMTPSettings>(() => {
    const saved = localStorage.getItem("photo_app_smtp");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use blank default
      }
    }
    return {
      host: "smtp.gmail.com",
      port: 465,
      user: "",
      pass: "",
      secure: true,
      senderName: "Minha Câmera App",
    };
  });

  const [showPassword, setShowPassword] = useState(false);
  const [hasServerSmtp, setHasServerSmtp] = useState(false);
  const [serverSmtpUser, setServerSmtpUser] = useState<string | null>(null);

  // Logs list
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Sending status
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load backend SMTP config if available
  useEffect(() => {
    detectServerConfig();
    fetchLogs();
  }, []);

  // Update default subject and message whenever photo updates
  useEffect(() => {
    if (photo) {
      setSubject(`Foto Enviada: ${photo.name}`);
      setMessage(`Olá!\n\nSegue em anexo a foto "${photo.name}" capturada pelo aplicativo.\n\nData de captura: ${new Date(photo.createdAt).toLocaleString("pt-BR")}\n\nEnviado através do aplicativo Camera & Email.`);
    }
  }, [photo]);

  // Persists Recipient
  const saveRecipient = (val: string) => {
    setRecipient(val);
    localStorage.setItem("photo_app_recipient", val);
  };

  // Persists SMTP settings
  const saveSmtpSettings = (updated: SMTPSettings) => {
    setSmtp(updated);
    localStorage.setItem("photo_app_smtp", JSON.stringify(updated));
  };

  async function detectServerConfig() {
    try {
      const res = await fetch("/api/config");
      const json = await res.json();
      setHasServerSmtp(json.hasServerSmtp);
      setServerSmtpUser(json.serverSmtpUser);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchLogs() {
    setIsLoadingLogs(true);
    try {
      const res = await fetch("/api/logs");
      const json = await res.json();
      if (json.success) {
        setLogs(json.logs.reverse()); // latest first
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingLogs(false);
    }
  }

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return;
    if (!recipient) {
      setFeedback({ type: "error", message: "Insira o e-mail do destinatário para continuar." });
      return;
    }

    setIsSending(true);
    setFeedback(null);

    // Prepare custom SMTP settings if they are provided/customized
    // (If user hasn't typed in user, we try to fall back to server credentials)
    const smtpPayload = smtp.user && smtp.pass ? smtp : null;

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoId: photo.id,
          recipientEmail: recipient,
          subject,
          textMessage: message,
          customSmtp: smtpPayload,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({
          type: "success",
          message: `E-mail enviado com sucesso para ${recipient}!`,
        });
        fetchLogs();
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Ocorreu um erro ao enviar e-mail.",
        });
      }
    } catch (error: any) {
      console.error(error);
      setFeedback({
        type: "error",
        message: "Erro de conexão com o servidor. Tente novamente mais tarde.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="email-modal-overlay" className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm select-none">
      <motion.div
        id="email-modal-card"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-zinc-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-zinc-800"
      >
        {/* Header banner */}
        <div className="bg-[#0e0e11]/80 border-b border-zinc-800 p-5 flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-lg font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              <Mail className="w-5 h-5 text-emerald-555 text-emerald-400" /> Enviar por E-mail
            </h3>
            <p className="text-xs text-zinc-450 text-zinc-400 mt-0.5">Configure o destinatário e o remetente abaixo</p>
          </div>
          <button
            id="email-modal-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 border-b border-zinc-80b border-zinc-800 bg-[#0e0e11] flex gap-2">
          <button
            id="email-modal-tab-send"
            onClick={() => setActiveTab("send")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "send"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Mail className="w-4 h-4" /> Enviar
          </button>
          
          <button
            id="email-modal-tab-sender"
            onClick={() => setActiveTab("sender")}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sender"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Settings className="w-4 h-4" /> Remetente SMTP
          </button>

          <button
            id="email-modal-tab-history"
            onClick={() => {
              setActiveTab("history");
              fetchLogs();
            }}
            className={`py-3 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <History className="w-4 h-4" /> Histórico
          </button>
        </div>

        {/* Dynamic Frame content */}
        <div id="email-modal-content" className="p-6 overflow-y-auto max-h-[70vh] flex-1 text-left">
          
          {feedback && (
            <div
              id="email-modal-feedback"
              className={`mb-5 p-4 rounded-2xl flex items-start gap-3 border text-sm ${
                feedback.type === "success"
                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-950/50"
                  : "bg-red-950/40 text-red-400 border-red-950/50"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="font-semibold">{feedback.type === "success" ? "Sucesso!" : "Algo deu errado:"}</p>
                <p className="text-xs mt-1 leading-relaxed opacity-90">{feedback.message}</p>
              </div>
            </div>
          )}

          {/* TAB 1: COMPOSE AND SEND */}
          {activeTab === "send" && (
            <form onSubmit={handleSendEmail} className="space-y-4">
              {photo && (() => {
                const isVideo = !!(
                  photo.fileName?.endsWith(".webm") ||
                  photo.fileName?.endsWith(".mp4") ||
                  photo.dataUrl?.includes("video") ||
                  photo.name?.toLowerCase().includes("vídeo") ||
                  photo.name?.toLowerCase().includes("video")
                );
                return (
                  <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800 flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg overflow-hidden bg-black border border-zinc-800 flex items-center justify-center">
                      {isVideo ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <video src={photo.dataUrl} className="w-full h-full object-cover opacity-60" muted playsInline />
                          <div className="absolute inset-0 flex items-center justify-center text-red-500">
                            <Video className="w-4 h-4" />
                          </div>
                        </div>
                      ) : (
                        <img src={photo.dataUrl} alt="Attachments Preview" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{photo.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono">Salvo em anexo no e-mail</p>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  E-mail do Destinatário *
                </label>
                <input
                  id="email-modal-recipient-input"
                  type="email"
                  required
                  placeholder="exemplo@gmail.com"
                  value={recipient}
                  onChange={(e) => saveRecipient(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-650 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
                <p className="text-[10px] text-zinc-500 mt-1.5">
                  Este é o e-mail cadastrado que receberá as fotos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Assunto
                </label>
                <input
                  id="email-modal-subject-input"
                  type="text"
                  placeholder="Sua foto capturada"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-650 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                  Mensagem no Corpo do E-mail
                </label>
                <textarea
                  id="email-modal-message-input"
                  rows={4}
                  placeholder="Mensagem do e-mail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-650 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
                />
              </div>

              {/* Status information config alert */}
              {!smtp.user && !hasServerSmtp && (
                <div className="p-3.5 bg-amber-950/25 rounded-2xl border border-amber-900/40 flex gap-2.5 items-start text-xs text-amber-350">
                  <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-200">Remetente não configurado</p>
                    <p className="opacity-90 mt-0.5 leading-relaxed text-amber-400">
                      Defina suas credenciais SMTP na aba <strong>&quot;Remetente SMTP&quot;</strong> para que o app envie e-mails corretamente.
                    </p>
                  </div>
                </div>
              )}

              <button
                id="email-modal-submit-send-btn"
                type="submit"
                disabled={isSending || !photo}
                className="w-full mt-4 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:scale-100 text-zinc-950 font-semibold rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando e-mail...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Enviar Foto por E-mail
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: CONFIGURE SENDER SMTP */}
          {activeTab === "sender" && (
            <div className="space-y-4 font-sans text-zinc-300">
              <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-xs flex gap-2.5 items-start">
                <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="space-y-1 text-left">
                  <p className="font-bold text-zinc-200">Como funcionam os envios?</p>
                  <p className="leading-relaxed opacity-90 text-zinc-400">
                    Você pode cadastrar uma conta de e-mail própria para realizar os disparos do app. Para Gmail, você deve gerar uma <strong>&quot;Senha de App&quot;</strong> de 16 dígitos nas configurações de Segurança da sua Conta Google.
                  </p>
                  {hasServerSmtp && (
                    <p className="text-emerald-400 font-semibold">
                      ✓ Servidor pré-configurado globalmente com: {serverSmtpUser}.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300">
                  Nome de Exibição do Remetente
                </label>
                <input
                  id="email-modal-smtp-name"
                  type="text"
                  placeholder="Minha Câmera App"
                  value={smtp.senderName}
                  onChange={(e) => saveSmtpSettings({ ...smtp, senderName: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-xl text-sm focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300">
                    Servidor SMTP
                  </label>
                  <input
                    id="email-modal-smtp-host"
                    type="text"
                    placeholder="smtp.gmail.com"
                    value={smtp.host}
                    onChange={(e) => saveSmtpSettings({ ...smtp, host: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300">
                    Porta
                  </label>
                  <input
                    id="email-modal-smtp-port"
                    type="number"
                    placeholder="465"
                    value={smtp.port}
                    onChange={(e) => saveSmtpSettings({ ...smtp, port: parseInt(e.target.value, 10) })}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-650 rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300">
                  E-mail do Remetente (Usuário)
                </label>
                <input
                  id="email-modal-smtp-user"
                  type="email"
                  placeholder="seu-email@gmail.com"
                  value={smtp.user}
                  onChange={(e) => saveSmtpSettings({ ...smtp, user: e.target.value })}
                  className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-600 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-zinc-300">
                  Senha de App de 16 Dígitos
                </label>
                <div className="relative">
                  <input
                    id="email-modal-smtp-pass"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••••••"
                    value={smtp.pass}
                    onChange={(e) => saveSmtpSettings({ ...smtp, pass: e.target.value })}
                    className="w-full px-4 py-2 bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-650 rounded-xl text-sm pr-10"
                  />
                  <button
                    id="email-modal-smtp-toggle-pass"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-2.5 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Se usar Gmail, ative a Verificação de Duas Etapas e crie uma senha de app.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 text-left">
                <input
                  id="email-modal-smtp-secure"
                  type="checkbox"
                  checked={smtp.secure}
                  onChange={(e) => saveSmtpSettings({ ...smtp, secure: e.target.checked })}
                  className="rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/20 h-4 w-4"
                />
                <label className="text-xs text-zinc-400">Conexão Segura SSL/TLS (Recomendada para Porta 465)</label>
              </div>

              <div className="pt-2">
                <button
                  id="email-modal-smtp-save-btn"
                  type="button"
                  onClick={() => {
                    setFeedback({
                      type: "success",
                      message: "Configuração do remetente SMTP salva com sucesso localmente!",
                    });
                  }}
                  className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-850 active:scale-95 text-zinc-100 font-semibold rounded-xl text-xs border border-zinc-800 transition transition-all cursor-pointer"
                >
                  Salvar Remetente de E-mail
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: HISTORY LOGS */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-400">Histórico de saídas de e-mails do servidor</p>
                <button
                  id="email-modal-refresh-logs"
                  type="button"
                  onClick={fetchLogs}
                  className="text-xs font-semibold text-emerald-400 hover:underline"
                >
                  Atualizar
                </button>
              </div>

              {isLoadingLogs ? (
                <div className="py-8 flex justify-center text-zinc-500 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 mr-2" /> Carregando logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
                  <History className="w-6 h-6 text-zinc-650 mx-auto mb-2 text-zinc-600" />
                  <p className="text-xs">Nenhum e-mail enviado recentemente.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 flex items-start gap-3 text-left">
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-emerald-405 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-405 text-red-400 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-bold text-zinc-200 truncate">Para: {log.to}</p>
                          <span className="text-[9px] font-mono text-zinc-500 mt-0.5 uppercase shrink-0">
                            {new Date(log.sentAt).toLocaleTimeString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-450 text-zinc-400 truncate mt-0.5">Assunto: {log.subject}</p>
                        {log.error && <p className="text-[9px] text-red-400 mt-1 max-w-full font-mono">{log.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
