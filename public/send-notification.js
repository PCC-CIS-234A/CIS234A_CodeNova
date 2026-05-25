/*
  Saul's code — Send Notification page.

  On submit, disables the button, shows the inline spinner, then POSTs the form.
  Brief delay so the browser can paint the spinner before the real submit.
*/

(function () {
  var form = document.getElementById('send-notification-form');
  var btn = document.getElementById('send-notification-btn');
  if (!form || !btn) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    btn.disabled = true;
    btn.classList.add('is-sending');
    btn.setAttribute('aria-busy', 'true');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        setTimeout(function () {
          form.submit();
        }, 100);
      });
    });
  });
})();
