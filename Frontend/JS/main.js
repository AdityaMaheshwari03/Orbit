// =========================================
// ORBIT MAIN JAVASCRIPT
// =========================================


// Run when page loads

document.addEventListener("DOMContentLoaded", function () {

    console.log("Orbit loaded.");

    loadDarkMode();

    setupDarkMode();

});


// =========================================
// DARK MODE
// =========================================

function loadDarkMode() {

    const darkMode = localStorage.getItem("orbitDarkMode");

    if (darkMode === "true") {

        document.body.classList.add("dark-mode");

    }

}


// =========================================
// DARK MODE TOGGLE
// =========================================

function setupDarkMode() {

    const toggle = document.getElementById("darkModeToggle");

    if (!toggle) {
        return;
    }


    // Set toggle to saved state

    const darkMode = localStorage.getItem("orbitDarkMode");

    if (darkMode === "true") {

        toggle.checked = true;

    }


    // When user changes toggle

    toggle.addEventListener("change", function () {

        if (toggle.checked) {

            document.body.classList.add("dark-mode");

            localStorage.setItem(
                "orbitDarkMode",
                "true"
            );

        } else {

            document.body.classList.remove("dark-mode");

            localStorage.setItem(
                "orbitDarkMode",
                "false"
            );

        }

    });

}