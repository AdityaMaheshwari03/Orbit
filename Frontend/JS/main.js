
/* =========================================
   ORBIT MAIN JAVASCRIPT
========================================= */

// Dynamically matches the frontend hostname (localhost or 127.0.0.1)
// so session cookies and CORS always align.
window.ORBIT_API_BASE = (() => {
    if (window.location.protocol === "file:") {
        return "http://127.0.0.1:3000";
    }
    if (window.location.port === "3000") {
        return window.location.origin;
    }
    const hostname = window.location.hostname || "127.0.0.1";
    return `http://${hostname}:3000`;
})();

document.addEventListener("DOMContentLoaded", function () {
    console.log("Orbit loaded. API Base:", window.ORBIT_API_BASE);

    loadDarkMode();
    setupDarkMode();

    // Protect dashboard and app pages
    protectPage();
});

/* =========================================
   AUTHENTICATION / PAGE PROTECTION
========================================= */

async function protectPage() {
    const currentPage = window.location.pathname.split("/").pop();

    // Login page must remain accessible without a session
    const publicPages = ["login.html"];

    if (publicPages.includes(currentPage) || currentPage === "") {
        return;
    }

    try {
        const response = await fetch(
            `${window.ORBIT_API_BASE}/api/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        if (!response.ok) {
            window.location.replace("./login.html");
            return;
        }

        const data = await response.json();

        // Save user details for this page only
        window.orbitUser = data.user;
        
        const profile = document.getElementById("orbitProfile");
        const profileName = document.getElementById("orbitProfileName");
        const profileEmail = document.getElementById("orbitProfileEmail");
        const profilePicture = document.getElementById("orbitProfilePicture");

        if (profile) {
            profile.hidden = false;
        }

        if (profileName) {
            profileName.textContent = data.user.name || "Orbit User";
        }

        if (profileEmail) {
            profileEmail.textContent = data.user.email || "";
        }

        if (profilePicture && data.user.picture) {
            profilePicture.src = data.user.picture;
            profilePicture.hidden = false;
        }

        console.log("Logged in as:", data.user.name);
    } catch (error) {
        console.error("Could not verify Orbit session:", error);

        alert(
            "Orbit could not verify your login. Make sure the backend is running."
        );
    }
}

/* =========================================
   LOGOUT
========================================= */

async function logoutOrbit() {
    try {
        const response = await fetch(
            `${window.ORBIT_API_BASE}/api/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        if (!response.ok) {
            throw new Error("Logout failed.");
        }

        window.location.replace("./login.html");
    } catch (error) {
        console.error("Logout error:", error);
        alert("Could not log out. Check that the backend is running.");
    }
}

/* =========================================
   DARK MODE
========================================= */

function loadDarkMode() {
    const darkMode = localStorage.getItem("orbitDarkMode");

    if (darkMode === "true") {
        document.body.classList.add("dark-mode");
    }
}

/* =========================================
   DARK MODE TOGGLE
========================================= */

function setupDarkMode() {
    const toggle = document.getElementById("darkModeToggle");

    if (!toggle) {
        return;
    }

    const darkMode = localStorage.getItem("orbitDarkMode");

    if (darkMode === "true") {
        toggle.checked = true;
    }

    toggle.addEventListener("change", function () {
        if (toggle.checked) {
            document.body.classList.add("dark-mode");
            localStorage.setItem("orbitDarkMode", "true");
        } else {
            document.body.classList.remove("dark-mode");
            localStorage.setItem("orbitDarkMode", "false");
        }
    });
}
