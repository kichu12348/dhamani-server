import type { D1Database } from "@cloudflare/workers-types";
import { DonorSchema } from "./schema.js";
import data from "../../output.json";

interface DonorSearchParams {
  bloodGroup?: string;
  district?: string;
  taluk?: string;
  name?: string;
  isEligible?: boolean;
  offset?: number;
  limit?: number;
}

export interface District {
  id?: number;
  name: string;
  created_at?: string;
}

export interface Taluk {
  id?: number;
  name: string;
  district_id: number;
  created_at?: string;
}

interface DataType {
  timestamp: string;
  email_address: {
    email: string;
  };
  name: string;
  batch: string;
  date_of_birth: string;
  weight: number;
  blood_group: string;
  district: string;
  taluk: string;
  village_municipality_corporation: string;
  contact_number: number | string;
}

export interface Donor {
  id?: number;
  name: string;
  email?: string;
  contact_number: string;
  blood_group: string;
  weight?: number;
  date_of_birth?: string;
  batch?: string;
  district: string;
  taluk: string;
  village_municipality_corporation?: string;
  last_donated?: string;
  created_at?: string;
}

export async function initDb(db: D1Database) {
  await db.exec("DROP TABLE IF EXISTS donors");
  await db.exec("DROP TABLE IF EXISTS taluks");
  await db.exec("DROP TABLE IF EXISTS districts");
  await db.prepare(DonorSchema).run();

  // Sets to track unique values
  const districtSet = new Set<string>();
  const talukMap = new Map<string, Set<string>>(); // district -> set of taluks

  // First pass: collect unique districts and taluks
  for (const item of data) {
    const { district, taluk } = item as DataType;

    if (district?.trim()) {
      districtSet.add(district.trim());

      if (taluk?.trim()) {
        if (!talukMap.has(district.trim())) {
          talukMap.set(district.trim(), new Set());
        }
        talukMap.get(district.trim())?.add(taluk.trim());
      }
    }
  }

  // Insert unique districts
  const districtIdMap = new Map<string, number>();
  for (const districtName of districtSet) {
    const result = await db
      .prepare(`INSERT INTO districts (name) VALUES (?)`)
      .bind(districtName)
      .run();
    districtIdMap.set(districtName, result.meta.last_row_id as number);
  }

  // Insert unique taluks with their district relationships
  const talukIdMap = new Map<string, number>();
  for (const [districtName, talukSet] of talukMap) {
    const districtId = districtIdMap.get(districtName);
    if (districtId) {
      for (const talukName of talukSet) {
        const result = await db
          .prepare(`INSERT INTO taluks (name, district_id) VALUES (?, ?)`)
          .bind(talukName, districtId)
          .run();
        talukIdMap.set(
          `${districtName}-${talukName}`,
          result.meta.last_row_id as number
        );
      }
    }
  }

  // Insert donors
  for (const item of data) {
    const {
      email_address,
      name,
      batch,
      date_of_birth,
      weight,
      blood_group,
      district,
      taluk,
      village_municipality_corporation,
      contact_number,
    } = item as DataType;

    await db
      .prepare(
        `INSERT INTO donors (email, name, batch, date_of_birth, weight, blood_group, district, taluk, village_municipality_corporation, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        email_address?.email || "",
        name || "",
        batch || "",
        date_of_birth || "",
        weight || 0,
        blood_group || "",
        district?.trim() || "",
        taluk?.trim() || "",
        village_municipality_corporation || "",
        contact_number?.toString() || ""
      )
      .run();
  }

  console.log("Database initialized with districts, taluks, and donors.");
  return new Response(
    "Database initialized successfully with districts, taluks, and donors."
  );
}

export async function getDonors(
  db: D1Database,
  searchParams: DonorSearchParams
): Promise<{ donors: Donor[]; hasMore: boolean; total: number }> {
  const {
    bloodGroup,
    district,
    taluk,
    name,
    isEligible,
    offset = 0,
    limit = 20,
  } = searchParams;

  let query = `SELECT * FROM donors WHERE 1=1`;
  const params: any[] = [];

  if (bloodGroup && bloodGroup !== "all") {
    query += ` AND blood_group = ?`;
    params.push(bloodGroup);
  }

  if (district) {
    query += ` AND district = ?`;
    params.push(district);
  }

  if (taluk) {
    query += ` AND taluk = ?`;
    params.push(taluk);
  }

  if (name) {
    query += ` AND name LIKE ?`;
    params.push(`%${name}%`);
  }

  if (isEligible !== undefined) {
    if (isEligible) {
      query += ` AND (last_donation_date IS NULL OR date(last_donation_date, '+90 days') <= date('now'))`;
    } else {
      query += ` AND last_donation_date IS NOT NULL AND date(last_donation_date, '+90 days') > date('now')`;
    }
  }

  // Count total matching records
  const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as count");
  const countResult = await db
    .prepare(countQuery)
    .bind(...params)
    .first();
  const total = (countResult as any)?.count || 0;

  // Add ordering and pagination
  query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  const donors = result.results as unknown as Donor[];
  const hasMore = offset + limit < total;

  return { donors, hasMore, total };
}

export async function getAllDistricts(db: D1Database): Promise<District[]> {
  const result = await db
    .prepare(`SELECT * FROM districts ORDER BY name ASC`)
    .all();
  return result.results as unknown as District[];
}

export async function getTaluksByDistrict(
  db: D1Database,
  districtId: number
): Promise<Taluk[]> {
  const result = await db
    .prepare(`SELECT * FROM taluks WHERE district_id = ? ORDER BY name ASC`)
    .bind(districtId)
    .all();
  return result.results as unknown as Taluk[];
}

export async function addDonor(db: D1Database, donor: Donor) {
  const result = await db
    .prepare(
      `INSERT INTO donors (name, email, contact_number, blood_group, weight, date_of_birth, batch, district, taluk, village_municipality_corporation) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      donor.name,
      donor.email || null,
      donor.contact_number,
      donor.blood_group,
      donor.weight || null,
      donor.date_of_birth || null,
      donor.batch || null,
      donor.district,
      donor.taluk,
      donor.village_municipality_corporation || null
    )
    .run();

  const checkIfDistrictExists = await db
    .prepare(`SELECT id FROM districts WHERE LOWER(name) = LOWER(?)`)
    .bind(donor.district.trim())
    .first();
  if (!checkIfDistrictExists) {
    await db
      .prepare(`INSERT INTO districts (name) VALUES (?)`)
      .bind(donor.district.trim())
      .run();
  }

  const checkIfTalukExists = await db
    .prepare(
      `SELECT id FROM taluks WHERE LOWER(name) = LOWER(?) AND district_id = (SELECT id FROM districts WHERE LOWER(name) = LOWER(?))`
    )
    .bind(donor.taluk.trim(), donor.district.trim())
    .first();
  if (!checkIfTalukExists) {
    const districtId = await db
      .prepare(`SELECT id FROM districts WHERE LOWER(name) = LOWER(?)`)
      .bind(donor.district.trim())
      .first();
    if (districtId) {
      await db
        .prepare(`INSERT INTO taluks (name, district_id) VALUES (?, ?)`)
        .bind(donor.taluk.trim(), districtId.id)
        .run();
    }
  }

  return result;
}

export async function searchDonorsByBloodGroup(
  db: D1Database,
  bloodGroup: string
) {
  const result = await db
    .prepare(`SELECT * FROM donors WHERE blood_group = ? ORDER BY name`)
    .bind(bloodGroup)
    .all();

  return result;
}

export async function searchDonorsByLocation(
  db: D1Database,
  district: string,
  taluk?: string
) {
  let query = `SELECT * FROM donors WHERE district = ?`;
  const bindings = [district];

  if (taluk) {
    query += ` AND taluk = ?`;
    bindings.push(taluk);
  }

  query += ` ORDER BY name`;

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all();

  return result;
}

// Get eligible donors (not donated in last 3 months)
export async function getEligibleDonors(db: D1Database) {
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const cutoffDate = threeMonthsAgo.toISOString().split("T")[0];

  const result = await db
    .prepare(
      `SELECT * FROM donors 
       WHERE last_donated IS NULL 
       OR last_donated < ? 
       ORDER BY name`
    )
    .bind(cutoffDate)
    .all();

  return result;
}

export async function updateLastDonated(
  db: D1Database,
  donorId: string,
  donationDate: string
) {
  const result = await db
    .prepare(`UPDATE donors SET last_donated = ? WHERE id = ?`)
    .bind(donationDate, donorId)
    .run();

  return result;
}

export async function updateDonor(
  db: D1Database,
  donorId: string,
  donor: Partial<Donor>
) {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(donor).forEach(([key, value]) => {
    if (key !== "id" && value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(donorId);

  const result = await db
    .prepare(`UPDATE donors SET ${fields.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return result;
}
