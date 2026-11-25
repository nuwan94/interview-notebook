// Frame data for the "Sorting and searching" walk-through (array stage).
// A frame is { line, result, note, rows: [{ label, cells, pointers, spans, breaks }] }. A cell is a value or { v, tone }.
// tone: none | ok | bad | warn | new | dim. A pointer is { name, at, tone }. A span is a bracket { name, from, to, tone }.
// breaks lists the indexes where a new group starts (drawn with a gap).

// build cells from values and an object of index -> tone, or a function (index) -> tone
const cells = (vals, tones = {}) =>
  vals.map((v, i) => ({ v, tone: typeof tones === 'function' ? tones(i) : tones[i] }));
const range = (from, to, tone) => Object.fromEntries(Array.from({ length: to - from + 1 }, (_, k) => [from + k, tone]));
const row = (label, vals, tones, pointers, extra = {}) => ({ label, cells: cells(vals, tones), pointers, ...extra });
const span = (name, from, to, tone) => ({ name, from, to, tone });

const SORTED = [3, 8, 15, 21, 34, 47, 60, 72, 88];
const MERGE = [38, 27, 43, 3, 9, 82, 10];
const halves = (i) => (i < 4 ? 'new' : 'warn');

export const SORT_SEARCH_SCENES = [
  {
    id: 'binary',
    label: 'Binary search',
    title: 'Binary search halves the range every step',
    frames: [
      {
        line: 'binarySearch(a, 47)',
        note: 'Binary search needs a sorted array. We look for 47 among nine values. A linear search would check them one by one, up to nine steps. Binary search needs at most four, and about 20 for a million items.',
        rows: [row('sorted array, target = 47', SORTED, {}, [], { spans: [span('search range', 0, 8)] })],
      },
      {
        line: 'mid = lo + (hi - lo) / 2;  // 4',
        result: { text: '34 < 47: go right', tone: 'warn' },
        note: 'Keep a range from lo to hi, and look at the middle element, 34. It is smaller than 47. So 47 cannot be at the middle or to its left, because the array is sorted. One comparison rules out five values.',
        rows: [row('sorted array, target = 47', SORTED, { 4: 'warn' }, [{ name: 'lo', at: 0 }, { name: 'mid', at: 4, tone: 'warn' }, { name: 'hi', at: 8 }], { spans: [span('search range', 0, 8)] })],
      },
      {
        line: 'lo = mid + 1;  // 5, new mid = 6',
        result: { text: '60 > 47: go left', tone: 'warn' },
        note: 'Move lo to mid + 1. The range is now positions 5 to 8, and the new middle is 60. It is larger than 47, so 47 cannot be at the middle or to its right. Next, hi moves to mid - 1.',
        rows: [row('sorted array, target = 47', SORTED, { ...range(0, 4, 'dim'), 6: 'warn' }, [{ name: 'lo', at: 5 }, { name: 'mid', at: 6, tone: 'warn' }, { name: 'hi', at: 8 }], { spans: [span('search range', 5, 8)] })],
      },
      {
        line: 'hi = mid - 1;  // 5, new mid = 5',
        result: { text: 'found at index 5', tone: 'ok' },
        note: 'The range is now one element, position 5. The middle is 47, which equals the target, so the search returns index 5. It took three comparisons for nine items.',
        rows: [row('sorted array, target = 47', SORTED, { ...range(0, 4, 'dim'), ...range(6, 8, 'dim'), 5: 'ok' }, [{ name: 'lo, hi, mid', at: 5, tone: 'ok' }], { spans: [span('range', 5, 5, 'ok')] })],
      },
    ],
  },
  {
    id: 'missing',
    label: 'Value not found',
    title: 'When lo passes hi, the value is not there',
    frames: [
      {
        line: 'mid = 4;  // a[4] = 34',
        result: { text: '34 < 50: go right', tone: 'warn' },
        note: 'Now search for 50, which is not in the array. The loop runs while lo is not greater than hi. The first middle is 34. It is smaller than 50, so lo moves to 5.',
        rows: [row('sorted array, target = 50', SORTED, { 4: 'warn' }, [{ name: 'lo', at: 0 }, { name: 'mid', at: 4, tone: 'warn' }, { name: 'hi', at: 8 }], { spans: [span('search range', 0, 8)] })],
      },
      {
        line: 'mid = 6;  // a[6] = 60',
        result: { text: '60 > 50: go left', tone: 'warn' },
        note: 'The middle of positions 5 to 8 is 60. It is larger than 50, so hi moves to 5.',
        rows: [row('sorted array, target = 50', SORTED, { ...range(0, 4, 'dim'), 6: 'warn' }, [{ name: 'lo', at: 5 }, { name: 'mid', at: 6, tone: 'warn' }, { name: 'hi', at: 8 }], { spans: [span('search range', 5, 8)] })],
      },
      {
        line: 'while (lo <= hi)  // 6 <= 5 is false',
        result: { text: 'not found: return -1', tone: 'bad' },
        note: 'With lo and hi both at 5, the middle is 47. It is smaller than 50, so lo moves to 6. Now lo is greater than hi, so the range is empty. The search reports "not found", for example by returning -1.',
        rows: [row('sorted array, target = 50', SORTED, { ...range(0, 4, 'dim'), ...range(6, 8, 'dim'), 5: 'bad' }, [{ name: 'lo', at: 6, tone: 'bad' }, { name: 'hi', at: 5, tone: 'bad' }])],
      },
    ],
  },
  {
    id: 'insertion',
    label: 'Insertion sort',
    title: 'Insertion sort grows a sorted part one element at a time',
    frames: [
      {
        line: 'int key = a[1];  // 3',
        note: 'Insertion sort keeps the left part of the array sorted. At the start, the sorted part is just the first element, 7. The next element, called the key, is 3.',
        rows: [row('array', [7, 3, 9, 2, 5], { 0: 'ok', 1: 'new' }, [{ name: 'key', at: 1, tone: 'warn' }], { spans: [span('sorted part', 0, 0, 'ok')] })],
      },
      {
        line: 'while (j >= 0 && a[j] > key) a[j + 1] = a[j--];',
        result: { text: '3 inserted, 9 stays', tone: 'ok' },
        note: 'Compare the key with the sorted part, from the right. 7 is larger, so 7 moves one place to the right and 3 goes in front of it. The sorted part is now 3, 7. The next key, 9, is larger than 7, so it stays where it is.',
        rows: [row('array', [3, 7, 9, 2, 5], { ...range(0, 2, 'ok'), 3: 'new' }, [{ name: 'key', at: 3, tone: 'warn' }], { spans: [span('sorted part', 0, 2, 'ok')] })],
      },
      {
        line: 'while (j >= 0 && a[j] > key) a[j + 1] = a[j--];',
        result: { text: '9, 7 and 3 each shift right', tone: 'warn' },
        note: 'The key 2 is smaller than 9, 7 and 3. Each of them shifts one place to the right, and 2 goes to the front. The sorted part is 2, 3, 7, 9. The last key is 5.',
        rows: [row('array', [2, 3, 7, 9, 5], { ...range(0, 3, 'ok'), 4: 'new' }, [{ name: 'key', at: 4, tone: 'warn' }], { spans: [span('sorted part', 0, 3, 'ok')] })],
      },
      {
        line: 'a[j + 1] = key;  // 5 lands after 3',
        result: { text: 'sorted', tone: 'ok' },
        note: 'The key 5 shifts 9 and 7 to the right and lands after 3. The array is sorted. Insertion sort takes about n² steps in the worst case, but only about n for an array that is almost sorted. That is why real sort routines use it for small or nearly sorted data.',
        rows: [row('array', [2, 3, 5, 7, 9], range(0, 4, 'ok'), [], { spans: [span('sorted part', 0, 4, 'ok')] })],
      },
    ],
  },
  {
    id: 'merge',
    label: 'Merge sort',
    title: 'Merge sort splits, sorts the halves, then merges',
    frames: [
      {
        line: 'mergeSort(a)',
        note: 'Merge sort is a divide and conquer algorithm. To sort these seven numbers, it splits the array in half, sorts each half the same way, and merges the two sorted halves.',
        rows: [row('unsorted', MERGE, {}, [])],
      },
      {
        line: 'int mid = a.length / 2;  // split again and again',
        note: 'Split in the middle. The left half is 38, 27, 43, 3, and the right half is 9, 82, 10. Each half is split again, until every piece has one element. A single element is already sorted. There are about log n levels of splitting.',
        rows: [
          row('level 1: two halves', MERGE, halves, [], { breaks: [4], index: false }),
          row('level 2: four pieces', MERGE, halves, [], { breaks: [2, 4, 6], index: false }),
          row('level 3: single elements', MERGE, halves, [], { breaks: [1, 2, 3, 4, 5, 6], index: false }),
        ],
      },
      {
        line: 'return merge(left, right);  // on the way back up',
        note: 'On the way back up, neighbouring pieces are merged into sorted pieces: pairs first, then the halves. The last step merges two sorted lists, 3, 27, 38, 43 and 9, 10, 82.',
        rows: [
          row('pairs merged', [27, 38, 3, 43, 9, 82, 10], halves, [], { breaks: [2, 4, 6], index: false }),
          row('halves merged', [3, 27, 38, 43, 9, 10, 82], halves, [], { breaks: [4], index: false }),
        ],
      },
      {
        line: 'result[k++] = left[i] <= right[j] ? left[i++] : right[j++];',
        result: { text: '3 < 9: take 3', tone: 'ok' },
        note: 'To merge, compare the first unused element of each list and take the smaller one. 3 is smaller than 9, so 3 goes into the result. Each element is looked at once, so merging n elements takes n steps.',
        rows: [
          row('left', [3, 27, 38, 43], { 0: 'dim' }, [{ name: 'i', at: 1 }]),
          row('right', [9, 10, 82], {}, [{ name: 'j', at: 0 }]),
          row('result', [3, '', '', '', '', '', ''], { 0: 'ok' }, []),
        ],
      },
      {
        line: 'result[k++] = left[i] <= right[j] ? left[i++] : right[j++];',
        result: { text: 'took 9, then 10', tone: 'ok' },
        note: 'Next, 9 is smaller than 27, and then 10 is smaller than 27. The result so far is 3, 9, 10. Now we compare 27 with 82, and 27 is smaller.',
        rows: [
          row('left', [3, 27, 38, 43], { 0: 'dim' }, [{ name: 'i', at: 1 }]),
          row('right', [9, 10, 82], { 0: 'dim', 1: 'dim' }, [{ name: 'j', at: 2 }]),
          row('result', [3, 9, 10, '', '', '', ''], { 0: 'ok', 1: 'ok', 2: 'ok' }, []),
        ],
      },
      {
        line: 'while (j < right.length) result[k++] = right[j++];',
        result: { text: 'sorted: O(n log n)', tone: 'ok' },
        note: 'The rest of the left list (27, 38, 43) is smaller than 82, so it is taken in turn. Then 82 is copied. The merge is finished. There are log n levels, and each level does n work, so merge sort is O(n log n) in every case. It needs extra memory for the merged result.',
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
        line: 'int pivot = a[hi];  // 5',
        note: 'Quicksort picks a pivot, here the last element, 5. It rearranges the array so that everything smaller is on the left of the pivot and everything larger is on its right. A pointer s marks where the next smaller element goes, and j scans the array.',
        rows: [row('pivot = 5', [8, 3, 7, 1, 5], { 4: 'warn' }, [{ name: 's, j', at: 0 }])],
      },
      {
        line: 'if (a[j] < pivot) swap(a, s++, j);',
        result: { text: '3 < 5: swap it to the left', tone: 'ok' },
        note: 'j moves forward. 8 is not smaller than 5, so only j moves. 3 is smaller than 5, so it swaps with the element at s (8), and s moves forward by one. Everything left of s is smaller than the pivot.',
        rows: [row('pivot = 5', [3, 8, 7, 1, 5], { 0: 'ok', 4: 'warn' }, [{ name: 's', at: 1 }, { name: 'j', at: 1 }], { spans: [span('smaller', 0, 0, 'ok')] })],
      },
      {
        line: 'if (a[j] < pivot) swap(a, s++, j);',
        result: { text: '1 < 5: swap it to the left', tone: 'ok' },
        note: '7 is not smaller, so it is skipped. 1 is smaller than 5, so it swaps with the element at s (8), and s moves forward again. The smaller side is now 3, 1.',
        rows: [row('pivot = 5', [3, 1, 7, 8, 5], { 0: 'ok', 1: 'ok', 4: 'warn' }, [{ name: 's', at: 2 }, { name: 'j', at: 3 }], { spans: [span('smaller', 0, 1, 'ok')] })],
      },
      {
        line: 'swap(a, s, hi);',
        result: { text: '5 is in its final place', tone: 'ok' },
        note: 'j has reached the pivot. Swap the pivot with the element at s. Now 5 is in its final sorted position: everything on its left is smaller and everything on its right is larger.',
        rows: [row('partitioned', [3, 1, 5, 8, 7], { 0: 'new', 1: 'new', 2: 'ok', 3: 'warn', 4: 'warn' }, [{ name: 'pivot', at: 2, tone: 'ok' }], { spans: [span('smaller', 0, 1), span('larger', 3, 4, 'warn')] })],
      },
      {
        line: 'quickSort(a, lo, p - 1);  quickSort(a, p + 1, hi);',
        result: { text: 'average O(n log n), worst O(n²)', tone: 'warn' },
        note: 'Repeat for the left part (3, 1) and the right part (8, 7), separately. Good pivots split the array in half, which gives O(n log n) on average. A bad pivot, such as always the smallest value of already sorted data, gives O(n²). That is why real implementations pick the pivot at random or by the median of three.',
        rows: [row('left part', [3, 1], { 0: 'new', 1: 'new' }, []), row('right part', [8, 7], { 0: 'warn', 1: 'warn' }, [])],
      },
    ],
  },
];
