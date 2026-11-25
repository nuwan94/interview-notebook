---
title: Sorting and searching — binary search, merge sort, quicksort and what Java uses
nav: Sorting and searching
slug: sorting-searching
summary: Searching and sorting for interviews: linear and binary search, binary search pitfalls and variants, the main sorting algorithms and their complexity, stability and in-place sorting, divide and conquer, quickselect and top-k with heaps, and how Java sorts (Arrays.sort, TimSort, Comparator), with Java code and interview questions.
tags: [Algorithms, Sorting, Searching, Binary search, Merge sort, Quicksort, Complexity, Java]
order: 5
topic: Fundamentals / Data structures and algorithms
updated: 2026-11-24
subnav: true
---

Sorting and searching are the first algorithms most interviewers ask about. Typical questions:

- Write a binary search.
- Why is merge sort O(n log n)?
- Which sorts are stable?
- What does Java's `Arrays.sort` use?
- How do you find the k-th largest number without sorting everything?

This lesson explains the ideas, shows them step by step and gives the Java code.

Related lessons: it builds on [data structures and Big-O](lesson:data-structures) and leads into [coding patterns](lesson:coding-patterns). The Java details link to the [collections](lesson:java-collections), [HashMap](lesson:java-hashmap) and [streams](lesson:java-streams) lessons.

The animation has five scenes: binary search, a search that finds nothing, insertion sort, merge sort and quicksort.

```demo
name: sort-search-walk
```

> **One sentence to remember:** *Binary search halves sorted data each step, and in Java you call the library sort and write a correct `Comparator`.*

## Searching {#searching}

**Linear search** checks the items one by one. It is O(n), works on any data and needs no preparation.

**Binary search** works on a **sorted** array. It compares the target with the middle element and throws away the half that cannot contain it. Each step halves the range, so it needs O(log n) comparisons: about 20 for a million items and 30 for a billion.

The price: the data must be sorted, and you must be able to jump straight to the middle. An array allows that. A linked list does not.

```java
static int binarySearch(int[] a, int target) {
    int lo = 0, hi = a.length - 1;
    while (lo <= hi) {                       // an empty range ends the loop
        int mid = lo + (hi - lo) / 2;        // not (lo + hi) / 2: that can overflow for large arrays
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;   // the target is to the right
        else hi = mid - 1;                   // the target is to the left
    }
    return -1;                               // not found
}
```

Common mistakes, which are also the usual follow-up questions:

- **Off-by-one errors.** Use `lo <= hi` together with `mid + 1` and `mid - 1`. Or use `lo < hi` together with `hi = mid`. Pick one style and do not mix them.
- **Integer overflow.** `(lo + hi) / 2` can overflow when both numbers are large. Write `lo + (hi - lo) / 2`, or `(lo + hi) >>> 1`.
- **Duplicates.** To find the *first* or *last* occurrence, keep searching after a match. For example, set `hi = mid - 1` to keep going left.
- **Library behaviour.** `Arrays.binarySearch` and `Collections.binarySearch` return the index when they find the value. Otherwise they return `-(insertion point) - 1`, so a negative result also tells you where the value would go. The array must be sorted first, or the result is undefined.

**Binary search is not only for arrays.** You can use it whenever a yes-or-no question switches from "no" to "yes" at exactly one point. Such a question is called **monotonic**. You then binary search for the answer itself. Examples:

- The smallest truck capacity that ships all packages in D days.
- The first bad version of a release.
- The square root of a number, to a given precision.

Other variants: searching a **rotated sorted array** (find which half is sorted, then decide where the target can be), and finding a **peak** element.

## Sorting overview {#sorting}

| Algorithm | Best | Average | Worst | Extra space | Stable | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Bubble sort | O(n) | O(n²) | O(n²) | O(1) | Yes | Used only for teaching. |
| Selection sort | O(n²) | O(n²) | O(n²) | O(1) | No | Makes few swaps. |
| **Insertion sort** | O(n) | O(n²) | O(n²) | O(1) | Yes | Fast for small or nearly sorted data. |
| **Merge sort** | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | Predictable. Good for linked lists and for data on disk. |
| **Quicksort** | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Fastest in practice. Sorts in place. |
| Heap sort | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Guaranteed worst case. Sorts in place. |
| Counting sort, radix sort | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes | They do not compare elements. They suit integers in a small range. |

