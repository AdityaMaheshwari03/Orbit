
document.addEventListener("DOMContentLoaded", () => {
    const apiBase = window.ORBIT_API_BASE || `http://${window.location.hostname || "127.0.0.1"}:3000`;
    const API = `${apiBase}/api/schedule`;
    const TASKS_API = `${apiBase}/api/tasks`;

    const form = document.getElementById("eventForm");
    const addButton = document.getElementById("addEventButton");
    const cancelButton = document.getElementById("cancelEventButton");
    const titleInput = document.getElementById("eventTitle");
    const descriptionInput = document.getElementById("eventDescription");
    const startInput = document.getElementById("eventStart");
    const endInput = document.getElementById("eventEnd");
    const eventsContainer = document.getElementById("scheduleEvents");
    const status = document.getElementById("scheduleStatus");
    const count = document.getElementById("scheduleEventCount");
    const heading = document.getElementById("scheduleDateHeading");
    const formMessage = document.getElementById("eventFormMessage");

    const listViewButton = document.getElementById("listViewButton");
    const weekViewButton = document.getElementById("weekViewButton");
    const weekNavigation = document.getElementById("weekNavigation");
    const previousWeekButton = document.getElementById("previousWeekButton");
    const nextWeekButton = document.getElementById("nextWeekButton");
    const todayButton = document.getElementById("todayButton");
    const weekCalendar = document.getElementById("weekCalendar");
    const weekGrid = document.getElementById("weekGrid");

    const FIRST_HOUR = 7;
    const LAST_HOUR = 22;
    const HOUR_HEIGHT = 60;

    let allEvents = [];
    let allTasks = [];
    let currentView = "list";
    let weekStart = getMonday(new Date());
    let isLoading = false;

    // Date helpers

    function getMonday(date) {
        const result = new Date(date);
        result.setHours(0, 0, 0, 0);

        const day = result.getDay();
        result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));

        return result;
    }

    function addDays(date, amount) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function sameDate(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function formatDate(date, options = {}) {
        return date.toLocaleDateString([], options);
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatDateTime(value) {
        return new Date(value).toLocaleString([], {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function setStatus(message) {
        status.textContent = message;
    }

    function isCompleted(task) {
        return task.completed === true ||
            task.completed === 1 ||
            task.completed === "true";
    }

    function getPendingTasksForDay(day) {
        return allTasks.filter(task => {
            if (!task.due_date || isCompleted(task)) {
                return false;
            }

            const dueDate = new Date(task.due_date);

            return !Number.isNaN(dueDate.getTime()) &&
                sameDate(dueDate, day);
        });
    }

    // Authenticated API requests

    async function request(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            window.location.replace("./login.html");
            throw new Error("Please log in again.");
        }

        if (!response.ok) {
            throw new Error(data.error || "Schedule request failed.");
        }

        return data;
    }

    // Switch between List and Week views

    function showView(view) {
        currentView = view;

        const isWeek = view === "week";

        eventsContainer.hidden = isWeek;
        weekCalendar.hidden = !isWeek;
        weekNavigation.hidden = !isWeek;

        listViewButton.classList.toggle("active", !isWeek);
        weekViewButton.classList.toggle("active", isWeek);

        listViewButton.setAttribute("aria-pressed", String(!isWeek));
        weekViewButton.setAttribute("aria-pressed", String(isWeek));

        renderCurrentView();
    }

    // Create a scheduled event card for List view

    function createEventCard(event) {
        const card = document.createElement("article");
        card.className = "schedule-event-card";

        const title = document.createElement("strong");
        title.textContent = event.title;

        const description = document.createElement("span");
        description.textContent =
            event.description || "No additional details";

        const time = document.createElement("span");
        time.className = "event-time";
        time.textContent =
            `${formatDateTime(event.start_time)} – ${formatDateTime(event.end_time)}`;

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-event-btn";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async () => {
            if (!confirm(`Delete "${event.title}"?`)) {
                return;
            }

            deleteButton.disabled = true;

            try {
                await deleteEvent(event);
            } catch (error) {
                alert(error.message);
                deleteButton.disabled = false;
            }
        });

        card.append(title, description, time, deleteButton);

        return card;
    }

    // Render the existing List view

    function renderList() {
        eventsContainer.replaceChildren();
        heading.textContent = "All scheduled events";

        if (allEvents.length === 0) {
            setStatus(
                "No scheduled events yet. Click + Add Event to plan your day."
            );
            return;
        }

        setStatus("");

        let previousDate = "";

        allEvents.forEach(event => {
            const start = new Date(event.start_time);

            const dateKey = [
                start.getFullYear(),
                start.getMonth(),
                start.getDate()
            ].join("-");

            if (dateKey !== previousDate) {
                const dateLabel = document.createElement("h3");
                dateLabel.className = "schedule-date-label";

                dateLabel.textContent = formatDate(start, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric"
                });

                eventsContainer.appendChild(dateLabel);
                previousDate = dateKey;
            }

            eventsContainer.appendChild(createEventCard(event));
        });
    }

    // Build the weekly calendar

    function renderWeek() {
        weekGrid.replaceChildren();

        const weekEnd = addDays(weekStart, 7);

        const weekEvents = allEvents.filter(event => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);

            return start < weekEnd && end > weekStart;
        });

        const weekTasks = allTasks.filter(task => {
            if (!task.due_date || isCompleted(task)) {
                return false;
            }

            const dueDate = new Date(task.due_date);

            return !Number.isNaN(dueDate.getTime()) &&
                dueDate >= weekStart &&
                dueDate < weekEnd;
        });

        heading.textContent =
            `${formatDate(weekStart, {
                month: "short",
                day: "numeric"
            })} – ${formatDate(addDays(weekStart, 6), {
                month: "short",
                day: "numeric",
                year: "numeric"
            })}`;

        if (weekEvents.length === 0 && weekTasks.length === 0) {
            setStatus(
                "No events or pending task deadlines this week. Click + Add Event to schedule something."
            );
        } else {
            const eventLabel =
                `${weekEvents.length} scheduled event${weekEvents.length === 1 ? "" : "s"}`;

            const taskLabel =
                `${weekTasks.length} pending deadline${weekTasks.length === 1 ? "" : "s"}`;

            setStatus(`${eventLabel} · ${taskLabel}`);
        }

        // Row 1: weekday headings

        const corner = document.createElement("div");
        corner.className = "week-corner";
        corner.textContent = "TIME";
        weekGrid.appendChild(corner);

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const day = addDays(weekStart, dayIndex);

            const dayHeader = document.createElement("div");
            dayHeader.className = "week-day-header";

            if (sameDate(day, new Date())) {
                dayHeader.classList.add("today");
            }

            const weekday = document.createElement("span");
            weekday.className = "week-day-name";
            weekday.textContent = formatDate(day, {
                weekday: "short"
            });

            const dayNumber = document.createElement("strong");
            dayNumber.className = "week-day-number";
            dayNumber.textContent = day.getDate();

            dayHeader.append(weekday, dayNumber);
            weekGrid.appendChild(dayHeader);
        }

        // Row 2: task deadlines, separate from scheduled time slots

        const taskAxis = document.createElement("div");
        taskAxis.className = "week-task-axis";
        taskAxis.textContent = weekTasks.length ? "TASKS" : "";
        weekGrid.appendChild(taskAxis);

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const day = addDays(weekStart, dayIndex);

            const taskLane = document.createElement("div");
            taskLane.className = "week-task-lane";

            const dayTasks = getPendingTasksForDay(day);

            dayTasks.forEach(task => {
                const marker = document.createElement("div");
                marker.className = "week-task-deadline";

                const taskTitle = document.createElement("strong");
                taskTitle.textContent = task.title;

                const dueTime = document.createElement("span");
                const dueDate = new Date(task.due_date);

                dueTime.textContent =
                    `Due · ${formatTime(dueDate)}`;

                marker.title =
                    `${task.title}\nDeadline: ${formatDateTime(task.due_date)}`;

                marker.append(taskTitle, dueTime);
                taskLane.appendChild(marker);
            });

            weekGrid.appendChild(taskLane);
        }

        // Row 3: hourly timeline and seven day columns

        const timeAxis = document.createElement("div");
        timeAxis.className = "week-time-axis";
        timeAxis.style.height =
            `${(LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT}px`;

        for (let hour = FIRST_HOUR; hour < LAST_HOUR; hour++) {
            const label = document.createElement("div");
            label.className = "week-time-label";
            label.style.height = `${HOUR_HEIGHT}px`;

            label.textContent = new Date(
                2000, 0, 1, hour
            ).toLocaleTimeString([], {
                hour: "numeric"
            });

            timeAxis.appendChild(label);
        }

        weekGrid.appendChild(timeAxis);

        const dayColumns = [];

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const day = addDays(weekStart, dayIndex);

            const column = document.createElement("div");
            column.className = "week-day-column";
            column.dataset.day = dayIndex;

            column.style.height =
                `${(LAST_HOUR - FIRST_HOUR) * HOUR_HEIGHT}px`;

            if (sameDate(day, new Date())) {
                column.classList.add("today-column");
            }

            dayColumns.push(column);
            weekGrid.appendChild(column);
        }

        // Show the current-time line on today's column

        const now = new Date();
        const todayIndex = (now.getDay() + 6) % 7;

        if (
            now >= weekStart &&
            now < weekEnd &&
            now.getHours() >= FIRST_HOUR &&
            now.getHours() < LAST_HOUR
        ) {
            const nowLine = document.createElement("div");
            nowLine.className = "week-now-line";

            nowLine.style.top =
                `${(now.getHours() - FIRST_HOUR) * HOUR_HEIGHT +
                (now.getMinutes() / 60) * HOUR_HEIGHT}px`;

            dayColumns[todayIndex].appendChild(nowLine);
        }

        // Place scheduled events at their actual time

        weekEvents.forEach(event => {
            const start = new Date(event.start_time);
            const end = new Date(event.end_time);

            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const day = addDays(weekStart, dayIndex);
                const nextDay = addDays(day, 1);

                const visibleStart = new Date(
                    Math.max(start.getTime(), day.getTime())
                );

                const visibleEnd = new Date(
                    Math.min(end.getTime(), nextDay.getTime())
                );

                if (visibleEnd <= visibleStart) {
                    continue;
                }

                const startMinutes =
                    visibleStart.getHours() * 60 +
                    visibleStart.getMinutes();

                const endMinutes =
                    visibleEnd.getHours() * 60 +
                    visibleEnd.getMinutes();

                const viewStartMinutes = FIRST_HOUR * 60;
                const viewEndMinutes = LAST_HOUR * 60;

                if (
                    endMinutes <= viewStartMinutes ||
                    startMinutes >= viewEndMinutes
                ) {
                    continue;
                }

                const clippedStart = Math.max(
                    startMinutes,
                    viewStartMinutes
                );

                const clippedEnd = Math.min(
                    endMinutes,
                    viewEndMinutes
                );

                const top =
                    ((clippedStart - viewStartMinutes) / 60) *
                    HOUR_HEIGHT;

                const height = Math.max(
                    22,
                    ((clippedEnd - clippedStart) / 60) *
                    HOUR_HEIGHT
                );

                const eventBlock = document.createElement("button");
                eventBlock.type = "button";
                eventBlock.className = "week-event";

                eventBlock.style.top = `${top}px`;
                eventBlock.style.height = `${height}px`;
                eventBlock.style.left = "3px";
                eventBlock.style.right = "3px";

                eventBlock.title =
                    `${event.title}\n${formatTime(start)} – ${formatTime(end)}\n` +
                    (event.description || "No additional details");

                const eventTitle = document.createElement("strong");
                eventTitle.textContent = event.title;

                const eventTime = document.createElement("span");
                eventTime.textContent =
                    `${formatTime(start)} – ${formatTime(end)}`;

                eventBlock.append(eventTitle, eventTime);

                eventBlock.addEventListener("click", async () => {
                    const details = [
                        event.title,
                        `${formatDateTime(event.start_time)} – ${formatDateTime(event.end_time)}`,
                        event.description || "No additional details"
                    ].join("\n\n");

                    if (confirm(`${details}\n\nDelete this event?`)) {
                        try {
                            await deleteEvent(event);
                        } catch (error) {
                            alert(error.message);
                        }
                    }
                });

                dayColumns[dayIndex].appendChild(eventBlock);
            }
        });
    }

    function renderCurrentView() {
        if (currentView === "week") {
            renderWeek();
        } else {
            renderList();
        }
    }

    // Delete an event from PostgreSQL

    async function deleteEvent(event) {
        await request(
            `${API}/${encodeURIComponent(event.id)}`,
            { method: "DELETE" }
        );

        await loadEvents();
    }

    // Load both scheduled events and tasks

    async function loadEvents() {
        if (isLoading) {
            return;
        }

        isLoading = true;
        setStatus("Loading schedule and tasks...");

        try {
            const [scheduleData, taskData] = await Promise.all([
                request(API),
                request(TASKS_API)
            ]);

            allEvents = (scheduleData.events || []).sort(
                (a, b) =>
                    new Date(a.start_time) - new Date(b.start_time)
            );

            allTasks = (taskData.tasks || []).filter(task => {
                if (!task.due_date || isCompleted(task)) {
                    return false;
                }

                return !Number.isNaN(
                    new Date(task.due_date).getTime()
                );
            });

            count.textContent =
                `${allEvents.length} event${allEvents.length === 1 ? "" : "s"}`;

            renderCurrentView();
        } catch (error) {
            setStatus(error.message);
            count.textContent = "";
            eventsContainer.replaceChildren();
            weekGrid.replaceChildren();
        } finally {
            isLoading = false;
        }
    }

    // Add-event form

    addButton.addEventListener("click", () => {
        form.hidden = false;
        titleInput.focus();
    });

    cancelButton.addEventListener("click", () => {
        form.reset();
        form.hidden = true;
        formMessage.textContent = "";
    });

    document.getElementById("planDayButton").addEventListener("click", () => {
        alert("Day planning will be added in a future Orbit update.");
    });

    // View toggles

    listViewButton.addEventListener("click", () => {
        showView("list");
    });

    weekViewButton.addEventListener("click", () => {
        showView("week");
    });

    // Week navigation

    previousWeekButton.addEventListener("click", () => {
        weekStart = addDays(weekStart, -7);
        renderWeek();
    });

    nextWeekButton.addEventListener("click", () => {
        weekStart = addDays(weekStart, 7);
        renderWeek();
    });

    todayButton.addEventListener("click", () => {
        weekStart = getMonday(new Date());
        renderWeek();
    });

    // Save an event using the existing API

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const title = titleInput.value.trim();
        const start = new Date(startInput.value);
        const end = new Date(endInput.value);

        if (!title) {
            formMessage.textContent =
                "Please enter an event title.";
            return;
        }

        if (
            !startInput.value ||
            !endInput.value ||
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime()) ||
            end <= start
        ) {
            formMessage.textContent =
                "End time must be after start time.";
            return;
        }

        const saveButton = form.querySelector('[type="submit"]');
        saveButton.disabled = true;
        formMessage.textContent = "Saving event...";

        try {
            await request(API, {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description: descriptionInput.value.trim(),
                    start_time: start.toISOString(),
                    end_time: end.toISOString()
                })
            });

            form.reset();
            form.hidden = true;
            formMessage.textContent = "";

            await loadEvents();
        } catch (error) {
            formMessage.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    });

    // Initial page load

    showView("list");
    loadEvents();
});
