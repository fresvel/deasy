/**
 * Responsabilidad: validar la consistencia del PDF SENESCYT parseado.
 * Verifica cédula, campos mínimos y emite errors y warnings estructurados.
 */
export class SenescytPdfValidationService {

    // ─── Validación de cédula ecuatoriana ────────────────────────────────────

    /**
     * Algoritmo módulo 10 para cédulas ecuatorianas.
     * @param {string} cedula - exactamente 10 dígitos
     * @returns {boolean}
     */
    _validarAlgoritmoCedula(cedula) {
        if (!/^\d{10}$/.test(cedula)) return false;

        const provincia = parseInt(cedula.substring(0, 2), 10);
        if (provincia < 1 || provincia > 24) return false;

        const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
        let suma = 0;

        for (let i = 0; i < 9; i++) {
            let val = parseInt(cedula[i], 10) * coeficientes[i];
            if (val >= 10) val -= 9;
            suma += val;
        }

        const digitoVerificador = parseInt(cedula[9], 10);
        const residuo = suma % 10;
        const calculado = residuo === 0 ? 0 : 10 - residuo;

        return calculado === digitoVerificador;
    }

    // ─── Validaciones individuales ───────────────────────────────────────────

    /**
     * Valida la cédula detectada en el PDF y la compara con la cédula del dosier.
     * @param {string|null} cedulaPdf   - cédula extraída del PDF
     * @param {string}      cedulaDosier - cédula de la URL/dosier
     * @returns {{valid: boolean, error: string|null}}
     */
    validateCedula(cedulaPdf, cedulaDosier) {
        if (!cedulaPdf) {
            return { valid: false, error: 'No se detectó cédula en el PDF SENESCYT.' };
        }

        if (!/^\d{10}$/.test(cedulaPdf)) {
            return { valid: false, error: `Cédula detectada inválida: "${cedulaPdf}". Debe tener 10 dígitos.` };
        }

        if (!this._validarAlgoritmoCedula(cedulaPdf)) {
            return { valid: false, error: `Cédula detectada no supera el algoritmo de validación ecuatoriano: "${cedulaPdf}".` };
        }

        if (cedulaPdf !== String(cedulaDosier).trim()) {
            return {
                valid: false,
                error: `La cédula del PDF (${cedulaPdf}) no coincide con la cédula del dosier (${cedulaDosier}). Importación rechazada.`
            };
        }

        return { valid: true, error: null };
    }

    /**
     * Valida los campos mínimos de un título parseado.
     * Emite warnings (no errores) para campos opcionales ausentes.
     * @param {object} titulo - título mapeado por SenescytPdfParserService
     * @returns {{errors: string[], warnings: string[]}}
     */
    validateTitulo(titulo) {
        const errors   = [];
        const warnings = [];

        if (!titulo.titulo) errors.push('El campo "título" es obligatorio.');
        if (!titulo.nivel)  errors.push('El campo "nivel" es obligatorio.');

        if (!titulo.ies)           warnings.push('Campo "institución (IES)" no detectado.');
        if (!titulo.sreg)          warnings.push('Campo "número de registro SENESCYT" no detectado.');
        if (!titulo.campo_amplio)  warnings.push('Campo "campo amplio" no detectado.');
        if (!titulo.fecha_registro) warnings.push('Campo "fecha de registro" no detectado.');
        if (!titulo.registro_tipo)  warnings.push('Campo "tipo de registro" (Nacional/Extranjero) no detectado.');

        return { errors, warnings };
    }

    // ─── API pública ─────────────────────────────────────────────────────────

    /**
     * Valida el resultado completo del parser.
     * Lanza un Error si la validación crítica falla (cédula incorrecta).
     * Devuelve los warnings acumulados para incluirlos en el preview.
     *
     * @param {{titular: {nombre, cedula}, titulos: object[]}} parsed
     * @param {string} cedulaDosier
     * @returns {{titulos: object[], globalWarnings: string[]}}
     * @throws {Error} si la cédula no coincide o no hay títulos detectados
     */
    validate(parsed, cedulaDosier) {
        const { titular, titulos } = parsed;

        // Validación crítica: cédula
        const cedulaResult = this.validateCedula(titular.cedula, cedulaDosier);
        if (!cedulaResult.valid) {
            throw new Error(cedulaResult.error);
        }

        if (!titulos || titulos.length === 0) {
            throw new Error('No se detectaron títulos en el PDF SENESCYT.');
        }

        const globalWarnings = [];
        const titulosValidados = titulos.map(titulo => {
            const { errors, warnings } = this.validateTitulo(titulo);

            // Errores de título individuales se degradan a warnings en el preview
            // para no bloquear el flujo; el usuario decide si confirmar.
            const allWarnings = [
                ...(titulo.import_warnings || []),
                ...errors.map(e => `[ERROR] ${e}`),
                ...warnings
            ];

            return { ...titulo, import_warnings: allWarnings };
        });

        return { titulos: titulosValidados, globalWarnings };
    }
}
