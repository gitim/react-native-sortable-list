import React, {Component, PropTypes} from 'react';
import {Animated, PanResponder, LayoutAnimation, StyleSheet} from 'react-native';
import {shallowEqual} from './utils';

const ACTIVATION_DELAY = 200;

export default class Row extends Component {
  static propTypes = {
    children: PropTypes.node,
    animated: PropTypes.bool,
    disabled: PropTypes.bool,
    style: Animated.View.propTypes.style,
    location: PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
    }),

    // Will be called on long press.
    onActivate: PropTypes.func,
    onLayout: PropTypes.func,

    // Will be called, when user (directly) move the view.
    onMove: PropTypes.func,

    // Will be called, when user release the view.
    onRelease: PropTypes.func,
  };

  static defaultProps = {
    location: {x: 0, y: 0},
  };

  state = {
    location: this.props.location,
  };

  _panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !this.props.disabled,
    onMoveShouldSetPanResponder: () => !this.props.disabled,

    onPanResponderGrant: (e, gestureState) => {
      e.persist();

      this._longPressTimer = setTimeout(() => {
        this._recentlyReleased = false;
        this._prevGestureState = {...gestureState};

        this.setState({active: true}, () => {
          if (this.props.onActivate) {
            this.props.onActivate(e, gestureState, this.state.location);
          }
        });
      }, ACTIVATION_DELAY);
    },

    onPanResponderMove: (e, gestureState) => {
      if (!this.state.active) {
        return;
      }

      const elementMove = this._mapGestureToMove(this._prevGestureState, gestureState);
      this.moveBy(elementMove);
      this._prevGestureState = {...gestureState};

      if (this.props.onMove) {
        this.props.onMove(e, gestureState, this._nextLocation);
      }
    },

    onPanResponderRelease: () => {
      this._cancelLongPress();

      this.setState({active: false}, () => {
        if (this.props.onRelease) {
          this.props.onRelease();
        }
      });

    },

    onPanResponderTerminationRequest: () => {
      this._cancelLongPress();
    },

    onPanResponderTerminate: () => {
      this._cancelLongPress();
    },
  });

  componentWillReceiveProps(nextProps) {
    if (!this.state.active && !shallowEqual(this.state.location, nextProps.location)) {
      this.setState({location: nextProps.location});
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.disabled !== nextProps.disabled ||
           this.props.children !== nextProps.children ||
           !shallowEqual(this.props.location, nextProps.location) ||
           !shallowEqual(this.props.style, nextProps.style) ||
           this.state.active !== nextState.active ||
           !shallowEqual(this.state.location, nextState.location);
  }

  componentWillUpdate(nextProps, nextState) {
    if (
        !this.state.active &&
        nextProps.animated &&
        !shallowEqual(this.state.location, nextState.location)
      ) {
      LayoutAnimation.easeInEaseOut();
    }
  }

  moveBy({dx = 0, dy = 0, animated = false}) {
    if (animated) {
      LayoutAnimation.easeInEaseOut();
    }

    this._nextLocation = {
      x: this.state.location.x + dx,
      y: this.state.location.y + dy,
    };
    this.setState({location: this._nextLocation});
  }

  render() {
    const {children, style} = this.props;

    return (
      <Animated.View
        {...this._panResponder.panHandlers}
        style={[style, styles.container, this._getLayout()]}
        onLayout={this.props.onLayout}>
        {children}
      </Animated.View>
    );
  }

  _cancelLongPress() {
    clearTimeout(this._longPressTimer);
  }

  _getLayout() {
    return {
      left: this.state.location.x,
      top: this.state.location.y,
    };
  }

  _mapGestureToMove(prevGestureState, gestureState) {
    return {
      dy: gestureState.dy - prevGestureState.dy,
    };
  }
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
