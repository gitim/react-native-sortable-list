import React, {Component, PropTypes} from 'react';
import {Animated, PanResponder, StyleSheet} from 'react-native';
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

  constructor(props) {
    super(props);

    this._animatedLocation = new Animated.ValueXY(props.location);
    this._location = props.location;

    this._animatedLocation.addListener(this._onChangeLocation);
  }

  _panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !this._isDisabled(),

    onMoveShouldSetPanResponder: () => !this._isDisabled(),

    onShouldBlockNativeResponder: () => {
      // Returns whether this component should block native components from becoming the JS
      // responder. Returns true by default. Is currently only supported on android.
      // NOTE: Returning false here allows us to scroll unless it's a long press on a row.
      return false;
    },

    onPanResponderGrant: (e, gestureState) => {
      e.persist();
      this._wasLongPress = false;

      this._longPressTimer = setTimeout(() => {
        this._wasLongPress = true;
        this._target = e.nativeEvent.target;
        this._prevGestureState = {
          ...gestureState,
          moveX: gestureState.x0,
          moveY: gestureState.y0,
        };
        this._toggleActive(e, gestureState);
      }, ACTIVATION_DELAY);
    },

    onPanResponderMove: (e, gestureState) => {
      if (
        !this._active ||
        gestureState.numberActiveTouches > 1 ||
        e.nativeEvent.target !== this._target
      ) {
        if (!this._isTouchInsideElement(e)) {
          this._cancelLongPress();
        }

        return;
      }

      const elementMove = this._mapGestureToMove(this._prevGestureState, gestureState);
      this.moveBy(elementMove);
      this._prevGestureState = {...gestureState};

      if (this.props.onMove) {
        this.props.onMove(e, gestureState, this._nextLocation);
      }
    },

    onPanResponderRelease: (e, gestureState) => {
      if (this._wasLongPress) {
        this._toggleActive(e, gestureState);

      } else if (this._isTouchInsideElement(e)) {
        this._cancelLongPress();

        if (this.props.onPress) {
          this.props.onPress();
        }
      }
    },

    onPanResponderTerminationRequest: () => {
      if (this._active) {
        // If a view is active do not release responder.
        return false;
      }

      this._cancelLongPress();

      return true;
    },

    onPanResponderTerminate: () => {
      this._cancelLongPress();

      // If responder terminated while dragging,
      // deactivate the element and move to the initial location.
      if (this._active) {
        this._toggleActive(e, gestureState);

        if (shallowEqual(this.props.location, this._location)) {
          this._relocate(this.props.location);
        }
      }
    },
  });

  componentWillReceiveProps(nextProps) {
    if (!this._active && !shallowEqual(this._location, nextProps.location)) {
      const animated = !this._active && nextProps.animated;
      this._relocate(nextProps.location, animated);
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.props.disabled !== nextProps.disabled ||
           this.props.children !== nextProps.children ||
           !shallowEqual(this.props.style, nextProps.style);
  }

  moveBy({dx = 0, dy = 0, animated = false}) {
    this._nextLocation = {
      x: this._location.x + dx,
      y: this._location.y + dy,
    };
    this._relocate(this._nextLocation, animated);
  }

  render() {
    const {children, style} = this.props;

    return (
      <Animated.View
        {...this._panResponder.panHandlers}
        style={[style, styles.container, this._animatedLocation.getLayout()]}
        onLayout={this._onLayout}>
        {children}
      </Animated.View>
    );
  }

  _cancelLongPress() {
    clearTimeout(this._longPressTimer);
  }

  _relocate(nextLocation, animated) {
    this._location = nextLocation;

    if (animated) {
      this._isAnimationRunning = true;
      Animated.timing(this._animatedLocation, {
        toValue: nextLocation,
        duration: 300,
      }).start(() => {
        this._isAnimationRunning = false;
      });
    } else {
      this._animatedLocation.setValue(nextLocation);
    }
  }

  _toggleActive(e, gestureState) {
    const callback = this._active ? this.props.onRelease : this.props.onActivate;

    this._active = !this._active;

    if (callback) {
      callback(e, gestureState, this._location);
    }
  }

  _mapGestureToMove(prevGestureState, gestureState) {
    return {
      dy: gestureState.moveY - prevGestureState.moveY,
    };
  }

  _isDisabled() {
      return this.props.disabled ||
        this._isAnimationRunning && this.props.disabledDuringAnimation;
    }

  _isTouchInsideElement({nativeEvent}) {
    return this._layout &&
      nativeEvent.locationX >= 0 &&
      nativeEvent.locationX <= this._layout.width &&
      nativeEvent.locationY >= 0 &&
      nativeEvent.locationY <= this._layout.height;
  }

  _onChangeLocation = (value) => {
    this._location = value;
  };

  _onLayout = (e) => {
      this._layout = e.nativeEvent.layout;

      if (this.props.onLayout) {
          this.props.onLayout(e);
      }
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
