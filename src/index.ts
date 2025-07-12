import { Hono } from "hono";
import { cors } from "hono/cors";
import type { D1Database } from "@cloudflare/workers-types";
import {
  //initDb,
  getDonors,
  addDonor,
  getAllDistricts,
  getTaluksByDistrict,
  updateLastDonated,
  updateDonor,
  type Donor,
} from "./db/db";

interface Env {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for mobile app
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

app.get("/", (c) => {
  return c.text("im betmen hehehehehehehehehehhheheheeehehehehehe");
});

// Database initialization
// app.get("/api/init-db", async (c) => {
//   const db = c.env.DB;
//   try {
//     const response = await initDb(db);
//     return c.json({ message: response.statusText });
//   } catch (error) {
//     console.error("Error initializing database:", error);
//     return c.json({ error: "Failed to initialize database" }, 500);
//   }
// });

// Get all donors with optional filtering via query parameters
app.get("/donors", async (c) => {
  const db = c.env.DB;
  try {
    // Get query parameters
    const bloodGroup = c.req.query("bloodGroup");
    const district = c.req.query("district");
    const taluk = c.req.query("taluk");
    const name = c.req.query("name");
    const isEligible =
      c.req.query("isEligible") === "true"
        ? true
        : c.req.query("isEligible") === "false"
        ? false
        : undefined;
    const offset = parseInt(c.req.query("offset") || "0");
    const limit = parseInt(c.req.query("limit") || "20");

    const searchParams = {
      bloodGroup,
      district,
      taluk,
      name,
      isEligible,
      offset,
      limit,
    };

    const result = await getDonors(db, searchParams);

    return c.json({
      data: result.donors,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching donors:", error);
    return c.json({ error: "Failed to fetch donors" }, 500);
  }
});

// Add new donor
app.post("/donors", async (c) => {
  const db = c.env.DB;
  try {
    const donor: Donor = await c.req.json();
    const result = await addDonor(db, donor);
    return c.json({
      message: "Donor added successfully",
      id: result.meta.last_row_id,
    });
  } catch (error) {
    console.error("Error adding donor:", error);
    return c.json({ error: "Failed to add donor" }, 500);
  }
});

// Update donor
app.put("/donors/:id", async (c) => {
  const db = c.env.DB;
  const donorId = c.req.param("id");
  try {
    const donor: Partial<Donor> = await c.req.json();
    await updateDonor(db, donorId, donor);
    return c.json({ message: "Donor updated successfully" });
  } catch (error) {
    console.error("Error updating donor:", error);
    return c.json({ error: "Failed to update donor" }, 500);
  }
});

// Update last donated date
app.put("/donors/:id/last-donated", async (c) => {
  const db = c.env.DB;
  const donorId = c.req.param("id");
  try {
    const { donationDate } = await c.req.json();
    await updateLastDonated(db, donorId, donationDate);
    return c.json({ message: "Last donated date updated successfully" });
  } catch (error) {
    console.error("Error updating last donated date:", error);
    return c.json({ error: "Failed to update last donated date" }, 500);
  }
});

// Get all districts
app.get("/districts", async (c) => {
  const db = c.env.DB;
  try {
    const districts = await getAllDistricts(db);
    return c.json({ data: districts });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return c.json({ error: "Failed to fetch districts" }, 500);
  }
});

// Get taluks by district
app.get("/districts/:districtId/taluks", async (c) => {
  const db = c.env.DB;
  const districtId = parseInt(c.req.param("districtId"));
  try {
    const taluks = await getTaluksByDistrict(db, districtId);
    return c.json({ data: taluks });
  } catch (error) {
    console.error("Error fetching taluks:", error);
    return c.json({ error: "Failed to fetch taluks" }, 500);
  }
});

export default app;
