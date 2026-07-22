import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Icon } from './Icons';

interface Props {
  children: ReactNode;
  resetKey: string;
}

interface State {
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Crystal canvas rendering failed.', error, info);
  }

  componentDidUpdate(previousProps: Props) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="canvas-error-state" role="alert">
        <Icon name="reset" />
        <strong>3D 渲染出错</strong>
        <p>请刷新页面，或重新加载当前模型。</p>
        <button type="button" onClick={this.retry}>
          <Icon name="rotate" />
          <span>重新加载模型</span>
        </button>
      </div>
    );
  }
}
