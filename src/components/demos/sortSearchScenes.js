// Frame data for the "Sorting and searching" walk-through (array stage).
// A frame is { note, rows: [{ label, cells, pointers }] }. A cell is a value or { v, tone }.
// tone: none | ok | bad | warn | new | dim. A pointer is { name, at, tone }.

// build cells from values and an object of index -> tone, or a function (index) -> tone
const cells = (vals, tones = {}) =>
  vals.map((v, i) => ({ v, tone: typeof tones === 'function' ? tones(i) : tones[i] }));
const range = (from, to, tone) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, tone]));
const row = (label, vals, tones, pointers) => ({ label, cells: cells(vals, tones), pointers });

const SORTED = [3, 8, 15, 21, 34, 47, 60, 72, 88];

export const SORT_SEARCH_SCENES = [
  {
    id: 'binary',
    label: 'Binary search',
    title: 'Binary search halves the range every step',
    frames: [
      {
        note: 'Binary search needs a sorted array. We look for 47 among nine values. Linear search would check them one by one, up to nine steps; binary search needs at most four, and about 20 for a million items.',
        rows: [row('target = 47', SORTED, {}, [])],
      },
      {
        note: 'Keep a range from lo to hi and look at the middle element, here 34. It is smaller than 47, so 47 cannot be in the left half or at the middle. Everything from lo up to mid is ruled out in one comparison.',
        rows: [row('sorted array', SORTED, { 4: 'warn' }, [{ name: 'lo', at: 0 }, { name: 'mid', at: 4, tone: 'warn' }, { name: 'hi', at: 8 }])],
      },
      {
        note: 'Move lo to mid + 1. The range is now positions 5 to 8, and the new middle is 60. It is larger than 47, so 47 cannot be at the middle or to its right: move hi to mid - 1.',
        rows: [row('sorted array', SORTED, { ...range(0, 4, 'dim'), 6: 'warn' }, [{ name: 'lo', at: 5 }, { name: 'mid', at: 6, tone: 'warn' }, { name: 'hi', at: 8 }])],
      },
      {
        note: 'The range is now one element, position 5. The middle is 47, which equals the target, so the search returns index 5. Three comparisons for nine items.',
        rows: [row('sorted array', SORTED, { ...range(0, 4, 'dim'), ...range(6, 8, 'dim'), 5: 'ok' }, [{ name: 'lo, hi, mid', at: 5, tone: 'ok' }])],
      },
    ],
  },
  {
    id: 'missing',
    label: 'Value not found',
    title: 'When lo passes hi, the value is not there',
    frames: [
      {
        note: 'Now search for 50, which is not in the array. The loop runs while lo is not greater than hi. The first middle is 34, smaller than 50, so lo moves to 5.',
        rows: [row('target = 50', SORTED, { 4: 'warn' }, [{ name: 'lo', at: 0 }, { name: 'mid', at: 4, tone: 'warn' }, { name: 'hi', at: 8 }])],
      },
      {
        note: 'The middle of positions 5 to 8 is 60. It is larger than 50, so hi moves to 5.',
        rows: [row('target = 50', SORTED, { ...range(0, 4, 'dim'), 6: 'warn' }, [{ name: 'lo', at: 5 }, { name: 'mid', at: 6, tone: 'warn' }, { name: 'hi', at: 8 }])],
      },
      {
        note: 'With lo and hi both at 5 the middle is 47, smaller than 50, so lo moves to 6. Now lo is greater than hi, the range is empty and the search reports not found, for example by returning -1.',
        rows: [row('target = 50', SORTED, { ...range(0, 4, 'dim'), ...range(6, 8, 'dim'), 5: 'bad' }, [{ name: 'lo', at: 6, tone: 'bad' }, { name: 'hi', at: 5, tone: 'bad' }])],
      },
    ],
  },
  {
    id: 'insertion',
    label: 'Insertion sort',
    title: 'Insertion sort grows a sorted part one element at a time',
    frames: [
      {
        note: 'Insertion sort keeps the left part sorted. At the start the sorted part is just the first element, 7. The next element, called the key, is 3.',
        rows: [row('unsorted', [7, 3, 9, 2, 5], { 0: 'ok', 1: 'new' }, [{ name: 'key', at: 1, tone: 'warn' }])],
      },
      {
        note: 'Compare the key with the sorted part from the right. 7 is larger, so it moves one step to the right and the key goes in front of it. The sorted part is now 3, 7. The next key is 9, and it is larger than 7, so it stays where it is.',
        rows: [row('after 3 and 9', [3, 7, 9, 2, 5], { ...range(0, 2, 'ok'), 3: 'new' }, [{ name: 'key', at: 3, tone: 'warn' }])],
      },
      {
        note: 'The key 2 is smaller than 9, 7 and 3, so each of them shifts one place to the right and 2 is placed at the front. The sorted part is 2, 3, 7, 9. The last key is 5.',
        rows: [row('after inserting 2', [2, 3, 7, 9, 5], { ...range(0, 3, 'ok'), 4: 'new' }, [{ name: 'key', at: 4, tone: 'warn' }])],
      },
      {
        note: 'The key 5 shifts 9 and 7 right and lands after 3. The array is sorted. Insertion sort takes about n squared steps in the worst case, but only about n for an almost sorted array, which is why it is used for small or nearly sorted data inside real sort routines.',
        rows: [row('sorted', [2, 3, 5, 7, 9], range(0, 4, 'ok'), [])],
      },
    ],
  },
  {
    id: 'merge',
    label: 'Merge sort',
    title: 'Merge sort splits, sorts the halves, then merges',
    frames: [
      {
        note: 'Merge sort is divide and conquer. We sort this array of seven numbers by splitting it in half, sorting each half the same way, and merging the two sorted halves.',
        rows: [row('unsorted', [38, 27, 43, 3, 9, 82, 10], {}, [])],
      },
      {
        note: 'Split in the middle: the left half is 38, 27, 43, 3 and the right half is 9, 82, 10. Each half is split again and again until the pieces have one element, which is already sorted.',
        rows: [row('split', [38, 27, 43, 3, 9, 82, 10], (i) => (i < 4 ? 'new' : 'warn'), [])],
      },
      {
        note: 'Going back up, each half has been sorted by the same steps. Now we have two sorted lists that only need to be merged.',
        rows: [row('left, sorted', [3, 27, 38, 43], { 0: 'new', 1: 'new', 2: 'new', 3: 'new' }, []), row('right, sorted', [9, 10, 82], { 0: 'warn', 1: 'warn', 2: 'warn' }, [])],
      },
      {
        note: 'Merge: compare the first unused element of each list and take the smaller one. 3 is smaller than 9, so 3 goes into the result. Each element is looked at once, so merging n elements takes n steps.',
        rows: [
          row('left', [3, 27, 38, 43], { 0: 'dim' }, [{ name: 'i', at: 1 }]),
          row('right', [9, 10, 82], {}, [{ name: 'j', at: 0 }]),
          row('result', [3, '', '', '', '', '', ''], { 0: 'ok' }, []),
        ],
      },
      {
        note: 'Next 9 is smaller than 27, then 10 is smaller than 27. The result is 3, 9, 10 so far. Now we compare 27 with 82, and 27 is smaller.',
        rows: [
          row('left', [3, 27, 38, 43], { 0: 'dim' }, [{ name: 'i', at: 1 }]),
          row('right', [9, 10, 82], { 0: 'dim', 1: 'dim' }, [{ name: 'j', at: 2 }]),
          row('result', [3, 9, 10, '', '', '', ''], { 0: 'ok', 1: 'ok', 2: 'ok' }, []),
        ],
      },
      {
        note: 'The rest of the left list (27, 38, 43) is smaller than 82, so it is taken in turn, and then 82 is copied. The merge is finished. Splitting gives log n levels, and each level does n work, so merge sort is O(n log n) in every case, but it needs extra memory for the merged result.',
        rows: [row('sorted', [3, 9, 10, 27, 38, 43, 82], range(0, 6, 'ok'), [])],
      },
    ],
  },
  {
    id: 'quick',
    label: 'Quicksort',
    title: 'Quicksort puts one pivot in its final place, then repeats',
    frames: [
      {
        note: 'Quicksort picks a pivot, here the last element 5, and rearranges the array so that everything smaller is on its left and everything larger on its right. A pointer s marks where the next smaller element will go, and j scans the array.',
        rows: [row('pivot = 5', [8, 3, 7, 1, 5], { 4: 'warn' }, [{ name: 's, j', at: 0 }])],
      },
      {
        note: 'j moves forward. 8 is not smaller than 5, so nothing happens and only j moves. At 3, which is smaller than 5, we swap it with the element at s (8) and move s forward by one. The area left of s holds the smaller elements.',
        rows: [row('pivot = 5', [3, 8, 7, 1, 5], { 0: 'ok', 4: 'warn' }, [{ name: 's', at: 1 }, { name: 'j', at: 1 }])],
      },
      {
        note: '7 is not smaller, so we skip it. 1 is smaller than 5, so it swaps with the element at s (8), and s moves forward again. The small side is now 3, 1.',
        rows: [row('pivot = 5', [3, 1, 7, 8, 5], { 0: 'ok', 1: 'ok', 4: 'warn' }, [{ name: 's', at: 2 }, { name: 'j', at: 3 }])],
      },
      {
        note: 'j has reached the pivot. Swap the pivot with the element at s. Now 5 is in its final sorted position: everything on its left is smaller and everything on its right is larger.',
        rows: [row('partitioned', [3, 1, 5, 8, 7], { 0: 'new', 1: 'new', 2: 'ok', 3: 'warn', 4: 'warn' }, [{ name: 'pivot', at: 2, tone: 'ok' }])],
      },
      {
        note: 'Repeat for the left part (3, 1) and the right part (8, 7) separately. Good pivots split the array in half, giving O(n log n) on average. A bad pivot, such as always the smallest on already sorted data, gives O(n squared), which is why real implementations pick the pivot randomly or by the median of three.',
        rows: [row('left part', [3, 1], { 0: 'new', 1: 'new' }, []), row('right part', [8, 7], { 0: 'warn', 1: 'warn' }, [])],
      },
    ],
  },
];
