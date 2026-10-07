const serializeContext = (context = {}) => {
  const sanitizedEntries = Object.entries(context).filter(([, value]) => value !== undefined);
  return Object.fromEntries(sanitizedEntries);
};

export const logChatInfo = (event, context = {}) => {
  console.info("[chat]", JSON.stringify({
    level: "info",
    event,
    ...serializeContext(context)
  }));
};

export const logChatError = (event, context = {}) => {
  console.error("[chat]", JSON.stringify({
    level: "error",
    event,
    ...serializeContext(context)
  }));
};
