function planAssignment(name) {
    alert(
        "Orbit will find available time to work on:\n\n" + name
    );
}

document.addEventListener("DOMContentLoaded", function () {

    const planButtons = document.querySelectorAll(".assignment button");

    planButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const assignment = button
                .closest(".assignment")
                .querySelector("strong")
                .textContent;

            planAssignment(assignment);

        });

    });

});