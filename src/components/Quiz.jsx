import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuClipboardCheck, LuTimer, LuX } from 'react-icons/lu';
import { buildAttempt, bestScore, grade, hasQuiz, loadQuiz, saveScore } from '../lib/quiz.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** `code` spans inside question and option text. */
function Inline({ text }) {
  return text.split(/(`[^`]+`)/g).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
      <code key={i}>{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`;
};

/** Button for the lesson header (renders nothing when the lesson has no quiz). */
export function QuizButton({ slug, className = 'btn primary', label = 'Take the quiz' }) {
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);
  const opener = useRef(null);
  if (!hasQuiz(slug)) return null;
  const best = bestScore(slug);
  return (
    <>
      <button ref={opener} type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <LuClipboardCheck aria-hidden="true" className="quiz-icon" /> {label}
        {best && <span className="quiz-best">best {best.correct}/{best.total}</span>}
      </button>
      {open && (
        <QuizOverlay
          slug={slug}
          onClose={() => {
            setOpen(false);
            bump((n) => n + 1);
            setTimeout(() => opener.current?.focus(), 0);
          }}
        />
      )}
    </>
  );
}

function QuizOverlay({ slug, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState(false);
  const [phase, setPhase] = useState('intro'); // intro | question | results
  const [attempt, setAttempt] = useState([]);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]); // { choice, ok, ms }
  const [left, setLeft] = useState(0); // ms
  const [picked, setPicked] = useState(null); // option index, -1 = timed out
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [newBest, setNewBest] = useState(false);
  const box = useRef(null);
  const total = attempt.length;
  const q = attempt[i];
  const answered = picked !== null;

  useEffect(() => {
    let live = true;
    loadQuiz(slug)
      .then((d) => live && setQuiz(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [slug]);

  // modal behaviour: lock page scroll, move focus in
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const start = () => {
    setAttempt(buildAttempt(quiz));
    setAnswers([]);
    setI(0);
    setPicked(null);
    setNewBest(false);
    setConfirmQuit(false);
    answerRef.current = null;
    setPhase('question');
  };

  // the question clock (paused while the tab is hidden or the answer is showing)
  const answerRef = useRef(null);
  const leftRef = useRef(0);
  const pickRef = useRef(null);
  useEffect(() => {
    if (phase !== 'question' || !q) return;
    let rem = q.seconds * 1000;
    leftRef.current = rem;
    setLeft(rem);
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && !answerRef.current) {
        rem = Math.max(0, rem - (now - last));
        leftRef.current = rem;
        setLeft(rem);
        if (rem <= 0) pickRef.current?.(-1); // time is up
      }
      last = now;
    }, 100);
    return () => clearInterval(t);
  }, [phase, i, q]);

  const pick = (idx) => {
    if (!q || answerRef.current || phase !== 'question') return;
    const ok = idx >= 0 && q.options[idx].ok;
    answerRef.current = { idx };
    setPicked(idx);
    setAnswers((a) => [...a, { choice: idx, ok, ms: q.seconds * 1000 - leftRef.current }]);
  };
  pickRef.current = pick;

  const next = () => {
    answerRef.current = null;
    setPicked(null);
    if (i + 1 < total) {
      setI(i + 1);
    } else {
      const correct = answers.filter((a) => a.ok).length;
      setNewBest(saveScore(slug, correct, total));
      setPhase('results');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...box.current.querySelectorAll('button:not(:disabled), [href], [tabindex="0"]')];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (phase === 'question') setConfirmQuit((c) => !c);
      else onClose();
      return;
    }
    if (phase !== 'question' || confirmQuit) return;
    if (!answered) {
      const n = /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : LETTERS.indexOf(e.key.toUpperCase());
      if (n >= 0 && n < q.options.length && e.key.length === 1) {
        e.preventDefault();
        pick(n);
      }
    } else if (e.key === 'Enter' && document.activeElement === box.current) {
      e.preventDefault();
      next();
    }
  };

  const correct = answers.filter((a) => a.ok).length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const frac = q ? left / (q.seconds * 1000) : 1;
  const tone = frac < 0.17 ? 'bad' : frac < 0.34 ? 'warn' : 'ok';

  return createPortal(
    <div className="quiz-backdrop" data-noread onMouseDown={() => (phase === 'question' ? setConfirmQuit(true) : onClose())}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-title"
        tabIndex={-1}
        className="quiz-card"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <header className="quiz-head">
          <h2 id="quiz-title" className="quiz-title">
            {phase === 'results' ? 'Quiz results' : 'Quick quiz'}
          </h2>
          <button type="button" className="btn !min-h-8 !px-2" aria-label="Close quiz" onClick={() => (phase === 'question' ? setConfirmQuit(true) : onClose())}>
            <LuX aria-hidden="true" />
          </button>
        </header>

        {confirmQuit && (
          <div className="quiz-confirm" role="alertdialog" aria-label="Quit the quiz?">
            <span>Quit the quiz? Your progress will be lost.</span>
            <span className="flex gap-2">
              <button type="button" className="btn" onClick={() => setConfirmQuit(false)} autoFocus>
                Keep going
              </button>
              <button type="button" className="btn primary" onClick={onClose}>
                Quit
              </button>
            </span>
          </div>
        )}

        {error && <p className="quiz-note">The quiz could not be loaded. Check your connection and try again.</p>}
        {!quiz && !error && <p className="quiz-note">Loading…</p>}

        {quiz && phase === 'intro' && (
          <div className="quiz-body">
            <p className="quiz-lead">
              {quiz.questions.length} multiple-choice questions on the most important points of this lesson.
            </p>
            <ul className="quiz-rules">
              <li>
                <b>Timed:</b> about {Math.round(quiz.questions.reduce((s, x) => s + (x.s || 30), 0) / 60)} minutes in total; every question has its own countdown, and an unanswered question counts as wrong.
              </li>
              <li>
                <b>One answer</b> per question. Click it, or press <span className="kbd">1</span>–<span className="kbd">4</span> or <span className="kbd">A</span>–<span className="kbd">D</span>.
              </li>
              <li>
                You see the explanation after each answer (the clock pauses), then press <span className="kbd">Enter</span> for the next question.
              </li>
              <li>The score appears at the end; options are shuffled on every attempt.</li>
            </ul>
            {bestScore(slug) && (
              <p className="quiz-note">
                Your best so far: <b>{bestScore(slug).correct}/{bestScore(slug).total}</b>
              </p>
            )}
            <div className="quiz-actions">
              <button type="button" className="btn primary" onClick={start}>
                Start quiz
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Not now
              </button>
            </div>
          </div>
        )}

        {quiz && phase === 'question' && q && (
          <div className="quiz-body">
            <div className="quiz-meta">
              <span>
                Question <b>{i + 1}</b> of {total}
              </span>
              <span className={`quiz-time quiz-${tone}`} role="timer" aria-live="off">
                <LuTimer aria-hidden="true" className="quiz-icon" /> {Math.ceil(left / 1000)} s
              </span>
            </div>
            <div
              className={`quiz-bar quiz-${tone} ${answered ? 'quiz-paused' : ''}`}
              role="progressbar"
              aria-label="Time left"
              aria-valuemin={0}
              aria-valuemax={q.seconds}
              aria-valuenow={Math.ceil(left / 1000)}
            >
              <span style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
            </div>
            <p className="quiz-q">
              <Inline text={q.q} />
            </p>
            <div role="radiogroup" aria-label="Answers" className="quiz-options">
              {q.options.map((o, idx) => {
                const state = !answered ? '' : o.ok ? 'is-right' : picked === idx ? 'is-wrong' : 'is-dim';
                return (
                  <button
                    key={idx}
                    type="button"
                    role="radio"
                    aria-checked={picked === idx}
                    disabled={answered}
                    className={`quiz-opt ${state}`}
                    onClick={() => pick(idx)}
                  >
                    <span className="quiz-letter" aria-hidden="true">
                      {LETTERS[idx]}
                    </span>
                    <span>
                      <Inline text={o.t} />
                      {answered && o.ok && <span className="sr-only"> (correct answer)</span>}
                      {answered && picked === idx && !o.ok && <span className="sr-only"> (your answer, incorrect)</span>}
                    </span>
                    {answered && o.ok && <LuCheck aria-hidden="true" />}
                    {answered && picked === idx && !o.ok && <LuX aria-hidden="true" />}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className={`quiz-why ${picked >= 0 && q.options[picked].ok ? 'quiz-ok' : 'quiz-bad'}`} role="status" aria-live="polite">
                <b>{picked === -1 ? "Time's up." : q.options[picked].ok ? 'Correct.' : 'Not quite.'}</b> <Inline text={q.w || ''} />
              </div>
            )}
            {answered && (
              <div className="quiz-actions">
                <button type="button" className="btn primary" onClick={next} autoFocus>
                  {i + 1 < total ? 'Next question →' : 'See my score'}
                </button>
              </div>
            )}
          </div>
        )}

        {quiz && phase === 'results' && (
          <div className="quiz-body">
            <div className={`quiz-score quiz-${grade(percent).tone}`}>
              <div className="quiz-big">
                {correct}
                <small>/{total}</small>
              </div>
              <div>
                <div className="quiz-pct">{percent}%</div>
                <div className="quiz-grade">{grade(percent).label}</div>
                <div className="quiz-sub">
                  Total time {fmt(answers.reduce((s, a) => s + a.ms, 0))}
                  {newBest && ' · new personal best!'}
                </div>
              </div>
            </div>
            <h3 className="quiz-h3">Review</h3>
            <ol className="quiz-review">
              {attempt.map((qq, n) => {
                const a = answers[n];
                const right = qq.options.find((o) => o.ok);
                return (
                  <li key={n} className={a?.ok ? 'quiz-ok' : 'quiz-bad'}>
                    <div>
                      <b>{a?.ok ? <LuCheck aria-label="correct" /> : <LuX aria-label="wrong" />}</b> <Inline text={qq.q} />
                    </div>
                    {!a?.ok && (
                      <div className="quiz-ans">
                        {a?.choice === -1 || a?.choice == null ? 'No answer (time ran out).' : <>Your answer: <Inline text={qq.options[a.choice].t} /></>}
                      </div>
                    )}
                    <div className="quiz-ans">
                      Correct: <Inline text={right.t} />
                    </div>
                    {qq.w && (
                      <div className="quiz-ans quiz-why-line">
                        <Inline text={qq.w} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="quiz-actions">
              <button type="button" className="btn primary" onClick={start} autoFocus>
                Try again
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Back to the lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
