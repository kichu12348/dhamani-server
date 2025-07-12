export const DonorSchema = `
CREATE TABLE IF NOT EXISTS donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  contact_number TEXT,
  blood_group TEXT NOT NULL,
  weight INTEGER,
  date_of_birth TEXT,
  batch TEXT,
  district TEXT,
  taluk TEXT,
  village_municipality_corporation TEXT,
  last_donated TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS districts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS taluks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  district_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (district_id) REFERENCES districts(id),
  UNIQUE(name, district_id)
);

CREATE INDEX IF NOT EXISTS idx_donors_blood_group ON donors(blood_group);
CREATE INDEX IF NOT EXISTS idx_donors_district ON donors(district);
CREATE INDEX IF NOT EXISTS idx_donors_taluk ON donors(taluk);
CREATE INDEX IF NOT EXISTS idx_donors_name ON donors(name);
CREATE INDEX IF NOT EXISTS idx_donors_last_donated ON donors(last_donated);
`;