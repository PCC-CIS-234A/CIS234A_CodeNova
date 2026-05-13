// Wait until the page fully loads before attaching events.
document.addEventListener("DOMContentLoaded", () => {

    // Expand / Collapse message preview in the table
    document.querySelectorAll(".expand-btn").forEach(button => {
        button.addEventListener("click", function (event) {
            event.stopPropagation();

            const index = this.getAttribute("data-index");
            const preview = document.getElementById(`message-preview-${index}`);
            const full = document.getElementById(`message-full-${index}`);

            if (full.style.display === "none") {
                preview.style.display = "none";
                full.style.display = "inline";
                this.textContent = "Collapse";
            } else {
                preview.style.display = "inline";
                full.style.display = "none";
                this.textContent = "Expand";
            }
        });
    });

    // Function that fills the bottom details box
    function showNotificationDetails(row) {
        const detailsContent = document.getElementById("details-content");

        detailsContent.innerHTML = `
            <p><strong>Subject:</strong> ${row.dataset.subject}</p>
            <p><strong>Message:</strong> ${row.dataset.body}</p>
            <p><strong>Sent By:</strong> ${row.dataset.sender}</p>
            <p><strong>Date Sent:</strong> ${row.dataset.date}</p>
            <p><strong>Recipients:</strong> ${row.dataset.recipients}</p>
        `;
    }

    // View Details button updates the bottom details box
    document.querySelectorAll(".popup-btn").forEach(button => {
        button.addEventListener("click", function (event) {
            event.stopPropagation();

            const row = this.closest(".notification-clickable-row");
            showNotificationDetails(row);
        });
    });

    // Clicking the row toggles the bottom details box
    document.querySelectorAll(".notification-clickable-row").forEach(row => {
        row.addEventListener("click", function () {

            const detailsContent = document.getElementById("details-content");
            const detailsBox = document.getElementById("notification-details");

            // If already active, close it
            if (this.classList.contains("active")) {

                this.classList.remove("active");

                detailsContent.innerHTML = `
                <p>Select a notification to view details.</p>
            `;

                return;
            }

            // Remove active from all rows
            document.querySelectorAll(".notification-clickable-row").forEach(r => {
                r.classList.remove("active");
            });

            // Activate the clicked row
            this.classList.add("active");

            // Show details
            showNotificationDetails(this);
        });
    });

});