/**
 * ----- Saul Sprint 2: signup-role.js -----
 * Show list checkboxes only for students and require at least one list.
 */
(function () {
  var roleSelect = document.getElementById('signup-role');
  var campusSection = document.getElementById('campus-list-section');
  var listError = document.getElementById('signup-list-error');
  var form = roleSelect ? roleSelect.closest('form') : null;
  if (!roleSelect || !campusSection || !form) return;

  // hide list section unless account type is Student
  function syncCampusVisibility() {
    var isStudent = roleSelect.value === 'student';
    campusSection.classList.toggle('is-hidden', !isStudent);
    if (listError) listError.classList.add('is-hidden');
  }

  // true if student checked at least one list box
  function hasSelectedLists() {
    return campusSection.querySelectorAll('input[name="list_ids"]:checked').length > 0;
  }

  // when they change student/manager/staff, show or hide the list section
  roleSelect.addEventListener('change', syncCampusVisibility);

  // block submit if student did not pick a list
  form.addEventListener('submit', function (event) {
    if (roleSelect.value !== 'student') return;
    if (hasSelectedLists()) {
      if (listError) listError.classList.add('is-hidden');
      return;
    }
    event.preventDefault();
    if (listError) listError.classList.remove('is-hidden');
  });

  // clear error when they check a box
  campusSection.addEventListener('change', function () {
    if (hasSelectedLists() && listError) {
      listError.classList.add('is-hidden');
    }
  });

  // run once on page load
  syncCampusVisibility();
})();

/* ----- end Saul Sprint 2 ----- */
