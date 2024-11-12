import "dotenv/config"
import express  from "express";
import report_router from "./routes/report_router.js";
import users_router from "./routes/auth_router.js";
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

app.use("/easym/v1/report",report_router)
app.use("/easym/v1/users",users_router)



app.use(express.static("public"));

app.listen(PORT, ()=>{
  console.log(`Servidor iniciado en: http://localhost:${PORT}/easym/v1/`)
});

