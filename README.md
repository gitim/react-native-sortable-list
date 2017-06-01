## Sortable list view for react-native

### Content
- [Demo](#demo)
- [Installation](#installation)
- [Examples](#examples)
- [API](#api)
- [Questions?](#questions)

### Demo
<a href="https://raw.githubusercontent.com/gitim/react-native-sortable-list/master/demo.gif"><img src="https://raw.githubusercontent.com/gitim/react-native-sortable-list/master/demo.gif"></a>

### Installation
```bash
npm i react-native-sortable-list --save
```

### Examples
- [Basic](https://github.com/gitim/react-native-sortable-list/tree/master/examples/Basic)
- [Horizontal](https://github.com/gitim/react-native-sortable-list/tree/master/examples/Horizontal)


### API
#### Props
- **data** (Object) data source
- **order?** (Array) an array of keys from data, the order of keys from the array will be used to initial rows order
- **style?** (Object, Array)
- **contentContainerStyle?** (Object, Array) these styles will be applied to the inner scroll view content container
- **horizontal?** (boolean) when true, the SortableList's children are arranged horizontally in a row instead of vertically in a column. The default value is false.
- **sortingEnabled?** (boolean) when false, rows are not sortable. The default value is true.
- **scrollEnabled?** (boolean) when false, the content does not scrollable. The default value is true.
- **autoscrollAreaSize?** (number) determines the height for vertical list and the width for horizontal list of the area at the begining and the end of the list that will trigger autoscrolling. Defaults to 60.<br />
- **rowActivationTime?** (number) determines time delay in ms before pressed row becomes active. Defaults to 200 ms.<br />
- **refreshControl?** (element)<br />
A RefreshControl that works the same way as a ScrollView's refreshControl.
- **renderRow** (function)<br />
`({key, index, data, disabled, active}) => renderable`<br />
Takes a row key, row index, data entry from the data source and its statuses disabled, active and should return a renderable component to be rendered as the row.<br />
- **renderFooter?** (function)<br />
`() => renderable`<br />
Renders returned component at the bottom of the list.
- **onChangeOrder?** (function)<br />
`(nextOrder) => void`<br />
Called when rows were reordered, takes an array of rows keys of the next rows order.
- **onActivateRow?** (function)<br />
`(key) => void`<br />
Called when a row was activated (user long tapped).
- **onReleaseRow?** (function)<br />
`(key) => void`<br />
Called when the active row was released.
- **onPressRow?** (function)<br />
`(key) => void`<br />
Called when a row was pressed.

#### Methods
- **scrollBy(dy?, animated?)** scrolls by a given y offset, either immediately or with a smooth animation
- **scrollTo(y?, animated?)** scrolls to a given y offset, either immediately or with a smooth animation
- **scrollToRowKey(key, animated?)** scrolls to a given row key, either immediately or with a smooth animation

### Questions?
Feel free to contact me via
- [Twitter](https://twitter.com/_gitim)

If you find a bug, please [submit an issue](https://github.com/gitim/react-native-sortable-list/issues/new)
