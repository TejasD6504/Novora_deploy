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
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
require("dotenv").config();
const detectAGV = require('./agvdetect');


const app = express();
const port = process.env.PORT || 3000;

app.use(
  session({
    secret: process.env.SESSION_SECRET || "novora_secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ------------------------- ARDUINO SETUP ---------------------------- */

let arduinoPort = null;
let parser = null;


let detectorRunning = false;
let latestAGV = null;


if (SerialPort && ReadlineParser) {
  try {
    arduinoPort = new SerialPort({ path: "COM3", baudRate: 9600 });
    parser = arduinoPort.pipe(new ReadlineParser({ delimiter: "\n" }));

    arduinoPort.on("open", () => {
      console.log("✅ Arduino connected on COM3");
    });

    parser.on("data", (line) => {
      console.log("Arduino says:", line);
    });

    arduinoPort.on("error", (err) => {
      console.warn("⚠️ Arduino connection error:", err.message);
    });
  } catch (err) {
    console.warn("⚠️ Arduino not connected. Continuing without serial connection.");
  }
}

/* ------------------------- ROUTES ---------------------------- */

app.get("/", (req, res) => {
  res.render("start.ejs");
});

app.get("/admin_dash" , (req,res) => {
  res.render("admindash.ejs");
})

app.get("/adminlogin", (req, res) => {

  res.render("admin.ejs");
});

app.get("/userlogin", (req, res) => {
  res.render("user.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
  
});

app.get("/aboutus" , (req ,res) => {
  res.render("about.ejs");
})

app.get("/contact" , (req ,res) => {
  res.render("contact.ejs");
})

app.get("/alerts", (req, res) => {
  res.render("alerts.ejs");
});

app.post("/useraction", (req, res) => {
    const { email, password } = req.body;

    // 1. Check if user exists
    db.query(
        "SELECT * FROM signup WHERE email = ? AND user_id = 'user'",
        [email],
        (err, result) => {
            if (err) {
                console.error("❌ Database error:", err);
                return res.status(500).send("Internal server error");
            }

            // 2. Check if user exists
            if (result.length === 0) {
                return res.status(401).send("❌ Email not found");
            }

            const user = result[0];

            // 3. Validate password
            if (user.password !== password) {
                return res.status(401).send("❌ Incorrect password");
            }

            // 4. Success → Redirect
            return res.redirect(`/${user.user_id}/${user.id}`);
        }
    );
});


app.get('/:user/:id' ,(req,res) =>{
  const {user,id} = req.params;

    db.query(
    "SELECT * FROM task",
    (err , result) => {
      if (err) {
        console.error("❌ Database insert error (signup):", err);
        return res.status(500).send("Error inserting signup data");
      }
      res.render('foruserview.ejs' , {tasks : result});
    }
  );
})


/* ------------------------- SIGNUP (CALLBACK) ---------------------------- */

app.post("/signup", (req, res) => {
  const { fullName, email, phoneNumber, userId, password } = req.body;

  db.query(
    "INSERT INTO signup (full_name, email, phone_number, user_id, password) VALUES (?, ?, ?, ?, ?)",
    [fullName, email, phoneNumber, userId, password],
    (err) => {
      if (err) {
        console.error("❌ Database insert error (signup):", err);
        return res.status(500).send("Error inserting signup data");
      }
      res.redirect("/");
    }
  );
});

/* ------------------------- LOGIN (CALLBACK) ---------------------------- */

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
      return res.status(401).send("Invalid email or password");
    }

    res.redirect(`/${result[0].id}/${result[0].user_id}/taskassignment`);
  });
});

/* ------------------------- TASK ASSIGNMENT (CALLBACK) ---------------------------- */

app.get("/:id/:user_id/taskassignment", (req, res) => {
  db.query("SELECT * FROM signup WHERE user_id = 'admin'", (err, result) => {
    if (err) {
      console.error("❌ Task assignment error:", err);
      return res.status(500).send("Internal Server Error");
    }
    res.render("index.ejs", { adminuser: result });
  });
});

/* ------------------------- TASK PAGES ---------------------------- */

app.get("/:id/:user_id/task", (req, res) => {
  db.query("SELECT * FROM occupied_places", (err, results) => {
    if (err) return res.status(500).send("Internal Server Error");
    res.render("newtask.ejs", { occupiedPlaces: results });
  });
});

app.get("/:id/:user_id/task2", (req, res) => {
  res.render("task.ejs");
});

/* ------------------------- CALCULATE PATH ---------------------------- */

