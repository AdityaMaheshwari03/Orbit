
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { OAuth2Client } = require("google-auth-library");
const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!GOOGLE_CLIENT_ID || !SESSION_SECRET) {
    console.error("Missing GOOGLE_CLIENT_ID or SESSION_SECRET in backend/.env");
    process.exit(1);
}

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// =========================================
// JSON FILE STORAGE
// =========================================

const DATA_DIR = path.join(__dirname, "data");

const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const SCHEDULE_FILE = path.join(DATA_DIR, "schedule.json");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");
// Create data folder and files automatically.
async function initializeJsonFiles() {
    await fs.mkdir(DATA_DIR, { recursive: true });

    for (const file of [TASKS_FILE, SCHEDULE_FILE, FEEDBACK_FILE]) {
        try {
            await fs.access(file);
        } catch {
            await fs.writeFile(file, "[]", "utf8");
        }
    }
}

async function readJson(file) {
    const content = await fs.readFile(file, "utf8");
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
        throw new Error(`${path.basename(file)} must contain a JSON array.`);
    }

    return data;
}

// Serialize updates so simultaneous requests don't overwrite each other.
let writeQueue = Promise.resolve();

function updateJson(file, updater) {
    const operation = writeQueue.then(async () => {
        const records = await readJson(file);
        const updatedRecords = await updater(records);

        const temporaryFile = `${file}.tmp`;

        await fs.writeFile(
            temporaryFile,
            JSON.stringify(updatedRecords, null, 2),
            "utf8"
        );

        await fs.rename(temporaryFile, file);

        return updatedRecords;
    });

    writeQueue = operation.catch(() => {});
    return operation;
}

// =========================================
// MIDDLEWARE
// =========================================

const localOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

if (IS_PRODUCTION && process.env.TRUST_PROXY === "true") {
    app.set("trust proxy", 1);
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || localOriginRegex.test(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: "20kb" }));

app.use(session({
    name: "orbit.sid",
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Serve frontend static files
const FRONTEND_DIR = path.join(__dirname, "../frontend");
app.use(express.static(FRONTEND_DIR));

function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            error: "Authentication required."
        });
    }

    next();
}

// =========================================
// HEALTH CHECK
// =========================================

app.get("/api/health", (req, res) => {
    res.json({
        message: "Orbit backend is running!"
    });
});

// =========================================
// GOOGLE SIGN-IN
// =========================================

app.post("/api/auth/google", async (req, res) => {
    try {
        const { credential } = req.body;

        if (typeof credential !== "string" || !credential) {
            return res.status(400).json({
                error: "Google credential is required."
            });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload || !payload.sub || !payload.email ||
            payload.email_verified !== true) {
            return res.status(401).json({
                error: "Invalid or unverified Google account."
            });
        }

        const user = {
            id: payload.sub,
            name: payload.name || "Orbit User",
            email: payload.email,
            picture: payload.picture || ""
        };

        req.session.regenerate((error) => {
            if (error) {
                console.error("Session regeneration failed:", error);
                return res.status(500).json({
                    error: "Could not create a login session."
                });
            }

            req.session.user = user;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save failed:", saveError);
                    return res.status(500).json({
                        error: "Could not save the login session."
                    });
                }

                res.json({
                    message: "Login successful.",
                    user
                });
            });
        });

    } catch (error) {
        console.error("Google verification failed:", error.message);

        res.status(401).json({
            error: "Google sign-in verification failed."
        });
    }
});

// =========================================
// CURRENT USER
// =========================================

app.get("/api/me", requireAuth, (req, res) => {
    res.json({
        user: req.session.user
    });
});

app.get("/api/private", requireAuth, (req, res) => {
    res.json({
        message: "You are authenticated.",
        userId: req.session.user.id
    });
});

// =========================================
// TASK API - JSON STORAGE
// =========================================

// GET ALL TASKS
app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
        const records = await readJson(TASKS_FILE);

        const tasks = records
            .filter(task => task.user_id === req.session.user.id)
            .sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            );

        res.json({ tasks });

    } catch (error) {
        console.error("Fetch tasks failed:", error.message);
        res.status(500).json({
            error: "Could not fetch tasks."
        });
    }
});

