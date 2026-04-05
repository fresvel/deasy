import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    path: {
      type: String,
      required: true,
      trim: true
    },
    filename: {
      type: String,
      required: true,
      trim: true
    },
    mime: {
      type: String,
      default: null,
      trim: true
    },
    size: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true
    },
    sender_person_id: {
      type: Number,
      required: true,
      index: true
    },
    content: {
      type: String,
      trim: true,
      default: ""
    },
    content_type: {
      type: String,
      enum: ["text", "system", "attachment"],
      default: "text"
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    reply_to_message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null
    },
    edited_at: {
      type: Date,
      default: null
    },
    deleted_at: {
      type: Date,
      default: null
    },
    read_by: {
      type: [Number],
      default: []
    },
    delivery_state: {
      type: String,
      trim: true,
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

messageSchema.index({ conversation_id: 1, created_at: -1 });
messageSchema.index({ sender_person_id: 1, created_at: -1 });

export const ChatMessage =
  mongoose.models.ChatMessage || mongoose.model("ChatMessage", messageSchema);
