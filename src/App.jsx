import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { PrefsProvider } from './lib/prefs.jsx';
import { Home } from './pages/Home.jsx';
import { LessonPage, NotFound } from './pages/LessonPage.jsx';
import { GlossaryPage } from './pages/GlossaryPage.jsx';
import { TopicPage } from './pages/TopicPage.jsx';

// HashRouter: every lesson gets its own shareable URL (…/#/lessons/java-hashmap) and
// deep links keep working on GitHub Pages, which cannot rewrite unknown paths to index.html.
export default function App() {
  return (
    <PrefsProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="topics/*" element={<TopicPage />} />
            <Route path="lessons/:slug/:anchor?" element={<LessonPage />} />
            <Route path="glossary/:termId?" element={<GlossaryPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </PrefsProvider>
  );
}
