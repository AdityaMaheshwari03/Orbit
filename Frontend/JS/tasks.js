
document.addEventListener("DOMContentLoaded", () => {
    const apiBase = window.ORBIT_API_BASE || `http://${window.location.hostname || "127.0.0.1"}:3000`;
    const API = `${apiBase}/api/tasks`;

    const form = document.getElementById("taskForm");
    const addButton = document.getElementById("addTaskButton");
    const cancelButton = document.getElementById("cancelTaskButton");
    const titleInput = document.getElementById("taskTitle");
    const descriptionInput = document.getElementById("taskDescription");
    const dueDateInput = document.getElementById("taskDueDate");
    const priorityInput = document.getElementById("taskPriority");
    const pendingContainer = document.getElementById("pendingTasks");
    const completedContainer = document.getElementById("completedTasks");
    const status = document.getElementById("taskStatus");
    const formMessage = document.getElementById("taskFormMessage");

    addButton.addEventListener("click", () => {
        form.hidden = false;
        titleInput.focus();
    });

    cancelButton.addEventListener("click", () => {
        form.reset();
        form.hidden = true;
        formMessage.textContent = "";
    });

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
            throw new Error("Your session has expired. Please log in again.");
        }

        if (!response.ok) {
            throw new Error(data.error || "Something went wrong.");
        }

        return data;
    }

    function createTaskElement(task) {
        const card = document.createElement("div");
        card.className = "task";

        const checkbox = document.createElement("button");
        checkbox.type = "button";
        checkbox.className = task.completed
            ? "checkbox checked"
            : "checkbox";
        checkbox.textContent = task.completed ? "✓" : "";
        checkbox.setAttribute(
            "aria-label",
            task.completed ? "Mark task incomplete" : "Complete task"
        );

        checkbox.addEventListener("click", async () => {
            checkbox.disabled = true;

            try {
                await request(`${API}/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        completed: !task.completed
                    })
                });

                await loadTasks();
            } catch (error) {
                alert(error.message);
                checkbox.disabled = false;
            }
        });

        const content = document.createElement("div");
        content.className = "task-content";

        const title = document.createElement("strong");
        title.textContent = task.title;

        const details = document.createElement("span");
        const detailParts = [];

        if (task.description) {
            detailParts.push(task.description);
        }

        if (task.due_date) {
            const date = new Date(task.due_date);
            detailParts.push(
                "Due " + date.toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short"
                })
            );
        }

        if (task.completed) {
            detailParts.push("Completed");
        }

        details.textContent = detailParts.join(" · ");

        content.append(title, details);
        card.append(checkbox, content);

        if (!task.completed) {
            const priority = document.createElement("span");
            priority.className = task.priority || "medium";
            priority.textContent = (task.priority || "medium").toUpperCase();
            card.appendChild(priority);
        }

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", `Delete ${task.title}`);

        deleteButton.addEventListener("click", async () => {
            if (!confirm(`Delete "${task.title}"?`)) return;

            deleteButton.disabled = true;

            try {
                await request(`${API}/${task.id}`, {
                    method: "DELETE"
                });

                await loadTasks();
            } catch (error) {
                alert(error.message);
                deleteButton.disabled = false;
            }
        });

        card.appendChild(deleteButton);
        return card;
    }

    async function loadTasks() {
        status.textContent = "Loading tasks...";
        pendingContainer.replaceChildren();
        completedContainer.replaceChildren();

        try {
            const data = await request(API);
            const tasks = data.tasks || [];

            const pending = tasks.filter(task => !task.completed);
            const completed = tasks.filter(task => task.completed);

            pending.forEach(task => {
                pendingContainer.appendChild(createTaskElement(task));
            });

            completed.forEach(task => {
                completedContainer.appendChild(createTaskElement(task));
            });

            status.textContent = tasks.length
                ? `${pending.length} pending · ${completed.length} completed`
                : "No tasks yet. Click + Add Task to create your first one.";
        } catch (error) {
            status.textContent = error.message;
        }
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const title = titleInput.value.trim();

        if (!title) {
            formMessage.textContent = "Please enter a task title.";
            return;
        }

        const dueDate = dueDateInput.value
            ? new Date(dueDateInput.value).toISOString()
            : null;

        const saveButton = form.querySelector('[type="submit"]');
        saveButton.disabled = true;
        formMessage.textContent = "Saving task...";

        try {
            await request(API, {
                method: "POST",
                body: JSON.stringify({
                    title,
                    description: descriptionInput.value.trim(),
                    due_date: dueDate,
                    priority: priorityInput.value
                })
            });

            form.reset();
            form.hidden = true;
            formMessage.textContent = "";

            await loadTasks();
        } catch (error) {
            formMessage.textContent = error.message;
        } finally {
            saveButton.disabled = false;
        }
    });

    loadTasks();
});

