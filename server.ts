import express from "express";
import path from "path";
import fs from "fs-extra";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Ensure workspace directories exist
const DATA_DIR = path.join(process.cwd(), "data");
const PHOTOS_DIR = path.join(DATA_DIR, "photos");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(PHOTOS_DIR);

if (!fs.existsSync(DB_FILE)) {
  fs.writeJsonSync(DB_FILE, { photos: [], logs: [] });
}

// Helpers for reading/writing our JSON file database safely
function readDatabase() {
  try {
    return fs.readJsonSync(DB_FILE);
  } catch (err) {
    console.error("Error reading database file, resetting:", err);
    return { photos: [], logs: [] };
  }
}

function writeDatabase(data: any) {
  try {
    fs.writeJsonSync(DB_FILE, data, { spaces: 2 });
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

const app = express();
const PORT = 3000;

// Increase payload limit to handle base64 image transmissions
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Serve photos statically so the app can render them with regular links
app.use("/api/static/photos", express.static(PHOTOS_DIR));

// --- API ROUTES ---

// 1. Get database details (photos + default env config indicators)
app.get("/api/config", (req, res) => {
  res.json({
    hasServerSmtp: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    serverSmtpUser: process.env.EMAIL_USER || null,
  });
});

// 2. Fetch all saved photos (metadata only, omitting dataUrl if large or containing local path)
app.get("/api/photos", (req, res) => {
  const db = readDatabase();
  // Return links to photos
  const mappedPhotos = db.photos.map((photo: any) => ({
    ...photo,
    dataUrl: `/api/static/photos/${photo.fileName}`,
  }));
  res.json({ success: true, photos: mappedPhotos });
});

// 3. Save a captured photo (receives base64 image)
app.post("/api/photos", async (req, res) => {
  try {
    const { base64Data, name } = req.body;
    if (!base64Data) {
      return res.status(400).json({ success: false, error: "Missing image data" });
    }

    // Extract base64 clean string
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ success: false, error: "Invalid base64 format" });
    }

    const imageBuffer = Buffer.from(matches[2], "base64");
    const photoId = "photo_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const fileName = `${photoId}.jpg`;
    const filePath = path.join(PHOTOS_DIR, fileName);

    await fs.writeFile(filePath, imageBuffer);

    const now = new Date().toISOString();
    const photoName = name || `Foto_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}_${new Date().toLocaleTimeString("pt-BR").replace(/:/g, "-")}`;
    const fileSize = imageBuffer.length;

    const newPhoto = {
      id: photoId,
      fileName,
      createdAt: now,
      name: photoName,
      size: fileSize,
    };

    const db = readDatabase();
    db.photos.push(newPhoto);
    writeDatabase(db);

    res.json({
      success: true,
      photo: {
        ...newPhoto,
        dataUrl: `/api/static/photos/${fileName}`,
      },
    });
  } catch (error: any) {
    console.error("Error saving photo:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Delete a photo
app.delete("/api/photos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const db = readDatabase();
    const photoIndex = db.photos.findIndex((p: any) => p.id === id);

    if (photoIndex === -1) {
      return res.status(404).json({ success: false, error: "Photo not found" });
    }

    const photo = db.photos[photoIndex];
    const filePath = path.join(PHOTOS_DIR, photo.fileName);

    // Delete photo file synchronously/asynchronously from disk safely
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }

    db.photos.splice(photoIndex, 1);
    writeDatabase(db);

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Send photo by Email
app.post("/api/email/send", async (req, res) => {
  try {
    const { photoId, recipientEmail, subject, textMessage, customSmtp } = req.body;

    if (!photoId || !recipientEmail) {
      return res.status(400).json({ success: false, error: "Faltam parâmetros obrigatórios (photoId ou recipientEmail)" });
    }

    // Get photo metadata from db
    const db = readDatabase();
    const photo = db.photos.find((p: any) => p.id === photoId);
    if (!photo) {
      return res.status(404).json({ success: false, error: "Foto não encontrada no servidor" });
    }

    const photoPath = path.join(PHOTOS_DIR, photo.fileName);
    if (!(await fs.pathExists(photoPath))) {
      return res.status(404).json({ success: false, error: "Arquivo de foto não encontrado em disco" });
    }

    // 1. Establish transporter config
    let transporterConfig: any = null;

    if (customSmtp && customSmtp.host && customSmtp.user) {
      // Use user's registered custom SMTP configuration
      transporterConfig = {
        host: customSmtp.host,
        port: parseInt(customSmtp.port, 10),
        secure: customSmtp.secure, // true for 465, false for 587/25
        auth: {
          user: customSmtp.user,
          pass: customSmtp.pass,
        },
      };
      console.log(`Sending email using Custom SMTP [${customSmtp.user}@${customSmtp.host}]`);
    } else {
      // Use fallback ENV SMTP
      const envUser = process.env.EMAIL_USER;
      const envPass = process.env.EMAIL_PASS;
      const envHost = process.env.SMTP_HOST || "smtp.gmail.com";
      const envPort = parseInt(process.env.SMTP_PORT || "465", 10);

      if (!envUser || !envPass) {
        return res.status(400).json({
          success: false,
          error: "Nenhum servidor SMTP configurado. Por favor, cadastre suas credenciais de remetente SMTP no app ou configure as variáveis EMAIL_USER e EMAIL_PASS no servidor.",
          requiresConfig: true,
        });
      }

      transporterConfig = {
        host: envHost,
        port: envPort,
        secure: envPort === 465,
        auth: {
          user: envUser,
          pass: envPass,
        },
      };
      console.log(`Sending email using Global ENV SMTP [${envUser}]`);
    }

    // 2. Create transporter
    const transporter = nodemailer.createTransport(transporterConfig);

    const mailOptions = {
      from: customSmtp?.senderName 
        ? `"${customSmtp.senderName}" <${transporterConfig.auth.user}>` 
        : `"${process.env.SENDER_NAME || "Galeria de Fotos"}" <${transporterConfig.auth.user}>`,
      to: recipientEmail,
      subject: subject || `Sua Foto - ${photo.name}`,
      text: textMessage || `Olá!\n\nSegue em anexo a foto tirada e enviada através do nosso aplicativo de Câmera.\n\nDetalhes da foto:\n- Nome: ${photo.name}\n- Data: ${new Date(photo.createdAt).toLocaleString("pt-BR")}\n- ID: ${photo.id}\n\nAproveite!`,
      attachments: [
        {
          filename: photo.name.endsWith(".jpg") ? photo.name : `${photo.name}.jpg`,
          path: photoPath,
        },
      ],
    };

    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${recipientEmail}`);

    // Log the successful transaction in our db
    const cleanLog = {
      id: "log_" + Date.now(),
      photoId,
      to: recipientEmail,
      subject: mailOptions.subject,
      sentAt: new Date().toISOString(),
      success: true,
    };
    db.logs = db.logs || [];
    db.logs.push(cleanLog);
    writeDatabase(db);

    res.json({ success: true, message: "E-mail enviado com sucesso!" });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ success: false, error: error.message || "Erro desconhecido ao enviar email" });
  }
});

// 6. Fetch email log history
app.get("/api/logs", (req, res) => {
  const db = readDatabase();
  res.json({ success: true, logs: db.logs || [] });
});

// Vite Middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server fully running on http://localhost:${PORT}`);
  });
}

startServer();
