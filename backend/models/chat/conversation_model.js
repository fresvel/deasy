import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    person_id: {
      type: Number,
      required: true
    },
    role: {
      type: String,
      default: "member",
      trim: true
    },
    joined_at: {
      type: Date,
      default: Date.now
    },
    left_at: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group", "thread", "process_thread"],
      required: true
    },
    title: {
      type: String,
      trim: true,
      default: null
    },
    participants: {
      type: [participantSchema],
      default: []
    },
    process_id: {
      type: Number,
      default: null,
      index: true
    },
    scope: {
      process_id: {
        type: Number,
        default: null
      },
      scope_unit_id: {
        type: Number,
        default: null
      },
      stable_key: {
        type: String,
        trim: true,
        default: null
      },
      current_definition_id: {
        type: Number,
        default: null
      },
      origin_definition_id: {
        type: Number,
        default: null
      }
    },
    created_by: {
      type: Number,
      required: true
    },
    last_message_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null
    },
    last_message_at: {
      type: Date,
      default: null
    },
    archived_at: {
      type: Date,
      default: null
    },
    mobile_summary: {
      type: String,
      trim: true,
      default: null
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

conversationSchema.index({ "participants.person_id": 1, updated_at: -1 });
conversationSchema.index({ type: 1, process_id: 1 }, { sparse: true });
conversationSchema.index({ "scope.stable_key": 1 }, { unique: true, sparse: true });

export const ChatConversation =
  mongoose.models.ChatConversation || mongoose.model("ChatConversation", conversationSchema);
