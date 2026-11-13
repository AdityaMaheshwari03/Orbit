
const FEEDBACK_API = `${window.ORBIT_API_BASE}/api/feedback`;

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("feedbackForm");
    const message = document.getElementById("feedbackMessage");
    const count = document.getElementById("characterCount");
    const status = document.getElementById("feedbackStatus");
    const submitButton = document.getElementById("submitFeedback");

    message.addEventListener("input", () => {
        count.textContent = message.value.length;
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const category = document.getElementById("feedbackCategory").value;
        const rating = document.querySelector(
            'input[name="rating"]:checked'
        )?.value;

        const feedbackMessage = message.value.trim();

        if (!category || !rating || !feedbackMessage) {
            showStatus("Please complete all fields.", "error");
            return;
        }

        if (feedbackMessage.length < 5) {
            showStatus("Please enter at least 5 characters.", "error");
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
        showStatus("", "");

        try {
            const response = await fetch(FEEDBACK_API, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    category,
                    rating: Number(rating),
                    message: feedbackMessage
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Could not submit feedback.");
            }

            showStatus(
                "Thank you! Your feedback has been submitted successfully.",
                "success"
            );

            form.reset();
            count.textContent = "0";

        } catch (error) {
            console.error("Feedback submission failed:", error);
            showStatus(error.message, "error");

        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Submit Feedback →";
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `feedback-status ${type}`;
    }
});
