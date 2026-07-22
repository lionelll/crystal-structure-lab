import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from './Icons';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ApplicationErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Crystal lab rendering failed.', error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="app-error-state" role="alert">
        <Icon name="reset" />
        <h1>页面加载出错</h1>
        <p>实验数据没有丢失，请重新加载页面。</p>
        <button type="button" onClick={this.retry}>
          <Icon name="rotate" />
          <span>重新加载页面</span>
        </button>
      </main>
    );
  }
}
