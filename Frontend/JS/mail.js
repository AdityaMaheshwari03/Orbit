// =========================================
// ORBIT MAIL
// =========================================

document.addEventListener("DOMContentLoaded", function () {

    console.log("Orbit Mail loaded.");

    setupMailButtons();

});


// =========================================
// MAIL BUTTONS
// =========================================

function setupMailButtons() {

    const buttons = document.querySelectorAll(".mail-actions button");

    if (buttons.length < 3) {
        return;
    }

    // Skip
    buttons[0].addEventListener("click", function () {
        skipEmail();
    });

    // Add Task
    buttons[1].addEventListener("click", function () {
        addTask();
    });

    // Open Email
    buttons[2].addEventListener("click", function () {
        openEmail();
    });

}


// =========================================
// SKIP EMAIL
// =========================================

function skipEmail() {

    alert("Email skipped.");

}


// =========================================
// ADD EMAIL TO TASKS
// =========================================

function addTask() {

    alert("Email added to your tasks.");

}


// =========================================
// OPEN EMAIL
// =========================================

function openEmail() {

    alert("Opening email...");

}
