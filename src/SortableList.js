import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {ScrollView, View, StyleSheet, Platform, RefreshControl, ViewPropTypes} from 'react-native';
import {inRange, shallowEqual, swapArrayElements} from './utils';
import Row from './Row';

const AUTOSCROLL_INTERVAL = 100;
const ZINDEX = Platform.OS === 'ios' ? 'zIndex' : 'elevation';

function uniqueRowKey(key) {
  return `${key}${uniqueRowKey.id}`
}

uniqueRowKey.id = 0

export default class SortableList extends Component {
  static propTypes = {
    data: PropTypes.oneOfType([PropTypes.array, PropTypes.object]).isRequired,
    order: PropTypes.arrayOf(PropTypes.any),
    style: ViewPropTypes.style,
    contentContainerStyle: ViewPropTypes.style,
    innerContainerStyle: ViewPropTypes.style,
    sortingEnabled: PropTypes.bool,
    scrollEnabled: PropTypes.bool,
    horizontal: PropTypes.bool,
    refreshControl: PropTypes.element,
    autoscrollAreaSize: PropTypes.number,
    rowActivationTime: PropTypes.number,
    manuallyActivateRows: PropTypes.bool,

    renderRow: PropTypes.func.isRequired,
    renderHeader: PropTypes.func,
    renderFooter: PropTypes.func,

    onChangeOrder: PropTypes.func,
    onActivateRow: PropTypes.func,
    onReleaseRow: PropTypes.func,
  };

  static defaultProps = {
    sortingEnabled: true,
    scrollEnabled: true,
    autoscrollAreaSize: 60,
    manuallyActivateRows: false
  }

  /**
   * Stores refs to rows’ components by keys.
   */
  _rows = {};

  /**
   * Stores promises of rows’ layouts.
   */
  _rowsLayouts = {};
  _resolveRowLayout = {};

  _contentOffset = {x: 0, y: 0};

  state = {
    animated: false,
    order: this.props.order || Object.keys(this.props.data),
    rowsLayouts: null,
    containerLayout: null,
    data: this.props.data,
    activeRowKey: null,
    activeRowIndex: null,
    releasedRowKey: null,
    sortingEnabled: this.props.sortingEnabled,
    scrollEnabled: this.props.scrollEnabled
  };

  componentWillMount() {
    this.state.order.forEach((key) => {
      this._rowsLayouts[key] = new Promise((resolve) => {
        this._resolveRowLayout[key] = resolve;
      });
    });

    if (this.props.renderHeader && !this.props.horizontal) {
      this._headerLayout = new Promise((resolve) => {
        this._resolveHeaderLayout = resolve;
      });
    }
    if (this.props.renderFooter && !this.props.horizontal) {
      this._footerLayout = new Promise((resolve) => {
        this._resolveFooterLayout = resolve;
      });
    }
  }

  componentDidMount() {
    this._onUpdateLayouts();
  }

  componentWillReceiveProps(nextProps) {
    const {data, order} = this.state;
    let {data: nextData, order: nextOrder} = nextProps;

    if (data && nextData && !shallowEqual(data, nextData)) {
      nextOrder = nextOrder || Object.keys(nextData)
      uniqueRowKey.id++;
      this._rowsLayouts = {};
      nextOrder.forEach((key) => {
        this._rowsLayouts[key] = new Promise((resolve) => {
          this._resolveRowLayout[key] = resolve;
        });
      });
      this.setState({
        animated: false,
        data: nextData,
        containerLayout: null,
        rowsLayouts: null,
        order: nextOrder
      });

    } else if (order && nextOrder && !shallowEqual(order, nextOrder)) {
      this.setState({order: nextOrder});
    }
  }

  componentDidUpdate(prevProps, prevState) {
    const {data} = this.state;
    const {data: prevData} = prevState;

    if (data && prevData && !shallowEqual(data, prevData)) {
      this._onUpdateLayouts();
    }
  }

  scrollBy({dx = 0, dy = 0, animated = false}) {
    if (this.props.horizontal) {
      this._contentOffset.x += dx;
    } else {
      this._contentOffset.y += dy;
    }

    this._scroll(animated);
  }

  scrollTo({x = 0, y = 0, animated = false}) {
    if (this.props.horizontal) {
      this._contentOffset.x = x;
    } else {
      this._contentOffset.y = y;
    }

    this._scroll(animated);
  }

  scrollToRowKey({key, animated = false}) {
    const {order, containerLayout, rowsLayouts} = this.state;

    let keyX = 0;
    let keyY = 0;

    for (const rowKey of order) {
      if (rowKey === key) {
          break;
      }

      keyX += rowsLayouts[rowKey].width;
      keyY += rowsLayouts[rowKey].height;
    }

    // Scroll if the row is not visible.
    if (
      this.props.horizontal
        ? (keyX < this._contentOffset.x || keyX > this._contentOffset.x + containerLayout.width)
        : (keyY < this._contentOffset.y || keyY > this._contentOffset.y + containerLayout.height)
    ) {
      if (this.props.horizontal) {
        this._contentOffset.x = keyX;
      } else {
        this._contentOffset.y = keyY;
      }

      this._scroll(animated);
    }
  }

  render() {
    let {contentContainerStyle, innerContainerStyle, horizontal, style} = this.props;
    const {animated, contentHeight, contentWidth, scrollEnabled} = this.state;
    const containerStyle = StyleSheet.flatten([style, {opacity: Number(animated)}])
    innerContainerStyle = [
      styles.rowsContainer,
      horizontal ? {width: contentWidth} : {height: contentHeight},
      innerContainerStyle
    ];
    let {refreshControl} = this.props;

    if (refreshControl && refreshControl.type === RefreshControl) {
      refreshControl = React.cloneElement(this.props.refreshControl, {
        enabled: scrollEnabled, // fix for Android
      });
    }

    return (
      <View style={containerStyle} ref={this._onRefContainer}>
        <ScrollView
          refreshControl={refreshControl}
          ref={this._onRefScrollView}
          horizontal={horizontal}
          contentContainerStyle={contentContainerStyle}
          scrollEventThrottle={2}
          scrollEnabled={scrollEnabled}
          onScroll={this._onScroll}>
          {this._renderHeader()}
          <View style={innerContainerStyle}>
            {this._renderRows()}
          </View>
          {this._renderFooter()}
        </ScrollView>
      </View>
    );
  }

  _renderRows() {
    const {horizontal, rowActivationTime, sortingEnabled, renderRow} = this.props;
    const {animated, order, data, activeRowKey, releasedRowKey, rowsLayouts} = this.state;

    let nextX = 0;
    let nextY = 0;

    return order.map((key, index) => {
      const style = {[ZINDEX]: 0};
      const location = {x: 0, y: 0};

      if (rowsLayouts) {
        if (horizontal) {
          location.x = nextX;
          nextX += rowsLayouts[key] ? rowsLayouts[key].width : 0;
        } else {
          location.y = nextY;
          nextY += rowsLayouts[key] ? rowsLayouts[key].height : 0;
        }
      }

      const active = activeRowKey === key;
      const released = releasedRowKey === key;

      if (active || released) {
        style[ZINDEX] = 100;
      }

      return (
        <Row
          key={uniqueRowKey(key)}
          ref={this._onRefRow.bind(this, key)}
          horizontal={horizontal}
          activationTime={rowActivationTime}
          animated={animated && !active}
          disabled={!sortingEnabled}
          style={style}
          location={location}
          onLayout={!rowsLayouts ? this._onLayoutRow.bind(this, key) : null}
          onActivate={this._onActivateRow.bind(this, key, index)}
          onPress={this._onPressRow.bind(this, key)}
          onRelease={this._onReleaseRow.bind(this, key)}
          onMove={this._onMoveRow}
          manuallyActivateRows={this.props.manuallyActivateRows}>
          {renderRow({
            key,
            data: data[key],
            disabled: !sortingEnabled,
            active,
            index,
          })}
        </Row>
      );
    });
  }

  _renderHeader() {
    if (!this.props.renderHeader || this.props.horizontal) {
      return null;
    }

    const {headerLayout} = this.state;

    return (
      <View onLayout={!headerLayout ? this._onLayoutHeader : null}>
        {this.props.renderHeader()}
      </View>
    );
  }

  _renderFooter() {
    if (!this.props.renderFooter || this.props.horizontal) {
      return null;
    }

    const {footerLayout} = this.state;

    return (
      <View onLayout={!footerLayout ? this._onLayoutFooter : null}>
        {this.props.renderFooter()}
      </View>
    );
  }

