import { Component } from 'react';

/** Keeps a bug in one lesson from blanking the whole notebook. */
export class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="paper prose-nb" role="alert">
        <h2>Something went wrong on this page</h2>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <p>
          <a href="#/">Back to the contents page</a>
        </p>
      </div>
    );
  }
}
