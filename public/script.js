// Wait until the page fully loads before attaching events.
document.addEventListener("DOMContentLoaded", () => {

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

    // Clicking the row expands/collapses the message and updates the bottom details box
    document.querySelectorAll(".notification-clickable-row").forEach((row, index) => {
        row.addEventListener("click", function () {
            const detailsContent = document.getElementById("details-content");
            const preview = document.getElementById(`message-preview-${index}`);
            const full = document.getElementById(`message-full-${index}`);

            // If this row is already open, close it
            if (this.classList.contains("active")) {
                this.classList.remove("active");

                preview.style.display = "inline";
                full.style.display = "none";

                detailsContent.innerHTML = `
                    <p>Select a notification to view details.</p>
                `;

                return;
            }

            // Close all other rows first
            document.querySelectorAll(".notification-clickable-row").forEach((otherRow, otherIndex) => {
                otherRow.classList.remove("active");

                const otherPreview = document.getElementById(`message-preview-${otherIndex}`);
                const otherFull = document.getElementById(`message-full-${otherIndex}`);

                if (otherPreview && otherFull) {
                    otherPreview.style.display = "inline";
                    otherFull.style.display = "none";
                }
            });

            // Open the clicked row
            this.classList.add("active");
            preview.style.display = "none";
            full.style.display = "inline";

            // Update the bottom detail box
            showNotificationDetails(this);
        });
    });

});