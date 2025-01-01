import mongoose from "mongoose";

const areaSchema = new mongoose.Schema({
    code:{
        type: String,
        required:true,
        unique:true
    },
    name:{
        type: String,
        required:true,
    },
    created:{
        type: Date,
        default: Date.now
    },
    estatus:{
        type: String,
        default: "activo",
        enum:["activo","inactivo"]
    }
});

export const Area = mongoose.model("Area", areaSchema);