app.post("/calculate-path", (req, res) => {
  const { pickup, destination } = req.body;

  if (!pickup || !destination) {
    return res.status(400).json({ error: "Missing pickup or destination" });
  }

  db.query(
    "INSERT INTO task (source_address, destination_address, status) VALUES (?, ?, ?)",
    [pickup, destination, "pending"],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Error inserting task" });

      db.query(
        "DELETE FROM occupied_places WHERE rack_name = ?",
        [pickup],
        (deleteErr) => {
          if (deleteErr)
            return res.status(500).json({ error: "Error removing pickup rack" });

          db.query(
            "INSERT INTO occupied_places (rack_name) VALUES (?)",
            [destination],
            (insertErr) => {
              if (insertErr)
                return res
                  .status(500)
                  .json({ error: "Error inserting destination rack" });

              res.status(200).json({
                message: "Task saved successfully",
                taskId: result.insertId,
                removedPickup: pickup,
                addedDestination: destination,
              });
            }
          );
        }
      );
    }
  );
});

/* ------------------------- DASHBOARD ---------------------------- */

app.get("/dashboard", (req, res) => {
  db.query("SELECT * FROM task", (err, tasks) => {
    if (err) return res.status(500).send("Internal Server Error");

    db.query("SELECT rack_id,rack_name FROM occupied_places", (err2, occRows) => {
      if (err2) return res.status(500).send("Internal Server Error");

      const occupiedRacks = occRows.map((r) => r.rack_name).sort();

      db.query("SELECT rack_name FROM rack", (err3, allracks) => {
        if (err3) return res.status(500).send("Internal Server Error");

        const unoccupied = allracks
          .filter((r) => !occupiedRacks.includes(r.rack_name))
          .map((r) => r.rack_name)
          .sort();

        res.render("admindash.ejs", {
          tasks,
          occupied: occupiedRacks,
          unoccupied,
        });
      });
    });
  });
});

/* ------------------------- SEND PATHS ---------------------------- */

app.post("/sendPaths", async(req, res) => {
  const { path1, path2, path3 } = req.body;

  console.log("Received Paths:", path1, path2, path3);

  let finalpath1 = [];
  let finalpath2 = [];
  let finalpath3 = [];
  let last = null;
  let fir;

  if (isNaN(path1[0])) {
    last = path1[0];
    finalpath1.push("straight");
    fir = 1;
  } else {
    last = path1[2];
    finalpath1.push(path1[0]);
    finalpath1.push(path1[1]);
    fir = 2;
  }

  for (let i = fir; i < path1.length; i++) {
    if (!isNaN(path1[i])) {
      finalpath1.push(path1[i]);
      finalpath1.push(path1[i + 1] + "p");
      i++;
    } else if (path1[i] === last) {
      finalpath1.push("straight");
      last = path1[i];
    } else {
      finalpath1.push("left");
      last = path1[i];
    }
  }

  for (let i = 0; i < path2.length; i++) {
    if (!isNaN(path2[i])) {
      finalpath2.push(path2[i]);
      finalpath2.push(path2[i + 1] + "d");
      i++;
    } else if (path2[i] === last) {
      finalpath2.push("straight");
      last = path2[i];
    } else {
      finalpath2.push("left");
      last = path2[i];
    }
  }

  for (let i = 0; i < path3.length; i++) {
    if (!isNaN(path3[i])) {
      finalpath3.push(path3[i]);
      finalpath3.push(path3[i + 1]);
      i++;
    } else if (path3[i] === last) finalpath3.push("straight");
    else finalpath3.push("left");

    last = path3[i];
  }

  const mapDir = {
    straight: "s",
    left: "l",
    right: "r",
    back: "b",
    leftp: "lp",
    rightp: "rp",
    leftd: "ld",
    rightd: "rd",
  };

  const mappedPaths = [
    finalpath1.map((d) => mapDir[d] || d),
    finalpath2.map((d) => mapDir[d] || d),
    finalpath3.map((d) => mapDir[d] || d),
  ];

  console.log("Mapped Paths:", mappedPaths);
let count = finalpath1.length + finalpath2.length + finalpath3.length;

mappedPaths.push(count);

  let Checkavg = await startAGVDetection();
res.json({ message: "Task assigned to AGV = " + Checkavg });

  if (arduinoPort && arduinoPort.isOpen){
    arduinoPort.write(JSON.stringify(mappedPaths) + "\n");
    res.send("Mapped directions sent to Arduino!");
  } else {
    res.send("Arduino not connected.");
  }
});


function startAGVDetection() {
    return new Promise((resolve) => {
        if (!detectorRunning) {
            console.log("Starting AGV Detection...");
            detectorRunning = true;

            detectAGV((agv) => {
                console.log("Detected AGV:", agv);
                latestAGV = agv;
                resolve(latestAGV);  
            });
        } else {
            
            const interval = setInterval(() => {
                if (latestAGV !== null) {
                    clearInterval(interval);
                    resolve(latestAGV); // return detected AGV
                }
            }, 200);
        }
    });
}

