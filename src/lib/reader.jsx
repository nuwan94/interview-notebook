import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePrefs, useReducedMotion } from './prefs.jsx';

// Read-aloud with word-by-word highlighting and follow-along scrolling.
//
// - The article DOM is split into "blocks" (paragraphs, list items, headings, table cells, question titles)
//   and each block into sentence-sized chunks, because long utterances get cut off in some browsers.
// - Highlighting uses the CSS Custom Highlight API (no DOM changes, so tooltips/markup stay intact).
// - Browsers/voices that never fire `boundary` events (many online voices) fall back to a timed estimate.

const BLOCK_SEL = 'h1,h2,h3,h4,p,li,summary,th,td,figcaption';
export const readerSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
const hlSupported = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight !== 'undefined';

function collectBlocks(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest('[data-noread],script,style')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const byEl = new Map();
  const blocks = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const el = node.parentElement.closest(BLOCK_SEL);
    if (!el || !root.contains(el)) continue;
    let b = byEl.get(el);
    if (!b) {
      b = { el, nodes: [] };
      byEl.set(el, b);
      blocks.push(b);
    }
    b.nodes.push(node);
  }
  for (const b of blocks) {
    let off = 0;
    b.starts = b.nodes.map((n) => {
      const s = off;
      off += n.data.length;
      return s;
    });
    b.text = b.nodes.map((n) => n.data).join('').replace(/\s/g, ' ');
  }
  return blocks;
}

function toChunks(blocks) {
  const chunks = [];
  blocks.forEach((b, bi) => {
    for (const m of b.text.matchAll(/[\s\S]+?(?:[.!?]+(?=\s)|$)\s*/g)) {
      if (/[A-Za-z0-9]/.test(m[0])) chunks.push({ block: bi, start: m.index, text: m[0] });
    }
  });
  return chunks;
}

function locate(block, offset, isEnd) {
  for (let i = block.nodes.length - 1; i >= 0; i--) {
    if (offset >= block.starts[i]) {
      let local = offset - block.starts[i];
      if (isEnd && local === 0 && i > 0) {
        i -= 1;
        local = block.nodes[i].data.length;
      }
      return [block.nodes[i], Math.min(local, block.nodes[i].data.length)];
    }
  }
  return [block.nodes[0], 0];
}

export function useVoices() {
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (!readerSupported) return;
    const load = () => setVoices(speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('en')));
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);
  return voices;
}

function pickVoice(voices, uri) {
  if (uri) {
    const v = voices.find((x) => x.voiceURI === uri);
    if (v) return v;
  }
  const rank = (v) => (v.localService ? 0 : 2) + (/^en-(GB|SG|US|AU|IN)/i.test(v.lang) ? 0 : 1);
  return [...voices].sort((a, b) => rank(a) - rank(b))[0];
}

const ReaderCtx = createContext(null);
export const useReaderCtx = () => useContext(ReaderCtx);
export const ReaderProvider = ReaderCtx.Provider;

