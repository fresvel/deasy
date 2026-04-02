/**
 * Responsabilidad: detectar datos del titular y uno o varios títulos
 * dentro del texto extraído del PDF SENESCYT, y mapearlos al formato
 * interno del schema de dossier.
 *
 * Los PDFs de SENESCYT (Certificado de Registro de Títulos) siguen un
 * formato de texto con etiquetas en mayúsculas. Este parser usa regex
 * flexibles para capturar los campos conocidos.
 */
export class SenescytPdfParserService {

    // ─── Helpers de regex ───────────────────────────────────────────────────

    
    /**
     * Extrae el valor que sigue a una etiqueta dada.
     * Acepta variaciones de espaciado, dos puntos, etc.
     * @param {string} text
     * @param {string[]} labels  - lista de etiquetas alternativas a buscar
     * @returns {string|null}
     */
    _field(text, labels) {
        for (const label of labels) {
            const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Captura todo hasta el fin de línea o hasta la próxima etiqueta en mayúsculas
            const re = new RegExp(
                `${escaped}\\s*:?\\s*([^\\n\\r]+?)(?=\\s*(?:[A-ZÁÉÍÓÚÑÜ]{3,}\\s*:|$))`,
                'i'
            );
            const m = text.match(re);
            if (m && m[1]?.trim()) return m[1].trim();
        }
        return null;
    }

