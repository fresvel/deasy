import mongoose from "mongoose";

const WebTemplateSchema = new mongoose.Schema({
    code: {type: String, required: true, unique: true},
    name: {type: String, required: true},
    template: {type: String},
    created: {type: Date, default: Date.now},
    updated: {type: Date, default: Date.now},
    estatus: {type: String, default: "activo", enum: ["activo", "inactivo","pendiente"]},
    csvfiles: {type: [String]},
});

export const WebTemplate = mongoose.model("WebTemplate", WebTemplateSchema);