import "dotenv/config"
import express  from "express";
import academia_router from "./routes/academia_router.js";
import user_router from "./routes/user_router.js";
import tutorias_router from "./routes/tutorias_router.js";
import admin_router from "./routes/admin_router.js"; // Eliminar al pasar todas las funciones a empresa

import program_router from "./routes/program_router.js";
import area_router from "./routes/area_router.js";
import tarea_router from "./routes/tarea_router.js"
import whatsapp_router from "./routes/whatsapp_router.js"

import cors from "cors"
import "./database/mongoose.js"
import cookieParser from "cookie-parser"

const app = express();


const PORT=process.env.PORT ||3030

const whitelist =[process.env.ORIGIN1,process.env.ORIGIN2]

app.use(cors({
    origin:(origin, callback)=> {
      console.log(`Iniciando CORS`)
        console.log("Origin: " + origin);
        if (!origin || whitelist.includes(origin)){
            return callback(null, origin);
        }
        return callback("Error de cors: "+origin+" not authorized");
    },
    credentials: true // Permite el envío de cookies y credenciales
  }
    
))


app.use(express.json());
app.use(cookieParser())

app.use("/easym/v1/academia",academia_router)
app.use("/easym/v1/users",user_router)
app.use("/easym/v1/tutorias",tutorias_router)

app.use("/easym/v1/admin",admin_router)

app.use("/easym/v1/program",program_router)

app.use("/easym/v1/area",area_router)

app.use("/easym/v1/tarea",tarea_router)

app.use("/easym/v1/whatsapp",whatsapp_router)

app.use(express.static("public"));


app.listen(PORT, ()=>{
  console.log(`Servidor iniciado en: http://localhost:${PORT}/easym/v1/`)
});

