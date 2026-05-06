import React from 'react';
import { FlatList, View, StyleSheet, ViewStyle } from 'react-native';

export interface ListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  keyExtractor?: (item: T, index: number) => string;
  onEndReached?: () => void;
  style?: ViewStyle;
}

export const List = React.forwardRef<FlatList<any>, ListProps<any>>(
  ({ data, renderItem, keyExtractor, onEndReached, style }, ref) => {
    return (
      <FlatList
        ref={ref}
        data={data}
        renderItem={({ item, index }) => renderItem(item, index)}
        keyExtractor={keyExtractor || ((_, index) => index.toString())}
        onEndReached={onEndReached}
        style={[styles.list, style]}
      />
    );
  },
);

List.displayName = 'List';

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
});
