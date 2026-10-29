/* Hub: animated title + number keys open stations */
(() => {
  const title = document.querySelector('.title');
  title.innerHTML = [...title.textContent]
    .map((c, i) => `<span class="ch" style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`)
    .join('');

  const help = document.querySelector('.help');
  help.querySelector('.help-btn').onclick = () => help.classList.toggle('open');

  const pages = ['noise', 'blackout', 'bloom', 'face', 'words', 'stretch'];
  addEventListener('keydown', (e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= pages.length) location.href = pages[n - 1] + '.html';
  });
})();