Two facts to know:

- Any sort that **compares** elements needs at least about n log n comparisons in the worst case.
- Sorts that do not compare (counting, radix and bucket sort) can beat that limit when the keys are small integers or fall in a known range.

**Stable** means that equal elements keep their original order. It matters when you sort by several keys in turn. Example: sort transactions by amount, then sort them stably by date. Within each date, the amounts stay in order.

**In place** means the sort needs only O(1) or O(log n) extra memory, not a full copy of the data.

## Divide and conquer {#divide}

Merge sort and quicksort are **divide and conquer** algorithms. They split the problem, solve the parts and combine the results.

**Merge sort:**

1. Split the array in half.
2. Sort each half the same way, recursively.
3. **Merge** the two sorted halves in O(n).

There are log n levels of splitting, and each level does O(n) work. So the total is O(n log n), whatever the input. Merging needs O(n) extra space.

**Quicksort:**

1. Choose a **pivot** element.
2. **Partition** the array: smaller elements go to the left of the pivot and larger ones to the right. The pivot is now in its final place.
3. Sort both sides the same way, recursively.

When the pivot splits the array evenly, quicksort is O(n log n). When the pivot is always the smallest or the largest element, it is O(n²). That happens, for example, if you always take the first element of data that is already sorted. The fix is a random pivot, or the **median of three** (the middle value of the first, middle and last elements). Quicksort sorts in place and uses the CPU cache well, which is why it is the fastest in practice.

A **recurrence** is a formula for the running time in terms of smaller inputs. T(n) = 2T(n/2) + n describes merge sort: two half-size problems plus n work to merge. It solves to O(n log n) (by the master theorem).

Recursion uses the call stack, so quicksort's stack depth matters. Recurse into the smaller part first to keep the depth at O(log n).

## Sorting in Java {#java}

- **`Arrays.sort(int[])`** and the other primitive arrays use a **dual-pivot quicksort**. It is not stable, but stability does not matter for primitives, because equal numbers cannot be told apart.
- **`Arrays.sort(Object[])`, `List.sort` and `Collections.sort`** use **TimSort**. TimSort is a mix of merge sort and insertion sort that takes advantage of runs that are already in order. It is **stable**, O(n log n) in the worst case, and close to O(n) on nearly sorted data.
- **`Arrays.parallelSort`** splits the work across CPU cores for large arrays (see [concurrency](lesson:java-concurrency)).
- **`Comparator`** defines the order, for example `Comparator.comparing(Transaction::date).thenComparing(Transaction::amount, Comparator.reverseOrder())`.
  - A comparator must be **consistent**. If a comes before b, then b must come after a. If a comes before b and b before c, then a must come before c.
  - A broken comparator makes TimSort throw `IllegalArgumentException: Comparison method violates its general contract`.
  - Never subtract integers in a comparator, because `a - b` can overflow. Use `Integer.compare`.
- **Streams:** `stream().sorted(comparator)` is stable for ordered streams.
- **Sorted structures:** `TreeMap` and `TreeSet` keep elements sorted as you insert them, at O(log n) each. `PriorityQueue` always gives the smallest element first. See [collections](lesson:java-collections).

```java
record Transaction(String id, LocalDate date, BigDecimal amount) {}

List<Transaction> list = new ArrayList<>(transactions);
list.sort(Comparator.comparing(Transaction::date)                            // oldest first
                    .thenComparing(Transaction::amount, Comparator.reverseOrder())   // then largest first
                    .thenComparing(Transaction::id));                        // last tie-break: make it deterministic
```

## Top-k and the k-th element {#topk}

Sorting everything just to find the largest few items is wasteful, because it costs O(n log n). Better options:

