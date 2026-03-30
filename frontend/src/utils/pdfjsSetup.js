import "./pdfjsPolyfills";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import PdfWorker from "@/utils/pdfjsWorkerBootstrap?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };
