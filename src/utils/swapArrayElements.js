export default function swapArrayElements(array, indexA, indexB) {
  if (indexA === indexB) {
    return array;
  }

  if (indexA > indexB) {
    [indexA, indexB] = [indexB, indexA];
  }

  return [
    ...array.slice(0, indexA),
    array[indexB],
    ...array.slice(indexA + 1, indexB),
    array[indexA],
    ...array.slice(indexB + 1),
  ];
}
