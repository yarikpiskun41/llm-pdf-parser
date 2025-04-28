import {Request, Router} from "express";
import multer, {FileFilterCallback} from 'multer';
import path from 'path';
import fs from 'fs';
import {documentController} from "@app/routes/document/document.controller";


export function documentRouter(): Router {
  const router = Router({mergeParams: true});

  const uploadDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {recursive: true});
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(uploadDir)) {
        console.error(`[Multer] Destination directory check failed: ${uploadDir} does not exist.`);
        return cb(new Error(`Upload destination directory does not exist: ${uploadDir}`), '');
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const newFilename = `pdf-${uniqueSuffix}${ext}`;
        console.log(`[Multer] Generating filename: ${newFilename}`);
        cb(null, newFilename);
      } catch (error: any) {
        console.error("[Multer] Error generating filename:", error);
        cb(error, '');
      }
    }
  });

  const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
      return cb(new Error('Only PDF files are allowed!'));
    }
    cb(null, true);
  };

  const upload = multer({storage: storage, fileFilter: fileFilter});

  router.post('/upload', upload.single('pdfFile'), documentController.uploadFile)
  router.get('/status/:fileId', documentController.checkFileStatus)
  router.post('/ask', documentController.chatAsk)

  return router;
}

