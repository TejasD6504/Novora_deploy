const express = require("express");
const bodyParser = require("body-parser");
let SerialPort;
let ReadlineParser;
try {
  ({ SerialPort, ReadlineParser } = require("serialport"));
} catch (err) {
  console.warn("⚠️ serialport not available; Arduino features disabled.");
}
const db = require("./db"); 
const session = require("express-session");
const path = require("path");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(session({
  secret: process.env.SESSION_SECRET || 'novora_secret',
  resave: false,
  saveUninitialized: false
}));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------
// ARDUINO SETUP
// ---------------------------------------------------------------
let arduinoPort = null;
let parser = null;

if (SerialPort && ReadlineParser) {
  try {
    arduinoPort = new SerialPort({ path: "COM3", baudRate: 9600 });
    parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

    arduinoPort.on("open", () => console.log("✅ Arduino connected on COM3"));
    parser.on("data", (line) => console.log("Arduino says:", line));
    arduinoPort.on("error", (err) =>
      console.warn("⚠️ Arduino error:", err.message)
    );
  } catch (err) {
    console.warn("⚠️ Arduino not connected.");
  }
}

// ---------------------------------------------------------------
// ROUTES (ALL CALLBACK-BASED)
// ---------------------------------------------------------------

app.get("/", (req, res) => res.render("start.ejs"));
app.get("/adminlogin", (req, res) => res.render("admin.ejs"));
app.get("/userlogin", (req, res) => res.render("user.ejs"));
app.get("/signup", (req, res) => res.render("signup.ejs"));

// ---------------------------------------------------------------
// SIGNUP (CALLBACK BASED)
// ---------------------------------------------------------------
app.post("/signup", (req, res) => {
  const { fullName, email, phoneNumber, userId, password } = req.body;

  db.query(
    "INSERT INTO signup (full_name, email, phone_number, user_id, password) VALUES (?, ?, ?, ?, ?)",
    [fullName, email, phoneNumber, userId, password],
    (err, result) => {
      if (err) {
        console.error("❌ Signup error:", err);
        return res.status(500).send("Signup failed");
      }
      res.redirect("/");
    }
  );
});

// ---------------------------------------------------------------
// LOGIN (CALLBACK BASED)
// ---------------------------------------------------------------
app.post("/login", (req, res) => {
  const { adminemail, password } = req.body;

  db.query("SELECT * FROM signup WHERE user_id = 'admin'", (err, result) => {
    if (err) {
      console.error("❌ Login error:", err);
      return res.status(500).send("Login error");
    }

    if (result.length === 0) {
      return res.status(401).send("Invalid credentials");
    }

    if (result[0].email !== adminemail || result[0].password !== password) {
      return res.status(401).send("Invalid credentials");
    }

    res.redirect(`${result[0].id}/${result[0].user_id}/taskassignment`);
  });
});

// ---------------------------------------------------------------
// TASK ASSIGNMENT PAGE
// ---------------------------------------------------------------
app.get("/:id/:user_id/taskassignment", (req, res) => {
  db.query("SELECT * FROM signup WHERE user_id = 'admin'", (err, result) => {
    if (err) return res.status(500).send("Error");
    res.render("index.ejs", { adminuser: result });
  });
});

// ---------------------------------------------------------------
// NEW TASK PAGE
// ---------------------------------------------------------------
app.get("/:id/:user_id/task", (req, res) => {
  db.query("SELECT * FROM occupied_places", (err, results) => {
    if (err) return res.status(500).send("Database error");
    res.render("newtask.ejs", { occupiedPlaces: results });
  });
});

// ---------------------------------------------------------------
// QUICK TASK PAGE
// ---------------------------------------------------------------
app.get("/:id/:user_id/task2", (req, res) => res.render("task.ejs"));

// ---------------------------------------------------------------
// SAVE NEW TASK + UPDATE RACKS
// ---------------------------------------------------------------
app.post("/calculate-path", (req, res) => {
  const { pickup, destination } = req.body;

  if (!pickup || !destination) {
    return res.status(400).json({ error: "Missing values" });
  }

  db.query(
    "INSERT INTO task (source_address, destination_address, status) VALUES (?, ?, ?)",
    [pickup, destination, "pending"],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Insert failed" });

      db.query("DELETE FROM occupied_places WHERE rack_name = ?", [pickup], () => {
        db.query("INSERT INTO occupied_places (rack_name) VALUES (?)", [destination], () => {
          res.status(200).json({ message: "Task saved", taskId: result.insertId });
        });
      });
    }
  );
});

// ---------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------
app.get("/dashboard", (req, res) => {
  db.query("SELECT * FROM task", (err, tasks) => {
    if (err) return res.status(500).send("Task load error");

    db.query("SELECT rack_name FROM occupied_places", (err2, occ) => {
      if (err2) return res.status(500).send("Error");

      const occupied = occ.map(r => r.rack_name);

      db.query("SELECT rack_name FROM rack", (err3, all) => {
        if (err3) return res.status(500).send("Error");

        const unoccupied = all
          .map(r => r.rack_name)
          .filter(r => !occupied.includes(r));

        res.render("dashboard", {
          tasks,
          occupied,
          unoccupied
        });
      });
    });
  });
});

// ---------------------------------------------------------------
// UPDATE TASK (CALLBACK VERSION)
// ---------------------------------------------------------------
app.post("/update-task", (req, res) => {
  const { task_id, pickup, destination, status } = req.body;

  db.query(
    "SELECT source_address, destination_address FROM task WHERE task_id = ?",
    [task_id],
    (err, oldData) => {
      if (err) return res.status(500).json({ error: "Fetch error" });
      if (oldData.length === 0) return res.status(404).json({ error: "Not found" });

      const oldPickup = oldData[0].source_address;
      const oldDest = oldData[0].destination_address;

      db.query(
        "UPDATE task SET source_address=?, destination_address=?, status=? WHERE task_id=?",
        [pickup, destination, status, task_id],
        (err2) => {
          if (err2) return res.status(500).json({ error: "Update error" });

          if (oldPickup !== pickup) {
            db.query("DELETE FROM occupied_places WHERE rack_name=?", [oldPickup]);
          }

          if (oldDest !== destination) {
            db.query("DELETE FROM occupied_places WHERE rack_name=?", [oldDest]);
          }

          db.query("INSERT IGNORE INTO occupied_places (rack_name) VALUES (?)", [destination]);

          res.json({ success: true });
        }
      );
    }
  );
});

// ---------------------------------------------------------------
// LOAD EDIT TASK PAGE
// ---------------------------------------------------------------
app.get("/edit-task/:taskId", (req, res) => {
  const { taskId } = req.params;

  db.query("SELECT * FROM task WHERE task_id = ?", [taskId], (err, t) => {
    if (err) return res.status(500).send("Error");
    if (t.length === 0) return res.status(404).send("Not found");

    const task = t[0];

    db.query("SELECT rack_name FROM occupied_places", (err2, occ) => {
      if (err2) return res.status(500).send("Error");

      const occNames = occ.map(r => r.rack_name);

      db.query("SELECT rack_name FROM rack", (err3, all) => {
        const available = all.map(r => r.rack_name).filter(r => !occNames.includes(r));
        
        res.render("edit-task.ejs", {
          task,
          occupiedPlaces: occ,
          availableRacks: available
        });
      });
    });
  });
});

// ---------------------------------------------------------------
// START SERVER
// ---------------------------------------------------------------
app.listen(port, () => console.log(`✅ Server running on port ${port}`));

module.exports = app;