- **A min-heap of size k.** Scan the data and keep the k largest items seen so far in a `PriorityQueue`. When the heap grows past k, drop its smallest item. This takes O(n log k) time and O(k) memory. It also works on a stream whose length you do not know.
- **Quickselect.** Partition like quicksort, but recurse only into the side that contains the k-th position. It is O(n) on average and O(n²) in the worst case. It works in place, so it changes the array.
- **Counting or bucketing**, when the values fall in a small range.

## Practical notes {#practical}

- **Do not write your own sort in production.** Use the library. Spend your effort on a correct comparator, and on not sorting when you do not need to. A heap, a `TreeMap` or a hash index may be a better fit.
- **Sort once, search many times.** Sorting pays off when you then binary search many times. For a single lookup, a linear search or a hash set is cheaper.
- **External sorting.** Data larger than memory is sorted in chunks. Each chunk is sorted and written out, and then all chunks are merged together (a multi-way merge sort). Databases do this for an `ORDER BY` that has no index.
- **Indexes.** A database index is a sorted structure (a B-tree). It turns a full scan into a lookup similar to binary search. See [SQL vs NoSQL](lesson:sql-vs-nosql).

Try it in the lab: [Binary search: halve the range each time](lab:binary-search-halving).

## Cheat sheet {#cheatsheet}

| Need | Use |
| --- | --- |
| Find a value in sorted data | Binary search, O(log n). |
| Find the first or last occurrence | A binary search that keeps going after a match. |
| The smallest value that passes a monotonic test | Binary search on the answer. |
| A general-purpose sort | The library sort: TimSort for objects, dual-pivot quicksort for primitives. |
| Keep equal items in their order | A stable sort, such as merge sort or TimSort. |
| Nearly sorted data, or small arrays | Insertion sort. |
| Sort in place with little memory | Quicksort or heap sort. |
| The top k of a big stream | A min-heap of size k. |
| The k-th element without a full sort | Quickselect. |
| Integers in a small range | Counting sort or radix sort. |

## Interview questions {#questions}

### [basic] What is binary search and what does it require? {#binary-search-q}

It finds a value in a sorted array by checking the middle element and throwing away half of the range at each step.

- It runs in O(log n) time, and O(1) space when written as a loop.
- **It requires sorted data.**
- **It requires random access**, meaning a jump to any position in O(1), as in an array or an `ArrayList`. On a linked list, reaching the middle costs O(n), which removes the benefit.

### [basic] What is the time complexity of binary search and why? {#binary-complexity-q}

**O(log n).**

Each comparison halves the remaining range. For n items, you need about log₂ n halvings before the range is empty. That is roughly 20 steps for a million items and 30 for a billion.

### [basic] What is the difference between a stable and an unstable sort? {#stable-q}

A stable sort keeps equal elements in their original order. An unstable sort may swap them.

- It matters when you sort records by several keys, one after another.
- Merge sort, insertion sort and TimSort are stable.
- Quicksort, heap sort and selection sort are usually not.

### [basic] What sorting algorithm does Java use? {#java-sort-q}

**It depends on the type.**

- For primitive arrays, `Arrays.sort` uses a dual-pivot quicksort.
- For objects, `Arrays.sort`, `Collections.sort` and `List.sort` use TimSort. TimSort is a stable mix of merge sort and insertion sort. It is O(n log n) in the worst case and close to O(n) on nearly sorted data.
- `Arrays.parallelSort` uses several CPU cores for large arrays.

### [basic] Compare merge sort and quicksort. {#merge-vs-quick-q}

| | Merge sort | Quicksort |
| --- | --- | --- |
| Time | O(n log n) in every case. | O(n log n) on average. O(n²) in the worst case, with bad pivots. |
| Extra memory | O(n). | Sorts in place. |
| Stable | Yes. | No. |
| Speed in practice | Good. | Usually faster, because it sorts in place and uses the cache well. |

Use merge sort when you need stability, a guaranteed time, or you are sorting a linked list. Use a quicksort variant when speed and memory matter most.

### [intermediate] How does quicksort work and when is it slow? {#quicksort-q}

1. Pick a pivot.
2. Partition the array so smaller elements are on the left and larger ones on the right. The pivot lands in its final place.
3. Sort both sides the same way, recursively.

It is fast when the pivot splits the array roughly in half. It slows down to O(n²) when the pivot is always an extreme value, for example the first element of data that is already sorted. A random pivot, or the median of three, avoids this.

### [intermediate] Why is merge sort O(n log n)? {#merge-complexity-q}

**Because it has log n levels, and each level costs n.**

1. The array is halved again and again, which gives about log₂ n levels.
2. At each level, every element takes part in one merge step, so each level costs O(n).
3. Together that is n times log n.

This holds in the best, average and worst case, because the splitting does not depend on the data.

### [intermediate] What is the lower bound for comparison sorting and how can you beat it? {#lower-bound-q}

**Ω(n log n) comparisons in the worst case.** Ω means "at least".

- Any sort that only compares elements must choose between all n! possible orders. Each comparison is a yes-or-no question, so it needs about log(n!) questions, which is about n log n. (In other words, a decision tree with n! leaves has a height of log n!.)
- You can beat the limit with sorts that do not compare: counting sort, radix sort and bucket sort. They use the shape of the keys, such as small integers or a fixed length, to run in O(n + k).

### [intermediate] How do you find the k largest elements of a large stream? {#topk-q}

**Keep a min-heap of size k.**

1. Add each element to a `PriorityQueue`.
2. If the heap holds more than k elements, remove the smallest one.
3. At the end, the heap holds the k largest elements.

It takes O(n log k) time and O(k) memory. Unlike sorting the whole input (O(n log n)), it does not need all the data in memory.

### [intermediate] What is quickselect? {#quickselect-q}

A way to find the k-th smallest element without sorting everything.

1. Partition around a pivot, as quicksort does. The pivot's final position is now known.
2. Recurse only into the side that contains position k.

It runs in O(n) on average, O(n²) in the worst case, and works in place.

### [intermediate] What are common mistakes when writing binary search? {#binary-mistakes-q}

- Off-by-one errors in the loop condition and the bounds. Use `lo <= hi` together with `mid ± 1`.
- Integer overflow in `(lo + hi) / 2`. Use `lo + (hi - lo) / 2`.
- An endless loop, when `mid` does not move the range forward.
- Running it on unsorted data.
- Getting duplicates wrong when asked for the first or last occurrence.

### [intermediate] What does `Arrays.binarySearch` return when the key is missing? {#binary-library-q}

**`-(insertion point) - 1`.**

- The insertion point is the index where the key would go to keep the array sorted.
- So any negative result means "not found", and `-result - 1` gives the position to insert.
- If the array is not sorted, the result is undefined.

### [intermediate] How would you sort a list of transactions by date, then by amount descending? {#comparator-q}

Use a chained comparator:

```java
Comparator.comparing(Transaction::date).thenComparing(Transaction::amount, Comparator.reverseOrder())
```

You can add a final tie-break, such as the id, so the order is always the same. Avoid hand-written comparators that subtract, because the subtraction can overflow. Use `Integer.compare`, `Long.compare` or `BigDecimal.compareTo`.

### [deep] What happens when a comparator violates its contract? {#comparator-contract-q}

**TimSort may throw `IllegalArgumentException: Comparison method violates its general contract`.** It may also return a wrongly ordered result with no error.

The comparator must be consistent:

- If a < b and b < c, then a < c.
- `compare(a, b)` must be the negative of `compare(b, a)`.
- Its answers must not change while the sort runs.

Common causes of a broken comparator: subtraction that overflows, rules that contradict each other, or elements that are changed during the sort.

### [deep] How would you sort a file much larger than memory? {#external-sort-q}

**With an external merge sort.**

1. Read a chunk that fits in memory, sort it and write it to disk as a sorted **run**. Repeat for the whole file.
2. Merge all the runs at once (a multi-way merge). A min-heap holds the first element of each run, so the smallest next element is always on top.
3. Write the output in order, from start to end.

Use large chunks and merge many runs at once, so there are fewer passes over the data. Databases use the same technique for `ORDER BY` and for building indexes.

### [deep] How do you search a rotated sorted array in O(log n)? {#rotated-q}

A rotated sorted array is a sorted array that was cut in two and swapped, such as 40, 50, 10, 20, 30.