/* ------------------------- CALCULATE ---------------------------- */

app.post("/calculate", (req, res) => {O
  const { pickuprack, destinationrack } = req.body;

  const pickupLetter =
    typeof pickuprack === "string" ? pickuprack.charAt(0) : null;

  const destinationLetter =
    typeof destinationrack === "string"
      ? destinationrack.charAt(0)
      : null;

  res.json({
    ok: true,
    pickuprack,
    destinationrack,
    pickupLetter,
    destinationLetter,
  });
});

/* ------------------------- SAVE RACKS ---------------------------- */

app.post("/save-racks", (req, res) => {
  const racks = req.body.racks;

  if (!Array.isArray(racks)) {
    return res.status(400).send("Invalid rack list");
  }

  const values = racks.map((r) => [r]);

  db.beginTransaction((err) => {
    if (err) return res.status(500).send("Transaction error");

    // 1️⃣ Fetch existing occupied_places BEFORE deleting racks
    db.query("SELECT rack_name FROM occupied_places", (fetchErr, oldData) => {
      if (fetchErr) {
        return db.rollback(() => res.status(500).send("Error fetching occupied_places"));
      }

      // 2️⃣ Clear occupied_places first (to avoid FK errors)
      db.query("TRUNCATE TABLE occupied_places", (truncateOccErr) => {
        if (truncateOccErr) {
          return db.rollback(() => res.status(500).send("Error truncating occupied_places"));
        }

        // 3️⃣ Now TRUNCATE rack table safely (reset rack_id)
        db.query("TRUNCATE TABLE rack", (truncateRackErr) => {
          if (truncateRackErr) {
            return db.rollback(() => res.status(500).send("Error truncating rack"));
          }

          // 4️⃣ Insert new racks
          db.query(
            "INSERT INTO rack (rack_name) VALUES ?",
            [values],
            (insertRackErr) => {
              if (insertRackErr) {
                return db.rollback(() => res.status(500).send("Error inserting racks"));
              }

              // 5️⃣ Get new rack_id → rack_name mapping
              db.query("SELECT rack_id, rack_name FROM rack", (mapErr, rackMap) => {
                if (mapErr) {
                  return db.rollback(() => res.status(500).send("Error fetching new rack IDs"));
                }

                // Build a lookup table { "R1": 1, "R2": 2, ... }
                const map = {};
                for (let r of rackMap) {
                  map[r.rack_name] = r.rack_id;
                }

                // 6️⃣ Prepare reinsertion data for occupied_places
                const insertOccupiedData = oldData.map((row) => [
                  map[row.rack_name], // updated rack_id matching new racks
                  row.rack_name
                ]);

                if (insertOccupiedData.length === 0) {
                  // No occupied_places to reinsert
                  return db.commit((commitErr) => {
                    if (commitErr) {
                      return db.rollback(() =>
                        res.status(500).send("Commit error")
                      );
                    }
                    res.send("Racks updated successfully (no occupied places)");
                  });
                }

                // 7️⃣ Insert old occupied_places back with corrected rack_id
                db.query(
                  "INSERT INTO occupied_places (rack_id, rack_name) VALUES ?",
                  [insertOccupiedData],
                  (insertOccErr) => {
                    if (insertOccErr) {
                      return db.rollback(() =>
                        res.status(500).send("Error reinserting occupied_places")
                      );
                    }

                    // 8️⃣ Final commit
                    db.commit((commitErr) => {
                      if (commitErr) {
                        return db.rollback(() =>
                          res.status(500).send("Transaction commit failed")
                        );
                      }

                      res.send("Racks + occupied places updated successfully!");
                    });
                  }
                );
              });
            }
          );
        });
      });
    });
  });
});


/* ------------------------- UPDATE TASK ---------------------------- */

