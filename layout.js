(() => {
  const app = document.getElementById('app');
  const KEY = 'focusWriter.autohide';
  const EDGE = 6; // pixels from the window edge that trigger a panel

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}

  // The visible edge tabs are no longer needed
  document.getElementById('sideTab')?.remove();
  document.getElementById('toolTab')?.remove();

  let mouseX = -1;

  const panels = {
    side: {
      el: document.getElementById('sidebar'),
      btn: document.getElementById('sideAuto'),
      auto: !!saved.side,
      open: false,
      timer: null,
      atEdge: () => mouseX >= 0 && mouseX <= EDGE,
    },
    tool: {
      el: document.getElementById('toolbar'),
      btn: document.getElementById('toolAuto'),
      auto: !!saved.tool,
      open: false,
      timer: null,
      atEdge: () => mouseX >= 0 && mouseX >= innerWidth - EDGE,
    },
  };

  function save() {
    localStorage.setItem(KEY, JSON.stringify({ side: panels.side.auto, tool: panels.tool.auto }));
  }

  // A panel is wanted open when the mouse is at its edge, over it, or focus is inside it
  function wanted(p) {
    return p.atEdge() || p.el.matches(':hover') || p.el.contains(document.activeElement);
  }

  function apply(name) {
    const p = panels[name];
    const show = !p.auto || p.open;
    p.el.classList.toggle('panel-hidden', !show);
    p.btn.textContent = p.auto ? 'Auto-hide: on' : 'Auto-hide: off';
    p.btn.classList.toggle('on', p.auto);
    if (name === 'side') app.classList.toggle('side-auto', p.auto);
  }

  function setOpen(name, open) {
    const p = panels[name];
    p.open = open;
    apply(name);
  }

  // Opens immediately when wanted, closes shortly after it is no longer wanted
  function refresh(name) {
    const p = panels[name];
    if (!p.auto) {
      clearTimeout(p.timer);
      p.timer = null;
      setOpen(name, true);
      return;
    }
    if (wanted(p)) {
      clearTimeout(p.timer);
      p.timer = null;
      setOpen(name, true);
    } else if (p.open && !p.timer) {
      p.timer = setTimeout(() => {
        p.timer = null;
        setOpen(name, false);
      }, 400);
    }
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    refresh('side');
    refresh('tool');
  });

  document.addEventListener('mouseleave', () => {
    mouseX = -1;
    refresh('side');
    refresh('tool');
  });

  for (const name of Object.keys(panels)) {
    const p = panels[name];

    p.btn.onclick = () => {
      p.auto = !p.auto;
      save();
      p.open = wanted(p);
      apply(name);
    };

    p.el.addEventListener('mouseleave', () => refresh(name));
    p.el.addEventListener('mouseenter', () => refresh(name));
    p.el.addEventListener('focusin', () => refresh(name));
    p.el.addEventListener('focusout', () => setTimeout(() => refresh(name), 0));

    apply(name);
  }
})();