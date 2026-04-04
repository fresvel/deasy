const parseResponseBody = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const dispatchCompileCallback = async (callback, payload) => {
  const url = String(callback?.url || "").trim();
  if (!url) {
    return {
      attempted: false,
      delivered: false,
      reason: "callback_url_missing",
    };
  }

  const token = String(callback?.token || "").trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const body = await parseResponseBody(response);
  return {
    attempted: true,
    delivered: response.ok,
    status: response.status,
    body,
  };
};
