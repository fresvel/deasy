import "@/core/utils/pdfjsPolyfills";
import * as pdfjsLib from "pdfjs-dist/build/pdf.mjs";
import PdfWorker from "@/core/utils/pdfjsWorkerBootstrap?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };
