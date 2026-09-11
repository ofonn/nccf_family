CREATE TABLE IF NOT EXISTS participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS participants_name_unique_ci
    ON participants (lower(trim(name)));

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

INSERT INTO participants (name) VALUES
    ('Chidera'),
    ('Christopher'),
    ('Judith'),
    ('Mimi'),
    ('Ofonime'),
    ('Ola'),
    ('Olayinka'),
    ('Oluchi'),
    ('Opeyemi'),
    ('Prince'),
    ('Segun'),
    ('Wale')
ON CONFLICT DO NOTHING;
