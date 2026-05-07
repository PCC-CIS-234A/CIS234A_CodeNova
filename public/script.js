// Wait until the page fully loads before attaching events.
document.addEventListener("DOMContentLoaded", () => {

    // Expand / Collapse
    document.querySelectorAll(".expand-btn").forEach(button => {
        button.addEventListener("click", function (event) {
            event.stopPropagation(); // Prevent row click

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

    // Popup button (View Details)
    document.querySelectorAll(".popup-btn").forEach(button => {
        button.addEventListener("click", function (event) {
            event.stopPropagation(); // Prevent row click

            const index = this.getAttribute("data-index");
            const popupRow = document.getElementById(`popup-row-${index}`);

            if (popupRow.style.display === "none") {
                popupRow.style.display = "table-row";
                this.textContent = "Hide Details";
            } else {
                popupRow.style.display = "none";
                this.textContent = "View Details";
            }
        });
    });

    // Clicking the entire row opens/closes
    document.querySelectorAll(".notification-clickable-row").forEach(row => {
        row.addEventListener("click", function () {
            const index = this.getAttribute("data-index");
            const popupRow = document.getElementById(`popup-row-${index}`);

            popupRow.style.display =
                popupRow.style.display === "none" ? "table-row" : "none";

            this.classList.toggle("active");
        });
    });

});