  _onUpdateLayouts() {
    const {horizontal} = this.props;
    const {order} = this.state;
    Promise.all([this._headerLayout, this._footerLayout, ...Object.values(this._rowsLayouts)])
      .then(([headerLayout, footerLayout, ...rowsLayouts]) => {
        // Can get correct container’s layout only after rows’s layouts.
        this._container.measure((x, y, width, height, pageX, pageY) => {
          let rowsLayoutsByKey = {};
          let contentHeight = 0;
          let contentWidth = 0;

          rowsLayouts.forEach(({rowKey, layout}) => {
            rowsLayoutsByKey[rowKey] = layout;
            contentHeight += layout.height;
            contentWidth += layout.width;
          });
          rowsLayoutsByKey = this._getRowsLocations(rowsLayoutsByKey, order);

          this.setState({
            containerLayout: {x, y, width, height, pageX, pageY},
            rowsLayouts: rowsLayoutsByKey,
            rowsSwapRanges: this._getRowsSwapRanges(rowsLayoutsByKey, order),
            headerLayout,
            footerLayout,
            contentHeight,
            contentWidth,
          }, () => {
            this.setState({animated: true});
          });
        });
      });
  }

  _getRowsLocations(_rowsLayouts, order) {
    const {horizontal} = this.props;
    const rowsLayouts = {};
    let nextX = 0;
    let nextY = 0;

    for (let i = 0, len = order.length; i < len; i++) {
      const rowKey = order[i];
      const rowLayout = _rowsLayouts[rowKey];

      rowsLayouts[rowKey] = {
        ...rowLayout,
        x: nextX,
        y: nextY,
      };

      if (horizontal) {
        nextX += rowLayout.width;
      } else {
        nextY += rowLayout.height;
      }
    }

    return rowsLayouts;
  }

  _getRowsSwapRanges(rowsLayouts, order) {
    const {horizontal} = this.props;
    const rowsSwapRanges = {};

    for (let i = 0, len = order.length; i < len; i++) {
      const rowKey = order[i];
      const rowLayout = rowsLayouts[rowKey];

      rowsSwapRanges[rowKey] = horizontal
        ? {
          left: [rowLayout.x + rowLayout.width / 3, rowLayout.x + rowLayout.width],
          right: [rowLayout.x, rowLayout.x + 2 * rowLayout.width / 3],
        }
        : {
          top: [rowLayout.y + rowLayout.height / 3, rowLayout.y + rowLayout.height],
          bottom: [rowLayout.y, rowLayout.y + 2 * rowLayout.height / 3],
        };
    }

    return rowsSwapRanges;
  }

  _scroll(animated) {
    this._scrollView.scrollTo({...this._contentOffset, animated});
  }

