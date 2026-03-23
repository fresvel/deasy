import axios from "axios";
import { API_PREFIX } from "../apiConfig";
import AuthService from "../auth/AuthService";

class DossierService {
  getCedula() {
    return AuthService.getCedula();
  }

  async getDossier() {
    const cedula = this.getCedula();
    if (!cedula) throw new Error("No hay usuario logueado");

    const url = `${API_PREFIX}/dossier/${cedula}`;
    const response = await axios.get(url);
    return response.data;
  }

  // Títulos
  async getTitulos() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.titulos || [];
  }

  async createTitulo(payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/titulos`, payload);
    return response.data;
  }

  async updateTitulo(tituloId, payload) {
    const cedula = this.getCedula();
    const response = await axios.put(`${API_PREFIX}/dossier/${cedula}/titulos/${tituloId}`, payload);
    return response.data;
  }

  async deleteTitulo(tituloId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/titulos/${tituloId}`);
    return response.data;
  }

  async uploadTituloDocument(tituloId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/titulo/${tituloId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }

  // Experiencia
  async getExperiencia() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.experiencia || [];
  }

  async createExperiencia(payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/experiencia`, payload);
    return response.data;
  }

  async deleteExperiencia(experienciaId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/experiencia/${experienciaId}`);
    return response.data;
  }

  async uploadExperienciaDocument(experienciaId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/experiencia/${experienciaId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }

  // Referencias
  async getReferencias() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.referencias || [];
  }

  async createReferencia(payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/referencias`, payload);
    return response.data;
  }

  async deleteReferencia(referenciaId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/referencias/${referenciaId}`);
    return response.data;
  }

  async uploadReferenciaDocument(referenciaId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/referencia/${referenciaId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }

  // Certificaciones
  async getCertificaciones() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.certificaciones || [];
  }

  async createCertificacion(payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/certificaciones`, payload);
    return response.data;
  }

  async deleteCertificacion(certificacionId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/certificaciones/${certificacionId}`);
    return response.data;
  }

  async uploadCertificacionDocument(certificacionId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/certificacion/${certificacionId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }

  // Capacitación
  async getCapacitacion() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.formacion || [];
  }

  async createCapacitacion(payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/formacion`, payload);
    return response.data;
  }

  async deleteCapacitacion(capacitacionId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/formacion/${capacitacionId}`);
    return response.data;
  }

  async uploadCapacitacionDocument(capacitacionId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/formacion/${capacitacionId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }

  // Investigación
  async getInvestigacion() {
    const cedula = this.getCedula();
    const response = await axios.get(`${API_PREFIX}/dossier/${cedula}`);
    return response.data?.data?.investigacion || {};
  }

  async createInvestigacion(tipo, payload) {
    const cedula = this.getCedula();
    const response = await axios.post(`${API_PREFIX}/dossier/${cedula}/investigacion/${tipo}`, payload);
    return response.data;
  }

  async deleteInvestigacion(tipo, investigacionId) {
    const cedula = this.getCedula();
    const response = await axios.delete(`${API_PREFIX}/dossier/${cedula}/investigacion/${tipo}/${investigacionId}`);
    return response.data;
  }

  async uploadInvestigacionDocument(tipo, investigacionId, file) {
    const cedula = this.getCedula();
    const formData = new FormData();
    formData.append("archivo", file);
    const response = await axios.post(
      `${API_PREFIX}/dossier/${cedula}/documentos/${tipo}/${investigacionId}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  }
}

export default new DossierService();