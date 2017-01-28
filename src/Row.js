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

    this.state = {};
    this._animatedLocation = new Animated.ValueXY(props.location);
    this._location = props.location;

    this._animatedLocation.addListener(this._onChangeLocation);
  }

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
            this.props.onActivate(e, gestureState, this._location);
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

    onPanResponderTerminationRequest: () => !this.state.active,

    onPanResponderTerminate: () => {
      this._cancelLongPress();
    },
  });

  componentWillReceiveProps(nextProps) {
    if (!this.state.active && !shallowEqual(this._location, nextProps.location)) {
      const animated = !this.state.active && nextProps.animated;
      this._relocate(nextProps.location, animated);
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
        onLayout={this.props.onLayout}>
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
      Animated.timing(this._animatedLocation, {
        toValue: nextLocation,
      }).start();
    } else {
      this._animatedLocation.setValue(nextLocation);
    }
  }

  _mapGestureToMove(prevGestureState, gestureState) {
    return {
      dy: gestureState.dy - prevGestureState.dy,
    };
  }

  _onChangeLocation = (value) => {
    this._location = value;
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
});