export function useReader(rootRef) {
  const { prefs } = usePrefs();
  const reduced = useReducedMotion();
  const voices = useVoices();
  const [state, setState] = useState({ status: 'idle', block: 0, total: 0 });
  const R = useRef({ blocks: [], chunks: [], ci: 0, token: 0, est: null, fb: null, curBlock: -1, lastScroll: 0, userScrollAt: 0 }).current;
  const live = useRef({});
  live.current = { prefs, voices, reduced };

  const clearTimers = () => {
    clearTimeout(R.est);
    clearTimeout(R.fb);
  };
  const clearMarks = () => {
    if (hlSupported) CSS.highlights.delete('reading');
    R.blocks[R.curBlock]?.el.classList.remove('reading-block');
    R.curBlock = -1;
  };

  const stop = useCallback(() => {
    R.token++;
    clearTimers();
    if (readerSupported) speechSynthesis.cancel();
    clearMarks();
    setState((s) => ({ ...s, status: 'idle' }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const follow = (rect, force) => {
    const { prefs: p, reduced: rm } = live.current;
    if (!p.follow) return;
    const now = performance.now();
    if (now - R.userScrollAt < 4000) return; // the reader is scrolling by hand: don't fight them
    if (!force && now - R.lastScroll < 700) return;
    const top = 96;
    const bottom = window.innerHeight - 150;
    if (force || rect.top < top || rect.bottom > bottom) {
      R.lastScroll = now;
      window.scrollBy({ top: rect.top - window.innerHeight * 0.3, behavior: rm ? 'auto' : 'smooth' });
    }
  };

  const highlight = (blockIdx, a, b) => {
    const block = R.blocks[blockIdx];
    if (!block) return;
    try {
      const range = document.createRange();
      const [n1, o1] = locate(block, a, false);
      const [n2, o2] = locate(block, b, true);
      range.setStart(n1, o1);
      range.setEnd(n2, o2);
      if (hlSupported) CSS.highlights.set('reading', new Highlight(range));
      follow(range.getBoundingClientRect(), false);
    } catch {
      /* DOM changed under us (e.g. a filter); keep speaking, skip highlight */
    }
  };

  const speak = (ci) => {
    if (ci >= R.chunks.length) {
      stop();
      return;
    }
    R.ci = ci;
    const ch = R.chunks[ci];
    const block = R.blocks[ch.block];
    if (R.curBlock !== ch.block) {
      R.blocks[R.curBlock]?.el.classList.remove('reading-block');
      R.curBlock = ch.block;
      block.el.closest('details')?.setAttribute('open', '');
      block.el.classList.add('reading-block');
      follow(block.el.getBoundingClientRect(), false);
      setState((s) => ({ ...s, status: 'playing', block: ch.block }));
    }
    const { prefs: p, voices: vs } = live.current;
    const voice = pickVoice(vs, p.voiceURI);
    const token = ++R.token;
    const u = new SpeechSynthesisUtterance(ch.text);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else u.lang = 'en-US';
    u.rate = p.rate;
    let sawBoundary = false;

    const estimate = () => {
      const words = [...ch.text.matchAll(/\S+/g)];
      let i = 0;
      const tick = () => {
        if (token !== R.token || i >= words.length) return;
        const w = words[i++];
        highlight(ch.block, ch.start + w.index, ch.start + w.index + w[0].length);
        R.est = setTimeout(tick, ((w[0].length + 1.5) * 62) / live.current.prefs.rate);
      };
      tick();
    };

    u.onstart = () => {
      if (token !== R.token) return;
      if (voice && !voice.localService) estimate();
      else R.fb = setTimeout(() => !sawBoundary && estimate(), 700);
    };
    u.onboundary = (e) => {
      if (token !== R.token || (e.name && e.name !== 'word')) return;
      sawBoundary = true;
      clearTimers();
      let a = e.charIndex;
      let b = e.charLength > 0 ? a + e.charLength : a;
      if (!(e.charLength > 0)) while (b < ch.text.length && !/\s/.test(ch.text[b])) b++;
      highlight(ch.block, ch.start + a, ch.start + b);
    };
    u.onend = () => {
      if (token !== R.token) return;
      clearTimers();
      speak(ci + 1);
    };
    u.onerror = (e) => {
      if (token !== R.token || e.error === 'canceled' || e.error === 'interrupted') return;
      stop();
    };
    speechSynthesis.speak(u);
  };

  const build = () => {
    R.blocks = collectBlocks(rootRef.current);
    R.chunks = toChunks(R.blocks);
    setState((s) => ({ ...s, total: R.blocks.length }));
  };

  const startAt = (ci) => {
    if (!readerSupported) return;
    speechSynthesis.cancel();
    clearTimers();
    clearMarks();
    build();
    if (!R.chunks.length) return;
    setState((s) => ({ ...s, status: 'playing' }));
    setTimeout(() => speak(Math.min(ci, R.chunks.length - 1)), 60);
  };

  const api = useMemo(
    () => ({
      supported: readerSupported,
      play: () => startAt(0),
      playFrom: (el) => {
        build();
        const idx = R.blocks.findIndex((b) => b.el === el || b.el.contains(el) || el.contains(b.el));
        const target = idx < 0 ? 0 : idx;
        const ci = R.chunks.findIndex((c) => c.block >= target);
        startAt(ci < 0 ? 0 : ci);
      },
      pause: () => {
        // cancel instead of speechSynthesis.pause(): pause() is unreliable across browsers/voices
        R.token++;
        clearTimers();
        speechSynthesis.cancel();
        setState((s) => ({ ...s, status: 'paused' }));
      },
      resume: () => {
        setState((s) => ({ ...s, status: 'playing' }));
        speak(R.ci);
      },
      stop,
      next: () => {
        const ci = R.chunks.findIndex((c) => c.block > R.chunks[R.ci]?.block);
        if (ci >= 0) {
          speechSynthesis.cancel();
          setTimeout(() => speak(ci), 60);
        }
      },
      prev: () => {
        const cur = R.chunks[R.ci]?.block ?? 0;
        const wanted = R.ci > 0 && R.chunks[R.ci].start > 0 ? cur : Math.max(0, cur - 1);
        const ci = R.chunks.findIndex((c) => c.block === wanted);
        speechSynthesis.cancel();
        setTimeout(() => speak(Math.max(ci, 0)), 60);
      },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // restart the current sentence when voice or speed changes mid-read
  useEffect(() => {
    if (state.status !== 'playing') return;
    speechSynthesis.cancel();
    const t = setTimeout(() => speak(R.ci), 80);
    return () => clearTimeout(t);
  }, [prefs.rate, prefs.voiceURI]); // eslint-disable-line react-hooks/exhaustive-deps

  // manual scrolling pauses follow-along for a few seconds
  useEffect(() => {
    const mark = () => (R.userScrollAt = performance.now());
    window.addEventListener('wheel', mark, { passive: true });
    window.addEventListener('touchmove', mark, { passive: true });
    const key = (e) => ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' '].includes(e.key) && mark();
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('wheel', mark);
      window.removeEventListener('touchmove', mark);
      window.removeEventListener('keydown', key);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...api, status: state.status, block: state.block, total: state.total };
}
