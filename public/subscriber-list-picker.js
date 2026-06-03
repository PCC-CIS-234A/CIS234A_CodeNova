/**
 * ----- Saul Sprint 2: subscriber-list-picker.js -----
 * Runs search, sort, show more, and manager remove button on list pickers.
 */
(function () {
  var COLLAPSED_LIMIT = 3;

  // set up one list picker on the page
  function initPicker(root) {
    var itemsContainer = root.querySelector('.list-picker-items');
    if (!itemsContainer) return;

    // find the search, sort, expand, and summary elements inside this picker
    var searchInput = root.querySelector('.list-picker-search');
    var sortSelect = root.querySelector('.list-picker-sort');
    var expandBtn = root.querySelector('.list-picker-expand');
    var summary = root.querySelector('.list-picker-summary');
    var emptyMsg = root.querySelector('.list-picker-empty');
    var limit = parseInt(root.getAttribute('data-collapsed-limit') || String(COLLAPSED_LIMIT), 10);
    var expanded = false;
    var form = root.closest('form');

    // get checkboxes only (skip static labels like All Subscribers)
    function getSelectableItems() {
      return Array.prototype.slice.call(
        itemsContainer.querySelectorAll('.list-picker-item:not(.list-picker-item-static)')
      );
    }

    // show Remove Selected when manager checks at least one list
    function syncRemoveButton() {
      if (!form) return;
      var removeBtn = form.querySelector('.profile-remove-selected-btn');
      if (!removeBtn) return;
      var anyChecked = form.querySelectorAll('.list-picker-checkbox:checked').length > 0;
      removeBtn.classList.toggle('is-hidden', !anyChecked);
    }

    // filter, sort, and hide extra rows
    function applyPickerState() {
      var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      var sort = sortSelect ? sortSelect.value : 'newest';
      var searching = query.length > 0;
      var items = getSelectableItems();

      // hide rows that do not match search text
      items.forEach(function (item) {
        var name = (item.getAttribute('data-list-name') || '').toLowerCase();
        var matches = !query || name.indexOf(query) !== -1;
        item.setAttribute('data-search-match', matches ? '1' : '0');
      });

      // sort by list id (bigger id = newer list)
      items.sort(function (a, b) {
        var idA = parseInt(a.getAttribute('data-list-id'), 10);
        var idB = parseInt(b.getAttribute('data-list-id'), 10);
        return sort === 'oldest' ? idA - idB : idB - idA;
      });
      // put rows back in the DOM in sorted order
      items.forEach(function (item) {
        itemsContainer.appendChild(item);
      });

      var matched = items.filter(function (item) {
        return item.getAttribute('data-search-match') === '1';
      });
      var total = matched.length;
      var shown = 0;

      // show 3 by default unless searching, expanded, or box is checked
      items.forEach(function (item) {
        if (item.getAttribute('data-search-match') !== '1') {
          item.classList.add('is-hidden');
          return;
        }

        var checkbox = item.querySelector('input[type="checkbox"]');
        var isChecked = checkbox && checkbox.checked;
        var visible = searching || expanded || matched.indexOf(item) < limit || isChecked;
        item.classList.toggle('is-hidden', !visible);
        if (visible) shown += 1;
      });

      // show "no matches" message when search finds nothing
      if (emptyMsg) {
        emptyMsg.classList.toggle('is-hidden', total > 0);
      }

      // update "Showing X of Y lists" text
      if (summary) {
        if (total === 0) {
          summary.textContent = '';
        } else if (expanded || total <= limit) {
          summary.textContent = 'Showing ' + total + ' list' + (total === 1 ? '' : 's');
        } else {
          summary.textContent = 'Showing ' + shown + ' of ' + total + ' lists';
        }
      }

      // hide show more button when there are 3 or fewer lists
      if (expandBtn) {
        expandBtn.classList.toggle('is-hidden', searching || total <= limit);
        expandBtn.textContent = expanded ? 'Show less' : 'Show more (' + total + ')';
      }

      syncRemoveButton();
    }

    // re-run when user types in search or changes sort
    if (searchInput) searchInput.addEventListener('input', applyPickerState);
    if (sortSelect) sortSelect.addEventListener('change', applyPickerState);
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        expanded = !expanded;
        applyPickerState();
      });
    }
    // re-run when user checks or unchecks a box
    itemsContainer.addEventListener('change', applyPickerState);

    // ask manager to confirm before deleting lists
    if (form && form.id === 'manager-remove-lists-form') {
      form.addEventListener('submit', function (event) {
        var selected = form.querySelectorAll('.list-picker-checkbox:checked');
        if (!selected.length) {
          event.preventDefault();
          return;
        }

        // build a message with the list names they picked
        var names = Array.prototype.map.call(selected, function (cb) {
          var label = cb.closest('label');
          var span = label ? label.querySelector('span') : null;
          return span ? span.textContent.trim() : 'selected list';
        });

        var message = names.length === 1
          ? 'Remove "' + names[0] + '"? Students subscribed to this list will be unsubscribed.'
          : 'Remove ' + names.length + ' lists? Students subscribed to them will be unsubscribed.';

        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    }

    // run once on page load
    applyPickerState();
  }

  // run on every list picker partial on the page
  document.querySelectorAll('.subscriber-list-picker').forEach(initPicker);
})();

/* ----- end Saul Sprint 2 ----- */
