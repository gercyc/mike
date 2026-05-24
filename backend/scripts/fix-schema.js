const postgres = require('postgres');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL must be set');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

const statements = [
  `DO $$ BEGIN ALTER TABLE user_api_keys ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'user_api_keys.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE user_api_keys ADD COLUMN updated_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'user_api_keys.updated_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE document_versions ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'document_versions.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE document_edits ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'document_edits.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE document_edits ADD COLUMN resolved_at timestamp with time zone; EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'document_edits.resolved_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE workflows ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'workflows.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE hidden_workflows ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'hidden_workflows.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE workflow_shares ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'workflow_shares.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE chats ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'chats.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE chat_messages ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'chat_messages.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE tabular_cells ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'tabular_cells.created_at already exists'; END $$;`,
  `DO $$ BEGIN ALTER TABLE tabular_review_chat_messages ADD COLUMN created_at timestamp with time zone NOT NULL DEFAULT now(); EXCEPTION WHEN duplicate_column THEN RAISE NOTICE 'tabular_review_chat_messages.created_at already exists'; END $$;`,
];

async function main() {
  console.log('Fixing schema...');
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      console.log('OK:', stmt.split(' ')[5]);
    } catch (err) {
      console.error('FAILED:', stmt.split(' ')[5], '-', err.message);
    }
  }
  await sql.end();
  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
