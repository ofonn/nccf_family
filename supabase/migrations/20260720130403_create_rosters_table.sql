CREATE TABLE IF NOT EXISTS rosters_data (
    id integer PRIMARY KEY DEFAULT 1,
    data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);

-- Insert an initial row that we will always update
INSERT INTO rosters_data (id, data) VALUES (1, '{}') ON CONFLICT DO NOTHING;
