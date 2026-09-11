import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (model, required = false) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["ADMIN", "STAFF"], default: "STAFF" },
    assignedArea: { ...ref("Area"), default: null },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true },
);
userSchema.set("toJSON", {
  transform: (_, ret) => {
    delete ret.password;
    return ret;
  },
});
export const User = mongoose.model("User", userSchema);
export const Area = mongoose.model(
  "Area",
  new Schema(
    {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: 30,
      },
      location: { type: String, required: true, trim: true, maxlength: 200 },
      responsibleStaff: { ...ref("User"), default: null },
      dailyLimit: { type: Number, required: true, min: 0.01 },
      monthlyLimit: { type: Number, required: true, min: 0.01 },
      unit: { type: String, enum: ["Litres"], default: "Litres" },
      status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    },
    { timestamps: true },
  ),
);
const consumptionSchema = new Schema(
  {
    area: ref("Area", true),
    date: {
      type: String,
      required: true,
      validate: {
        validator: (value) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const parsed = new Date(`${value}T00:00:00.000Z`);
          return (
            !Number.isNaN(parsed.valueOf()) &&
            parsed.toISOString().slice(0, 10) === value
          );
        },
        message: "Date must be a valid YYYY-MM-DD calendar date.",
      },
    },
    amount: { type: Number, required: true, min: 0.01 },
    unit: { type: String, enum: ["Litres"], default: "Litres" },
    recordedBy: ref("User", true),
    notes: { type: String, maxlength: 1000, default: "" },
  },
  { timestamps: true },
);
consumptionSchema.index({ area: 1, date: 1 });
export const Consumption = mongoose.model("Consumption", consumptionSchema);
const alertSchema = new Schema(
  {
    area: ref("Area", true),
    type: { type: String, enum: ["DAILY", "MONTHLY"], required: true },
    period: { type: String, required: true },
    message: String,
    consumption: Number,
    limit: Number,
    status: {
      type: String,
      enum: ["UNREAD", "READ", "RESOLVED"],
      default: "UNREAD",
    },
    resolvedAt: Date,
    resolvedBy: ref("User"),
    autoResolved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
alertSchema.index({ area: 1, type: 1, period: 1 }, { unique: true });
export const Alert = mongoose.model("Alert", alertSchema);
export const AuditLog = mongoose.model(
  "AuditLog",
  new Schema(
    {
      user: ref("User"),
      action: String,
      entity: String,
      entityId: Schema.Types.ObjectId,
    },
    { timestamps: { createdAt: "timestamp", updatedAt: false } },
  ),
);
