import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient_person_id: {
      type: Number,
      required: true,
      index: true
    },
    type: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    entity_type: {
      type: String,
      trim: true,
      default: null
    },
    entity_id: {
      type: String,
      trim: true,
      default: null
    },
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      default: null
    },
    message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null
    },
    channel: {
      type: String,
      trim: true,
      default: "in_app"
    },
    read_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false
    }
  }
);

notificationSchema.index({ recipient_person_id: 1, created_at: -1 });
notificationSchema.index({ recipient_person_id: 1, read_at: 1 });

export const ChatNotification =
  mongoose.models.ChatNotification || mongoose.model("ChatNotification", notificationSchema);