// CREATE TASK
app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
        const {
            title,
            description = "",
            due_date = null,
            priority = "medium"
        } = req.body;

        if (typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                error: "Task title is required."
            });
        }

        if (!["low", "medium", "high"].includes(priority)) {
            return res.status(400).json({
                error: "Invalid priority."
            });
        }

        if (typeof description !== "string") {
            return res.status(400).json({
                error: "Invalid task description."
            });
        }

        if (due_date !== null &&
            (typeof due_date !== "string" ||
             Number.isNaN(new Date(due_date).getTime()))) {
            return res.status(400).json({
                error: "Invalid task deadline."
            });
        }

        const task = {
            id: randomUUID(),
            user_id: req.session.user.id,
            title: title.trim(),
            description: description.trim(),
            due_date,
            priority,
            completed: false,
            created_at: new Date().toISOString()
        };

        await updateJson(TASKS_FILE, records => {
            records.push(task);
            return records;
        });

        res.status(201).json({ task });

    } catch (error) {
        console.error("Create task failed:", error.message);
        res.status(500).json({
            error: "Could not create task."
        });
    }
});

// UPDATE TASK COMPLETION
app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
        const { completed } = req.body;

        if (typeof completed !== "boolean") {
            return res.status(400).json({
                error: "A boolean completed value is required."
            });
        }

        let updatedTask = null;

        await updateJson(TASKS_FILE, records => {
            const task = records.find(item =>
                item.id === req.params.id &&
                item.user_id === req.session.user.id
            );

            if (task) {
                task.completed = completed;
                updatedTask = task;
            }

            return records;
        });

        if (!updatedTask) {
            return res.status(404).json({
                error: "Task not found."
            });
        }

        res.json({ task: updatedTask });

    } catch (error) {
        console.error("Update task failed:", error.message);
        res.status(500).json({
            error: "Could not update task."
        });
    }
});

// DELETE TASK
app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
        let deleted = false;

        await updateJson(TASKS_FILE, records => {
            const filtered = records.filter(task => {
                const matches =
                    task.id === req.params.id &&
                    task.user_id === req.session.user.id;

                if (matches) deleted = true;

                return !matches;
            });

            return filtered;
        });

        if (!deleted) {
            return res.status(404).json({
                error: "Task not found."
            });
        }

        res.json({
            message: "Task deleted successfully."
        });

    } catch (error) {
        console.error("Delete task failed:", error.message);
        res.status(500).json({
            error: "Could not delete task."
        });
    }
});

// =========================================
// SCHEDULE API - JSON STORAGE
// =========================================

// GET SCHEDULE EVENTS
app.get("/api/schedule", requireAuth, async (req, res) => {
    try {
        const records = await readJson(SCHEDULE_FILE);

        const events = records
            .filter(event => event.user_id === req.session.user.id)
            .sort((a, b) =>
                new Date(a.start_time) - new Date(b.start_time)
            );

        res.json({ events });

    } catch (error) {
        console.error("Fetch schedule failed:", error.message);
        res.status(500).json({
            error: "Could not fetch schedule."
        });
    }
});

// CREATE SCHEDULE EVENT
app.post("/api/schedule", requireAuth, async (req, res) => {
    try {
        const {
            title,
            description = "",
            start_time,
            end_time
        } = req.body;

        if (typeof title !== "string" || !title.trim() ||
            !start_time || !end_time) {
            return res.status(400).json({
                error: "Title, start time and end time are required."
            });
        }

        if (typeof description !== "string") {
            return res.status(400).json({
                error: "Invalid event description."
            });
        }

        const start = new Date(start_time);
        const end = new Date(end_time);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            return res.status(400).json({
                error: "End time must be after start time."
            });
        }

        const event = {
            id: randomUUID(),
            user_id: req.session.user.id,
            title: title.trim(),
            description: description.trim(),
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            created_at: new Date().toISOString()
        };

        await updateJson(SCHEDULE_FILE, records => {
            records.push(event);
            return records;
        });

        res.status(201).json({ event });

    } catch (error) {
        console.error("Create schedule event failed:", error.message);
        res.status(500).json({
            error: "Could not create event."
        });
    }
});

