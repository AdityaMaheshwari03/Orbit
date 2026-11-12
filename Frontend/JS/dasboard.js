
/* =========================================
   ORBIT DASHBOARD
   Loads tasks and schedule from the backend
========================================= */

document.addEventListener("DOMContentLoaded", () => {
    const apiBase = window.ORBIT_API_BASE || `http://${window.location.hostname || "127.0.0.1"}:3000`;
    const TASKS_API = `${apiBase}/api/tasks`;
    const SCHEDULE_API = `${apiBase}/api/schedule`;

    const $ = id => document.getElementById(id);

    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const sevenDaysFromNow = new Date(startOfToday);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    /* =========================================
       DATE AND GREETING
    ========================================= */

    $("dashboardDate").textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });

    function updateGreeting() {
        const hour = new Date().getHours();

        let greeting = "Good evening";

        if (hour < 12) {
            greeting = "Good morning";
        } else if (hour < 17) {
            greeting = "Good afternoon";
        }

        const name = window.orbitUser?.name?.trim().split(/\s+/)[0];

        $("dashboardGreeting").textContent =
            `${greeting}${name ? `, ${name}` : ""}.`;
    }

    updateGreeting();

    // main.js verifies the session asynchronously.
    // Update the greeting again after it loads the profile.
    const greetingTimer = setInterval(() => {
        if (window.orbitUser?.name) {
            updateGreeting();
            clearInterval(greetingTimer);
        }
    }, 250);

    setTimeout(() => clearInterval(greetingTimer), 5000);

    /* =========================================
       API REQUESTS
    ========================================= */

    async function fetchData(url) {
        const response = await fetch(url, {
            method: "GET",
            credentials: "include"
        });

        if (response.status === 401) {
            window.location.replace("./login.html");
            throw new Error("Your session has expired.");
        }

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || "Could not load dashboard data.");
        }

        return data;
    }

    /* =========================================
       FORMATTING HELPERS
    ========================================= */

    function formatTime(value) {
        return new Date(value).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function formatDate(value) {
        return new Date(value).toLocaleDateString([], {
            month: "short",
            day: "numeric"
        });
    }

    function addText(parent, tag, text, className = "") {
        const element = document.createElement(tag);
        element.textContent = text;

        if (className) {
            element.className = className;
        }

        parent.appendChild(element);
        return element;
    }

    /* =========================================
       TODAY'S SCHEDULE
    ========================================= */

    function renderTimeline(events) {
        const container = $("dashboardTimeline");
        container.replaceChildren();

        const todaysEvents = events
            .filter(event => {
                const start = new Date(event.start_time);
                const end = new Date(event.end_time);

                return start < startOfTomorrow && end > startOfToday;
            })
            .sort((a, b) =>
                new Date(a.start_time) - new Date(b.start_time)
            );

        if (!todaysEvents.length) {
            addText(
                container,
                "p",
                "Nothing scheduled for today. Add an event to plan your day."
            );
            return;
        }

        todaysEvents.forEach(event => {
            const item = document.createElement("div");
            item.className = "timeline-item";

            addText(item, "div", formatTime(event.start_time), "time");

            const details = document.createElement("div");
            details.className = "event";

            addText(details, "strong", event.title);

            const description = event.description
                ? ` · ${event.description}`
                : "";

            addText(
                details,
                "span",
                `${formatTime(event.start_time)} – ${formatTime(event.end_time)}${description}`
            );

            item.appendChild(details);
            container.appendChild(item);
        });
    }

    /* =========================================
       PRIORITY LIST
    ========================================= */

    function renderPriorities(tasks) {
        const container = $("dashboardPriorities");
        container.replaceChildren();

        const priorityRank = {
            high: 0,
            medium: 1,
            low: 2
        };

        const pendingTasks = tasks
            .filter(task => !task.completed)
            .sort((a, b) => {
                const priorityDifference =
                    (priorityRank[a.priority] ?? 1) -
                    (priorityRank[b.priority] ?? 1);

                if (priorityDifference !== 0) {
                    return priorityDifference;
                }

                const dateA = a.due_date
                    ? new Date(a.due_date).getTime()
                    : Infinity;

                const dateB = b.due_date
                    ? new Date(b.due_date).getTime()
                    : Infinity;

                return dateA - dateB;
            })
            .slice(0, 3);

        if (!pendingTasks.length) {
            addText(
                container,
                "p",
                "You're all caught up! You have no pending tasks."
            );
            return;
        }

        pendingTasks.forEach((task, index) => {
            const item = document.createElement("div");
            item.className = "priority";

            addText(
                item,
                "div",
                String(index + 1).padStart(2, "0"),
                "priority-number"
            );

            const details = document.createElement("div");

            addText(details, "strong", task.title);

            let subtitle = `${(task.priority || "medium").toUpperCase()} priority`;

            if (task.due_date) {
                subtitle = `Due ${formatDate(task.due_date)}`;
            }

            addText(details, "p", subtitle);

            item.appendChild(details);
            container.appendChild(item);
        });
    }

    /* =========================================
       UPCOMING DEADLINES
    ========================================= */

    function renderDeadlines(tasks) {
        const container = $("dashboardDeadlines");
        container.replaceChildren();

        const upcomingTasks = tasks
            .filter(task => {
                if (task.completed || !task.due_date) {
                    return false;
                }

                const dueDate = new Date(task.due_date);

                return dueDate >= startOfToday &&
                    dueDate < sevenDaysFromNow;
            })
            .sort((a, b) =>
                new Date(a.due_date) - new Date(b.due_date)
            );

        if (!upcomingTasks.length) {
            addText(
                container,
                "p",
                "No pending deadlines in the next 7 days."
            );
            return;
        }

        upcomingTasks.forEach(task => {
            const row = document.createElement("div");
            row.className = "deadline";

            const info = document.createElement("div");
            info.className = "deadline-info";

            addText(info, "strong", task.title);

            addText(
                info,
                "span",
                task.description || `${(task.priority || "medium").toUpperCase()} priority`
            );

            const date = document.createElement("div");
            date.className = "deadline-date";
            date.textContent = formatDate(task.due_date);

            row.append(info, date);
            container.appendChild(row);
        });
    }

    /* =========================================
       LOAD DASHBOARD DATA
    ========================================= */

    async function loadDashboard() {
        const timeline = $("dashboardTimeline");
        const priorities = $("dashboardPriorities");
        const deadlines = $("dashboardDeadlines");

        try {
            const [taskData, scheduleData] = await Promise.all([
                fetchData(TASKS_API),
                fetchData(SCHEDULE_API)
            ]);

            const tasks = taskData.tasks || [];
            const events = scheduleData.events || [];

            const pendingTasks = tasks.filter(task => !task.completed);
            const completedTasks = tasks.filter(task => task.completed);

            const todaysEvents = events.filter(event => {
                const start = new Date(event.start_time);
                const end = new Date(event.end_time);

                return start < startOfTomorrow && end > startOfToday;
            });

            const weeklyDeadlines = pendingTasks.filter(task => {
                if (!task.due_date) return false;

                const dueDate = new Date(task.due_date);

                return dueDate >= startOfToday &&
                    dueDate < sevenDaysFromNow;
            });

            $("todayEventCount").textContent = todaysEvents.length;
            $("pendingTaskCount").textContent = pendingTasks.length;
            $("weeklyDeadlineCount").textContent = weeklyDeadlines.length;
            $("completedTaskCount").textContent = completedTasks.length;

            renderTimeline(events);
            renderPriorities(tasks);
            renderDeadlines(tasks);
        } catch (error) {
            console.error("Dashboard loading failed:", error);

            timeline.textContent =
                "Could not load your schedule. Check the backend and try refreshing.";

            priorities.textContent = "Could not load your tasks.";
            deadlines.textContent = "Could not load your deadlines.";
        }
    }

    loadDashboard();
});
