import multer from 'multer'
import {Router} from 'express'
import path from 'path'
import fs from 'fs-extra'

import { createWebTemplate } from '../controllers/informes/webtemplate_controler.js'

/*
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Body")
    console.log(req.body)
    //const template_name=JSON.parse(req.body.jsonData).name
    const template_path=path.join('services','webtemplate','storage','tmp', "template_name")
    cb(null, ``); 
    if (!fs.existsSync(template_path)) {
      fs.mkdirSync(template_path, { recursive: true });
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileName = `${uniqueSuffix}${path.extname(file.originalname)}`; // Mantiene la extensión original
    cb(null, fileName);
  }
});
*/
//const upload = multer({ storage });
const upload=multer({dest:"uploads/tmp/web_templates"})

const router = new Router();


router.get('/', createWebTemplate);


router.post('/', upload.array('files'), createWebTemplate);

export default router;