    /**
     * Normaliza una fecha extraída del PDF.
     * Acepta formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY.
     * @param {string|null} raw
     * @returns {Date|null}
     */
    _parseDate(raw) {
        if (!raw) return null;
        // DD/MM/YYYY o DD-MM-YYYY
        const dmyMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
            return new Date(`${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`);
        }
        // YYYY-MM-DD
        const isoMatch = raw.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/);
        if (isoMatch) {
            return new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
        }
        const d = new Date(raw);
        return isNaN(d.getTime()) ? null : d;
    }

    /**
     * Mapea el texto del nivel de SENESCYT al enum interno del dossier.
     * @param {string|null} raw
     * @returns {string|null}
     */
    _mapNivel(raw) {
        if (!raw) return null;
        const s = raw.toUpperCase().trim();
        if (s.includes('TÉCNICO') || s.includes('TECNICO'))                            return 'Técnico';
        if (s.includes('TECNÓLOGO') || s.includes('TECNOLOGO'))                       return 'Tecnólogo';
        if (s.includes('MAESTRÍA TECNOLÓGICA') || s.includes('MAESTRIA TECNOLOGICA')) return 'Maestría Tecnológica';
        if (s.includes('MAESTRÍA') || s.includes('MAESTRIA'))                         return 'Maestría';
        if (s.includes('DOCTORADO') || s.includes('PHD'))                             return 'Doctorado';
        if (s.includes('POSDOCTORADO') || s.includes('POSTDOCTORADO'))               return 'Posdoctorado';
        if (s.includes('DIPLOMADO'))                                                   return 'Diplomado';
        if (s.includes('GRADO') || s.includes('TERCER'))                              return 'Grado';
        return null;
    }

    /**
     * Normaliza el tipo de registro (Nacional / Extranjero).
     * @param {string|null} raw
     * @returns {'Nacional'|'Extranjero'|null}
     */
    _mapRegistroTipo(raw) {
        if (!raw) return null;
        const s = raw.toUpperCase().trim();
        if (s.includes('EXTRANJERO') || s.includes('EXTERIOR')) return 'Extranjero';
        if (s.includes('NACIONAL'))                              return 'Nacional';
        return null;
    }

    // ─── Extracción del titular ──────────────────────────────────────────────

    /**
     * Extrae los datos del titular (nombre y cédula) del texto del PDF.
     * @param {string} rawText
     * @returns {{nombre: string|null, cedula: string|null}}
     */
    parseTitular(rawText) {
        const nombre = this._field(rawText, [
            'NOMBRES Y APELLIDOS',
            'NOMBRE COMPLETO',
            'NOMBRE',
            'NOMBRES',
            'APELLIDOS Y NOMBRES'
        ]);

        const cedulaRaw = this._field(rawText, [
            'NÚMERO DE CÉDULA',
            'NUMERO DE CEDULA',
            'CÉDULA',
            'CEDULA',
            'CÉDULA DE IDENTIDAD',
            'CEDULA DE IDENTIDAD',
            'NÚMERO DE IDENTIFICACIÓN',
            'NUMERO DE IDENTIFICACION'
        ]);

        // Cédula ecuatoriana: exactamente 10 dígitos
        let cedula = null;
        if (cedulaRaw) {
            const digits = cedulaRaw.replace(/\D/g, '');
            cedula = digits.length === 10 ? digits : null;
        }
        if (!cedula) {
            const m = rawText.match(/\b(\d{10})\b/);
            cedula = m ? m[1] : null;
        }

        return { nombre, cedula };
    }

    // ─── Extracción de títulos ───────────────────────────────────────────────

    /**
     * Divide el texto crudo en bloques, uno por título registrado.
     * SENESCYT puede listar varios títulos en el mismo certificado.
     * @param {string} rawText
     * @returns {string[]}
     */
    _splitIntoTituloBlocks(rawText) {
        // Separar por numeración + etiqueta TÍTULO
        const byNumeric = rawText.split(/(?=\n\s*\d+[.)]\s+TÍTULO\s*:)/i);
        if (byNumeric.length > 1) return byNumeric;

        // Separar por repetición de la etiqueta TÍTULO al inicio de línea
        const byLabel = rawText.split(/(?=\nTÍTULO\s*:|\nTITULO\s*:)/i);
        if (byLabel.length > 1) return byLabel;

        return [rawText];
    }

    /**
     * Parsea un bloque de texto que corresponde a un título y lo mapea
     * al formato esperado por tituloSchema.
     * @param {string} block
     * @returns {Record<string, unknown>}
     */
    _parseTituloBlock(block) {
        const titulo        = this._field(block, ['TÍTULO','TITULO']);
        const ies           = this._field(block, ['INSTITUCIÓN','INSTITUCION','UNIVERSIDAD','IES']);
        const nivelRaw      = this._field(block, ['NIVEL','NIVEL DE FORMACIÓN','NIVEL DE FORMACION']);
        const sreg          = this._field(block, [
            'NÚMERO DE REGISTRO SENESCYT',
            'NUMERO DE REGISTRO SENESCYT',
            'NÚMERO DE REGISTRO',
            'NUMERO DE REGISTRO',
            'REGISTRO',
            'SREG'
        ]);
        const campo_amplio  = this._field(block, ['CAMPO AMPLIO','AREA DE CONOCIMIENTO','ÁREA DE CONOCIMIENTO']);
        const fechaRaw      = this._field(block, ['FECHA DE REGISTRO','FECHA REGISTRO','FECHA']);
        const registroRaw   = this._field(block, ['TIPO DE REGISTRO','TIPO','REGISTRO TIPO']);
        const paisRaw       = this._field(block, ['PAÍS','PAIS']);

        const warnings = [];
        if (!titulo)       warnings.push('Campo "título" no detectado');
        if (!ies)          warnings.push('Campo "institución" no detectado');
        if (!nivelRaw)     warnings.push('Campo "nivel" no detectado');
        if (!sreg)         warnings.push('Campo "número de registro SENESCYT" no detectado');
        if (!campo_amplio) warnings.push('Campo "campo amplio" no detectado');

        const nivel          = this._mapNivel(nivelRaw);
        const registro_tipo  = this._mapRegistroTipo(registroRaw);
        const fecha_registro = this._parseDate(fechaRaw);

        return {
            titulo:          titulo  ?? null,
            ies:             ies     ?? null,
            nivel:           nivel   ?? 'Grado',  // default para no romper validación Mongoose
            sreg:            sreg    ?? null,
            campo_amplio:    campo_amplio  ?? null,
            fecha_registro:  fecha_registro,
            registro_tipo:   registro_tipo,
            pais:            paisRaw ?? 'Ecuador',
            sera:            'Enviado',
            source:          'senescyt_import',
            imported_at:     new Date(),
            import_warnings: warnings
        };
    }

    // ─── API pública ────────────────────────────────────────────────────────

    /**
     * Punto de entrada principal. Parsea el rawText del PDF SENESCYT.
     *
     * @param {string} rawText - texto extraído por SenescytPdfTextExtractorService
     * @returns {{titular: {nombre: string|null, cedula: string|null}, titulos: object[]}}
     */
    parse(rawText) {
        const titular = this.parseTitular(rawText);
        const blocks  = this._splitIntoTituloBlocks(rawText);
        const titulos = blocks
            .map(b => this._parseTituloBlock(b))
            .filter(t => t.titulo || t.ies || t.sreg); // descartar bloques vacíos

        return { titular, titulos };
    }
}
