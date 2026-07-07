import React from 'react';

/**
 * Catches render errors in its subtree and shows a fallback "something went
 * wrong" screen with a reload button instead of a blank/broken page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error, _errorInfo) {
    // Error details are logged by the browser runtime
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-muted">
          <div className="max-w-md p-8 bg-card rounded-xl shadow-lg border border-red-200 dark:border-red-800">
            <div className="text-red-600 dark:text-red-300 text-lg font-semibold mb-2">Something went wrong</div>
            <div className="text-muted-foreground text-sm mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
