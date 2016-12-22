import React, {Component, PropTypes} from 'react';
import {Animated, ScrollView, View, StyleSheet} from 'react-native';
import {shallowEqual, swapArrayElements} from './utils';
import Row from './Row';

const AUTOSCROLL_AREA_HEIGTH = 60;
const AUTOSCROLL_INTERVAL = 100;

export default class SortableList extends Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    order: PropTypes.arrayOf(PropTypes.any),
    style: View.propTypes.style,
    contentContainerStyle: View.propTypes.style,
    sortingEnabled: PropTypes.bool,
    scrollEnabled: PropTypes.bool,

    renderRow: PropTypes.func.isRequired,

    onChangeOrder: PropTypes.func,
    onActivateRow: PropTypes.func,
    onReleaseRow: PropTypes.func,
  };

  static defaultProps = {
    sortingEnabled: true,
    scrollEnabled: true,
  }

  /**
   * Stores refs to rows’ components by keys.
   */
  _rows = {};

  /**
   * Stores promises of rows’ layouts.
   */
  _rowsLayouts = [];

  _contentOffset = {x: 0, y: 0};

  state = {
    order: this.props.order || Object.keys(this.props.data),
    rowsLayouts: null,
    data: this.props.data,
    activeRowKey: null,
    activeRowIndex: null,
    releasedRowKey: null,
    sortingEnabled: this.props.sortingEnabled,
    scrollEnabled: this.props.scrollEnabled,
    style: {
      opacity: new Animated.Value(0),
    },
  };

  componentDidMount() {
    Promise.all([...this._rowsLayouts])
      .then((rowsLayouts) => {
        // Can get correct container’s layout only after rows’s layouts.
        this._container.measure((x, y, width, height, pageX, pageY) => {
          const rowsLayoutsByKey = {};
          let contentHeight = 0;

          rowsLayouts.forEach(({rowKey, layout}) => {
            rowsLayoutsByKey[rowKey] = layout;
            contentHeight += layout.height;
          });

          this.setState({
            containerLayout: {x, y, width, height, pageX, pageY},
            rowsLayouts: rowsLayoutsByKey,
            contentHeight,
          }, () => {
            Animated.spring(this.state.style.opacity, {
              toValue: 1,
            }).start(() => (this._areRowsAnimated = true));
          });
        });
      });
  }

  componentWillReceiveProps(nextProps) {
    const {order} = this.props;
    const {order: nextOrder} = nextProps;

    if (order && nextOrder && !shallowEqual(order, nextOrder)) {
      this.setState({order: nextOrder});
    }
  }

  scrollBy({dy = 0, animated = false}) {
    this._contentOffset = {
      x: this._contentOffset.x,
      y: this._contentOffset.y + dy,
    };
    this._scroll(animated);
  }

  scrollTo({y = 0, animated = false}) {
    this._contentOffset = {
      x: this._contentOffset.x,
      y,
    };
    this._scroll(animated);
  }

  scrollToRowKey({key, animated = false}) {
    const {order, containerLayout, rowsLayouts} = this.state;

    let keyY = 0;

    for (let rowKey of order) {
      if (rowKey === key) {
          break;
      }

      keyY += rowsLayouts[rowKey].height;
    }

    // Scroll if the row is not visible.
    if (
      keyY < this._contentOffset.y ||
      keyY > this._contentOffset.y + containerLayout.height
    ) {
      this._contentOffset = {
        x: this._contentOffset.x,
        y: keyY,
      };
      this._scroll(animated);
    }
  }

  render() {
    const {contentContainerStyle} = this.props;
    const {contentHeight, scrollEnabled} = this.state;
    const containerStyle = StyleSheet.flatten([styles.container, this.props.style, this.state.style]);

    return (
      <Animated.View style={containerStyle} ref={this._onRefContainer}>
        <ScrollView
          ref={this._onRefScrollView}
          contentContainerStyle={contentContainerStyle}
          scrollEventThrottle={2}
          scrollEnabled={scrollEnabled}
          onScroll={this._onScroll}>
          <View style={[styles.container, {height: contentHeight}]}>
            {this._renderRows()}
          </View>
        </ScrollView>
      </Animated.View>
    );
  }

  _renderRows() {
    const {sortingEnabled, renderRow} = this.props;
    const {order, data, activeRowKey, releasedRowKey, rowsLayouts} = this.state;

    const rowWidth = rowsLayouts && Math.max(
      ...Object.keys(rowsLayouts).map((key) => rowsLayouts[key].width)
    );
    let nextY = 0;

    return order.map((key, index) => {
      const item = data[key];
      const style = {};
      let resolveLayout;
      let location;

      if (!rowsLayouts) {
        this._rowsLayouts.push(new Promise((resolve) => (resolveLayout = resolve)));
      }

      if (rowsLayouts) {
        const layout = rowsLayouts[key];

        Object.assign(style, {width: rowWidth, zIndex: 0});
        location = {
          x: 0,
          y: nextY,
        };
        nextY += layout.height;
      } else {
        location = {
          x: 0,
          y: 0,
        };
      }

      const active = activeRowKey === key;
      const released = releasedRowKey === key;

      if (active || released) {
        Object.assign(style, {zIndex: 100});
      }

      return (
        <Row
          key={key}
          ref={this._onRefRow.bind(this, key)}
          animated={this._areRowsAnimated && !active}
          disabled={!sortingEnabled}
          style={style}
          location={location}
          onLayout={!rowsLayouts ? this._onLayoutRow.bind(this, resolveLayout, key) : null}
          onActivate={this._onActivateRow.bind(this, key, index)}
          onRelease={this._onReleaseRow.bind(this, key)}
          onMove={this._onMoveRow}>
          {renderRow({
            key,
            data: item,
            disabled: !sortingEnabled,
            active,
            index,
          })}
        </Row>
      );
    });
  }

  _scroll(animated) {
    this._scrollView.scrollTo({...this._contentOffset, animated});
  }

  /**
   * Finds a row under the moving row, if they are neighbours,
   * swaps them, else shifts rows.
   */
  _setOrderOnMove() {
    const {activeRowKey, activeRowIndex, order} = this.state;

    if (activeRowKey === null || this._autoScrollInterval) {
      return;
    }

    let {
      rowKey: rowUnderActiveKey,
      rowIndex: rowUnderActiveIndex,
    } = this._findRowUnderActiveRow();

    if (this._movingDirectionChanged) {
      this._prevSwapedRowKey = null;
    }

    // Swap rows if necessary.
    if (rowUnderActiveKey !== activeRowKey && rowUnderActiveKey !== this._prevSwapedRowKey) {
      const isNeighbours = Math.abs(rowUnderActiveIndex - activeRowIndex) === 1;
      let nextOrder;

      // If they are neighbours, swap elements, else shift.
      if (isNeighbours) {
        this._prevSwapedRowKey = rowUnderActiveKey;
        nextOrder = swapArrayElements(order, activeRowIndex, rowUnderActiveIndex);
      } else {
        nextOrder = order.slice();
        nextOrder.splice(activeRowIndex, 1);
        nextOrder.splice(rowUnderActiveIndex, 0, activeRowKey);
      }

      this.setState({
        order: nextOrder,
        activeRowIndex: rowUnderActiveIndex,
      }, () => {
        if (this.props.onChangeOrder) {
          this.props.onChangeOrder(nextOrder);
        }
      });
    }
  }

  /**
   * Finds a row, which was covered with the moving row’s half.
   */
  _findRowUnderActiveRow() {
    const {rowsLayouts, activeRowKey, activeRowIndex, order} = this.state;
    const movingRowLayout = rowsLayouts[activeRowKey];
    const rowTopY = this._activeRowLocation.y;
    const rowBottomY = rowTopY + movingRowLayout.height;

    for (
      let currentRowIndex = 0, y = 0, rowsCount = order.length;
      currentRowIndex < rowsCount - 1;
      currentRowIndex++
    ) {
      const currentRowKey = order[currentRowIndex];
      const currentRowLayout = rowsLayouts[currentRowKey];
      const nextRowIndex = currentRowIndex + 1;
      const nextRowLayout = rowsLayouts[order[nextRowIndex]];

      y = y + currentRowLayout.height;

      if (currentRowKey !== activeRowKey &&
        (y - currentRowLayout.height <= rowTopY || currentRowIndex === 0) &&
        rowTopY <= y - currentRowLayout.height / 3
      ) {
        return {
          rowKey: order[currentRowIndex],
          rowIndex: currentRowIndex,
        };
      }

      if (y + nextRowLayout.height / 3 <= rowBottomY &&
        (rowBottomY <= y + nextRowLayout.height || nextRowIndex === rowsCount - 1)
      ) {
        return {
          rowKey: order[nextRowIndex],
          rowIndex: nextRowIndex,
        };
      }
    }

    return {rowKey: activeRowKey, rowIndex: activeRowIndex};
  }

  _scrollOnMove(e) {
    const {pageY} = e.nativeEvent;
    const {containerLayout} = this.state;
    const inAutoScrollUpArea = pageY < containerLayout.pageY + AUTOSCROLL_AREA_HEIGTH;
    const inAutoScrollDownArea = pageY > containerLayout.pageY + containerLayout.height - AUTOSCROLL_AREA_HEIGTH;

    if (!inAutoScrollUpArea &&
      !inAutoScrollDownArea &&
      this._autoScrollInterval !== null
    ) {
      this._stopAutoScroll();
    }

    // It should scroll and scrolling is processing.
    if (this._autoScrollInterval !== null) {
      return;
    }

    if (inAutoScrollUpArea) {
      this._startAutoScroll({
        direction: -1,
        shouldScroll: () => this._contentOffset.y > 0,
        getScrollStep: (stepIndex) => {
          const nextStep = this._getScrollStep(stepIndex);

          return this._contentOffset.y - nextStep < 0
            ? this._contentOffset.y
            : nextStep;
        },
      });
    } else if (inAutoScrollDownArea) {
      this._startAutoScroll({
        direction: 1,
        shouldScroll: () => {
          const {contentHeight, containerLayout} = this.state;

          return this._contentOffset.y < contentHeight - containerLayout.height;
        },
        getScrollStep: (stepIndex) => {
          const nextStep = this._getScrollStep(stepIndex);
          const {contentHeight, containerLayout} = this.state;

          return this._contentOffset.y + nextStep > contentHeight - containerLayout.height
            ? contentHeight - containerLayout.height - this._contentOffset.y
            : nextStep;
        },
      });
    }
  }

  _getScrollStep(stepIndex) {
    return stepIndex > 3 ? 60 : 30;
  }

  _startAutoScroll({direction, shouldScroll, getScrollStep}) {
    if (!shouldScroll()) {
      return;
    }

    const {activeRowKey} = this.state;
    let counter = 0;

    this._autoScrollInterval = setInterval(() => {
      if (shouldScroll()) {
        const dy = direction * getScrollStep(counter++);
        this.scrollBy({dy});
        this._rows[activeRowKey].moveBy({dy});
      } else {
        this._stopAutoScroll();
      }
    }, AUTOSCROLL_INTERVAL);
  }

  _stopAutoScroll() {
    clearInterval(this._autoScrollInterval);
    this._autoScrollInterval = null;
  }

  _onLayoutRow(resolveLayout, rowKey, {nativeEvent: {layout}}) {
    resolveLayout({rowKey, layout});
  }

  _onActivateRow = (rowKey, index, e, gestureState, location) => {
    this._activeRowLocation = location;

    this.setState({
      activeRowKey: rowKey,
      activeRowIndex: index,
      releasedRowKey: null,
      scrollEnabled: false,
    });

    if (this.props.onActivateRow) {
      this.props.onActivateRow(rowKey);
    }
  };

  _onReleaseRow = (rowKey) => {
    this._stopAutoScroll();
    this.setState(({activeRowKey}) => ({
      activeRowKey: null,
      activeRowIndex: null,
      releasedRowKey: activeRowKey,
      scrollEnabled: true,
    }));

    if (this.props.onReleaseRow) {
      this.props.onReleaseRow(rowKey);
    }
  };

  _onMoveRow = (e, gestureState, location) => {
    const prevMovingRowY = this._activeRowLocation.y;
    const prevMovingDirection = this._movingDirection;

    this._activeRowLocation = location;
    this._movingDirection = prevMovingRowY < this._activeRowLocation.y;

    this._movingDirectionChanged = prevMovingDirection !== this._movingDirection;
    this._setOrderOnMove();

    this._scrollOnMove(e);
  };

  _onScroll = ({nativeEvent: {contentOffset}}) => {
      this._contentOffset = contentOffset;
  };

  _onRefContainer = (animatedComponent) => {
    this._container = animatedComponent && animatedComponent._component;
  };

  _onRefScrollView = (component) => {
    this._scrollView = component;
  };

  _onRefRow = (rowKey, component) => {
    this._rows[rowKey] = component;
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
