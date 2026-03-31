// pdfjs-dist v4+ — importación ESM del build principal.
// En Node.js no hay DOM ni Worker, por lo que deshabilitamos el worker.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = '';

/**
 * Responsabilidad: leer el PDF SENESCYT y extraer texto crudo,
 * devolviendo rawText, texto por página y metadatos del documento.
 */
export class SenescytPdfTextExtractorService {
    /**
     * Extrae todo el texto de un PDF dado como Buffer.
     *
     * @param {Buffer} pdfBuffer
     * @returns {Promise<{rawText: string, pages: string[], metadata: Record<string, unknown>}>}
     */
    async extract(pdfBuffer) {
        const uint8Array = new Uint8Array(pdfBuffer);

        const loadingTask = getDocument({ data: uint8Array, verbosity: 0 });
        const pdf = await loadingTask.promise;

        const numPages = pdf.numPages;
        const pages    = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page       = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText   = textContent.items
                .map(item => ('str' in item ? item.str : ''))
                .join(' ');
            pages.push(pageText);
        }

        let metadata = {};
        try {
            const meta = await pdf.getMetadata();
            metadata = meta?.info ?? {};
        } catch (_) {
            // metadatos opcionales — continuar sin ellos
        }

        const rawText = pages.join('\n');

        return { rawText, pages, metadata };
    }
}
