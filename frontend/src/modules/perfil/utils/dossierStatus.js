export const mapDossierStatusToSeraType = (status) => {
  const normalized = String(status || "").trim().toLowerCase();

  if (!normalized || normalized === "enviado") {
    return "pending";
  }

  if (["revisado", "reviewed"].includes(normalized)) {
    return "reviewed";
  }

  if (["aprobado", "certificado", "approved", "certified"].includes(normalized)) {
    return "certified";
  }

  if (["rechazado", "denegado", "denied", "rejected"].includes(normalized)) {
    return "denied";
  }

  return "pending";
};
