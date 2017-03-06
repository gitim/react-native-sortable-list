/**
 * Sample React Native App
 * httpss://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  Animated,
  Easing,
  AppRegistry,
  StyleSheet,
  Text,
  Image,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import SortableList from 'react-native-sortable-list';

const window = Dimensions.get('window');


const data = {
  0: {
    image: 'https://placekitten.com/200/240',
    text: 'Chloe',
  },
  1: {
    image: 'https://placekitten.com/200/201',
    text: 'Jasper',
  },
  2: {
    image: 'https://placekitten.com/200/202',
    text: 'Pepper',
  },
  3: {
    image: 'https://placekitten.com/200/203',
    text: 'Oscar',
  },
  4: {
    image: 'https://placekitten.com/200/204',
    text: 'Dusty',
  },
  5: {
    image: 'https://placekitten.com/200/205',
    text: 'Spooky',
  },
  6: {
    image: 'https://placekitten.com/200/210',
    text: 'Kiki',
  },
  7: {
    image: 'https://placekitten.com/200/215',
    text: 'Smokey',
  },
  8: {
    image: 'https://placekitten.com/200/220',
    text: 'Gizmo',
  },
  9: {
    image: 'https://placekitten.com/220/239',
    text: 'Kitty',
  },
};

class Basic extends Component {
  render() {
    return (
      <View style={styles.container}>
        <SortableList
          style={styles.list}
          contentContainerStyle={styles.contentContainer}
          data={data}
          renderRow={this._renderRow} />
      </View>
    );
  }

  _renderRow = ({data, active}) => {
    return <Row data={data} active={active} />
  }
}

class Row extends Component {

  constructor(props) {
    super(props);

    this._active = new Animated.Value(0);
    this._style = Platform.OS === 'ios'
      ? {
        shadowRadius: this._active.interpolate({
          inputRange: [0, 1],
          outputRange: [2, 10],
        }),
        transform: [{
          scale: this._active.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.1],
          }),
        }],
      }
      : {
        backgroundColor: this._active.interpolate({
          inputRange: [0, 1],
          outputRange: ['#fff', '#e9e9e9'],
        }),
      };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.active !== nextProps.active) {
      Animated.timing(this._active, {
        duration: 100,
        easing: Easing.out(Easing.quad),
        toValue: Number(nextProps.active),
      }).start();
    }
  }

  render() {
   const {data, active} = this.props;

    return (
      <Animated.View style={[
        styles.row,
        this._style,
      ]}>
        <Image source={{uri: data.image}} style={styles.image} />
        <Text style={styles.text}>{data.text}</Text>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',

    ...Platform.select({
      ios: {
        backgroundColor: '#eee',
        paddingTop: 60,
      },

      android: {
        backgroundColor: '#fff',
        paddingTop: 0,
      },
    }),
  },

  list: {
    flex: 1,
  },

  contentContainer: {
    width: window.width,
    paddingHorizontal: Platform.OS === 'ios' ? 30 : 0,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,

    height: 80,

    ...Platform.select({
      ios: {
        width: window.width - 30 * 2,
        marginVertical: 5,
        borderRadius: 4,
        shadowColor: 'rgba(0,0,0,0.2)',
        shadowOpacity: 1,
        shadowOffset: {height: 2, width: 2},
        shadowRadius: 2,
      },

      android: {
        width: window.width,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: '#e5e5e5',
      },
    })
  },

  image: {
    width: 50,
    height: 50,
    marginRight: 30,
    borderRadius: 25,
  },

  text: {
    fontSize: 24,
  },
});

AppRegistry.registerComponent('Basic', () => Basic);
