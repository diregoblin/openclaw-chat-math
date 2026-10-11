import type { ControlUiPlugin, ControlUiSurfaceProps, ControlUiViewContext } from 'openclaw/plugin-sdk/control-ui';
import { enhanceNativeMath } from './native-math.ts';

type Context = ControlUiViewContext<ControlUiSurfaceProps['transcript']>;

/** The host keeps ownership of the transcript, composer and Markdown copy. */
export function mountMathTranscript(container: HTMLElement, initial: Context) {
  const document = container.ownerDocument;
  const native = document.createElement('div');
  native.style.display = 'contents';
  container.append(native);
  const unmount = initial.mountDefault(native);
  let current = initial;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const signatures = new WeakMap<HTMLElement, string>();
  const live = () => !disposed && !current.signal.aborted && current.presented !== false;
  const signature = (bubble: HTMLElement) =>
    `${bubble.getAttribute('data-message-text')}\0${[...bubble.querySelectorAll('.chat-text')].map(node => node.innerHTML).join('\0')}`;
  const observer = new document.defaultView!.MutationObserver(schedule);
  function observe() {
    observer.observe(native, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['data-message-text'] });
  }
  function scan() {
    timer = undefined;
    if (!live()) return;
    observer.disconnect();
    try {
      for (const bubble of native.querySelectorAll<HTMLElement>('[data-message-text]')) {
        if (signatures.get(bubble) === signature(bubble)) continue;
        enhanceNativeMath(bubble);
        signatures.set(bubble, signature(bubble));
      }
    } finally { if (live()) observe(); }
  }
  function schedule() {
    if (live() && timer === undefined) timer = setTimeout(scan, 0);
  }
  function stop() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    if (timer !== undefined) clearTimeout(timer);
    current.signal.removeEventListener('abort', stop);
  }
  current.signal.addEventListener('abort', stop, { once: true });
  if (live()) { observe(); schedule(); }
  return {
    update(next: Context) {
      if (disposed) return;
      if (next.signal !== current.signal) {
        current.signal.removeEventListener('abort', stop);
        next.signal.addEventListener('abort', stop, { once: true });
      }
      current = next;
      if (!live()) observer.disconnect(); else { observe(); schedule(); }
    },
    dispose() { stop(); unmount(); native.remove(); },
  };
}

export default {
  id: 'chat-math',
  activate(host) {
    if (host.apiVersion !== 1) throw new Error('Unsupported Control UI plugin API');
    const unregister = host.ui.registerReplacement({ id: 'math', label: 'Chat Math',
      surface: 'transcript', mount: mountMathTranscript });
    host.ui.selectReplacement('transcript', 'math');
    return unregister;
  },
} satisfies ControlUiPlugin;
