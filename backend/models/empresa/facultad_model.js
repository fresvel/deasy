import mongoose from "mongoose";

const facultadSchema = new mongoose.Schema(
    {
        code:{
            type: String,
            required:true,
            unique:true
        },
        name:{
            type:String,
            required:true,
        }     
    });

export const Facultad = mongoose.model("Facultad", facultadSchema);