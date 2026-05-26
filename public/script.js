// Wait until the page fully loads before attaching events.
document.addEventListener("DOMContentLoaded", () => {

    /**
     * Safely populate the details panel from a clicked row's data attributes.
     * Uses textContent / createTextNode so no user-supplied content is ever
     * treated as HTML (prevents XSS).
     */
    function showNotificationDetails(row) {
        const detailsContent = document.getElementById("details-content");

        // Clear previous content
        detailsContent.innerHTML = "";

        const fields = [
            ["Subject",    row.dataset.subject],
            ["Message",    row.dataset.body],
            ["Sent By",    row.dataset.sender],
            ["Date Sent",  row.dataset.date],
            ["Recipients", row.dataset.recipients]
        ];

        fields.forEach(([label, value]) => {
            const p      = document.createElement("p");
            const strong = document.createElement("strong");
            strong.textContent = label + ": ";
            p.appendChild(strong);
            p.appendChild(document.createTextNode(value || ""));
            detailsContent.appendChild(p);
        });
    }

    /** Reset the details panel to its default placeholder message. */
    function clearNotificationDetails() {
        const detailsContent = document.getElementById("details-content");
        detailsContent.innerHTML = "";
        const p = document.createElement("p");
        p.textContent = "Select a notification to view details.";
        detailsContent.appendChild(p);
    }

    // Clicking a row expands/collapses the inline message preview and
    // updates the bottom details panel.
    document.querySelectorAll(".notification-clickable-row").forEach((row, index) => {
        row.addEventListener("click", function () {
            const preview = document.getElementById(`message-preview-${index}`);
            const full    = document.getElementById(`message-full-${index}`);

            // If this row is already open, close it.
            if (this.classList.contains("active")) {
                this.classList.remove("active");
                preview.style.display = "inline";
                full.style.display    = "none";
                clearNotificationDetails();
                return;
            }

            // Close every other row first.
            document.querySelectorAll(".notification-clickable-row").forEach((otherRow, otherIndex) => {
                otherRow.classList.remove("active");
                const otherPreview = document.getElementById(`message-preview-${otherIndex}`);
                const otherFull    = document.getElementById(`message-full-${otherIndex}`);
                if (otherPreview && otherFull) {
                    otherPreview.style.display = "inline";
                    otherFull.style.display    = "none";
                }
            });

            // Open the clicked row.
            this.classList.add("active");
            preview.style.display = "none";
            full.style.display    = "inline";

            showNotificationDetails(this);
        });
    });

});
