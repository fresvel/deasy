import multer from 'multer';
import { Router } from "express";
import { logroscWeb} from "../controllers/logrosc_web.js";
import { logroscPdf } from '../controllers/logrosc_pdf.js';
import { logroscJslatex } from '../middlewares/logrosc_latex.js';
import { validateToken } from '../middlewares/val_token.js';
import { validateFile } from '../middlewares/validate_file.js';

const router=new Router();

const upload=multer({dest:"uploads", filename:"hello"})



router.post('/logrosc.web',/*validateToken, validateFile,*/ upload.single('file'), logroscWeb)
router.post('/logrosc.pdf', /*validateToken,*/ logroscJslatex, logroscPdf)

export default router