import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

export function useAdminFkManager({
  formData,
  fkDisplay,
  inlineFkSuggestions,
  inlineFkLoading,
  inlineFkTouched,
  inlineFkActiveField,
  visibleFormFields,
  isFieldLocked,
  resolveFkTable,
  formatFkOptionLabel
}) {
  const inlineFkCloseTimers = {};
  const inlineFkQueryTimers = {};

  const resetInlineFkState = () => {
    inlineFkSuggestions.value = {};
    inlineFkLoading.value = {};
    inlineFkTouched.value = {};
    inlineFkActiveField.value = "";
    Object.values(inlineFkCloseTimers).forEach((timerId) => {
      clearTimeout(timerId);
    });
    Object.keys(inlineFkCloseTimers).forEach((key) => {
      delete inlineFkCloseTimers[key];
    });
    Object.values(inlineFkQueryTimers).forEach((timerId) => {
      clearTimeout(timerId);
    });
    Object.keys(inlineFkQueryTimers).forEach((key) => {
      delete inlineFkQueryTimers[key];
    });
  };

  const cancelInlineFkClose = (fieldName) => {
    if (!fieldName || !inlineFkCloseTimers[fieldName]) {
      return;
    }
    clearTimeout(inlineFkCloseTimers[fieldName]);
    delete inlineFkCloseTimers[fieldName];
  };

  const scheduleInlineFkClose = (fieldName) => {
    if (!fieldName) {
      return;
    }
    cancelInlineFkClose(fieldName);
    inlineFkCloseTimers[fieldName] = setTimeout(() => {
      if (inlineFkActiveField.value === fieldName) {
        inlineFkActiveField.value = "";
      }
      delete inlineFkCloseTimers[fieldName];
    }, 150);
  };

  const shouldShowInlineFkSuggestions = (fieldName) => (
    inlineFkActiveField.value === fieldName
    && (inlineFkLoading.value[fieldName] || inlineFkTouched.value[fieldName])
  );

  const formatInlineFkOption = (field, row) => {
    const tableName = resolveFkTable(field?.name);
    if (!tableName) {
      return row?.id ?? "—";
    }
    return formatFkOptionLabel(tableName, row);
  };

  const clearInlineFkSelection = (fieldName) => {
    if (!fieldName) {
      return;
    }
    cancelInlineFkClose(fieldName);
    formData.value = {
      ...formData.value,
      [fieldName]: ""
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      [fieldName]: ""
    };
    inlineFkSuggestions.value = {
      ...inlineFkSuggestions.value,
      [fieldName]: []
    };
    inlineFkTouched.value = {
      ...inlineFkTouched.value,
      [fieldName]: false
    };
    inlineFkActiveField.value = fieldName;
  };

  const applyInlineFkSelection = (field, row) => {
    if (!field?.name || !row) {
      return;
    }
    cancelInlineFkClose(field.name);
    const tableName = resolveFkTable(field.name);
    const labelValue = formatFkOptionLabel(tableName, row);
    formData.value = {
      ...formData.value,
      [field.name]: row.id ?? ""
    };
    fkDisplay.value = {
      ...fkDisplay.value,
      [field.name]: labelValue
    };
    inlineFkSuggestions.value = {
      ...inlineFkSuggestions.value,
      [field.name]: []
    };
    inlineFkTouched.value = {
      ...inlineFkTouched.value,
      [field.name]: false
    };
    inlineFkActiveField.value = "";
  };

  const fetchInlineFkSuggestions = async (field) => {
    if (!field?.name) {
      return;
    }
    const tableName = resolveFkTable(field.name);
    if (!tableName) {
      return;
    }
    const query = String(fkDisplay.value[field.name] ?? "").trim();
    if (!query) {
      inlineFkSuggestions.value = {
        ...inlineFkSuggestions.value,
        [field.name]: []
      };
      inlineFkTouched.value = {
        ...inlineFkTouched.value,
        [field.name]: false
      };
      return;
    }

    inlineFkLoading.value = {
      ...inlineFkLoading.value,
      [field.name]: true
    };
    inlineFkTouched.value = {
      ...inlineFkTouched.value,
      [field.name]: true
    };

    try {
      const response = await axios.get(API_ROUTES.ADMIN_SQL_TABLE(tableName), {
        params: {
          q: query,
          limit: 8
        }
      });
      inlineFkSuggestions.value = {
        ...inlineFkSuggestions.value,
        [field.name]: response.data || []
      };
    } catch {
      inlineFkSuggestions.value = {
        ...inlineFkSuggestions.value,
        [field.name]: []
      };
    } finally {
      inlineFkLoading.value = {
        ...inlineFkLoading.value,
        [field.name]: false
      };
    }
  };

  const openInlineFkSuggestions = (field) => {
    if (!field?.name || isFieldLocked(field)) {
      return;
    }
    cancelInlineFkClose(field.name);
    inlineFkActiveField.value = field.name;
    if (fkDisplay.value[field.name]) {
      fetchInlineFkSuggestions(field);
    }
  };

  const handleInlineFkInput = async (field) => {
    if (!field?.name || isFieldLocked(field)) {
      return;
    }
    formData.value = {
      ...formData.value,
      [field.name]: ""
    };
    inlineFkActiveField.value = field.name;
    if (inlineFkQueryTimers[field.name]) {
      clearTimeout(inlineFkQueryTimers[field.name]);
    }
    inlineFkQueryTimers[field.name] = setTimeout(() => {
      fetchInlineFkSuggestions(field);
      delete inlineFkQueryTimers[field.name];
    }, 220);
  };

  const updateInlineFkDisplay = (fieldName, value) => {
    if (!fieldName) {
      return;
    }
    fkDisplay.value = {
      ...fkDisplay.value,
      [fieldName]: value
    };
    const field = visibleFormFields.value.find((entry) => entry.name === fieldName);
    if (field) {
      handleInlineFkInput(field);
    }
  };

  const selectInlineFkSuggestion = (field, row) => {
    applyInlineFkSelection(field, row);
  };

  return {
    resetInlineFkState,
    cancelInlineFkClose,
    scheduleInlineFkClose,
    shouldShowInlineFkSuggestions,
    formatInlineFkOption,
    clearInlineFkSelection,
    applyInlineFkSelection,
    fetchInlineFkSuggestions,
    openInlineFkSuggestions,
    handleInlineFkInput,
    updateInlineFkDisplay,
    selectInlineFkSuggestion
  };
}