app.post("/update-task", (req, res) => {
  const { task_id, pickup, destination, status } = req.body;

        console.log("I am inside update task",req.body);

  if (!task_id || !pickup || !destination) {
    return res.status(400).json({ error: "Missing required fields" });
  }
        console.log("I am inside update task");


  db.query(
    "SELECT source_address, destination_address FROM task WHERE task_id = ?",
    [task_id],
    (err, oldTask) => {
      if (err) return res.status(500).json({ error: "Server error" });

      if (!oldTask || oldTask.length === 0)
        return res.status(404).json({ error: "Task not found" });

      const oldPickup = oldTask[0].source_address;
      const oldDestination = oldTask[0].destination_address;

      // console.log(oldTask);

      db.query(
        "UPDATE task SET source_address = ?, destination_address = ?, status = ? WHERE task_id = ?",
        [pickup, destination, status, task_id],
        (err2 , res) => {
          if (err2)
            return res.status(500).json({ error: "Failed to update task" });

          if (pickup !== oldPickup) {
            db.query(
              "DELETE FROM occupied_places WHERE rack_name = ?",
              [oldPickup]
            );
          }

          if (destination !== oldDestination) {
            db.query(
              "DELETE FROM occupied_places WHERE rack_name = ?",
              [oldDestination]
            );
          }

          db.query(
            "INSERT IGNORE INTO occupied_places (rack_name) VALUES (?)",
            [destination]
          );

          // res.status(200).json({
          //   success: true,
          //   message: "Task updated successfully",
          // });


      console.log(res);

        }
      );
    }
  );
          res.redirect(`/admin/edit-task/${task_id}`);

});

/* ------------------------- OCCUPIED PLACES ---------------------------- */

app.post("/occupied-places", (req, res) => {
  const { action, rack_name } = req.body;

  if (!action) {
    return res.status(400).json({ error: "action required" });
  }

  if (action === "get") {
    db.query("SELECT * FROM occupied_places ORDER BY rack_name", (err, rows) => {
      if (err) return res.status(500).json({ error: "Internal Server Error" });

      res.json({ success: true, occupiedPlaces: rows });
    });
  } else if (action === "add") {
    if (!rack_name) return res.status(400).json({ error: "rack_name required" });

    db.query(
      "INSERT INTO occupied_places (rack_name) VALUES (?) ON DUPLICATE KEY UPDATE rack_name=rack_name",
      [rack_name]
    );

    res.json({ success: true, message: "Rack marked as occupied" });
  } else if (action === "remove") {
    if (!rack_name) return res.status(400).json({ error: "rack_name required" });

    db.query("DELETE FROM occupied_places WHERE rack_name = ?", [rack_name]);

    res.json({ success: true, message: "Rack marked as unoccupied" });
  } else {
    res.status(400).json({ error: "Invalid action" });
  }
});

/* ------------------------- EDIT TASK PAGE ---------------------------- */



app.get("/user/edit-taskforview/:taskId", (req, res) => {
  const { taskId } = req.params;

  db.query("SELECT * FROM task WHERE task_id = ?", [taskId], (err, taskRows) => {
    if (err) return res.status(500).send("Internal Server Error");

    if (!taskRows || taskRows.length === 0)
      return res.status(404).send("Task not found");

    const task = taskRows[0];

    db.query("SELECT rack_name FROM occupied_places", (err2, occRows) => {
      if (err2) return res.status(500).send("Internal Server Error");

      const occNames = occRows.map((o) => o.rack_name);

      db.query("SELECT rack_name FROM rack", (err3, allRacks) => {
        if (err3) return res.status(500).send("Internal Server Error");

        const availableRacks = allRacks
          .filter((r) => !occNames.includes(r.rack_name))
          .map((r) => r.rack_name);


        console.log("Task data",task)
        // console.log("I am inside");
        
        res.render("edit-task.ejs", {
          task,
          occupiedPlaces: occRows,
          availableRacks,
          user : "user"
        });
      });
    });
  });
});


app.get("/admin/edit-task/:taskId", (req, res) => {
  const { taskId } = req.params;

  db.query("SELECT * FROM task WHERE task_id = ?", [taskId], (err, taskRows) => {
    if (err) return res.status(500).send("Internal Server Error");

    if (!taskRows || taskRows.length === 0)
      return res.status(404).send("Task not found");

    const task = taskRows[0];

    db.query("SELECT rack_id,rack_name FROM occupied_places", (err2, occRows) => {
      if (err2) return res.status(500).send("Internal Server Error");

      const occNames = occRows.map((o) => o.rack_name);

      db.query("SELECT rack_name FROM rack", (err3, allRacks) => {
        if (err3) return res.status(500).send("Internal Server Error");

        const availableRacks = allRacks
          .filter((r) => !occNames.includes(r.rack_name))
          .map((r) => r.rack_name);


        console.log("Task data",task)
        // console.log("I am inside");
        
        res.render("edit-task.ejs", {
          task,
          occupiedPlaces: occRows,
          availableRacks,
          user : "admin"
        });
      });
    });
  });
});



/* -------------------------  Fetching detected agv data  ---------------------------- */



// API route to get latest detected AGV
app.get('/get-agv', (req, res) => {

     startAGVDetection();

    if (latestAGV) {
        res.json({ agv: latestAGV });
    } else {
        res.json({ agv: null, message: "No AGV detected yet" });
    }
});



/* ------------------------- START SERVER ---------------------------- */

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});

module.exports = app;
