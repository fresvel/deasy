import { onBeforeUnmount } from "vue";

export function useAdminFeedbackToast({ feedbackToast }) {
  let feedbackToastTimeout = null;

  const hideFeedbackToast = () => {
    if (feedbackToastTimeout) {
      clearTimeout(feedbackToastTimeout);
      feedbackToastTimeout = null;
    }
    feedbackToast.value = {
      visible: false,
      kind: "success",
      title: "",
      message: ""
    };
  };

  const showFeedbackToast = ({ kind = "success", title, message, duration = 5200 }) => {
    if (feedbackToastTimeout) {
      clearTimeout(feedbackToastTimeout);
      feedbackToastTimeout = null;
    }
    feedbackToast.value = {
      visible: true,
      kind,
      title,
      message
    };
    feedbackToastTimeout = setTimeout(() => {
      hideFeedbackToast();
    }, duration);
  };

  onBeforeUnmount(() => {
    if (feedbackToastTimeout) {
      clearTimeout(feedbackToastTimeout);
    }
  });

  return {
    hideFeedbackToast,
    showFeedbackToast
  };
}
