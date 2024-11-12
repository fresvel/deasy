import mongoose from "mongoose";

const facultadSchema = new mongoose.Schema(
    {
        name:{
            type:String,
            required:true,
            unique:true
        }        
    });