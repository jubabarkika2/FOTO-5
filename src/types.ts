export interface Photo {
  id: string;
  dataUrl: string; // Base64 or URL
  createdAt: string;
  name: string;
  size?: number; // Size in bytes
}

export interface SMTPSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  senderName: string;
}

export interface EmailLog {
  id: string;
  photoId: string;
  to: string;
  subject: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
