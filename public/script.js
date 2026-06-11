/*
  public/script.js

  Provides client-side functionality for the notification log and archive pages.
  Handles row selection, notification detail display, message expansion,
  and table sorting functionality.
*/

// Wait until the page fully loads before attaching event listeners.
document.addEventListener("DOMContentLoaded", () => {

    /**
     * Displays the selected notification's details in the details panel.
     *
     * @param {HTMLElement} row The selected notification table row.
     */
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

    // Handle notification row selection and message expansion.
    document.querySelectorAll(".notification-clickable-row").forEach((row, index) => {
        row.addEventListener("click", function () {
            const detailsContent = document.getElementById("details-content");
            const preview = document.getElementById(`message-preview-${index}`);
            const full = document.getElementById(`message-full-${index}`);
            const subjectPreview = document.getElementById(`subject-preview-${index}`);
            const subjectFull = document.getElementById(`subject-full-${index}`);

            // Collapse the currently selected row if clicked again.
            if (this.classList.contains("active")) {
                this.classList.remove("active");

                if (preview && full) {
                    preview.style.display = "inline";
                    full.style.display = "none";
                }

                if (subjectPreview && subjectFull) {
                    subjectPreview.style.display = "inline";
                    subjectFull.style.display = "none";
                }

                detailsContent.innerHTML = `
                    <p>Select a notification to view details.</p>
                `;

                return;
            }

            // Reset all rows before activating the selected row.
            document.querySelectorAll(".notification-clickable-row").forEach((otherRow, otherIndex) => {
                otherRow.classList.remove("active");

                const otherPreview = document.getElementById(`message-preview-${otherIndex}`);
                const otherFull = document.getElementById(`message-full-${otherIndex}`);
                const otherSubjectPreview = document.getElementById(`subject-preview-${otherIndex}`);
                const otherSubjectFull = document.getElementById(`subject-full-${otherIndex}`);

                if (otherPreview && otherFull) {
                    otherPreview.style.display = "inline";
                    otherFull.style.display = "none";
                }

                if (otherSubjectPreview && otherSubjectFull) {
                    otherSubjectPreview.style.display = "inline";
                    otherSubjectFull.style.display = "none";
                }
            });

            this.classList.add("active");

            // Show full message and subject content for the selected row.
            if (preview && full) {
                preview.style.display = "none";
                full.style.display = "inline";
            }

            if (subjectPreview && subjectFull) {
                subjectPreview.style.display = "none";
                subjectFull.style.display = "inline";
            }

            showNotificationDetails(this);
        });
    });

    // Enable column sorting when table headers are clicked.
    document.querySelectorAll(".sortable-header").forEach(header => {
        header.addEventListener("click", function () {
            const table = this.closest("table");
            const tbody = table.querySelector("tbody");
            const columnIndex = Number(this.dataset.column);

            const currentDirection = this.dataset.direction || "asc";
            const newDirection = currentDirection === "asc" ? "desc" : "asc";

            const rows = Array.from(tbody.querySelectorAll("tr"));

            // Sort numeric, date, or text values automatically.
            rows.sort((a, b) => {
                const aText = a.children[columnIndex].innerText.trim();
                const bText = b.children[columnIndex].innerText.trim();

                const aNumber = Number(aText.replace(/,/g, ""));
                const bNumber = Number(bText.replace(/,/g, ""));

                if (!isNaN(aNumber) && !isNaN(bNumber)) {
                    return newDirection === "asc"
                        ? aNumber - bNumber
                        : bNumber - aNumber;
                }

                const aDate = Date.parse(aText);
                const bDate = Date.parse(bText);

                if (!isNaN(aDate) && !isNaN(bDate)) {
                    return newDirection === "asc"
                        ? aDate - bDate
                        : bDate - aDate;
                }

                return newDirection === "asc"
                    ? aText.localeCompare(bText)
                    : bText.localeCompare(aText);
            });

            // Rebuild the table using the sorted rows.
            tbody.innerHTML = "";
            rows.forEach(row => tbody.appendChild(row));

            // Reset sort direction indicators on other headers.
            document.querySelectorAll(".sortable-header").forEach(h => {
                h.dataset.direction = "";
            });

            this.dataset.direction = newDirection;
        });
    });

});