/**
 * ----- Saul Sprint 2: signup-role.js -----
 * Signup is student only — require at least one list before submit.
 */
(function () {
  var campusSection = document.getElementById('campus-list-section');
  var listError = document.getElementById('signup-list-error');
  var form = campusSection ? campusSection.closest('form') : null;
  if (!campusSection || !form) return;

  function hasSelectedLists() {
    return campusSection.querySelectorAll('input[name="list_ids"]:checked').length > 0;
  }

  form.addEventListener('submit', function (event) {
    if (hasSelectedLists()) {
      if (listError) listError.classList.add('is-hidden');
      return;
    }
    event.preventDefault();
    if (listError) listError.classList.remove('is-hidden');
  });

  campusSection.addEventListener('change', function () {
    if (hasSelectedLists() && listError) {
      listError.classList.add('is-hidden');
    }
  });
})();

/* ----- end Saul Sprint 2 ----- */
