/**
 * Saul Sprint 2 — show list checkboxes for students and require at least one on signup.
 */
(function () {
  var roleSelect = document.getElementById('signup-role');
  var campusSection = document.getElementById('campus-list-section');
  var listError = document.getElementById('signup-list-error');
  var form = roleSelect ? roleSelect.closest('form') : null;
  if (!roleSelect || !campusSection || !form) return;

  function syncCampusVisibility() {
    var isStudent = roleSelect.value === 'student';
    campusSection.classList.toggle('is-hidden', !isStudent);
    if (listError) listError.classList.add('is-hidden');
  }

  function hasSelectedLists() {
    return campusSection.querySelectorAll('input[name="list_ids"]:checked').length > 0;
  }

  roleSelect.addEventListener('change', syncCampusVisibility);

  form.addEventListener('submit', function (event) {
    if (roleSelect.value !== 'student') return;
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

  syncCampusVisibility();
})();