1. At each step, at least one half of the range is sorted.
2. Compare `a[lo]` with `a[mid]` to find which half is sorted.
3. Check whether the target lies inside that sorted half, and move `lo` or `hi` to keep the right half.

The range still halves at every step, so it is O(log n). With duplicates, the worst case can need a linear scan.

### [deep] When is a hash table better than sorting and binary search? {#hash-vs-sort-q}

**When you only need exact-match lookups.** A hash set or map gives O(1) average time and needs no sorting.

Sorting plus binary search is better when:

- You also need ordered operations: range queries, the nearest value, the minimum and maximum, or sorted output.
- Memory is tight.

A balanced tree (`TreeMap`) gives you both ordered operations and inserts, at O(log n).

### [coding] Write binary search for the first occurrence of a value. {#coding-first-occurrence}

```java
static int firstOccurrence(int[] a, int target) {
    int lo = 0, hi = a.length - 1, answer = -1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] == target) {
            answer = mid;          // remember it, but keep looking to the left
            hi = mid - 1;
        } else if (a[mid] < target) {
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return answer;
}
```

How it works:

- A normal binary search stops at any match.
- Here a match is remembered, and the search continues in the left half.
- It is still O(log n).
- To find the last occurrence, do the same but continue to the right.

### [coding] Implement merge sort. {#coding-merge-sort}

```java
static int[] mergeSort(int[] a) {
    if (a.length <= 1) return a;                           // base case: already sorted
    int mid = a.length / 2;
    int[] left = mergeSort(Arrays.copyOfRange(a, 0, mid));
    int[] right = mergeSort(Arrays.copyOfRange(a, mid, a.length));
    return merge(left, right);
}

static int[] merge(int[] left, int[] right) {
    int[] result = new int[left.length + right.length];
    int i = 0, j = 0, k = 0;
    while (i < left.length && j < right.length) {
        result[k++] = left[i] <= right[j] ? left[i++] : right[j++];   // <= keeps it stable
    }
    while (i < left.length) result[k++] = left[i++];
    while (j < right.length) result[k++] = right[j++];
    return result;
}
```

How it works:

- The array is split until only single elements remain.
- `merge` combines two sorted arrays in one pass, which is O(n).
- On a tie, it takes the left element first. That keeps the sort stable.
- The total time is O(n log n), with O(n) extra space.

### [coding] Find the k-th largest element with a heap. {#coding-kth-largest}

```java
static int kthLargest(int[] nums, int k) {
    PriorityQueue<Integer> heap = new PriorityQueue<>();    // min-heap: the smallest is on top
    for (int n : nums) {
        heap.offer(n);
        if (heap.size() > k) heap.poll();                   // drop the smallest, keep the k largest
    }
    return heap.peek();                                      // the smallest of the k largest = the k-th largest
}
```

How it works:

- The heap never holds more than k elements, so each step costs O(log k). The total is O(n log k).
- The answer is the top of the heap.
- If you may change the input, quickselect gives O(n) average time.

### [coding] Quicksort with a random pivot (Lomuto partition). {#coding-quicksort}

```java
static void quickSort(int[] a, int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(a, lo, hi);
    quickSort(a, lo, p - 1);
    quickSort(a, p + 1, hi);
}

static int partition(int[] a, int lo, int hi) {
    int r = ThreadLocalRandom.current().nextInt(lo, hi + 1);   // random pivot avoids the O(n²) case on sorted data
    swap(a, r, hi);
    int pivot = a[hi];
    int s = lo;                                                // next slot for an element smaller than the pivot
    for (int j = lo; j < hi; j++) {
        if (a[j] < pivot) swap(a, s++, j);
    }
    swap(a, s, hi);                                            // the pivot lands in its final place
    return s;
}

static void swap(int[] a, int i, int j) { int t = a[i]; a[i] = a[j]; a[j] = t; }
```

How it works:

- `s` marks the end of the part that holds elements smaller than the pivot.
- After the loop, the pivot is swapped into position `s`, and it never moves again.
- Both sides are then sorted the same way.
- The average time is O(n log n). The worst case is O(n²), which is unlikely with a random pivot.
- It sorts in place.