  /**
   * Finds a row under the moving row, if they are neighbours,
   * swaps them, else shifts rows.
   */
  _setOrderOnMove() {
    const {activeRowKey, activeRowIndex, order, rowsLayouts} = this.state;
    const {horizontal} = this.props;

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

      const nextRowsLayouts = this._getRowsLocations(rowsLayouts, nextOrder);
      const nextRowsSwapRanges = this._getRowsSwapRanges(nextRowsLayouts, nextOrder);

      this.setState({
        order: nextOrder,
        activeRowIndex: rowUnderActiveIndex,
        rowsLayouts: nextRowsLayouts,
        rowsSwapRanges: nextRowsSwapRanges,
      }, () => {
        if (this.props.onChangeOrder) {
          this.props.onChangeOrder(nextOrder);
        }
      });
    }
  }

  /**
   * Finds a row, which was covered with the moving row’s third.
   */
  _findRowUnderActiveRow() {
    const {horizontal} = this.props;
    const {rowsLayouts, rowsSwapRanges, activeRowKey, activeRowIndex, order} = this.state;
    const movingDirection = this._movingDirection;
    const rowsCount = order.length;
    const activeRowLayout = rowsLayouts[activeRowKey];
    const activeRowLeftX = this._activeRowLocation.x
    const activeRowRightX = this._activeRowLocation.x + activeRowLayout.width;
    const activeRowTopY = this._activeRowLocation.y;
    const activeRowBottomY = this._activeRowLocation.y + activeRowLayout.height;

    const prevRowIndex = activeRowIndex - 1;
    const prevRowKey = order[prevRowIndex];
    const prevRowSwapRages = rowsSwapRanges[prevRowKey]
    const nextRowIndex = activeRowIndex + 1;
    const nextRowKey = order[nextRowIndex];
    const nextRowSwapRages = rowsSwapRanges[nextRowKey]

    if (horizontal
      ? (movingDirection === 1
        ? (
          (activeRowIndex === 0 || activeRowLeftX > prevRowSwapRages.right[0]) &&
          (activeRowIndex === rowsCount - 1 || activeRowRightX < nextRowSwapRages.left[0])
        )
        : (
          (activeRowIndex === 0 || activeRowLeftX > prevRowSwapRages.right[1]) &&
          (activeRowIndex === rowsCount - 1 || activeRowRightX < nextRowSwapRages.left[1])
        )
      )
      : (movingDirection === 1
        ? (
          (activeRowIndex === 0 || activeRowTopY > prevRowSwapRages.bottom[0]) &&
          (activeRowIndex === rowsCount - 1 || activeRowBottomY < nextRowSwapRages.top[0])
        )
        : (
          (activeRowIndex === 0 || activeRowTopY > prevRowSwapRages.bottom[1]) &&
          (activeRowIndex === rowsCount - 1 || activeRowBottomY < nextRowSwapRages.top[1])
        )
      )
    ) {
      return {
        rowKey: activeRowKey,
        rowIndex: activeRowIndex,
      };
    }

    if (movingDirection === 1) {
      if (horizontal
        ? inRange(activeRowRightX, ...nextRowSwapRages.left)
        : inRange(activeRowBottomY, ...nextRowSwapRages.top)
      ) {
         return {
          rowKey: nextRowKey,
          rowIndex: nextRowIndex,
        };
      }
    } else {
      if (horizontal
        ? inRange(activeRowLeftX, ...prevRowSwapRages.right)
        : inRange(activeRowTopY, ...prevRowSwapRages.bottom)
      ) {
         return {
          rowKey: prevRowKey,
          rowIndex: prevRowIndex,
        };
      }
    }

//     let startIndex = 0;
//     let endIndex = rowsCount - 1;
//     let middleIndex;
// let it = 0
// console.log(movingDirection);
//     while (startIndex < endIndex) {
//       middleIndex = Math.floor((endIndex - startIndex) / 2);

//       if (it++ > 10) {
//         console.log(startIndex, middleIndex, endIndex);
//         break
//       }
//       const middleRowSwapRanges = rowsSwapRanges[middleIndex];

//       if (horizontal) {
//         if (movingDirection === 1) {
//           if (inRange(activeRowRightX, ...middleRowSwapRanges.left)) break;
//           else if (activeRowRightX < middleRowSwapRanges.left[0]) endIndex = middleIndex;
//           else if (activeRowRightX > middleRowSwapRanges.left[1]) startIndex = middleIndex;
//         } else {
//           if (inRange(activeRowLeftX, ...middleRowSwapRanges.right)) break;
//           else if (activeRowLeftX < middleRowSwapRanges.right[0]) endIndex = middleIndex;
//           else if (activeRowLeftX > middleRowSwapRanges.right[1]) startIndex = middleIndex;
//         }
//       } else {
//         if (movingDirection === 1) {
//           if (inRange(activeRowBottomY, ...middleRowSwapRanges.top)) break;
//           else if (activeRowBottomY < middleRowSwapRanges.top[0]) endIndex = middleIndex;
//           else if (activeRowBottomY > middleRowSwapRanges.top[1]) startIndex = middleIndex;
//         } else {
//           if (inRange(activeRowTopY, ...middleRowSwapRanges.bottom)) break;
//           else if (activeRowTopY < middleRowSwapRanges.bottom[0]) endIndex = middleIndex;
//           else if (activeRowTopY > middleRowSwapRanges.bottom[1]) startIndex = middleIndex;
//         }
//       }
//     }

//     return {rowKey: order[middleIndex], rowIndex: middleIndex};
  }

  _scrollOnMove(e) {
    const {pageX, pageY} = e.nativeEvent;
    const {horizontal} = this.props;
    const {containerLayout} = this.state;
    let inAutoScrollBeginArea = false;
    let inAutoScrollEndArea = false;

    if (horizontal) {
      inAutoScrollBeginArea = pageX < containerLayout.pageX + this.props.autoscrollAreaSize;
      inAutoScrollEndArea = pageX > containerLayout.pageX + containerLayout.width - this.props.autoscrollAreaSize;
    } else {
      inAutoScrollBeginArea = pageY < containerLayout.pageY + this.props.autoscrollAreaSize;
      inAutoScrollEndArea = pageY > containerLayout.pageY + containerLayout.height - this.props.autoscrollAreaSize;
    }

    if (!inAutoScrollBeginArea &&
      !inAutoScrollEndArea &&
      this._autoScrollInterval !== null
    ) {
      this._stopAutoScroll();
    }

    // It should scroll and scrolling is processing.
    if (this._autoScrollInterval !== null) {
      return;
    }

    if (inAutoScrollBeginArea) {
      this._startAutoScroll({
        direction: -1,
        shouldScroll: () => this._contentOffset[horizontal ? 'x' : 'y'] > 0,
        getScrollStep: (stepIndex) => {
          const nextStep = this._getScrollStep(stepIndex);
          const contentOffset = this._contentOffset[horizontal ? 'x' : 'y'];

          return contentOffset - nextStep < 0 ? contentOffset : nextStep;
        },
      });
    } else if (inAutoScrollEndArea) {
      this._startAutoScroll({
        direction: 1,
        shouldScroll: () => {
          const {
            contentHeight,
            contentWidth,
            containerLayout,
            footerLayout = {height: 0},
          } = this.state;

          if (horizontal) {
            return this._contentOffset.x < contentWidth - containerLayout.width
          } else {
            return this._contentOffset.y < contentHeight + footerLayout.height - containerLayout.height;
          }
        },
        getScrollStep: (stepIndex) => {
          const nextStep = this._getScrollStep(stepIndex);
          const {
            contentHeight,
            contentWidth,
            containerLayout,
            footerLayout = {height: 0},
          } = this.state;

          if (horizontal) {
            return this._contentOffset.x + nextStep > contentWidth - containerLayout.width
              ? contentWidth - containerLayout.width - this._contentOffset.x
              : nextStep;
          } else {
            const scrollHeight = contentHeight + footerLayout.height - containerLayout.height;

            return this._contentOffset.y + nextStep > scrollHeight
              ? scrollHeight - this._contentOffset.y
              : nextStep;
          }
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
    const {horizontal} = this.props;
    let counter = 0;

    this._autoScrollInterval = setInterval(() => {
      if (shouldScroll()) {
        const movement = {
          [horizontal ? 'dx' : 'dy']: direction * getScrollStep(counter++),
        };

        this.scrollBy(movement);
        this._rows[activeRowKey].moveBy(movement);
      } else {
        this._stopAutoScroll();
      }
    }, AUTOSCROLL_INTERVAL);
  }

  _stopAutoScroll() {
    clearInterval(this._autoScrollInterval);
    this._autoScrollInterval = null;
  }

  _onLayoutRow(rowKey, {nativeEvent: {layout}}) {
    this._resolveRowLayout[rowKey]({rowKey, layout});
  }

  _onLayoutHeader = ({nativeEvent: {layout}}) => {
    this._resolveHeaderLayout(layout);
  };

  _onLayoutFooter = ({nativeEvent: {layout}}) => {
    this._resolveFooterLayout(layout);
  };

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

  _onPressRow = (rowKey) => {
    if (this.props.onPressRow) {
      this.props.onPressRow(rowKey);
    }
  };

  _onReleaseRow = (rowKey) => {
    this._stopAutoScroll();
    this.setState(({activeRowKey}) => ({
      activeRowKey: null,
      activeRowIndex: null,
      releasedRowKey: activeRowKey,
      scrollEnabled: this.props.scrollEnabled,
    }));

    if (this.props.onReleaseRow) {
      this.props.onReleaseRow(rowKey);
    }
  };

  _onMoveRow = (e, gestureState, location) => {
    const prevMovingRowX = this._activeRowLocation.x;
    const prevMovingRowY = this._activeRowLocation.y;
    const prevMovingDirection = this._movingDirection;

    this._activeRowLocation = location;
    this._movingDirection = (
      this.props.horizontal
      ? prevMovingRowX <= this._activeRowLocation.x
      : prevMovingRowY <= this._activeRowLocation.y
    ) ? 1 : -1;

    this._movingDirectionChanged = prevMovingDirection !== this._movingDirection;
    this._setOrderOnMove();

    if (this.props.scrollEnabled) {
      this._scrollOnMove(e);
    }
  };

  _onScroll = ({nativeEvent: {contentOffset}}) => {
      this._contentOffset = contentOffset;
  };

  _onRefContainer = (component) => {
    this._container = component;
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

  rowsContainer: {
    flex: 1,
    zIndex: 1,
  },
});
