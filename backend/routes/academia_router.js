import multer from 'multer';
import { Router } from "express";
import { logros_coweb} from "../controllers/academia/coordinador/logros_coweb.js";
import { logros_copdf } from '../controllers/academia/coordinador/logros_copdf.js'

import { logroscJslatex } from '../middlewares/logrosc_latex.js';


import { validateToken } from '../middlewares/val_token.js';
import { validateFile } from '../middlewares/validate_file.js';

const router=new Router();

const upload=multer({dest:"uploads/tmp"})

router.post('/co/logros.web',/*validateToken, validateFile, upload.single('file'),*/ upload.single('file'), logros_coweb)
router.post('/co/logros.pdf', /*validateToken,*/ logroscJslatex, logros_copdf)

export default router