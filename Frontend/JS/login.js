
const GOOGLE_CLIENT_ID =
    "198840233385-5e4q10qfdfkd35v3qpfuhbh2vpmfsnpe.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("googleSignInButton");
    const notice = document.getElementById("loginNotice");

    if (!container || !notice) {
        console.error("Google sign-in elements not found.");
        return;
    }

    if (window.location.protocol === "file:") {
        notice.textContent =
            "Google sign-in requires http://. Please open Orbit via Live Server (e.g. http://127.0.0.1:5500/frontend/login.html) or the backend (http://localhost:3000/login.html).";
        notice.style.color = "#e53e3e";
        return;
    }

    const apiBase = window.ORBIT_API_BASE || `http://${window.location.hostname || "127.0.0.1"}:3000`;

    // If user already has an active session, auto-navigate to dashboard
    async function checkExistingSession() {
        try {
            const response = await fetch(`${apiBase}/api/me`, {
                method: "GET",
                credentials: "include"
            });
            if (response.ok) {
                const data = await response.json();
                if (data?.user) {
                    notice.textContent = `Welcome back, ${data.user.name}! Redirecting to dashboard...`;
                    setTimeout(() => {
                        window.location.href = "./index.html";
                    }, 500);
                }
            }
        } catch {
            // Not logged in or backend offline
        }
    }

    checkExistingSession();

    function initializeGoogle() {
        if (!window.google?.accounts?.id) {
            notice.textContent = "Google sign-in could not load. Refresh the page.";
            return;
        }

        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse
        });

        google.accounts.id.renderButton(container, {
            theme: "outline",
            size: "large",
            text: "continue_with",
            shape: "rectangular",
            width: 300
        });

        notice.textContent = "Sign in with your Google account.";
    }

    async function handleGoogleResponse(response) {
        if (!response?.credential) {
            notice.textContent = "Google sign-in failed. Please try again.";
            return;
        }

        notice.textContent = "Verifying your Google account...";

        try {
            const result = await fetch(
                `${apiBase}/api/auth/google`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({
                        credential: response.credential
                    })
                }
            );

            const data = await result.json();

            if (!result.ok) {
                throw new Error(data.error || "Verification failed.");
            }

            notice.textContent = `Welcome, ${data.user.name}! Redirecting...`;
            console.log("Orbit session created:", data.user.email);

            setTimeout(() => {
                window.location.href = "./index.html";
            }, 500);

        } catch (error) {
            console.error("Login error:", error);
            notice.textContent =
                error.message || "Login failed. Check that the backend is running and try again.";
        }
    }

    if (window.google?.accounts?.id) {
        initializeGoogle();
    } else {
        const script = document.querySelector(
            'script[src="https://accounts.google.com/gsi/client"]'
        );

        if (script) {
            script.addEventListener("load", initializeGoogle, { once: true });
            script.addEventListener("error", () => {
                notice.textContent = "Could not load Google sign-in.";
            }, { once: true });
        } else {
            notice.textContent = "Google sign-in script is missing from login.html.";
        }
    }
});
