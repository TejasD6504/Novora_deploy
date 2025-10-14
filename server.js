// Load .env if available (optional)
try {
  /* eslint-disable global-require */
  require('dotenv').config();
  /* eslint-enable global-require */
} catch (e) {
  // dotenv not installed — ignore; environment variables may be provided by system
}

const express = require("express");
const bodyParser = require("body-parser");
const db = require("./db"); // unified db layer: db.query(...) -> rows array
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'novora_secret',
  resave: false,
  saveUninitialized: false
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Home: serve the static start.html from public/html as the landing page
app.get("/", (req, res) => {
  const startFile = path.join(__dirname, "public", "html", "start.html");
  res.sendFile(startFile, (err) => {
    if (err) {
      // fallback to rendering view if sendFile fails
      console.warn("sendFile(start.html) failed, rendering view instead:", err && err.message);
      return res.render("start");
    }
  });
});

// Signup
app.post("/signup", async (req, res) => {
  const { fullName, email, phoneNumber, userId, password } = req.body;
  if (!fullName || !email || !userId || !password) return res.status(400).send("Missing required fields");
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO signup (full_name, email, phone_number, user_id, password) VALUES ($1, $2, $3, $4, $5)",
      [fullName, email, phoneNumber || null, userId, hashedPassword]
    );
    console.log(`✅ Signup successful for ${userId}`);
    return res.redirect("/start.html");
  } catch (err) {
    console.error("❌ Database insert error (signup):", err);
    return res.status(500).send("Error inserting signup data");
  }
});

// ---------------- Login ----------------
app.post("/login", async (req, res) => {
  const { userId, password, admin } = req.body; // admin will be sent by the admin.html form

  if (!userId || !password) return res.status(400).send("Missing credentials");
  try {
    const rows = await db.query(
      "SELECT id, full_name, email, user_id, password FROM signup WHERE user_id = $1 LIMIT 1",
      [userId]
    );
    const user = rows && rows[0];
    if (!user) return res.status(401).send("Invalid credentials");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Invalid credentials");

    // store minimal user info in session
    req.session.user = { id: user.id, userId: user.user_id, name: user.full_name };

    // admin detection:
    // - explicit admin flag from the admin form (admin === '1' or 'true') OR
    // - fallback compare with ADMIN_USER env var
    const explicitAdmin = (admin === '1' || String(admin).toLowerCase() === 'true');
    const adminUserId = (process.env.ADMIN_USER || 'admin').toString().toLowerCase();
    const isAdmin = explicitAdmin || (String(user.user_id).toLowerCase() === adminUserId);

    console.log(`✅ Login success for '${user.user_id}' role='${isAdmin ? 'admin' : 'user'}'`);

    // redirect: admin -> index.html, regular user -> index1.html
    return res.redirect(isAdmin ? '/index.html' : '/index1.html');

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).send("Server error during login");
  }
});

// Current session
app.get("/me", (req, res) => {
  res.json({ user: req.session?.user || null });
});

// Users fetch
app.get("/users", async (req, res) => {
  try {
    const rows = await db.query("SELECT * FROM users");
    return res.render("user", { users: rows });
  } catch (err) {
    console.error("❌ Database fetch error:", err);
    return res.status(500).send("Error fetching data");
  }
});

// requireLogin middleware
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/start.html");
}

// Dashboard
app.get("/dashboard", requireLogin, async (req, res) => {
  let summary = { totalProducts: 0, totalRacks: 0, activeRovers: 0, pendingTasks: 0 };
  let slots = [{ rack_id: "R1", status: "Occupied" }, { rack_id: "R2", status: "Empty" }];
  let tasks = [
    { id: "T001", type: "Pickup", source: "Node A", destination: "Node C", status: "Ongoing" },
    { id: "T002", type: "Drop", source: "Node D", destination: "Node H", status: "Completed" },
    { id: "T003", type: "Drop", source: "Node G", destination: "Node B", status: "Ongoing" }
  ];

  try {
    try {
      const rows = await db.query("SELECT COUNT(*) AS cnt FROM product");
      summary.totalProducts = parseInt(rows?.[0]?.cnt || 0, 10);
    } catch (e) { /* keep default */ }

    try {
      const rows = await db.query("SELECT COUNT(*) AS cnt FROM rack");
      summary.totalRacks = parseInt(rows?.[0]?.cnt || 0, 10);
    } catch (e) { /* keep default */ }

    try {
      const rows = await db.query("SELECT COUNT(*) AS cnt FROM robot WHERE status = 'active'");
      summary.activeRovers = parseInt(rows?.[0]?.cnt || 0, 10);
    } catch (e) { /* keep default */ }

    try {
      const rows = await db.query("SELECT COUNT(*) AS cnt FROM task WHERE status='pending'");
      summary.pendingTasks = parseInt(rows?.[0]?.cnt || 0, 10);
    } catch (e) { /* keep default */ }

    try {
      const srows = await db.query("SELECT address, isempty, rackid, productid FROM storagelocation ORDER BY address LIMIT 100");
      if (srows && srows.length) slots = srows.map(s => ({ rack_id: s.rackid || s.address, status: s.isempty ? "Empty" : "Occupied" }));
    } catch (e) { /* keep default */ }

    try {
      const trows = await db.query('SELECT task_id, "Type" as type, source_address, destination_address, status FROM task ORDER BY task_id DESC LIMIT 10');
      if (trows && trows.length) tasks = trows.map(tk => ({ id: tk.task_id, type: tk.type || "N/A", source: tk.source_address || "", destination: tk.destination_address || "", status: tk.status || "Unknown" }));
    } catch (e) { /* keep default */ }

  } catch (err) {
    console.warn("Some dashboard queries failed (tables may not exist yet):", err.message);
  }

  try {
    console.log("Dashboard values ->", JSON.stringify({ summary, slotsCount: slots.length, tasksCount: tasks.length }));
  } catch (e) {
    console.log("Dashboard log error", e.message);
  }

  return res.render("dashboard", { summary, slots, tasks });
});

// Static file handler for public/html/*.html
app.get("/:name.html", (req, res, next) => {
  const name = req.params.name;
  const filePath = path.join(__dirname, "public", "html", `${name}.html`);
  res.sendFile(filePath, (err) => { if (err) return next(); });
});

// Admin page — serve the static admin.html (preserves your admin.html exactly)
app.get("/admin", (req, res, next) => {
  const filePath = path.join(__dirname, "public", "html", "admin.html");
  res.sendFile(filePath, (err) => {
    if (err) return next();
  });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
