document.querySelectorAll('.eye-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const wrapper = this.closest('.password-wrapper');
        const input = wrapper.querySelector('input');
        const isHidden = input.type === 'password';
        input.type = isHidden ? 'text' : 'password';
        this.querySelector('svg').style.opacity = isHidden ? '0.5' : '1';
    });
});