// DELETE SCHEDULE EVENT
app.delete("/api/schedule/:id", requireAuth, async (req, res) => {
    try {
        let deleted = false;

        await updateJson(SCHEDULE_FILE, records => {
            const filtered = records.filter(event => {
                const matches =
                    event.id === req.params.id &&
                    event.user_id === req.session.user.id;

                if (matches) deleted = true;

                return !matches;
            });

            return filtered;
        });

        if (!deleted) {
            return res.status(404).json({
                error: "Event not found."
            });
        }

        res.json({
            message: "Event deleted successfully."
        });

    } catch (error) {
        console.error("Delete schedule event failed:", error.message);
        res.status(500).json({
            error: "Could not delete event."
        });
    }
});

/* =========================================
   FEEDBACK API - JSON STORAGE
========================================= */

// SUBMIT FEEDBACK
app.post("/api/feedback", requireAuth, async (req, res) => {

    try {
        const { category, rating, message } = req.body;

        const allowedCategories = [
            "Suggestion",
            "Bug Report",
            "User Experience",
            "Feature Request",
            "Other"
        ];

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                error: "Please select a valid feedback category."
            });
        }

        if (
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5
        ) {
            return res.status(400).json({
                error: "Rating must be between 1 and 5."
            });
        }

        if (
            typeof message !== "string" ||
            message.trim().length < 5 ||
            message.trim().length > 1000
        ) {
            return res.status(400).json({
                error: "Feedback must contain between 5 and 1000 characters."
            });
        }

        const feedback = {
            id: randomUUID(),
            user_id: req.session.user.id,
            user_name: req.session.user.name,
            user_email: req.session.user.email,
            category,
            rating,
            message: message.trim(),
            created_at: new Date().toISOString()
        };

        await updateJson(FEEDBACK_FILE, records => {
            records.push(feedback);
            return records;
        });
        await updateJson(FEEDBACK_FILE, records => {
    records.push(feedback);
    return records;
});

        res.status(201).json({
            message: "Feedback submitted successfully.",
            feedback: {
                id: feedback.id,
                category: feedback.category,
                rating: feedback.rating,
                message: feedback.message,
                created_at: feedback.created_at
            }
        });

    } catch (error) {
        console.error("Submit feedback failed:", error.message);

        res.status(500).json({
            error: "Could not submit feedback."
        });
    }
});

// GET FEEDBACK SUBMITTED BY CURRENT USER
app.get("/api/feedback", requireAuth, async (req, res) => {
    try {
        const records = await readJson(FEEDBACK_FILE);

        const feedback = records
            .filter(item => item.user_id === req.session.user.id)
            .sort((a, b) =>
                new Date(b.created_at) - new Date(a.created_at)
            )
            .map(({ user_id, user_name, user_email, ...item }) => item);

        res.json({ feedback });

    } catch (error) {
        console.error("Fetch feedback failed:", error.message);

        res.status(500).json({
            error: "Could not fetch feedback."
        });
    }
});

// =========================================
// LOGOUT
// =========================================

app.post("/api/logout", (req, res) => {
    if (!req.session) {
        return res.json({
            message: "Logged out successfully."
        });
    }

    req.session.destroy(error => {
        if (error) {
            console.error("Logout failed:", error);

            return res.status(500).json({
                error: "Could not log out."
            });
        }

        res.clearCookie("orbit.sid", {
            httpOnly: true,
            secure: IS_PRODUCTION,
            sameSite: "lax",
            path: "/"
        });

        res.json({
            message: "Logged out successfully."
        });
    });
});

// =========================================
// START SERVER
// =========================================

async function startServer() {
    try {
        await initializeJsonFiles();

        app.listen(PORT, () => {
            console.log(`Orbit backend running at http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
            console.log("JSON storage initialized successfully.");
        });

    } catch (error) {
        console.error("Could not initialize JSON storage:", error);
        process.exit(1);
    }
}

startServer();
