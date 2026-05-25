import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Users (auth própria)
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_users_email").on(t.email),
  index("idx_users_verification_token").on(t.emailVerificationToken),
]);

// ---------------------------------------------------------------------------
// User profiles
// ---------------------------------------------------------------------------

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  organisation: text("organisation"),
  tier: text("tier").notNull().default("Free"),
  messageCreditsUsed: integer("message_credits_used").notNull().default(0),
  creditsResetDate: timestamp("credits_reset_date", { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '30 days'`),
  tabularModel: text("tabular_model").notNull().default("gemini-3-flash-preview"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_user_profiles_user").on(t.userId),
]);

// ---------------------------------------------------------------------------
// User API keys
// ---------------------------------------------------------------------------

export const userApiKeys = pgTable("user_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(),
  authTag: text("auth_tag").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("user_api_keys_user_provider_unique").on(t.userId, t.provider),
  index("idx_user_api_keys_user").on(t.userId),
  check("user_api_keys_provider_check", sql`${t.provider} IN ('claude', 'gemini', 'openai', 'openrouter')`),
]);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  cmNumber: text("cm_number"),
  visibility: text("visibility").notNull().default("private"),
  sharedWith: jsonb("shared_with").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_projects_user").on(t.userId),
  index("projects_shared_with_idx").using("gin", t.sharedWith),
]);

// ---------------------------------------------------------------------------
// Project subfolders
// ---------------------------------------------------------------------------

export const projectSubfolders = pgTable("project_subfolders", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  parentFolderId: uuid("parent_folder_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_project_subfolders_project").on(t.projectId),
]);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  filename: text("filename").notNull(),
  fileType: text("file_type"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  pageCount: integer("page_count"),
  structureTree: jsonb("structure_tree"),
  status: text("status").notNull().default("pending"),
  folderId: uuid("folder_id"),
  currentVersionId: uuid("current_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_documents_user_project").on(t.userId, t.projectId),
  index("idx_documents_project_folder").on(t.projectId, t.folderId),
]);

// ---------------------------------------------------------------------------
// Document versions
// ---------------------------------------------------------------------------

export const documentVersions = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  pdfStoragePath: text("pdf_storage_path"),
  source: text("source").notNull().default("upload"),
  versionNumber: integer("version_number"),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("document_versions_document_id_idx").on(t.documentId, t.createdAt),
  index("document_versions_doc_vnum_idx").on(t.documentId, t.versionNumber),
  check("document_versions_source_check", sql`${t.source} IN ('upload','user_upload','assistant_edit','user_accept','user_reject','generated')`),
]);

// ---------------------------------------------------------------------------
// Document edits
// ---------------------------------------------------------------------------

export const documentEdits = pgTable("document_edits", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  chatMessageId: uuid("chat_message_id"),
  versionId: uuid("version_id").notNull().references(() => documentVersions.id, { onDelete: "cascade" }),
  changeId: text("change_id").notNull(),
  delWId: text("del_w_id"),
  insWId: text("ins_w_id"),
  deletedText: text("deleted_text").notNull().default(""),
  insertedText: text("inserted_text").notNull().default(""),
  contextBefore: text("context_before"),
  contextAfter: text("context_after"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (t) => [
  index("document_edits_document_id_idx").on(t.documentId, t.createdAt),
  index("document_edits_message_id_idx").on(t.chatMessageId),
  index("document_edits_version_id_idx").on(t.versionId),
  check("document_edits_status_check", sql`${t.status} IN ('pending','accepted','rejected')`),
]);

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"),
  title: text("title").notNull(),
  type: text("type").notNull(),
  promptMd: text("prompt_md"),
  columnsConfig: jsonb("columns_config"),
  practice: text("practice"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_workflows_user").on(t.userId),
]);

export const hiddenWorkflows = pgTable("hidden_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  workflowId: text("workflow_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("hidden_workflows_user_workflow_unique").on(t.userId, t.workflowId),
  index("idx_hidden_workflows_user").on(t.userId),
]);

export const workflowShares = pgTable("workflow_shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  sharedByUserId: text("shared_by_user_id").notNull(),
  sharedWithEmail: text("shared_with_email").notNull(),
  allowEdit: boolean("allow_edit").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("workflow_shares_workflow_email_unique").on(t.workflowId, t.sharedWithEmail),
  index("workflow_shares_workflow_id_idx").on(t.workflowId),
  index("workflow_shares_email_idx").on(t.sharedWithEmail),
]);

export const workflowAssets = pgTable("workflow_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "html" | "image"
  content: text("content"),      // for html assets: inline content
  storagePath: text("storage_path"), // for image assets: S3 key
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_workflow_assets_workflow").on(t.workflowId),
]);

// ---------------------------------------------------------------------------
// Chats
// ---------------------------------------------------------------------------

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_chats_user").on(t.userId),
  index("idx_chats_project").on(t.projectId),
]);

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: jsonb("content"),
  files: jsonb("files"),
  annotations: jsonb("annotations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_chat_messages_chat").on(t.chatId),
]);

// ---------------------------------------------------------------------------
// Tabular reviews
// ---------------------------------------------------------------------------

export const tabularReviews = pgTable("tabular_reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title"),
  columnsConfig: jsonb("columns_config"),
  documentIds: jsonb("document_ids"),
  workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  practice: text("practice"),
  sharedWith: jsonb("shared_with").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_tabular_reviews_user").on(t.userId),
  index("idx_tabular_reviews_project").on(t.projectId),
  index("tabular_reviews_shared_with_idx").using("gin", t.sharedWith),
]);

export const tabularCells = pgTable("tabular_cells", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").notNull().references(() => tabularReviews.id, { onDelete: "cascade" }),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  columnIndex: integer("column_index").notNull(),
  content: text("content"),
  citations: jsonb("citations"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_tabular_cells_review").on(t.reviewId, t.documentId, t.columnIndex),
]);

export const tabularReviewChats = pgTable("tabular_review_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  reviewId: uuid("review_id").notNull().references(() => tabularReviews.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tabular_review_chats_review_idx").on(t.reviewId, t.updatedAt),
  index("tabular_review_chats_user_idx").on(t.userId),
]);

export const tabularReviewChatMessages = pgTable("tabular_review_chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id").notNull().references(() => tabularReviewChats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: jsonb("content"),
  annotations: jsonb("annotations"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("tabular_review_chat_messages_chat_idx").on(t.chatId, t.createdAt),
]);
